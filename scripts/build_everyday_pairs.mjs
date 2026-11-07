#!/usr/bin/env node
/**
 * build_everyday_pairs.mjs — WEAK-A: the "everyday pairs" index.
 *
 * Reads the raw RecipeNLG co-occurrence counts
 * (proDataset/processed/recipenlg-cooccurrence.json, 2.2M recipes) and the
 * app vocabulary (public/proDataset/ingredients.json), keeps each
 * ingredient's top partners by a lift-aware count score (selection rule in
 * src/data/everydayPairsSelect.js) and writes a small artifact:
 *
 *   public/proDataset/everyday_pairs.json
 *   { _meta: {...}, names: [name, ...], pairs: [ia, ib, s, ia, ib, s, ...] }
 *     ia < ib index into `names`; s = strength × 100 (integer 1..100).
 *
 * Strengths are quantile-mapped onto the curated graph's observed-pair
 * strengths (pairings.json `tradition`, the sub-score buildPairingIndex
 * uses), so max(curated, everyday) in blendIndex compares like with like.
 *
 * Used ONLY by the invent + kitchen features (src/data/everydayPairs.js).
 * pairings.json / pairings.bin and everything ranked from them are untouched.
 *
 * Deterministic: same inputs → byte-identical output (no timestamps).
 *
 * Usage: node scripts/build_everyday_pairs.mjs [--check]
 *   --check  print the selection report without writing the file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  selectEverydayPairs, pairStrengths, EVERYDAY_MIN_COUNT, EVERYDAY_TOP_K,
} from '../src/data/everydayPairsSelect.js';
import { TRIVIAL } from '../src/data/recipePairingMatch.js';
import { SUGGESTION_EXCLUDE } from '../src/ml/recipeRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CO = path.join(ROOT, 'proDataset/processed/recipenlg-cooccurrence.json');
const VOCAB = path.join(ROOT, 'public/proDataset/ingredients.json');
const CURATED = path.join(ROOT, 'public/proDataset/pairings.json');
const OUT = path.join(ROOT, 'public/proDataset/everyday_pairs.json');
const check = process.argv.includes('--check');

const co = JSON.parse(fs.readFileSync(CO, 'utf8'));
const vocab = new Set(Object.keys(JSON.parse(fs.readFileSync(VOCAB, 'utf8'))));
const exclude = new Set([...TRIVIAL, ...SUGGESTION_EXCLUDE]);

const { pairs, mapping } = selectEverydayPairs(co, { vocab, exclude });

// Reference distribution: curated observed-pair strengths as buildPairingIndex reads them.
let reference = null;
try {
  const curated = JSON.parse(fs.readFileSync(CURATED, 'utf8'));
  reference = curated
    .filter((e) => e && e.known === true)
    .map((e) => (typeof e.tradition === 'number' ? e.tradition : e.strength))
    .filter((x) => typeof x === 'number' && Number.isFinite(x))
    .sort((a, b) => a - b);
} catch (e) {
  console.warn(`[everyday] curated pairings unreadable (${e.message}); using plain percentiles`);
}
const strengths = pairStrengths(pairs, reference);

const nameSet = new Set();
for (const p of pairs) { nameSet.add(p.a); nameSet.add(p.b); }
const names = [...nameSet].sort();
const idx = new Map(names.map((n, i) => [n, i]));
const flat = [];
pairs.forEach((p, i) => { flat.push(idx.get(p.a), idx.get(p.b), Math.round(strengths[i] * 100)); });

const vocabCovered = [...vocab].filter((v) => nameSet.has(v)).length;
const vocabInCo = new Set(mapping.map.values());
const meta = {
  source: 'proDataset/processed/recipenlg-cooccurrence.json',
  totalRecipes: co.totalRecipes,
  rule: `count >= ${EVERYDAY_MIN_COUNT}, PMI > 0, score = log10(count)^3 * cbrt(min(PMI,3)), top ${EVERYDAY_TOP_K} per ingredient (either side)`,
  strength: reference ? 'score percentile quantile-mapped onto curated known-pair tradition' : 'score percentile',
  excluded: [...exclude].sort(),
  pairs: pairs.length,
  names: names.length,
  mapping: {
    cooccurrenceNames: Object.keys(co.ingredients).length,
    direct: mapping.direct,
    aliased: mapping.aliased,
    unmapped: mapping.unmapped.length,
    vocabNames: vocab.size,
    vocabWithCounts: [...vocab].filter((v) => vocabInCo.has(v)).length,
    vocabWithPartners: vocabCovered,
  },
};
const out = JSON.stringify({ _meta: meta, names, pairs: flat });

const get = (a, b) => {
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
  const i = pairs.findIndex((p) => `${p.a}|${p.b}` === k);
  return i < 0 ? null : { s: strengths[i], count: pairs[i].count, pmi: +pairs[i].pmi.toFixed(2) };
};
console.log(JSON.stringify(meta.mapping));
console.log(`pairs ${pairs.length}, names ${names.length}, size ${(out.length / 1024).toFixed(0)} KB`);
for (const [a, b] of [['chicken', 'garlic'], ['chicken', 'lemon'], ['chicken', 'onion'], ['rice', 'chicken'], ['garlic', 'onion'], ['garlic', 'olive oil'], ['beef', 'onion'], ['lemon', 'garlic']]) {
  console.log(`  ${a}|${b}`, JSON.stringify(get(a, b)));
}
console.log('  aliased sample:', [...mapping.map].filter(([k, v]) => k !== v).slice(0, 25).map(([k, v]) => `${k}→${v}`).join(', '));

if (!check) {
  fs.writeFileSync(OUT, out);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
}
