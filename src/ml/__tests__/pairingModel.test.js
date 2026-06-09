import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  isPairingModelEnabled,
  cosineSimilarity,
  buildEmbeddingIndex,
  rankByEmbedding,
  blendPairingScores,
} from '../pairingModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('pairingModel — FN_PAIRING_MODEL flag', () => {
  it('defaults OFF in a non-browser / unset-flag context', () => {
    // No localStorage and no VITE_FN_PAIRING_MODEL in the test env → false.
    expect(isPairingModelEnabled()).toBe(false);
  });
});

describe('pairingModel — cosineSimilarity', () => {
  it('identical vectors → 1, orthogonal → 0, opposite → -1', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 6);
  });

  it('returns 0 on malformed / mismatched / zero-magnitude input', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity(null, [1])).toBe(0);
  });
});

describe('pairingModel — rankByEmbedding (synthetic, deterministic)', () => {
  // Controlled geometry: A and B point the same way (strong pair); A and Z
  // point opposite (weak pair); M is orthogonal (mid). This is the literal
  // "known strong pair outranks known weak pair for a fixed focal" check.
  const nodes = [
    { name: 'A', embedding: [1, 0, 0] },
    { name: 'B', embedding: [0.9, 0.1, 0] }, // near A → strong
    { name: 'M', embedding: [0, 1, 0] }, // orthogonal → mid
    { name: 'Z', embedding: [-1, 0, 0] }, // opposite A → weak
  ];
  const index = buildEmbeddingIndex(nodes);

  it('builds an index keyed by name', () => {
    expect(index.size).toBe(4);
    expect(index.get('A')).toEqual([1, 0, 0]);
  });

  it('strong pair (A~B) outranks weak pair (A~Z) for focal A', () => {
    const ranked = rankByEmbedding('A', ['B', 'M', 'Z'], index);
    const names = ranked.map((r) => r.name);
    expect(names[0]).toBe('B');
    expect(names.indexOf('B')).toBeLessThan(names.indexOf('Z'));
    // strength is the [0,1]-mapped cosine: B near 1, Z near 0.
    expect(ranked.find((r) => r.name === 'B').strength).toBeGreaterThan(0.9);
    expect(ranked.find((r) => r.name === 'Z').strength).toBeLessThan(0.1);
  });

  it('excludes the focal itself and unknown / embedding-less candidates', () => {
    const ranked = rankByEmbedding('A', ['A', 'B', 'unknown'], index);
    const names = ranked.map((r) => r.name);
    expect(names).not.toContain('A');
    expect(names).not.toContain('unknown');
    expect(names).toContain('B');
  });

  it('returns [] for an unknown focal', () => {
    expect(rankByEmbedding('nope', ['A', 'B'], index)).toEqual([]);
  });

  it('respects topK', () => {
    expect(rankByEmbedding('A', ['B', 'M', 'Z'], index, { topK: 2 }).length).toBe(2);
  });
});

describe('pairingModel — blendPairingScores', () => {
  const nodes = [
    { name: 'A', embedding: [1, 0] },
    { name: 'B', embedding: [1, 0] }, // cos(A,B)=1 → strength 1
    { name: 'C', embedding: [-1, 0] }, // cos(A,C)=-1 → strength 0
  ];
  const index = buildEmbeddingIndex(nodes);
  // Co-occurrence says C > B; embedding says B > C.
  const coocc = [
    { name: 'C', strength: 0.9 },
    { name: 'B', strength: 0.4 },
  ];

  it('alpha=0 preserves the co-occurrence order', () => {
    const out = blendPairingScores(coocc, 'A', index, { alpha: 0 });
    expect(out.map((r) => r.name)).toEqual(['C', 'B']);
  });

  it('alpha=1 flips to the embedding order', () => {
    const out = blendPairingScores(coocc, 'A', index, { alpha: 1 });
    expect(out.map((r) => r.name)).toEqual(['B', 'C']);
  });

  it('keeps co-occurrence score when a candidate has no embedding', () => {
    const cooccWithUnknown = [{ name: 'mystery', strength: 0.7 }];
    const out = blendPairingScores(cooccWithUnknown, 'A', index, { alpha: 0.5 });
    expect(out[0]).toEqual({ name: 'mystery', strength: 0.7 });
  });

  it('returns [] on empty input', () => {
    expect(blendPairingScores([], 'A', index)).toEqual([]);
  });
});

describe('pairingModel — real v3 embeddings (structural invariants only)', () => {
  // Raw cosine over the real GAT embeddings is a compressed, intuition-weak
  // signal (see module header), so we assert ROBUST structural properties,
  // not specific flavor pairs.
  const path = resolve(__dirname, '../../../public/proDataset/flavor_graph_data_v3.json');
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const index = buildEmbeddingIndex(data.nodes);

  it('loads thousands of 16-D embeddings', () => {
    expect(index.size).toBeGreaterThan(3000);
    const first = index.values().next().value;
    expect(first.length).toBe(16);
  });

  it('rankByEmbedding output is sorted desc, in [0,1], focal-excluded, capped', () => {
    const focal = 'lemon';
    expect(index.has(focal)).toBe(true);
    const ranked = rankByEmbedding(focal, null, index, { topK: 25 });
    expect(ranked.length).toBe(25);
    expect(ranked.some((r) => r.name === focal)).toBe(false);
    for (let i = 0; i < ranked.length; i++) {
      expect(ranked[i].strength).toBeGreaterThanOrEqual(0);
      expect(ranked[i].strength).toBeLessThanOrEqual(1);
      if (i > 0) expect(ranked[i - 1].strength).toBeGreaterThanOrEqual(ranked[i].strength);
    }
  });
});
