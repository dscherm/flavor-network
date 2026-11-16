// @vitest-environment jsdom
// SHOP-7: in "Add from a recipe" a dish's flavourings (the Cookbook's split of mains and flavourings) start UNTICKED
// under their own heading; cocktails and sauces are unchanged. Real recipes and the real ingredient table.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ShoppingList from '../ShoppingList.jsx';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { saveUnitSystem } from '../../data/shoppingUnits.js';
import { resetShoppingIngredients } from '../../data/shoppingIngredients.js';
import { resetRecipeSources } from '../../data/shoppingRecipes.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const root = process.cwd();
const codex = readCuratedCodex();
const sauces = JSON.parse(readFileSync(resolve(root, 'public/data/sauce_augment.json'), 'utf8')).sauces;
const table = JSON.parse(readFileSync(resolve(root, 'public/proDataset/ingredients.json'), 'utf8'));
const categories = new Map(Object.entries(table).map(([k, v]) => [k, v.category]).filter(([, c]) => typeof c === 'string'));
const DATA = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const loadRecipes = () => Promise.resolve(DATA);
const INGREDIENTS = { names: new Set(categories.keys()), vocab: [], categories };

let latest;
function Harness({ stock }) {
  const [state, setState] = useState(emptyShopping());
  latest = state;
  return (
    <ShoppingList shopping={state} onClose={() => {}} loadIngredients={() => Promise.resolve(INGREDIENTS)} own={null}
      loadRecipes={loadRecipes} recipeStock={() => stock}
      onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })} />
  );
}
const EMPTY = { kitchen: [], pantry: [], bar: [], spiceRack: false };

async function open(name, id) {
  if (!screen.queryByTestId('shopping-recipe-search')) fireEvent.click(screen.getByTestId('shopping-recipe-toggle'));
  fireEvent.change(await screen.findByTestId('shopping-recipe-search'), { target: { value: name } });
  fireEvent.click(await screen.findByTestId(`shopping-recipe-result-${id}`));
  return screen.findByTestId('shopping-recipe-preview');
}
const keysIn = (pv, listId) => [...within(within(pv).getByTestId(listId)).getAllByRole('checkbox')].map((c) => ({ key: c.dataset.testid.replace('shopping-preview-line-', ''), checked: c.checked }));

beforeEach(() => { localStorage.clear(); saveUnitSystem('metric'); resetShoppingIngredients(); resetRecipeSources(); });
afterEach(cleanup);

describe('a dish in Add from a recipe', () => {
  it('shows the flavourings unticked under their own heading, mains ticked, and adding with defaults leaves them off', async () => {
    render(<Harness stock={EMPTY} />);
    const pv = await open('bolognese', 'dish:beef-bolognese');
    const need = keysIn(pv, 'shopping-preview-need');
    const flav = keysIn(pv, 'shopping-preview-flavourings');
    expect(need.map((l) => l.key)).toEqual(expect.arrayContaining(['beef', 'tomato', 'onion']));
    expect(need.every((l) => l.checked)).toBe(true);
    expect(flav.map((l) => l.key)).toEqual(expect.arrayContaining(['garlic', 'red wine']));
    expect(flav.every((l) => !l.checked)).toBe(true);
    expect(within(pv).getByRole('heading', { name: /Flavourings/ })).toBeTruthy();
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    const added = latest.list.items.map((i) => i.key);
    expect(added).toEqual(expect.arrayContaining(need.map((l) => l.key)));
    expect(added).not.toContain('garlic');
    expect(added).not.toContain('red wine');
  });

  it('ticking a flavouring adds it', async () => {
    render(<Harness stock={EMPTY} />);
    const pv = await open('bolognese', 'dish:beef-bolognese');
    const before = within(pv).getByTestId('shopping-preview-add').textContent;
    fireEvent.click(within(pv).getByTestId('shopping-preview-line-garlic'));
    expect(within(pv).getByTestId('shopping-preview-add').textContent).not.toBe(before);
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
    expect(latest.list.items.map((i) => i.key)).toContain('garlic');
    expect(latest.list.items.map((i) => i.key)).not.toContain('red wine');
  });

  it('with the mains in the kitchen it says so and still offers the flavourings, unticked', async () => {
    render(<Harness stock={{ ...EMPTY, kitchen: ['beef', 'tomato', 'onion', 'carrot', 'celery', 'pasta'] }} />);
    const pv = await open('bolognese', 'dish:beef-bolognese');
    expect(within(pv).getByTestId('shopping-preview-mains-have')).toBeTruthy();
    expect(within(pv).queryByTestId('shopping-preview-need')).toBeNull();
    expect(keysIn(pv, 'shopping-preview-flavourings').every((l) => !l.checked)).toBe(true);
    expect(within(pv).getByTestId('shopping-preview-add').textContent).toBe('Nothing ticked');
  });
});

describe('a cocktail and a sauce in Add from a recipe are unchanged', () => {
  it('a cocktail has no flavourings group and every line it lacks is ticked', async () => {
    render(<Harness stock={EMPTY} />);
    const pv = await open('negroni', 'cocktail:negroni');
    expect(within(pv).queryByTestId('shopping-preview-flavourings')).toBeNull();
    expect(keysIn(pv, 'shopping-preview-need').every((l) => l.checked)).toBe(true);
  });

  it('a sauce has no flavourings group and every line it lacks is ticked', async () => {
    render(<Harness stock={EMPTY} />);
    const pv = await open('hollandaise', 'sauce:hollandaise');
    expect(within(pv).queryByTestId('shopping-preview-flavourings')).toBeNull();
    expect(keysIn(pv, 'shopping-preview-need').every((l) => l.checked)).toBe(true);
  });
});
