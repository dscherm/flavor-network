import { describe, it, expect } from 'vitest';
import {
  buildVocabMaps,
  resolveNamesToIds,
  retrieveDirections,
  adaptSteps,
} from '../directionsRuntime.js';

// ── Tiny fixture ──────────────────────────────────────────────────────────────
// vocab: id 0=chicken, 1=garlic, 2=onion, 3=tomato, 4=basil, 5=lemon, 6=butter
const VOCAB = ['chicken', 'garlic', 'onion', 'tomato', 'basil', 'lemon', 'butter'];

// 5 small recipes
const FIXTURE_RECIPES = [
  { v: [0, 1, 2, 3], t: 'Chicken Tomato Sauté',   d: ['Heat oil.', 'Add chicken.', 'Add tomato and onion.'] },
  { v: [1, 2, 4],    t: 'Garlic Basil Pasta',      d: ['Boil pasta.', 'Sauté garlic and onion.', 'Toss with basil.'] },
  { v: [0, 5, 6],    t: 'Lemon Butter Chicken',    d: ['Melt butter.', 'Add lemon.', 'Cook chicken through.'] },
  { v: [2, 3, 4],    t: 'Tomato Basil Salad',      d: ['Slice tomato.', 'Add basil and onion.', 'Dress with oil.'] },
  { v: [0, 1, 2],    t: 'Simple Chicken Stir Fry', d: ['Heat wok.', 'Add chicken.', 'Add garlic and onion.'] },
];

// Build inverted index from fixture recipes
function buildInv(recipes) {
  const inv = {};
  for (let i = 0; i < recipes.length; i++) {
    for (const id of recipes[i].v) {
      const key = String(id);
      if (!inv[key]) inv[key] = [];
      inv[key].push(i);
    }
  }
  return inv;
}

const FIXTURE_INDEX = {
  _meta: { recipes: FIXTURE_RECIPES.length, cap: 5 },
  vocab_ref: 'recipe_vocab.json',
  recipes: FIXTURE_RECIPES,
  inv: buildInv(FIXTURE_RECIPES),
};

// ── buildVocabMaps ────────────────────────────────────────────────────────────
describe('buildVocabMaps', () => {
  it('builds correct nameToId and idToName maps', () => {
    const { nameToId, idToName } = buildVocabMaps(VOCAB);
    expect(nameToId.get('chicken')).toBe(0);
    expect(nameToId.get('garlic')).toBe(1);
    expect(idToName.get(3)).toBe('tomato');
  });

  it('returns empty maps for non-array input', () => {
    const { nameToId, idToName } = buildVocabMaps(null);
    expect(nameToId.size).toBe(0);
    expect(idToName.size).toBe(0);
  });
});

// ── resolveNamesToIds ─────────────────────────────────────────────────────────
describe('resolveNamesToIds', () => {
  it('resolves known names to ids, drops unknowns', () => {
    const { nameToId } = buildVocabMaps(VOCAB);
    const ids = resolveNamesToIds(['chicken', 'dragonfruit', 'garlic'], nameToId);
    expect(ids).toEqual([0, 1]);
  });

  it('deduplicates repeated names', () => {
    const { nameToId } = buildVocabMaps(VOCAB);
    const ids = resolveNamesToIds(['garlic', 'garlic', 'onion'], nameToId);
    expect(ids).toEqual([1, 2]);
  });
});

// ── retrieveDirections ────────────────────────────────────────────────────────
describe('retrieveDirections', () => {
  it('returns the most-overlapping recipe first', () => {
    // bowl: chicken, garlic, onion, tomato — exact match for recipe 0 (4/4)
    const results = retrieveDirections(['chicken', 'garlic', 'onion', 'tomato'], FIXTURE_INDEX, VOCAB);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Chicken Tomato Sauté');
    expect(results[0].overlap).toBe(4);
    expect(results[0].jaccard).toBeCloseTo(1.0);
  });

  it('returns verbatim steps from the recipe', () => {
    const results = retrieveDirections(['chicken', 'garlic', 'onion', 'tomato'], FIXTURE_INDEX, VOCAB, { k: 1 });
    expect(results[0].steps).toEqual(['Heat oil.', 'Add chicken.', 'Add tomato and onion.']);
  });

  it('minOverlap filter drops recipes with fewer shared ingredients', () => {
    // bowl: lemon, butter — only recipe 2 has both; recipes 0/1/3/4 have 0 overlap
    const results = retrieveDirections(['lemon', 'butter'], FIXTURE_INDEX, VOCAB, { minOverlap: 2 });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Lemon Butter Chicken');
  });

  it('k caps the result count', () => {
    // bowl that matches several recipes
    const results = retrieveDirections(['chicken', 'garlic', 'onion'], FIXTURE_INDEX, VOCAB, { k: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns [] on null index', () => {
    expect(retrieveDirections(['chicken'], null, VOCAB)).toEqual([]);
  });

  it('returns [] on empty bowl', () => {
    expect(retrieveDirections([], FIXTURE_INDEX, VOCAB)).toEqual([]);
  });

  it('returns [] when no bowl names resolve to vocab ids', () => {
    expect(retrieveDirections(['unobtainium', 'phlogiston'], FIXTURE_INDEX, VOCAB)).toEqual([]);
  });

  it('matchedNames lists only bowl ingredients present in the retrieved recipe', () => {
    // bowl: chicken, garlic, onion, tomato — exact match for recipe 0; all 4 are present
    const results = retrieveDirections(['chicken', 'garlic', 'onion', 'tomato'], FIXTURE_INDEX, VOCAB, { k: 1 });
    expect(results[0].matchedNames).toContain('chicken');
    expect(results[0].matchedNames).toContain('garlic');
    expect(results[0].matchedNames).toContain('onion');
    expect(results[0].matchedNames).toContain('tomato');
    // lemon is not in recipe 0 and not in bowl, so it should not appear
    expect(results[0].matchedNames).not.toContain('lemon');
  });
});

// ── adaptSteps ────────────────────────────────────────────────────────────────
describe('adaptSteps', () => {
  it('returns steps verbatim with present/absent name split', () => {
    // recipe has chicken(0) + garlic(1) + onion(2); bowl has chicken + garlic but not onion
    const rec = FIXTURE_RECIPES[4]; // Simple Chicken Stir Fry: [0,1,2]
    const { steps, presentNames, absentNames } = adaptSteps(rec.d, rec.v, ['chicken', 'garlic'], VOCAB);
    expect(steps).toEqual(rec.d);               // verbatim, unchanged
    expect(presentNames).toContain('chicken');
    expect(presentNames).toContain('garlic');
    expect(absentNames).toContain('onion');
  });

  it('handles null steps gracefully', () => {
    const { steps } = adaptSteps(null, [], [], VOCAB);
    expect(steps).toEqual([]);
  });

  it('handles null vocab gracefully', () => {
    const { steps } = adaptSteps(['step1'], [0], ['chicken'], null);
    expect(steps).toEqual(['step1']);
  });
});
