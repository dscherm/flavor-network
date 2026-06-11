/**
 * recipeProfileAnalysis — pure flavor-profile math for the Flavor Profiles card
 * and the profile-delta suggestion cards. No React, no I/O → unit-testable.
 *
 * The recipe's profile is the mean of its ingredients' gnnProbs across the 11
 * taste+aroma axes. From that we derive: per-axis drivers, an insight line, the
 * profile shift a candidate ingredient would cause, and boost/temper rankings.
 */
import { AROMA_LABELS, AROMA_COLORS } from './recipeScoring.js';

export const TASTE_AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami'];
export const AROMA_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
export const AXES = [...TASTE_AXES, ...AROMA_AXES];

const TASTE_COLOR = {
  sweet: '#ff5fa2', sour: '#2bd4d4', bitter: '#a855f7', salty: '#5b8def', umami: '#e0a93b',
};

export function axisLabel(axis) {
  if (AROMA_LABELS[axis]) return AROMA_LABELS[axis];
  return axis.charAt(0).toUpperCase() + axis.slice(1);
}
export function axisColor(axis) {
  return TASTE_COLOR[axis] || AROMA_COLORS[axis] || '#a09070';
}

// Which axis counterbalances a given one (used for "temper" suggestions).
export const BALANCING = {
  sweet: 'sour', sour: 'sweet', bitter: 'sweet', salty: 'sour', umami: 'sour',
  odor_fruity: 'odor_green', odor_floral: 'odor_woody', odor_green: 'odor_fruity',
  odor_woody: 'odor_fruity', odor_spicy: 'sweet', odor_fatty: 'odor_green',
};

/** A node's 11-axis probability vector, or null. */
export function nodeProbs(name, nodes) {
  const p = nodes?.get?.(name)?.gnnProbs;
  if (!p) return null;
  return p;
}

/**
 * Aggregate per-axis profile of a bowl: mean over ingredients that have probs.
 * @returns {{ scores: Record<string,number>, drivers: Record<string,string[]>, n: number }}
 */
export function recipeAxisProfile(bowlNames, nodes) {
  const names = Array.isArray(bowlNames) ? bowlNames : [];
  const sums = Object.fromEntries(AXES.map((a) => [a, 0]));
  const contrib = Object.fromEntries(AXES.map((a) => [a, []])); // {axis: [{name, v}]}
  let n = 0;
  for (const name of names) {
    const p = nodeProbs(name, nodes);
    if (!p) continue;
    n += 1;
    for (const a of AXES) {
      const v = p[a] || 0;
      sums[a] += v;
      contrib[a].push({ name, v });
    }
  }
  const scores = {};
  const drivers = {};
  for (const a of AXES) {
    scores[a] = n ? sums[a] / n : 0;
    drivers[a] = contrib[a]
      .filter((c) => c.v > 0.05)
      .sort((x, y) => y.v - x.v)
      .slice(0, 3)
      .map((c) => c.name);
  }
  return { scores, drivers, n };
}

/** Rule-based insight line for an axis given its aggregate score. */
export function axisInsight(axis, score) {
  const bal = axisLabel(BALANCING[axis] || '');
  const isTaste = TASTE_AXES.includes(axis);
  if (score >= 0.5) {
    return isTaste
      ? `Leans ${axisLabel(axis).toLowerCase()} — balance with ${bal.toLowerCase()}.`
      : `Strong ${axisLabel(axis).toLowerCase()} aroma — temper with ${bal.toLowerCase()} if it dominates.`;
  }
  if (score >= 0.2) return `${axisLabel(axis)} is present and balanced.`;
  return `Faint ${axisLabel(axis).toLowerCase()} — boost it if you want more.`;
}

/**
 * Per-axis shift a candidate ingredient causes if added to the bowl.
 * delta[axis] = (cand[axis] - mean[axis]) / (n + 1).
 * @returns {Record<string, number>|null}
 */
export function profileDelta(candidateName, scores, n, nodes) {
  const p = nodeProbs(candidateName, nodes);
  if (!p) return null;
  const delta = {};
  for (const a of AXES) delta[a] = ((p[a] || 0) - (scores[a] || 0)) / (n + 1);
  return delta;
}

/** The axes a candidate moves most (by |delta|), for the card's delta arrows. */
export function topMovers(delta, k = 3) {
  if (!delta) return [];
  return AXES
    .map((a) => ({ axis: a, delta: delta[a] }))
    .filter((d) => Math.abs(d.delta) > 0.002)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, k);
}

/**
 * Rank candidate names by their impact on a target axis.
 *  - mode 'boost'  → largest positive delta on `axis`
 *  - mode 'temper' → largest positive delta on the balancing axis of `axis`
 * Only candidates with probs are considered. Returns [{name, delta}].
 */
export function rankByAxisImpact(candidateNames, axis, scores, n, nodes, { mode = 'boost', topN = 4 } = {}) {
  const target = mode === 'temper' ? (BALANCING[axis] || axis) : axis;
  const out = [];
  for (const name of candidateNames || []) {
    const d = profileDelta(name, scores, n, nodes);
    if (!d) continue;
    if (d[target] <= 0) continue;
    out.push({ name, delta: d[target] });
  }
  out.sort((a, b) => b.delta - a.delta);
  return out.slice(0, topN);
}
