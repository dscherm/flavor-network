/**
 * measureFlavorProfile.mjs — how good are the flavor charts?
 *
 * Draws the chart for each item in data/flavor-truth.json the way the app does today
 * (the app's own buildFlavorProfile, over public/proDataset/gnn_entropy.json, with ingredient
 * names resolved as in scripts/buildShareIndex.mjs and src/data/shareCardData.js), then
 * scores it with src/data/flavorScore.js. Reads repo files only; no network.
 *
 * Usage:
 *   node scripts/measureFlavorProfile.mjs [--json] [--truth path]
 *   node scripts/measureFlavorProfile.mjs --labels-preview [--json] [--truth path]
 *   npm run measure:flavor
 *
 * --labels-preview (DATA-5): scores the same items using ONLY the curated taste labels in
 * ingredients.json (src/data/curation applied), the weights FLAVOR-3 will use (first word 1.0, second 0.6,
 * third 0.35; spicy and pungent feed heat; astringent counts half toward bitter; neutral and rich feed no
 * taste axis) and equal weight for every ingredient. No aroma bars, so the aroma figure reads 0 of N.
 * It changes no app code and is how the label work is checked before FLAVOR-3 builds the real function.
 *
 * Exit code is non-zero if the truth file is malformed or an item does not resolve.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveBuiltIn } from '../src/data/sharedRecipe.js';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { RECIPE_DETAILS } from '../src/data/seedRecipeDetails.js';
import { buildFlavorProfile } from '../src/data/inventProfile.js';
import { resolveIngredientName } from '../src/data/recipePairingMatch.js';
import { scoreItem, summarize, TASTES } from '../src/data/flavorScore.js';
import { loadCurationTables, applyCuration } from './lib/curationTables.mjs';
import { loadFlavorNodes } from './lib/flavorNodes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = ['cocktail', 'sauce', 'dish'];
const NOUN = { cocktail: 'drink', sauce: 'sauce', dish: 'dish' };
const AXES_OK = new Set([...TASTES, 'heat']);
const AROMA_OK = new Set(['fruity', 'floral', 'green', 'woody', 'spicy', 'fatty']);

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function loadData() {
  const codex = readJson(resolve(ROOT, 'public/data/cocktail_codex_v2.json'));
  const sauces = readJson(resolve(ROOT, 'public/data/sauce_augment.json')).sauces || [];
  return { cocktails: codex.cocktails || [], families: codex.families || [], sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
}

/**
 * THE ADAPTER. The one place that decides how a chart is drawn for a recipe. FLAVOR-2..6 change
 * what this calls; the scorer (src/data/flavorScore.js) and the answer key stay as they are.
 * Since FLAVOR-3 the taste half is the curated labels weighted by amount (flavorTaste.js); the aroma half
 * is still the model's values. Returns { bars: [{ axis, label, score }], counted: [key], uncounted: [key] }.
 */
export function profileFor(recipe, ctx) {
  const names = new Set(ctx.nodes.keys());
  const keys = [];
  const amounts = {};
  for (const l of recipe.lines) {
    const key = resolveIngredientName(l.label || l.key, names) || l.key;
    keys.push(key);
    if (l.amount && amounts[key] === undefined) amounts[key] = l.amount;
  }
  const p = buildFlavorProfile(keys, ctx.nodes, { noun: NOUN[recipe.kind], amounts, garnish: recipe.garnish || '' });
  return { bars: p.bars, counted: p.counted, uncounted: p.uncounted };
}

const LABEL_WEIGHTS = [1, 0.6, 0.35];
const LABEL_AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'];
const LABEL_AXIS = { sweet: ['sweet', 1], sour: ['sour', 1], bitter: ['bitter', 1], salty: ['salty', 1], umami: ['umami', 1], spicy: ['heat', 1], pungent: ['heat', 1], astringent: ['bitter', 0.5] };

/** Taste-axis weights for one label ("sweet sour"): neutral, rich and unknown words add nothing. */
export function labelWeights(label) {
  const w = Object.fromEntries(LABEL_AXES.map((a) => [a, 0]));
  String(label || '').split(/\s+/).filter(Boolean).slice(0, 3).forEach((word, i) => {
    const hit = LABEL_AXIS[word];
    if (hit) w[hit[0]] += LABEL_WEIGHTS[i] * hit[1];
  });
  return w;
}

function loadLabels() {
  const raw = readJson(resolve(ROOT, 'public/proDataset/ingredients.json'));
  const cur = applyCuration(raw, null, loadCurationTables()).ingredients;
  const labels = new Map();
  for (const [name, e] of Object.entries(cur)) if (!name.startsWith('_') && e.taste) labels.set(name, e.taste);
  return labels;
}

/** The labels-only chart for one recipe: the mean of its counted ingredients' label weights. */
export function labelProfileFor(recipe, ctx) {
  const names = new Set(ctx.nodes.keys());
  const counted = [];
  const uncounted = [];
  const sum = Object.fromEntries(LABEL_AXES.map((a) => [a, 0]));
  for (const l of recipe.lines) {
    const key = resolveIngredientName(l.label || l.key, names);
    if (!key) { uncounted.push(l.key); continue; }
    counted.push(key);
    const w = labelWeights(ctx.nodes.get(key));
    for (const a of LABEL_AXES) sum[a] += w[a];
  }
  const n = counted.length;
  const bars = n ? LABEL_AXES.map((axis) => ({ axis, label: axis, score: sum[axis] / n })) : [];
  return { bars, counted, uncounted };
}

export function validateTruth(truth) {
  const problems = [];
  if (!truth || !Array.isArray(truth.items) || !truth.items.length) return ['"items" must be a non-empty array'];
  const seen = new Set();
  truth.items.forEach((it, i) => {
    const at = `items[${i}]${it && it.id ? ` (${it.id})` : ''}`;
    if (!it || typeof it.id !== 'string' || !/^(cocktail|sauce|dish)\/[^/\s]+$/.test(it.id)) return problems.push(`${at}: id must look like "<kind>/<slug>"`);
    if (seen.has(it.id)) problems.push(`${at}: duplicate id`);
    seen.add(it.id);
    if (!Array.isArray(it.expect) || it.expect.length < 1 || it.expect.length > 3 || !it.expect.every((t) => AXES_OK.has(t))) problems.push(`${at}: expect must be 1 to 3 of ${[...AXES_OK].join(', ')}`);
    if (it.not !== undefined && !(Array.isArray(it.not) && it.not.every((t) => TASTES.includes(t)))) problems.push(`${at}: not must list tastes`);
    if (it.aroma !== undefined && !(Array.isArray(it.aroma) && it.aroma.every((a) => AROMA_OK.has(a)))) problems.push(`${at}: aroma must list aroma names without the odor_ prefix`);
    if (Array.isArray(it.not) && Array.isArray(it.expect) && it.not.some((t) => it.expect.includes(t))) problems.push(`${at}: a taste is both expected and forbidden`);
  });
  return problems;
}

export function measure(truth, data, nodes, profile = profileFor) {
  const rows = [];
  const missing = [];
  for (const it of truth.items) {
    const [kind, slug] = it.id.split('/');
    const recipe = KINDS.includes(kind) ? resolveBuiltIn(kind, slug, data) : null;
    if (!recipe) { missing.push(it.id); continue; }
    const p = profile(recipe, { nodes, kind });
    const total = p.counted.length + p.uncounted.length;
    const score = scoreItem(p.bars, it, { counted: p.counted.length, total });
    const bars = p.bars.filter((b) => TASTES.includes(b.axis)).sort((a, b) => b.score - a.score).slice(0, 3);
    rows.push({ id: it.id, name: recipe.name, expect: it.expect, not: it.not || [], bars: bars.map((b) => ({ axis: b.axis, score: Math.round(b.score * 100) / 100 })), ...score });
  }
  return { rows, missing };
}

const verdict = (r) => {
  if (r.noChart) return 'NO CHART';
  const v = [r.top1 ? 'top1' : 'miss'];
  if (r.top2 !== null) v.push(r.top2 ? 'top2' : 'not-top2');
  if (r.forbiddenLead) v.push('FORBIDDEN LEADS');
  if (r.aromaOk !== null) v.push(r.aromaOk ? 'aroma ok' : 'aroma miss');
  return v.join(', ');
};

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const ti = args.indexOf('--truth');
  const truthPath = resolve(ti >= 0 ? args[ti + 1] : resolve(ROOT, 'data/flavor-truth.json'));
  let truth;
  try { truth = readJson(truthPath); } catch (e) { console.error(`Cannot read truth file ${truthPath}: ${e.message}`); process.exit(2); }
  const problems = validateTruth(truth);
  if (problems.length) { console.error(`Malformed truth file ${truthPath}:\n  ${problems.join('\n  ')}`); process.exit(2); }

  const preview = args.includes('--labels-preview');
  const { rows, missing } = preview
    ? measure(truth, loadData(), loadLabels(), labelProfileFor)
    : measure(truth, loadData(), loadFlavorNodes());
  if (missing.length) { console.error(`These items do not resolve to a built-in recipe: ${missing.join(', ')}`); process.exit(3); }
  const sum = summarize(rows);

  if (json) { console.log(JSON.stringify({ summary: sum, items: rows }, null, 2)); return; }
  const w = Math.max(...rows.map((r) => r.id.length));
  for (const r of rows) {
    const tops = r.bars.map((b) => `${b.axis} ${b.score.toFixed(2)}`).join(', ') || '(none)';
    console.log(`${r.id.padEnd(w)}  expect ${r.expect.join('/')}${r.not.length ? ` not ${r.not.join('/')}` : ''}  |  ${tops}  |  counted ${Math.round(r.coverage * 100)}%  |  ${verdict(r)}`);
  }
  console.log('');
  console.log(`Items ${sum.items}. Top taste expected: ${sum.top1}/${sum.items} (${sum.top1Pct}%). Top two both expected: ${sum.top2}/${sum.top2Of} items with 2+ expected (${sum.top2Pct}%). ` +
    `Forbidden taste leads: ${sum.forbiddenLeads}. No chart: ${sum.noChart}. Ingredients counted: ${sum.countedPct}%. ` +
    `Aroma as expected: ${sum.aromaOk}/${sum.aromaOf} (${sum.aromaPct}%).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
