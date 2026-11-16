import { describe, it, expect } from 'vitest';
import {
  buildEntries, searchEntries, classifyLines, makeLocator, summaryText, recipeRefFor, ownRecipeId, withLines, addTicked, askAgainText, countOptional,
} from '../shoppingRecipes.js';
import { emptyList } from '../shoppingList.js';

const data = {
  cocktails: [{ name: 'Negroni', canonical: 'Negroni' }, { name: 'Negroni Sbagliato', canonical: 'Negroni Sbagliato' }, { name: 'Daiquiri', canonical: 'Daiquiri' }],
  sauces: [{ name: 'Bechamel', ingredients: ['butter', 'flour'] }],
  dishes: [{ id: 'beef-bolognese', name: 'Beef Bolognese', ingredients: ['beef'] }],
};
const own = {
  cocktails: [{ id: 'c1', name: 'Negroni Bianco', lines: [{ key: 'gin', amount: '1 oz' }] }, { id: 'bad', name: 'No Lines', lines: [] }],
  recipes: [{ id: 'r1', name: 'Dal', lines: [{ key: 'lentils', amount: '200 g' }] }],
};

describe('entries and search', () => {
  const entries = buildEntries({ data, own });

  it('lists built-in and own items with kind, origin and a stable id; an own item with no lines is left out', () => {
    expect(entries.map((e) => [e.id, e.kind, e.origin])).toEqual([
      ['cocktail:negroni', 'cocktail', 'built-in'], ['cocktail:negroni-sbagliato', 'cocktail', 'built-in'], ['cocktail:daiquiri', 'cocktail', 'built-in'],
      ['sauce:bechamel', 'sauce', 'built-in'], ['dish:beef-bolognese', 'dish', 'built-in'],
      ['own:cocktail:c1', 'cocktail', 'own'], ['own:recipe:r1', 'dish', 'own'],
    ]);
  });

  it('works with no data loaded (only the cook\'s own)', () => {
    expect(buildEntries({ data: null, own }).map((e) => e.id)).toEqual(['own:cocktail:c1', 'own:recipe:r1']);
    expect(buildEntries({})).toEqual([]);
  });

  it('matches by name, exact first, then names starting with it, the cook\'s own before built-in, then A-Z', () => {
    expect(searchEntries('negroni', entries).map((e) => e.name)).toEqual(['Negroni', 'Negroni Bianco', 'Negroni Sbagliato']);
    expect(searchEntries('bolo', entries).map((e) => e.name)).toEqual(['Beef Bolognese']);
    expect(searchEntries('  ', entries)).toEqual([]);
    expect(searchEntries('zzz', entries)).toEqual([]);
  });

  it('is limited', () => {
    expect(searchEntries('negroni', entries, 2)).toHaveLength(2);
  });
});

describe('classifyLines with a mainOf (a dish)', () => {
  const recipe = { kind: 'dish', slug: 'x', name: 'X', lines: [{ key: 'beef', amount: '500 g' }, { key: 'oregano', amount: '1 tsp' }, { key: 'garlic', amount: '2 cloves' }, { key: 'salt', amount: '' }] };
  const none = () => null;
  const mainOf = (k) => k === 'beef';

  it('puts the not-owned, not-basic, not-main lines in flavourings, leaving need to the mains', () => {
    const g = classifyLines(recipe, none, null, { mainOf });
    expect(g.need.map((l) => l.key)).toEqual(['beef']);
    expect(g.flavourings.map((l) => l.key)).toEqual(['oregano', 'garlic']);
    expect(g.basics.map((l) => l.key)).toEqual(['salt']);
    expect(g.all).toHaveLength(4);
  });

  it('owned lines stay in have whether or not they are mains', () => {
    const g = classifyLines(recipe, (k) => (k === 'garlic' ? 'My kitchen' : null), null, { mainOf });
    expect(g.have.map((l) => l.key)).toEqual(['garlic']);
    expect(g.flavourings.map((l) => l.key)).toEqual(['oregano']);
  });

  it('without a mainOf there are no flavourings (cocktails, sauces)', () => {
    const g = classifyLines(recipe, none);
    expect(g.flavourings).toEqual([]);
    expect(g.need.map((l) => l.key)).toEqual(['beef', 'oregano', 'garlic']);
  });
});

describe('countOptional and the optional sentence', () => {
  it('counts added and merged lines whose key is optional, and the summary says how many', () => {
    const summary = { added: 1, merged: 1, addedLines: [{ key: 'celery', label: 'celery' }], mergedLines: [{ key: 'red wine', label: 'red wine', now: '1 cup' }] };
    expect(countOptional(summary, new Set(['red wine']))).toBe(1);
    expect(countOptional(summary, ['red wine', 'celery'])).toBe(2);
    expect(summaryText('X', summary, { optional: 1 })).toMatch(/1 of those is optional\./);
    expect(summaryText('X', summary, { optional: 2 })).toMatch(/2 of those are optional\./);
    expect(summaryText('X', summary, { optional: 0 })).not.toMatch(/optional/);
  });
});

describe('classifyLines', () => {
  const recipe = { kind: 'sauce', slug: 'x', name: 'X', lines: [
    { key: 'butter', amount: '2 tbsp' }, { key: 'milk', amount: '1 cup' }, { key: 'lemongrass', amount: '' }, { key: 'milk', amount: '1 cup' }, { key: 'gin', amount: '' }, { key: 'cumin', amount: '' },
  ] };

  it('splits into need, basics and have (once per ingredient), saying where each owned one was found', () => {
    const locate = makeLocator({ kitchen: ['milk'], pantry: [], bar: ['gin'], spiceRack: true });
    const g = classifyLines(recipe, locate);
    expect(g.need.map((l) => l.key)).toEqual(['lemongrass']);
    expect(g.basics.map((l) => l.key)).toEqual(['butter']);
    expect(g.have.map((l) => [l.key, l.where])).toEqual([['milk', 'My kitchen'], ['gin', 'My bar'], ['cumin', 'spice rack']]);
    expect(g.all.map((l) => l.key)).toEqual(['butter', 'milk', 'lemongrass', 'gin', 'cumin']);
  });

  it('names the sauce pantry when the ingredient is only there', () => {
    expect(makeLocator({ pantry: ['milk'] })('milk')).toBe('sauce pantry');
    expect(makeLocator({})('milk')).toBeNull();
  });
});

describe('what reaches the list', () => {
  const recipe = { kind: 'dish', slug: 'd', name: 'D', lines: [{ key: 'beef', amount: '500 g' }, { key: 'pasta', amount: '200 g' }, { key: 'salt', amount: '' }] };

  it('withLines keeps the recipe id and replaces the lines', () => {
    const r = withLines(recipe, [{ key: 'pasta', amount: '200 g' }]);
    expect(r.id).toBe('dish:d');
    expect(r.lines).toEqual([{ key: 'pasta', amount: '200 g' }]);
  });

  it('addTicked adds exactly the ticked lines, including a basic when it is ticked, and notes the recipe', () => {
    const res = addTicked(emptyList(), recipe, [{ key: 'pasta', amount: '200 g' }, { key: 'salt', amount: '' }], { now: 5 });
    expect(res.list.items.map((i) => i.key)).toEqual(['pasta', 'salt']);
    expect(res.list.recipes).toEqual([{ id: 'dish:d', kind: 'dish', name: 'D', addedAt: 5 }]);
    expect(res.summary.alreadyOnList).toBe(false);
    const again = addTicked(res.list, recipe, [{ key: 'pasta', amount: '200 g' }]);
    expect(again.summary.alreadyOnList).toBe(true);
    expect(again.list).toBe(res.list);
  });

  it('recipeRefFor gives a built-in item a slug, and an own item its own id', () => {
    expect(recipeRefFor('cocktail', { name: 'Old-Fashioned', canonical: 'Old-Fashioned' })).toEqual({ kind: 'cocktail', slug: 'old-fashioned', name: 'Old-Fashioned' });
    expect(recipeRefFor('sauce', { name: 'Miso' }, { ownKind: 'sauce', ownId: 's1' })).toEqual({ kind: 'sauce', id: ownRecipeId('sauce', 's1'), name: 'Miso' });
  });
});

describe('words', () => {
  it('summaries say what was added, what merged (with the new quantity) and what was left off', () => {
    const s = { addedLines: [{ label: 'beef' }, { label: 'celery' }], mergedLines: [{ label: 'garlic', now: '5 cloves' }, { label: 'milk', now: '' }] };
    expect(summaryText('Bolognese', s, { left: 2 })).toBe('Added 2 for Bolognese: beef, celery. Merged into lines already on your list: garlic: now 5 cloves, milk: already on the list. Left off 2 you already have.');
    expect(summaryText('X', { addedLines: [], mergedLines: [] })).toBe('Nothing was added for X.');
    expect(summaryText('X', { addedLines: [], mergedLines: [], message: 'full' })).toBe('Nothing was added for X. full');
  });

  it('the ask-first sentence', () => {
    expect(askAgainText('Beef Bolognese')).toBe('Beef Bolognese is already on your list. Add it again? It will add to the quantities.');
  });
});
