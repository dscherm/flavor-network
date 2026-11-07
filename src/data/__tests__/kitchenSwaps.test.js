// WEAK-3: the everyday swap table. Check (d): no swap crosses roles.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SWAPS, swapsFor, findSwap, swapUseText } from '../kitchenSwaps.js';
import { ingredientClass, categoryLookup } from '../recipeMains.js';
import { sauceRoleOf, sameRoleAndKind } from '../saucePantry.js';

const INGREDIENTS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../public/proDataset/ingredients.json'), 'utf8'));
const categoryOf = categoryLookup(INGREDIENTS);
// Names a cook types that the ingredient graph has no node for.
const NOT_IN_GRAPH = new Set(['vegetable oil', 'spaghetti']);

describe('swap table — check (d): never across roles', () => {
  it('both sides have the declared ingredient-graph category', () => {
    for (const s of SWAPS) {
      for (const n of [s.for, s.use]) {
        if (NOT_IN_GRAPH.has(n)) continue;
        expect(categoryOf(n), `${s.use} for ${s.for}: ${n}`).toBe(s.role);
      }
    }
  });
  it('pan-fat swaps (butter ↔ oil) are between two supporting items only', () => {
    // Class otherwise depends on the recipe (onion is a main, scallion a
    // garnish, yet onion for scallion is the textbook swap), so the role is
    // the graph category above, and supportingOnly guards the fat swaps.
    for (const s of SWAPS.filter((x) => x.supportingOnly)) {
      expect(ingredientClass(s.for, { category: s.role })).toBe('supporting');
      expect(ingredientClass(s.use, { category: s.role })).toBe('supporting');
    }
    expect(SWAPS.filter((x) => x.role === 'fat' && x.kind === 'cooking fat').every((x) => x.supportingOnly)).toBe(true);
  });
  it('the Sauce Lab role agrees wherever it knows both sides', () => {
    for (const s of SWAPS) {
      const a = sauceRoleOf(s.for);
      const b = sauceRoleOf(s.use);
      if (a && b) expect(a, `${s.use} for ${s.for}`).toBe(b);
    }
  });
  it('never contradicts the Sauce Lab stand-in rule: a same-role-and-kind pair is never marked "not in a sauce"', () => {
    for (const s of SWAPS) {
      if (s.sauce === false) expect(sameRoleAndKind(s.for, s.use), `${s.use} for ${s.for}`).toBe(false);
    }
  });
  it('a few swaps that must never exist', () => {
    const has = (f, u) => SWAPS.some((s) => s.for === f && s.use === u);
    expect(has('onion', 'garlic')).toBe(false);
    expect(has('garlic', 'onion')).toBe(false);
    expect(has('egg yolk', 'flour')).toBe(false);
    expect(has('red wine', 'stock')).toBe(false); // red wine is the dish in coq au vin
    expect(SWAPS.every((s) => s.for !== s.use)).toBe(true);
  });
  it('covers the everyday swaps the brief names', () => {
    const has = (f, u) => SWAPS.some((s) => s.for === f && s.use === u);
    expect(has('scallion', 'onion')).toBe(true);
    expect(has('shallot', 'onion')).toBe(true);
    expect(has('parsley', 'cilantro') && has('cilantro', 'parsley')).toBe(true);
    expect(has('white wine', 'chicken stock')).toBe(true);
    expect(has('yogurt', 'sour cream') && has('sour cream', 'yogurt')).toBe(true);
    expect(has('creme fraiche', 'sour cream') && has('creme fraiche', 'cream')).toBe(true);
    expect(has('butter', 'olive oil') && has('olive oil', 'butter')).toBe(true);
    expect(has('lime', 'lemon') && has('lemon', 'lime')).toBe(true);
    expect(has('honey', 'sugar') && has('honey', 'maple syrup')).toBe(true);
    expect(SWAPS.find((s) => s.for === 'cream' && s.use === 'milk').plus).toEqual(['butter']);
    expect(SWAPS.find((s) => s.for === 'buttermilk' && s.use === 'milk').plus).toEqual(['lemon']);
  });
});

describe('findSwap', () => {
  const kitchen = (...items) => (x) => items.includes(x);
  it('finds a swap the kitchen can make', () => {
    expect(findSwap('scallion', kitchen('onion'))).toMatchObject({ for: 'scallion', use: 'onion' });
    expect(swapsFor('Scallion').length).toBeGreaterThan(0);
  });
  it('needs every helper (milk + butter for cream)', () => {
    expect(findSwap('cream', kitchen('milk'))).toBeNull();
    const s = findSwap('cream', kitchen('milk', 'butter'));
    expect(s).toMatchObject({ use: 'milk', plus: ['butter'] });
    expect(swapUseText(s)).toBe('milk and butter');
  });
  it('butter ↔ oil only when the fat is a supporting item (not a pastry)', () => {
    expect(findSwap('butter', kitchen('olive oil'))).toMatchObject({ use: 'olive oil' });
    expect(findSwap('butter', kitchen('olive oil'), { main: true })).toBeNull();
  });
  it('does not double up an item the recipe already uses', () => {
    expect(findSwap('parsley', kitchen('cilantro'), { inRecipe: new Set(['parsley', 'cilantro']) })).toBeNull();
  });
  it('in a sauce, only swaps that hold in a sauce', () => {
    expect(findSwap('white wine', kitchen('chicken stock'))).toMatchObject({ use: 'chicken stock' });
    expect(findSwap('white wine', kitchen('chicken stock'), { sauce: true })).toBeNull();
    expect(findSwap('lime', kitchen('lemon'), { sauce: true })).toMatchObject({ use: 'lemon' });
  });
  it('nothing for an item with no swap', () => {
    expect(findSwap('saffron', kitchen('turmeric'))).toBeNull();
  });
});
