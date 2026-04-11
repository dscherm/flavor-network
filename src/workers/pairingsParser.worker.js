/**
 * pairingsParser.worker.js — off-main-thread JSON fetch + parse.
 *
 * The pairings.json payload is ~27MB. Parsing it on the main thread
 * blocks the UI for 6.8s on WiFi and 16.9s on LTE (measured in
 * simulation/output/recommendations.md). This worker moves the fetch
 * and JSON.parse calls into a background thread so the main thread
 * stays responsive during the initial load.
 *
 * Protocol:
 *   main -> worker: { type: 'load' }
 *   worker -> main: { type: 'progress', stage: 'fetching-ingredients' | 'parsing-ingredients' | 'fetching-pairings' | 'parsing-pairings' | 'fetching-season' | 'fetching-cuisine' }
 *   worker -> main: { type: 'loaded', ingredientsData, pairingsData, seasonRegionData, cuisineMapData }
 *   worker -> main: { type: 'error', message }
 *
 * This worker deliberately does NOT run buildProGraph or
 * computeTastePositions — those touch module code that may evolve,
 * and the biggest win is getting the 27MB JSON.parse off the main
 * thread. Graph construction stays on the main thread where React
 * state lives.
 */

/* eslint-env worker */

/**
 * Decode the packed pairings.bin format into the same shape the
 * main-thread code expects (array of {ingredientA, ingredientB,
 * strength}). See scripts/buildPairingsBinary.cjs for the layout.
 */
function decodePairingsBinary(arrayBuffer, ingredientsData) {
  const view = new DataView(arrayBuffer);
  const magic = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
  );
  if (magic !== 'FNPR') {
    throw new Error(`bad magic ${JSON.stringify(magic)} in pairings.bin`);
  }
  const version = view.getUint32(4, true);
  if (version !== 1) {
    throw new Error(`unsupported pairings.bin version ${version}`);
  }
  const count = view.getUint32(8, true);

  // Rebuild the ingredient index in the same order the builder used:
  // insertion order of ingredients.json, skipping meta keys.
  const idxToName = [];
  for (const key of Object.keys(ingredientsData)) {
    if (key.startsWith('_')) continue;
    idxToName.push(key);
  }

  const out = new Array(count);
  const RECORD_BYTES = 8;
  let offset = 12;
  for (let i = 0; i < count; i++) {
    const a = view.getUint16(offset, true);
    const b = view.getUint16(offset + 2, true);
    const strength = view.getFloat32(offset + 4, true);
    out[i] = {
      ingredientA: idxToName[a],
      ingredientB: idxToName[b],
      strength,
    };
    offset += RECORD_BYTES;
  }
  return out;
}

self.onmessage = async (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'load') return;

  try {
    self.postMessage({ type: 'progress', stage: 'fetching-ingredients' });
    const ingredientsRes = await fetch('/proDataset/ingredients.json');
    if (!ingredientsRes.ok) {
      throw new Error('Failed to load proDataset/ingredients.json');
    }

    self.postMessage({ type: 'progress', stage: 'parsing-ingredients' });
    const ingredientsData = await ingredientsRes.json();

    // Prefer the packed binary format (~380 KB vs 27 MB JSON). Fall
    // back to pairings.json if the binary is missing or fails to
    // decode — keeps old deployments / dev trees working.
    self.postMessage({ type: 'progress', stage: 'fetching-pairings' });
    let pairingsData = null;
    let usedFormat = 'json';
    try {
      const binRes = await fetch('/proDataset/pairings.bin');
      if (binRes.ok) {
        const arrayBuffer = await binRes.arrayBuffer();
        self.postMessage({ type: 'progress', stage: 'decoding-pairings-bin' });
        pairingsData = decodePairingsBinary(arrayBuffer, ingredientsData);
        usedFormat = 'bin';
      }
    } catch (err) {
      // Will fall through to JSON
      self.postMessage({
        type: 'progress',
        stage: 'bin-decode-failed-falling-back',
      });
    }

    if (!pairingsData) {
      const pairingsRes = await fetch('/proDataset/pairings.json');
      if (!pairingsRes.ok) {
        throw new Error('Failed to load proDataset/pairings.json');
      }
      self.postMessage({ type: 'progress', stage: 'parsing-pairings' });
      pairingsData = await pairingsRes.json();
    }

    self.postMessage({ type: 'progress', stage: 'fetching-season' });
    let seasonRegionData = {};
    try {
      const seasonRes = await fetch('/data/season_region.json');
      if (seasonRes.ok) seasonRegionData = await seasonRes.json();
    } catch {
      // optional file — ignore
    }

    self.postMessage({ type: 'progress', stage: 'fetching-cuisine' });
    let cuisineMapData = {};
    try {
      const cuisineRes = await fetch('/data/cuisine_map.json');
      if (cuisineRes.ok) cuisineMapData = await cuisineRes.json();
    } catch {
      // optional file — ignore
    }

    self.postMessage({
      type: 'loaded',
      ingredientsData,
      pairingsData,
      seasonRegionData,
      cuisineMapData,
      pairingsFormat: usedFormat,
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err && err.message ? err.message : String(err),
    });
  }
};
