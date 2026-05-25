/**
 * Unit tests for morphTargets.js — v3-derived bucket centroid math.
 * Spec: .omc/specs/deep-interview-v3-derived-morph-targets.md.
 */
import { describe, it, expect } from 'vitest';
import {
  v3BoundingRadius,
  syntheticPole,
  memberMeanCentroid,
  gnnWeightedCentroid,
  resolveBucketCentroid,
  MIN_BUCKET_PROB,
  MIN_BUCKET_MEMBERS,
  MIN_NODE_TOTAL_PROB,
  SYNTHETIC_POLE_RADIUS_RATIO,
} from '../morphTargets.js';

describe('morphTargets.v3BoundingRadius', () => {
  it('returns 0 for empty input', () => {
    expect(v3BoundingRadius({})).toBe(0);
    expect(v3BoundingRadius(new Map())).toBe(0);
    expect(v3BoundingRadius(null)).toBe(0);
  });

  it('returns the distance of the furthest position from origin', () => {
    const positions = {
      a: [3, 0, 4],   // r = 5
      b: [0, 12, 0],  // r = 12
      c: [1, 1, 1],   // r ~ 1.73
    };
    expect(v3BoundingRadius(positions)).toBeCloseTo(12, 5);
  });

  it('accepts both plain objects and Maps', () => {
    const obj = { x: [0, 4, 3] };  // r = 5
    const map = new Map([['x', [0, 4, 3]]]);
    expect(v3BoundingRadius(obj)).toBeCloseTo(5, 5);
    expect(v3BoundingRadius(map)).toBeCloseTo(5, 5);
  });

  it('ignores malformed entries', () => {
    const positions = {
      a: [3, 4, 0],
      b: null,
      c: 'oops',
      d: [1],          // too short
    };
    expect(v3BoundingRadius(positions)).toBeCloseTo(5, 5);
  });
});

describe('morphTargets.syntheticPole', () => {
  it('returns [0, 0, 0] for degenerate inputs', () => {
    expect(syntheticPole(0, 0, 50)).toEqual([0, 0, 0]);
    expect(syntheticPole(0, 4, 0)).toEqual([0, 0, 0]);
    expect(syntheticPole(0, 4, NaN)).toEqual([0, 0, 0]);
  });

  it('places bucket 0 at the top of the ring (y=0, x=0, z=-radius)', () => {
    // angle = -π/2 → cos = 0, sin = -1; pole at (0, 0, -radius)
    const [x, y, z] = syntheticPole(0, 4, 10);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(-10, 5);
  });

  it('distributes 4 buckets evenly clockwise at angles -π/2, 0, π/2, π', () => {
    const radius = 10;
    const N = 4;
    const poles = [0, 1, 2, 3].map((i) => syntheticPole(i, N, radius));
    // Bucket 1: angle = -π/2 + π/2 = 0 → (radius, 0, 0)
    expect(poles[1][0]).toBeCloseTo(radius, 5);
    expect(poles[1][2]).toBeCloseTo(0, 5);
    // Bucket 2: angle = π/2 → (0, 0, radius)
    expect(poles[2][0]).toBeCloseTo(0, 5);
    expect(poles[2][2]).toBeCloseTo(radius, 5);
    // Bucket 3: angle = π → (-radius, 0, 0)
    expect(poles[3][0]).toBeCloseTo(-radius, 5);
    expect(poles[3][2]).toBeCloseTo(0, 5);
  });

  it('always sets y to 0 (flat ring)', () => {
    for (let i = 0; i < 8; i++) {
      expect(syntheticPole(i, 8, 50)[1]).toBe(0);
    }
  });
});

describe('morphTargets.memberMeanCentroid', () => {
  it('returns null when fewer than MIN_BUCKET_MEMBERS members have positions', () => {
    const positions = { a: [0, 0, 0], b: [1, 0, 0] };
    expect(memberMeanCentroid(['a', 'b'], positions)).toBeNull();
  });

  it('returns the mean of member positions when ≥ MIN_BUCKET_MEMBERS', () => {
    const positions = {
      a: [0, 0, 0],
      b: [10, 0, 0],
      c: [0, 10, 0],
      d: [0, 0, 10],
      e: [10, 10, 10],
    };
    const c = memberMeanCentroid(['a', 'b', 'c', 'd', 'e'], positions);
    expect(c[0]).toBeCloseTo(4, 5);
    expect(c[1]).toBeCloseTo(4, 5);
    expect(c[2]).toBeCloseTo(4, 5);
  });

  it('skips members with no v3 position (does not crash on missing entries)', () => {
    const positions = {
      a: [0, 0, 0],
      b: [10, 0, 0],
      c: [0, 10, 0],
      d: [0, 0, 10],
      e: [10, 10, 10],
    };
    // Add a missing member 'ghost' — should be skipped without affecting result
    const c = memberMeanCentroid(['a', 'b', 'c', 'd', 'e', 'ghost'], positions);
    expect(c[0]).toBeCloseTo(4, 5);
  });

  it('accepts Map<name, position> as well as object', () => {
    const positions = new Map([
      ['a', [0, 0, 0]],
      ['b', [10, 0, 0]],
      ['c', [0, 10, 0]],
      ['d', [0, 0, 10]],
      ['e', [10, 10, 10]],
    ]);
    const c = memberMeanCentroid(['a', 'b', 'c', 'd', 'e'], positions);
    expect(c[0]).toBeCloseTo(4, 5);
  });
});

describe('morphTargets.gnnWeightedCentroid', () => {
  const positions = {
    lemon: [10, 0, 0],
    rhubarb: [12, 0, 0],
    tomato: [3, 0, 0],
    banana: [0, 0, 10],
    apple: [0, 0, 8],
    butter: [-10, 0, 0],
  };

  it('returns null when no probKey is given', () => {
    expect(gnnWeightedCentroid(null, [], positions)).toBeNull();
  });

  it('returns null when fewer than MIN_BUCKET_MEMBERS qualify above MIN_BUCKET_PROB', () => {
    const nodes = [
      { name: 'lemon', probs: { sour: 0.9 } },
      { name: 'rhubarb', probs: { sour: 0.7 } },
      { name: 'tomato', probs: { sour: 0.3 } },
      // Only 3 qualify above 0.20; MIN_BUCKET_MEMBERS = 5
    ];
    expect(gnnWeightedCentroid('sour', nodes, positions)).toBeNull();
  });

  it('returns probability-weighted mean over v3 positions when ≥ MIN_BUCKET_MEMBERS qualify', () => {
    const nodes = [
      { name: 'lemon', probs: { sour: 1.0 } },       // weight 1.0, pos [10,0,0]
      { name: 'rhubarb', probs: { sour: 1.0 } },     // weight 1.0, pos [12,0,0]
      { name: 'tomato', probs: { sour: 1.0 } },      // weight 1.0, pos [3,0,0]
      { name: 'banana', probs: { sour: 1.0 } },      // weight 1.0, pos [0,0,10]
      { name: 'apple', probs: { sour: 1.0 } },       // weight 1.0, pos [0,0,8]
    ];
    const c = gnnWeightedCentroid('sour', nodes, positions);
    // Equal weights → simple mean: x = (10+12+3+0+0)/5 = 5, z = (0+0+0+10+8)/5 = 3.6
    expect(c[0]).toBeCloseTo(5, 5);
    expect(c[2]).toBeCloseTo(3.6, 5);
  });

  it('weights high-prob members more than low-prob members', () => {
    const nodes = [
      { name: 'lemon', probs: { sour: 1.0 } },       // weight 1.0
      { name: 'rhubarb', probs: { sour: 1.0 } },     // weight 1.0
      { name: 'tomato', probs: { sour: 1.0 } },      // weight 1.0
      { name: 'banana', probs: { sour: 0.21 } },     // weight 0.21
      { name: 'apple', probs: { sour: 0.21 } },      // weight 0.21
    ];
    const c = gnnWeightedCentroid('sour', nodes, positions);
    // Lemon+rhubarb+tomato dominate (3.0 of 3.42 total weight).
    // Centroid pulls toward their x positions (10,12,3 mean=8.33) more than banana/apple.
    expect(c[0]).toBeGreaterThan(6);
  });

  it('drops members with no v3 position', () => {
    const nodes = [
      { name: 'lemon', probs: { sour: 1.0 } },
      { name: 'rhubarb', probs: { sour: 1.0 } },
      { name: 'tomato', probs: { sour: 1.0 } },
      { name: 'banana', probs: { sour: 1.0 } },
      { name: 'apple', probs: { sour: 1.0 } },
      { name: 'ghost', probs: { sour: 1.0 } },       // no position → dropped
    ];
    const c = gnnWeightedCentroid('sour', nodes, positions);
    expect(c[0]).toBeCloseTo(5, 5);
  });

  it('accepts node.gnnProbs as well as node.probs', () => {
    const nodes = [
      { name: 'lemon', gnnProbs: { sour: 1.0 } },
      { name: 'rhubarb', gnnProbs: { sour: 1.0 } },
      { name: 'tomato', gnnProbs: { sour: 1.0 } },
      { name: 'banana', gnnProbs: { sour: 1.0 } },
      { name: 'apple', gnnProbs: { sour: 1.0 } },
    ];
    const c = gnnWeightedCentroid('sour', nodes, positions);
    expect(c).not.toBeNull();
    expect(c[0]).toBeCloseTo(5, 5);
  });
});

describe('morphTargets.resolveBucketCentroid', () => {
  const v3Positions = {
    a: [10, 0, 0], b: [10, 0, 0], c: [10, 0, 0],
    d: [10, 0, 0], e: [10, 0, 0], f: [10, 0, 0],
  };

  it('falls back to synthetic pole when no centroid math succeeds', () => {
    const fallbackRadius = 50;
    const c = resolveBucketCentroid({
      bucketLabel: 'salty',
      bucketIdx: 0,
      bucketCount: 4,
      probKey: 'salty',
      nodesWithProbs: [],            // empty — GNN regime fails
      memberNames: [],               // empty — member-mean regime fails
      v3Positions,
      fallbackRadius,
    });
    // Bucket 0 of 4 at radius 50 → top of ring → [0, 0, -50]
    expect(c[0]).toBeCloseTo(0, 5);
    expect(c[1]).toBe(0);
    expect(c[2]).toBeCloseTo(-fallbackRadius, 5);
  });

  it('prefers GNN-weighted when probKey + nodesWithProbs are provided AND succeed', () => {
    const nodes = [
      { name: 'a', probs: { sour: 1.0 } },
      { name: 'b', probs: { sour: 1.0 } },
      { name: 'c', probs: { sour: 1.0 } },
      { name: 'd', probs: { sour: 1.0 } },
      { name: 'e', probs: { sour: 1.0 } },
    ];
    const c = resolveBucketCentroid({
      bucketLabel: 'sour',
      bucketIdx: 1,
      bucketCount: 4,
      probKey: 'sour',
      nodesWithProbs: nodes,
      memberNames: ['a', 'b', 'c', 'd', 'e'],
      v3Positions,
      fallbackRadius: 50,
    });
    expect(c[0]).toBeCloseTo(10, 5);  // not the synthetic-pole fallback
  });

  it('falls back to member-mean when GNN regime fails but member-mean succeeds', () => {
    const c = resolveBucketCentroid({
      bucketLabel: 'cuisine-european',
      bucketIdx: 1,
      bucketCount: 8,
      probKey: null,            // no GNN regime for cuisine
      memberNames: ['a', 'b', 'c', 'd', 'e'],
      v3Positions,
      fallbackRadius: 50,
    });
    expect(c[0]).toBeCloseTo(10, 5);
  });
});

describe('morphTargets — locked constants (visual contract tripwires)', () => {
  it('MIN_BUCKET_PROB is 0.20', () => {
    expect(MIN_BUCKET_PROB).toBe(0.20);
  });
  it('MIN_BUCKET_MEMBERS is 5', () => {
    expect(MIN_BUCKET_MEMBERS).toBe(5);
  });
  it('MIN_NODE_TOTAL_PROB is 0.10', () => {
    expect(MIN_NODE_TOTAL_PROB).toBe(0.10);
  });
  it('SYNTHETIC_POLE_RADIUS_RATIO is 0.65', () => {
    expect(SYNTHETIC_POLE_RADIUS_RATIO).toBe(0.65);
  });
});
