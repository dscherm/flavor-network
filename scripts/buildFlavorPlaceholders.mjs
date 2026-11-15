// FLAVOR-2. Finds the placeholder flavor vectors in public/proDataset/gnn_entropy.json BY VALUE: any exact
// taste vector (5 values) or aroma vector (6 values) carried by more than MIN_SHARED ingredients. The model
// had nothing for those ingredients and filled in one constant; sugar, salt, coffee and gin share it.
// Writes src/data/flavorPlaceholders.json (committed). Runs first in `prebuild` and the functions
// predeploy, before buildShareIndex.mjs, which imports code that reads the JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_PATH = resolve(ROOT, 'src/data/flavorPlaceholders.json');
const SRC_PATH = resolve(ROOT, 'public/proDataset/gnn_entropy.json');

/**
 * Taste vectors are shared by 1526, 261 and 249 ingredients, then by at most 95; aroma by 2062, then at
 * most 95. Vectors in the 5-95 range are one ingredient's compound data repeated across its aliases
 * (all the "chicken ..." names, all the "vanilla ..." names). 150 sits in the gap.
 */
export const MIN_SHARED = 150;
export const TASTE_AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami'];
export const AROMA_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];

export const vectorKey = (probs, axes) => axes.map((a) => (typeof probs?.[a] === 'number' ? probs[a].toFixed(4) : '')).join(',');

export function buildFlavorPlaceholders(raw = JSON.parse(readFileSync(SRC_PATH, 'utf8'))) {
  const out = { minShared: MIN_SHARED, taste: {}, aroma: {} };
  for (const [field, axes] of [['taste', TASTE_AXES], ['aroma', AROMA_AXES]]) {
    const counts = new Map();
    for (const [name, info] of Object.entries(raw)) {
      if (name.startsWith('_') || !info?.probs) continue;
      if (axes.some((a) => typeof info.probs[a] !== 'number')) continue;
      const k = vectorKey(info.probs, axes);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const kept = [...counts].filter(([, c]) => c > MIN_SHARED).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    out[field] = Object.fromEntries(kept);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = buildFlavorPlaceholders();
  writeFileSync(OUT_PATH, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`flavor placeholders: ${Object.keys(out.taste).length} taste, ${Object.keys(out.aroma).length} aroma vectors -> ${OUT_PATH}`);
}
