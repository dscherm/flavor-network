import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadCodexV2, topSimilar, crossFamilySimilar, cocktailSimilarity } from '../cocktailCodexV2.js';
import { SUBCLUSTER_NAMES, subclusterName } from '../cocktailSubclusters.js';

const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/cocktail_codex_v2.json'), 'utf8'));

describe('cocktail codex v2 — loader', () => {
  const graph = loadCodexV2(raw);

  it('loads every cocktail, family and sub-group', () => {
    expect(graph.cocktails).toHaveLength(raw.cocktails.length);
    expect(graph.families).toHaveLength(6);
    expect(graph.byCanonical.size).toBeGreaterThan(400);
    for (const fam of graph.families) {
      expect(graph.byFamily.get(fam.id)?.length, fam.name).toBeGreaterThan(0);
      expect(fam.position).toBeTruthy();
    }
  });

  it('rejects a malformed file', () => {
    expect(loadCodexV2(null)).toBeNull();
    expect(loadCodexV2({ cocktails: [] })).toBeNull();
  });

  it('every sub-group in the data has a human name', () => {
    const ids = new Set(raw.cocktails.map((c) => c.subcluster_id));
    for (const id of ids) expect(subclusterName(id), id).toBeTruthy();
    expect(Object.keys(SUBCLUSTER_NAMES).length).toBe(ids.size);
  });

  it('every cocktail has a family, a sub-group in that family, and ingredients', () => {
    const famIds = new Set(raw.families.map((f) => f.id));
    for (const c of raw.cocktails) {
      expect(famIds.has(c.family_id), c.name).toBe(true);
      expect(String(c.subcluster_id).startsWith(`${c.family_id}.`), c.name).toBe(true);
      expect(c.ingredients_raw.length, c.name).toBeGreaterThan(0);
    }
  });
});

describe('cocktail codex v2 — similarity', () => {
  const graph = loadCodexV2(raw);
  const negroni = graph.byCanonical.get('negroni');

  it('a cocktail is most similar to itself and similarity is symmetric', () => {
    const other = graph.byCanonical.get('old fashioned');
    expect(cocktailSimilarity(negroni, negroni)).toBeCloseTo(1, 6);
    expect(cocktailSimilarity(negroni, other)).toBeCloseTo(cocktailSimilarity(other, negroni), 9);
  });

  it('within-family cousins stay in the family and exclude the target', () => {
    const within = topSimilar(negroni, graph.cocktails, 5, { withinFamily: true });
    expect(within.length).toBeGreaterThan(0);
    for (const { cocktail } of within) {
      expect(cocktail.family_id).toBe(negroni.family_id);
      expect(cocktail.name).not.toBe(negroni.name);
    }
  });

  it('cross-family bridges come from other families', () => {
    for (const { cocktail } of crossFamilySimilar(negroni, graph.cocktails, 3)) {
      expect(cocktail.family_id).not.toBe(negroni.family_id);
    }
  });
});
