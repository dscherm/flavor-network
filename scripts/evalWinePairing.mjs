#!/usr/bin/env node
/**
 * evalWinePairing.mjs — offline answer key for the Wine Lab ranker
 * (src/data/winePairing.js).
 *
 *   node scripts/evalWinePairing.mjs           # summary
 *   node scripts/evalWinePairing.mjs --detail  # per-dish top 5 with reasons
 *
 * ANSWER_KEY was written on 2026-11-07 BEFORE the ranker existed, from
 * standard sommelier pairings (Burgundy with bourguignon, off-dry Riesling
 * with Thai curry, Vin Santo with tiramisu …), so tuning cannot quietly
 * rewrite the test. Each dish lists every style a sommelier would happily
 * pour, not a single right answer. Do not edit it to make a number go up;
 * add dishes instead.
 *
 * Reports:
 *   hit@1 / hit@3 — the top / any of the top 3 is in the dish's accepted set
 *   MRR           — mean reciprocal rank of the first accepted wine
 *   concentration — over ALL Cookbook recipes, the wines appearing most in
 *                   the top 3; one wine in more than ~1/4 of lists is a bug
 *   coverage      — distinct wines that ever reach a top 3
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => pathToFileURL(path.join(ROOT, 'src', p)).href;
const { SEED_RECIPES } = await import(src('data/seedRecipes.js'));
const { RECIPE_DETAILS } = await import(src('data/seedRecipeDetails.js'));
const { rankWinesForRecipe } = await import(src('data/winePairing.js'));
const { ANSWER_KEY, HELD_OUT } = await import(src('data/wineAnswerKey.js'));

const ingredients = JSON.parse(readFileSync(path.join(ROOT, 'public/proDataset/ingredients.json'), 'utf8'));
const wines = JSON.parse(readFileSync(path.join(ROOT, 'public/data/wine_styles.json'), 'utf8')).wines;
const categoryOf = (name) => ingredients[name]?.category || null;


function contextFor(recipe) {
  const details = RECIPE_DETAILS[recipe.id];
  return {
    categoryOf,
    cuisine: recipe.cuisine,
    dishType: recipe.cluster,
    methodText: details ? details.steps.join(' ') : '',
  };
}


const detail = process.argv.includes('--detail');
function score(key, label, showDetail) {
  let hit1 = 0; let hit3 = 0; let mrr = 0; const misses = [];
  const ids = Object.keys(key);
  for (const id of ids) {
    const recipe = SEED_RECIPES.find((r) => r.id === id);
    if (!recipe) throw new Error(`answer key names unknown recipe ${id}`);
    const ok = new Set(key[id]);
    for (const w of ok) if (!wines.some((x) => x.id === w)) throw new Error(`${label}: unknown wine ${w}`);
    const ranked = rankWinesForRecipe(recipe.ingredients, wines, contextFor(recipe), wines.length);
    const rank = ranked.findIndex((r) => ok.has(r.item.id)) + 1;
    if (rank === 1) hit1 += 1;
    if (rank >= 1 && rank <= 3) hit3 += 1; else misses.push(`${recipe.name} (first accepted at ${rank || '—'}; top: ${ranked.slice(0, 3).map((r) => r.item.id).join(', ')})`);
    mrr += rank ? 1 / rank : 0;
    if (showDetail) {
      console.log(`\n${recipe.name}  [accepted: ${[...ok].join(', ')}]`);
      for (const r of ranked.slice(0, 5)) console.log(`  ${ok.has(r.item.id) ? '✓' : ' '} ${r.item.name.padEnd(36)} ${r.similarity.toFixed(2)}  ${r.reasons.join(' · ')}`);
    }
  }
  const n = ids.length;
  console.log(`\n${label} — ${n} dishes, ${wines.length} wines`);
  console.log(`  hit@1 ${hit1}/${n}   hit@3 ${hit3}/${n}   MRR ${(mrr / n).toFixed(2)}`);
  if (misses.length) console.log(`  misses:\n    ${misses.join('\n    ')}`);
  return { hit1, hit3, mrr: mrr / n, n };
}
score(ANSWER_KEY, 'Wine answer key (tuned on)', detail);
if (process.argv.includes('--heldout')) score(HELD_OUT, 'Held-out key (never tuned on)', detail);

const conc = new Map(); const seen = new Set();
for (const recipe of SEED_RECIPES) {
  for (const r of rankWinesForRecipe(recipe.ingredients, wines, contextFor(recipe), 3)) {
    conc.set(r.item.id, (conc.get(r.item.id) || 0) + 1); seen.add(r.item.id);
  }
}
console.log(`\n  concentration (top 3 over ${SEED_RECIPES.length} recipes): ${[...conc].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w, c]) => `${w} ${c}`).join(', ')}`);
console.log(`  coverage: ${seen.size}/${wines.length} wines reach some top 3`);
