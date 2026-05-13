// PURE: classifier predicates only. No perceptron inference, no weight reads beyond the hash-gate header.
//
// Surprise-axis classifiers. Each function returns boolean for whether a pair
// belongs to that axis. Used both for "which axis does this top-k pair surface
// against" and for filtering the ground-truth corpus when computing per-axis
// precision/recall.
//
// Inputs:
//   pair          — element of pairings.json (already-ranked output of 07-blend-v2.js)
//   gtSet         — Set<string> of ground-truth pair-keys (from canonicalPairKey)
//   ingredientMeta — map name -> { cuisines: string[], ... } from public/proDataset/ingredients.json
//   gnnEntropy    — map name -> { probs: {...}, topClass: string } | undefined
//
// Classifier names (the columns the audit report uses):
//   chem-bridged-rare
//   absent-from-books
//   cross-cuisine
//   cross-aroma
//
// Each classifier short-circuits when required metadata is unavailable and
// reports the missing data in the audit report header.

import { canonicalPairKey } from './metrics.js';

/**
 * chem-bridged-rare: weak NPMI/recipe signal but shared compound chemistry.
 * Spec: pair.strength < 0.5 AND pair.sharedCompounds.length > 0 AND breakdown.x3 > 0.5
 * Note: with FlavorDB API offline most pairs have x3 === 0.5 exactly, so this
 * axis is near-empty until the API is restored. This is surfaced in the report.
 */
export function chemBridgedRare(pair) {
  if (!pair) return false;
  const x3 = pair?.breakdown?.x3;
  const shared = Array.isArray(pair.sharedCompounds) ? pair.sharedCompounds.length : 0;
  if (typeof x3 !== 'number') return false;
  return pair.strength < 0.5 && shared > 0 && x3 > 0.5;
}

/**
 * absent-from-books: top-K pair NOT in ground truth (= "surprise vs book").
 * The audit only invokes this on the top-K window so the axis size is bounded.
 */
export function absentFromBooks(pair, gtSet) {
  if (!pair || !gtSet) return false;
  const key = canonicalPairKey(pair.ingredientA, pair.ingredientB);
  return !gtSet.has(key);
}

/**
 * cross-cuisine: the two ingredients share no cuisine.
 * Returns false (not a cross-cuisine match) when cuisine metadata is missing
 * for either side, since we cannot prove the intersection is empty.
 */
export function crossCuisine(pair, ingredientMeta) {
  if (!pair || !ingredientMeta) return false;
  const a = ingredientMeta[pair.ingredientA];
  const b = ingredientMeta[pair.ingredientB];
  if (!a || !b) return false;
  const cuisA = Array.isArray(a.cuisines) ? a.cuisines : [];
  const cuisB = Array.isArray(b.cuisines) ? b.cuisines : [];
  // shipped ingredients.json stores cuisines under different fields per pipeline;
  // fall back to `regions` / `cuisine` (singular) if no `cuisines` array.
  if (cuisA.length === 0 && cuisB.length === 0) return false;
  const setA = new Set(cuisA);
  for (const c of cuisB) {
    if (setA.has(c)) return false;
  }
  return cuisA.length > 0 && cuisB.length > 0;
}

/**
 * cross-aroma: top-aroma class differs between the two ingredients.
 * Falls back to false when gnn_entropy.json is unavailable or one side is
 * missing a top class. Audit report flags this fallback in the data-source
 * health section.
 */
export function crossAroma(pair, gnnEntropy) {
  if (!pair || !gnnEntropy) return false;
  const a = gnnEntropy[pair.ingredientA];
  const b = gnnEntropy[pair.ingredientB];
  if (!a || !b) return false;
  const topA = topClassFor(a);
  const topB = topClassFor(b);
  if (!topA || !topB) return false;
  return topA !== topB;
}

function topClassFor(entry) {
  if (!entry) return null;
  if (typeof entry.topClass === 'string') return entry.topClass;
  const probs = entry.probs || entry.probabilities || entry;
  if (!probs || typeof probs !== 'object') return null;
  let bestKey = null;
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(probs)) {
    if (typeof v !== 'number') continue;
    if (v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  }
  return bestKey;
}

/**
 * AXIS_LIST — the canonical ordering the report uses.
 */
export const AXIS_LIST = ['chem-bridged-rare', 'absent-from-books', 'cross-cuisine', 'cross-aroma'];

/**
 * classifyAxes — runs every classifier against a pair and returns the list of
 * axes that fired. Used to populate the per-axis tables.
 */
export function classifyAxes(pair, ctx) {
  const out = [];
  if (chemBridgedRare(pair)) out.push('chem-bridged-rare');
  if (absentFromBooks(pair, ctx.gtSet)) out.push('absent-from-books');
  if (crossCuisine(pair, ctx.ingredientMeta)) out.push('cross-cuisine');
  if (crossAroma(pair, ctx.gnnEntropy)) out.push('cross-aroma');
  return out;
}
