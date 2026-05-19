/**
 * guidedRadarAxes.js — pure helper module for GuidedProfileRadar.
 *
 * Resolves four pieces of data per filter type:
 *   1. getAxesFor(filterType)        — ordered axis labels for the radar
 *   2. getColorMapFor(filterType)    — bucket-key → hex color map
 *   3. pairingMatchesAxis(p, ft, k)  — does pairing match a given axis?
 *   4. coordsForPairing(p, ft, axes, radius)
 *      — SVG (x,y) centroid of all matching axis positions, or null
 *
 * Mirrors `ProfileAxisRadar.signalForAxis` semantics so the per-pairing
 * radar reads the same node fields as the existing per-recipe radar:
 *   taste   → tokenize node.taste string (lowercase, comma/whitespace split)
 *   aroma   → node.gnnProbs['odor_<axis>'] >= threshold
 *   season  → tokenize node.season string
 *   cuisine → node.cuisines[] array membership (lowercase compare)
 *
 * Cuisine axes are read directly from `CATEGORICAL_AXES.cuisine.labels`
 * (8 buckets, ADR-2). Exact-reference equality is the regression contract.
 */

import { CATEGORICAL_AXES } from './categoricalAxes.js';
import {
  BRISCIONE_AROMA,
  BRISCIONE_TASTE,
  BRISCIONE_SEASON,
} from './briscionePalette.js';
import { CUISINE_CHIP_COLOR } from '../components/guidedIcons.jsx';

// Exact-reference: getAxesFor('cuisine') === CATEGORICAL_AXES.cuisine.labels
const AXIS_BY_FILTER = {
  taste:   ['sweet', 'sour', 'bitter', 'salty', 'umami', 'pungent', 'astringent', 'spicy'], // 8
  aroma:   ['fruity', 'floral', 'green', 'woody', 'spicy', 'fatty'],                          // 6
  season:  ['spring', 'summer', 'fall', 'winter'],                                            // 4
  cuisine: CATEGORICAL_AXES.cuisine.labels,                                                   // 8 (ADR-2)
};

const COLOR_BY_FILTER = {
  taste:   BRISCIONE_TASTE,
  aroma:   BRISCIONE_AROMA,
  season:  BRISCIONE_SEASON,
  cuisine: CUISINE_CHIP_COLOR,
};

export function getAxesFor(filterType) {
  return AXIS_BY_FILTER[filterType] || [];
}

export function getColorMapFor(filterType) {
  return COLOR_BY_FILTER[filterType] || {};
}

function tokenize(str) {
  if (!str || typeof str !== 'string') return [];
  return str.toLowerCase().trim().split(/[\s,/]+/).filter(Boolean);
}

/**
 * pairingMatchesAxis — boolean predicate: does the pairing's data
 * include a positive signal for `axisKey` under `filterType`?
 *
 * For 'aroma', `odorThresholds` is consulted per-axis if supplied
 * (shape `{ odor_fruity: 0.55, ... }`); otherwise falls back to 0.5.
 */
export function pairingMatchesAxis(pairing, filterType, axisKey, odorThresholds = null) {
  if (!pairing || axisKey == null) return false;

  if (filterType === 'taste') {
    return tokenize(pairing.taste).includes(String(axisKey).toLowerCase());
  }
  if (filterType === 'season') {
    return tokenize(pairing.season).includes(String(axisKey).toLowerCase());
  }
  if (filterType === 'aroma') {
    const probs = pairing.gnnProbs;
    if (!probs) return false;
    const p = probs[`odor_${axisKey}`];
    if (typeof p !== 'number') return false;
    const thr =
      odorThresholds && typeof odorThresholds[`odor_${axisKey}`] === 'number'
        ? odorThresholds[`odor_${axisKey}`]
        : 0.5;
    return p >= thr;
  }
  if (filterType === 'cuisine') {
    const list = Array.isArray(pairing.cuisines) ? pairing.cuisines : [];
    // Case-insensitive match — axisKey may be 'East Asian' while the
    // pairing's array carries 'east asian' or 'East Asian'.
    const target = String(axisKey).toLowerCase();
    for (const c of list) {
      if (String(c).toLowerCase() === target) return true;
    }
    return false;
  }
  return false;
}

/**
 * coordsForPairing — centroid of all axis positions the pairing matches.
 *
 * Returns `{ x, y }` SVG coords centered at (radius, radius) so a
 * single-match pairing plots ON the matching axis at full radius.
 * Returns `null` when:
 *   - filterType === 'aroma' AND pairing.gnnProbs is missing, OR
 *   - no axis in `axes` matches the pairing.
 *
 * The centroid is the arithmetic mean of `(cos a, sin a) * radius`
 * for each matching axis index `i` at angle `a = 2πi/N - π/2`. With
 * one match this is the axis tip; with multiple matches it shrinks
 * toward the center as a natural "spread" cue.
 */
export function coordsForPairing(pairing, filterType, axes, radius, odorThresholds = null) {
  if (!pairing || !Array.isArray(axes) || axes.length === 0) return null;
  // Aroma honesty: no gnnProbs → drop (never fabricate a position).
  if (filterType === 'aroma' && !pairing.gnnProbs) return null;

  const matchedIndices = [];
  for (let i = 0; i < axes.length; i++) {
    if (pairingMatchesAxis(pairing, filterType, axes[i], odorThresholds)) {
      matchedIndices.push(i);
    }
  }
  if (matchedIndices.length === 0) return null;

  let sumX = 0;
  let sumY = 0;
  for (const i of matchedIndices) {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    sumX += Math.cos(angle) * radius;
    sumY += Math.sin(angle) * radius;
  }
  const n = matchedIndices.length;
  return { x: sumX / n, y: sumY / n };
}
