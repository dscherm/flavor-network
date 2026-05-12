import { describe, it, expect } from 'vitest';
import { computeBucketStats } from '../bucketStats.js';

function makeCtx(nodes, edges, bucketOf) {
  return {
    nodes: new Map(nodes.map((n) => [n.name, n])),
    edges,
    bucketOf: new Map(Object.entries(bucketOf)),
  };
}

describe('computeBucketStats', () => {
  it('returns an empty Map when ctx is missing or empty', () => {
    expect(computeBucketStats('aromas', null).size).toBe(0);
    expect(computeBucketStats('aromas', { nodes: new Map(), edges: [], bucketOf: new Map() }).size).toBe(0);
  });

  it('groups members by bucket and ranks topMembers by pairingCount desc', () => {
    const nodes = [
      { name: 'apple',      pairingCount: 50 },
      { name: 'banana',     pairingCount: 200 },
      { name: 'strawberry', pairingCount: 300 },
      { name: 'pineapple',  pairingCount: 100 },
      { name: 'basil',      pairingCount: 250 },
      { name: 'mint',       pairingCount: 80 },
    ];
    const stats = computeBucketStats('aromas', makeCtx(nodes, [], {
      apple: 'Fruity',
      banana: 'Fruity',
      strawberry: 'Fruity',
      pineapple: 'Fruity',
      basil: 'Green',
      mint: 'Green',
    }));
    expect(stats.get('Fruity').count).toBe(4);
    expect(stats.get('Fruity').topMembers).toEqual(['strawberry', 'banana', 'pineapple']);
    expect(stats.get('Green').topMembers).toEqual(['basil', 'mint']);
  });

  it('breaks topMembers ties alphabetically', () => {
    const nodes = [
      { name: 'zucchini', pairingCount: 100 },
      { name: 'apple',    pairingCount: 100 },
      { name: 'mango',    pairingCount: 100 },
    ];
    const stats = computeBucketStats('family', makeCtx(nodes, [], {
      zucchini: 'Vegetable',
      apple: 'Vegetable',
      mango: 'Vegetable',
    }), { topN: 2 });
    expect(stats.get('Vegetable').topMembers).toEqual(['apple', 'mango']);
  });

  it('picks the bucket member with the highest cumulative cross-bucket edge weight as the bridge', () => {
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
      { source: 'basil',      target: 'mint',  strength: 0.7 },
    ];
    const stats = computeBucketStats('aromas', makeCtx(nodes, edges, bucketOf));
    const fruity = stats.get('Fruity').bridge;
    expect(fruity).not.toBeNull();
    expect(fruity.name).toBe('lemon');
    expect(fruity.topPeer).toBe('basil');
    expect(fruity.otherBucket).toBe('Green');
    expect(fruity.strength).toBeCloseTo(0.9, 5);
    const green = stats.get('Green').bridge;
    expect(green.name).toBe('basil');
    expect(green.topPeer).toBe('lemon');
    expect(green.otherBucket).toBe('Fruity');
  });

  it('returns bridge=null when no edges leave the bucket', () => {
    const nodes = [
      { name: 'apple',  pairingCount: 50 },
      { name: 'banana', pairingCount: 60 },
    ];
    const edges = [{ source: 'apple', target: 'banana', strength: 0.8 }];
    const stats = computeBucketStats('aromas', makeCtx(nodes, edges, {
      apple: 'Fruity',
      banana: 'Fruity',
    }));
    expect(stats.get('Fruity').bridge).toBeNull();
  });

  it('returns bridge=null when the edges array is missing/empty', () => {
    const nodes = [{ name: 'apple', pairingCount: 50 }];
    const stats = computeBucketStats('aromas', makeCtx(nodes, [], { apple: 'Fruity' }));
    expect(stats.get('Fruity').bridge).toBeNull();
  });

  it('ignores edges whose endpoints are not classified by the axis', () => {
    const nodes = [
      { name: 'apple',  pairingCount: 50 },
      { name: 'orphan', pairingCount: 99 },
    ];
    const edges = [{ source: 'apple', target: 'orphan', strength: 0.9 }];
    const stats = computeBucketStats('aromas', makeCtx(nodes, edges, { apple: 'Fruity' }));
    expect(stats.get('Fruity').bridge).toBeNull();
  });

  it('breaks bridge ties on cumulative score with alphabetical name', () => {
    const nodes = [
      { name: 'banana', pairingCount: 100 },
      { name: 'apple',  pairingCount: 50 },
      { name: 'basil',  pairingCount: 80 },
    ];
    const edges = [
      { source: 'apple',  target: 'basil', strength: 0.7 },
      { source: 'banana', target: 'basil', strength: 0.7 },
    ];
    const stats = computeBucketStats('aromas', makeCtx(nodes, edges, {
      apple: 'Fruity',
      banana: 'Fruity',
      basil: 'Green',
    }));
    expect(stats.get('Fruity').bridge.name).toBe('apple');
  });

  it('does not return entries for buckets with zero classified members', () => {
    const nodes = [
      { name: 'apple', pairingCount: 50 },
    ];
    const stats = computeBucketStats('aromas', makeCtx(nodes, [], { apple: 'Fruity' }));
    expect(stats.has('Fruity')).toBe(true);
    expect(stats.has('Green')).toBe(false);
  });
});
