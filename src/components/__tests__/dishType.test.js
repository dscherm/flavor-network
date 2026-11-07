import { describe, it, expect } from 'vitest';
import { SEED_RECIPES, userRecipeToSeed } from '../../data/seedRecipes.js';
import { dishTypeOf, dishTypeLabel, DISH_TYPES } from '../../data/dishType.js';
import { DISH_ART_KINDS } from '../chalkArt.jsx';

describe('dishTypeOf (DESIGN-3)', () => {
  it('gives every one of the 83 seed recipes a real dish type (never the generic plate)', () => {
    expect(SEED_RECIPES).toHaveLength(83);
    const generic = SEED_RECIPES.filter((r) => dishTypeOf(r) === 'plate').map((r) => r.name);
    expect(generic).toEqual([]);
    for (const r of SEED_RECIPES) expect(Object.keys(DISH_TYPES)).toContain(dishTypeOf(r));
  });

  it('every dish type has a chalk drawing', () => {
    for (const t of Object.keys(DISH_TYPES)) expect(DISH_ART_KINDS).toContain(t);
  });

  it.each([
    ['miso-soup', 'soup'], ['clam-chowder', 'soup'], ['pho', 'noodles'], ['pad-thai', 'noodles'],
    ['beef-bolognese', 'pasta'], ['mac-and-cheese', 'pasta'], ['biryani', 'rice'], ['sushi-roll', 'rice'],
    ['thai-green-curry', 'curry'], ['dal-tadka', 'curry'], ['beef-bourguignon', 'stew'],
    ['chicken-satay', 'grill'], ['teriyaki-salmon', 'fish'], ['greek-salad', 'salad'],
    ['mapo-tofu', 'wok'], ['tacos-al-pastor', 'taco'], ['banh-mi', 'sandwich'], ['cheeseburger', 'sandwich'],
    ['chicken-shawarma', 'wrap'], ['falafel', 'wrap'], ['chicken-enchiladas', 'wrap'],
    ['pork-gyoza', 'dumpling'], ['samosa', 'dumpling'], ['hummus', 'dip'], ['shakshuka', 'skillet'],
    ['margherita-pizza', 'pizza'], ['croissant', 'bake'], ['garlic-naan', 'bake'],
    ['tiramisu', 'dessert'], ['apple-pie', 'dessert'], ['elote', 'veg'],
  ])('%s → %s', (id, type) => {
    expect(dishTypeOf(SEED_RECIPES.find((r) => r.id === id))).toBe(type);
  });

  it('derives a type for user-saved recipes from their ingredients, and falls back to plate', () => {
    const pasta = userRecipeToSeed({ name: 'Tuesday thing', ingredients: ['spaghetti', 'garlic', 'chili'] }, 0);
    expect(dishTypeOf(pasta)).toBe('pasta');
    expect(dishTypeOf(userRecipeToSeed({ name: 'Mystery', ingredients: ['water'] }, 1))).toBe('plate');
    expect(dishTypeOf(null)).toBe('plate');
    expect(dishTypeLabel('nope')).toBe(DISH_TYPES.plate);
  });
});
