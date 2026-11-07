/**
 * measureKitchenMakeable.mjs — WEAK-3 checks (docs/kitchen-makeable.md).
 *
 *   node scripts/measureKitchenMakeable.mjs
 *
 * For three fixed kitchens: Cookbook recipes "you can make" before (every
 * ingredient covered, the old rule) and after (every main covered, swaps
 * allowed), with and without the spice rack; a mechanical re-check that
 * every listed recipe has all its mains covered directly or by a table
 * swap; and a partner-overlap sanity check of each swap in the blended
 * everyday-pairs index.
 */
import fs from 'node:fs';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { cookbookForKitchen } from '../src/data/kitchenRecipes.js';
import { whatCanICook, kitchenKey, haveIngredient } from '../src/data/myKitchen.js';
import { categoryLookup, splitRecipe } from '../src/data/recipeMains.js';
import { SWAPS, findSwap } from '../src/data/kitchenSwaps.js';
import { resolveIngredientName } from '../src/data/recipePairingMatch.js';
import { buildPairingIndex } from '../src/data/recipePairingMatch.js';
import { blendIndex, parseEverydayPairs } from '../src/data/everydayPairs.js';

const ingredients = JSON.parse(fs.readFileSync('public/proDataset/ingredients.json', 'utf8'));
const names = new Set(Object.keys(ingredients));
const categoryOf = categoryLookup(ingredients);

const KITCHENS = {
  K30: 'chicken, garlic, lemon, rice, onion, tomato, pasta, parmesan, basil, egg, potato, carrot, beef, milk, cheddar, bell pepper, cumin, paprika, soy sauce, ginger, cilantro, lime, black beans, tortilla, bread, cream, mushroom, spinach, chili, honey',
  K6: 'chicken, garlic, lemon, rice, onion, tomato',
  K5: 'beef, onion, potato, carrot, thyme',
  // For the by-eye review (c): K30 plus ten more everyday items.
  K40: 'chicken, garlic, lemon, rice, onion, tomato, pasta, parmesan, basil, egg, potato, carrot, beef, milk, cheddar, bell pepper, cumin, paprika, soy sauce, ginger, cilantro, lime, black beans, tortilla, bread, cream, mushroom, spinach, chili, honey, yogurt, bacon, cucumber, chickpea, shrimp, coconut milk, pita bread, sour cream, feta, celery',
};

const asKitchen = (s) => [...new Set(s.split(', ').map((x) => kitchenKey(x, names)))];

function verify(entry, kitchen, opts) {
  // Re-derive mains and check each one independently of coverIngredients.
  const r = entry.item;
  const resolve = (n) => resolveIngredientName(n, names);
  const { main } = splitRecipe(r, { categoryOf, resolve });
  const set = new Set(kitchen);
  const has = (x) => haveIngredient(x, set, { ...opts, names }).covered;
  const inRecipe = new Set(r.ingredients.map((x) => x.toLowerCase()));
  const bad = main.filter((m) => !has(m) && !findSwap(m, has, { main: true, inRecipe }));
  return bad;
}

function run(label, kitchenText, { spiceRack = false } = {}) {
  const kitchen = asKitchen(kitchenText);
  const before = whatCanICook(SEED_RECIPES, kitchen, { maxMissing: 2, assumeBasics: true, names });
  const after = cookbookForKitchen(SEED_RECIPES, kitchen, { assumeBasics: true, spiceRack, names, categoryOf });
  const bad = after.make.map((e) => [e.item.id, verify(e, kitchen, { assumeBasics: true, spiceRack })]).filter(([, b]) => b.length);
  console.log(`\n## ${label}${spiceRack ? ' + spice rack' : ''}  (kitchen as stored: ${kitchen.join(', ')})`);
  console.log(`before: make ${before.make.length}, nearly ${before.nearly.length}`);
  console.log(`after:  make ${after.make.length} (${after.make.filter((e) => e.withSwap).length} with a swap), one/two mains away ${after.nearly.length}`);
  console.log(`mechanical check: ${bad.length === 0 ? 'every listed recipe has all mains covered' : `FAIL ${JSON.stringify(bad)}`}`);
  for (const e of after.make) {
    const sw = e.swaps.map((s) => `${[s.use, ...s.plus].join('+')} for ${s.for}`).join('; ');
    console.log(`  - ${e.item.id}: mains ${e.total}${sw ? ` | swaps: ${sw}` : ''}${e.better.length ? ` | even better with: ${e.better.join(', ')}` : ''}`);
  }
  const betterCount = after.make.reduce((s, e) => s + e.better.length, 0);
  console.log(`  "even better with" items across make: ${betterCount}`);
  return after;
}

run('K30', KITCHENS.K30);
run('K30', KITCHENS.K30, { spiceRack: true });
run('K6', KITCHENS.K6);
run('K6', KITCHENS.K6, { spiceRack: true });
run('K5', KITCHENS.K5);
run('K40', KITCHENS.K40);

// Swap sanity check: do the two sides share everyday partners? Top-30
// partners per side in the blended index; Jaccard of the two sets. Pairs
// that are NOT swaps (garlic for onion, flour for egg …) give the floor.
const edges = JSON.parse(fs.readFileSync('public/proDataset/pairings.json', 'utf8')).map((p) => ({
  source: p.ingredientA, target: p.ingredientB, strength: p.strength, known: p.known === true,
  ...(typeof p.tradition === 'number' ? { cooccurrence: p.tradition } : {}),
}));
const everyday = parseEverydayPairs(JSON.parse(fs.readFileSync('public/proDataset/everyday_pairs.json', 'utf8')));
const idx = blendIndex(buildPairingIndex(edges, names), everyday);
const byName = new Map();
for (const [k, v] of idx.strength) {
  const a = k.slice(0, k.indexOf('|'));
  if (!byName.has(a)) byName.set(a, []);
  byName.get(a).push([k.slice(k.indexOf('|') + 1), v]);
}
const top = (n) => new Set((byName.get(n) || []).sort((x, y) => y[1] - x[1]).slice(0, 30).map((x) => x[0]));
const jac = (a, b) => {
  const A = top(a);
  const B = top(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni ? inter / uni : null;
};
console.log('\n## Swap partner overlap (blended index, Jaccard of top-30 partners)');
const vals = [];
const low = [];
for (const s of SWAPS) {
  const j = jac(s.for, s.use);
  if (j != null) vals.push(j);
  if (j == null || j < 0.15) low.push(`${s.use} for ${s.for} ${j == null ? 'n/a' : j.toFixed(2)}`);
}
const NOT = [['onion', 'garlic'], ['egg', 'flour'], ['lemon', 'milk'], ['parsley', 'cinnamon'], ['cream', 'soy sauce'], ['white wine', 'honey'], ['butter', 'vinegar'], ['scallion', 'carrot']];
const floor = NOT.map(([a, b]) => jac(a, b) ?? 0);
const mean = (xs) => xs.reduce((p, q) => p + q, 0) / xs.length;
const sorted = [...vals].sort((a, b) => a - b);
console.log(`swaps: n=${vals.length} of ${SWAPS.length}, mean ${mean(vals).toFixed(2)}, median ${sorted[Math.floor(sorted.length / 2)].toFixed(2)}, min ${sorted[0].toFixed(2)}`);
console.log(`non-swaps (floor): mean ${mean(floor).toFixed(2)} — ${NOT.map(([a, b], i) => `${b} for ${a} ${floor[i].toFixed(2)}`).join(', ')}`);
console.log(`swaps under 0.15 or unscored: ${low.join('; ') || 'none'}`);
