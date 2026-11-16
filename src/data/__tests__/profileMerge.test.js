// PROFILE-2: removal markers for every synced list.
import { describe, it, expect } from 'vitest';
import { TRACKED, withRemovals, mergeProfiles, cleanRemoved, REMOVED_MAX_AGE_MS, REMOVED_CAP } from '../profileMerge.js';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const base = (o = {}) => ({
  cuisines: [], ingredients: [], recipes: [], cocktails: [], sauces: [], shares: [], pairings: [],
  quizAnswers: null, removed: {}, shopping: { list: { items: [], recipes: [] }, removed: {} }, ...o,
});
const recipe = (name, extra = {}) => ({ name, ingredients: [], ...extra });
const cocktail = (id, extra = {}) => ({ id, name: id, ...extra });
const sauce = (id, extra = {}) => ({ id, name: id, ...extra });
const share = (id, createdAt = 1) => ({ id, kind: 'recipe', sourceId: 'x', fingerprint: '', name: id, createdAt });
const pair = (a, b) => ({ a, b });

// One sample per list: [list, item, an equal item as the other device holds it]
const SAMPLES = {
  recipes: recipe('Beef Stew'),
  cocktails: cocktail('c_1', { createdAt: 1000 }),
  sauces: sauce('s_1', { createdAt: 1000 }),
  cuisines: 'thai',
  ingredients: 'garlic',
  pairings: pair('butter', 'sage'),
  shares: share('abcdefghij'),
};

describe('every tracked list', () => {
  it('has a sample here', () => { expect(Object.keys(SAMPLES).sort()).toEqual([...TRACKED].sort()); });

  for (const list of TRACKED) {
    const item = SAMPLES[list];
    describe(list, () => {
      it('deleted on A and still on B stays deleted', () => {
        const before = base({ [list]: [item] });
        const A = withRemovals(before, base({ ...before, [list]: [] }), { now: NOW });
        const B = base({ [list]: [item] });
        const m = mergeProfiles(A, B, { now: NOW + 1 });
        expect(m[list]).toEqual([]);
        expect(m.removed[list]).toBeTruthy();
        // and the same whichever side is "local"
        expect(mergeProfiles(B, A, { now: NOW + 1 })[list]).toEqual([]);
      });

      it('deleted on A then added again on A stays', () => {
        const before = base({ [list]: [item] });
        const gone = withRemovals(before, base({ ...before, [list]: [] }), { now: NOW });
        const back = withRemovals(gone, { ...gone, [list]: [item] }, { now: NOW + 5 });
        expect(back.removed[list]).toBeUndefined();
        const m = mergeProfiles(back, base({ [list]: [item] }), { now: NOW + 10 });
        expect(m[list]).toHaveLength(1);
      });

      it('a profile with no markers merges as a union, once each', () => {
        const m = mergeProfiles(base({ [list]: [item] }), base({ [list]: [item] }), { now: NOW });
        expect(m[list]).toHaveLength(1);
        expect(m.removed).toEqual({});
      });
    });
  }
});

describe('time', () => {
  it('deleted on A, edited later on B (item carries a time): B keeps it, marker dropped', () => {
    const A = base({ removed: { cocktails: { c_1: NOW } } });
    const B = base({ cocktails: [cocktail('c_1', { createdAt: 1000, updatedAt: NOW + 50 })] });
    const m = mergeProfiles(A, B, { now: NOW + 100 });
    expect(m.cocktails).toHaveLength(1);
    expect(m.removed.cocktails).toBeUndefined();
  });

  it('deleted on A after B last changed it: gone', () => {
    const A = base({ removed: { sauces: { s_1: NOW } } });
    const B = base({ sauces: [sauce('s_1', { createdAt: 5, updatedAt: NOW - 10 })] });
    expect(mergeProfiles(A, B, { now: NOW + 100 }).sauces).toEqual([]);
  });

  it('a date-string createdAt counts as the time', () => {
    const A = base({ removed: { cocktails: { c_1: NOW } } });
    const B = base({ cocktails: [cocktail('c_1', { createdAt: new Date(NOW + 1000).toISOString() })] });
    expect(mergeProfiles(A, B, { now: NOW + 2000 }).cocktails).toHaveLength(1);
  });

  it('an item with no time loses to its marker, even an old one', () => {
    const A = base({ removed: { recipes: { 'beef stew': NOW - 3 * DAY } } });
    const B = base({ recipes: [recipe('Beef Stew')] });
    expect(mergeProfiles(A, B, { now: NOW }).recipes).toEqual([]);
  });

  it('recipe identity ignores case and surrounding space', () => {
    const A = base({ removed: { recipes: { 'beef stew': NOW } } });
    expect(mergeProfiles(A, base({ recipes: [recipe('  BEEF stew ')] }), { now: NOW + 1 }).recipes).toEqual([]);
  });

  it('a pairing deleted in the other order is still deleted', () => {
    const before = base({ pairings: [pair('sage', 'butter')] });
    const A = withRemovals(before, base(), { now: NOW });
    expect(mergeProfiles(A, base({ pairings: [pair('butter', 'sage')] }), { now: NOW + 1 }).pairings).toEqual([]);
  });
});

describe('markers', () => {
  it('older than 30 days are dropped, and then the item can return', () => {
    const A = base({ removed: { ingredients: { garlic: NOW - REMOVED_MAX_AGE_MS - 1, onion: NOW - DAY } } });
    expect(cleanRemoved(A.removed, { now: NOW })).toEqual({ ingredients: { onion: NOW - DAY } });
    const m = mergeProfiles(A, base({ ingredients: ['garlic', 'onion'] }), { now: NOW });
    expect(m.ingredients).toEqual(['garlic']);
  });

  it('merge keeps the later time of the two', () => {
    const m = mergeProfiles(base({ removed: { cuisines: { thai: NOW - 5 } } }), base({ removed: { cuisines: { thai: NOW - 1 } } }), { now: NOW });
    expect(m.removed.cuisines.thai).toBe(NOW - 1);
  });

  it('are capped, newest kept; junk and unknown lists are dropped', () => {
    const many = Object.fromEntries(Array.from({ length: REMOVED_CAP + 50 }, (_, i) => [`i${i}`, NOW - i]));
    const clean = cleanRemoved({ ingredients: many, nonsense: { x: NOW }, cuisines: { thai: 'soon', '': NOW } }, { now: NOW });
    expect(Object.keys(clean.ingredients)).toHaveLength(REMOVED_CAP);
    expect(clean.ingredients.i0).toBe(NOW);
    expect(clean.nonsense).toBeUndefined();
    expect(clean.cuisines).toBeUndefined();
  });

  it('withRemovals stamps only what left, and keeps older markers', () => {
    const prev = base({ ingredients: ['garlic', 'onion'], removed: { cuisines: { thai: NOW - 10 } } });
    const next = withRemovals(prev, { ...prev, ingredients: ['garlic'] }, { now: NOW });
    expect(next.removed).toEqual({ cuisines: { thai: NOW - 10 }, ingredients: { onion: NOW } });
  });

  it('is idempotent', () => {
    const A = base({ removed: { ingredients: { onion: NOW } }, ingredients: ['garlic'] });
    const B = base({ ingredients: ['onion'] });
    const once = mergeProfiles(A, B, { now: NOW + 1 });
    expect(mergeProfiles(once, B, { now: NOW + 1 })).toEqual(once);
    expect(mergeProfiles(once, A, { now: NOW + 1 })).toEqual(once);
  });
});
