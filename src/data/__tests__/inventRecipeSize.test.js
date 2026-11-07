// WEAK-5: invented recipes aim for 5–8 ingredients, balanced roles, the
// chosen main in every dish, varied ideas and honest "why" lines.
import { describe, it, expect, vi } from 'vitest';
import {
  inventRecipes, inventionNames, sizeTerm, coherence, recipeRoles, roleBalance, hasCentre, kitchenCentres,
  buyingCost, scoreDish, whyLine, nextInventions, EXHAUSTED_RECIPE, DISH_MIN, DISH_MAX, MAX_OUTSIDE,
  ROLE_WEIGHTS, OUTSIDE_FILL_COST, OUTSIDE_EXTRA_COST,
} from '../inventRecipe.js';

const NODES = new Map([
  ['chicken', { category: 'protein', cuisines: [] }],
  ['beef', { category: 'protein', cuisines: [] }],
  ['garlic', { category: 'aromatic', cuisines: [] }],
  ['onion', { category: 'aromatic', cuisines: [] }],
  ['lemon', { category: 'citrus', cuisines: [] }],
  ['tomato', { category: 'vegetable', cuisines: [] }],
  ['potato', { category: 'vegetable', cuisines: [] }],
  ['carrot', { category: 'vegetable', cuisines: [] }],
  ['rice', { category: 'grain', cuisines: [] }],
  ['pasta', { category: 'grain', cuisines: [] }],
  ['basil', { category: 'herb', cuisines: [] }],
  ['thyme', { category: 'herb', cuisines: [] }],
  ['oregano', { category: 'herb', cuisines: [] }],
  ['parmesan', { category: 'umami', cuisines: [] }],
  ['cumin', { category: 'spice', cuisines: [] }],
  ['lentils', { category: undefined, cuisines: [] }],
  ['milk', { category: 'dairy', cuisines: [] }],
  ['strawberry', { category: 'fruit', cuisines: [] }],
  ['cream', { category: 'dairy', cuisines: [] }],
  ['chocolate', { category: 'confection', cuisines: [] }],
]);
const NAMES = new Set(NODES.keys());

function index(pairs) {
  const strength = new Map();
  for (const [a, b, s] of pairs) { strength.set(`${a}|${b}`, s); strength.set(`${b}|${a}`, s); }
  return { strength, degree: new Map(), names: NAMES };
}

function fakeSuggest(logits) {
  return vi.fn(async (observed, { candidateNames, k }) => {
    const pool = candidateNames || Object.keys(logits);
    return pool.filter((n) => !observed.includes(n) && n in logits)
      .map((name) => ({ name, score: logits[name] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  });
}

describe('scoring terms', () => {
  it('size term is flat at its top for 5–8 ingredients and lower outside', () => {
    expect([DISH_MIN, DISH_MAX]).toEqual([5, 8]);
    const top = sizeTerm(5);
    for (const n of [5, 6, 7, 8]) expect(sizeTerm(n)).toBe(top);
    expect(sizeTerm(4)).toBeLessThan(top);
    expect(sizeTerm(3)).toBeLessThan(sizeTerm(4));
    expect(sizeTerm(9)).toBeLessThan(top);
  });

  it('coherence leaves assumed basics out', () => {
    const idx = index([['chicken', 'lemon', 0.6], ['chicken', 'garlic', 0.6], ['garlic', 'olive oil', 0.99], ['garlic', 'lemon', 0.6]]);
    const withOil = coherence(['chicken', 'lemon', 'garlic', 'olive oil'], idx);
    expect(withOil.pairs.some((p) => p.a === 'olive oil' || p.b === 'olive oil')).toBe(false);
    expect(withOil.score).toBeCloseTo(coherence(['chicken', 'lemon', 'garlic'], idx).score);
  });

  it('coherence keeps most of its value when a fourth ingredient pairs with one of three', () => {
    const idx = index([['chicken', 'lemon', 0.6], ['chicken', 'garlic', 0.6], ['garlic', 'lemon', 0.6], ['chicken', 'rice', 0.6]]);
    const four = coherence(['chicken', 'lemon', 'garlic', 'rice'], idx);
    expect(four.score).toBeGreaterThan(0.45);
    expect(four.unlinked).toBe(0);
  });

  it('role balance: main, vegetable, starch, aromatic, acid or richness, herb or spice', () => {
    const r = recipeRoles(['chicken', 'tomato', 'rice', 'garlic', 'lemon', 'basil'], { nodes: NODES });
    expect(r).toEqual({ main: true, vegetable: true, starch: true, aromatic: true, acidRich: true, herbSpice: true });
    expect(recipeRoles(['lentils'], { nodes: NODES }).main).toBe(true); // a legume is a main
    expect(recipeRoles(['tomato'], { nodes: NODES, main: 'tomato' }).main).toBe(true); // the chosen main counts
    expect(recipeRoles(['potato'], { nodes: NODES }).starch).toBe(true);
    const full = Object.values(ROLE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(roleBalance(r, { cuisine: 'Italian' })).toBeCloseTo(full);
    // The starch counts half where no cuisine says it expects one.
    expect(roleBalance(r, { cuisine: null })).toBeCloseTo(full - ROLE_WEIGHTS.starch / 2);
  });

  it('a savoury dish needs a centre (no more onion + oregano + parmesan + thyme)', () => {
    expect(hasCentre(['onion', 'oregano', 'parmesan', 'thyme'], { nodes: NODES })).toBe(false);
    expect(hasCentre(['beef', 'onion', 'thyme'], { nodes: NODES })).toBe(true);
    expect(hasCentre(['potato', 'onion'], { nodes: NODES })).toBe(true);
    expect(hasCentre(['strawberry', 'cream', 'chocolate'], { nodes: NODES })).toBe(true); // a dessert
    expect(kitchenCentres(['pasta', 'tomato', 'basil', 'garlic'], NODES)).toEqual(['pasta']);
  });

  it('buying is cheap while it fills a dish to DISH_MIN, dearer beyond', () => {
    expect(buyingCost(3, 2)).toBeCloseTo(2 * OUTSIDE_FILL_COST);
    expect(buyingCost(5, 1)).toBeCloseTo(OUTSIDE_EXTRA_COST);
    expect(buyingCost(4, 2)).toBeCloseTo(OUTSIDE_FILL_COST + OUTSIDE_EXTRA_COST);
    expect(OUTSIDE_EXTRA_COST).toBeGreaterThan(OUTSIDE_FILL_COST);
  });

  it('a balanced dish of six outscores a three-ingredient one with stronger pairs', () => {
    const idx = index([['beef', 'onion', 0.9], ['onion', 'thyme', 0.9], ['beef', 'thyme', 0.9],
      ['beef', 'potato', 0.5], ['potato', 'carrot', 0.5], ['carrot', 'onion', 0.6], ['onion', 'potato', 0.6], ['lemon', 'beef', 0.3]]);
    const small = scoreDish(['beef', 'onion', 'thyme'], { index: idx, nodes: NODES });
    const big = scoreDish(['beef', 'onion', 'thyme', 'potato', 'carrot', 'lemon'], { index: idx, nodes: NODES });
    expect(big.score).toBeGreaterThan(small.score);
    expect(Object.keys(big.parts)).toEqual(['coherence', 'size', 'roles', 'fit', 'buying', 'kitchen']);
  });

  it('why cites the two strongest pairs, never a basic; onion + garlic only when nothing else pairs', () => {
    const pairs = [
      { a: 'olive oil', b: 'garlic', s: 0.99 }, { a: 'onion', b: 'garlic', s: 0.92 },
      { a: 'chicken', b: 'garlic', s: 0.7 }, { a: 'chicken', b: 'lemon', s: 0.6 }, { a: 'lemon', b: 'rice', s: 0.3 },
    ];
    const why = whyLine(pairs);
    expect(why).not.toMatch(/olive oil/);
    expect(why).toBe('Pairs well in real recipes: chicken + garlic, lemon + rice.');
    expect(whyLine([{ a: 'onion', b: 'garlic', s: 0.9 }])).toMatch(/onion \+ garlic/);
    expect(whyLine([])).toMatch(/no single pairing stands out/);
  });
});

describe('inventRecipes: size, main and variety', () => {
  const LOG = { chicken: 0.5, beef: 0.5, onion: 1, garlic: 0.8, lemon: 0.3, rice: 0.2, tomato: 0.1, basil: 0, thyme: -0.5, potato: -0.2, carrot: -0.4, oregano: -1, parmesan: -1, cumin: -1.5 };

  it('the chosen main is in every dish', async () => {
    const r = await inventRecipes({ kitchen: ['beef', 'onion', 'potato', 'carrot', 'thyme'], main: 'thyme', suggest: fakeSuggest(LOG), nodes: NODES, names: NAMES });
    expect(r.ok).toBe(true);
    for (const d of r.pool) {
      expect(d.ingredients.map((i) => i.name)).toContain('thyme');
      expect(d.ingredients.find((i) => i.name === 'thyme').main).toBe(true);
    }
  });

  it('with any main, every dish of a kitchen with a protein or starch is built on one', async () => {
    const r = await inventRecipes({ kitchen: ['beef', 'onion', 'potato', 'carrot', 'thyme'], suggest: fakeSuggest(LOG), nodes: NODES, names: NAMES });
    expect(r.pool.length).toBeGreaterThan(0);
    for (const d of r.pool) expect(d.ingredients.some((i) => ['beef', 'potato'].includes(i.name))).toBe(true);
  });

  it('dishes aim for 5–8 ingredients and buy at most two', async () => {
    const r = await inventRecipes({ kitchen: ['chicken', 'onion', 'garlic', 'lemon', 'rice', 'tomato'], suggest: fakeSuggest(LOG), nodes: NODES, names: NAMES });
    const sizes = r.pool.map((d) => d.ingredients.length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DISH_MAX);
    expect(r.inventions[0].ingredients.length).toBeGreaterThanOrEqual(DISH_MIN);
    expect(sizes.reduce((a, b) => a + b, 0) / sizes.length).toBeGreaterThanOrEqual(DISH_MIN);
    for (const d of r.pool) expect(d.ingredients.filter((i) => i.needed).length).toBeLessThanOrEqual(MAX_OUTSIDE);
  });

  it('Shuffle walks new dishes, never repeats one, then is exhausted', async () => {
    const r = await inventRecipes({ kitchen: ['chicken', 'onion', 'garlic', 'lemon'], suggest: fakeSuggest(LOG), nodes: NODES, names: NAMES });
    const shown = [];
    for (let pages = 0; pages < 100; pages++) {
      const next = nextInventions(r.pool, shown, 3);
      if (next.length === 0) break;
      shown.push(...next);
    }
    const keys = shown.map((d) => d.ingredients.map((i) => i.name).sort().join());
    expect(shown.length).toBe(r.pool.length);
    expect(new Set(keys).size).toBe(shown.length);
    expect(new Set(shown.map((d) => d.name)).size).toBe(shown.length);
    expect(nextInventions(r.pool, shown, 3)).toEqual([]);
    expect(EXHAUSTED_RECIPE).toBe("That's every idea for this kitchen; add an ingredient for more.");
  });

  it('names stay distinct: a different second ingredient, then "with …"; aromatics last', () => {
    const idx = index([['chicken', 'lemon', 0.7], ['chicken', 'rice', 0.5], ['chicken', 'tomato', 0.3]]);
    const { names } = inventionNames(['chicken', 'lemon', 'basil', 'tomato', 'garlic'], { nodes: NODES, index: idx });
    expect(names[0]).toBe('Chicken & Lemon Skillet');
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Chicken & Tomato Skillet');
    expect(names.some((n) => / with /.test(n))).toBe(true);
    expect(names.findIndex((n) => /Garlic/.test(n))).toBeGreaterThan(names.findIndex((n) => /Tomato/.test(n)));
  });
});
