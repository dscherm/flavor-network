// @vitest-environment jsdom
// SHOP-3: "Add from a recipe" inside the shopping list. A small harness holds the state the way useUserProfile does
// (commitList over the pure functions). Recipes are the REAL built-in ones (codex, sauce file, dish list).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveUnitSystem } from '../../data/shoppingUnits.js';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ShoppingList from '../ShoppingList.jsx';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { addLine, uncheckedCount, MAX_ITEMS } from '../../data/shoppingList.js';
import { resetShoppingIngredients } from '../../data/shoppingIngredients.js';
import { resetRecipeSources } from '../../data/shoppingRecipes.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const root = process.cwd();
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync(resolve(root, 'public/data/sauce_augment.json'), 'utf8')).sauces;
const DATA = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const loadRecipes = vi.fn(() => Promise.resolve(DATA));
const loadIngredients = () => Promise.resolve({ names: new Set(), vocab: [], categories: new Map() });

const OWN = {
  cocktails: [{ id: 'c1', name: 'Porch Spritz', lines: [{ key: 'prosecco', amount: '90 ml' }, { key: 'aperol', amount: '60 ml' }] }],
  sauces: [{ id: 's1', name: 'Miso Butter', lines: [{ key: 'miso', amount: '2 tbsp' }, { key: 'butter', amount: '4 tbsp' }] }],
  recipes: [{ id: 'r1', name: 'Weeknight Dal', lines: [{ key: 'lentils', amount: '200 g' }, { key: 'garlic', amount: '3 cloves' }] }],
};

let latest;
function Harness({ initial = emptyShopping(), stock, own = OWN, load = loadRecipes }) {
  const [state, setState] = useState(initial);
  latest = state;
  return (
    <ShoppingList
      shopping={state}
      onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })}
      onClose={() => {}}
      loadIngredients={loadIngredients}
      own={own}
      loadRecipes={load}
      recipeStock={stock}
    />
  );
}

const STOCK = { kitchen: ['onion', 'carrot', 'garlic', 'milk'], pantry: [], bar: ['gin'], spiceRack: false };
const stockOf = (s) => () => s;
const keys = () => latest.list.items.map((i) => i.key);
const qty = (key) => {
  const row = screen.queryByTestId(`shopping-row-${key}`);
  return row ? row.textContent : null;
};

async function search(text) {
  if (!screen.queryByTestId('shopping-recipe-search')) fireEvent.click(screen.getByTestId('shopping-recipe-toggle'));
  const box = await screen.findByTestId('shopping-recipe-search');
  fireEvent.change(box, { target: { value: text } });
  return box;
}
async function openRecipe(name, id) {
  await search(name);
  fireEvent.click(await screen.findByTestId(`shopping-recipe-result-${id}`));
  return screen.findByTestId('shopping-recipe-preview');
}

// Amounts here are metric; show metric so these tests stay about adding (SHOP-6 default is US).
beforeEach(() => { localStorage.clear(); saveUnitSystem('metric'); resetShoppingIngredients(); resetRecipeSources(); loadRecipes.mockClear(); });
afterEach(cleanup);

describe('finding a recipe by name', () => {
  it('finds a built-in drink, sauce and dish, and the cook\'s own saved cocktail, sauce and recipe, each with its kind', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    await search('negroni');
    expect(within(await screen.findByTestId('shopping-recipe-result-cocktail:negroni')).getByText('Cocktail')).toBeTruthy();
    await search('bechamel');
    expect(within(await screen.findByTestId('shopping-recipe-result-sauce:bechamel')).getByText('Sauce')).toBeTruthy();
    await search('bolognese');
    expect(within(await screen.findByTestId('shopping-recipe-result-dish:beef-bolognese')).getByText('Dish')).toBeTruthy();
    await search('spritz');
    expect(within(await screen.findByTestId('shopping-recipe-result-own:cocktail:c1')).getByText('Your cocktail')).toBeTruthy();
    await search('miso');
    expect(within(await screen.findByTestId('shopping-recipe-result-own:sauce:s1')).getByText('Your sauce')).toBeTruthy();
    await search('dal');
    expect(within(await screen.findByTestId('shopping-recipe-result-own:recipe:r1')).getByText('Your dish')).toBeTruthy();
  });

  it('says so when no recipe has that name', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    await search('zzzz nothing');
    expect(await screen.findByTestId('shopping-recipe-none')).toHaveTextContent('No recipe has that name');
  });

  it('opens the saved recipes even when the built-in files fail to load, and says so', async () => {
    render(<Harness stock={stockOf(STOCK)} load={() => Promise.reject(new Error('offline'))} />);
    await search('dal');
    expect(await screen.findByRole('alert')).toHaveTextContent('only your own saved recipes are searchable');
    expect(screen.getByTestId('shopping-recipe-result-own:recipe:r1')).toBeTruthy();
  });
});

describe('the preview', () => {
  it('ticks exactly the missing lines, leaves the owned ones unticked and says where each was found', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const pv = await openRecipe('bolognese', 'dish:beef-bolognese');
    const need = within(within(pv).getByTestId('shopping-preview-need')).getAllByRole('checkbox');
    expect(need.map((c) => c.dataset.testid.replace('shopping-preview-line-', ''))).toEqual(['beef', 'tomato', 'celery', 'red wine', 'pasta']);
    expect(need.every((c) => c.checked)).toBe(true);
    const have = within(within(pv).getByTestId('shopping-preview-have')).getAllByRole('checkbox');
    expect(have.map((c) => c.dataset.testid.replace('shopping-preview-line-', ''))).toEqual(['onion', 'carrot', 'garlic']);
    expect(have.some((c) => c.checked)).toBe(false);
    expect(within(pv).getAllByText(/you have it: My kitchen/)).toHaveLength(3);
    expect(within(pv).getByTestId('shopping-preview-add')).toHaveTextContent('Add 5 to the list');
  });

  it('labels an owned drink ingredient as found in My bar', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const pv = await openRecipe('negroni', 'cocktail:negroni');
    expect(within(pv).getByText('you have it: My bar')).toBeTruthy();
    expect(within(pv).getByTestId('shopping-preview-add')).toHaveTextContent('Add 2 to the list');
  });

  it('labels the sauce pantry and the spice rack when that is where the ingredient was found', async () => {
    render(<Harness stock={stockOf({ kitchen: [], pantry: ['butter'], bar: [], spiceRack: true })} />);
    const pv = await openRecipe('bechamel', 'sauce:bechamel');
    expect(within(pv).getByText('you have it: sauce pantry')).toBeTruthy();
    expect(within(pv).getByText('you have it: spice rack')).toBeTruthy();
  });

  it('un-ticking a needed line leaves it off; ticking a "you have" line adds it', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const pv = await openRecipe('bolognese', 'dish:beef-bolognese');
    fireEvent.click(within(pv).getByTestId('shopping-preview-line-celery'));
    fireEvent.click(within(pv).getByTestId('shopping-preview-line-onion'));
    expect(within(pv).getByTestId('shopping-preview-add')).toHaveTextContent('Add 5 to the list');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    expect(keys()).toEqual(['beef', 'tomato', 'onion', 'red wine', 'pasta']);
    expect(keys()).not.toContain('celery');
    expect(latest.list.items.find((i) => i.key === 'onion').from).toEqual(['dish:beef-bolognese']);
  });

  it('nothing ticked disables Add', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const pv = await openRecipe('negroni', 'cocktail:negroni');
    fireEvent.click(within(pv).getByTestId('shopping-preview-line-sweet vermouth'));
    fireEvent.click(within(pv).getByTestId('shopping-preview-line-campari'));
    const add = within(pv).getByTestId('shopping-preview-add');
    expect(add).toBeDisabled();
    expect(add).toHaveTextContent('Nothing ticked');
  });

  it('Include basics adds the basics the cook lacks, and leaves them off by default', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    let pv = await openRecipe('bechamel', 'sauce:bechamel');
    expect(within(pv).getByTestId('shopping-preview-add')).toHaveTextContent('Add 2 to the list');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    expect(keys()).toEqual(['white pepper', 'nutmeg']);
    cleanup();
    render(<Harness stock={stockOf(STOCK)} />);
    pv = await openRecipe('bechamel', 'sauce:bechamel');
    fireEvent.click(within(pv).getByTestId('shopping-preview-basics'));
    expect(within(pv).getByTestId('shopping-preview-add')).toHaveTextContent('Add 5 to the list');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    expect(keys()).toEqual(['butter', 'flour', 'salt', 'white pepper', 'nutmeg']);
  });

  it('a recipe the cook has everything for says so, and offers to add it anyway', async () => {
    render(<Harness stock={stockOf({ kitchen: ['sweet vermouth'], pantry: [], bar: ['gin', 'campari'], spiceRack: false })} />);
    const pv = await openRecipe('negroni', 'cocktail:negroni');
    expect(within(pv).getByTestId('shopping-preview-everything')).toHaveTextContent('You have everything for this.');
    expect(within(pv).getByTestId('shopping-preview-add')).toBeDisabled();
    fireEvent.click(within(pv).getByTestId('shopping-preview-add-anyway'));
    expect(keys()).toEqual(['gin', 'sweet vermouth', 'campari']);
  });
});

describe('after adding', () => {
  it('says what was added and moves the focus back to the search box', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const pv = await openRecipe('bolognese', 'dish:beef-bolognese');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    const s = screen.getByTestId('shopping-recipe-summary').textContent;
    expect(s).toBe('Added 5 for Beef Bolognese: beef, tomato, celery, red wine, pasta. Left off 3 you already have.');
    expect(screen.queryByTestId('shopping-recipe-preview')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('shopping-recipe-search')));
    expect(screen.getByTestId('shopping-count').textContent).toBe('5 to buy');
  });

  it('two real recipes sharing pasta, added one after the other, leave one line with the summed quantity, and the summary says so', async () => {
    render(<Harness stock={stockOf({ kitchen: [], pantry: [], bar: [], spiceRack: false })} />);
    let pv = await openRecipe('bolognese', 'dish:beef-bolognese');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    expect(latest.list.items.filter((i) => i.key === 'pasta')).toHaveLength(1);
    pv = await openRecipe('carbonara', 'dish:spaghetti-carbonara');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    const pasta = latest.list.items.filter((i) => i.key === 'pasta');
    expect(pasta).toHaveLength(1);
    expect(pasta[0].parts).toEqual([{ qty: 600, unit: 'g' }]);
    expect(pasta[0].from).toEqual(['dish:beef-bolognese', 'dish:spaghetti-carbonara']);
    expect(screen.getByTestId('shopping-recipe-summary').textContent).toContain('Merged into lines already on your list: pasta: now 600 g');
    expect(qty('pasta')).toContain('600 g');
  });

  it('asks first when the recipe is already on the list; Cancel adds nothing, "Add it again" adds to the quantities', async () => {
    render(<Harness stock={stockOf({ kitchen: [], pantry: [], bar: [], spiceRack: false })} />);
    let pv = await openRecipe('bolognese', 'dish:beef-bolognese');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    const before = latest.list.items.map((i) => ({ key: i.key, parts: i.parts }));
    pv = await openRecipe('bolognese', 'dish:beef-bolognese');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    const ask = await screen.findByTestId('shopping-preview-ask');
    expect(ask).toHaveTextContent('Beef Bolognese is already on your list. Add it again? It will add to the quantities.');
    expect(ask.getAttribute('role')).toBe('alertdialog');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('shopping-preview-ask-cancel')));
    expect(latest.list.items.map((i) => ({ key: i.key, parts: i.parts }))).toEqual(before);
    fireEvent.click(screen.getByTestId('shopping-preview-ask-cancel'));
    expect(screen.queryByTestId('shopping-preview-ask')).toBeNull();
    expect(latest.list.items.map((i) => ({ key: i.key, parts: i.parts }))).toEqual(before);
    fireEvent.click(screen.getByTestId('shopping-preview-add'));
    fireEvent.click(await screen.findByTestId('shopping-preview-ask-yes'));
    expect(latest.list.items.find((i) => i.key === 'beef').parts).toEqual([{ qty: 1000, unit: 'g' }]);
    expect(screen.getByTestId('shopping-recipe-summary').textContent).toContain('beef: now 1000 g');
  });

  it('says plainly when the 200-item cap is hit', async () => {
    let list = { items: [], recipes: [] };
    for (let i = 0; i < MAX_ITEMS; i += 1) list = addLine(list, { key: `thing ${i}`, label: `thing ${i}` }, { now: 1000 + i, newId: () => `i${i}` }).list;
    render(<Harness initial={{ list, removed: {} }} stock={stockOf({ kitchen: [], pantry: [], bar: [], spiceRack: false })} />);
    const pv = await openRecipe('negroni', 'cocktail:negroni');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    expect(screen.getByTestId('shopping-recipe-summary').textContent).toMatch(/holds up to 200 items/);
    expect(latest.list.items).toHaveLength(MAX_ITEMS);
    expect(uncheckedCount(latest.list)).toBe(MAX_ITEMS);
  });
});

describe('own saved recipes', () => {
  it('previews and adds the cook\'s own recipe, keeping its own id so it is not confused with a built-in', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const pv = await openRecipe('dal', 'own:recipe:r1');
    expect(within(pv).getByText('you have it: My kitchen')).toBeTruthy();
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    expect(keys()).toEqual(['lentils']);
    expect(latest.list.items[0].from).toEqual(['own:recipe:r1']);
    expect(latest.list.recipes[0]).toMatchObject({ id: 'own:recipe:r1', kind: 'dish', name: 'Weeknight Dal' });
  });
});

describe('keyboard and structure', () => {
  it('the toggle exposes aria-expanded, the preview takes focus, Escape returns to the search box', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const toggle = screen.getByTestId('shopping-recipe-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('shopping-recipe-search')));
    const pv = await openRecipe('negroni', 'cocktail:negroni');
    await waitFor(() => expect(document.activeElement).toBe(within(pv).getByRole('heading', { level: 2 })));
    fireEvent.keyDown(pv, { key: 'Escape' });
    expect(screen.queryByTestId('shopping-recipe-preview')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('shopping-recipe-search')));
  });

  it('every preview line is a real checkbox with a label', async () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const pv = await openRecipe('bolognese', 'dish:beef-bolognese');
    expect(within(pv).getByRole('checkbox', { name: /beef/ })).toBeTruthy();
    expect(within(pv).getByRole('checkbox', { name: /onion/ })).toBeTruthy();
  });

  it('the empty state names both ways to fill the list', () => {
    render(<Harness stock={stockOf(STOCK)} />);
    const t = screen.getByTestId('shopping-empty').textContent;
    expect(t).toMatch(/Type an item above/);
    expect(t).toMatch(/add a recipe/);
    fireEvent.click(screen.getByTestId('shopping-empty-help'));
    expect(screen.getByTestId('shopping-empty-help-popover')).toHaveTextContent(/only what you do not have/);
  });
});

describe('what opening the recipe search fetches', () => {
  it('requests the two recipe files (and the ingredient table for the list itself), never the pairing data', async () => {
    const urls = [];
    const served = {
      '/data/cocktail_codex_v2.json': () => JSON.parse(readFileSync(resolve(root, 'public/data/cocktail_codex_v2.json'), 'utf8')),
      '/data/sauce_augment.json': () => JSON.parse(readFileSync(resolve(root, 'public/data/sauce_augment.json'), 'utf8')),
      '/proDataset/ingredients.json': () => JSON.parse(readFileSync(resolve(root, 'public/proDataset/ingredients.json'), 'utf8')),
    };
    global.fetch = vi.fn((url) => {
      urls.push(String(url));
      const get = served[String(url)];
      return Promise.resolve(get ? { ok: true, json: async () => get() } : { ok: false, status: 404, json: async () => ({}) });
    });
    resetShoppingIngredients();
    resetRecipeSources();
    render(<ShoppingList shopping={emptyShopping()} onChange={() => {}} onClose={() => {}} own={null} recipeStock={stockOf(STOCK)} />);
    await waitFor(() => expect(urls).toContain('/proDataset/ingredients.json'));
    expect(urls.filter((u) => u !== '/proDataset/ingredients.json')).toEqual([]); // closed: nothing else
    fireEvent.click(screen.getByTestId('shopping-recipe-toggle'));
    await waitFor(() => expect(urls).toContain('/data/sauce_augment.json'));
    fireEvent.change(await screen.findByTestId('shopping-recipe-search'), { target: { value: 'negroni' } });
    expect(await screen.findByTestId('shopping-recipe-result-cocktail:negroni')).toBeTruthy();
    expect([...new Set(urls)].sort()).toEqual(['/data/cocktail_codex_v2.json', '/data/sauce_augment.json', '/proDataset/ingredients.json']);
    expect(urls.some((u) => /pairings|gnn|\.onnx|\.bin/i.test(u))).toBe(false);
  });
});
