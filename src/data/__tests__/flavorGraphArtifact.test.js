import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// N1-D3: validate the baked public/proDataset/flavor_graph.json artifact —
// shape, the canonical mint fixture, and the vocabulary cross-check.
// Vitest runs from the repo root, so resolve from process.cwd().
const graph = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/proDataset/flavor_graph.json'), 'utf-8'),
);

const TIERS = ['tier1', 'tier2', 'tier3', 'leaves'];

describe('flavor_graph.json artifact', () => {
  it('exists, parses, and has ingredients + vocabulary keys', () => {
    expect(graph).toBeTypeOf('object');
    expect(graph.ingredients).toBeTypeOf('object');
    expect(graph.vocabulary).toBeTypeOf('object');
    expect(Object.keys(graph.ingredients).length).toBeGreaterThan(0);
    for (const t of TIERS) expect(Array.isArray(graph.vocabulary[t])).toBe(true);
  });

  it('matches the canonical mint fixture', () => {
    const mint = graph.ingredients.mint;
    expect(mint).toBeDefined();
    expect(mint.tier1).toEqual(['green']);
    expect(mint.tier2).toEqual(expect.arrayContaining(['bitter', 'astringent']));
    expect(mint.tier3).toEqual(expect.arrayContaining(['cooling', 'pungent']));
    expect(mint.leaves).toEqual(['menthol', 'fresh', 'sharp', 'grassy', 'herbaceous']);
  });

  it('every tier term used by an ingredient appears in the matching vocabulary list', () => {
    const vocab = Object.fromEntries(TIERS.map(t => [t, new Set(graph.vocabulary[t])]));
    const offenders = [];
    for (const [name, entry] of Object.entries(graph.ingredients)) {
      for (const t of TIERS) {
        for (const term of entry[t] || []) {
          if (!vocab[t].has(term)) offenders.push(`${name}.${t}:${term}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
