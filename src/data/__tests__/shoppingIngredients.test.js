// SHOP-2: the shopping screen's ingredient loader fetches ONLY the curated ingredient table, once, lazily.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadShoppingIngredients, resetShoppingIngredients, shapeIngredients } from '../shoppingIngredients.js';

const table = { milk: { category: 'dairy' }, 'brown sugar': { category: 'sweetener' }, _meta: { category: 'x' }, odd: null };
const ok = (body) => ({ ok: true, json: async () => body });

beforeEach(() => resetShoppingIngredients());

describe('loadShoppingIngredients', () => {
  it('fetches nothing until asked, then only ingredients.json (never the pairings), and caches', async () => {
    const fetchFn = vi.fn(async () => ok(table));
    expect(fetchFn).not.toHaveBeenCalled();
    const a = await loadShoppingIngredients(fetchFn);
    const b = await loadShoppingIngredients(fetchFn);
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/proDataset/ingredients.json']);
    expect(a).toBe(b);
    expect(a.names.has('milk') && a.names.has('brown sugar')).toBe(true);
    expect(a.names.has('_meta')).toBe(false); // the curation additions (bar entries) are in too, so no exact-set check
    expect(a.categories.get('milk')).toBe('dairy');
    expect(a.vocab).toContain('brown sugar');
  });

  it('a failed load is not cached: the next open tries again', async () => {
    const bad = vi.fn(async () => ({ ok: false }));
    await expect(loadShoppingIngredients(bad)).rejects.toThrow();
    const good = vi.fn(async () => ok(table));
    expect((await loadShoppingIngredients(good)).names.has('milk')).toBe(true);
  });

  it('shapeIngredients skips meta keys and empty entries', () => {
    const names = shapeIngredients(table).names;
    expect(names.has('_meta') || names.has('odd')).toBe(false);
    expect(names.size).toBe(2);
  });
});
