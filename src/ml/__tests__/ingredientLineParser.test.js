import { describe, it, expect } from 'vitest';
import { parseIngredientLine, isPlausible } from '../ingredientLineParser.js';

const p = (line, name) => {
  const a = parseIngredientLine(line, name);
  return a && { unit: a.unit, qty: +a.qty.toFixed(3), dimension: a.dimension };
};

describe('WEAK-4 parseIngredientLine — the artefacts that made "each" win', () => {
  it('converts parenthetical package sizes to weight', () => {
    expect(p('1 (16 oz.) pkg. spaghetti')).toEqual({ unit: 'oz', qty: 16, dimension: 'weight' });
    expect(p('2 (10 3/4 oz.) cans cream of mushroom soup')).toEqual({ unit: 'oz', qty: 21.5, dimension: 'weight' });
    expect(p('1 pkg. (8 oz.) cream cheese')).toEqual({ unit: 'oz', qty: 8, dimension: 'weight' });
    expect(p('2 (6 oz.) salmon fillets')).toEqual({ unit: 'oz', qty: 12, dimension: 'weight' });
    expect(p('1 (3 to 4 lb.) chicken')).toEqual({ unit: 'lb', qty: 3.5, dimension: 'weight' });
  });
  it('reads plural and abbreviated unit words', () => {
    expect(p('2 lbs. chicken')).toEqual({ unit: 'lb', qty: 2, dimension: 'weight' });
    expect(p('3 pounds potatoes')).toEqual({ unit: 'lb', qty: 3, dimension: 'weight' });
    expect(p('1 1/2 cups milk')).toEqual({ unit: 'cup', qty: 1.5, dimension: 'volume' });
    expect(p('2 tablespoons olive oil')).toEqual({ unit: 'tbsp', qty: 2, dimension: 'volume' });
    expect(p('8 ounces cheddar')).toEqual({ unit: 'oz', qty: 8, dimension: 'weight' });
  });
  it('keeps capital T as tablespoon and small t as teaspoon', () => {
    expect(p('1 T. butter')).toEqual({ unit: 'tbsp', qty: 1, dimension: 'volume' });
    expect(p('1 t salt')).toEqual({ unit: 'tsp', qty: 1, dimension: 'volume' });
    expect(p('1 c. sugar')).toEqual({ unit: 'cup', qty: 1, dimension: 'volume' });
  });
  it('finds count nouns: cloves, cans, dozens, sticks', () => {
    expect(p('3 cloves garlic, minced')).toEqual({ unit: 'clove', qty: 3, dimension: 'count' });
    expect(p('2 garlic cloves')).toEqual({ unit: 'clove', qty: 2, dimension: 'count' });
    expect(p('1 small jar pimentos')).toEqual({ unit: 'pkg', qty: 1, dimension: 'count' });
    expect(p('1 dozen eggs')).toEqual({ unit: 'dozen', qty: 1, dimension: 'count' });
    expect(p('1 stick butter', 'butter')).toEqual({ unit: 'stick', qty: 1, dimension: 'volume' });
    expect(p('2 cinnamon sticks', 'cinnamon')).toEqual({ unit: 'each', qty: 2, dimension: 'count' });
  });
  it('true counts stay counts', () => {
    expect(p('4 boned chicken breasts')).toEqual({ unit: 'each', qty: 4, dimension: 'count' });
    expect(p('1 large onion')).toEqual({ unit: 'each', qty: 1, dimension: 'count' });
    expect(p('2 lg. eggs')).toEqual({ unit: 'each', qty: 2, dimension: 'count' });
  });
  it('ranges, unicode fractions, modifiers', () => {
    expect(p('1 to 2 tsp. salt')).toEqual({ unit: 'tsp', qty: 1.5, dimension: 'volume' });
    expect(p('½ cup sugar')).toEqual({ unit: 'cup', qty: 0.5, dimension: 'volume' });
    expect(p('1½ c. flour')).toEqual({ unit: 'cup', qty: 1.5, dimension: 'volume' });
    expect(p('1 heaping tsp. baking soda')).toEqual({ unit: 'tsp', qty: 1, dimension: 'volume' });
  });
  it('rejects lines without a leading amount and implausible amounts', () => {
    expect(parseIngredientLine('Salt and pepper')).toBeNull();
    expect(parseIngredientLine('')).toBeNull();
    expect(isPlausible(parseIngredientLine('350 degrees'))).toBe(false);
    expect(isPlausible(parseIngredientLine('2 c. flour'))).toBe(true);
  });
});
