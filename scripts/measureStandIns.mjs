/**
 * measureStandIns.mjs (STANDIN-1) — how much of what recipes ask for does the shopping sheet have an answer for?
 *
 * Over every built-in cocktail, sauce and dish, takes each ingredient line by the name the shopping list would store
 * (shoppingList.canonicalKey over the curated names: the name a cook sees on a row, not the printed label), asks the
 * sheet's own function (shoppingAlternatives.alternativesFor) what it would offer for that row, and reports per kind
 * of recipe:
 *   distinct ingredients, lines, lines with a stand-in, lines with an honest "nothing replaces it" (kind 'none', counted
 *   as an answer but reported separately), the share answered, the most used ingredients with no answer, and how many
 *   more ingredients would have to be answered (most used first) to reach the target share.
 *
 * A line is judged the way the sheet judges the row: a dish line knows whether the ingredient is a main of that dish
 * (rowMain), a sauce line is a sauce row (swaps that do not hold in a sauce are left out), a cocktail line carries the
 * bar's role table, so a base spirit counts when a same-family bottle exists. A line is counted once per recipe.
 * The cook is assumed to have nothing (the answer exists; whether they own it is another question).
 *
 * Usage:
 *   node scripts/measureStandIns.mjs [--json] [--target 80] [--top 15] [--swaps-only]
 *   --swaps-only  read only the swap-kind entries (the table as it was before the four kinds: the STANDIN-1 baseline)
 *   npm run measure:standins
 *
 * Reads repo files only; no network.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBuiltIn, slugFor, uniqueBySlug } from '../src/data/sharedRecipe.js';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { RECIPE_DETAILS } from '../src/data/seedRecipeDetails.js';
import { canonicalKey, recipeIdOf } from '../src/data/shoppingList.js';
import { swapsFor } from '../src/data/kitchenSwaps.js';
import { alternativesFor, rowMain } from '../src/data/shoppingAlternatives.js';
import { loadCurationTables, applyCuration } from './lib/curationTables.mjs';
import { readCuratedCodex } from './lib/curatedCodex.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const KINDS = ['cocktail', 'sauce', 'dish'];

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] != null ? Number(args[i + 1]) : d; };
const TARGET = value('--target', 80);
const TOP = value('--top', 15);

function loadData() {
  const codex = readCuratedCodex();
  const sauces = readJson(resolve(ROOT, 'public/data/sauce_augment.json')).sauces || [];
  return { cocktails: codex.cocktails || [], families: codex.families || [], sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
}

const raw = readJson(resolve(ROOT, 'public/proDataset/ingredients.json'));
const curated = applyCuration(raw, null, loadCurationTables()).ingredients;
const names = new Set(Object.keys(curated).filter((k) => !k.startsWith('_')));
const categories = new Map();
for (const [n, e] of Object.entries(curated)) if (!n.startsWith('_') && typeof e?.category === 'string') categories.set(n, e.category);
const categoryOf = (n) => categories.get(String(n || '').toLowerCase().trim()) || null;
const roles = readJson(resolve(ROOT, 'public/data/cocktail_roles.json')).byIngredient;

const data = loadData();
const cache = new Map();
function answerFor(key, kind, main, sauce) {
  const id = `${key}|${kind === 'cocktail' ? 'c' : 'x'}|${main}|${sauce}`;
  if (cache.has(id)) return cache.get(id);
  const r = alternativesFor({ key }, { roles: kind === 'cocktail' ? roles : null, names, sauce, main, ...(flag('--swaps-only') ? { swaps: swapsFor } : {}) });
  // A none that says "it is all one thing under several names" (soda water, club soda, seltzer) is an answer, not a gap.
  const a = r.known || r.none?.same ? 'standin' : r.none ? 'none' : 'no';
  cache.set(id, a);
  return a;
}

const out = {};
for (const kind of KINDS) {
  const list = kind === 'cocktail' ? data.cocktails : kind === 'sauce' ? data.sauces : data.dishes;
  const per = new Map(); // key -> { lines, answer }
  let recipes = 0;
  for (const item of uniqueBySlug(kind, list)) {
    const recipe = resolveBuiltIn(kind, slugFor(kind, item), data);
    if (!recipe) continue;
    recipes += 1;
    const id = recipeIdOf(recipe);
    const listRecipes = [{ id, kind, name: recipe.name }];
    const seen = new Set();
    for (const line of recipe.lines || []) {
      const key = canonicalKey(line.key, names);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const main = rowMain({ key, from: [id] }, listRecipes, { categoryOf, names });
      const answer = answerFor(key, kind, main, kind === 'sauce');
      const e = per.get(key) || { key, lines: 0, standin: 0, none: 0, no: 0 };
      e.lines += 1;
      e[answer] += 1;
      per.set(key, e);
    }
  }
  const all = [...per.values()];
  const lines = all.reduce((s, e) => s + e.lines, 0);
  const standin = all.reduce((s, e) => s + e.standin, 0);
  const none = all.reduce((s, e) => s + e.none, 0);
  const share = (n) => (lines ? Math.round((1000 * n) / lines) / 10 : 0);
  const unanswered = all.filter((e) => e.no > 0).sort((a, b) => b.no - a.no || a.key.localeCompare(b.key));
  // How many more ingredients (most used first) until the answered share reaches the target.
  let need = 0;
  let got = standin + none;
  for (const e of unanswered) {
    if ((100 * got) / lines >= TARGET) break;
    got += e.no;
    need += 1;
  }
  out[kind] = {
    recipes, distinct: all.length, lines,
    standinLines: standin, noneLines: none, answeredLines: standin + none,
    standinPct: share(standin), nonePct: share(none), answeredPct: share(standin + none),
    distinctWithStandin: all.filter((e) => e.standin > 0 && e.no === 0).length,
    distinctWithNone: all.filter((e) => e.none > 0 && e.no === 0).length,
    distinctWithout: unanswered.length,
    topUnanswered: unanswered.slice(0, TOP).map((e) => ({ key: e.key, lines: e.no })),
    target: TARGET, moreNeeded: (100 * (standin + none)) / lines >= TARGET ? 0 : need,
  };
}

if (flag('--json')) {
  console.log(JSON.stringify({ target: TARGET, kinds: out }, null, 2));
} else {
  console.log(`Stand-in coverage over the built-in recipes (names as the shopping list stores them; target ${TARGET}%)\n`);
  const cols = ['cocktail', 'sauce', 'dish'];
  const row = (label, f) => console.log(label.padEnd(34) + cols.map((k) => String(f(out[k])).padStart(10)).join(''));
  console.log(''.padEnd(34) + cols.map((k) => k.padStart(10)).join(''));
  row('recipes', (o) => o.recipes);
  row('distinct ingredients', (o) => o.distinct);
  row('lines', (o) => o.lines);
  row('lines with a stand-in', (o) => o.standinLines);
  row('lines with "nothing replaces it"', (o) => o.noneLines);
  row('share with a stand-in %', (o) => o.standinPct);
  row('share with a none %', (o) => o.nonePct);
  row('share answered %', (o) => o.answeredPct);
  row('ingredients with no answer', (o) => o.distinctWithout);
  row(`more ingredients for ${TARGET}%`, (o) => o.moreNeeded);
  for (const k of cols) {
    console.log(`\nMost used with no answer, ${k === 'dish' ? 'dishes' : `${k}s`}:`);
    console.log(out[k].topUnanswered.map((e) => `${e.key} (${e.lines})`).join(', '));
  }
}
