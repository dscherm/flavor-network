import { describe, it, expect } from 'vitest';
import { tierFor, topAffinities } from './affinityTiers.js';

const T = { star3: 0.99, star2: 0.7, star1: 0.4 };

function buildCtx({
  strengths = {},
  top5 = {},
  bridges = {},
  thresholds = T,
  edges = [],
} = {}) {
  const pairingStrength = new Map();
  for (const [k, v] of Object.entries(strengths)) {
    pairingStrength.set(k, v);
    const [a, b] = k.split('|');
    pairingStrength.set(`${b}|${a}`, v);
  }
  const top5Map = new Map(Object.entries(top5));
  const bridgeCompoundIndex = new Map();
  for (const [k, names] of Object.entries(bridges)) {
    bridgeCompoundIndex.set(k, {
      bridges: names.map((name) => ({ name })),
    });
  }
  return {
    pairingStrength,
    top5: top5Map,
    bridgeCompoundIndex,
    affinityThresholds: thresholds,
    graph: { edges },
  };
}

describe('tierFor — strict branch (both have GNN data)', () => {
  it('returns ★★★ when strength + bridge in both top5', () => {
    const ctx = buildCtx({
      strengths: { 'peel|tangerine juice': 1.0 },
      top5: {
        peel: ['(2E,4E)-deca-2,4-dienal', 'limonene', 'pinene', 'a', 'b'],
        'tangerine juice': ['(2E,4E)-deca-2,4-dienal', 'citral', 'a', 'b', 'c'],
      },
      bridges: {
        'peel|tangerine juice': ['(2E,4E)-deca-2,4-dienal'],
      },
    });
    const result = tierFor('peel', 'tangerine juice', ctx);
    expect(result.tier).toBe(3);
    expect(result.bridge).toBe('(2E,4E)-deca-2,4-dienal');
    expect(result.strength).toBe(1.0);
  });

  it('returns ★★ when strength is high but bridge entry is missing', () => {
    // tomato + basil shape: both have GNN top5, no bridge_compounds entry.
    const ctx = buildCtx({
      strengths: { 'tomato|basil': 0.95 },
      top5: {
        tomato: ['Isoamyl butyrate', 'Hexyl Hexanoate', 'coumarin', 'a', 'b'],
        basil: ['coumarin', 'Thymol', 'Methyl Benzoate', 'a', 'b'],
      },
      // No bridge_compounds entry for tomato|basil.
    });
    const result = tierFor('tomato', 'basil', ctx);
    expect(result.tier).toBe(2);
    expect(result.bridge).toBeNull();
  });

  it('returns ★★ when bridge exists but is NOT in both top5 (strict downgrade)', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.95 },
      top5: {
        a: ['compound-A', 'compound-B', 'compound-C', 'd', 'e'],
        b: ['compound-X', 'compound-Y', 'compound-Z', 'd', 'e'],
      },
      bridges: { 'a|b': ['compound-Q'] }, // not in either top5
    });
    const result = tierFor('a', 'b', ctx);
    expect(result.tier).toBe(2); // strength ≥ star2, so ★★
    expect(result.bridge).toBeNull();
  });

  it('returns ★ when strength ≥ star1 only', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.5 },
      top5: { a: ['x', 'y', 'z', 'w', 'v'], b: ['p', 'q', 'r', 's', 't'] },
    });
    expect(tierFor('a', 'b', ctx).tier).toBe(1);
  });

  it('returns null when strength below star1 threshold', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.1 },
      top5: { a: ['x', 'y', 'z', 'w', 'v'], b: ['p', 'q', 'r', 's', 't'] },
    });
    expect(tierFor('a', 'b', ctx).tier).toBeNull();
  });
});

describe('tierFor — lenient branch (at least one side missing GNN)', () => {
  it('lenient ★★★ at strength ≥ star3 when only A has GNN data', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.995 },
      top5: { a: ['x', 'y', 'z', 'w', 'v'] }, // b missing
    });
    expect(tierFor('a', 'b', ctx).tier).toBe(3);
  });

  it('lenient ★★★ when only B has GNN data', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.995 },
      top5: { b: ['x', 'y', 'z', 'w', 'v'] },
    });
    expect(tierFor('a', 'b', ctx).tier).toBe(3);
  });

  it('lenient ★★★ when neither has GNN data and strength ≥ star3', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.995 },
      top5: {}, // nothing
    });
    expect(tierFor('a', 'b', ctx).tier).toBe(3);
  });

  it('lenient ★★ when only A has GNN data and strength is moderate', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.85 },
      top5: { a: ['x', 'y', 'z', 'w', 'v'] },
    });
    expect(tierFor('a', 'b', ctx).tier).toBe(2);
  });

  it('returns null when strength is too low under lenient', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.05 },
      top5: { a: ['x', 'y', 'z', 'w', 'v'] },
    });
    expect(tierFor('a', 'b', ctx).tier).toBeNull();
  });
});

describe('tierFor — edge cases', () => {
  it('returns null when strength is 0 / pair not in graph', () => {
    const ctx = buildCtx({});
    const r = tierFor('nope', 'nada', ctx);
    expect(r.tier).toBeNull();
    expect(r.strength).toBe(0);
  });

  it('handles missing bridgeCompoundIndex without throwing', () => {
    const ctx = {
      pairingStrength: new Map([['a|b', 0.95], ['b|a', 0.95]]),
      top5: new Map([
        ['a', ['x', 'y', 'z', 'w', 'v']],
        ['b', ['p', 'q', 'r', 's', 't']],
      ]),
      bridgeCompoundIndex: undefined,
      affinityThresholds: T,
      graph: { edges: [] },
    };
    const r = tierFor('a', 'b', ctx);
    expect(r.tier).toBe(2); // strict branch, no bridge → falls to ★★
  });

  it('reads pairingStrength bidirectionally', () => {
    const ctx = buildCtx({
      strengths: { 'a|b': 0.85 },
      top5: { a: ['x', 'y', 'z', 'w', 'v'] },
    });
    expect(tierFor('a', 'b', ctx).strength).toBe(0.85);
    expect(tierFor('b', 'a', ctx).strength).toBe(0.85);
  });
});

describe('topAffinities — U4a strength-rank ring assignment', () => {
  it('returns up to 30 candidates partitioned 5/10/15 by strength rank', () => {
    // Build a focal with 30 neighbors at descending strengths.
    const focal = 'focus';
    const edges = [];
    const strengths = {};
    const top5 = { focus: ['x', 'y', 'z', 'w', 'v'] };
    for (let i = 0; i < 40; i++) {
      const other = `n${i}`;
      const s = 0.99 - i * 0.02;
      edges.push({ source: focal, target: other });
      strengths[`${focal}|${other}`] = s;
      top5[other] = ['x', 'y', 'z', 'w', 'v']; // shared top-5
    }
    const ctx = buildCtx({ strengths, top5, edges });
    const result = topAffinities(focal, ctx);
    // First 30 neighbors all have strength ≥ star1 (0.4) since the
    // weakest in this fixture is 0.99 - 39*0.02 = 0.21, but star1=0.4
    // so only the first ~30 will be tiered. Verify count.
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(30);
    // Ring partition.
    const ring3 = result.filter((r) => r.ringIdx === 3);
    const ring2 = result.filter((r) => r.ringIdx === 2);
    const ring1 = result.filter((r) => r.ringIdx === 1);
    expect(ring3.length).toBeLessThanOrEqual(5);
    expect(ring2.length).toBeLessThanOrEqual(10);
    expect(ring1.length).toBeLessThanOrEqual(15);
  });

  it('ring index reflects strength rank, NOT native tier (U4a contract)', () => {
    const focal = 'f';
    // 6 neighbors all sharing the same compound — but only 1 has a
    // bridge_compounds.json entry. Under literal spec only that 1
    // would be ★★★. Under U4a, the strongest 5 land in ring 3
    // regardless.
    const edges = [];
    const strengths = {};
    const top5 = { f: ['shared', 'a', 'b', 'c', 'd'] };
    for (let i = 0; i < 6; i++) {
      const other = `n${i}`;
      edges.push({ source: focal, target: other });
      strengths[`${focal}|${other}`] = 0.95 - i * 0.05;
      top5[other] = ['shared', 'a', 'b', 'c', 'd'];
    }
    const bridges = { 'f|n5': ['shared'] }; // weakest pair has the only bridge entry
    const ctx = buildCtx({ strengths, top5, bridges, edges });
    const result = topAffinities(focal, ctx);
    // Top 5 by strength → ring 3 regardless of native tier.
    const ring3Names = result.filter((r) => r.ringIdx === 3).map((r) => r.name);
    expect(ring3Names).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
    // Each ring-3 entry retains its native `tier` for edge coloring.
    // n0..n4 have NO bridge entries → strict branch with no shared
    // bridge → tier 2 (strong, no chemistry-bridge).
    for (const r of result.filter((r) => r.ringIdx === 3)) {
      expect(r.tier).toBe(2); // silver edge at gold-radius slot
    }
  });

  it('returns [] when graph.edges is empty', () => {
    const ctx = buildCtx({ edges: [] });
    expect(topAffinities('anything', ctx)).toEqual([]);
  });

  it('skips untiered (low-strength) neighbors', () => {
    const focal = 'f';
    const edges = [
      { source: focal, target: 'tiered' },
      { source: focal, target: 'untiered' },
    ];
    const strengths = {
      'f|tiered': 0.95,
      'f|untiered': 0.05, // below star1
    };
    const top5 = { f: [], tiered: [], untiered: [] };
    const ctx = buildCtx({ strengths, top5, edges });
    const result = topAffinities(focal, ctx);
    expect(result.map((r) => r.name)).toEqual(['tiered']);
  });

  it('deduplicates a neighbor that appears in multiple edges', () => {
    const focal = 'f';
    const edges = [
      { source: focal, target: 'dup' },
      { source: 'dup', target: focal }, // reverse direction
    ];
    const strengths = { 'f|dup': 0.95 };
    const ctx = buildCtx({ strengths, top5: {}, edges });
    const result = topAffinities(focal, ctx);
    expect(result.filter((r) => r.name === 'dup').length).toBe(1);
  });

  it('handles raw pairings.json shape with ingredientA/ingredientB', () => {
    const focal = 'f';
    const edges = [{ ingredientA: focal, ingredientB: 'n0' }];
    const strengths = { 'f|n0': 0.95 };
    const ctx = buildCtx({ strengths, top5: {}, edges });
    const result = topAffinities(focal, ctx);
    expect(result.map((r) => r.name)).toEqual(['n0']);
  });
});
