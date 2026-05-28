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
// Aroma axis expanded 2026-05-27 (batch 6) from the 6-head GNN set to
// the full 13-category chef vocab. The 8 chef-only categories (citrus,
// herbal, earthy, roasted, caramel, aged, marine, pungent) have no GNN
// odor head — pairingMatchesAxis falls back to checking the pairing's
// chef flavorGraph tier1 for those.
const AXIS_BY_FILTER = {
  taste:   ['sweet', 'sour', 'bitter', 'salty', 'umami', 'pungent', 'astringent', 'spicy'], // 8
  aroma:   ['citrus', 'fruity', 'floral', 'herbal', 'green', 'creamy', 'woody', 'earthy', 'roasted', 'caramel', 'fermented', 'marine', 'pungent'], // 13
  season:  ['spring', 'summer', 'fall', 'winter'],                                            // 4
  cuisine: CATEGORICAL_AXES.cuisine.labels,                                                   // 8 (ADR-2)
};

// GNN-pickable aroma keys (display key → GNN column name). Mirror of
// the GNN_KEY_FOR map in primaryTier1.js; kept here so pairingMatchesAxis
// can resolve display-key axes back to their model column without
// pulling the whole primaryTier1 module into the radar's import graph.
const AROMA_GNN_KEY = {
  fruity: 'odor_fruity',
  floral: 'odor_floral',
  green:  'odor_green',
  woody:  'odor_woody',
  creamy: 'odor_fatty',
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
    const key = String(axisKey).toLowerCase();

    // Chef-only categories (citrus / herbal / earthy / roasted / caramel
    // / aged / marine / pungent) have no GNN head — they only match
    // when the pairing's chef-curated flavorGraph tier1 carries the
    // label. The exact-reference contract treats chef-tier1 as the
    // single source of truth for chef-only categories.
    const gnnColumn = AROMA_GNN_KEY[key];
    if (!gnnColumn) {
      const tier1 = pairing.flavorGraph?.tier1;
      if (!Array.isArray(tier1)) return false;
      return tier1.some((t) => String(t).toLowerCase() === key);
    }

    // GNN-pickable categories (fruity / floral / green / woody / creamy)
    // — fall back to chef tier1 first when present (chef beats model),
    // then check the model column against its threshold.
    const tier1 = pairing.flavorGraph?.tier1;
    if (Array.isArray(tier1) && tier1.some((t) => String(t).toLowerCase() === key)) {
      return true;
    }
    const probs = pairing.gnnProbs;
    if (!probs) return false;
    const p = probs[gnnColumn];
    if (typeof p !== 'number') return false;
    const thr =
      odorThresholds && typeof odorThresholds[gnnColumn] === 'number'
        ? odorThresholds[gnnColumn]
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
  // Aroma honesty: drop only when the pairing has neither gnnProbs nor
  // chef-tier1 — either signal is enough to plot. Chef-only categories
  // (citrus / herbal / etc.) match exclusively through flavorGraph.tier1.
  if (filterType === 'aroma' && !pairing.gnnProbs && !pairing.flavorGraph?.tier1?.length) {
    return null;
  }

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
