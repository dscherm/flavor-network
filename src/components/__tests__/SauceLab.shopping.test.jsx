// @vitest-environment jsdom
// SHOP-3: "Add to shopping list" on a sauce card's What do I need? panel adds exactly what the panel lists as missing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useState } from 'react';

const { node } = vi.hoisted(() => {
  const fams = [{ id: 0, name: 'Béchamel' }, { id: 3, name: 'Hollandaise' }];
  return {
    node: (name, family_id, ingredients, extra = {}) => ({
      name, family_id, family: fams.find((f) => f.id === family_id).name, ingredients,
      ingredientsDetailed: ingredients.map((n) => ({ name: n, measure: '' })),
      cuisine: 'French', instructions: 'Whisk.', proteins: [], ...extra,
    }),
  };
});

vi.mock('../../data/sauceCodex.js', () => ({
  loadSauceCodex: vi.fn().mockResolvedValue({
    nodes: new Map([
      ['Hollandaise', node('Hollandaise', 3, ['egg yolk', 'butter', 'lemon juice', 'salt'], { isRoot: true })],
      ['Beurre Blanc', node('Beurre Blanc', 3, ['cold butter', 'shallot', 'white wine'])],
      ['Béchamel', node('Béchamel', 0, ['butter', 'flour', 'milk', 'nutmeg'], { isRoot: true })],
    ]),
    edges: [],
    ingredientList: ['Béchamel', 'Hollandaise'],
    ingredientToSauces: new Map(),
    codex: { clusters: [{ id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 3, name: 'Hollandaise', color: '#f3d44e' }] },
    ingredientMeta: [
      { name: 'butter', category: 'Fat' }, { name: 'egg yolk', category: 'Thickener' }, { name: 'flour', category: 'Thickener' },
      { name: 'lemon juice', category: 'Acid' }, { name: 'milk', category: 'Liquid' }, { name: 'nutmeg', category: 'Seasoning' },
      { name: 'shallot', category: 'Aromatic' }, { name: 'white wine', category: 'Liquid' },
    ],
    pairings: [{ source: 'butter', target: 'egg yolk', strength: 0.9 }],
  }),
  computeSauceCodexPositions: vi.fn().mockReturnValue({}),
}));
vi.mock('../SaucePairings.jsx', () => ({ default: () => null }));

import SauceLab from '../SauceLab.jsx';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { MY_KITCHEN_KEY } from '../../data/myKitchen.js';

let shopping;
function Lab({ onOpen }) {
  const [state, setState] = useState(emptyShopping());
  shopping = state;
  const up = {
    profile: { sauces: [], shopping: state },
    saveInvention: vi.fn(), deleteInvention: vi.fn(),
    updateShopping: (change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); }),
  };
  return <SauceLab userProfile={up} auth={{ user: null }} onOpenShopping={onOpen} />;
}

beforeEach(() => { localStorage.clear(); });

const openSauce = async () => {
  fireEvent.click((await screen.findAllByText('Beurre Blanc'))[0]);
  const card = await screen.findByTestId('lab-node-card');
  return within(card).getByTestId('what-do-i-need');
};
const names = (section) => [...within(within(section).getByTestId('what-do-i-need-missing')).getAllByRole('listitem')]
  .map((li) => li.querySelector('span span').textContent.toLowerCase());

describe('Sauce card — Add to shopping list', () => {
  it('adds exactly the items the panel lists as missing, then shows the summary and an Open list link', async () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['shallot']));
    const onOpen = vi.fn();
    render(<Lab onOpen={onOpen} />);
    const section = await openSauce();
    const missing = names(section);
    expect(missing.length).toBeGreaterThan(0);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(shopping.list.items.map((i) => i.key)).toEqual(missing);
    expect(shopping.list.items.every((i) => i.from.join() === 'sauce:beurre-blanc')).toBe(true);
    expect(within(section).getByTestId('what-do-i-need-add-summary').textContent).toMatch(/^Added \d for Beurre Blanc: /);
    fireEvent.click(within(section).getByTestId('what-do-i-need-open-list'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('asks first when the sauce is already on the list', async () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(['shallot']));
    render(<Lab />);
    const section = await openSauce();
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    const before = JSON.stringify(shopping.list.items);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(within(section).getByTestId('what-do-i-need-add-ask')).toHaveTextContent('Beurre Blanc is already on your list.');
    expect(JSON.stringify(shopping.list.items)).toBe(before);
  });
});
