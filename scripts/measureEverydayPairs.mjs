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
 *   (c) Invent a recipe: 3 kitchens × 5 shuffles, REAL set-completion model
 *       (onnxruntime-node on public/models/recipe-setcompletion.onnx)
 *   (d) Invent a sauce: one pantry × every style × 5 shuffles
 *   (e) Invent a cocktail: one bar × every family (to decide whether to wire it)
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
const { inventRecipes } = await import(src('data/inventRecipe.js'));
const { inventSauces, INVENT_STYLES } = await import(src('data/inventSauce.js'));
const { loadSauceCodex } = await import(src('data/sauceCodex.js'));
const { buildCategoryMap } = await import(src('data/saucePantry.js'));
const { inventCocktails, FAMILY_SKELETONS } = await import(src('data/cocktailInvent.js'));
const { buildRolePool } = await import(src('data/cocktailRiff.js'));
const { suggestIngredients, buildVocabIndex } = await import(src('ml/recipeRuntime.js'));
const ort = await import('onnxruntime-node');

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

// Seeded shuffle.
function shuffled(list, seed) {
  let s = seed;
  const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const SEEDS = [11, 23, 37, 51, 73];

function citedPairs(whys) {
  const tally = new Map();
  for (const w of whys) {
    const m = w.match(/: (.*)\.$/);
    if (!m) continue;
    for (const p of m[1].split(', ')) tally.set(p, (tally.get(p) || 0) + 1);
  }
  return [...tally].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([p, n]) => `${p} ×${n}`);
}

// (c) Invent a recipe — real model.
const meta = JSON.parse(readFileSync(pub('models/recipe_vocab.json'), 'utf8'));
const session = await ort.InferenceSession.create(pub('models/recipe-setcompletion.onnx'));
const model = { ort, session, meta, vocabIndex: buildVocabIndex(meta.vocab) };
const suggest = (observed, opts) => suggestIngredients(observed, opts, model);
const nodes = new Map(Object.entries(ingredients).map(([n, v]) => [n, { category: v.category, cuisines: v.cuisines || [] }]));
const KITCHENS = {
  'chicken kitchen': ['chicken', 'garlic', 'lemon', 'rice', 'onion', 'tomato'],
  'pasta kitchen': ['pasta', 'tomato', 'basil', 'parmesan', 'garlic', 'olive oil'],
  'beef kitchen': ['beef', 'onion', 'potato', 'carrot', 'thyme'],
};
out.c = {};
for (const [kname, kitchen] of Object.entries(KITCHENS)) {
  out.c[kname] = {};
  for (const [label, idx] of Object.entries(INDEXES)) {
    const sizes = []; const sets = new Set(); const top3 = new Set(); const whys = []; const outside = [];
    for (const seed of SEEDS) {
      const r = await inventRecipes({ kitchen: shuffled(kitchen, seed), cuisine: null, suggest, pairingIndex: idx, nodes, names, limit: 12 });
      if (!r.ok) continue;
      r.inventions.forEach((inv, i) => {
        const ns = inv.ingredients.map((x) => x.name);
        sizes.push(ns.length);
        const key = [...ns].sort().join(' + ');
        sets.add(key);
        if (i < 3) top3.add(key);
        whys.push(inv.why);
        for (const x of inv.ingredients) if (x.needed) outside.push(x.name);
      });
    }
    out.c[kname][label] = {
      dishes: sizes.length,
      meanIngredients: +(sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length)).toFixed(2),
      distinctDishes: sets.size,
      distinctFirstPage: top3.size,
      youdNeed: [...new Set(outside)],
      firstPage: [...top3],
      cited: citedPairs(whys),
    };
  }
}

// (d) Invent a sauce.
const codex = await loadSauceCodex('/data');
const sauceMeta = codex.ingredientMeta || [];
const catalogueNames = new Set(sauceMeta.map((i) => String(i.name || '').toLowerCase()).filter(Boolean));
const sauceIndex = codex.pairings ? buildPairingIndex(codex.pairings, catalogueNames) : null;
const sauces = [...codex.nodes.values()];
const catMap = buildCategoryMap(sauceMeta);
const kitchenNames = new Set([...catalogueNames, ...names]);
const PANTRY = ['butter', 'egg yolk', 'lemon', 'shallot', 'white wine', 'cream', 'tomato', 'garlic'];
out.d = {};
for (const [label, idx] of Object.entries(INDEXES)) {
  const sizes = []; const sets = new Set(); const firsts = new Set(); const whys = []; let styles = 0;
  for (const seed of SEEDS) {
    for (const style of INVENT_STYLES) {
      const r = inventSauces({ styleId: style.id, kitchen: shuffled(PANTRY, seed), meta: sauceMeta, sauces, catMap, names: kitchenNames, pairingIndex: idx, sauceIndex, limit: 12 });
      if (!r.ok) continue;
      if (seed === SEEDS[0]) styles += 1;
      r.sauces.forEach((s, i) => {
        const ks = s.lines.map((l) => l.key);
        sizes.push(ks.length);
        const key = `${style.id}: ${[...ks].sort().join(' + ')}`;
        sets.add(key);
        if (i === 0) firsts.add(`${s.name} = ${ks.join(', ')}`);
        whys.push(s.why);
      });
    }
  }
  out.d[label] = {
    stylesOk: styles,
    sauces: sizes.length,
    meanIngredients: +(sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length)).toFixed(2),
    distinctSauces: sets.size,
    distinctFirstPicks: firsts.size,
    firstPicks: [...firsts],
    cited: citedPairs(whys),
  };
}

// (e) Invent a cocktail.
const roles = JSON.parse(readFileSync(pub('data/cocktail_roles.json'), 'utf8')).byIngredient || {};
const BAR = ['gin', 'vodka', 'rum', 'tequila', 'bourbon', 'lime juice', 'lemon juice', 'simple syrup', 'triple sec', 'sweet vermouth', 'campari', 'angostura bitters', 'mint', 'soda water', 'ginger beer', 'prosecco'];
out.e = {};
for (const [label, idx] of Object.entries(INDEXES)) {
  const pool = buildRolePool(roles, idx.names);
  let linked = 0; let pairs = 0; const firsts = []; const whys = []; const sets = new Set();
  for (const fam of Object.keys(FAMILY_SKELETONS).map(Number)) {
    const r = inventCocktails({ familyId: fam, bar: BAR, pool, roles, pairingIndex: idx, limit: 12 });
    if (!r.ok) continue;
    r.drinks.forEach((d, i) => {
      const ks = d.lines.map((l) => l.key);
      sets.add(ks.slice().sort().join('+'));
      for (let x = 0; x < ks.length; x++) for (let y = x + 1; y < ks.length; y++) { pairs += 1; if (S(idx, ks[x], ks[y]) > 0) linked += 1; }
      if (i === 0) firsts.push(`${d.name} = ${ks.join(', ')}`);
      whys.push(d.why);
    });
  }
  out.e[label] = { pairShareLinked: +(linked / Math.max(1, pairs)).toFixed(3), distinctDrinks: sets.size, firstPicks: firsts, cited: citedPairs(whys) };
}

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else console.dir(out, { depth: 6, maxArrayLength: 50 });
