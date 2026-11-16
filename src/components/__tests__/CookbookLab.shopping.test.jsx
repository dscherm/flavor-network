// @vitest-environment jsdom
// SHOP-3 / SHOP-7: "Add to shopping list" on a Cookbook recipe's What do I need? panel adds what "Copy shopping list" copies:
// the missing "You need" lines and the optional ones ("Even better with", "Nice to have").
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import CookbookLab from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { MY_KITCHEN_KEY } from '../../data/myKitchen.js';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';

vi.setConfig({ testTimeout: 20000 });
vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));

const CATS = { beef: 'protein', tomato: 'vegetable', onion: 'aromatic', carrot: 'vegetable', celery: 'vegetable', garlic: 'aromatic', 'red wine': 'liquid', pasta: 'grain' };
const bolognese = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
const ctx = { graph: { nodes: new Map(bolognese.ingredients.map((n) => [n, { name: n, category: CATS[n] }])) } };

let shopping;
function Lab({ onOpen }) {
  const [state, setState] = useState(emptyShopping());
  shopping = state;
  const up = {
    profile: { recipes: [], shopping: state },
    updateShopping: (change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); }),
  };
  return <CookbookLab ctx={ctx} userProfile={up} onOpenShopping={onOpen} />;
}

const openBolognese = () => {
  fireEvent.click(screen.getByRole('button', { name: /Beef Bolognese/i }));
  return within(screen.getByRole('dialog')).getByTestId('what-do-i-need');
};
const optionalNames = (section) => {
  const t = (id) => within(section).queryByTestId(id)?.textContent.replace(/^[^:]*:\s*/, '') || '';
  return [t('what-do-i-need-better'), t('what-do-i-need-optional')].join(',').split(',').map((x) => x.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase()).filter(Boolean);
};
const names = (section) => [...within(within(section).getByTestId('what-do-i-need-missing')).getAllByRole('listitem')]
  .map((li) => li.querySelector('span span').textContent.toLowerCase());


// SHOP-7: the rows "Add to shopping list" adds are the lines "Copy shopping list" copies.
async function copiedLines(section) {
  let text = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { text = t; } } });
  fireEvent.click(within(section).getByTestId('what-do-i-need-copy'));
  await waitFor(() => expect(text).not.toBe(''));
  return text.split(/\r?\n/).filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
}
const sameAsCopy = (copied, keys) => {
  expect(keys).toHaveLength(copied.length);
  for (const k of keys) expect(copied.filter((l) => l.toLowerCase().endsWith(k))).toHaveLength(1);
};

beforeEach(() => {
  localStorage.clear();
  if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

describe('Cookbook recipe — Add to shopping list', () => {
  it('adds the "You need" items and the "Even better with" ones, the same lines Copy copies, then Open list', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['beef', 'tomato', 'shallot', 'carrot', 'pasta', 'garlic']));
    const onOpen = vi.fn();
    render(<Lab onOpen={onOpen} />);
    const section = openBolognese();
    const missing = names(section);
    expect(missing).toEqual(['celery']);
    expect(optionalNames(section)).toEqual(['red wine']);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(shopping.list.items.map((i) => i.key)).toEqual([...missing, ...optionalNames(section)]);
    expect(shopping.list.items[0].from).toEqual(['dish:beef-bolognese']);
    expect(within(section).getByTestId('what-do-i-need-add-summary').textContent).toMatch(/^Added 2 for Beef Bolognese: celery, red wine\. 1 of those is optional\./);
    fireEvent.click(within(section).getByTestId('what-do-i-need-open-list'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('the rows added equal the lines Copy shopping list copies', async () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['beef', 'tomato', 'shallot', 'carrot', 'pasta', 'garlic']));
    render(<Lab />);
    const section = openBolognese();
    const copied = await copiedLines(section);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    sameAsCopy(copied, shopping.list.items.map((i) => i.key));
  });

  it('with an empty kitchen it adds everything listed, and asks first the second time', () => {
    render(<Lab />);
    const section = openBolognese();
    const missing = names(section);
    expect(missing.length).toBeGreaterThan(3);
    const optional = optionalNames(section);
    expect(optional.length).toBeGreaterThan(0);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(shopping.list.items.map((i) => i.key).sort()).toEqual([...missing, ...optional].sort());
    expect(within(section).getByTestId('what-do-i-need-add-summary').textContent).toMatch(new RegExp(`${optional.length === 1 ? '1 of those is' : `${optional.length} of those are`} optional`));
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(within(section).getByTestId('what-do-i-need-add-ask')).toHaveTextContent('Beef Bolognese is already on your list. Add it again? It will add to the quantities.');
  });

  it('shows no button on a panel with nothing missing', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['beef', 'tomato', 'onion', 'carrot', 'celery', 'pasta', 'garlic', 'red wine']));
    render(<Lab />);
    const section = openBolognese();
    expect(within(section).queryByTestId('what-do-i-need-add-shopping')).toBeNull();
  });
});
