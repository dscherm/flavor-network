/**
 * morphTargets.js — v3-derived bucket centroid math for filter-pill
 * morph transitions.
 *
 * Spec: .omc/specs/deep-interview-v3-derived-morph-targets.md.
 * Canon: docs/NETWORK-AND-AFFINITY-SPEC.md §7.3 (Phase-1 — math swap only).
 *
 * Replaces the prior synthetic-pole bucket centroid (N buckets evenly
 * spaced on a circle of radius R at Y=0, from
 * `computeCategoricalWheelPositions`) with bucket centroids COMPUTED
 * from each member's v3 UMAP position. The morph still happens; the
 * spatial target now traces back to v3 chemistry, not a hand-tuned ring.
 *
 * Two compute regimes:
 *
 *   1. Member-mean (works for any axis with a hard `bucketOf` map):
 *      centroid = mean( v3_position[i] for i in byBucket[bucketLabel] )
 *
 *   2. GNN-weighted-mean (for axes where the GNN exposes a per-bucket
 *      probability — taste, aromas):
 *      centroid = Σ(v3_position[i] × P[i][bucket]) / Σ P[i][bucket]
 *                 for i where P[i][bucket] ≥ MIN_BUCKET_PROB
 *
 * Both regimes share the same synthetic-pole FALLBACK when a bucket has
 * < MIN_BUCKET_MEMBERS contributors — sparse buckets ('salty' under the
 * structural ceiling, 'odor_spicy' under sparse positives) get a fixed
 * pole at 0.65 × v3 bounding-sphere radius so the wheel still reads as
 * a wheel rather than collapsing the sparse bucket onto a single
 * accidental member.
 *
 * Phase 1 wires this in via `categoricalWheelPositions.js` keeping the
 * existing phyllotaxis member placement around each centroid; only the
 * centroid location moves from synthetic-ring to v3-derived.
 *
 * Phase 2 (deferred) will replace the legacy mode keys and per-axis
 * position file loaders; see the spec.
 */

// Tunable constants — kept as named exports so tests can pin against
// the canonical values (changing one of these is a visual contract
// shift, not a refactor).
export const MIN_BUCKET_PROB = 0.20;
export const MIN_BUCKET_MEMBERS = 5;
export const MIN_NODE_TOTAL_PROB = 0.10;

// Synthetic-pole fallback scale relative to the v3 bounding-sphere
// radius. 0.65 keeps poles inside the cloud envelope; raising it pushes
// sparse buckets toward the visual periphery of the cloud.
export const SYNTHETIC_POLE_RADIUS_RATIO = 0.65;

/**
 * Pure: bounding-sphere radius of a v3 position lookup.
 * Returns 0 for an empty input. Used to scale the synthetic-pole
 * fallback so it lives at the v3 spatial scale (not a hand-tuned
 * absolute like the old RING_RADIUS=90).
 *
 * @param {Map<string, [number, number, number]> | Record<string, [number, number, number]>} v3Positions
 * @returns {number}
 */
export function v3BoundingRadius(v3Positions) {
  const iter = v3Positions instanceof Map
    ? v3Positions.values()
    : Object.values(v3Positions || {});
  let maxR2 = 0;
  for (const p of iter) {
    if (!Array.isArray(p) || p.length < 3) continue;
    const r2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
    if (r2 > maxR2) maxR2 = r2;
  }
  return Math.sqrt(maxR2);
}

/**
 * Pure: synthetic pole position for a bucket index on a ring of
 * `radius` at Y=0. Bucket 0 sits at the top (-π/2); subsequent
 * buckets distribute evenly clockwise. Mirrors the layout the
 * legacy categoricalWheelPositions used so user-facing wheel
 * orientation is preserved when fallback fires.
 *
 * @param {number} bucketIdx  0..N-1
 * @param {number} N          total buckets on this axis
 * @param {number} radius     synthetic-pole ring radius (typically v3BoundingRadius × SYNTHETIC_POLE_RADIUS_RATIO)
 * @returns {[number, number, number]}
 */
export function syntheticPole(bucketIdx, N, radius) {
  if (N <= 0 || !Number.isFinite(radius) || radius <= 0) return [0, 0, 0];
  const angle = (2 * Math.PI * bucketIdx) / N - Math.PI / 2;
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}

/**
 * Pure: bucket centroid via simple member-mean over v3 positions.
 * Returns null when fewer than MIN_BUCKET_MEMBERS members have a v3
 * position — caller falls back to `syntheticPole`.
 *
 * @param {Iterable<string>} memberNames  bucket members (from byBucket map)
 * @param {Map<string, [number, number, number]> | Record<string, [number, number, number]>} v3Positions
 * @returns {[number, number, number] | null}
 */
export function memberMeanCentroid(memberNames, v3Positions) {
  const getPos = v3Positions instanceof Map
    ? (name) => v3Positions.get(name)
    : (name) => v3Positions?.[name];

  let sx = 0, sy = 0, sz = 0, n = 0;
  for (const name of memberNames) {
    const p = getPos(name);
    if (!Array.isArray(p) || p.length < 3) continue;
    sx += p[0]; sy += p[1]; sz += p[2];
    n++;
  }
  if (n < MIN_BUCKET_MEMBERS) return null;
  return [sx / n, sy / n, sz / n];
}

/**
 * Pure: bucket centroid via GNN-weighted mean over v3 positions.
 * For each node whose GNN probability for `probKey` is ≥ MIN_BUCKET_PROB,
 * contribute its v3 position weighted by the probability. Returns null
 * when fewer than MIN_BUCKET_MEMBERS qualifying contributors — caller
 * falls back to `syntheticPole`.
 *
 * @param {string} probKey  GNN entropy probs key (e.g., 'sweet', 'odor_fruity')
 * @param {Iterable<{ name: string, probs?: Record<string, number> | null }>} nodesWithProbs
 *        Pass the iterable of nodes whose probability for `probKey` should be
 *        considered. Each node must expose `name` and `probs` (or `gnnProbs`).
 * @param {Map<string, [number, number, number]> | Record<string, [number, number, number]>} v3Positions
 * @returns {[number, number, number] | null}
 */
export function gnnWeightedCentroid(probKey, nodesWithProbs, v3Positions) {
  if (!probKey) return null;
  const getPos = v3Positions instanceof Map
    ? (name) => v3Positions.get(name)
    : (name) => v3Positions?.[name];

  let sx = 0, sy = 0, sz = 0, totalWeight = 0, count = 0;
  for (const node of nodesWithProbs) {
    if (!node || !node.name) continue;
    const probs = node.probs || node.gnnProbs;
    if (!probs) continue;
    const w = probs[probKey];
    if (typeof w !== 'number' || w < MIN_BUCKET_PROB) continue;
    const p = getPos(node.name);
    if (!Array.isArray(p) || p.length < 3) continue;
    sx += p[0] * w;
    sy += p[1] * w;
    sz += p[2] * w;
    totalWeight += w;
    count++;
  }
  if (count < MIN_BUCKET_MEMBERS || totalWeight <= 0) return null;
  return [sx / totalWeight, sy / totalWeight, sz / totalWeight];
}

/**
 * Pure: resolve a bucket centroid for ONE bucket using the configured
 * strategy, with synthetic-pole fallback baked in.
 *
 * @param {object} opts
 * @param {string} opts.bucketLabel
 * @param {number} opts.bucketIdx     0..N-1 — used for synthetic-pole angle
 * @param {number} opts.bucketCount   total bucket count on the axis (N)
 * @param {string | null} [opts.probKey]  GNN prob key (e.g., 'sweet'); when set, GNN-weighted regime is used
 * @param {Iterable<string>} [opts.memberNames]  bucket members (used when probKey is null OR as a fallback when GNN regime falls through)
 * @param {Iterable<object>} [opts.nodesWithProbs]  required when probKey is set
 * @param {Map<string, [number, number, number]> | Record<string, [number, number, number]>} opts.v3Positions
 * @param {number} opts.fallbackRadius  synthetic-pole ring radius
 * @returns {[number, number, number]}
 */
export function resolveBucketCentroid(opts) {
  const {
    bucketLabel: _bucketLabel,
    bucketIdx,
    bucketCount,
    probKey,
    memberNames,
    nodesWithProbs,
    v3Positions,
    fallbackRadius,
  } = opts;

  if (probKey && nodesWithProbs) {
    const c = gnnWeightedCentroid(probKey, nodesWithProbs, v3Positions);
    if (c) return c;
  }
  if (memberNames) {
    const c = memberMeanCentroid(memberNames, v3Positions);
    if (c) return c;
  }
  return syntheticPole(bucketIdx, bucketCount, fallbackRadius);
}
