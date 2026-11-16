// @vitest-environment jsdom
// STANDIN-1: the four kinds on the sheet, "make" on the list with Undo, and the row's recipe for supporting-only swaps.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import { saveUnitSystem } from '../../data/shoppingUnits.js';
import ShoppingList from '../ShoppingList.jsx';
import StoreAlternatives from '../StoreAlternatives.jsx';
import { commitList } from '../../data/shoppingStore.js';
import { addLine } from '../../data/shoppingList.js';
import { resetShoppingIngredients } from '../../data/shoppingIngredients.js';

// The real table has no form or make entry yet (STANDIN-2/3 write them); give the list two for these tests.
vi.mock('../../data/kitchenSwaps.js', async (importOriginal) => {
  const real = await importOriginal();
  const extra = [
    real.FORM('thyme', 'dried thyme', 'herb', 'dried or fresh herb', { amountNote: '1 tsp dried for 1 tbsp fresh' }),
    real.MAKE('simple syrup', ['sugar', 'water'], 'sweetener', 'syrup', { amountNote: 'equal parts by volume: 1 cup sugar and 1 cup water, heated until clear' }),
  ];
  return { ...real, standInsFor: (name) => [...real.standInsFor(name), ...extra.filter((e) => e.for === name)] };
});

const roles = JSON.parse(fs.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient;
const CATS = new Map([
  ['butter', 'fat'], ['olive oil', 'fat'], ['egg', 'protein'], ['thyme', 'herb'], ['simple syrup', 'sweetener'], ['sugar', 'sweetener'], ['water', 'liquid'],
  ['saffron', 'spice'], ['rice', 'grain'],
]);
const INGREDIENTS = { names: new Set(CATS.keys()), vocab: [...CATS.keys()].sort(), categories: CATS };
const loadIngredients = () => Promise.resolve(INGREDIENTS);
const loadRoles = () => Promise.resolve(roles);

let latest;
function Harness({ initial, stock = () => ({ kitchen: [], pantry: [], bar: [] }) }) {
  const [state, setState] = useState(initial);
  latest = state;
  return (
    <ShoppingList
      shopping={state}
      onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })}
      onClose={() => {}}
      loadIngredients={loadIngredients}
      loadRoles={loadRoles}
      recipeStock={stock}
    />
  );
}

const stateWith = (lines, recipes = []) => {
  let list = { items: [], recipes: [] };
  let n = 0;
  for (const l of lines) list = addLine(list, l, { now: 1000 + n, newId: () => `i${n++}`, names: INGREDIENTS.names }).list;
  return { list: { ...list, recipes }, removed: {} };
};
const ready = () => screen.findAllByTestId(/^shopping-aisle-(?!other)/).catch(() => screen.findAllByTestId('shopping-aisle-other'));
const open = async (key) => {
  await ready();
  fireEvent.click(await screen.findByTestId(`shopping-alt-${key}`));
  return screen.findByTestId('store-alt-sheet');
};
const unchecked = () => latest.list.items.filter((i) => !i.checked).map((i) => i.key);

beforeEach(() => { localStorage.clear(); saveUnitSystem('metric'); resetShoppingIngredients(); });
afterEach(cleanup);

describe('the four labels on the sheet', () => {
  const swaps = () => [
    { for: 'x', use: 'a', plus: [], role: 'r', kind: 'k' },
    { for: 'x', use: 'b', plus: [], role: 'r', kind: 'k', type: 'form', ratio: 0.5, note: 'stronger' },
    { for: 'x', use: 'c', plus: ['d'], role: 'r', kind: 'k', type: 'make', amountNote: 'one part each' },
  ];
  const stock = () => ({ kitchen: [], pantry: [], bar: [] });
  const render1 = (extra = {}) => render(<StoreAlternatives item={{ id: 'i', key: 'x', label: 'x', parts: [], from: [] }} stock={stock} swaps={swaps} onPick={() => {}} onUseHave={() => {}} onClose={() => {}} {...extra} />);

  it('swap "Use instead", form "Another form", make "Make it", each with its wording and amount', () => {
    render1();
    expect(screen.getByTestId('store-alt-kind-a').textContent).toBe('Use instead');
    expect(screen.getByTestId('store-alt-kind-b').textContent).toBe('Another form');
    expect(screen.getByTestId('store-alt-kind-c').textContent).toBe('Make it');
    expect(screen.getByTestId('store-alt-b').textContent).toMatch(/Use b instead\. Use half as much\./);
    expect(screen.getByTestId('store-alt-note-b').textContent).toBe('Stronger.');
    expect(screen.getByTestId('store-alt-c').textContent).toMatch(/Make it from c and d\./);
    expect(screen.getByTestId('store-alt-c').textContent).toMatch(/c \+ d/);
    expect(screen.getByTestId('store-alt-amount-c').textContent).toBe('Amount: one part each.');
    expect(screen.getByRole('button', { name: 'Make x: put c and d on the list instead of x' }).textContent).toBe('Make it');
    expect(screen.getByRole('button', { name: 'Use a instead of x' }).textContent).toBe('Use a instead');
  });
  it('none: "Nothing really replaces X" with the reason, no choices, only Close', () => {
    render1({ item: { id: 'i', key: 'egg', label: 'egg', parts: [], from: [] }, swaps: undefined });
    const none = screen.getByTestId('store-alt-nothing');
    expect(none.textContent).toMatch(/^Nothing really replaces egg\./);
    expect(none.textContent).toMatch(/Nothing really replaces egg\.An egg sets and binds/);
    expect(screen.queryByTestId('store-alt-none')).toBeNull();
    expect(within(screen.getByTestId('store-alt-sheet')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Close']);
  });
  it('an ingredient with no entry at all still says No stand-in I would trust', () => {
    render1({ item: { id: 'i', key: 'saffron', label: 'saffron', parts: [], from: [] }, swaps: undefined });
    expect(screen.getByTestId('store-alt-none').textContent).toBe("No stand-in I'd trust for saffron.");
    expect(screen.queryByTestId('store-alt-nothing')).toBeNull();
  });
});

describe('make on the list', () => {
  it('replaces the row with its parts (no quantity carried), the amounts in the note, and Undo restores the row exactly', async () => {
    render(<Harness initial={stateWith([{ key: 'simple syrup', label: 'simple syrup', amount: '250 ml' }])} />);
    const before = latest.list.items[0];
    const sheet = await open('simple syrup');
    expect(within(sheet).getByTestId('store-alt-kind-sugar').textContent).toBe('Make it');
    fireEvent.click(within(sheet).getByTestId('store-alt-pick-sugar'));
    await screen.findByTestId('shopping-row-sugar');
    expect(unchecked().sort()).toEqual(['sugar', 'water']);
    expect(latest.list.items.find((i) => i.key === 'sugar').parts).toEqual([]); // the 250 ml of syrup is not 250 ml of sugar
    expect(screen.getByTestId('shopping-swap-sugar').textContent).toMatch(/instead of simple syrup/);
    expect(screen.getByTestId('shopping-swap-sugar').textContent).toMatch(/1 cup sugar and 1 cup water/);
    expect(screen.getByTestId('shopping-note').textContent).toMatch(/Simple syrup is made from sugar and water, so sugar and water are on the list instead\. You can undo it on the row\./);
    fireEvent.click(screen.getByTestId('shopping-undo-swap-sugar'));
    await screen.findByTestId('shopping-row-simple syrup');
    expect(unchecked()).toEqual(['simple syrup']);
    const { updatedAt: _a, ...restored } = latest.list.items[0];
    const { updatedAt: _b, ...orig } = before;
    expect(restored).toEqual(orig);
  });

  it('a part the cook already has is not added; a part already on the list is merged, never doubled', async () => {
    render(<Harness initial={stateWith([{ key: 'simple syrup', label: 'simple syrup' }, { key: 'water', label: 'water', amount: '2 cups' }])} stock={() => ({ kitchen: ['sugar'], pantry: [], bar: [] })} />);
    const sheet = await open('simple syrup');
    fireEvent.click(within(sheet).getByTestId('store-alt-pick-sugar'));
    await screen.findByTestId('shopping-row-water');
    expect(unchecked()).toEqual(['water']); // sugar is owned; water was already there
    expect(latest.list.items[0].parts).toEqual([{ qty: 2, unit: 'cup' }]);
  });
});

describe('another form on the list', () => {
  it('the row keeps its key and takes the form as its label; the number is dropped (it would be wrong), the amount is in the note; Undo restores it', async () => {
    render(<Harness initial={stateWith([{ key: 'thyme', label: 'thyme', amount: '3 tbsp' }])} />);
    const before = latest.list.items[0];
    const sheet = await open('thyme');
    expect(within(sheet).getByTestId('store-alt-kind-dried thyme').textContent).toBe('Another form');
    expect(within(sheet).queryByTestId('store-alt-have-dried thyme')).toBeNull(); // the kitchen cannot say which form it has
    fireEvent.click(within(sheet).getByTestId('store-alt-pick-dried thyme'));
    await waitFor(() => expect(latest.list.items[0].label).toBe('dried thyme'));
    expect(latest.list.items).toHaveLength(1);
    expect(latest.list.items[0].key).toBe('thyme');
    expect(latest.list.items[0].parts).toEqual([]);
    expect(screen.getByTestId('shopping-swap-thyme').textContent).toMatch(/1 tsp dried for 1 tbsp fresh/);
    expect(screen.getByTestId('shopping-note').textContent).toMatch(/Using dried thyme for thyme \(the amount is in the note\)\./);
    fireEvent.click(screen.getByTestId('shopping-undo-swap-thyme'));
    await waitFor(() => expect(latest.list.items[0].label).toBe('thyme'));
    const { updatedAt: _a, ...restored } = latest.list.items[0];
    const { updatedAt: _b, ...orig } = before;
    expect(restored).toEqual(orig);
  });
});

describe('the row\'s recipe decides supporting-only swaps', () => {
  const risotto = { id: 'dish:risotto-saffron', kind: 'dish', name: 'Saffron Risotto', addedAt: 1 };
  const croissant = { id: 'dish:croissant', kind: 'dish', name: 'Butter Croissant', addedAt: 1 };

  it('butter in a dish where it is supporting: olive oil is offered, with the reason', async () => {
    render(<Harness initial={stateWith([{ key: 'butter', label: 'butter', recipeId: risotto.id }], [risotto])} />);
    const sheet = await open('butter');
    expect(within(sheet).getByTestId('store-alt-olive oil').textContent).toMatch(/Use olive oil instead\./);
    expect(within(sheet).getByTestId('store-alt-note-olive oil').textContent).toBe('Fine for frying; not if butter is the point of the dish.');
    expect(within(sheet).queryByTestId('store-alt-withheld')).toBeNull();
    expect(latest.list.items).toHaveLength(1);
  });
  it('butter in a dish where it is a main: withheld, and the sheet says why', async () => {
    render(<Harness initial={stateWith([{ key: 'butter', label: 'butter', recipeId: croissant.id }], [croissant])} />);
    const sheet = await open('butter');
    expect(within(sheet).queryByTestId('store-alt-olive oil')).toBeNull();
    expect(within(sheet).getByTestId('store-alt-none')).toBeTruthy();
    expect(within(sheet).getByTestId('store-alt-withheld').textContent).toMatch(/only works where butter is not the point of the dish, and here it is/);
  });
  it('butter typed by hand (no recipe): withheld, and the sheet says it could not check', async () => {
    render(<Harness initial={stateWith([{ key: 'butter', label: 'butter' }])} />);
    const sheet = await open('butter');
    expect(within(sheet).queryByTestId('store-alt-olive oil')).toBeNull();
    expect(within(sheet).getByTestId('store-alt-withheld').textContent).toMatch(/did not come from a recipe I can check/);
  });
  it('a row from a sauce keeps the sauce rule: no butter-for-oil even when supporting', async () => {
    const sauce = { id: 'sauce:beurre-blanc', kind: 'sauce', name: 'Beurre Blanc', addedAt: 1 };
    render(<Harness initial={stateWith([{ key: 'butter', label: 'butter', recipeId: sauce.id }], [sauce])} />);
    const sheet = await open('butter');
    expect(within(sheet).queryByTestId('store-alt-olive oil')).toBeNull();
    await waitFor(() => expect(within(sheet).getByTestId('store-alt-none')).toBeTruthy());
  });
});
