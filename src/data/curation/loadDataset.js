/**
 * loadDataset.js — THE curated loader. The only module in src/ allowed to fetch ingredients.json or
 * pairings.bin / pairings.json (src/__tests__/curationGuard.test.js enforces it).
 *
 * Runs inside the pairings worker (off the main thread), or on the main thread where Workers are
 * unavailable. Returns the ingredients and pairings with the curation tables applied.
 *
 * Pairing merge placement: pairings.bin is built by scripts/buildPairingsBinary.cjs with the same
 * applyCuration, so for the binary path the pairings arrive already merged and only the (small)
 * ingredients object is curated here. The slower JSON fallback merges at load. The binary keeps the
 * raw ingredients.json index order plus the additions table's names (binaryIndexObject).
 */
import { applyCuration, binaryIndexObject } from './applyCuration.js';
import { CURATION_TABLES } from './tables.js';
import { decodePairingsBinary } from '../pairingsBinary.js';

export function curateIngredients(rawIngredients) {
  return applyCuration(rawIngredients, null, CURATION_TABLES);
}

export function curatePairings(rawIngredients, pairings) {
  return applyCuration(rawIngredients, pairings, CURATION_TABLES);
}

/**
 * Only the curated ingredient table (about 0.6 MB), without the pairings (tens of MB). For screens that need
 * names and categories and nothing else (the shopping list).
 * @param {(url: string) => Promise<Response>} fetchFn
 */
export async function loadCuratedIngredients(fetchFn) {
  const res = await fetchFn('/proDataset/ingredients.json');
  if (!res.ok) throw new Error('Failed to load proDataset/ingredients.json');
  return curateIngredients(await res.json()).ingredients;
}

/**
 * @param {(url: string) => Promise<Response>} fetchFn
 * @param {(stage: string) => void} [onProgress]
 * @returns {Promise<{ ingredientsData: object, pairingsData: object[], usedFormat: 'bin'|'json', report: object }>}
 */
export async function loadCuratedDataset(fetchFn, onProgress = () => {}) {
  onProgress('fetching-ingredients');
  const ingredientsRes = await fetchFn('/proDataset/ingredients.json');
  if (!ingredientsRes.ok) throw new Error('Failed to load proDataset/ingredients.json');
  onProgress('parsing-ingredients');
  const rawIngredients = await ingredientsRes.json();

  onProgress('fetching-pairings');
  let pairings = null;
  let usedFormat = 'json';
  try {
    const binRes = await fetchFn('/proDataset/pairings.bin');
    if (binRes.ok) {
      const buf = await binRes.arrayBuffer();
      onProgress('decoding-pairings-bin');
      pairings = decodePairingsBinary(buf, binaryIndexObject(rawIngredients, CURATION_TABLES.additions));
      usedFormat = 'bin';
    }
  } catch {
    onProgress('bin-decode-failed-falling-back');
  }
  if (!pairings) {
    onProgress('parsing-pairings');
    const res = await fetchFn('/proDataset/pairings.json');
    if (!res.ok) throw new Error('Failed to load proDataset/pairings.json');
    pairings = await res.json();
  }

  const { ingredients, pairings: merged, report } = usedFormat === 'bin'
    ? { ...curateIngredients(rawIngredients), pairings }
    : curatePairings(rawIngredients, pairings);
  return { ingredientsData: ingredients, pairingsData: merged, usedFormat, report };
}
