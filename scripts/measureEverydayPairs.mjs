#!/usr/bin/env node
/**
 * measureEverydayPairs.mjs — WEAK-A before/after for docs/everyday-pairs.md.
 *
 * "Curated" = buildPairingIndex over pairings.json (observed edges, the
 * `tradition` sub-score, as useProData hands it to the app).
 * "Blended" = blendIndex(curated, everyday_pairs.json).
 *
 *   (a) named common pairs present
 *   (b) Cookbook recipe ingredient pairs with any edge
 *
 * Parts (c) to (e) of the doc (Invent a recipe / sauce / cocktail, shuffled
 * through the generators) were dropped on 2026-11-14 when those generators
 * were retired; see docs/everyday-pairs.md.
 *
 * Usage: node scripts/measureEverydayPairs.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => path.join(ROOT, 'public', p);
const src = (p) => pathToFileURL(path.join(ROOT, 'src', p)).href;

// Node fetch stub: '/x' → public/x (loadSauceCodex etc. fetch app-relative URLs).
globalThis.fetch = async (url) => {
  const p = pub(String(url).replace(/^\//, ''));
  try {
    const text = readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

const { SEED_RECIPES } = await import(src('data/seedRecipes.js'));
const { buildPairingIndex, resolveIngredientName, isTrivialIngredient } = await import(src('data/recipePairingMatch.js'));
const { parseEverydayPairs, blendIndex } = await import(src('data/everydayPairs.js'));

const ingredients = JSON.parse(readFileSync(pub('proDataset/ingredients.json'), 'utf8'));
const names = new Set(Object.keys(ingredients));
const edges = JSON.parse(readFileSync(pub('proDataset/pairings.json'), 'utf8')).map((p) => ({
  source: p.ingredientA, target: p.ingredientB, strength: p.strength, known: p.known === true,
  ...(typeof p.tradition === 'number' ? { cooccurrence: p.tradition } : {}),
}));
const curated = buildPairingIndex(edges, names);
const everyday = parseEverydayPairs(JSON.parse(readFileSync(pub('proDataset/everyday_pairs.json'), 'utf8')));
const blended = blendIndex(curated, everyday);
const INDEXES = { curated, blended };
const S = (idx, a, b) => idx.strength.get(`${a}|${b}`) || 0;
const out = {};

// (a)
const NAMED = [['chicken', 'garlic'], ['chicken', 'lemon'], ['chicken', 'onion'], ['rice', 'chicken'], ['garlic', 'onion'],
  ['garlic', 'olive oil'], ['beef', 'onion'], ['lemon', 'garlic'], ['potato', 'onion'], ['butter', 'garlic']];
out.a = NAMED.map(([x, y]) => ({ pair: `${x}|${y}`, curated: +S(curated, x, y).toFixed(2), blended: +S(blended, x, y).toFixed(2) }));

// (b)
const trivial = typeof isTrivialIngredient === 'function' ? isTrivialIngredient : () => false;
out.b = {};
let unresolved = 0; let resolvedN = 0;
const recipeSets = SEED_RECIPES.map((r) => {
  const set = new Set();
  for (const raw of r.ingredients) {
    const n = resolveIngredientName(raw, names);
    if (!n) { if (!trivial(raw)) unresolved += 1; continue; }
    if (trivial(n)) continue;
    resolvedN += 1;
    set.add(n);
  }
  return [...set];
});
for (const [label, idx] of Object.entries(INDEXES)) {
  let have = 0; let total = 0; let recipesAll = 0;
  for (const set of recipeSets) {
    let rHave = 0; let rTot = 0;
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) { rTot += 1; if (S(idx, set[i], set[j]) > 0) rHave += 1; }
    have += rHave; total += rTot; if (rTot && rHave === rTot) recipesAll += 1;
  }
  out.b[label] = { pairs: total, withEdge: have, share: +(have / total).toFixed(3), recipesFullyLinked: recipesAll };
}
out.b.recipes = SEED_RECIPES.length; out.b.resolvedIngredients = resolvedN; out.b.unresolvedIngredients = unresolved;

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else console.dir(out, { depth: 6, maxArrayLength: 50 });
