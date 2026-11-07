// WEAK-3: main vs supporting ingredients of a Cookbook recipe.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ingredientClass, isMainIngredient, splitRecipe, categoryLookup, nameNames, RECIPE_MAINS, INGREDIENT_CLASS,
} from '../recipeMains.js';
import { SEED_RECIPES } from '../seedRecipes.js';

const INGREDIENTS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/proDataset/ingredients.json'), 'utf8'));
const categoryOf = categoryLookup(INGREDIENTS);
const cls = (name, recipe = null) => ingredientClass(name, { recipe, category: categoryOf(name) });
const byId = (id) => SEED_RECIPES.find((r) => r.id === id);

describe('ingredientClass — category defaults', () => {
  it('proteins, vegetables, grains, dairy and fruit are mains', () => {
    for (const n of ['chicken', 'beef', 'tofu', 'chickpea', 'tomato', 'potato', 'spinach', 'cream', 'cheddar', 'avocado', 'apple']) {
      expect(cls(n), n).toBe('main');
    }
  });
  it('rice, pasta and bread are mains', () => {
    for (const n of ['rice', 'pasta', 'bread', 'rice noodle', 'pita bread', 'corn tortilla']) expect(cls(n), n).toBe('main');
  });
  it('spices, herbs, condiments, sweeteners, acids, citrus and chilies are supporting', () => {
    for (const n of ['cumin', 'cinnamon', 'garam masala', 'thyme', 'parsley', 'cilantro', 'soy sauce', 'mustard',
      'brown sugar', 'honey', 'rice vinegar', 'lime', 'lemon juice', 'cayenne pepper', 'fish sauce', 'sesame seed']) {
      expect(cls(n), n).toBe('supporting');
    }
  });
  it('garlic is supporting, onion is main (see the module header for why)', () => {
    expect(cls('garlic')).toBe('supporting');
    expect(cls('ginger')).toBe('supporting');
    expect(cls('scallion')).toBe('supporting');
    expect(cls('onion')).toBe('main');
    expect(cls('purple onion')).toBe('main');
  });
  it('wine is supporting; stock and coconut milk are mains', () => {
    expect(cls('white wine')).toBe('supporting');
    expect(cls('red wine')).toBe('supporting');
    expect(cls('beef stock')).toBe('main');
    expect(cls('coconut milk')).toBe('main');
  });
  it('hard cheeses filed under "umami" are mains; coatings are supporting', () => {
    expect(cls('parmesan')).toBe('main');
    expect(cls('pecorino')).toBe('main');
    expect(cls('panko')).toBe('supporting');
    expect(cls('garlic crouton')).toBe('supporting');
  });
});

describe('ingredientClass — the recipe decides', () => {
  it('an ingredient the name names is a main (Garlic Naan, Butter Chicken, Saffron Risotto)', () => {
    expect(cls('garlic', byId('garlic-naan'))).toBe('main');
    expect(cls('garlic', byId('garlic-bok-choy'))).toBe('main');
    expect(cls('butter', byId('butter-chicken'))).toBe('main');
    expect(cls('saffron', byId('risotto-saffron'))).toBe('main');
    expect(cls('saffron', byId('paella'))).toBe('supporting');
  });
  it('a word inside another word does not count ("Pho" names no "ho")', () => {
    expect(nameNames('Chicken Satay', 'chicken')).toBe(true);
    expect(nameNames('Chocolate Chip Cookies', 'chocolate chip')).toBe(true);
    expect(nameNames('Cheeseburger', 'cheese')).toBe(false);
  });
  it('flavourings that are the dish are mains for that dish only', () => {
    expect(cls('basil', byId('pesto-genovese'))).toBe('main');
    expect(cls('basil', byId('lasagna'))).toBe('supporting');
    expect(cls('curry paste', byId('thai-green-curry'))).toBe('main');
    expect(cls('red wine', byId('coq-au-vin'))).toBe('main');
    expect(cls('red wine', byId('beef-bolognese'))).toBe('supporting');
    expect(cls('peanut', byId('kung-pao-chicken'))).toBe('main');
  });
  it('in a bake or dessert, sugar, butter, yeast, gelatin and nuts are structure', () => {
    expect(cls('butter', byId('croissant'))).toBe('main');
    expect(cls('yeast', byId('margherita-pizza'))).toBe('main');
    expect(cls('gelatin', byId('panna-cotta'))).toBe('main');
    expect(cls('walnut', byId('baklava'))).toBe('main');
    expect(cls('butter', byId('mac-and-cheese'))).toBe('supporting');
  });
  it('every override names an ingredient the recipe really has', () => {
    for (const [id, list] of Object.entries(RECIPE_MAINS)) {
      const r = byId(id);
      expect(r, id).toBeTruthy();
      for (const n of list) expect(r.ingredients, `${id}: ${n}`).toContain(n);
    }
    expect(Object.keys(INGREDIENT_CLASS).length).toBeLessThan(25);
  });
  it('every Cookbook recipe has at least two mains', () => {
    for (const r of SEED_RECIPES) {
      const { main } = splitRecipe(r, { categoryOf });
      expect(main.length, r.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('without a category (no graph loaded) the name decides', () => {
  it('guesses from the name', () => {
    expect(isMainIngredient('chicken', {})).toBe(true);
    expect(isMainIngredient('lentil', {})).toBe(true);
    expect(isMainIngredient('cumin', {})).toBe(false);
    expect(isMainIngredient('lemon', {})).toBe(false);
    expect(isMainIngredient('thyme', {})).toBe(false);
    expect(isMainIngredient('onion', {})).toBe(true);
  });
  it('categoryLookup reads a Map or an object of nodes', () => {
    expect(categoryLookup(new Map([['rice', { category: 'grain' }]]))('Rice')).toBe('grain');
    expect(categoryLookup({ rice: { category: 'grain' } })('rice')).toBe('grain');
    expect(categoryLookup(null)('rice')).toBe(null);
  });
});
