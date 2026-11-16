// @vitest-environment jsdom
// SHOP-4: "Store doesn't have it?" on the shopping list screen, over the real swap and role tables.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveUnitSystem } from '../../data/shoppingUnits.js';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import ShoppingList from '../ShoppingList.jsx';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { addLine } from '../../data/shoppingList.js';
import { MY_KITCHEN_KEY } from '../../data/myKitchen.js';
import { MY_BAR_KEY } from '../../data/myBar.js';
import { resetShoppingIngredients } from '../../data/shoppingIngredients.js';

const roles = JSON.parse(fs.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient;
const CATS = new Map([
  ['buttermilk', 'dairy'], ['yogurt', 'dairy'], ['milk', 'dairy'], ['lemon', 'citrus'], ['shallot', 'aromatic'], ['onion', 'aromatic'],
  ['saffron', 'spice'], ['bourbon', 'spirit'], ['rye', 'spirit'], ['scotch', 'spirit'], ['cream', 'dairy'], ['parmesan', 'dairy'],
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
// The aisles arrive with the ingredient table and re-mount the rows, so wait for them before clicking.
const ready = () => screen.findAllByTestId(/^shopping-aisle-(?!other)/).catch(() => screen.findAllByTestId('shopping-aisle-other'));
const open = async (key) => {
  await ready();
  fireEvent.click(await screen.findByTestId(`shopping-alt-${key}`));
  return screen.findByTestId('store-alt-sheet');
};
const unchecked = () => latest.list.items.filter((i) => !i.checked).map((i) => i.key);
const noDupes = () => expect(new Set(unchecked()).size).toBe(unchecked().length);

// These tests are about alternatives, not display units: their amounts are entered in metric, so show metric (SHOP-6 default is US).
beforeEach(() => { localStorage.clear(); saveUnitSystem('metric'); resetShoppingIngredients(); });
afterEach(cleanup);

describe('the button', () => {
  it('is on every unchecked row, named with the ingredient, 44px by class; a checked row has none', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk' }, { key: 'milk', label: 'milk' }])} />);
    await ready();
    const btn = await screen.findByTestId('shopping-alt-buttermilk');
    expect(btn.textContent).toBe("Store doesn't have it?");
    expect(btn.getAttribute('aria-label')).toBe("Store doesn't have it? Find an alternative for buttermilk");
    expect(btn.className).toMatch(/min-h-\[44px\]/);
    fireEvent.click(screen.getByRole('checkbox', { name: 'milk' }));
    await waitFor(() => expect(screen.queryByTestId('shopping-alt-milk')).toBeNull());
    expect(screen.getByTestId('shopping-alt-buttermilk')).toBeTruthy();
  });
});

describe('the sheet', () => {
  it('lists the alternatives with usage text; it is a modal dialog rendered into the body', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk', amount: '500 ml' }])} />);
    const sheet = await open('buttermilk');
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByTestId('shopping-list').contains(sheet)).toBe(false);
    expect(document.body.contains(sheet)).toBe(true);
    expect(within(sheet).getByRole('heading', { name: 'Alternatives for buttermilk' })).toBeTruthy();
    expect(within(sheet).getByText(/not a guarantee/)).toBeTruthy();
    expect(within(sheet).getByTestId('store-alt-milk').textContent).toMatch(/Use milk and lemon instead\./);
    expect(within(sheet).getByTestId('store-alt-yogurt').textContent).toMatch(/Use yogurt instead\./);
    expect(within(sheet).queryByText('you have this')).toBeNull();
    expect(latest.list.items).toHaveLength(1); // nothing applied by opening
  });

  it('a bar row offers same-family bottles from the role table', async () => {
    render(<Harness initial={stateWith([{ key: 'bourbon', label: 'bourbon' }])} />);
    const sheet = await open('bourbon');
    await waitFor(() => expect(within(sheet).getByTestId('store-alt-rye')).toBeTruthy());
    expect(within(sheet).getByTestId('store-alt-scotch').textContent).toMatch(/Another whiskey could stand in/);
    expect(within(sheet).queryByTestId('store-alt-gin')).toBeNull();
  });

  it('nothing known: says so plainly and does not suggest leaving it out', async () => {
    render(<Harness initial={stateWith([{ key: 'quince', label: 'quince' }, { key: 'chili crisp', label: 'chili crisp' }])} />);
    let sheet = await open('quince');
    expect(within(sheet).getByTestId('store-alt-none').textContent).toBe("No stand-in I'd trust for quince.");
    expect(sheet.textContent).not.toMatch(/leave it out|skip it|omit/i);
    expect(within(sheet).queryAllByRole('button').map((b) => b.textContent)).toEqual(['Close']);
    fireEvent.click(within(sheet).getByTestId('store-alt-close'));
    sheet = await open('chili crisp');
    expect(within(sheet).getByTestId('store-alt-none').textContent).toBe("No stand-in I'd trust for chili crisp.");
  });

  it('a row from a sauce drops swaps that do not hold in a sauce', async () => {
    render(<Harness initial={stateWith([{ key: 'cream', label: 'cream', recipeId: 'sauce:bechamel' }], [{ id: 'sauce:bechamel', kind: 'sauce', name: 'Bechamel', addedAt: 1 }])} />);
    const sheet = await open('cream');
    expect(within(sheet).getByTestId('store-alt-none')).toBeTruthy();
  });
});

describe('picking', () => {
  it('replaces the row, keeps the original quantity (no ratio in the table), shows the usage as a note and "instead of", and Undo restores the row exactly', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk', amount: '500 ml' }])} />);
    const before = latest.list.items[0];
    const sheet = await open('buttermilk');
    fireEvent.click(within(sheet).getByTestId('store-alt-pick-milk'));
    const row = await screen.findByTestId('shopping-row-milk');
    expect(row.textContent).toMatch(/milk/);
    expect(row.textContent).toMatch(/500 ml/); // quantity text kept
    expect(row.textContent).not.toMatch(/adjusted/i);
    expect(screen.getByTestId('shopping-swap-milk').textContent).toMatch(/instead of buttermilk/);
    expect(screen.getByTestId('shopping-swap-milk').textContent).toMatch(/Use milk and lemon instead\./);
    expect(screen.getByTestId('shopping-note').textContent).toMatch(/Swapped buttermilk for milk\. Milk needs lemon, so that is on the list too\. You can undo it on the row\./);
    expect(screen.queryByTestId('store-alt-sheet')).toBeNull();
    expect(unchecked().sort()).toEqual(['lemon', 'milk']); // the companion the table names
    fireEvent.click(screen.getByTestId('shopping-undo-swap-milk'));
    await screen.findByTestId('shopping-row-buttermilk');
    const { updatedAt: _a, ...restored } = latest.list.items[0];
    const { updatedAt: _b, ...original } = before;
    expect(restored).toEqual(original);
    expect(screen.queryByTestId('shopping-swap-milk')).toBeNull();
    expect(latest.list.items).toHaveLength(1); // the lemon the swap added went with it
    expect(screen.getByTestId('shopping-note').textContent).toMatch(/Took lemon off the list again\./);
  });

  it('a companion the cook already has is not added; one already on the list is merged, never doubled', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk', amount: '500 ml' }])} stock={() => ({ kitchen: ['lemon'], pantry: [], bar: [] })} />);
    fireEvent.click(within(await open('buttermilk')).getByTestId('store-alt-pick-milk'));
    await screen.findByTestId('shopping-row-milk');
    expect(unchecked()).toEqual(['milk']);
    expect(screen.getByTestId('shopping-note').textContent).not.toMatch(/lemon/);
    cleanup();
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk', amount: '500 ml' }, { key: 'lemon', label: 'lemon', amount: '2' }])} />);
    fireEvent.click(within(await open('buttermilk')).getByTestId('store-alt-pick-milk'));
    await screen.findByTestId('shopping-row-milk');
    expect(unchecked().sort()).toEqual(['lemon', 'milk']);
    expect(latest.list.items.find((i) => i.key === 'lemon').parts).toEqual([{ qty: 2, unit: '' }]); // no amount invented for it
    expect(screen.getByTestId('shopping-note').textContent).toMatch(/Lemon is already on your list\./);
    noDupes();
  });

  it('an alternative with no companion adds nothing else', async () => {
    render(<Harness initial={stateWith([{ key: 'shallot', label: 'shallot' }])} />);
    fireEvent.click(within(await open('shallot')).getByTestId('store-alt-pick-onion'));
    await screen.findByTestId('shopping-row-onion');
    expect(unchecked()).toEqual(['onion']);
  });

  it('an alternative already on the list merges, says so, and Undo gives both rows back', async () => {
    render(<Harness initial={stateWith([
      { key: 'buttermilk', label: 'buttermilk', amount: '250 ml' }, { key: 'yogurt', label: 'yogurt', amount: '250 ml' },
    ])}
    />);
    const sheet = await open('buttermilk');
    fireEvent.click(within(sheet).getByTestId('store-alt-pick-yogurt'));
    await waitFor(() => expect(screen.queryByTestId('shopping-row-buttermilk')).toBeNull());
    expect(screen.getByTestId('shopping-note').textContent).toBe('Added to yogurt: now 500 ml.');
    expect(latest.list.items).toHaveLength(1);
    noDupes();
    fireEvent.click(screen.getByTestId('shopping-undo-swap-yogurt'));
    await screen.findByTestId('shopping-row-buttermilk');
    expect(unchecked().sort()).toEqual(['buttermilk', 'yogurt']);
    expect(latest.list.items.find((i) => i.key === 'yogurt').parts).toEqual([{ qty: 250, unit: 'ml' }]);
    noDupes();
  });

  it('no two unchecked rows ever share an ingredient across a replace, add and undo sequence', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk' }, { key: 'shallot', label: 'shallot' }, { key: 'yogurt', label: 'yogurt' }])} />);
    let sheet = await open('shallot');
    fireEvent.click(within(sheet).getByTestId('store-alt-pick-onion'));
    await screen.findByTestId('shopping-row-onion'); noDupes();
    sheet = await open('buttermilk');
    fireEvent.click(within(sheet).getByTestId('store-alt-pick-yogurt'));
    await waitFor(() => expect(screen.queryByTestId('shopping-row-buttermilk')).toBeNull()); noDupes();
    fireEvent.change(screen.getByLabelText('Item to add'), { target: { value: 'buttermilk' } });
    fireEvent.click(screen.getByTestId('shopping-add-button')); noDupes();
    fireEvent.click(screen.getByTestId('shopping-undo-swap-yogurt')); noDupes(); // buttermilk was added again meanwhile
    expect(unchecked().filter((k) => k === 'buttermilk')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('shopping-undo-swap-onion')); noDupes();
    expect(unchecked().sort()).toEqual(['buttermilk', 'shallot', 'yogurt']);
  });
});

describe('"Use what I have"', () => {
  it('marks the one the cook has, removes the row, leaves the kitchen untouched, and Undo restores it', async () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['yogurt']));
    localStorage.setItem(MY_BAR_KEY, JSON.stringify(['rye']));
    const kitchen = localStorage.getItem(MY_KITCHEN_KEY);
    const bar = localStorage.getItem(MY_BAR_KEY);
    render(<Harness
      initial={stateWith([{ key: 'buttermilk', label: 'buttermilk', amount: '1 cup' }, { key: 'garlic', label: 'garlic' }])}
      stock={() => ({ kitchen: ['yogurt'], pantry: [], bar: ['rye'] })}
    />);
    const original = latest.list.items[0];
    const sheet = await open('buttermilk');
    expect(within(sheet).getByTestId('store-alt-have-yogurt').textContent).toBe('you have this');
    expect(within(sheet).queryByTestId('store-alt-pick-yogurt')).toBeNull();
    expect(within(sheet).getByTestId('store-alt-use-have-yogurt').textContent).toBe('Use what I have');
    fireEvent.click(within(sheet).getByTestId('store-alt-use-have-yogurt'));
    await waitFor(() => expect(screen.queryByTestId('shopping-row-buttermilk')).toBeNull());
    expect(screen.getByTestId('shopping-note').textContent).toMatch(/Took buttermilk off the list: you have yogurt\./);
    expect(latest.list.items.map((i) => i.key)).toEqual(['garlic']);
    expect(localStorage.getItem(MY_KITCHEN_KEY)).toBe(kitchen);
    expect(localStorage.getItem(MY_BAR_KEY)).toBe(bar);
    fireEvent.click(screen.getByTestId('shopping-undo-removal'));
    await screen.findByTestId('shopping-row-buttermilk');
    const { updatedAt: _a, ...restored } = latest.list.items[0];
    const { updatedAt: _b, ...orig } = original;
    expect(restored).toEqual(orig);
    expect(latest.list.items.map((i) => i.key)).toEqual(['buttermilk', 'garlic']);
    expect(localStorage.getItem(MY_KITCHEN_KEY)).toBe(kitchen);
  });

  it('a bottle on the shelf is marked, and used', async () => {
    render(<Harness initial={stateWith([{ key: 'bourbon', label: 'bourbon' }])} stock={() => ({ kitchen: [], pantry: [], bar: ['rye'] })} />);
    const sheet = await open('bourbon');
    const use = await within(sheet).findByTestId('store-alt-use-have-rye');
    fireEvent.click(use);
    await waitFor(() => expect(latest.list.items).toHaveLength(0));
  });
});

describe('keyboard and focus', () => {
  it('focus goes into the sheet, Tab and Shift+Tab wrap inside it, Escape closes and focus returns to the row button', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk' }])} />);
    await ready();
    const trigger = await screen.findByTestId('shopping-alt-buttermilk');
    trigger.focus();
    fireEvent.click(trigger);
    const sheet = await screen.findByTestId('store-alt-sheet');
    const buttons = within(sheet).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Use milk instead', 'Use yogurt instead', 'Close']);
    await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
    buttons[2].focus();
    fireEvent.keyDown(buttons[2], { key: 'Tab' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0], { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(buttons[2]);
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('store-alt-sheet')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('shopping-alt-buttermilk')));
    expect(latest.list.items[0].key).toBe('buttermilk'); // closing changed nothing
  });

  it('each choice has a name that includes the ingredient it replaces', async () => {
    render(<Harness initial={stateWith([{ key: 'shallot', label: 'shallot' }])} />);
    const sheet = await open('shallot');
    expect(within(sheet).getByRole('button', { name: 'Use onion instead of shallot' })).toBeTruthy();
  });
});
