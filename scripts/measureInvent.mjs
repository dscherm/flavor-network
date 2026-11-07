#!/usr/bin/env node
/**
 * measureInvent.mjs — WEAK-5 checks (docs/invent-size-variety.md).
 *
 * Same setup as measureEverydayPairs.mjs: the real set-completion model
 * (onnxruntime-node on public/models/recipe-setcompletion.onnx), the
 * blended pairing index (curated + everyday pairs), the shipped sauce list.
 *
 *   (a) recipe mean size                 (b) distinct dishes over 5 shuffles
 *   (c) chosen main in every dish        (d) no basic in the top "why" pair
 *   (e) sauce mean size                  (f) samples for the by-eye review
 *
 * Runs on whichever inventRecipe.js / inventSauce.js is checked out, so the
 * same script gives the before and the after.
 *
 * Usage: node scripts/measureInvent.mjs [--json] [--samples]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => path.join(ROOT, 'public', p);
const src = (p) => pathToFileURL(path.join(ROOT, 'src', p)).href;

globalThis.fetch = async (url) => {
  const p = pub(String(url).replace(/^\//, ''));
  try {
    const text = readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  } catch {
    return { ok: false, status: 404, json: async () => null };
  }
};

const { buildPairingIndex } = await import(src('data/recipePairingMatch.js'));
const { parseEverydayPairs, blendIndex } = await import(src('data/everydayPairs.js'));
const recipeMod = await import(src('data/inventRecipe.js'));
const sauceMod = await import(src('data/inventSauce.js'));
const { loadSauceCodex } = await import(src('data/sauceCodex.js'));
const { buildCategoryMap } = await import(src('data/saucePantry.js'));
const { suggestIngredients, buildVocabIndex } = await import(src('ml/recipeRuntime.js'));
const { isBasic } = await import(src('data/myKitchen.js'));
let variety = null;
try { variety = await import(src('data/inventVariety.js')); } catch { /* before WEAK-5 */ }
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

function shuffled(list, seed) {
  let s = seed;
  const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const SEEDS = [11, 23, 37, 51, 73];
const PER_PAGE = 3;
const PRESSES = 5;
const mean = (xs) => +(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(2);

// Basic for the "why" check: the kitchen basics plus any oil / salt / pepper by a longer name.
const BASIC_RE = /\boil\b|\bsalt\b|^((ground |cracked )?(black|white) )?pepper(corns?)?$|^water$|^sugar$|^flour$|^butter$/;
const basicish = (n) => isBasic(n) || BASIC_RE.test(String(n).toLowerCase());
function topWhyPair(why) {
  const m = String(why || '').match(/: (.*)\.$/);
  if (!m) return null;
  const first = m[1].split(', ')[0];
  return first ? first.split(' + ') : null;
}

/** One panel session: first page, then PRESSES presses of Shuffle. */
function session(result, keyOf) {
  if (!result.ok) return { shown: [], exhausted: false };
  if (variety && result.pool) {
    const shown = [];
    let exhausted = false;
    for (let p = 0; p <= PRESSES; p++) {
      const next = variety.nextIdeas(result.pool, shown, PER_PAGE, { keysOf: keyOf });
      if (next.length === 0) { exhausted = true; break; }
      shown.push(...next);
    }
    return { shown, exhausted };
  }
  // Before: the panel pages through the list and wraps around.
  const list = result.inventions || result.sauces;
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const shown = [];
  for (let p = 0; p <= PRESSES; p++) shown.push(...list.slice((p % pages) * PER_PAGE, (p % pages) * PER_PAGE + PER_PAGE));
  return { shown, exhausted: false };
}

const meta = JSON.parse(readFileSync(pub('models/recipe_vocab.json'), 'utf8'));
const sess = await ort.InferenceSession.create(pub('models/recipe-setcompletion.onnx'));
const model = { ort, session: sess, meta, vocabIndex: buildVocabIndex(meta.vocab) };
let calls = 0;
const suggest = (observed, opts) => { calls += 1; return suggestIngredients(observed, opts, model); };
const nodes = new Map(Object.entries(ingredients).map(([n, v]) => [n, { category: v.category, cuisines: v.cuisines || [] }]));
const KITCHENS = {
  chicken: ['chicken', 'garlic', 'lemon', 'rice', 'onion', 'tomato'],
  pasta: ['pasta', 'tomato', 'basil', 'parmesan', 'garlic', 'olive oil'],
  beef: ['beef', 'onion', 'potato', 'carrot', 'thyme'],
};
// A dish's centre: a protein or legume, a starch, or a vegetable that is not an aromatic.
const LEGUME = /(beans?|lentils?|chickpeas?|tofu|tempeh|edamame)/;
const isProtein = (n) => nodes.get(n)?.category === 'protein' || LEGUME.test(n);
const isCentre = (n) => isProtein(n) || ['grain', 'vegetable'].includes(nodes.get(n)?.category);
const recipeKey = (inv) => inv.ingredients.map((x) => x.name);
const out = { recipes: {}, sauces: {} };
const samples = { recipes: [], sauces: [] };

for (const [kname, kitchen] of Object.entries(KITCHENS)) {
  const sizes = []; const sets = new Set(); let whyBasic = 0; let dishes = 0; let withProtein = 0; let withCentre = 0;
  const sessions = []; const sessionSizes = [];
  let t0 = Date.now(); calls = 0;
  for (const seed of SEEDS) {
    const r = await recipeMod.inventRecipes({ kitchen: shuffled(kitchen, seed), cuisine: null, suggest, pairingIndex: blended, nodes, names, limit: 12 });
    if (!r.ok) continue;
    const s = session(r, recipeKey);
    const keys = new Set(s.shown.map((inv) => recipeKey(inv).slice().sort().join(' + ')));
    for (const inv of s.shown) sessionSizes.push(recipeKey(inv).length);
    sessions.push({ distinct: keys.size, exhausted: s.exhausted, shown: s.shown.length, pool: (r.pool || r.inventions).length });
    for (const inv of r.inventions) {
      const ns = recipeKey(inv);
      sizes.push(ns.length);
      sets.add(ns.slice().sort().join(' + '));
      dishes += 1;
      if (ns.some(isProtein)) withProtein += 1;
      if (ns.some(isCentre)) withCentre += 1;
      const top = topWhyPair(inv.why);
      if (top && top.some(basicish)) whyBasic += 1;
    }
    if (seed === SEEDS[0]) {
      for (const inv of s.shown.slice(0, 4)) {
        samples.recipes.push({ kitchen: kname, name: inv.name, ingredients: inv.ingredients.map((x) => x.name + (x.needed ? ' (buy)' : '')).join(', '), why: inv.why });
      }
    }
  }
  const msPerRun = Math.round((Date.now() - t0) / SEEDS.length);
  const callsPerRun = Math.round(calls / SEEDS.length);

  // (c) every pantry item as the chosen main.
  const pantry = kitchen.filter((k) => !recipeMod.isBasicLike(k));
  let withMain = 0; let mainDishes = 0; const mainSizes = [];
  for (const m of pantry) {
    const r = await recipeMod.inventRecipes({ kitchen, cuisine: null, main: m, suggest, pairingIndex: blended, nodes, names, limit: 12 });
    if (!r.ok) continue;
    const list = r.pool || r.inventions;
    for (const inv of list) {
      mainDishes += 1;
      mainSizes.push(inv.ingredients.length);
      if (inv.ingredients.some((x) => x.name === m)) withMain += 1;
    }
  }
  // Without a chosen main, how many dishes of a kitchen with a protein have one?
  out.recipes[kname] = {
    a_meanSize: mean(sizes),
    a_meanSizeInSession: mean(sessionSizes),
    b_session: sessions,
    b_oldMeasureDistinct: sets.size,
    c_mainIn: `${withMain}/${mainDishes}`,
    c_anyMainWithProtein: `${withProtein}/${dishes}`,
    c_anyMainWithCentre: `${withCentre}/${dishes}`,
    c_meanSizeWithMain: mean(mainSizes),
    d_topWhyBasic: `${whyBasic}/${dishes}`,
    msPerRun,
    modelCallsPerRun: callsPerRun,
  };
}

// A small kitchen, to see Shuffle run out (not one of the checks).
{
  const r = await recipeMod.inventRecipes({ kitchen: ['egg', 'spinach'], cuisine: null, suggest, pairingIndex: blended, nodes, names, limit: 12 });
  const s = session(r, recipeKey);
  out.recipes.smallKitchen = { kitchen: 'egg, spinach', ok: r.ok, pool: r.ok ? (r.pool || r.inventions).length : 0, shown: s.shown.length, exhausted: s.exhausted, message: s.exhausted ? recipeMod.EXHAUSTED_RECIPE : null };
}

// Sauces.
const codex = await loadSauceCodex('/data');
const sauceMeta = codex.ingredientMeta || [];
const catalogueNames = new Set(sauceMeta.map((i) => String(i.name || '').toLowerCase()).filter(Boolean));
const sauceIndex = codex.pairings ? buildPairingIndex(codex.pairings, catalogueNames) : null;
const sauces = [...codex.nodes.values()];
const catMap = buildCategoryMap(sauceMeta);
const kitchenNames = new Set([...catalogueNames, ...names]);
const PANTRY = ['butter', 'egg yolk', 'lemon', 'shallot', 'white wine', 'cream', 'tomato', 'garlic'];
const sauceKey = (s) => s.lines.map((l) => l.key);
{
  const sizes = []; let whyBasic = 0; let n = 0; const perStyle = {}; const sessionDistinct = {};
  for (const seed of SEEDS) {
    for (const style of sauceMod.INVENT_STYLES) {
      const r = sauceMod.inventSauces({ styleId: style.id, kitchen: shuffled(PANTRY, seed), meta: sauceMeta, sauces, catMap, names: kitchenNames, pairingIndex: blended, sauceIndex, limit: 12 });
      if (!r.ok) continue;
      const s = session(r, sauceKey);
      if (seed === SEEDS[0]) {
        sessionDistinct[style.id] = `${new Set(s.shown.map((x) => sauceKey(x).slice().sort().join('+'))).size}${s.exhausted ? ' (exhausted)' : ''}`;
        const first = s.shown[0];
        if (first) samples.sauces.push({ style: style.id, name: first.name, ingredients: first.lines.map((l) => l.key + (l.have ? '' : ' (buy)')).join(', '), why: first.why });
      }
      for (const inv of r.sauces) {
        sizes.push(inv.lines.length);
        (perStyle[style.id] ||= []).push(inv.lines.length);
        n += 1;
        const top = topWhyPair(inv.why);
        if (top && top.some(basicish)) whyBasic += 1;
      }
    }
  }
  out.sauces = {
    e_meanSize: mean(sizes),
    perStyleMeanSize: Object.fromEntries(Object.entries(perStyle).map(([k, v]) => [k, mean(v)])),
    b_sessionDistinct: sessionDistinct,
    d_topWhyBasic: `${whyBasic}/${n}`,
  };
}

if (process.argv.includes('--samples')) out.samples = samples;
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else console.dir(out, { depth: 6, maxArrayLength: 60 });
