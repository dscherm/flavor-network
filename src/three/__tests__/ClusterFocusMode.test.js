/**
 * Unit tests for the pure functions in ClusterFocusMode.
 * Spec: docs/NETWORK-AND-AFFINITY-SPEC.md §5.6.
 *
 * The class itself is exercised via Three.js InstancedMesh which is
 * difficult to test headlessly without a WebGL context. These tests
 * cover the math primitives — centroid, nearest-neighbor distance,
 * adaptive spread factor, post-spread bounding radius — which are the
 * load-bearing parts of the engage step.
 */
import { describe, it, expect } from 'vitest';
import {
  computeCentroid,
  minNearestNeighborDistance,
  computeSpreadFactor,
  computeSpreadRadius,
  selectIntraClusterEdges,
  SPREAD_MIN_RADIUS_MULT,
  MAX_SPREAD_FACTOR,
  TIER_COLOR,
  TIER_OPACITY,
} from '../ClusterFocusMode.js';

describe('ClusterFocusMode.computeCentroid', () => {
  it('returns [0,0,0] for empty input', () => {
    expect(computeCentroid([])).toEqual([0, 0, 0]);
    expect(computeCentroid(null)).toEqual([0, 0, 0]);
  });

  it('returns the single position for a single-element input', () => {
    expect(computeCentroid([[1, 2, 3]])).toEqual([1, 2, 3]);
  });

  it('averages multiple positions component-wise', () => {
    const c = computeCentroid([
      [0, 0, 0],
      [6, 0, 0],
      [0, 6, 0],
      [0, 0, 6],
    ]);
    expect(c[0]).toBeCloseTo(1.5, 5);
    expect(c[1]).toBeCloseTo(1.5, 5);
    expect(c[2]).toBeCloseTo(1.5, 5);
  });
});

describe('ClusterFocusMode.minNearestNeighborDistance', () => {
  it('returns Infinity for < 2 positions', () => {
    expect(minNearestNeighborDistance([])).toBe(Infinity);
    expect(minNearestNeighborDistance([[0, 0, 0]])).toBe(Infinity);
  });

  it('returns the distance between two distinct positions', () => {
    const d = minNearestNeighborDistance([[0, 0, 0], [3, 0, 0]]);
    expect(d).toBeCloseTo(3, 5);
  });

  it('finds the minimum nearest-neighbor distance across many positions', () => {
    const positions = [
      [0, 0, 0],
      [10, 0, 0],
      [10, 0.5, 0], // closest pair: (10,0,0) ↔ (10,0.5,0) → 0.5
      [20, 0, 0],
    ];
    const d = minNearestNeighborDistance(positions);
    expect(d).toBeCloseTo(0.5, 5);
  });

  it('skips exact-coincident pairs so co-located aliases do not zero the floor', () => {
    // (0,0,0) and (0,0,0) are coincident (alias on canonical), (5,0,0)
    // is the real nearest non-coincident neighbor.
    const d = minNearestNeighborDistance([[0, 0, 0], [0, 0, 0], [5, 0, 0]]);
    expect(d).toBeCloseTo(5, 5);
  });
});

describe('ClusterFocusMode.computeSpreadFactor', () => {
  it('returns 1.0 when nodes are already well-spaced', () => {
    // 2 nodes at distance 10 — far above target 3.0, no expansion needed.
    const f = computeSpreadFactor([[0, 0, 0], [10, 0, 0]]);
    expect(f).toBe(1.0);
  });

  it('expands tightly-packed clusters toward the target min spacing, capped at MAX_SPREAD_FACTOR', () => {
    // 2 nodes 0.5u apart — raw factor would be 6.0, but the cap
    // (set to 5.0 for post-compaction viewport safety) clips it.
    const f = computeSpreadFactor([[0, 0, 0], [0.5, 0, 0]]);
    expect(f).toBeCloseTo(MAX_SPREAD_FACTOR, 5);
  });

  it('caps the factor at MAX_SPREAD_FACTOR for nearly-singular post-compaction clusters', () => {
    // 2 nodes 0.05u apart — raw factor would be 60. Cap clips to 5.
    const f = computeSpreadFactor([[0, 0, 0], [0.05, 0, 0]]);
    expect(f).toBe(MAX_SPREAD_FACTOR);
  });

  it('uses the configured target min spacing multiplier', () => {
    // Sanity: factor for 1u-apart pair should match SPREAD_MIN_RADIUS_MULT × 2.
    const f = computeSpreadFactor([[0, 0, 0], [1, 0, 0]]);
    expect(f).toBeCloseTo(SPREAD_MIN_RADIUS_MULT * 2, 5);
  });

  it('returns 1.0 when current min spacing is zero or non-finite', () => {
    expect(computeSpreadFactor([[0, 0, 0]])).toBe(1.0); // Infinity → max(1, target/Inf) = 1
    expect(computeSpreadFactor([])).toBe(1.0);
  });
});

describe('ClusterFocusMode.computeSpreadRadius', () => {
  it('returns 0 for a centroid-only cluster', () => {
    expect(computeSpreadRadius([[0, 0, 0]], [0, 0, 0], 4.0)).toBe(0);
  });

  it('scales the maximum centroid-distance by the spread factor', () => {
    const positions = [[0, 0, 0], [3, 0, 0], [0, 4, 0]];
    const centroid = computeCentroid(positions);
    const factor = 2.0;
    // Furthest pre-spread member is at distance sqrt(3^2 + ... ) from
    // centroid; the function returns max(distance × factor). Compute
    // explicitly: centroid is [1, 4/3, 0] ≈ [1, 1.33, 0]; furthest
    // node before spread is [0, 4, 0] → dist ≈ sqrt(1 + 7.11) ≈ 2.85.
    // Post-spread radius ≈ 5.70.
    const r = computeSpreadRadius(positions, centroid, factor);
    const expected = Math.sqrt((0 - 1) ** 2 + (4 - 4 / 3) ** 2) * factor;
    expect(r).toBeCloseTo(expected, 5);
  });
});

describe('ClusterFocusMode.SPREAD_MIN_RADIUS_MULT', () => {
  it('is locked at the canonical spec value 1.5', () => {
    // The acceptance criterion in NETWORK-AND-AFFINITY-SPEC.md §5.6.6
    // gates on min nearest-neighbor distance ≥ 1.5 × node diameter.
    // Changing this constant changes the visual contract — the test
    // is a tripwire, not a unit assertion.
    expect(SPREAD_MIN_RADIUS_MULT).toBe(1.5);
  });
});

describe('ClusterFocusMode.MAX_SPREAD_FACTOR', () => {
  it('is locked at 5.0 to keep post-compaction clusters in viewport', () => {
    // Without the cap, post-compaction min_spacing (~0.1u) under the
    // pure target/current formula produces factor ≈ 30 and hurls
    // members to radius 500+ (past camera frustum). 5× is the
    // empirically-derived ceiling.
    expect(MAX_SPREAD_FACTOR).toBe(5.0);
  });
});

describe('ClusterFocusMode.TIER_COLOR / TIER_OPACITY', () => {
  it('matches canon §4.3 hex values', () => {
    expect(TIER_COLOR[3].getHex()).toBe(0xfacc15);
    expect(TIER_COLOR[2].getHex()).toBe(0xa3a3a3);
    expect(TIER_COLOR[1].getHex()).toBe(0xa16207);
    expect(TIER_COLOR[0].getHex()).toBe(0xe879f9);
  });
  it('matches canon §4.3 opacities', () => {
    expect(TIER_OPACITY[3]).toBe(0.9);
    expect(TIER_OPACITY[2]).toBe(0.7);
    expect(TIER_OPACITY[1]).toBe(0.5);
    expect(TIER_OPACITY[0]).toBe(0.55);
  });
});

describe('ClusterFocusMode.selectIntraClusterEdges', () => {
  // Test fixture: 5 nodes split 3 into cluster 7 and 2 into cluster 8.
  // 4 edges total: 2 intra-cluster-7, 1 intra-cluster-8, 1 cross-cluster.
  const nodeArray = [
    { name: 'alpha',   clusterId: 7 },
    { name: 'bravo',   clusterId: 7 },
    { name: 'charlie', clusterId: 7 },
    { name: 'delta',   clusterId: 8 },
    { name: 'echo',    clusterId: 8 },
  ];
  const nameToIdx = new Map(nodeArray.map((n, i) => [n.name, i]));
  const graphEdges = [
    { source: 'alpha',   target: 'bravo',   strength: 0.9 }, // intra 7 — strong
    { source: 'bravo',   target: 'charlie', strength: 0.6 }, // intra 7 — good
    { source: 'delta',   target: 'echo',    strength: 0.4 }, // intra 8 — untiered
    { source: 'alpha',   target: 'delta',   strength: 0.95 },// cross — must drop
  ];
  const ctx = {
    pairingStrength: new Map([
      ['alpha|bravo',   0.9],
      ['bravo|charlie', 0.6],
      ['delta|echo',    0.4],
      ['alpha|delta',   0.95],
    ]),
    top5: new Map(), // empty → lenient branch
    bridgeCompoundIndex: new Map(),
    affinityThresholds: { star3: 0.85, star2: 0.55, star1: 0.5 },
  };

  it('returns only intra-cluster edges (cross-cluster dropped)', () => {
    const out = selectIntraClusterEdges(graphEdges, nodeArray, 7, nameToIdx, ctx);
    const pairs = out.map((e) => `${nodeArray[e.srcIdx].name}|${nodeArray[e.tgtIdx].name}`).sort();
    expect(pairs).toEqual(['alpha|bravo', 'bravo|charlie']);
  });

  it('drops edges whose tier is null (strength below star1)', () => {
    const out = selectIntraClusterEdges(graphEdges, nodeArray, 8, nameToIdx, ctx);
    expect(out).toEqual([]);
  });

  it('resolves the native tier on each surviving edge', () => {
    const out = selectIntraClusterEdges(graphEdges, nodeArray, 7, nameToIdx, ctx);
    const byPair = new Map(out.map((e) => [
      `${nodeArray[e.srcIdx].name}|${nodeArray[e.tgtIdx].name}`,
      e.tier,
    ]));
    expect(byPair.get('alpha|bravo')).toBe(3);   // strength 0.9 ≥ star3 (0.85)
    expect(byPair.get('bravo|charlie')).toBe(2); // strength 0.6 ≥ star2 (0.55)
  });

  it('returns [] when inputs are missing', () => {
    expect(selectIntraClusterEdges(null, nodeArray, 7, nameToIdx, ctx)).toEqual([]);
    expect(selectIntraClusterEdges([], nodeArray, 7, nameToIdx, ctx)).toEqual([]);
    expect(selectIntraClusterEdges(graphEdges, null, 7, nameToIdx, ctx)).toEqual([]);
    expect(selectIntraClusterEdges(graphEdges, nodeArray, 7, null, ctx)).toEqual([]);
    expect(selectIntraClusterEdges(graphEdges, nodeArray, 7, nameToIdx, null)).toEqual([]);
  });

  it('skips edges whose endpoints are not in nodeArray', () => {
    const edges = [
      { source: 'alpha', target: 'bravo', strength: 0.9 },
      { source: 'ghost', target: 'bravo', strength: 0.9 },
      { source: 'alpha', target: 'ghost', strength: 0.9 },
    ];
    const out = selectIntraClusterEdges(edges, nodeArray, 7, nameToIdx, ctx);
    expect(out).toHaveLength(1);
    expect(nodeArray[out[0].srcIdx].name).toBe('alpha');
    expect(nodeArray[out[0].tgtIdx].name).toBe('bravo');
  });
});
