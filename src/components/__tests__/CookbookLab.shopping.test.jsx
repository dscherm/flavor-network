// @vitest-environment jsdom
// SHOP-3: "Add to shopping list" on a Cookbook recipe's What do I need? panel adds exactly what the panel lists as missing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';
import CookbookLab from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { MY_KITCHEN_KEY } from '../../data/myKitchen.js';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';

vi.setConfig({ testTimeout: 20000 });
vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../MultiAxisRadarStack.jsx', () => ({ default: () => null }));

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
const names = (section) => [...within(within(section).getByTestId('what-do-i-need-missing')).getAllByRole('listitem')]
  .map((li) => li.querySelector('span span').textContent.toLowerCase());

beforeEach(() => {
  localStorage.clear();
  if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

describe('Cookbook recipe — Add to shopping list', () => {
  it('adds exactly the "You need" items the panel lists (not the "even better with" ones), then Open list', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['beef', 'tomato', 'shallot', 'carrot', 'pasta', 'garlic']));
    const onOpen = vi.fn();
    render(<Lab onOpen={onOpen} />);
    const section = openBolognese();
    const missing = names(section);
    expect(missing).toEqual(['celery']);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(shopping.list.items.map((i) => i.key)).toEqual(missing);
    expect(shopping.list.items[0].from).toEqual(['dish:beef-bolognese']);
    expect(within(section).getByTestId('what-do-i-need-add-summary').textContent).toMatch(/^Added 1 for Beef Bolognese: celery/);
    fireEvent.click(within(section).getByTestId('what-do-i-need-open-list'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('with an empty kitchen it adds everything listed, and asks first the second time', () => {
    render(<Lab />);
    const section = openBolognese();
    const missing = names(section);
    expect(missing.length).toBeGreaterThan(3);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(shopping.list.items.map((i) => i.key).sort()).toEqual([...missing].sort());
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(within(section).getByTestId('what-do-i-need-add-ask')).toHaveTextContent('Beef Bolognese is already on your list. Add it again? It will add to the quantities.');
  });

  it('shows no button on a panel with nothing missing', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['beef', 'tomato', 'onion', 'carrot', 'celery', 'pasta']));
    render(<Lab />);
    const section = openBolognese();
    expect(within(section).queryByTestId('what-do-i-need-add-shopping')).toBeNull();
  });
});
