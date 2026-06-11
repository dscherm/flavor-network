import { describe, it, expect } from 'vitest';
import { methodsInSteps, extractCookingMethods, retrieveCookingMethods } from '../directionsRuntime.js';

describe('methodsInSteps', () => {
  it('detects methods from step verbs', () => {
    const m = methodsInSteps(['Sauté the onions until soft.', 'Bake at 350 for 20 minutes.']);
    expect(m.has('sauté')).toBe(true);
    expect(m.has('bake')).toBe(true);
  });

  it('collapses the fry family (stir-fry suppresses generic fry)', () => {
    const m = methodsInSteps(['Stir-fry the vegetables in a hot wok.']);
    expect(m.has('stir-fry')).toBe(true);
    expect(m.has('fry')).toBe(false);
  });

  it('returns empty for non-step input', () => {
    expect(methodsInSteps(null).size).toBe(0);
    expect(methodsInSteps([]).size).toBe(0);
  });
});

describe('extractCookingMethods', () => {
  it('ranks methods by recipe frequency', () => {
    const recipes = [
      { steps: ['Bake until golden.'] },
      { steps: ['Preheat oven; bake 30 min.'] },
      { steps: ['Sauté garlic, then bake.'] },
      { steps: ['Grill over high heat.'] },
    ];
    const { methods, scanned } = extractCookingMethods(recipes, { topN: 3 });
    expect(scanned).toBe(4);
    expect(methods[0].method).toBe('bake'); // 3 of 4 recipes
    expect(methods[0].count).toBe(3);
    expect(methods[0].frac).toBeCloseTo(0.75);
    expect(methods.map((m) => m.method)).toContain('grill');
  });

  it('is empty-safe', () => {
    expect(extractCookingMethods([]).methods).toEqual([]);
    expect(extractCookingMethods(null).methods).toEqual([]);
  });
});

describe('retrieveCookingMethods', () => {
  // Minimal fixture index: bowl [flour,sugar,egg] (ids 0,1,2) → one cake recipe.
  const vocab = ['flour', 'sugar', 'egg', 'butter'];
  const index = {
    recipes: [{ v: [0, 1, 2], t: 'Cake', d: ['Mix flour and sugar.', 'Bake at 350.'] }],
    inv: { 0: [0], 1: [0], 2: [0] },
  };

  it('retrieves then extracts methods from similar recipes', () => {
    const { methods } = retrieveCookingMethods(['flour', 'sugar', 'egg'], index, vocab, { k: 3, minOverlap: 2 });
    expect(methods.some((m) => m.method === 'bake')).toBe(true);
  });

  it('returns no methods when nothing matches', () => {
    expect(retrieveCookingMethods(['butter'], index, vocab, { minOverlap: 2 }).methods).toEqual([]);
  });
});
