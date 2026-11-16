/**
 * checkStandIns.mjs (STANDIN-2) — a SECOND CHECK on the stand-in table, never a source of entries.
 *
 * For every swap-kind entry in src/data/kitchenSwaps.js it asks: do the two sides share everyday cooking partners?
 * Top-30 partners of each side in the blended everyday-pairs index (the one measureKitchenMakeable.mjs uses), and
 * the Jaccard overlap of the two sets. A swap whose sides share almost nothing deserves a second look; a high score
 * proves nothing (onion and garlic overlap 0.46 and are not a swap). The weakest tenth, and every swap the index
 * cannot score, are listed as FLAGGED: each is either changed or kept with a reason in docs/stand-ins.md.
 *
 * It also checks that every name in the table is one the app stores: `for` resolves to itself, a swap or make `use`
 * (and each `plus`) is a curated, suggestable name, and a form's `use` resolves to the row's own key or to a stored name.
 *
 * Usage: node scripts/checkStandIns.mjs [--json]      npm run check:standins
 * Reads repo files only; no network.
 */
import fs from 'node:fs';
import { STAND_INS, standInKind } from '../src/data/kitchenSwaps.js';
import { buildPairingIndex } from '../src/data/recipePairingMatch.js';
import { blendIndex, parseEverydayPairs } from '../src/data/everydayPairs.js';
import { canonicalKey } from '../src/data/shoppingList.js';
import { isSuggestable } from '../src/data/curation/suggestable.js';
import { loadCurationTables, applyCuration } from './lib/curationTables.mjs';

const json = process.argv.includes('--json');
const raw = JSON.parse(fs.readFileSync('public/proDataset/ingredients.json', 'utf8'));
const curated = applyCuration(raw, null, loadCurationTables()).ingredients;
const names = new Set(Object.keys(curated).filter((k) => !k.startsWith('_')));

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
  if (!A.size || !B.size) return null;
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / new Set([...A, ...B]).size;
};

const swaps = STAND_INS.filter((s) => standInKind(s) === 'swap').map((s) => ({ for: s.for, use: s.use, plus: s.plus || [], score: jac(s.for, s.use) }));
const scored = swaps.filter((s) => s.score != null).sort((a, b) => a.score - b.score);
const tenth = Math.max(1, Math.ceil(scored.length / 10));
const weakest = scored.slice(0, tenth);
const unscored = swaps.filter((s) => s.score == null);

// Names a cook types that the ingredient graph has no node for (the swap test keeps the same list); the table may use them.
const UNSTORED = new Set(['baking powder', 'baking soda', 'vegetable oil', 'spaghetti']);
const problems = [];
for (const s of STAND_INS) {
  const kind = standInKind(s);
  if (!UNSTORED.has(s.for) && (!names.has(s.for) || canonicalKey(s.for, names) !== s.for)) {
    problems.push(`for "${s.for}" is not a stored name (resolves to "${canonicalKey(s.for, names)}")`);
  }
  if (kind === 'none') continue;
  for (const p of [s.use, ...(s.plus || [])]) {
    if (!isSuggestable(p)) problems.push(`"${p}" (${kind} for ${s.for}) is not suggestable`);
    if (UNSTORED.has(p)) continue;
    if (kind === 'form' && p === s.use) {
      // A form resolves to the row's own key (dried thyme -> thyme) or is itself a stored name (tomato paste).
      if (canonicalKey(p, names) !== s.for && !names.has(p)) problems.push(`form "${p}" for ${s.for} resolves to "${canonicalKey(p, names)}", neither the row's key nor a stored name`);
    } else if (!names.has(p)) {
      problems.push(`"${p}" (${kind} for ${s.for}) is not a stored name`);
    }
  }
}

const out = {
  swaps: swaps.length,
  scored: scored.length,
  flagged: [...weakest, ...unscored].map((s) => ({ for: s.for, use: s.use, overlap: s.score == null ? null : Math.round(s.score * 100) / 100 })),
  nameProblems: problems,
};
if (json) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`Second check over ${swaps.length} swap entries (${scored.length} scored by partner overlap, top-30 partners, Jaccard)`);
  console.log(`\nFLAGGED, the weakest tenth (${weakest.length}) and the unscored (${unscored.length}):`);
  for (const f of out.flagged) console.log(`  ${f.use} for ${f.for}: ${f.overlap == null ? 'unscored (no partners in the index)' : f.overlap.toFixed(2)}`);
  console.log(`\nName problems: ${problems.length ? '' : 'none'}`);
  for (const p of problems) console.log(`  ${p}`);
}
process.exitCode = problems.length ? 1 : 0;
