import { describe, it, expect, vi } from 'vitest';
import {
  cuisineOptions, kitchenCuisines, meanPairing, isBasicLike, anchorOrder,
  inventionName, inventRecipes, inventionHandoff, FIT_LOGIT, MAX_OUTSIDE,
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

// A fake model: a fixed logit per ingredient; never suggests what is observed.
function fakeSuggest(logits) {
  return vi.fn(async (observed, { candidateNames, k }) => {
    const pool = candidateNames || Object.keys(logits);
    return pool.filter((n) => !observed.includes(n) && n in logits)
      .map((name) => ({ name, score: logits[name] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  });
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
  it('meanPairing averages every pair', () => {
    const idx = index([['chicken', 'lemon', 0.6], ['chicken', 'garlic', 0.3]]);
    const { score, pairs } = meanPairing(['chicken', 'lemon', 'garlic'], idx);
    expect(pairs).toHaveLength(3);
    expect(score).toBeCloseTo(0.3);
  });

  it('isBasicLike catches long names for basics', () => {
    expect(isBasicLike('extra-virgin olive oil')).toBe(true);
    expect(isBasicLike('kosher salt')).toBe(true);
    expect(isBasicLike('red pepper')).toBe(false);
    expect(isBasicLike('chicken')).toBe(false);
  });

  it('anchorOrder puts proteins first and aromatics last', () => {
    expect(anchorOrder(['garlic', 'tomato', 'chicken', 'lemon'], NODES)[0]).toBe('chicken');
    expect(anchorOrder(['garlic', 'basil'], NODES)).toEqual(['basil', 'garlic']);
  });
});

describe('inventionName', () => {
  it('is simple and honest: protein first, kind of dish, cuisine', () => {
    const idx = index([['chicken', 'lemon', 0.7], ['chicken', 'tomato', 0.2]]);
    expect(inventionName(['lemon', 'garlic', 'chicken', 'tomato'], { cuisine: 'Italian', nodes: NODES, index: idx }))
      .toMatchObject({ name: 'Chicken & Lemon Skillet, Italian-style', dishType: 'skillet' });
  });

  it('names the dish by its starch without repeating it', () => {
    const r = inventionName(['rice', 'chicken', 'tomato'], { nodes: NODES });
    expect(r.name).toBe('Chicken & Tomato Rice');
    expect(r.dishType).toBe('rice');
  });

  it('uses a stir-fry / curry for those cuisines, and dessert for sweet sets', () => {
    expect(inventionName(['chicken', 'garlic'], { cuisine: 'Chinese', nodes: NODES }).name).toBe('Chicken & Garlic Stir-fry, Chinese-style');
    expect(inventionName(['chicken', 'tomato'], { cuisine: 'Indian', nodes: NODES }).dishType).toBe('curry');
    expect(inventionName(['strawberry', 'cream', 'chocolate'], { nodes: NODES }).dishType).toBe('dessert');
  });
});

describe('inventRecipes', () => {
  const KITCHEN = ['chicken', 'lemon', 'garlic', 'tomato', 'chocolate', 'salt', 'olive oil'];
  const LOGITS = { lemon: 1, garlic: 0.5, tomato: -1, chocolate: -6, basil: 0, parmesan: -1, rice: -2 };

  it('grows the dish from the kitchen, leaving out what does not fit', async () => {
    const suggest = fakeSuggest(LOGITS);
    const r = await inventRecipes({ kitchen: KITCHEN, cuisine: 'Italian', main: 'chicken', suggest, nodes: NODES, names: NAMES });
    expect(r.ok).toBe(true);
    const first = r.inventions[0];
    expect(first.ingredients[0]).toMatchObject({ name: 'chicken', main: true });
    const names = first.ingredients.map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['chicken', 'lemon', 'garlic', 'tomato']));
    expect(names).not.toContain('chocolate'); // logit below FIT_LOGIT
    expect(names).not.toContain('salt');
    expect(first.ingredients.every((i) => !i.needed)).toBe(true);
    // Every model call is restricted to the kitchen and carries the cuisine.
    expect(suggest.mock.calls[0][1]).toMatchObject({ cuisine: 'Italian', candidateNames: expect.any(Array) });
    expect(suggest.mock.calls[0][1].candidateNames).not.toContain('basil');
    expect(LOGITS.chocolate).toBeLessThan(FIT_LOGIT);
  });

  it('a thin dish adds at most two things to buy, labelled needed', async () => {
    const suggest = fakeSuggest({ lemon: 1, basil: 0.5, parmesan: 0.2, rice: 0.1, 'extra-virgin olive oil': 3 });
    const r = await inventRecipes({ kitchen: ['chicken', 'lemon'], suggest, nodes: NODES, names: NAMES });
    const inv = r.inventions[0];
    const needed = inv.ingredients.filter((i) => i.needed).map((i) => i.name);
    expect(needed.length).toBeLessThanOrEqual(MAX_OUTSIDE);
    expect(needed).toEqual(['basil', 'parmesan']);
    expect(needed).not.toContain('extra-virgin olive oil'); // a basic, never "to buy"
  });

  it('things to buy need an observed pairing with the dish and to be common', async () => {
    const suggest = fakeSuggest({ lemon: 1, basil: 0.5, parmesan: 0.2, rice: 0.1 });
    const idx = index([['chicken', 'rice', 0.4], ['chicken', 'lemon', 0.5], ['chicken', 'parmesan', 0.1]], { rice: 400, basil: 400, parmesan: 10 });
    const r = await inventRecipes({ kitchen: ['chicken', 'lemon'], suggest, pairingIndex: idx, nodes: NODES, names: NAMES });
    const needed = r.inventions[0].ingredients.filter((i) => i.needed).map((i) => i.name);
    expect(needed).toEqual(['rice']); // basil: no pairing; parmesan: too rare here
  });

  it('scores by mean pairing and offers distinct dishes', async () => {
    const idx = index([['chicken', 'lemon', 0.9], ['lemon', 'garlic', 0.2], ['chicken', 'tomato', 0.1], ['garlic', 'tomato', 0.1]]);
    const r = await inventRecipes({ kitchen: KITCHEN, suggest: fakeSuggest(LOGITS), pairingIndex: idx, nodes: NODES, names: NAMES });
    const keys = r.inventions.map((i) => i.ingredients.map((x) => x.name).sort().join());
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(r.inventions.map((i) => i.name)).size).toBe(r.inventions.length);
    for (let i = 1; i < r.inventions.length; i++) expect(r.inventions[i - 1].score).toBeGreaterThanOrEqual(r.inventions[i].score);
    expect(r.inventions[0].why).toMatch(/chicken \+ lemon|lemon \+ chicken/);
  });

  it('says why when it cannot invent', async () => {
    expect(await inventRecipes({ kitchen: ['salt', 'olive oil'], suggest: fakeSuggest({}) })).toMatchObject({ ok: false });
    expect(await inventRecipes({ kitchen: ['chicken'], suggest: null })).toMatchObject({ ok: false, reason: expect.stringMatching(/unavailable/) });
    expect(await inventRecipes({ kitchen: ['chicken'], suggest: fakeSuggest({}) })).toMatchObject({ ok: false });
  });

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
