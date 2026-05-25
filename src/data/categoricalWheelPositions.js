/**
 * categoricalWheelPositions.js — generate 2D wheel positions for the
 * categorical Network modes (aromas2d / cuisine2d / season2d /
 * family2d).
 *
 * Phase 1 of Interpretation B (2026-05-24): bucket centroids are now
 * **v3-derived** — each bucket's centroid is the mean of its members'
 * v3 UMAP positions (via `morphTargets.resolveBucketCentroid`).
 * Sparse buckets (< MIN_BUCKET_MEMBERS contributors) fall through to
 * a synthetic pole at the v3 spatial scale.
 *
 * Member placement around each centroid is unchanged — still
 * phyllotaxis (sunflower) packing.
 *
 * `ctx.v3Positions` is required. Callers without v3 positions get
 * empty output (no morph) — there is no longer a legacy synthetic-ring
 * fallback at the wheel level.
 *
 * Spec: docs/NETWORK-AND-AFFINITY-SPEC.md §7.3 (Phase-1 amendment).
 * Source: .omc/specs/deep-interview-v3-derived-morph-targets.md.
 *
 * Returns positions in the SAME [x, y, z] shape that the existing
 * `taste2d` mode uses (Y=0 flat plane), so the renderer can drop
 * them straight into the existing 2D dispatch.
 */

import { bucketAllNodes } from './categoricalAxes.js';
import {
  resolveBucketCentroid,
  v3BoundingRadius,
  SYNTHETIC_POLE_RADIUS_RATIO,
} from './morphTargets.js';

const SUB_DISC_BASE = 4;
const SUB_DISC_SCALE = 0.6;
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5° (sunflower angle)

/**
 * Compute wheel positions for one categorical axis.
 *
 * @param {string} axisKey  one of 'aromas' | 'cuisine' | 'season' | 'family'
 * @param {Map<string, object>} nodes  graph node map
 * @param {object} ctx  data context: { gnnEntropy, cuisineMap, seasonMap }
 * @returns {object}  { positions: Record<name, [x, y, z]>, bucketCentroids: Map<label, [x,y,z]>, bucketColor: Map<label, hex> }
 */
export function computeCategoricalWheelPositions(axisKey, nodes, ctx = {}) {
  const { bucketOf, byBucket, axis } = bucketAllNodes(axisKey, nodes, ctx);
  if (!axis) return { positions: {}, bucketCentroids: new Map(), bucketColor: new Map(), bucketOf: new Map() };

  const v3Positions = ctx?.v3Positions;
  if (!v3Positions) {
    return { positions: {}, bucketCentroids: new Map(), bucketColor: new Map(), bucketOf };
  }

  const labels = axis.labels;
  const colors = axis.colors;
  const N = labels.length;
  const positions = {};
  const bucketCentroids = new Map();
  const bucketColor = new Map();

  const sparseBucketFallbackRadius =
    v3BoundingRadius(v3Positions) * SYNTHETIC_POLE_RADIUS_RATIO;

  for (let k = 0; k < N; k++) {
    const label = labels[k];
    const color = colors[k];
    const members = byBucket.get(label) || [];

    // v3-derived bucket centroid (member-mean over v3 positions;
    // synthetic-pole when the bucket has < MIN_BUCKET_MEMBERS).
    const [cx, cy, cz] = resolveBucketCentroid({
      bucketLabel: label,
      bucketIdx: k,
      bucketCount: N,
      probKey: null,            // Phase 1: member-mean regime only
      memberNames: members,
      v3Positions,
      fallbackRadius: sparseBucketFallbackRadius,
    });
    void cy;                     // Y dropped — wheel layout is Y=0 flat
    bucketCentroids.set(label, [cx, 0, cz]);
    bucketColor.set(label, color);

    if (members.length === 0) continue;
    const subDiscR = SUB_DISC_BASE + Math.sqrt(members.length) * SUB_DISC_SCALE;
    // Phyllotaxis radius scaling: r_i = subDiscR * sqrt((i + 0.5) / count)
    // gives uniform-density packing.
    const denom = members.length;
    for (let i = 0; i < denom; i++) {
      const r = subDiscR * Math.sqrt((i + 0.5) / denom);
      const t = i * GOLDEN;
      const dx = Math.cos(t) * r;
      const dz = Math.sin(t) * r;
      positions[members[i]] = [cx + dx, 0, cz + dz];
    }
  }

  // Unbucketed nodes get a sentinel position well outside the camera
  // frame so they don't pile at the wheel center. Without this every
  // ingredient that fails to bucket clusters at [0,0,0], producing a
  // dense blob at the wheel hub.
  const OFFSCREEN = [9999, 0, 9999];
  for (const node of nodes.values()) {
    if (!positions[node.name]) positions[node.name] = OFFSCREEN;
  }

  return { positions, bucketCentroids, bucketColor, bucketOf };
}
