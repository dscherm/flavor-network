import { describe, it, expect } from 'vitest';
import {
  cuisineOptions, kitchenCuisines, isBasicLike, recipeRoles, inventionHandoff, seedFromHandoff, handoffFromProfileRecipe,
} from '../inventRecipe.js';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: ['italian cuisine', 'indian cuisine'] }],
  ['garlic', { category: 'aromatic', cuisines: ['italian cuisine', 'chinese cuisine'] }],
  ['lemon', { category: 'citrus', cuisines: ['greek cuisine', 'italian cuisine'] }],
  ['tomato', { category: 'vegetable', cuisines: ['italian cuisine', 'mexican cuisine'] }],
  ['rice', { category: 'grain', cuisines: ['indian cuisine'] }],
  ['basil', { category: 'herb', cuisines: ['italian cuisine'] }],
  ['parmesan', { category: 'dairy', cuisines: ['italian cuisine'] }],
  ['chocolate', { category: 'confection', cuisines: [] }],
  ['strawberry', { category: 'fruit', cuisines: [] }],
  ['cream', { category: 'dairy', cuisines: [] }],
]);
const NAMES = new Set(NODES.keys());

function index(pairs, degree = {}) {
  const strength = new Map();
  for (const [a, b, s] of pairs) { strength.set(`${a}|${b}`, s); strength.set(`${b}|${a}`, s); }
  return { strength, degree: new Map(Object.entries(degree)), names: NAMES };
}

describe('cuisineOptions / kitchenCuisines', () => {
  const VOCAB = ['Global', 'Italian', 'Indian', 'Greek', 'Chinese', 'Mexican', 'mexican', 'italian'];

  it('keeps one title-case spelling per cuisine and drops Global', () => {
    expect(cuisineOptions(VOCAB)).toEqual(['Italian', 'Indian', 'Greek', 'Chinese', 'Mexican']);
  });

  it('ranks the cuisines the kitchen leans toward', () => {
    expect(kitchenCuisines(['chicken', 'garlic', 'tomato', 'basil'], NODES, VOCAB, 2)).toEqual(['Italian', 'Indian']);
    expect(kitchenCuisines([], NODES, VOCAB)).toEqual([]);
  });
});

describe('helpers', () => {
  it('isBasicLike catches long names for basics', () => {
    expect(isBasicLike('extra-virgin olive oil')).toBe(true);
    expect(isBasicLike('kosher salt')).toBe(true);
    expect(isBasicLike('red pepper')).toBe(false);
    expect(isBasicLike('chicken')).toBe(false);
  });
});

describe('inventionHandoff', () => {
  it('builds a make-invent handoff with amounts and the closest method', () => {
    const inv = { name: 'Chicken & Lemon Skillet', ingredients: [{ name: 'chicken' }, { name: 'lemon', needed: true }] };
    const amounts = new Map([['chicken', { raw: '1 lb', qty: 1, unit: 'lb', inferred: true }]]);
    const h = inventionHandoff(inv, { amounts, closest: { title: 'Lemon Chicken', steps: ['Cook.'] } });
    expect(h).toMatchObject({ source: 'make-invent', mode: 'recipe', title: 'Chicken & Lemon Skillet', steps: ['Cook.'], stepsFrom: 'Lemon Chicken' });
    expect(h.ingredients).toEqual([
      { ingredient: 'chicken', amount: { raw: '1 lb', qty: 1, unit: 'lb', inferred: true } },
      { ingredient: 'lemon', amount: null },
    ]);
  });
});

describe('inventionHandoff keeps the dish type and cuisine (BUILDER-3)', () => {
  it('carries type and cuisine, and the seed made from it asks for that dish and cuisine', () => {
    const h = inventionHandoff({ name: 'Wok night', ingredients: [{ name: 'chicken' }, { name: 'garlic' }], type: 'stir-fry', cuisine: 'Chinese' });
    expect(h).toMatchObject({ type: 'stir-fry', cuisine: 'Chinese' });
    expect(seedFromHandoff(h)).toMatchObject({ type: 'stir-fry', fromName: true, cuisine: 'Chinese', title: 'Wok night' });
  });
  it('with no dish type chosen, the seed does not apply one', () => {
    const h = inventionHandoff({ name: 'x', ingredients: [{ name: 'chicken' }, { name: 'rice' }], type: null, cuisine: null });
    const seed = seedFromHandoff(h);
    expect(seed.type).toBeUndefined();
    expect(seed.fromName).toBeUndefined();
    expect(seed.cuisine).toBeUndefined();
  });
});

describe('seedFromHandoff', () => {
  it('turns names, BowlEntries and { name } into lowercase pinned lines, once each, with typed amounts', () => {
    const seed = seedFromHandoff({
      ingredients: ['Chicken', { ingredient: 'garlic', amount: { raw: '3 cloves' } }, { name: 'Rice' }, 'chicken', { ingredient: 'lemon', amount: null }, ''],
      title: '  Dinner ', steps: ['Cook.'], stepsFrom: 'A recipe', image: 'x.png',
    });
    expect(seed).toEqual({
      pinned: [
        { key: 'chicken', source: 'user' }, { key: 'garlic', source: 'user', amount: '3 cloves' },
        { key: 'rice', source: 'user' }, { key: 'lemon', source: 'user' },
      ],
      title: 'Dinner', steps: ['Cook.'], stepsFrom: 'A recipe', image: 'x.png',
    });
  });
  it('passes an existing seed straight through and returns null for nothing', () => {
    const s = { type: 'soup', pinned: [] };
    expect(seedFromHandoff({ seed: s, ts: 1 })).toBe(s);
    expect(seedFromHandoff(null)).toBeNull();
  });
  it('a handoff with no ingredients (a photo, a scratch start) has no lines, so the builder asks its first question', () => {
    expect(seedFromHandoff({ source: 'make-photo', ingredients: [], image: { name: 'f' } }).pinned).toEqual([]);
  });
});

describe('handoffFromProfileRecipe', () => {
  it('an invention reopens under its own id, with amounts read from raw', () => {
    const h = handoffFromProfileRecipe({ id: 'inv-1', source: 'invent', name: 'My Pasta', cuisine: 'Italian', ingredients: [
      { name: 'tomato', raw: '2 cups tomato' }, { name: 'basil', raw: 'basil' }] });
    expect(h.editId).toBe('inv-1');
    expect(h.replaces).toBeUndefined();
    expect(h.title).toBe('My Pasta');
    expect(h.cuisine).toBe('Italian');
    expect(seedFromHandoff(h).pinned).toEqual([{ key: 'tomato', source: 'user', amount: '2 cups' }, { key: 'basil', source: 'user' }]);
  });
  it('a recipe the old Notebook saved (names only, no id) reopens by name, with no amounts', () => {
    const h = handoffFromProfileRecipe({ name: 'Old Soup', ingredients: [{ name: 'tomato', raw: 'tomato' }, 'basil'] });
    expect(h.replaces).toBe('Old Soup');
    expect(h.editId).toBeUndefined();
    expect(seedFromHandoff(h)).toMatchObject({ title: 'Old Soup', replaces: 'Old Soup', pinned: [{ key: 'tomato', source: 'user' }, { key: 'basil', source: 'user' }] });
  });
});

describe('recipeRoles', () => {
  const N = new Map([
    ...NODES,
    ['lentils', { category: undefined }], ['potato', { category: 'vegetable' }],
  ]);
  it('names the balance roles a set fills: main, vegetable, starch, aromatic, acid or richness, herb or spice', () => {
    const r = recipeRoles(['chicken', 'tomato', 'rice', 'garlic', 'lemon', 'basil'], { nodes: N });
    expect(r).toEqual({ main: true, vegetable: true, starch: true, aromatic: true, acidRich: true, herbSpice: true });
    expect(recipeRoles(['lentils'], { nodes: N }).main).toBe(true); // a legume is a main
    expect(recipeRoles(['tomato'], { nodes: N, main: 'tomato' }).main).toBe(true); // the chosen main counts
    expect(recipeRoles(['potato'], { nodes: N }).starch).toBe(true);
  });
});

