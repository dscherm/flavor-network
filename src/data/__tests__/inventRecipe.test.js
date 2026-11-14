import { describe, it, expect } from 'vitest';
import {
  cuisineOptions, kitchenCuisines, isBasicLike, recipeRoles, inventionHandoff,
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

