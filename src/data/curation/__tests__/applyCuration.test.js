import { describe, it, expect } from 'vitest';
import { applyCuration } from '../applyCuration.js';

const ing = () => ({
  _meta: { note: 'keep me' },
  peach: { category: 'fruit', taste: 'sweet', sources: ['recipenlg'], totalCount: 10 },
  peache: { category: 'fruit', taste: 'sweet sour', sources: ['recipenlg', 'mealdb'], totalCount: 90 },
  gin: { category: 'spirit', taste: 'bitter', sources: ['cocktaildb'], totalCount: 5 },
  basil: { category: 'herb', taste: 'sweet', sources: ['recipenlg'], totalCount: 7 },
  fryer: { category: 'other', taste: 'umami', sources: ['recipenlg'], totalCount: 3 },
  velveeta: { category: 'dairy', taste: 'salty', sources: ['recipenlg'], totalCount: 4 },
});
const pairs = () => [
  { ingredientA: 'peache', ingredientB: 'basil', strength: 0.9, known: false, cooccurrence: 0.2, note: 'variant' },
  { ingredientA: 'basil', ingredientB: 'peach', strength: 0.4, known: true, cooccurrence: 0.5, note: 'canonical' },
  { ingredientA: 'peache', ingredientB: 'peach', strength: 1, known: true },
  { ingredientA: 'peache', ingredientB: 'gin', strength: 0.3, known: true, count: 2 },
  { ingredientA: 'gin', ingredientB: 'peach', strength: 0.6, known: true, count: 5 },
  { ingredientA: 'fryer', ingredientB: 'gin', strength: 0.5 },
  { ingredientA: 'gin', ingredientB: 'basil', strength: 0.7, known: true },
];
const tables = { aliases: { peache: { to: 'peach', reason: 'r' } }, hidden: { fryer: { reason: 'r' } }, packaged: { velveeta: { reason: 'r' } } };
const find = (list, a, b) => list.find((p) => (p.ingredientA === a && p.ingredientB === b) || (p.ingredientA === b && p.ingredientB === a));

describe('applyCuration', () => {
  it('folds an alias into its canonical entry: counts summed, sources unioned, variant gone', () => {
    const { ingredients, report } = applyCuration(ing(), pairs(), tables);
    expect(ingredients.peache).toBeUndefined();
    expect(ingredients.peach.totalCount).toBe(100);
    expect(ingredients.peach.sources).toEqual(['recipenlg', 'mealdb']);
    expect(ingredients.peach.taste).toBe('sweet');
    expect(ingredients._meta).toEqual({ note: 'keep me' });
    expect(report.aliasesApplied).toEqual(['peache']);
  });

  it('re-points pairings, keeps the stronger score, and lets observed win the other fields', () => {
    const { pairings } = applyCuration(ing(), pairs(), tables);
    const basil = find(pairings, 'peach', 'basil');
    expect(basil.strength).toBe(0.9);
    expect(basil.known).toBe(true);
    expect(basil.note).toBe('canonical');
    expect(basil.cooccurrence).toBe(0.5);
    const g = find(pairings, 'peach', 'gin');
    expect(g.strength).toBe(0.6);
    expect(g.count).toBe(7);
    expect(pairings.filter((p) => [p.ingredientA, p.ingredientB].includes('peache'))).toHaveLength(0);
  });

  it('drops the self-pair a merge creates, and every pairing of a hidden entry', () => {
    const { pairings, report } = applyCuration(ing(), pairs(), tables);
    expect(find(pairings, 'peach', 'peach')).toBeUndefined();
    expect(pairings.some((p) => p.ingredientA === 'fryer' || p.ingredientB === 'fryer')).toBe(false);
    expect(report.pairingsDropped).toBe(2);
    expect(report.pairingsMerged).toBe(2);
    expect(pairings).toHaveLength(3);
  });

  it('removes hidden ingredients and flags packaged ones', () => {
    const { ingredients } = applyCuration(ing(), pairs(), tables);
    expect(ingredients.fryer).toBeUndefined();
    expect(ingredients.velveeta.packaged).toBe(true);
    expect(ingredients.basil.packaged).toBeUndefined();
  });

  it('applies category and taste overrides and additions', () => {
    const t = {
      categoryOverrides: { gin: { category: 'spirit', reason: 'r' }, basil: { category: 'spice', reason: 'r' } },
      tasteOverrides: { basil: { taste: 'neutral', reason: 'r' } },
      additions: { 'rye whiskey': { category: 'spirit', taste: 'bitter', reason: 'r' } },
    };
    const { ingredients, report } = applyCuration(ing(), null, t);
    expect(ingredients.basil).toMatchObject({ category: 'spice', taste: 'neutral' });
    expect(ingredients['rye whiskey']).toMatchObject({ category: 'spirit', taste: 'bitter', totalCount: 0 });
    expect(report.additionsApplied).toEqual(['rye whiskey']);
  });

  it('can be the target of an alias when the canonical comes from additions', () => {
    const t = { aliases: { peache: { to: 'peach melba', reason: 'r' } }, additions: { 'peach melba': { category: 'fruit', taste: 'sweet', reason: 'r' } } };
    const { ingredients } = applyCuration(ing(), null, t);
    expect(ingredients.peache).toBeUndefined();
    expect(ingredients['peach melba'].totalCount).toBe(90);
  });

  it('reports an alias to a missing canonical and leaves the variant alone', () => {
    const t = { aliases: { peache: { to: 'nowhere', reason: 'r' } } };
    const { ingredients, pairings, report } = applyCuration(ing(), pairs(), t);
    expect(ingredients.peache).toBeDefined();
    expect(report.aliasesMissingCanonical).toEqual(['peache']);
    expect(pairings).toHaveLength(pairs().length);
  });

  it('reports table entries that name something absent instead of throwing', () => {
    const t = {
      aliases: { ghost: { to: 'peach', reason: 'r' } }, hidden: { phantom: { reason: 'r' } }, packaged: { spectre: { reason: 'r' } },
      categoryOverrides: { wraith: { category: 'x', reason: 'r' } }, tasteOverrides: { shade: { taste: 'x', reason: 'r' } },
    };
    const { report } = applyCuration(ing(), pairs(), t);
    expect(report).toMatchObject({ aliasesAbsent: ['ghost'], hiddenAbsent: ['phantom'], packagedAbsent: ['spectre'], categoryAbsent: ['wraith'], tasteAbsent: ['shade'] });
  });

  it('is idempotent', () => {
    const once = applyCuration(ing(), pairs(), tables);
    const twice = applyCuration(once.ingredients, once.pairings, tables);
    expect(twice.ingredients).toEqual(once.ingredients);
    expect(twice.pairings).toEqual(once.pairings);
  });

  it('does not mutate its inputs, and skips the pairing merge when pairings is null', () => {
    const i = ing();
    const p = pairs();
    const snapshot = JSON.stringify([i, p]);
    const r = applyCuration(i, p, tables);
    expect(JSON.stringify([i, p])).toBe(snapshot);
    expect(applyCuration(i, null, tables).pairings).toBeNull();
    expect(r.report.pairingsIn).toBe(p.length);
  });

  it('merges a binary-shaped record (cooccurrence only) the same way', () => {
    const bin = [
      { ingredientA: 'peache', ingredientB: 'basil', strength: 0.5, known: true, cooccurrence: 0.7 },
      { ingredientA: 'peach', ingredientB: 'basil', strength: 0.2, known: false, cooccurrence: 0.1 },
    ];
    const { pairings } = applyCuration(ing(), bin, tables);
    expect(pairings).toEqual([{ ingredientA: 'peach', ingredientB: 'basil', strength: 0.5, known: true, cooccurrence: 0.7 }]);
  });
});

describe('category renames', () => {
  const data = () => ({
    'fish sauce': { category: 'umami', taste: 'salty umami', sources: [], totalCount: 1 },
    parmesan: { category: 'umami', taste: 'salty', sources: [], totalCount: 1 },
    gin: { category: 'spirit', taste: 'bitter', sources: [], totalCount: 1 },
    _meta: { category: 'umami' },
  });
  const renames = { umami: { to: 'savory seasoning', reason: 'r' } };
  it('moves every ingredient filed under the old word and leaves the rest and the meta keys alone', () => {
    const { ingredients, report } = applyCuration(data(), null, { categoryRenames: renames });
    expect(ingredients['fish sauce'].category).toBe('savory seasoning');
    expect(ingredients.parmesan.category).toBe('savory seasoning');
    expect(ingredients.gin.category).toBe('spirit');
    expect(ingredients._meta.category).toBe('umami');
    expect(report.categoryRenamed.sort()).toEqual(['fish sauce', 'parmesan']);
  });
  it('an override on one ingredient is applied after the rename and wins', () => {
    const { ingredients } = applyCuration(data(), null, { categoryRenames: renames, categoryOverrides: { parmesan: { category: 'dairy', reason: 'r' } } });
    expect(ingredients.parmesan.category).toBe('dairy');
    expect(ingredients['fish sauce'].category).toBe('savory seasoning');
  });
  it('is idempotent and does not mutate its input', () => {
    const input = data();
    const once = applyCuration(input, null, { categoryRenames: renames }).ingredients;
    expect(input.parmesan.category).toBe('umami');
    expect(applyCuration(once, null, { categoryRenames: renames }).ingredients).toEqual(once);
  });
});
