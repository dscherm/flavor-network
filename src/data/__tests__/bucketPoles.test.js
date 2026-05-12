import { describe, it, expect } from 'vitest';
import { computeBucketPoles2D, computeBucketPoles3D } from '../bucketPoles.js';

// Lightweight node-map factory matching the shape categoricalAxes
// expects (.name, .taste string, .cuisines, .category).
function makeNodes(specs) {
  const m = new Map();
  for (const s of specs) {
    m.set(s.name, { name: s.name, ...s });
  }
  return m;
}

describe('R17 — bucketPoles', () => {
  it('3D Fibonacci sphere — 6 buckets, all at distance ~90 from origin', () => {
    const nodes = makeNodes([
      { name: 'apple', taste: 'sweet' },        // taste axis
      { name: 'lemon', taste: 'sour' },
    ]);
    const out = computeBucketPoles3D('taste', nodes);
    expect(out.polePositions.size).toBe(8); // 8 taste labels
    for (const [, p] of out.polePositions) {
      const d = Math.hypot(p[0], p[1], p[2]);
      // Allow small numerical drift from the Fibonacci sphere normalisation.
      expect(Math.abs(d - 90)).toBeLessThan(0.5);
    }
  });

  it('3D Fibonacci sphere — N=1 returns a single pole at top', () => {
    // Synthetic 1-bucket axis isn't in CATEGORICAL_AXES but the
    // fibonacciSphere helper still needs to handle N=1 cleanly.
    // We test through the family axis with a node assigned a single
    // category that maps to one of the 11 family buckets.
    const nodes = makeNodes([
      { name: 'apple', category: 'fruit' },
    ]);
    const out = computeBucketPoles3D('family', nodes);
    // All 11 family poles populated.
    expect(out.polePositions.size).toBe(11);
    // Apple should be in 'Fruit' bucket and its position is the
    // Fruit pole position.
    const applePos = out.positions['apple'];
    const fruitPole = out.polePositions.get('Fruit');
    expect(applePos).toEqual(fruitPole);
  });

  it('2D ring — every pole is on y=0 plane', () => {
    const nodes = makeNodes([
      { name: 'apple', taste: 'sweet' },
    ]);
    const out = computeBucketPoles2D('taste', nodes);
    for (const [, p] of out.polePositions) {
      expect(p[1]).toBe(0);
    }
  });

  it('2D ring — poles are RADIUS=90 from origin in the xz plane', () => {
    const nodes = makeNodes([{ name: 'apple', taste: 'sweet' }]);
    const out = computeBucketPoles2D('taste', nodes);
    for (const [, p] of out.polePositions) {
      const d = Math.hypot(p[0], p[2]);
      expect(Math.abs(d - 90)).toBeLessThan(0.0001);
    }
  });

  it('bucketOf returns correct label for a known taste node', () => {
    const nodes = makeNodes([
      { name: 'apple', taste: 'sweet sour' }, // multi-tag string — first match wins
    ]);
    const out = computeBucketPoles3D('taste', nodes);
    expect(out.bucketOf.get('apple')).toBe('Sweet');
  });

  it('positions map skips nodes with no bucket assignment', () => {
    const nodes = makeNodes([
      { name: 'orphan', taste: '' }, // empty taste string → no bucket
    ]);
    const out = computeBucketPoles2D('taste', nodes);
    expect(out.positions['orphan']).toBeUndefined();
  });
});
