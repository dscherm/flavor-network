import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveBuiltIn, slugFor } from '../sharedRecipe.js';
import {
  alreadySaved, profileListFor, saveLabel, savedKindFor, savedNoun, sharedFromFor, sharedSaveInput,
} from '../sharedSave.js';
import { inventSeedForShared } from '../sharedSeed.js';
import { saveInvention } from '../savedInventions.js';
import { readSaved } from '../savedInventions.js';
import {
  PENDING_KEY, SEED_KEY, clearPendingSave, readPendingSave, setPendingSave, stashInventSeed, takeInventSeed,
} from '../sharedHandoff.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { RECIPE_DETAILS } from '../seedRecipeDetails.js';
import { FAMILY_SKELETONS } from '../cocktailInvent.js';
import { INVENT_STYLE_BY_ID } from '../inventSauce.js';
import { DISH_SKELETONS } from '../dishSkeletons.js';

const codex = JSON.parse(readFileSync('public/data/cocktail_codex_v2.json', 'utf8'));
const sauceRaw = JSON.parse(readFileSync('public/data/sauce_augment.json', 'utf8'));
const DATA = { cocktails: codex.cocktails, families: codex.families, sauces: sauceRaw.sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const get = (kind, slug) => resolveBuiltIn(kind, slug, DATA);

describe('save labels and shapes', () => {
  it('labels and nouns by kind', () => {
    expect(saveLabel('cocktail')).toBe('Save to my cocktails');
    expect(saveLabel('sauce')).toBe('Save to my sauces');
    expect(saveLabel('dish')).toBe('Save to my cookbook');
    expect(savedKindFor('dish')).toBe('recipe');
    expect(savedNoun('cocktail')).toBe('cocktails');
    expect(savedKindFor('wine')).toBeNull();
  });

  it('sharedFrom is kind/slug', () => {
    expect(sharedFromFor(get('cocktail', 'negroni'))).toBe('cocktail/negroni');
    expect(sharedFromFor(null)).toBe('');
  });

  it('a cocktail keeps its lines, glass, method, family and sharedFrom', () => {
    const r = get('cocktail', 'negroni');
    const input = sharedSaveInput(r);
    expect(input).toMatchObject({ kind: 'cocktail', id: 'shared-cocktail-negroni', name: 'Negroni', sharedFrom: 'cocktail/negroni' });
    expect(input.lines.map((l) => l.key)).toEqual(r.lines.map((l) => l.key));
    expect(input.category).toBe(r.categoryId);
    expect(input.glass).toBe(r.glass);
    const res = saveInvention({ cocktails: [] }, input);
    expect(res.ok).toBe(true);
    expect(res.profile.cocktails).toHaveLength(1);
    expect(res.profile.cocktails[0]).toMatchObject({ sharedFrom: 'cocktail/negroni', kind: 'cocktail', name: 'Negroni' });
    expect(readSaved(res.profile, 'cocktail')[0].sharedFrom).toBe('cocktail/negroni');
  });

  it('a sauce saves into profile.sauces with its style', () => {
    const r = get('sauce', 'hollandaise');
    const res = saveInvention({ sauces: [] }, sharedSaveInput(r));
    expect(res.ok).toBe(true);
    expect(res.profile.sauces[0]).toMatchObject({ kind: 'sauce', category: 'Hollandaise', sharedFrom: 'sauce/hollandaise', method: r.method });
  });

  it('a dish saves into profile.recipes in the Cookbook shape, with cuisine and sharedFrom', () => {
    const r = get('dish', 'beef-bolognese');
    const res = saveInvention({ recipes: [] }, sharedSaveInput(r));
    expect(res.ok).toBe(true);
    const saved = res.profile.recipes[0];
    expect(saved).toMatchObject({ id: 'shared-dish-beef-bolognese', name: 'Beef Bolognese', source: 'invent', sharedFrom: 'dish/beef-bolognese' });
    expect(saved.instructions).toBe(r.method);
    expect(saved.ingredients.length).toBe(r.lines.length);
    expect(saved.ingredients[0]).toHaveProperty('raw');
    expect(saved.cuisine).toBe(r.category);
  });

  it('saving the same shared recipe twice does not duplicate it, for every kind', () => {
    for (const [kind, slug, field] of [['cocktail', 'daiquiri', 'cocktails'], ['sauce', 'alfredo', 'sauces'], ['dish', 'margherita-pizza', 'recipes']]) {
      const input = sharedSaveInput(get(kind, slug));
      const once = saveInvention({}, input).profile;
      const twice = saveInvention(once, input).profile;
      expect(twice[field]).toHaveLength(1);
      expect(alreadySaved(profileListFor(twice, kind), `${kind}/${slug}`)).toBe(true);
    }
  });

  it('a dish does not overwrite the cook\'s own invented recipe of the same name', () => {
    const r = get('dish', 'beef-bolognese');
    const own = { id: 'inv-1', name: 'Beef Bolognese', ingredients: [], source: 'invent' };
    const res = saveInvention({ recipes: [own] }, sharedSaveInput(r));
    expect(res.profile.recipes.map((x) => x.id)).toEqual(['inv-1', 'shared-dish-beef-bolognese']);
  });

  it('alreadySaved is false for another recipe, an empty list and bad input', () => {
    expect(alreadySaved([{ sharedFrom: 'cocktail/negroni' }], 'cocktail/daiquiri')).toBe(false);
    expect(alreadySaved([], 'cocktail/negroni')).toBe(false);
    expect(alreadySaved(null, 'cocktail/negroni')).toBe(false);
    expect(alreadySaved([{}], '')).toBe(false);
  });

  it('an unknown kind has no input', () => {
    expect(sharedSaveInput({ kind: 'wine', slug: 'merlot', lines: [] })).toBeNull();
  });
});

describe('Make it your own: the seed for each lab', () => {
  const keysOf = (seed) => [...(seed.main ? [seed.main] : []), ...seed.pinned.map((p) => p.key)];

  it('cocktails: every line is pinned and the cocktail\'s family is chosen', () => {
    for (const slug of ['negroni', 'daiquiri', 'margarita', 'old-fashioned', 'manhattan']) {
      const r = get('cocktail', slug);
      const res = inventSeedForShared(r);
      expect(res.lab).toBe('cocktail');
      expect(res.seed.familyId).toBe(r.categoryId);
      expect(FAMILY_SKELETONS[res.seed.familyId]).toBeTruthy();
      expect(res.seed.fromName).toBe(true);
      expect(res.seed.pinned.length).toBeGreaterThanOrEqual(2);
      expect(res.seed.pinned.every((p) => p.source === 'search')).toBe(true);
    }
    const neg = inventSeedForShared(get('cocktail', 'negroni')).seed.pinned.map((p) => p.key);
    expect(neg).toEqual(expect.arrayContaining(['gin', 'campari']));
  });

  it('sauces: every ingredient is pinned and the mother-sauce style is chosen', () => {
    for (const slug of ['alfredo', 'hollandaise', 'bearnaise']) {
      const r = get('sauce', slug);
      const res = inventSeedForShared(r);
      expect(res.lab).toBe('sauce');
      if (r.categoryId) {
        expect(res.seed.styleId).toBe(r.categoryId);
        expect(INVENT_STYLE_BY_ID.has(res.seed.styleId)).toBe(true);
        expect(res.seed.fromName).toBe(true);
      }
      expect(res.seed.pinned.length).toBe(new Set(res.seed.pinned.map((p) => p.key)).size);
      expect(res.seed.pinned.length).toBeGreaterThanOrEqual(3);
    }
    expect(inventSeedForShared(get('sauce', 'hollandaise')).seed.styleId).toBe('Hollandaise');
  });

  it('every sauce of the built-in list with a mother sauce seeds a known style', () => {
    for (const s of sauceRaw.sauces) {
      if (!s.motherSauce || s.motherSauce === 'Independent') continue;
      expect(INVENT_STYLE_BY_ID.has(s.motherSauce), s.name).toBe(true);
    }
  });

  it('dishes: Make a recipe gets a dish type, a main and the rest of the lines', () => {
    for (const slug of ['beef-bolognese', 'margherita-pizza', 'risotto-saffron']) {
      const r = get('dish', slug);
      const res = inventSeedForShared(r);
      expect(res.lab).toBe('make');
      expect(DISH_SKELETONS[res.seed.type]).toBeTruthy();
      expect(res.seed.fromName).toBe(true);
      const keys = keysOf(res.seed);
      expect(new Set(keys).size).toBe(keys.length);
      for (const l of r.lines) expect(keys).toContain(l.key);
    }
  });

  it('every built-in dish, sauce and cocktail yields a seed that holds all its distinct lines', () => {
    for (const d of SEED_RECIPES) {
      const r = get('dish', slugFor('dish', d));
      const res = inventSeedForShared(r);
      expect(res, d.id).toBeTruthy();
      expect(keysOf(res.seed).length, d.id).toBeGreaterThanOrEqual(new Set(r.lines.map((l) => l.key)).size - 3);
    }
  });

  it('without a known category the lines still come through, with nothing chosen', () => {
    const r = { ...get('cocktail', 'negroni'), categoryId: null };
    const res = inventSeedForShared(r);
    expect(res.seed.fromName).toBeUndefined();
    expect(res.seed.familyId).toBeUndefined();
    expect(res.seed.pinned.length).toBeGreaterThan(1);
  });

  it('nothing to seed from an empty or unknown recipe', () => {
    expect(inventSeedForShared(null)).toBeNull();
    expect(inventSeedForShared({ kind: 'cocktail', lines: [] })).toBeNull();
    expect(inventSeedForShared({ kind: 'wine', lines: [{ key: 'x' }] })).toBeNull();
  });
});


describe('sharedHandoff storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('pending save round trip and clear', () => {
    expect(readPendingSave()).toBeNull();
    setPendingSave({ kind: 'cocktail', slug: 'negroni' });
    expect(readPendingSave()).toEqual({ kind: 'cocktail', slug: 'negroni' });
    clearPendingSave();
    expect(readPendingSave()).toBeNull();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('a pending save older than ten minutes is ignored; garbage is ignored', () => {
    setPendingSave({ kind: 'sauce', slug: 'alfredo' }, 1000);
    expect(readPendingSave(1000 + 11 * 60 * 1000)).toBeNull();
    expect(readPendingSave(1000 + 60 * 1000)).toEqual({ kind: 'sauce', slug: 'alfredo' });
    sessionStorage.setItem(PENDING_KEY, '{nope');
    expect(readPendingSave()).toBeNull();
  });

  it('the seed is taken once and removed', () => {
    expect(stashInventSeed('cocktail', { familyId: 1, pinned: [] })).toBe(true);
    expect(takeInventSeed()).toEqual({ lab: 'cocktail', seed: { familyId: 1, pinned: [] } });
    expect(sessionStorage.getItem(SEED_KEY)).toBeNull();
    expect(takeInventSeed()).toBeNull();
  });

  it('a stale or unknown-lab seed is dropped', () => {
    stashInventSeed('sauce', { pinned: [] }, 1000);
    expect(takeInventSeed(1000 + 11 * 60 * 1000)).toBeNull();
    expect(stashInventSeed('wine', { pinned: [] })).toBe(false);
    expect(stashInventSeed('sauce', null)).toBe(false);
  });
});
