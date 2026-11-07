#!/usr/bin/env node
/**
 * evalPairingMatch.mjs — offline answer key for the "goes well with" ranker
 * (src/data/recipePairingMatch.js). Run before shipping any ranking change:
 *
 *   node scripts/evalPairingMatch.mjs            # current scoring
 *   node scripts/evalPairingMatch.mjs --variants # compare edge-score choices
 *   node scripts/evalPairingMatch.mjs --sweep    # sweep the shrinkage prior
 *
 * Three checks, each against a different source than the ranker's own data:
 *   1. Same-name sauce: for the Cookbook recipes that have a namesake sauce
 *      in the library, where does that sauce rank? (top-3 hits, MRR)
 *   2. Concentration: over ALL Cookbook recipes, which cocktails / sauces
 *      appear most in the top-N? An item in more than a third of lists is a
 *      bug (the Bloody Mary case), whatever spot checks say.
 *   3. Flavor Bible agreement: for each recipe, the share of (top-5 item
 *      ingredient, recipe ingredient) pairs listed in the Flavor Bible,
 *      against the same share for 5 random items. Ratio > 1 means the
 *      ranker's picks are more Flavor-Bible-consistent than chance.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => path.join(ROOT, 'public', p);
const src = (p) => pathToFileURL(path.join(ROOT, 'src', p)).href;

const { SEED_RECIPES } = await import(src('data/seedRecipes.js'));
const { buildPairingIndex, rankByPairing, TUNING } = await import(src('data/recipePairingMatch.js'));

const ingredients = JSON.parse(readFileSync(pub('proDataset/ingredients.json'), 'utf8'));
const pairings = JSON.parse(readFileSync(pub('proDataset/pairings.json'), 'utf8'))
  .filter((p) => p.ingredientA in ingredients && p.ingredientB in ingredients);
const fb = JSON.parse(readFileSync(path.join(ROOT, 'data/private/flavor_bible_matched.json'), 'utf8')).pairs;
const fbSet = new Set(fb.map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)));
const cocktails = JSON.parse(readFileSync(pub('data/cocktail_codex_v2.json'), 'utf8')).cocktails
  .map((c) => ({ name: c.name, ingredients: c.ingredients_raw.map((r) => r.raw) }));
const sauces = JSON.parse(readFileSync(pub('data/sauce_augment.json'), 'utf8')).sauces
  .map((s) => ({ name: s.name, ingredients: s.ingredients.map((i) => i.name) }));

const SAME_NAME = {
  'beef-bolognese': 'Bolognese', 'pad-thai': 'Pad Thai Sauce', 'chicken-tikka': 'Tikka Masala',
  'mole-poblano': 'Mole Poblano', 'thai-green-curry': 'Thai Green Curry', 'teriyaki-salmon': 'Teriyaki',
  'palak-paneer': 'Saag', 'chicken-satay': 'Peanut Sauce (Thai)', 'margherita-pizza': 'Marinara',
};

/** Edge-score variants. `strength` is what ships; the rest are candidates. */
const VARIANTS = {
  strength: (p) => p.strength,
  tradition: (p) => p.tradition,
  'npmi+freq': (p) => ((p.breakdown?.x1 ?? 0) + (p.breakdown?.x2 ?? 0)) / 2,
};

function edgesFor(score, { includePredicted = false } = {}) {
  let max = 0;
  const raw = pairings.map((p) => ({ p, s: score(p) }));
  for (const { s } of raw) if (s > max) max = s;
  return raw.map(({ p, s }) => ({
    source: p.ingredientA, target: p.ingredientB,
    strength: max > 0 ? s / max : 0,
    known: includePredicted ? true : p.known === true,
  }));
}

function evaluate(edges, label) {
  const index = buildPairingIndex(edges, Object.keys(ingredients));
  // 1. same-name sauce
  let mrr = 0; let top3 = 0; const ranks = [];
  for (const [id, gold] of Object.entries(SAME_NAME)) {
    const r = SEED_RECIPES.find((x) => x.id === id);
    const names = rankByPairing(r.ingredients, sauces, index, 999).map((x) => x.item.name);
    const rank = names.indexOf(gold) + 1 || 99;
    ranks.push(rank); mrr += 1 / rank; if (rank <= 3) top3 += 1;
  }
  // 2. concentration + 3. Flavor Bible agreement
  const conc = { cocktails: new Map(), sauces: new Map() };
  let fbTop = 0; let fbRand = 0; let fbN = 0;
  let seed = 7; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const density = (recipe, items) => {
    let hit = 0; let tot = 0;
    for (const it of items) for (const a of it.ingredients) for (const b of recipe) {
      const x = String(a).toLowerCase(); const y = b;
      if (!(x in ingredients)) continue;
      tot += 1; if (fbSet.has(x < y ? `${x}|${y}` : `${y}|${x}`)) hit += 1;
    }
    return tot ? hit / tot : null;
  };
  for (const r of SEED_RECIPES) {
    for (const [kind, items] of [['cocktails', cocktails], ['sauces', sauces]]) {
      const top = rankByPairing(r.ingredients, items, index, 8);
      for (const m of top) conc[kind].set(m.item.name, (conc[kind].get(m.item.name) || 0) + 1);
      if (kind === 'sauces') {
        const dTop = density(r.ingredients, top.slice(0, 5).map((m) => m.item));
        const rand = Array.from({ length: 5 }, () => items[Math.floor(rnd() * items.length)]);
        const dRand = density(r.ingredients, rand);
        if (dTop != null && dRand != null) { fbTop += dTop; fbRand += dRand; fbN += 1; }
      }
    }
  }
  const worst = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} ${c}/${SEED_RECIPES.length}`).join(', ');
  const n = Object.keys(SAME_NAME).length;
  console.log(`\n[${label}]`);
  console.log(`  same-name sauce: top-3 ${top3}/${n}, MRR ${(mrr / n).toFixed(2)}  (ranks ${ranks.join(' ')})`);
  console.log(`  concentration — cocktails: ${worst(conc.cocktails)}`);
  console.log(`  concentration — sauces:    ${worst(conc.sauces)}`);
  console.log(`  Flavor Bible agreement (sauces): top-5 ${(fbTop / fbN).toFixed(3)} vs random ${(fbRand / fbN).toFixed(3)} → ×${(fbTop / fbRand).toFixed(2)}`);
  return { top3, mrr: mrr / n, fbRatio: fbTop / fbRand, maxConc: Math.max(...conc.cocktails.values()) };
}

const args = process.argv.slice(2);
if (args.includes('--sweep')) {
  const edges = edgesFor(VARIANTS.tradition);
  for (const priorWeight of [0.5, 1, 2, 3]) for (const priorScore of [0, 0.1, 0.2]) {
    Object.assign(TUNING, { priorWeight, priorScore });
    evaluate(edges, `priorWeight ${priorWeight}, priorScore ${priorScore}`);
  }
} else if (args.includes('--variants')) {
  for (const [name, score] of Object.entries(VARIANTS)) evaluate(edgesFor(score), `edge score = ${name}`);
  evaluate(edgesFor(VARIANTS.strength, { includePredicted: true }), 'strength + predicted pairings');
  evaluate(edgesFor(VARIANTS['npmi+freq'], { includePredicted: true }), 'npmi+freq + predicted pairings');
} else {
  evaluate(edgesFor(VARIANTS.tradition), 'shipped scoring (tradition)');
}
