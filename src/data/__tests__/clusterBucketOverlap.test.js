import { describe, it, expect } from 'vitest';
import { computeClusterBucketOverlap } from '../clusterBucketOverlap.js';

function makeCtx(nodes, bucketOf, bucketOrder) {
  return {
    nodes: new Map(nodes.map((n) => [n.name, n])),
    bucketOf: new Map(Object.entries(bucketOf)),
    bucketOrder,
  };
}

describe('computeClusterBucketOverlap', () => {
  it('returns empty shape on null / missing ctx', () => {
    expect(computeClusterBucketOverlap(null)).toEqual({ clusters: [], buckets: [], counts: {} });
    expect(computeClusterBucketOverlap({})).toEqual({ clusters: [], buckets: [], counts: {} });
  });

  it('builds the cluster × bucket overlap table from node.clusterId + bucketOf', () => {
    const nodes = [
      { name: 'apple',  clusterId: 1, clusterLabel: 'Sweet' },
      { name: 'banana', clusterId: 1, clusterLabel: 'Sweet' },
      { name: 'lemon',  clusterId: 1, clusterLabel: 'Sweet' },
      { name: 'basil',  clusterId: 2, clusterLabel: 'Aromatics' },
      { name: 'mint',   clusterId: 2, clusterLabel: 'Aromatics' },
    ];
    const r = computeClusterBucketOverlap(makeCtx(nodes, {
      apple: 'Fruity', banana: 'Fruity', lemon: 'Fruity',
      basil: 'Green',  mint: 'Green',
    }, ['Fruity', 'Green']));
    expect(r.clusters.map((c) => c.id)).toEqual([1, 2]);
    expect(r.clusters.find((c) => c.id === 1).total).toBe(3);
    expect(r.clusters.find((c) => c.id === 1).label).toBe('Sweet');
    expect(r.counts[1].Fruity).toBe(3);
    expect(r.counts[2].Green).toBe(2);
    expect(r.buckets).toEqual(['Fruity', 'Green']);
  });

  it('skips nodes missing clusterId OR bucket assignment', () => {
    const nodes = [
      { name: 'a', clusterId: 1 },
      { name: 'b' },                       // no cluster
      { name: 'c', clusterId: 1 },         // no bucket
    ];
    const r = computeClusterBucketOverlap(makeCtx(nodes, {
      a: 'Fruity',
    }, ['Fruity']));
    expect(r.clusters).toHaveLength(1);
    expect(r.counts[1].Fruity).toBe(1);
    expect(r.clusters[0].total).toBe(1);
  });

  it('appends buckets seen in data but absent from bucketOrder', () => {
    const nodes = [
      { name: 'a', clusterId: 1 },
      { name: 'b', clusterId: 1 },
    ];
    const r = computeClusterBucketOverlap(makeCtx(nodes, {
      a: 'Fruity', b: 'Surprise',
    }, ['Fruity']));
    expect(r.buckets).toEqual(['Fruity', 'Surprise']);
  });

  it('sorts clusters by numeric ID ascending', () => {
    const nodes = [
      { name: 'a', clusterId: 3 },
      { name: 'b', clusterId: 1 },
      { name: 'c', clusterId: 2 },
    ];
    const r = computeClusterBucketOverlap(makeCtx(nodes, {
      a: 'X', b: 'X', c: 'X',
    }, ['X']));
    expect(r.clusters.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it('falls back to "Cluster N" when clusterLabel is missing', () => {
    const nodes = [{ name: 'a', clusterId: 7 }];
    const r = computeClusterBucketOverlap(makeCtx(nodes, { a: 'X' }, ['X']));
    expect(r.clusters[0].label).toBe('Cluster 7');
  });
});
