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

    self.postMessage({ type: 'progress', stage: 'fetching-pairings' });
    const pairingsRes = await fetch('/proDataset/pairings.json');
    if (!pairingsRes.ok) {
      throw new Error('Failed to load proDataset/pairings.json');
    }

    self.postMessage({ type: 'progress', stage: 'parsing-pairings' });
    const pairingsData = await pairingsRes.json();

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
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err && err.message ? err.message : String(err),
    });
  }
};
