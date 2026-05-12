/**
 * bucketPoles.js — R17 Phase A/B: per-axis bucket-pole positions for
 * the continuous pull-slider hybrid.
 *
 * Each axis (aromas, cuisine, season, family, taste) defines a small
 * set of bucket labels. In 3D mode, the bucket centroids are arranged
 * on a Fibonacci sphere around the origin (so any N >= 1 distributes
 * roughly uniformly). In 2D mode, they sit on a flat ring at y=0 —
 * matching `categoricalWheelPositions.js`'s RING_RADIUS layout.
 *
 * Phase A v1 collapses every member of a bucket onto its centroid
 * (the "pole"). Phyllotaxis re-spreading inside the bucket — so
 * members don't overlap perfectly — is a v2 nice-to-have. Pull < 100%
 * means the cooccurrence base anchors them apart anyway, so the
 * overlap is only visible at pullStrength === 1.
 *
 * Returns the same shape as categoricalWheelPositions.js so the
 * renderer can drop them straight into its existing dispatch:
 *   { positions: Record<name, [x,y,z]>,
 *     polePositions: Map<bucketLabel, [x,y,z]>,
 *     bucketOf: Map<name, bucketLabel> }
 */

import { bucketAllNodes } from './categoricalAxes.js';

export const POLE_RADIUS = 90;   // Same scale as categoricalWheelPositions
const RADIUS = POLE_RADIUS;
const Y_PLANE = 0;             // 2D ring lives on y=0
const PHI = Math.PI * (3 - Math.sqrt(5)); // Golden angle for Fibonacci sphere

/**
 * Distribute N points on a unit sphere using the Fibonacci spiral.
 * Returns an array of [x, y, z] unit vectors. Angularly uniform for
 * any N >= 1.
 */
export function fibonacciSphere(n) {
  const out = [];
  if (n <= 0) return out;
  if (n === 1) return [[0, 1, 0]]; // single bucket sits on top pole
  for (let i = 0; i < n; i++) {
    // y goes from 1 (top) to -1 (bottom). The +0.5 offset avoids
    // landing the first point exactly on the north pole, which
    // makes labels easier to read.
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = PHI * i;
    out.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return out;
}

/**
 * Compute 3D bucket-pole positions for a categorical axis.
 *
 * @param {string} axisKey  one of 'aromas' | 'cuisine' | 'season' | 'family' | 'taste'
 * @param {Map<string, object>} nodes  graph node map
 * @param {object} ctx  data context for bucketing (gnnEntropy, cuisineMap, seasonMap, cocktailScope, sauceScope)
 */
export function computeBucketPoles3D(axisKey, nodes, ctx = {}) {
  const { bucketOf, axis } = bucketAllNodes(axisKey, nodes, ctx);
  if (!axis) return { positions: {}, polePositions: new Map(), bucketOf: new Map() };

  const dirs = fibonacciSphere(axis.labels.length);
  const polePositions = new Map();
  for (let k = 0; k < axis.labels.length; k++) {
    const [x, y, z] = dirs[k];
    polePositions.set(axis.labels[k], [x * RADIUS, y * RADIUS, z * RADIUS]);
  }

  // Unbucketed nodes are intentionally absent from `positions` — the
  // renderer falls back to cooccurrence (no pull) for those.
  const positions = {};
  for (const node of nodes.values()) {
    const label = bucketOf.get(node.name);
    if (label && polePositions.has(label)) positions[node.name] = polePositions.get(label);
  }
  return { positions, polePositions, bucketOf };
}

/**
 * Compute 2D bucket-pole positions — flat ring at y=0.
 *
 * Matches the layout used by `categoricalWheelPositions.js`'s
 * bucketCentroids so 2D mode keeps reading correctly from the same
 * geometric anchor when pullStrength === 1.
 */
export function computeBucketPoles2D(axisKey, nodes, ctx = {}) {
  const { bucketOf, axis } = bucketAllNodes(axisKey, nodes, ctx);
  if (!axis) return { positions: {}, polePositions: new Map(), bucketOf: new Map() };

  const N = axis.labels.length;
  const polePositions = new Map();
  // Start at top of the ring, sweep clockwise — matches the angle
  // convention used by categoricalWheelPositions.js so 2D pull=100%
  // visually reproduces the R16 wheel.
  for (let k = 0; k < N; k++) {
    const angle = (2 * Math.PI * k) / N - Math.PI / 2;
    polePositions.set(axis.labels[k], [Math.cos(angle) * RADIUS, Y_PLANE, Math.sin(angle) * RADIUS]);
  }

  const positions = {};
  for (const node of nodes.values()) {
    const label = bucketOf.get(node.name);
    if (label && polePositions.has(label)) positions[node.name] = polePositions.get(label);
  }
  return { positions, polePositions, bucketOf };
}
