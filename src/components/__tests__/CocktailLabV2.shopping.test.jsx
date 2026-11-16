// @vitest-environment jsdom
// SHOP-3: "Add to shopping list" on a cocktail card's What do I need? panel adds exactly what the panel lists as missing.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ingredients = read('public/proDataset/ingredients.json');

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../ClusterJoystick.jsx', () => ({ default: () => null }));
vi.mock('../ShapeLegend.jsx', () => ({ default: () => null }));
vi.mock('../../three/AxisLabels.js', () => ({ createClusterLabels: () => ({ add: () => {} }), createGlowSprite: () => ({}) }));
vi.mock('../../data/cocktailCodexV2.js', () => ({
  loadCodexV2: (raw) => raw,
  curateCodexRaw: (raw) => raw,
  placeCocktailInFamily: () => ({ x: 0, y: 0, z: 0 }),
  topSimilar: () => [],
  crossFamilySimilar: () => [],
  cocktailSimilarity: () => 0,
}));
vi.mock('../../data/ingredientRoles.js', async (orig) => ({
  ...(await orig()),
  getCocktailRoles: vi.fn(async () => JSON.parse((await import('node:fs')).default.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient),
}));
vi.mock('../InventCocktail.jsx', () => ({ default: () => null }));

import CocktailLabV2 from '../CocktailLabV2.jsx';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { MY_BAR_KEY } from '../../data/myBar.js';
import { MY_KITCHEN_KEY } from '../../data/myKitchen.js';

const codex = readCuratedCodex();
const keep = new Set(['Negroni', 'Daiquiri']);
const picked = codex.cocktails.filter((c) => keep.has(c.name));
const GRAPH = {
  ...codex,
  cocktails: picked,
  byFamily: new Map(codex.families.map((f) => [f.id, picked.filter((c) => c.family_id === f.id)])),
  byCanonical: new Map(picked.map((c) => [c.canonical, c])),
};
const fullData = { graph: { nodes: new Map(Object.entries(ingredients)), edges: [] } };

let shopping;
function Lab({ onOpen }) {
  const [state, setState] = useState(emptyShopping());
  shopping = state;
  const up = {
    profile: { cocktails: [], shopping: state },
    saveInvention: vi.fn(), deleteInvention: vi.fn(),
    updateShopping: (change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); }),
  };
  return <CocktailLabV2 fullData={fullData} userProfile={up} auth={{ user: null }} onOpenShopping={onOpen} />;
}


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
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => GRAPH });
});

const openNegroni = async () => {
  fireEvent.click((await screen.findAllByText('Negroni'))[0]);
  const card = await screen.findByTestId('lab-node-card');
  return within(card).getByTestId('what-do-i-need');
};
const names = (section) => [...within(within(section).getByTestId('what-do-i-need-missing')).getAllByRole('listitem')]
  .map((li) => li.querySelector('span span').textContent.toLowerCase());

describe('Cocktail card — Add to shopping list', () => {
  it('adds exactly the items the panel lists as missing, then shows the summary and an Open list link', async () => {
    localStorage.setItem(MY_BAR_KEY, JSON.stringify(['gin']));
    const onOpen = vi.fn();
    render(<Lab onOpen={onOpen} />);
    const section = await openNegroni();
    const missing = names(section);
    expect(missing).toEqual(['sweet vermouth', 'campari']);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(shopping.list.items.map((i) => i.key)).toEqual(missing);
    expect(shopping.list.items.every((i) => i.from.join() === 'cocktail:negroni')).toBe(true);
    expect(within(section).getByTestId('what-do-i-need-add-summary').textContent).toMatch(/^Added 2 for Negroni: /);
    fireEvent.click(within(section).getByTestId('what-do-i-need-open-list'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('the rows added equal the lines Copy shopping list copies', async () => {
    localStorage.setItem(MY_BAR_KEY, JSON.stringify(['gin']));
    render(<Lab />);
    const section = await openNegroni();
    const copied = await copiedLines(section);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    sameAsCopy(copied, shopping.list.items.map((i) => i.key));
  });

  it('asks first when the cocktail is already on the list', async () => {
    localStorage.setItem(MY_BAR_KEY, JSON.stringify(['gin']));
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify([]));
    render(<Lab />);
    const section = await openNegroni();
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    const before = JSON.stringify(shopping.list.items);
    const once = shopping.list.items.find((i) => i.key === 'campari').parts[0];
    expect(once.qty).toBeGreaterThan(0);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    expect(within(section).getByTestId('what-do-i-need-add-ask')).toHaveTextContent('Negroni is already on your list. Add it again?');
    expect(JSON.stringify(shopping.list.items)).toBe(before);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-cancel'));
    expect(JSON.stringify(shopping.list.items)).toBe(before);
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-shopping'));
    fireEvent.click(within(section).getByTestId('what-do-i-need-add-again'));
    expect(shopping.list.items.find((i) => i.key === 'campari').parts).toEqual([{ qty: once.qty * 2, unit: once.unit }]);
  });
});
