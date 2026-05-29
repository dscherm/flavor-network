import { describe, it, expect } from 'vitest';
import { rankSauces, classifySauce } from '../sauceRecommendation.js';

const SAUCES = [
  {
    name: 'Béchamel',
    ingredients: [
      { name: 'butter' }, { name: 'flour' }, { name: 'milk' },
      { name: 'salt' }, { name: 'nutmeg' },
    ],
  },
  {
    name: 'Hollandaise',
    ingredients: [
      { name: 'butter' }, { name: 'egg yolk' }, { name: 'lemon juice' },
    ],
  },
  {
    name: 'Caramel sauce',
    ingredients: [{ name: 'sugar' }, { name: 'butter' }, { name: 'cream' }],
  },
  {
    name: 'Crème anglaise',
    ingredients: [
      { name: 'egg yolk' }, { name: 'sugar' }, { name: 'vanilla' },
      { name: 'milk' },
    ],
  },
  {
    name: 'Cocktail aperitif sauce',
    ingredients: [{ name: 'campari' }, { name: 'orange' }],
  },
  {
    name: 'Tomato sauce',
    ingredients: [
      { name: 'tomato' }, { name: 'garlic' }, { name: 'basil' },
      { name: 'olive oil' },
    ],
  },
];

describe('classifySauce', () => {
  it('detects sweet sauces by sweet-marker ingredients', () => {
    expect(classifySauce(SAUCES[2])).toBe('sweet');  // Caramel sauce (sugar)
    expect(classifySauce(SAUCES[3])).toBe('sweet');  // Crème anglaise (sugar + vanilla)
  });

  it('detects cocktail sauces by alcohol-marker ingredients', () => {
    expect(classifySauce(SAUCES[4])).toBe('cocktail');
  });

  it('defaults to savory when no sweet/cocktail markers are present', () => {
    expect(classifySauce(SAUCES[0])).toBe('savory');  // Béchamel
    expect(classifySauce(SAUCES[1])).toBe('savory');  // Hollandaise
    expect(classifySauce(SAUCES[5])).toBe('savory');  // Tomato sauce
  });

  it('handles string-form ingredients', () => {
    expect(classifySauce({ ingredients: ['sugar', 'milk'] })).toBe('sweet');
    expect(classifySauce({ ingredients: ['butter', 'flour'] })).toBe('savory');
  });
});

describe('rankSauces — §15.1 sauce recommendation ranker', () => {
  it('returns [] for empty bowl', () => {
    expect(rankSauces([], SAUCES)).toEqual([]);
  });

  it('returns [] for empty sauces', () => {
    expect(rankSauces(['tomato'], [])).toEqual([]);
  });

  it('ranks by ingredient overlap descending', () => {
    const bowl = ['tomato', 'garlic', 'basil', 'olive oil'];  // matches Tomato sauce fully
    const ranked = rankSauces(bowl, SAUCES);
    expect(ranked[0].name).toBe('Tomato sauce');
    expect(ranked[0].overlap).toBe(4);
  });

  it('drops sauces with zero ingredient overlap (no noise)', () => {
    const bowl = ['kale', 'quinoa'];
    const ranked = rankSauces(bowl, SAUCES);
    expect(ranked).toEqual([]);
  });

  it('returns top K results (default 5)', () => {
    const bowl = ['butter', 'sugar', 'milk', 'flour'];
    const ranked = rankSauces(bowl, SAUCES);
    expect(ranked.length).toBeLessThanOrEqual(5);
  });

  it('honors custom K', () => {
    const bowl = ['butter'];
    const ranked = rankSauces(bowl, SAUCES, null, 2);
    expect(ranked.length).toBeLessThanOrEqual(2);
  });

  it('recipeType="dessert" suppresses savory sauces', () => {
    const bowl = ['butter', 'milk', 'sugar', 'flour'];
    const ranked = rankSauces(bowl, SAUCES, 'dessert');
    for (const r of ranked) expect(r.class).toBe('sweet');
    // Béchamel + Hollandaise + Tomato should all be dropped.
    expect(ranked.find((r) => r.name === 'Béchamel')).toBeUndefined();
    expect(ranked.find((r) => r.name === 'Hollandaise')).toBeUndefined();
  });

  it('recipeType="main" suppresses sweet sauces', () => {
    const bowl = ['butter', 'milk', 'sugar', 'flour'];
    const ranked = rankSauces(bowl, SAUCES, 'main');
    for (const r of ranked) expect(r.class).toBe('savory');
    expect(ranked.find((r) => r.name === 'Caramel sauce')).toBeUndefined();
  });

  it('recipeType="side" matches "main" gate (savory only)', () => {
    const bowl = ['butter', 'milk', 'sugar'];
    const ranked = rankSauces(bowl, SAUCES, 'side');
    for (const r of ranked) expect(r.class).toBe('savory');
  });

  it('recipeType="drink" surfaces cocktail-class sauces only', () => {
    const bowl = ['campari', 'orange'];
    const ranked = rankSauces(bowl, SAUCES, 'drink');
    expect(ranked[0]?.class).toBe('cocktail');
  });

  it('recipeType="sauce" allows all classes', () => {
    const bowl = ['butter', 'sugar', 'campari'];
    const ranked = rankSauces(bowl, SAUCES, 'sauce');
    const classes = new Set(ranked.map((r) => r.class));
    // At least 2 distinct classes should be reachable from this bowl.
    expect(classes.size).toBeGreaterThanOrEqual(2);
  });

  it('recipeType=null (no type chosen) imposes no gate', () => {
    const bowl = ['butter', 'sugar', 'milk', 'flour'];
    const ranked = rankSauces(bowl, SAUCES, null);
    const classes = new Set(ranked.map((r) => r.class));
    expect(classes.size).toBeGreaterThanOrEqual(2);
  });
});
