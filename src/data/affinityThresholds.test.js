import { describe, it, expect } from 'vitest';
import { computeAffinityThresholds } from './affinityThresholds.js';

function uniformEdges(n, fn = (i) => i / (n - 1)) {
  return Array.from({ length: n }, (_, i) => ({ strength: fn(i) }));
}

describe('computeAffinityThresholds', () => {
  it('returns fallback for null / undefined / non-array', () => {
    expect(computeAffinityThresholds(null)).toEqual({ star3: 0.99, star2: 0.95, star1: 0.85 });
    expect(computeAffinityThresholds(undefined)).toEqual({ star3: 0.99, star2: 0.95, star1: 0.85 });
    expect(computeAffinityThresholds('not an array')).toEqual({ star3: 0.99, star2: 0.95, star1: 0.85 });
  });

  it('returns fallback for empty edges', () => {
    expect(computeAffinityThresholds([])).toEqual({ star3: 0.99, star2: 0.95, star1: 0.85 });
  });

  it('returns fallback when fewer than 100 edges (noise floor)', () => {
    const edges = uniformEdges(50);
    expect(computeAffinityThresholds(edges)).toEqual({ star3: 0.99, star2: 0.95, star1: 0.85 });
  });

  it('returns fallback when strengths are all non-numeric', () => {
    const edges = Array.from({ length: 200 }, () => ({ strength: 'bad' }));
    expect(computeAffinityThresholds(edges)).toEqual({ star3: 0.99, star2: 0.95, star1: 0.85 });
  });

  it('computes quantile thresholds on a uniform distribution', () => {
    // 1001 edges, strengths 0.000 to 1.000 in equal steps.
    const edges = uniformEdges(1001);
    const t = computeAffinityThresholds(edges);
    // After sort descending: index k has strength (1000-k)/1000.
    // top 1% = index 10 → 0.990
    // top 10% = index 100 → 0.900
    // top 50% = index 500 → 0.500
    expect(t.star3).toBeCloseTo(0.990, 3);
    expect(t.star2).toBeCloseTo(0.900, 3);
    expect(t.star1).toBeCloseTo(0.500, 3);
  });

  it('preserves strict descending order for collapsed distributions', () => {
    // All strengths identical — quantiles collapse onto same value.
    const edges = Array.from({ length: 500 }, () => ({ strength: 0.5 }));
    const t = computeAffinityThresholds(edges);
    expect(t.star3).toBeGreaterThan(t.star2);
    expect(t.star2).toBeGreaterThan(t.star1);
  });

  it('skips invalid strength entries when computing quantiles', () => {
    // Mix valid + invalid; only valid should contribute.
    const valid = uniformEdges(200);
    const invalid = Array.from({ length: 200 }, () => ({ strength: NaN }));
    const t = computeAffinityThresholds([...valid, ...invalid]);
    // 200 valid edges only; quantile thresholds computed on those.
    expect(t.star3).toBeGreaterThan(0.9);
    expect(t.star1).toBeCloseTo(0.5, 1);
  });

  it('matches the deployed pairings.json shape (smoke test)', () => {
    // 1000 edges with strength uniformly in [0.05, 1.0] — analogous to
    // the deployed dataset where 99% of pairs sit above 0.1.
    const edges = uniformEdges(1000, (i) => 0.05 + 0.95 * (i / 999));
    const t = computeAffinityThresholds(edges);
    expect(t.star3).toBeGreaterThan(t.star2);
    expect(t.star2).toBeGreaterThan(t.star1);
    expect(t.star1).toBeGreaterThan(0.4);
  });
});
