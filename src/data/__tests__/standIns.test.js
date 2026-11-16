// STANDIN-1: the four kinds of stand-in (swap, form, make, none), who may use which, and the row's recipe.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { STAND_INS, SWAPS, swapsFor, standInsFor, standInKind, findSwap, FORM, MAKE, NONE } from '../kitchenSwaps.js';
import { alternativesFor, swappedAmount, rowMain, KIND_LABEL } from '../shoppingAlternatives.js';
import { SEED_RECIPES } from '../seedRecipes.js';
import { slugFor } from '../sharedRecipe.js';
import { needsFromKitchen } from '../whatDoINeed.js';
import { coverIngredients } from '../myKitchen.js';
import { sauceReplacements } from '../inventSauce.js';
import { sameRoleAndKind } from '../saucePantry.js';
import { addLine, reformItem, undoReplace } from '../shoppingList.js';

const read = (p) => JSON.parse(fs.readFileSync(`${process.cwd()}/${p}`, 'utf8'));
const ingredients = read('public/proDataset/ingredients.json');
const names = new Set(Object.keys(ingredients).filter((k) => !k.startsWith('_')));
const categoryOf = (n) => ingredients[String(n || '').toLowerCase().trim()]?.category || null;

// Injected entries: one of each kind with a ratio and an amountNote, so the wording is tested apart from the real table.
const entries = {
  swap: { for: 'x', use: 'a', plus: [], role: 'r', kind: 'k' },
  swapRatio: { for: 'x', use: 'a', plus: [], role: 'r', kind: 'k', ratio: 0.5 },
  formRatio: { for: 'x', use: 'x powder', plus: [], role: 'r', kind: 'k', type: 'form', ratio: 0.25, note: 'stronger' },
  formNote: { for: 'x', use: 'x paste', plus: [], role: 'r', kind: 'k', type: 'form', amountNote: '1/8 tsp powder per clove' },
  make: { for: 'x', use: 'a', plus: ['b'], role: 'r', kind: 'k', type: 'make', amountNote: 'one part a, one part b' },
  none: { for: 'x', use: null, plus: [], role: null, kind: null, type: 'none', reason: 'it is the thing that sets the dish' },
};
const via = (...list) => () => list;
const alts = (list, ctx = {}) => alternativesFor({ key: 'x' }, { names, swaps: via(...list), ...ctx });

describe('each kind through alternativesFor', () => {
  it('labels: swap "Use instead", form "Another form", make "Make it"', () => {
    expect(KIND_LABEL).toEqual({ swap: 'Use instead', form: 'Another form', make: 'Make it' });
    const r = alts([entries.swap, entries.formNote, { ...entries.make, use: 'c', plus: ['d'] }]);
    expect(r.alternatives.map((a) => [a.key, a.kind])).toEqual([['a', 'swap'], ['x paste', 'form'], ['c', 'make']]);
  });
  it('an entry with no type is a swap, and its wording is the old one', () => {
    const [a] = alts([entries.swap]).alternatives;
    expect(a.kind).toBe('swap');
    expect(a.useText).toBe('Use a instead.');
    expect(a.amountNote).toBeNull();
    expect(a.dropQty).toBe(false);
  });
  it('usage text with a ratio', () => {
    const [a] = alts([entries.formRatio]).alternatives;
    expect(a.useText).toBe('Use x powder instead. Use a quarter as much.');
    expect(a.note).toBe('stronger');
    expect(swappedAmount({ parts: [{ qty: 4, unit: 'tsp' }] }, a)).toBe('1 tsp');
  });
  it('usage text with an amountNote: the note is carried, and the row number is dropped (it would be wrong)', () => {
    const [a] = alts([entries.formNote]).alternatives;
    expect(a.useText).toBe('Use x paste instead.');
    expect(a.amountNote).toBe('1/8 tsp powder per clove');
    expect(a.dropQty).toBe(true);
    expect(swappedAmount({ parts: [{ qty: 3, unit: 'clove' }] }, a)).toBe('');
  });
  it('make: the parts are named, the helper is a part, and the row quantity is dropped', () => {
    const [a] = alts([entries.make]).alternatives;
    expect(a.kind).toBe('make');
    expect(a.useText).toBe('Make it from a and b.');
    expect(a.plus).toEqual(['b']);
    expect(a.dropQty).toBe(true);
    expect(swappedAmount({ parts: [{ qty: 500, unit: 'ml' }] }, a)).toBe('');
  });
  it('make is "had" only when the cook has every part', () => {
    expect(alts([entries.make], { has: (k) => k === 'a' }).alternatives[0].have).toBe(false);
    expect(alts([entries.make], { has: (k) => k === 'a' || k === 'b' }).alternatives[0].have).toBe(true);
  });
  it('none: returns the reason and no alternatives, and wins over any other entry for the ingredient', () => {
    const r = alts([entries.swap, entries.none]);
    expect(r.alternatives).toEqual([]);
    expect(r.known).toBe(false);
    expect(r.none).toEqual({ reason: 'it is the thing that sets the dish' });
  });
  it('nothing at all is not a none: it is simply unknown', () => {
    const r = alts([]);
    expect(r).toEqual({ alternatives: [], known: false });
  });
  it('a none entry is never offered as an alternative to something else', () => {
    for (const s of STAND_INS.filter((x) => standInKind(x) === 'none')) expect(s.use).toBeNull();
    for (const s of STAND_INS) expect(['swap', 'form', 'make', 'none']).toContain(standInKind(s));
  });
});

describe('the builders and the real table', () => {
  it('FORM, MAKE and NONE build entries of their kind; MAKE splits the parts into use and plus', () => {
    const f = FORM('thyme', 'dried thyme', 'herb', 'dried or fresh herb', { amountNote: '1 tsp dried for 1 tbsp fresh' });
    expect(standInKind(f)).toBe('form');
    const m = MAKE('simple syrup', ['sugar', 'water'], 'sweetener', 'syrup');
    expect(standInKind(m)).toBe('make');
    expect([m.use, ...m.plus]).toEqual(['sugar', 'water']);
    const n = NONE('egg', 'because');
    expect(standInKind(n)).toBe('none');
    expect(n.use).toBeNull();
  });
  it('built entries read through alternativesFor: dried thyme with its amount, syrup made from sugar and water', () => {
    const f = FORM('thyme', 'dried thyme', 'herb', 'dried or fresh herb', { amountNote: '1 tsp dried for 1 tbsp fresh' });
    const [a] = alternativesFor({ key: 'thyme' }, { names, swaps: via(f) }).alternatives;
    expect(a).toMatchObject({ key: 'dried thyme', kind: 'form', amountNote: '1 tsp dried for 1 tbsp fresh', dropQty: true });
    const m = MAKE('simple syrup', ['sugar', 'water'], 'sweetener', 'syrup', { amountNote: 'equal parts by volume' });
    const [b] = alternativesFor({ key: 'simple syrup' }, { names, swaps: via(m) }).alternatives;
    expect(b).toMatchObject({ key: 'sugar', kind: 'make', plus: ['water'], useText: 'Make it from sugar and water.' });
  });
  it('the real table: egg says nothing really replaces it, with the reason', () => {
    const r = alternativesFor({ key: 'egg' }, { names });
    expect(r.alternatives).toEqual([]);
    expect(r.none.reason).toMatch(/sets and binds/);
  });
  it('the table is the swaps plus the other kinds, and swaps keep their old shape', () => {
    // STANDIN-3: the bar entries (marked bar: true) are in STAND_INS and never in SWAPS, the recipe side's table.
    expect(STAND_INS.length).toBe(SWAPS.length + STAND_INS.filter((s) => standInKind(s) !== 'swap').length + STAND_INS.filter((s) => s.bar && standInKind(s) === 'swap').length);
    expect(STAND_INS.filter((s) => s.bar).every((s) => !SWAPS.includes(s))).toBe(true);
    expect(SWAPS.every((s) => standInKind(s) === 'swap')).toBe(true);
    expect(SWAPS.find((s) => s.for === 'cream' && s.use === 'milk').plus).toEqual(['butter']);
  });
});

describe('who may use which: the recipe side sees swaps only', () => {
  it('swapsFor and SWAPS never return a none; standInsFor returns it', () => {
    const others = STAND_INS.filter((s) => standInKind(s) !== 'swap');
    expect(others.length).toBeGreaterThanOrEqual(1);
    for (const s of others) {
      expect(swapsFor(s.for)).not.toContain(s);
      expect(SWAPS).not.toContain(s);
      expect(standInsFor(s.for)).toContain(s);
    }
  });
  const has = (...k) => (x) => k.includes(x);
  it('findSwap (What do I need, What can I cook): an egg stays missing whatever the kitchen has', () => {
    expect(findSwap('egg', has('anything', 'milk', 'flour'))).toBeNull();
  });
  it('needsFromKitchen (What do I need): an egg is still missing, and the swaps it lists are the same as before', () => {
    const r = needsFromKitchen(['egg', 'scallion'], ['onion'], { swaps: true, names });
    expect(r.missing.map((m) => m.name)).toContain('egg');
    expect(r.swaps.map((x) => [x.name, x.use])).toEqual([['scallion', 'onion']]);
  });
  it('coverIngredients (What can I cook, Cookbook "you can make") lists the same swaps as before', () => {
    const r = coverIngredients(['egg', 'scallion', 'cream'], ['onion', 'milk', 'butter'], { swaps: true, names });
    expect(r.swaps.map((x) => [x.for, x.use, x.plus.join('+')])).toEqual([['scallion', 'onion', ''], ['cream', 'milk', 'butter']]);
    expect(r.missing).toContain('egg');
  });
  it('Sauce Lab replacements (inventSauce) are the swap-kind entries as before; egg offers nothing', () => {
    const catMap = new Map(Object.entries(ingredients).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, v.category]));
    const out = sauceReplacements('scallion', { kitchen: ['onion', 'leek'], catMap, names });
    expect(out.map((o) => o.key)).toEqual(expect.arrayContaining(['onion', 'leek']));
    expect(sauceReplacements('egg', { kitchen: ['milk', 'flour'], catMap, names }).map((o) => o.key)).toEqual([]);
  });
  it('the Sauce Lab strictness holds for every swap-kind entry (sauce:false never contradicts sameRoleAndKind)', () => {
    for (const s of SWAPS) if (s.sauce === false) expect(sameRoleAndKind(s.for, s.use), `${s.use} for ${s.for}`).toBe(false);
  });
});

describe('supportingOnly follows the recipe the row came from', () => {
  const dish = (name) => {
    const d = SEED_RECIPES.find((x) => x.name === name);
    if (!d) throw new Error(`no dish ${name}`);
    const id = `dish:${slugFor('dish', d)}`;
    return { id, recipe: { id, kind: 'dish', name: d.name } };
  };
  const row = (key, ...from) => ({ key, from: from.map((f) => f.id) });
  const keys = (r) => r.alternatives.map((a) => a.key);
  const ask = (item, recipes) => {
    const main = rowMain(item, recipes, { categoryOf, names });
    return { main, ...alternativesFor({ key: item.key }, { names, main }) };
  };

  it('butter in Saffron Risotto (supporting): olive oil and vegetable oil are offered, with the reason', () => {
    const d = dish('Saffron Risotto');
    const r = ask(row('butter', d), [d.recipe]);
    expect(r.main).toBe(false);
    expect(keys(r)).toEqual(['olive oil', 'vegetable oil']);
    expect(r.alternatives[0].note).toBe('fine for frying; not if butter is the point of the dish');
    expect(r.withheld).toBeUndefined();
  });
  it('butter in Butter Croissant (a main): withheld, and the sheet can say why', () => {
    const d = dish('Butter Croissant');
    const r = ask(row('butter', d), [d.recipe]);
    expect(r.main).toBe(true);
    expect(r.alternatives).toEqual([]);
    expect((r.withheld || []).map((w) => w.key)).toEqual(['olive oil', 'vegetable oil']);
    expect(r.withheld[0].reason).toMatch(/only works where butter is not the point of the dish, and here it is/);
  });
  it('a row with no recipe (typed by hand): withheld, as before', () => {
    const r = ask({ key: 'butter', from: [] }, []);
    expect(r.main).toBeNull();
    expect(r.alternatives).toEqual([]);
    expect(r.withheld[0].reason).toMatch(/did not come from a recipe/);
    expect(alternativesFor({ key: 'butter' }, { names }).known).toBe(false); // no ctx at all: the old behaviour
  });
  it('olive oil in a dish where it is supporting: butter is offered; the dish is judged by its own mains', () => {
    const d = dish('Margherita Pizza');
    const r = ask(row('olive oil', d), [d.recipe]);
    expect(keys(r)).toEqual(['butter']);
  });
  it('a row from two dishes is a main if it is a main of either', () => {
    const a = dish('Saffron Risotto');
    const b = dish('Butter Croissant');
    expect(rowMain(row('butter', a, b), [a.recipe, b.recipe], { categoryOf, names })).toBe(true);
    expect(rowMain(row('butter', a), [a.recipe, b.recipe], { categoryOf, names })).toBe(false);
  });
  it('a row from a cocktail or a sauce is treated as a main (conservative), and an unknown recipe id is no recipe', () => {
    const s = { id: 'sauce:beurre-blanc', kind: 'sauce', name: 'Beurre Blanc' };
    const c = { id: 'cocktail:hot-buttered-rum', kind: 'cocktail', name: 'Hot Buttered Rum' };
    expect(rowMain({ key: 'butter', from: [s.id] }, [s], { categoryOf, names })).toBe(true);
    expect(rowMain({ key: 'butter', from: [c.id] }, [c], { categoryOf, names })).toBe(true);
    expect(rowMain({ key: 'butter', from: ['dish:gone'] }, [], { categoryOf, names })).toBeNull();
  });
  it('the sauce flag still drops butter and oil swaps (sauce:false) even when butter is supporting', () => {
    const d = dish('Saffron Risotto');
    const r = alternativesFor({ key: 'butter' }, { names, main: false, sauce: true });
    expect(r.alternatives).toEqual([]);
    expect(d.id).toBeTruthy();
  });
});

describe('a form the list stores under the rows own key', () => {
  const dried = FORM('thyme', 'dried thyme', 'herb', 'dried or fresh herb', { amountNote: '1 tsp dried for 1 tbsp fresh' });
  it('is kept (not dropped as "the same ingredient"), flagged sameKey, and never marked as owned', () => {
    const r = alternativesFor({ key: 'thyme' }, { names, swaps: via(dried), has: () => true });
    expect(r.alternatives).toHaveLength(1);
    expect(r.alternatives[0]).toMatchObject({ key: 'dried thyme', kind: 'form', sameKey: true, have: false });
  });
  it('a swap that is the same ingredient as the row is still dropped', () => {
    const same = { for: 'thyme', use: 'dried thyme', plus: [], role: 'herb', kind: 'k' };
    expect(alternativesFor({ key: 'thyme' }, { names, swaps: via(same) }).alternatives).toEqual([]);
  });
  it('reformItem keeps the key, relabels, drops the quantity, and undoReplace restores the row exactly', () => {
    const o = { now: 1, newId: () => 'a', names };
    let list = addLine({ items: [], recipes: [] }, { key: 'thyme', label: 'thyme', amount: '3 tbsp' }, o).list;
    const before = list.items[0];
    const r = reformItem(list, 'a', { label: 'dried thyme', amount: '', note: 'Use dried thyme instead.' }, { now: 2, names });
    expect(r.status).toBe('reformed');
    expect(r.list.items).toHaveLength(1);
    expect(r.list.items[0]).toMatchObject({ key: 'thyme', label: 'dried thyme', parts: [], swappedFrom: 'thyme' });
    const back = undoReplace(r.list, 'a', { now: 3 });
    const { updatedAt: _a, ...restored } = back.items[0];
    const { updatedAt: _b, ...orig } = before;
    expect(restored).toEqual(orig);
    expect(reformItem(list, 'a', { label: 'thyme' }, { now: 2 }).status).toBe('same');
  });
});
