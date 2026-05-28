/**
 * accentPlacement.js — pure algorithm for the Briscione wedge-grid wheel.
 *
 * Given a focal ingredient + its top-K neighbors + the GNN odor thresholds,
 * compute each accent ingredient's (sector, ring) cell placement, line
 * thickness, and the focal's activated-aroma set. No React, no SVG, no IO.
 *
 * Consumed by `WedgeGridFlavorWheel.jsx` (full + compact modes).
 *
 * Contract:
 *   compute(focalNode, neighbors, graphNodes, opts) →
 *     { cells: Cell[], dropped: number, activatedAromas: Set, ineligibleRings: Set }
 *
 *   where Cell = {
 *     sector: 'fruity'|'floral'|'green'|'woody'|'spicy'|'creamy',
 *     ring:   'taste'|'season'|'cuisine'|'method'|'compact'|null,
 *     ingredientName: string,
 *     strength: number,             // pair strength 0..1
 *     thickness: number,            // 1..4 desktop, 1..3 mobile (compact preserves)
 *     distinctiveBucketKey: string, // bucket in the ring axis ingredient hits
 *     fallback?: boolean,           // true when all 4 rings ineligible
 *     overflow?: number,            // overflow count when cell is capped
 *   }
 */

import { axisOrder } from './briscionePalette.js';
import { dominantMethodFor } from './cookingMethods.js';

// 2026-05-27 (batch 6 chef-vocab): renamed 'fatty' → 'creamy'.
const AROMA_AXES = ['fruity', 'floral', 'green', 'woody', 'spicy', 'creamy'];

// Display-key → GNN column name. Only 'creamy' diverges (column is
// the legacy `odor_fatty`); others map by `odor_<key>` prefix.
const GNN_COLUMN = {
  fruity: 'odor_fruity',
  floral: 'odor_floral',
  green:  'odor_green',
  woody:  'odor_woody',
  spicy:  'odor_spicy',
  creamy: 'odor_fatty',
};
// Tiebreaker order for distinctiveRing argmax — spec §Defined Variables.
const RING_TIEBREAKER_ORDER = ['taste', 'cuisine', 'season', 'method'];

/* ────────────── Per-node category signal sets ─────────────────────── */

/**
 * categorySignal(node, axis) → Set<string>
 *
 * Returns the set of bucket-keys this node hits in the given axis.
 * Used for set-difference accent computation:
 *   accent_gain(neighbor, focal, axis) = |neighbor_set \ focal_set|
 */
export function categorySignal(node, axis) {
  if (!node) return new Set();
  if (axis === 'taste') {
    const s = String(node.taste || '').toLowerCase();
    if (!s) return new Set();
    const out = new Set();
    for (const key of axisOrder('taste')) {
      if (s.includes(key)) out.add(key);
    }
    return out;
  }
  if (axis === 'season') {
    const s = String(node.season || '').toLowerCase();
    if (!s) return new Set();
    const out = new Set();
    for (const key of axisOrder('season')) {
      if (s.includes(key)) out.add(key);
    }
    return out;
  }
  if (axis === 'cuisine') {
    const arr = Array.isArray(node.cuisines) ? node.cuisines : [];
    return new Set(arr.map((c) => String(c).toLowerCase()));
  }
  if (axis === 'method') {
    // dominantMethodFor falls back to 'raw' for role='other', which is
    // technically a default — not real signal. Treat 'other'-role nodes
    // as having NO method signal so they count as ineligible. Verifiable
    // via cookingMethods.js ROLE_TO_METHODS table.
    const m = dominantMethodFor(node.name || '', node);
    if (!m) return new Set();
    // The 'raw' bucket is the default for 'other'/'salt'/'acid'/'herb' —
    // for the wheel's purposes, treat 'other'-role nodes as no-signal so
    // the wheel doesn't claim a method ring for ingredients with no real
    // method affinity.
    const fallbacks = new Set(['raw']);
    // Cheap heuristic: only block 'raw' when the node has no explicit
    // role override (no recognizable name match would also imply no
    // method). We detect "explicit method" by checking the role table.
    // For now keep this conservative: a node with a known protein/
    // vegetable/etc name has its dominant method by role; 'mystery'
    // names return 'raw' from the 'other' bucket — exclude those.
    const isExplicitProtein = /\b(chicken|beef|pork|lamb|fish|salmon|tuna|cod|shrimp|crab|egg|tofu)\b/i.test(node.name || '');
    const isExplicitVeg = /\b(onion|garlic|carrot|broccoli|spinach|kale|pepper|tomato|potato|mushroom)\b/i.test(node.name || '');
    const isExplicitStarch = /\b(rice|pasta|bread|noodle|polenta|grits|oatmeal)\b/i.test(node.name || '');
    const looksExplicit = isExplicitProtein || isExplicitVeg || isExplicitStarch;
    if (fallbacks.has(m) && !looksExplicit) return new Set();
    return new Set([m]);
  }
  return new Set();
}

/* ────────────── Eligibility ─────────────────────────────────────────── */

/**
 * computeIneligibleRings(focalNode) → Set<axis>
 *
 * A ring axis is ineligible for the distinctive-ring `argmax` when the
 * focal has NO signal in that axis. This guards against the monoculture-
 * wheel failure mode where a focal with `cuisines=[]` (3,587/3,913
 * ingredients per session memory) causes every neighbor with any
 * cuisine to win the cuisine ring.
 */
export function computeIneligibleRings(focalNode) {
  const out = new Set();
  for (const axis of RING_TIEBREAKER_ORDER) {
    if (categorySignal(focalNode, axis).size === 0) out.add(axis);
  }
  return out;
}

/* ────────────── Distinctive-ring placement ──────────────────────────── */

/**
 * distinctiveRing(neighbor, focal, opts) → string | null
 *
 * Returns the axis where neighbor adds the MOST keys beyond focal,
 * excluding ineligible rings. Returns null when all rings are
 * ineligible (extremely rare fallback case).
 */
export function distinctiveRing(neighborNode, focalNode, { ineligibleRings, mobileDropMethod = false } = {}) {
  const ineligible = ineligibleRings instanceof Set ? ineligibleRings : new Set();
  let best = null;
  let bestGain = -1;
  // Spec tiebreaker order (taste > cuisine > season > method) is honored
  // by iterating in that order and using strict ">" so the first hit wins
  // on ties. Mobile drops `method` entirely.
  for (const axis of RING_TIEBREAKER_ORDER) {
    if (ineligible.has(axis)) continue;
    if (mobileDropMethod && axis === 'method') continue;
    const neighborSet = categorySignal(neighborNode, axis);
    const focalSet = categorySignal(focalNode, axis);
    let gain = 0;
    for (const k of neighborSet) if (!focalSet.has(k)) gain++;
    if (gain > bestGain) {
      bestGain = gain;
      best = axis;
    }
  }
  if (best === null || bestGain <= 0) return null;
  return best;
}

/**
 * distinctiveBucketKey(neighbor, focal, ring) → string | null
 *
 * Returns the SINGLE bucket-key in the distinctive ring that this
 * neighbor is contributing (used for the `onFilterBucket(axis, key)`
 * call site). When the neighbor adds multiple keys, pick the first
 * one in axis-canonical order.
 */
export function distinctiveBucketKey(neighborNode, focalNode, ring) {
  if (!ring) return null;
  const nSet = categorySignal(neighborNode, ring);
  const fSet = categorySignal(focalNode, ring);
  for (const key of axisOrder(ring)) {
    if (nSet.has(key) && !fSet.has(key)) return key;
  }
  // Fallback: if no "new" key, return whatever the neighbor has first.
  for (const key of axisOrder(ring)) {
    if (nSet.has(key)) return key;
  }
  return null;
}

/* ────────────── Line thickness ──────────────────────────────────────── */

/**
 * lineThickness(neighbor, focal, distinctiveRingKey, ineligibleRings) → 1..4
 *
 * 1 + (count of eligible axes OTHER than distinctive where neighbor
 * adds ≥1 key beyond focal). Range 1..4 desktop, 1..3 mobile. Used as
 * both the ring-placement annotation (full mode) and the accent-strength
 * annotation (compact mode) — identical semantics.
 */
export function lineThickness(neighborNode, focalNode, distinctiveRingKey, { ineligibleRings, mobileDropMethod = false } = {}) {
  const ineligible = ineligibleRings instanceof Set ? ineligibleRings : new Set();
  let count = 0;
  for (const axis of RING_TIEBREAKER_ORDER) {
    if (axis === distinctiveRingKey) continue;
    if (ineligible.has(axis)) continue;
    if (mobileDropMethod && axis === 'method') continue;
    const nSet = categorySignal(neighborNode, axis);
    const fSet = categorySignal(focalNode, axis);
    let gain = 0;
    for (const k of nSet) if (!fSet.has(k)) { gain = 1; break; }
    if (gain) count++;
  }
  return 1 + count;
}

/* ────────────── Activated aromas ────────────────────────────────────── */

/**
 * activatedAromas(focalNode, odorThresholds) → Set<axis>
 *
 * The set of aroma sectors that get the Briscione fill color. A sector
 * is activated when the focal's GNN probability exceeds the per-axis
 * calibrated threshold from `public/proDataset/odor_thresholds.json`.
 * Falls back to a permissive 0.30 threshold when thresholds missing.
 */
export function activatedAromas(focalNode, odorThresholds) {
  const out = new Set();
  const probs = focalNode?.gnnProbs;
  if (!probs) return out;
  for (const axis of AROMA_AXES) {
    const p = probs[GNN_COLUMN[axis]] || 0;
    const thr = (odorThresholds && odorThresholds[axis]) ?? 0.30;
    if (p >= thr) out.add(axis);
  }
  return out;
}

/* ────────────── Dominant aroma ──────────────────────────────────────── */

function dominantAroma(node) {
  if (!node?.gnnProbs) return null;
  let best = null;
  let bestV = -Infinity;
  for (const axis of AROMA_AXES) {
    const v = node.gnnProbs[GNN_COLUMN[axis]] || 0;
    if (v > bestV) { bestV = v; best = axis; }
  }
  return best;
}

/* ────────────── Full pipeline ───────────────────────────────────────── */

/**
 * computeAccentPlacement — the main entry point.
 *
 * @param {object} focalNode       graph node for the focal
 * @param {Array}  neighbors       array of { name, strength, ... }
 * @param {Map}    graphNodes      Map<name, node>
 * @param {object} opts
 *   - odorThresholds: Record<axis, number> (defaults via per-axis 0.30)
 *   - isMobile: boolean — drops the method ring from eligibility
 *   - compact:  boolean — collapses all rings into one 'compact' band
 *   - maxK:     top-K neighbors to place (default 20)
 *   - perCellCap: max ingredients per cell (default 4)
 */
export function computeAccentPlacement(focalNode, neighbors, graphNodes, opts = {}) {
  const {
    odorThresholds = null,
    isMobile = false,
    compact = false,
    maxK = 20,
    perCellCap = 4,
  } = opts;

  const result = {
    cells: [],
    dropped: 0,
    activatedAromas: activatedAromas(focalNode, odorThresholds),
    ineligibleRings: computeIneligibleRings(focalNode),
  };

  const mobileDropMethod = !!isMobile;
  if (mobileDropMethod) result.ineligibleRings.add('method');

  if (!focalNode || !Array.isArray(neighbors) || neighbors.length === 0) return result;

  // Group cells by (sector, ring); pack up to perCellCap, sorted by line thickness desc.
  const cellGroups = new Map(); // key: `${sector}|${ring}` → array

  const top = neighbors.slice(0, maxK);
  for (const nb of top) {
    const node = graphNodes?.get?.(nb.name);
    const aroma = dominantAroma(node);
    if (!aroma) { result.dropped++; continue; }

    let ring = distinctiveRing(node, focalNode, {
      ineligibleRings: result.ineligibleRings,
      mobileDropMethod,
    });
    let fallback = false;
    if (!ring) {
      // All rings ineligible OR no positive gain → flagged fallback.
      // Place on the first eligible ring, OR if every ring is
      // ineligible, default to 'taste' so the cell still renders at a
      // stable position (the fallback flag signals "this is a fudge").
      fallback = true;
      for (const axis of RING_TIEBREAKER_ORDER) {
        if (!result.ineligibleRings.has(axis) && !(mobileDropMethod && axis === 'method')) {
          ring = axis;
          break;
        }
      }
      if (!ring) ring = mobileDropMethod ? 'taste' : 'taste';
    }

    const placedRing = compact ? 'compact' : ring;
    const bucketKey = ring ? distinctiveBucketKey(node, focalNode, ring) : null;
    const thickness = lineThickness(node, focalNode, ring, {
      ineligibleRings: result.ineligibleRings,
      mobileDropMethod,
    });

    const cell = {
      sector: aroma,
      ring: placedRing,
      ingredientName: nb.name,
      strength: Number(nb.strength) || 0,
      thickness,
      distinctiveBucketKey: bucketKey,
      fallback,
    };

    const key = `${cell.sector}|${cell.ring}`;
    if (!cellGroups.has(key)) cellGroups.set(key, []);
    cellGroups.get(key).push(cell);
  }

  // Compact mode caps to 3 per sector (across the single 'compact' ring);
  // full mode caps to perCellCap per (sector, ring).
  const sectorCounts = new Map(); // sector → count, used in compact mode
  const compactPerSectorCap = 3;

  for (const [, group] of cellGroups) {
    group.sort((a, b) => b.thickness - a.thickness || b.strength - a.strength);
    const cap = compact ? Infinity : perCellCap;
    const taken = [];
    let overflow = 0;
    for (const c of group) {
      if (compact) {
        const sc = sectorCounts.get(c.sector) || 0;
        if (sc >= compactPerSectorCap) { overflow++; continue; }
        sectorCounts.set(c.sector, sc + 1);
      } else if (taken.length >= cap) {
        overflow++;
        continue;
      }
      taken.push(c);
    }
    if (overflow > 0 && taken.length > 0) {
      taken[taken.length - 1].overflow = overflow;
    }
    for (const c of taken) result.cells.push(c);
  }

  return result;
}
