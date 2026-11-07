import { describe, it, expect } from 'vitest';
import {
  commonKitchenIngredients, kitchenVocab, kitchenSuggestions, missingText,
  cookbookForKitchen, realRecipesForKitchen, realRecipeHandoff, titleIngredients, closestRealRecipe,
} from '../kitchenRecipes.js';
import { SEED_RECIPES } from '../seedRecipes.js';

const RECIPES = [
  { id: 'a', name: 'Lemon Chicken', ingredients: ['chicken', 'lemon', 'garlic', 'salt', 'olive oil'] },
  { id: 'b', name: 'Tomato Rice', ingredients: ['rice', 'tomato', 'onion', 'salt'] },
  { id: 'c', name: 'Pesto Pasta', ingredients: ['pasta', 'basil', 'garlic', 'parmesan', 'olive oil'] },
  { id: 'd', name: 'Chicken Basil Rice', ingredients: ['chicken', 'basil', 'rice', 'onion'] },
];

// A tiny directions index in the directions_index.json shape.
const VOCAB = ['chicken', 'garlic', 'lemon', 'rice', 'onion', 'tomato', 'basil', 'salt', 'saffron', 'chorizo', 'butter'];
const REC = [
  { v: [0, 2, 1, 7], t: 'Garlic Lemon Chicken', d: ['Brown chicken.', 'Add garlic and lemon.'] },
  { v: [3, 5, 4, 7], t: 'Spanish Rice', d: ['Fry onion.', 'Add rice and tomato.'] },
  { v: [3, 0, 8, 9], t: 'Paella', d: ['Saffron rice with chicken and chorizo.'] },
  { v: [3, 0, 8, 9], t: 'paella', d: ['A duplicate title.'] },
  { v: [6, 10], t: 'Basil Butter', d: ['Mash.'] },
];
const INV = {};
REC.forEach((r, i) => r.v.forEach((id) => { (INV[id] ||= []).push(i); }));
const INDEX = { recipes: REC, inv: INV };

describe('commonKitchenIngredients', () => {
  it('ranks the Cookbook ingredients by use, basics excluded', () => {
    const top = commonKitchenIngredients(RECIPES, 3);
    expect(top).toEqual(['basil', 'chicken', 'garlic']); // 2 uses each; ties alphabetical
    expect(top).not.toContain('salt');
    expect(top).not.toContain('olive oil');
  });

  it('on the real Cookbook, offers everyday ingredients and no basics', () => {
    const top = commonKitchenIngredients(SEED_RECIPES, 18);
    expect(top).toHaveLength(18);
    expect(top).toEqual(expect.arrayContaining(['garlic', 'onion']));
    for (const basic of ['salt', 'olive oil', 'butter', 'sugar', 'flour', 'black pepper']) expect(top).not.toContain(basic);
  });
});

describe('kitchenVocab / kitchenSuggestions', () => {
  const vocab = kitchenVocab(['Chicken', 'chicken thigh', 'roast chicken breast with skin', 'garlic', 'black garlic', 'lemon', 'chickpea']);

  it('drops long names and lower-cases', () => {
    expect(vocab).toEqual(['black garlic', 'chicken', 'chicken thigh', 'chickpea', 'garlic', 'lemon']);
  });

  it('puts prefix matches first, shorter first, then word matches', () => {
    expect(kitchenSuggestions('chick', vocab)).toEqual(['chicken', 'chickpea', 'chicken thigh']);
    expect(kitchenSuggestions('garl', vocab)).toEqual(['garlic', 'black garlic']);
  });

  it('skips what is already in the kitchen, and an empty query gives nothing', () => {
    expect(kitchenSuggestions('chick', vocab, ['chicken'])).toEqual(['chickpea', 'chicken thigh']);
    expect(kitchenSuggestions('  ', vocab)).toEqual([]);
  });
});

describe('missingText', () => {
  it('names what is missing', () => {
    expect(missingText(['basil'])).toBe('missing basil');
    expect(missingText(['basil', 'lime'])).toBe('missing basil and lime');
    expect(missingText(['basil', 'lime', 'mint', 'rum'])).toBe('missing basil, lime and 2 more');
    expect(missingText(['basil', 'lime', 'mint'], 3)).toBe('missing basil, lime and mint');
    expect(missingText([])).toBe('');
  });
});

describe('cookbookForKitchen', () => {
  it('splits into can-make and one-or-two-away, basics assumed', () => {
    const r = cookbookForKitchen(RECIPES, ['chicken', 'lemon', 'garlic', 'rice', 'tomato']);
    expect(r.make.map((e) => e.item.id)).toEqual(['a']);
    expect(r.nearly.map((e) => e.item.id)).toEqual(['b', 'd']);
    expect(r.nearly[0].missing).toEqual(['onion']);
    expect(r.nearly[1].missing).toEqual(['basil', 'onion']);
  });

  it('without assumed basics, salt and oil count as missing', () => {
    const r = cookbookForKitchen(RECIPES, ['chicken', 'lemon', 'garlic'], { assumeBasics: false });
    expect(r.make).toEqual([]);
    expect(r.nearly[0].item.id).toBe('a');
    expect(r.nearly[0].missing).toEqual(['salt', 'olive oil']);
  });

  it('an empty kitchen makes nothing', () => {
    expect(cookbookForKitchen(RECIPES, [])).toEqual({ make: [], nearly: [] });
  });
});

describe('titleIngredients', () => {
  const V = new Set(['bean', 'pork', 'pork chop', 'rice', 'soup', 'chicken', 'cherry', 'tomato']);
  it('finds the ingredients a title names, two-word names first, dish words skipped', () => {
    expect(titleIngredients('Cajun 15 Bean Soup', V)).toEqual(['bean']);
    expect(titleIngredients('Pork Chops And Rice For Two', V)).toEqual(['pork chop', 'rice']);
    expect(titleIngredients('Cherries & Tomatoes', V)).toEqual(['cherry', 'tomato']);
    expect(titleIngredients('Easy Weeknight Supper', V)).toEqual([]);
  });

  it('a recipe whose index list lacks its headline ingredient still shows it missing', () => {
    const vocab = ['garlic', 'onion', 'tomato', 'bean', 'soup'];
    const idx = { recipes: [{ v: [0, 1, 2], t: 'Cajun 15 Bean Soup', d: ['Soak the beans.'] }], inv: { 0: [0], 1: [0], 2: [0] } };
    const [r] = realRecipesForKitchen(['garlic', 'onion', 'tomato'], idx, vocab);
    expect(r.missing).toEqual(['bean']);
    expect(r.total).toBe(4);
  });
});

describe('closestRealRecipe', () => {
  it('skips a match whose title names an ingredient the dish lacks', () => {
    const vocab = ['garlic', 'onion', 'tomato', 'bean', 'lemon'];
    const idx = {
      recipes: [
        { v: [0, 1, 2], t: 'Cajun 15 Bean Soup', d: ['Soak the beans.'] },
        { v: [0, 1, 2, 4], t: 'Tomato Lemon Skillet', d: ['Cook.'] },
      ],
      inv: { 0: [0, 1], 1: [0, 1], 2: [0, 1], 4: [1] },
    };
    expect(closestRealRecipe(['garlic', 'onion', 'tomato'], idx, vocab)).toBeNull();
    expect(closestRealRecipe(['garlic', 'onion', 'tomato', 'lemon'], idx, vocab).title).toBe('Tomato Lemon Skillet');
    expect(closestRealRecipe([], idx, vocab)).toBeNull();
  });

  it('prefers a title that names one of the dish\'s ingredients', () => {
    const vocab = ['garlic', 'onion', 'tomato'];
    const idx = {
      recipes: [
        { v: [0, 1, 2], t: 'Barbecue Wieners', d: ['Slice the wieners.'] },
        { v: [0, 1, 2], t: 'Garlicky Tomatoes', d: ['Cook.'] },
      ],
      inv: { 0: [0, 1], 1: [0, 1], 2: [0, 1] },
    };
    expect(closestRealRecipe(['garlic', 'onion', 'tomato'], idx, vocab).title).toBe('Garlicky Tomatoes');
  });
});

describe('realRecipesForKitchen', () => {
  it('ranks real recipes by what the cook has, naming what is missing', () => {
    const r = realRecipesForKitchen(['chicken', 'garlic', 'lemon', 'rice'], INDEX, VOCAB);
    expect(r[0].title).toBe('Garlic Lemon Chicken');
    expect(r[0]).toMatchObject({ covered: 3, total: 3, missing: [] });
    const paella = r.find((x) => x.title === 'Paella');
    expect(paella.missing).toEqual(['saffron', 'chorizo']);
    expect(paella.steps).toEqual(['Saffron rice with chicken and chorizo.']);
  });

  it('drops duplicate titles and recipes with only one thing in common', () => {
    const r = realRecipesForKitchen(['chicken', 'garlic', 'lemon', 'rice'], INDEX, VOCAB);
    expect(r.filter((x) => x.title.toLowerCase() === 'paella')).toHaveLength(1);
    expect(r.find((x) => x.title === 'Spanish Rice')).toBeUndefined();
  });

  it('is empty without an index or a kitchen', () => {
    expect(realRecipesForKitchen(['chicken'], null, VOCAB)).toEqual([]);
    expect(realRecipesForKitchen([], INDEX, VOCAB)).toEqual([]);
  });

  it('builds a make-kitchen handoff with the covered ingredients, title and steps', () => {
    const [m] = realRecipesForKitchen(['chicken', 'garlic', 'lemon'], INDEX, VOCAB);
    const h = realRecipeHandoff(m);
    expect(h).toMatchObject({ source: 'make-kitchen', mode: 'recipe', title: 'Garlic Lemon Chicken', steps: ['Brown chicken.', 'Add garlic and lemon.'] });
    expect(h.ingredients).toEqual(['chicken', 'lemon', 'garlic', 'salt']);
    expect(typeof h.ts).toBe('number');
  });
});
