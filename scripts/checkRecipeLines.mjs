/**
 * checkRecipeLines.mjs (LOOK-2) - runs every built-in cocktail, sauce and Cookbook dish through the
 * same split the cards use and lists each line that reads wrongly.
 *
 * Why: "3 tblsp Coconut milk" was read as amount "3", name "tblsp Coconut milk", so the Pina Colada
 * card showed the unit inside the name and the amount on the wrong side. The check finds that class
 * of fault anywhere in the built-in data.
 *
 * What a card shows, per kind:
 *   cocktail  codex line -> splitAmount (cocktailAmounts.js, used by riffRows, suggestAmounts, What do I need)
 *   sauce     { name, measure } from sauce_augment.json, shown as measure + name
 *   dish      Cookbook seed ingredient name + its amount from seedRecipeDetails.js
 *
 * Problem kinds
 *   card name starts with a unit word / a number / ends with a number / has no name   (findBadLines on the card's name)
 *   raw line has no ingredient name                                                    (findBadLines on the raw line)
 *   amount after the name (raw not in amount-first form)                               (script only)
 *   amount lost on the card (the raw line has an amount, the card shows none)          (script only)
 *
 * Usage: node scripts/checkRecipeLines.mjs [--json]      npm run check:lines
 * Reads repo files only; no network. Exit code 1 when any line is bad.
 */
import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitAmount } from '../src/data/cocktailAmounts.js';
import { findBadLines, splitRecipeLine } from '../src/data/recipeLines.js';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { RECIPE_DETAILS } from '../src/data/seedRecipeDetails.js';
import { readCuratedCodex } from './lib/curatedCodex.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = process.argv.includes('--json');

// "2, diced" is an amount and a prep note; written out the way a cook would: "2 tomato, diced".
function rawFromMeasure(measure, name) {
  const m = String(measure || '').trim();
  const i = m.indexOf(',');
  const head = i < 0 ? m : m.slice(0, i).trim();
  const tail = i < 0 ? '' : m.slice(i + 1).trim();
  return `${head} ${name}`.trim() + (tail ? `, ${tail}` : '');
}

const rawText = (r) => String(typeof r === 'string' ? r : r?.raw || r?.name || '').trim();

/** One entry per recipe: { kind, id, name, rows: [{ raw, card: { amount, name } }] }. */
function collect() {
  const out = [];
  const codex = readCuratedCodex();
  for (const c of codex.cocktails || []) {
    const rows = (c.ingredients_raw || []).map(rawText).filter((raw) => raw && !/^garnish:/i.test(raw))
      .map((raw) => ({ raw, card: splitAmount(raw) }));
    out.push({ kind: 'cocktail', id: c.canonical || c.name, name: c.name, rows });
  }
  const sauces = JSON.parse(fs.readFileSync(resolve(ROOT, 'public/data/sauce_augment.json'), 'utf8')).sauces || [];
  for (const s of sauces) {
    const rows = (s.ingredients || []).map((i) => {
      const item = typeof i === 'string' ? { name: i, measure: '' } : i;
      return { raw: rawFromMeasure(item.measure, item.name), card: { amount: String(item.measure || '').trim(), name: String(item.name || '').trim() } };
    });
    out.push({ kind: 'sauce', id: s.name, name: s.name, rows });
  }
  for (const d of SEED_RECIPES) {
    const amounts = RECIPE_DETAILS[d.id]?.amounts || {};
    const rows = (d.ingredients || []).map((n) => {
      const amount = String(amounts[n] || '').trim();
      return { raw: rawFromMeasure(amount, n), card: { amount, name: n } };
    });
    out.push({ kind: 'dish', id: d.id, name: d.name, rows });
  }
  return out;
}

const recipes = collect();
const bad = [];
const add = (r, line, problem) => bad.push({ kind: r.kind, id: r.id, name: r.name, line, problem });

for (const r of recipes) {
  for (const b of findBadLines([{ ...r, lines: r.rows.map((x) => x.card.name) }])) add(r, b.line, `card name: ${b.problem}`);
  for (const b of findBadLines([{ ...r, lines: r.rows.map((x) => x.raw) }])) add(r, b.line, `raw line: ${b.problem}`);
  for (const { raw, card } of r.rows) {
    const want = splitRecipeLine(raw);
    if (want.amount && !raw.replace(/\s+/g, ' ').startsWith(want.amount)) add(r, raw, 'amount after the name (raw not amount-first)');
    if (want.amount && !card.amount) add(r, raw, 'amount lost on the card');
  }
}

const byProblem = {};
for (const b of bad) byProblem[b.problem] = (byProblem[b.problem] || 0) + 1;
const totals = { recipes: recipes.length, lines: recipes.reduce((n, r) => n + r.rows.length, 0), bad: bad.length };

if (json) {
  console.log(JSON.stringify({ totals, byProblem, bad }, null, 2));
} else {
  console.log(`Checked ${totals.recipes} recipes (${recipes.filter((r) => r.kind === 'cocktail').length} cocktails, ${recipes.filter((r) => r.kind === 'sauce').length} sauces, ${recipes.filter((r) => r.kind === 'dish').length} dishes), ${totals.lines} lines.`);
  console.log(`Bad lines: ${totals.bad}`);
  for (const [p, n] of Object.entries(byProblem).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${p}`);
  if (bad.length) {
    console.log('');
    for (const b of bad) console.log(`${b.kind.padEnd(8)} ${b.name}: "${b.line}"  [${b.problem}]`);
  }
}
process.exitCode = bad.length ? 1 : 0;
