import { describe, it, expect } from 'vitest';
import { pickStarterIngredients, STARTER_CATEGORIES } from '../notebookStarters.js';

const node = (name, category, pairingCount = 0) => ({ name, category, pairingCount });

describe('pickStarterIngredients', () => {
  it('takes the most-paired ingredient of each starter category, in category order', () => {
    const nodes = new Map([
      ['carrot', node('carrot', 'vegetable', 5)],
      ['tomato', node('tomato', 'vegetable', 50)],
      ['onion', node('onion', 'aromatic', 80)],
      ['basil', node('basil', 'herb', 20)],
      ['chicken', node('chicken', 'protein', 90)],
    ].map(([k, v]) => [k, v]));
    expect(pickStarterIngredients(nodes).map((s) => s.name)).toEqual(['tomato', 'onion', 'basil']);
  });

  it('skips pantry staples and fills from later categories when one is missing', () => {
    const nodes = [
      node('sugar', 'sweetener', 999),
      node('butter', 'fat', 999),
      node('garlic', 'aromatic', 3),
      node('lemon', 'citrus', 2),
      node('salmon', 'protein', 1),
    ];
    expect(pickStarterIngredients(nodes).map((s) => s.name)).toEqual(['garlic', 'salmon', 'lemon']);
  });

  it('accepts a plain object, honours count, and is empty on no data', () => {
    const obj = { a: node('apple', 'fruit', 1), b: node('kale', 'vegetable', 1) };
    expect(pickStarterIngredients(obj, 1)).toEqual([{ name: 'kale', category: 'vegetable' }]);
    expect(pickStarterIngredients(null)).toEqual([]);
    expect(pickStarterIngredients(new Map())).toEqual([]);
  });

  it('breaks pairing-count ties alphabetically (deterministic)', () => {
    const nodes = [node('parsley', 'herb', 4), node('basil', 'herb', 4)];
    expect(pickStarterIngredients(nodes)[0].name).toBe('basil');
  });

  it('starter categories exclude the pantry staples', () => {
    for (const c of ['sweetener', 'fat', 'grain', 'liquid', 'condiment']) {
      expect(STARTER_CATEGORIES).not.toContain(c);
    }
  });
});
