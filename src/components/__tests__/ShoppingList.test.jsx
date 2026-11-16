// @vitest-environment jsdom
// SHOP-2: the shopping list screen. A small harness holds the state the way useUserProfile does (commitList over
// the pure functions), so the screen is exercised end to end except the Firebase sync, which has its own tests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import ShoppingList from '../ShoppingList.jsx';
import LabsPanel from '../LabsPanel.jsx';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { addLine, uncheckedCount } from '../../data/shoppingList.js';
import { MY_KITCHEN_KEY } from '../../data/myKitchen.js';
import { MY_BAR_KEY } from '../../data/myBar.js';
import { resetShoppingIngredients } from '../../data/shoppingIngredients.js';

const CATS = new Map([['milk', 'dairy'], ['cheddar', 'dairy'], ['garlic', 'aromatic'], ['onion', 'aromatic'], ['vodka', 'spirit'], ['cumin', 'spice']]);
const INGREDIENTS = { names: new Set(CATS.keys()), vocab: [...CATS.keys()].sort(), categories: CATS };
const loadIngredients = () => Promise.resolve(INGREDIENTS);

let latest;
function Harness({ initial = emptyShopping(), onClose = () => {}, load = loadIngredients }) {
  const [state, setState] = useState(initial);
  latest = state;
  return <ShoppingList shopping={state} onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })} onClose={onClose} loadIngredients={load} />;
}

const stateWith = (lines, recipes = []) => {
  let list = { items: [], recipes: [] };
  let n = 0;
  for (const l of lines) list = addLine(list, l, { now: 1000 + n, newId: () => `i${n++}`, names: INGREDIENTS.names }).list;
  return { list: { ...list, recipes }, removed: {} };
};
const rowsIn = (aisle) => within(screen.getByTestId(`shopping-aisle-${aisle}`)).getAllByRole('checkbox').map((c) => c.closest('li').dataset.testid.replace('shopping-row-', ''));

beforeEach(() => { localStorage.clear(); resetShoppingIngredients(); });
afterEach(cleanup);

describe('US | Metric switch (SHOP-6)', () => {
  const mixed = () => stateWith([
    { key: 'cheddar', label: 'cheddar', amount: '200 g' },
    { key: 'milk', label: 'milk', amount: '2 cups' },
    { key: 'cumin', label: 'cumin', amount: '1 tbsp' },
  ]);
  const qtyOf = (key) => screen.getByTestId(`shopping-row-${key}`).textContent;

  it('shows US by default; the switch changes every row, the copy text and the add note, and is remembered', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { unmount } = render(<Harness initial={mixed()} />);
    expect(screen.getByTestId('shopping-units-us').getAttribute('aria-pressed')).toBe('true');
    expect(qtyOf('cheddar')).toContain('about 7 oz');
    expect(qtyOf('milk')).toContain('2 cups');
    expect(qtyOf('milk')).not.toContain('about');
    fireEvent.click(screen.getByTestId('shopping-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('- about 7 oz cheddar');

    fireEvent.click(screen.getByTestId('shopping-units-metric'));
    expect(screen.getByTestId('shopping-units-metric').getAttribute('aria-pressed')).toBe('true');
    expect(qtyOf('cheddar')).toContain('200 g');
    expect(qtyOf('cheddar')).not.toContain('about');
    expect(qtyOf('milk')).toContain('about 475 ml');
    expect(qtyOf('cumin')).toContain('about 15 ml');
    fireEvent.click(screen.getByTestId('shopping-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText.mock.calls[1][0]).toContain('- 200 g cheddar');

    fireEvent.change(screen.getByLabelText('Item to add'), { target: { value: 'cheddar' } });
    fireEvent.change(screen.getByTestId('shopping-add-amount'), { target: { value: '8 oz' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));
    expect(screen.getByTestId('shopping-note').textContent).toBe('Added to cheddar: now about 425 g.');

    unmount();
    render(<Harness initial={mixed()} />); // a reload: the choice comes back from this device
    expect(screen.getByTestId('shopping-units-metric').getAttribute('aria-pressed')).toBe('true');
    expect(qtyOf('cheddar')).toContain('200 g');
  });
});

describe('empty state and the count', () => {
  it('explains how to fill the list and has nothing to clear', async () => {
    render(<Harness />);
    expect(screen.getByTestId('shopping-empty').textContent).toMatch(/Type an item above/);
    expect(screen.getByTestId('shopping-count').textContent).toBe('Nothing on the list');
    expect(screen.queryByTestId('shopping-clear-all')).toBeNull();
    expect(screen.queryByTestId('shopping-copy')).toBeNull();
    await waitFor(() => expect(screen.getByLabelText('Item to add')).toBeTruthy());
  });

  it('the count is a polite live region and follows the list', () => {
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk' }, { key: 'garlic', label: 'garlic' }])} />);
    const count = screen.getByTestId('shopping-count');
    expect(count.getAttribute('aria-live')).toBe('polite');
    expect(count.textContent).toBe('2 to buy');
    fireEvent.click(screen.getByRole('checkbox', { name: /milk/ }));
    expect(count.textContent).toBe('1 to buy, 1 in the basket');
  });

  it('Back calls onClose', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByTestId('shopping-back'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('check and uncheck', () => {
  it('checking strikes the row through and drops it to the bottom of its aisle; unchecking restores it', async () => {
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk' }, { key: 'cheddar', label: 'cheddar' }])} />);
    await screen.findByTestId('shopping-aisle-dairy'); // the aisles arrive with the ingredient table
    expect(rowsIn('dairy')).toEqual(['milk', 'cheddar']);
    const milk = screen.getByRole('checkbox', { name: /milk/ });
    fireEvent.click(milk);
    expect(rowsIn('dairy')).toEqual(['cheddar', 'milk']);
    const label = within(screen.getByTestId('shopping-row-milk')).getByText('milk');
    expect(label.style.textDecoration).toBe('line-through');
    expect(screen.getByRole('checkbox', { name: /milk/ }).checked).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /milk/ }));
    expect(rowsIn('dairy')).toEqual(['milk', 'cheddar']);
    expect(within(screen.getByTestId('shopping-row-milk')).getByText('milk').style.textDecoration).toBe('none');
  });

  it('shows the quantity and which recipes a line is for, in aisles', async () => {
    render(<Harness initial={stateWith(
      [{ key: 'garlic', label: 'garlic', amount: '4 cloves', recipeId: 'r1' }, { key: 'cumin', label: 'cumin' }],
      [{ id: 'r1', kind: 'dish', name: 'Beef Bolognese', addedAt: 1 }],
    )}
    />);
    await waitFor(() => expect(screen.getByTestId('shopping-aisle-produce')).toBeTruthy());
    expect(screen.getByTestId('shopping-aisle-spices')).toBeTruthy();
    const row = screen.getByTestId('shopping-row-garlic');
    expect(row.textContent).toMatch(/garlic/);
    expect(row.textContent).toMatch(/4 cloves/);
    expect(row.textContent).toMatch(/for Beef Bolognese/);
  });

  it('every row is a real labelled checkbox that can be reached by keyboard and rows are at least 44px tall by class', () => {
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk', amount: '1 l' }])} />);
    const box = screen.getByRole('checkbox', { name: /milk/ });
    expect(box.tagName).toBe('INPUT');
    expect(box.getAttribute('type')).toBe('checkbox');
    expect(box.tabIndex).toBeGreaterThanOrEqual(0);
    box.focus();
    expect(document.activeElement).toBe(box);
    expect(box.closest('label').className).toMatch(/min-h-\[56px\]/);
  });
});

describe('add an item', () => {
  it('free text with an amount, then the same item again: merged, and the screen says what happened', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Item to add'), { target: { value: 'garlic' } });
    fireEvent.change(screen.getByLabelText('Amount (optional)'), { target: { value: '2 cloves' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Add an item' }));
    expect(screen.getByTestId('shopping-note').textContent).toBe('Added garlic (2 cloves).');
    expect(screen.getByLabelText('Item to add').value).toBe('');
    fireEvent.change(screen.getByLabelText('Item to add'), { target: { value: 'garlic' } });
    fireEvent.change(screen.getByLabelText('Amount (optional)'), { target: { value: '3 cloves' } });
    fireEvent.click(screen.getByTestId('shopping-add-button'));
    expect(screen.getByTestId('shopping-note').textContent).toBe('Added to garlic: now 5 cloves.');
    expect(latest.list.items).toHaveLength(1);
  });

  it('an item already on the list with no quantity is not doubled', () => {
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk' }])} />);
    fireEvent.change(screen.getByLabelText('Item to add'), { target: { value: 'milk' } });
    fireEvent.click(screen.getByTestId('shopping-add-button'));
    expect(screen.getByTestId('shopping-note').textContent).toBe('Milk is already on your list.');
    expect(latest.list.items).toHaveLength(1);
  });

  it('typeahead over the curated ingredients: typing offers matches, tapping one adds it', async () => {
    render(<Harness />);
    await waitFor(() => expect(INGREDIENTS.vocab.length).toBeGreaterThan(0));
    // let the ingredient names arrive
    await screen.findByLabelText('Item to add');
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText('Item to add'), { target: { value: 'gar' } });
      expect(screen.getByTestId('shopping-suggestions')).toBeTruthy();
    });
    fireEvent.click(within(screen.getByTestId('shopping-suggestions')).getByRole('button', { name: 'garlic' }));
    expect(latest.list.items.map((i) => i.key)).toEqual(['garlic']);
    expect(screen.getByTestId('shopping-note').textContent).toBe('Added garlic.');
    expect(screen.queryByTestId('shopping-suggestions')).toBeNull();
  });

  it('blank input says so and adds nothing', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('shopping-add-button'));
    expect(screen.getByTestId('shopping-note').textContent).toBe('Type what you need first.');
    expect(latest.list.items).toHaveLength(0);
  });

  it('still works when the ingredient names fail to load', async () => {
    render(<Harness load={() => Promise.reject(new Error('offline'))} />);
    await screen.findByText(/Ingredient suggestions are not available/);
    fireEvent.change(screen.getByLabelText('Item to add'), { target: { value: 'chili crisp' } });
    fireEvent.click(screen.getByTestId('shopping-add-button'));
    expect(latest.list.items.map((i) => i.key)).toEqual(['chili crisp']);
    expect(screen.getByTestId('shopping-aisle-other')).toBeTruthy();
  });
});

describe('copy, clear checked, clear all', () => {
  it('Copy list copies the unchecked items in the existing copy format', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk', amount: '1 l' }, { key: 'garlic', label: 'garlic' }])} />);
    fireEvent.click(screen.getByTestId('shopping-units-metric'));
    fireEvent.click(screen.getByRole('checkbox', { name: /garlic/ }));
    fireEvent.click(screen.getByTestId('shopping-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('- 1 l milk');
    expect(writeText.mock.calls[0][0]).not.toContain('garlic');
    await waitFor(() => expect(screen.getByTestId('shopping-note').textContent).toBe('Copied 1 item.'));
  });

  it('Clear checked removes only ticked rows, and only shows when something is ticked', () => {
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk' }, { key: 'garlic', label: 'garlic' }])} />);
    expect(screen.queryByTestId('shopping-clear-checked')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /milk/ }));
    fireEvent.click(screen.getByTestId('shopping-clear-checked'));
    expect(latest.list.items.map((i) => i.key)).toEqual(['garlic']);
    expect(Object.keys(latest.removed)).toHaveLength(1);
    expect(screen.getByTestId('shopping-note').textContent).toBe('Cleared 1 checked item.');
  });

  it('Clear all asks first and can be cancelled; confirming empties the list', () => {
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk' }, { key: 'garlic', label: 'garlic' }])} />);
    fireEvent.click(screen.getByTestId('shopping-clear-all'));
    const ask = screen.getByRole('alertdialog');
    expect(ask.textContent).toMatch(/removes all 2 items/);
    expect(latest.list.items).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByTestId('shopping-clear-cancel'));
    fireEvent.click(screen.getByTestId('shopping-clear-cancel'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(latest.list.items).toHaveLength(2);
    fireEvent.click(screen.getByTestId('shopping-clear-all'));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(latest.list.items).toHaveLength(2);
    fireEvent.click(screen.getByTestId('shopping-clear-all'));
    fireEvent.click(screen.getByTestId('shopping-clear-confirm-yes'));
    expect(latest.list.items).toHaveLength(0);
    expect(Object.keys(latest.removed)).toHaveLength(2);
    expect(screen.getByTestId('shopping-empty')).toBeTruthy();
  });
});

describe('Put checked items in my kitchen', () => {
  it('is a button, never automatic: ticking alone moves nothing', () => {
    render(<Harness initial={stateWith([{ key: 'garlic', label: 'garlic' }])} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /garlic/ }));
    expect(localStorage.getItem(MY_KITCHEN_KEY)).toBeNull();
    expect(screen.getByTestId('shopping-put-away').textContent).toBe('Put checked items in my kitchen');
  });

  it('food goes to My kitchen, spirits to My bar, those rows are cleared and the screen says how many went where', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['salt']));
    render(<Harness initial={stateWith([
      { key: 'garlic', label: 'garlic' }, { key: 'milk', label: 'milk' }, { key: 'vodka', label: 'vodka' }, { key: 'cumin', label: 'cumin' },
    ])} />);
    for (const name of [/garlic/, /milk/, /vodka/]) fireEvent.click(screen.getByRole('checkbox', { name }));
    fireEvent.click(screen.getByTestId('shopping-put-away'));
    expect(JSON.parse(localStorage.getItem(MY_KITCHEN_KEY))).toEqual(['salt', 'garlic', 'milk']);
    expect(JSON.parse(localStorage.getItem(MY_BAR_KEY))).toEqual(['vodka']);
    expect(latest.list.items.map((i) => i.key)).toEqual(['cumin']);
    expect(screen.getByTestId('shopping-note').textContent).toBe('Put 2 items in My kitchen and 1 item in My bar, and took them off the list.');
    expect(screen.queryByTestId('shopping-put-away')).toBeNull();
  });

  it('an item already in the kitchen is not added twice', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['garlic']));
    render(<Harness initial={stateWith([{ key: 'garlic', label: 'garlic' }])} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /garlic/ }));
    fireEvent.click(screen.getByTestId('shopping-put-away'));
    expect(JSON.parse(localStorage.getItem(MY_KITCHEN_KEY))).toEqual(['garlic']);
  });

  it('if the device will not save, the rows stay on the list and it says so', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    render(<Harness initial={stateWith([{ key: 'garlic', label: 'garlic' }])} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /garlic/ }));
    fireEvent.click(screen.getByTestId('shopping-put-away'));
    spy.mockRestore();
    expect(latest.list.items).toHaveLength(1);
    expect(screen.getByTestId('shopping-note').textContent).toMatch(/stay on your list/);
  });
});

describe('the Labs menu entry', () => {
  it('shows the unchecked count and opens the list', () => {
    const onPick = vi.fn();
    const list = stateWith([{ key: 'milk', label: 'milk' }, { key: 'garlic', label: 'garlic' }, { key: 'cumin', label: 'cumin' }]);
    render(<LabsPanel onPick={onPick} shoppingCount={uncheckedCount(list.list)} />);
    expect(screen.getByTestId('labs-shopping-count').textContent).toBe('3');
    expect(screen.getByTestId('labs-card-shopping').getAttribute('aria-label')).toBe('Shopping list, 3 to buy');
    fireEvent.click(screen.getByTestId('labs-card-shopping'));
    expect(onPick).toHaveBeenCalledWith('shopping');
  });

  it('shows no badge when nothing is left to buy', () => {
    render(<LabsPanel onPick={() => {}} shoppingCount={0} />);
    expect(screen.queryByTestId('labs-shopping-count')).toBeNull();
    expect(screen.getByTestId('labs-card-shopping')).toBeTruthy();
  });
});
