import { describe, it, expect } from 'vitest';
import { rankBridges } from '../bridgeRanker.js';

function makeCtx(nodes, edges, bucketOf) {
  return {
    nodes: new Map(nodes.map((n) => [n.name, n])),
    edges,
    bucketOf: new Map(Object.entries(bucketOf)),
  };
}

describe('rankBridges', () => {
  it('returns an empty array when ctx is missing or empty', () => {
    expect(rankBridges('aromas', null)).toEqual([]);
    expect(
      rankBridges('aromas', { nodes: new Map(), edges: [], bucketOf: new Map() }),
    ).toEqual([]);
  });

  it('returns an empty array when there are no edges', () => {
    const nodes = [
      { name: 'apple', pairingCount: 50 },
      { name: 'basil', pairingCount: 80 },
    ];
    expect(
      rankBridges('aromas', makeCtx(nodes, [], { apple: 'Fruity', basil: 'Green' })),
    ).toEqual([]);
  });

  it('returns an empty array when every edge stays within the same bucket', () => {
    const nodes = [
      { name: 'apple',  pairingCount: 50 },
      { name: 'banana', pairingCount: 60 },
    ];
    const edges = [{ source: 'apple', target: 'banana', strength: 0.9 }];
    expect(
      rankBridges('aromas', makeCtx(nodes, edges, { apple: 'Fruity', banana: 'Fruity' })),
    ).toEqual([]);
  });

  it('ranks nodes by cumulative cross-bucket strength descending', () => {
    const nodes = [
      { name: 'lemon',      pairingCount: 90 },
      { name: 'strawberry', pairingCount: 200 },
      { name: 'basil',      pairingCount: 80 },
      { name: 'mint',       pairingCount: 60 },
    ];
    const bucketOf = {
      lemon: 'Fruity',
      strawberry: 'Fruity',
      basil: 'Green',
      mint: 'Green',
    };
    const edges = [
      { source: 'lemon',      target: 'basil', strength: 0.9 },
      { source: 'lemon',      target: 'mint',  strength: 0.6 },
      { source: 'strawberry', target: 'basil', strength: 0.4 },
    ];
    const ranked = rankBridges('aromas', makeCtx(nodes, edges, bucketOf));
    expect(ranked.map((r) => r.name)).toEqual(['lemon', 'basil', 'mint', 'strawberry']);
    expect(ranked[0].score).toBeCloseTo(1.5, 5);
    expect(ranked[0].topPeer).toBe('basil');
    expect(ranked[0].otherBucket).toBe('Green');
  });

  it('caps the ranking at opts.topN (default 20)', () => {
    const nodes = [];
    const edges = [];
    const bucketOf = {};
    for (let i = 0; i < 30; i++) {
      const name = `n${String(i).padStart(2, '0')}`;
      nodes.push({ name });
      bucketOf[name] = i % 2 === 0 ? 'Fruity' : 'Green';
    }
    for (let i = 0; i < 25; i++) {
      const a = `n${String(i).padStart(2, '0')}`;
      const b = `n${String((i + 1) % 30).padStart(2, '0')}`;
      if (bucketOf[a] !== bucketOf[b]) edges.push({ source: a, target: b, strength: i + 1 });
    }
    expect(rankBridges('aromas', makeCtx(nodes, edges, bucketOf)).length).toBe(20);
    expect(rankBridges('aromas', makeCtx(nodes, edges, bucketOf), { topN: 5 }).length).toBe(5);
  });

  it('breaks ties alphabetically by node name', () => {
    const nodes = [
      { name: 'banana' },
      { name: 'apple' },
      { name: 'basil' },
    ];
    const edges = [
      { source: 'apple',  target: 'basil', strength: 0.7 },
      { source: 'banana', target: 'basil', strength: 0.7 },
    ];
    const ranked = rankBridges('aromas', makeCtx(nodes, edges, {
      apple: 'Fruity',
      banana: 'Fruity',
      basil: 'Green',
    }));
    expect(ranked[0].name).toBe('basil');
    expect(ranked[1].name).toBe('apple');
    expect(ranked[2].name).toBe('banana');
  });

  it('skips orphan endpoints not present in the node map', () => {
    const nodes = [{ name: 'apple', pairingCount: 50 }];
    const edges = [{ source: 'apple', target: 'unknown', strength: 0.9 }];
    const ranked = rankBridges('aromas', makeCtx(nodes, edges, { apple: 'Fruity', unknown: 'Green' }));
    expect(ranked.map((r) => r.name)).toEqual(['apple']);
  });
});
