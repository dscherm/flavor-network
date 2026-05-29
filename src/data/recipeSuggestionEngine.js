/**
 * recipeSuggestionEngine.js — recipe-level co-occurrence rankers.
 *
 * Two exports:
 *   - rankByRecipeCooccurrence (legacy §8.1) — equal-weight sum over
 *     bowl members, FAMILIARITY_FLOOR gate, max-normalized strength
 *   - rankSuggestions (§13.1 focal-weighted) — focal contributes 60% of
 *     the score; non-focal split 40% by proportional-mass (or equal-
 *     weight when no amounts are entered). Auto-focal at ranking time
 *     when focalKey is null + bowl has any masses (highest-mass wins).
 *
 * Both ranker shapes return `[{ name, strength }]` with strength ∈ [0, 1]
 * so the UI's `matchPct` rendering works against either output.
 *
 * Familiarity floor = 50 recipes (matches `proDataset/config.js:MIN_INGREDIENT_RECIPES`).
 * Used as a HARD GATE on globalCount, not a multiplier — multiplying by
 * familiarity makes every bowl converge on the same global-popular
 * ingredients (sugar/onion/garlic/butter); using it only as a floor
 * lets the bowl-specific co-occurrence sum drive ranking while still
 * dropping obscure-but-tightly-paired noise.
 */

import { UNIT_DENSITY } from './portionParser.js';
import { bowlNames } from './bowlEntry.js';

const FAMILIARITY_FLOOR = 50;
const W_FOCAL = 0.6;

export function rankByRecipeCooccurrence(bowl, recipePairs, globalCount, K = 100) {
  if (!recipePairs || !globalCount) return [];

  if (!bowl || bowl.length === 0) {
    const entries = [];
    for (const name in globalCount) {
      const c = globalCount[name];
      if (c >= FAMILIARITY_FLOOR) entries.push([name, c]);
    }
    entries.sort((a, b) => b[1] - a[1]);
    entries.length = Math.min(entries.length, K);
    const max = entries[0]?.[1] || 1;
    return entries.map(([name, count]) => ({ name, strength: count / max }));
  }

  const bowlSet = new Set(bowl);
  const scoreSum = new Map();

  for (const s of bowl) {
    const partners = recipePairs[s];
    if (!partners) continue;
    for (const partner in partners) {
      if (bowlSet.has(partner)) continue;
      const count = partners[partner];
      scoreSum.set(partner, (scoreSum.get(partner) || 0) + Math.log1p(count));
    }
  }

  const ranked = [];
  for (const [name, sum] of scoreSum) {
    if ((globalCount[name] || 0) < FAMILIARITY_FLOOR) continue;
    ranked.push({ name, raw: sum });
  }

  ranked.sort((a, b) => b.raw - a.raw);
  ranked.length = Math.min(ranked.length, K);

  const max = ranked[0]?.raw || 1;
  return ranked.map(({ name, raw }) => ({ name, strength: raw / max }));
}

// Compute the gram-mass of one BowlEntry's amount. Returns null when
// qty or unit are missing, when the unit isn't in UNIT_DENSITY, or
// when the entry has no amount.
function massOf(entry) {
  const a = entry?.amount;
  if (!a || a.qty == null || !a.unit) return null;
  const density = UNIT_DENSITY[a.unit];
  if (density == null) return null;
  return a.qty * density;
}

// §13.3 auto-focal rule: when focalKey is null + bowl has any mass,
// the highest-mass ingredient acts as focal at ranking time (not
// persisted). Returns the bowl index or -1 when no focal applies.
function effectiveFocalIdx(bowl, focalKey, names) {
  if (focalKey && names.includes(focalKey)) return names.indexOf(focalKey);
  let bestIdx = -1;
  let bestMass = 0;
  for (let i = 0; i < bowl.length; i++) {
    const m = massOf(bowl[i]);
    if (m != null && m > bestMass) {
      bestMass = m;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// §13.1 focal-weighted suggestion ranker.
//   score(c) = log1p(count(focal, c)) * W_FOCAL
//            + Σ over non-focal i: log1p(count(i, c)) * (1-W_FOCAL) * propWeight(i)
//
// where propWeight(i) = mass(i) / Σ mass(j) when all non-focal entries
// have masses, else uniform 1 / N_non_focal (equal-weight fallback).
//
// When no focal applies (focalKey absent + no masses anywhere), the
// formula collapses to equal-weight over the full bowl — functionally
// equivalent to rankByRecipeCooccurrence after max-normalization.
export function rankSuggestions(bowl, focalKey = null, candidates = null, ctx = {}) {
  const { recipePairs, globalCount, K = 100 } = ctx;
  if (!recipePairs || !globalCount) return [];

  if (!Array.isArray(bowl) || bowl.length === 0) {
    return rankByRecipeCooccurrence([], recipePairs, globalCount, K);
  }

  const names = bowlNames(bowl);
  const bowlSet = new Set(names);
  const candSet = candidates ? new Set(candidates) : null;

  const focalIdx = effectiveFocalIdx(bowl, focalKey, names);
  const hasFocal = focalIdx >= 0;

  const weights = new Array(bowl.length).fill(0);
  if (hasFocal) {
    weights[focalIdx] = W_FOCAL;
    const nonFocalIdx = [];
    for (let i = 0; i < bowl.length; i++) if (i !== focalIdx) nonFocalIdx.push(i);
    if (nonFocalIdx.length > 0) {
      const masses = nonFocalIdx.map((i) => massOf(bowl[i]));
      const allHaveMass = masses.every((m) => m != null && m > 0);
      const totalMass = masses.reduce((s, m) => s + (m ?? 0), 0);
      const W_SEC = 1 - W_FOCAL;
      if (allHaveMass && totalMass > 0) {
        for (let li = 0; li < nonFocalIdx.length; li++) {
          weights[nonFocalIdx[li]] = W_SEC * (masses[li] / totalMass);
        }
      } else {
        const eq = W_SEC / nonFocalIdx.length;
        for (const i of nonFocalIdx) weights[i] = eq;
      }
    }
  } else {
    const w = 1 / bowl.length;
    for (let i = 0; i < bowl.length; i++) weights[i] = w;
  }

  const scoreSum = new Map();
  for (let i = 0; i < bowl.length; i++) {
    const partners = recipePairs[names[i]];
    if (!partners) continue;
    const w = weights[i];
    if (w === 0) continue;
    for (const partner in partners) {
      if (bowlSet.has(partner)) continue;
      if (candSet && !candSet.has(partner)) continue;
      const base = Math.log1p(partners[partner]);
      scoreSum.set(partner, (scoreSum.get(partner) || 0) + base * w);
    }
  }

  const ranked = [];
  for (const [name, sum] of scoreSum) {
    if ((globalCount[name] || 0) < FAMILIARITY_FLOOR) continue;
    ranked.push({ name, raw: sum });
  }
  ranked.sort((a, b) => b.raw - a.raw);
  ranked.length = Math.min(ranked.length, K);
  const max = ranked[0]?.raw || 1;
  return ranked.map(({ name, raw }) => ({ name, strength: raw / max }));
}
