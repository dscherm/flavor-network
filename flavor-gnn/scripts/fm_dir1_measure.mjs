/**
 * WEAK-2 — measure the quality of a directions index.
 *
 *   node flavor-gnn/scripts/fm_dir1_measure.mjs [index.json] [--sample N] [--seed S]
 *
 * Reports, over the index's own fields (vocab names of `v`, title `t`,
 * steps `d`):
 *   1. steps that mention none of the entry's ingredients;
 *   2. entries repeating an earlier entry's title (exact, case-insensitive;
 *      and by normalizeTitle);
 *   3. titles naming a headline food (MAIN_FOODS) absent from the ingredient
 *      list — split into foods the vocab can represent and foods it cannot;
 *   4. a seeded random sample of entries printed for eyeballing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  stepMentions, normalizeTitle, titleFoods, foodInNames, representableFoods, seededHash,
} from '../../src/ml/directionsQuality.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const indexPath = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))
  || path.join(ROOT, 'public', 'models', 'directions_index.json');
const SAMPLE = flag('--sample', 20);
const SEED = flag('--seed', 7);

const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'models', 'recipe_vocab.json'), 'utf-8')).vocab;
const representable = representableFoods(vocab);
const recs = index.recipes;
const N = recs.length;

let noMention = 0;
let dupExact = 0;
let dupNorm = 0;
let foodMissingMappable = 0;
let foodUnmappable = 0;
const seenExact = new Set();
const seenNorm = new Set();
const unmappableExamples = new Map();

for (const r of recs) {
  const names = r.v.map((id) => vocab[id]);
  if (stepMentions(r.d, names).mentioned === 0) noMention++;
  const ex = String(r.t || '').trim().toLowerCase();
  if (seenExact.has(ex)) dupExact++; else seenExact.add(ex);
  const nt = normalizeTitle(r.t);
  if (seenNorm.has(nt)) dupNorm++; else seenNorm.add(nt);
  let mapMiss = false;
  let unmap = false;
  for (const key of titleFoods(r.t)) {
    if (representable.has(key)) { if (!foodInNames(key, names)) mapMiss = true; }
    else { unmap = true; unmappableExamples.set(key, (unmappableExamples.get(key) || 0) + 1); }
  }
  if (mapMiss) foodMissingMappable++;
  if (unmap) foodUnmappable++;
}

const pct = (x) => `${x} (${((100 * x) / N).toFixed(1)}%)`;
const size = fs.statSync(indexPath).size;
console.log(`index: ${indexPath}`);
console.log(`entries: ${N}   size: ${(size / 1e6).toFixed(2)} MB`);
console.log(`1. steps mention none of their ingredients: ${pct(noMention)}`);
console.log(`2. repeat an earlier title — exact (case-insensitive): ${pct(dupExact)}; normalised: ${pct(dupNorm)}`);
console.log(`3. title names a vocab-representable food missing from the list: ${pct(foodMissingMappable)}`);
console.log(`   title names a food the vocab cannot represent: ${pct(foodUnmappable)} ${JSON.stringify(Object.fromEntries(unmappableExamples))}`);

if (SAMPLE > 0) {
  const order = recs.map((_, i) => i).sort((a, b) => seededHash(a, SEED) - seededHash(b, SEED)).slice(0, SAMPLE);
  console.log(`\nSample of ${SAMPLE} (seed ${SEED}):`);
  for (const i of order) {
    const r = recs[i];
    console.log(`\n#${i} ${r.t}`);
    console.log(`  ingredients: ${r.v.map((id) => vocab[id]).join(', ')}`);
    console.log(`  steps: ${r.d.join(' ').slice(0, 320)}`);
  }
}
