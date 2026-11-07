// WEAK-3: spice rack, kitchen aliases, main/supporting coverage and swaps
// in myKitchen / whatDoINeed / saucePantry, plus the fixed-kitchen checks
// (a) and (b) from docs/kitchen-makeable.md.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  kitchenKey, haveIngredient, coverIngredients, whatCanICook,
  loadSpiceRack, saveSpiceRack, SPICE_RACK, SPICE_RACK_KEY, isSpiceRackItem,
} from '../myKitchen.js';
import { needsFromKitchen, shoppingListText } from '../whatDoINeed.js';
import { sauceRoleOf, sameRoleAndKind, whatSauceCanIMake } from '../saucePantry.js';
import { cookbookForKitchen } from '../kitchenRecipes.js';
import { categoryLookup, splitRecipe } from '../recipeMains.js';
import { findSwap } from '../kitchenSwaps.js';
import { resolveIngredientName } from '../recipePairingMatch.js';
import { SEED_RECIPES } from '../seedRecipes.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('spice rack', () => {
  it('is off by default and stored like assume-basics', () => {
    const s = memory();
    expect(SPICE_RACK_KEY).toBe('fn-my-kitchen-spices');
    expect(loadSpiceRack(s)).toBe(false);
    saveSpiceRack(true, s);
    expect(s.getItem(SPICE_RACK_KEY)).toBe('1');
    expect(loadSpiceRack(s)).toBe(true);
    saveSpiceRack(false, s);
    expect(loadSpiceRack(s)).toBe(false);
  });
  it('when on, common dried spices count as on hand, like basics', () => {
    for (const n of SPICE_RACK) {
      expect(haveIngredient(n, new Set(), { spiceRack: true }), n).toMatchObject({ covered: true, basic: true, spice: true });
    }
    expect(haveIngredient('cumin', new Set()).covered).toBe(false);
    expect(haveIngredient('ground cumin', new Set(), { spiceRack: true }).covered).toBe(true);
    expect(haveIngredient('cayenne pepper', new Set(), { spiceRack: true }).covered).toBe(true);
    expect(isSpiceRackItem('Bay Leaf')).toBe(true);
  });
  it('does not cover saffron, fresh herbs or cilantro (fresh coriander leaf)', () => {
    for (const n of ['saffron', 'cilantro', 'parsley', 'basil', 'vanilla']) {
      expect(haveIngredient(n, new Set(), { spiceRack: true }).covered, n).toBe(false);
    }
  });
});

describe('kitchen names', () => {
  it('"bell pepper" is stored as the sweet pepper recipes use; "vegetable oil" stays oil', () => {
    const graph = new Set(['pepper', 'sweet pepper', 'vegetable']);
    expect(kitchenKey('bell pepper', graph)).toBe('sweet pepper');
    expect(kitchenKey('Red Bell Pepper', graph)).toBe('sweet pepper');
    expect(kitchenKey('vegetable oil', graph)).toBe('vegetable oil');
  });
  it('a tortilla covers a corn tortilla', () => {
    expect(haveIngredient('corn tortilla', new Set(['tortilla'])).covered).toBe(true);
  });
});

describe('coverIngredients / whatCanICook — mains and swaps', () => {
  it('split mode: only mains count; a missing flavouring goes to "better"', () => {
    const mainOf = (n) => ['lentil', 'rice', 'onion'].includes(n);
    const c = coverIngredients(['lentil', 'rice', 'onion', 'cumin', 'olive oil'], ['lentil', 'rice', 'onion'], { mainOf });
    expect(c).toMatchObject({ total: 3, covered: 3, missing: [], better: ['cumin'] });
    const d = coverIngredients(['lentil', 'rice', 'onion', 'cumin'], ['rice', 'onion', 'cumin'], { mainOf });
    expect(d.missing).toEqual(['lentil']);
    expect(d.better).toEqual([]);
  });
  it('a missing item the kitchen can swap counts, and is listed; no swaps unless asked', () => {
    const c = coverIngredients(['pork', 'scallion', 'garlic'], ['pork', 'onion', 'garlic'], { swaps: true });
    expect(c.missing).toEqual([]);
    expect(c.swaps).toEqual([{ for: 'scallion', use: 'onion', plus: [], main: true }]);
    expect(coverIngredients(['pork', 'scallion'], ['pork', 'onion']).missing).toEqual(['scallion']);
  });
  it('recipes made with a swap of a main are marked and listed after the ones without', () => {
    const items = [
      { name: 'Fried Chicken', ingredients: ['chicken', 'buttermilk', 'flour', 'paprika'] },
      { name: 'Roast Chicken', ingredients: ['chicken', 'potato', 'thyme'] },
    ];
    const mains = new Set(['chicken', 'buttermilk', 'flour', 'potato']);
    const r = whatCanICook(items, ['chicken', 'potato', 'milk', 'lemon'], { mainOfItem: () => (n) => mains.has(n), swaps: true });
    expect(r.make.map((e) => e.item.name)).toEqual(['Roast Chicken', 'Fried Chicken']);
    expect(r.make[1].withSwap).toBe(true);
    expect(r.make[1].swaps[0]).toMatchObject({ for: 'buttermilk', use: 'milk', plus: ['lemon'] });
    expect(r.make[0].better).toEqual(['thyme']);
  });
});

describe('needsFromKitchen — "You need", "Even better with", swaps', () => {
  const recipe = ['chicken', 'buttermilk', 'flour', 'paprika', 'cayenne pepper', 'garlic', 'salt'];
  const mainOf = (n) => ['chicken', 'buttermilk', 'flour'].includes(n);
  it('missing flavourings are "even better with", not "you need"', () => {
    const n = needsFromKitchen(recipe, ['chicken', 'buttermilk', 'garlic'], { mainOf });
    expect(n.missing).toEqual([]);
    expect(n.better.map((b) => b.name)).toEqual(['paprika', 'cayenne pepper']);
    expect(n.total).toBe(3);
  });
  it('a swap from the kitchen counts as had and is listed', () => {
    const n = needsFromKitchen(recipe, ['chicken', 'milk', 'lemon'], { mainOf, swaps: true });
    expect(n.missing).toEqual([]);
    expect(n.swaps).toEqual([{ name: 'buttermilk', use: 'milk and lemon', amount: '' }]);
    expect(n.have.find((h) => h.name === 'buttermilk')).toMatchObject({ swap: 'milk and lemon' });
  });
  it('the spice rack moves spices to "assumed on hand"', () => {
    const n = needsFromKitchen(recipe, ['chicken', 'buttermilk'], { mainOf, spiceRack: true });
    expect(n.basics).toEqual(expect.arrayContaining(['paprika', 'cayenne pepper', 'flour', 'salt']));
    expect(n.better.map((b) => b.name)).toEqual(['garlic']);
  });
  it('without mainOf everything missing is "you need" (sauces stay strict)', () => {
    const n = needsFromKitchen(['butter', 'parsley', 'shallot'], ['shallot']);
    expect(n.missing.map((m) => m.name)).toEqual(['parsley']);
    expect(n.better).toEqual([]);
  });
  it('the shopping list puts "even better with" after what you need', () => {
    expect(shoppingListText('Fried Chicken', [{ name: 'buttermilk', amount: '2 cups' }], [], [{ name: 'paprika', amount: '' }]))
      .toBe('Shopping list for Fried Chicken:\n- 2 cups buttermilk\n\nEven better with:\n- paprika');
  });
});

describe('Sauce Lab stays strict', () => {
  it('a vinegar is an acid, even a cider or wine vinegar (no "cider vinegar for white wine")', () => {
    expect(sauceRoleOf('apple cider vinegar')).toBe('Acid');
    expect(sauceRoleOf('red wine vinegar')).toBe('Acid');
    expect(sameRoleAndKind('apple cider vinegar', 'white wine')).toBe(false);
  });
  it('the spice rack counts in the pantry; a missing herb is still missing', () => {
    const sauce = { name: 'Paprika Butter', ingredients: ['butter', 'paprika', 'shallot'] };
    expect(whatSauceCanIMake([sauce], ['shallot']).make).toEqual([]);
    expect(whatSauceCanIMake([sauce], ['shallot'], { spiceRack: true }).make.map((e) => e.item.name)).toEqual(['Paprika Butter']);
    const herb = { name: 'Herb Butter', ingredients: ['butter', 'parsley', 'shallot'] };
    expect(whatSauceCanIMake([herb], ['shallot']).nearly[0].missing).toEqual(['parsley']);
  });
});

describe('fixed kitchens — checks (a) and (b)', () => {
  const INGREDIENTS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/proDataset/ingredients.json'), 'utf8'));
  const names = new Set(Object.keys(INGREDIENTS));
  const categoryOf = categoryLookup(INGREDIENTS);
  const asKitchen = (s) => [...new Set(s.split(', ').map((x) => kitchenKey(x, names)))];
  const K30 = asKitchen('chicken, garlic, lemon, rice, onion, tomato, pasta, parmesan, basil, egg, potato, carrot, beef, milk, cheddar, bell pepper, cumin, paprika, soy sauce, ginger, cilantro, lime, black beans, tortilla, bread, cream, mushroom, spinach, chili, honey');
  const K6 = asKitchen('chicken, garlic, lemon, rice, onion, tomato');

  const allMainsCovered = (recipe, kitchen, opts) => {
    const { main } = splitRecipe(recipe, { categoryOf, resolve: (n) => resolveIngredientName(n, names) });
    const set = new Set(kitchen);
    const has = (x) => haveIngredient(x, set, { ...opts, names }).covered;
    const inRecipe = new Set(recipe.ingredients);
    return main.every((m) => has(m) || findSwap(m, has, { main: true, inRecipe }));
  };

  it('(a) 30-item kitchen: 0 → 6 makeable, each with every main covered', () => {
    const before = whatCanICook(SEED_RECIPES, K30, { names });
    expect(before.make).toHaveLength(0);
    for (const spiceRack of [false, true]) {
      const r = cookbookForKitchen(SEED_RECIPES, K30, { names, categoryOf, spiceRack });
      expect(r.make.map((e) => e.item.id).sort()).toEqual(
        ['butter-chicken', 'buttermilk-pancakes', 'creme-brulee', 'fried-chicken', 'mac-and-cheese', 'patatas-bravas'],
      );
      for (const e of r.make) expect(allMainsCovered(e.item, K30, { spiceRack }), e.item.id).toBe(true);
    }
  });
  it('(b) 6-item kitchen: still 0 makeable, but more are one main away', () => {
    const before = whatCanICook(SEED_RECIPES, K6, { names });
    const r = cookbookForKitchen(SEED_RECIPES, K6, { names, categoryOf });
    expect(r.make).toHaveLength(0);
    expect(r.nearly.length).toBeGreaterThan(before.nearly.length);
  });
});
