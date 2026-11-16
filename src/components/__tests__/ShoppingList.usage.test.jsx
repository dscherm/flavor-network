// @vitest-environment jsdom
// SHOP-5: the three shopping list usage events, end to end through the real screens. Counts and labels only: no item
// text, ingredient name, recipe name or own-recipe id ever reaches the analytics double.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import { resolve } from 'node:path';
import ShoppingList from '../ShoppingList.jsx';
import AddToShoppingList from '../AddToShoppingList.jsx';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { addLine } from '../../data/shoppingList.js';
import { resetShoppingIngredients } from '../../data/shoppingIngredients.js';
import { resetRecipeSources } from '../../data/shoppingRecipes.js';
import { setConsent, __resetUsageForTests } from '../../data/usage.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';

const root = process.cwd();
const roles = JSON.parse(fs.readFileSync(`${root}/public/data/cocktail_roles.json`, 'utf8')).byIngredient;
const codex = readCuratedCodex();
const sauces = JSON.parse(fs.readFileSync(resolve(root, 'public/data/sauce_augment.json'), 'utf8')).sauces;
const DATA = { cocktails: codex.cocktails, families: codex.families, sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
const CATS = new Map([['buttermilk', 'dairy'], ['milk', 'dairy'], ['yogurt', 'dairy'], ['lemon', 'citrus'], ['bourbon', 'spirit'], ['rye', 'spirit'], ['scotch', 'spirit']]);
const INGREDIENTS = { names: new Set(CATS.keys()), vocab: [...CATS.keys()].sort(), categories: CATS };

// An ingredient and a recipe name that must never show up in an event.
const SECRET_ITEM = 'pickled ramps';
const SECRET_RECIPE = 'Grandma Secret Sour';
const OWN = {
  cocktails: [],
  sauces: [],
  recipes: [{ id: 'r1', name: SECRET_RECIPE, lines: [{ key: 'lentils', amount: '200 g' }, { key: 'garlic', amount: '3 cloves' }] }],
};

let latest;
let handle;
const flush = () => new Promise((r) => setTimeout(r, 0));
const events = () => handle.logEvent.mock.calls.map(([name, params]) => [name, params]);

function Harness({ initial = emptyShopping(), stock = () => ({ kitchen: [], pantry: [], bar: [] }) }) {
  const [state, setState] = useState(initial);
  latest = state;
  return (
    <ShoppingList
      shopping={state}
      onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })}
      onClose={() => {}}
      loadIngredients={() => Promise.resolve(INGREDIENTS)}
      loadRoles={() => Promise.resolve(roles)}
      loadRecipes={() => Promise.resolve(DATA)}
      own={OWN}
      recipeStock={stock}
    />
  );
}

const stateWith = (lines) => {
  let list = { items: [], recipes: [] };
  let n = 0;
  for (const l of lines) list = addLine(list, l, { now: 1000 + n, newId: () => `i${n++}`, names: INGREDIENTS.names }).list;
  return { list, removed: {} };
};
const openAlt = async (key) => {
  await screen.findAllByTestId(/^shopping-aisle-/);
  fireEvent.click(await screen.findByTestId(`shopping-alt-${key}`));
  return screen.findByTestId('store-alt-sheet');
};

beforeEach(() => {
  localStorage.clear();
  resetShoppingIngredients();
  resetRecipeSources();
  handle = { logEvent: vi.fn(), setEnabled: vi.fn() };
  __resetUsageForTests({ loader: async () => handle, isLocal: () => false });
  setConsent('yes');
});
afterEach(cleanup);

describe('shop_opened', () => {
  it('is sent once per opening, not again when the list changes', async () => {
    render(<Harness initial={stateWith([{ key: 'milk', label: 'milk' }])} />);
    await flush();
    fireEvent.click(screen.getByRole('checkbox', { name: 'milk' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'milk' }));
    await flush();
    expect(events()).toEqual([['shop_opened', {}]]);
  });
  it('is not sent, and analytics is never loaded, without a Yes', async () => {
    window.localStorage.clear();
    const loader = vi.fn(async () => handle);
    __resetUsageForTests({ loader, isLocal: () => false });
    render(<Harness />);
    await flush();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe('shop_alternative_used', () => {
  it('replacing a row sends the source and "replaced", and no ingredient', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk', amount: '500 ml' }])} />);
    fireEvent.click(within(await openAlt('buttermilk')).getByTestId('store-alt-pick-milk'));
    await screen.findByTestId('shopping-row-milk');
    await flush();
    expect(events()).toEqual([['shop_opened', {}], ['shop_alternative_used', { alt_source: 'food', outcome: 'replaced' }]]);
    expect(JSON.stringify(events())).not.toMatch(/buttermilk|milk|lemon/);
  });
  it('a bar alternative is reported as bar', async () => {
    render(<Harness initial={stateWith([{ key: 'bourbon', label: 'bourbon' }])} />);
    const sheet = await openAlt('bourbon');
    fireEvent.click(await within(sheet).findByTestId('store-alt-pick-scotch'));
    await flush();
    expect(events().pop()).toEqual(['shop_alternative_used', { alt_source: 'bar', outcome: 'replaced' }]);
  });
  it('"Use what I have" sends used_own; opening the sheet and closing it sends nothing', async () => {
    render(<Harness initial={stateWith([{ key: 'buttermilk', label: 'buttermilk' }])} stock={() => ({ kitchen: ['yogurt'], pantry: [], bar: [] })} />);
    const sheet = await openAlt('buttermilk');
    fireEvent.click(within(sheet).getByTestId('store-alt-close'));
    await flush();
    expect(events()).toEqual([['shop_opened', {}]]);
    fireEvent.click(within(await openAlt('buttermilk')).getByTestId('store-alt-use-have-yogurt'));
    await flush();
    expect(events().pop()).toEqual(['shop_alternative_used', { alt_source: 'food', outcome: 'used_own' }]);
  });
});

describe('shop_recipe_added from the list', () => {
  const addFrom = async (name, id) => {
    if (!screen.queryByTestId('shopping-recipe-search')) fireEvent.click(screen.getByTestId('shopping-recipe-toggle'));
    fireEvent.change(await screen.findByTestId('shopping-recipe-search'), { target: { value: name } });
    fireEvent.click(await screen.findByTestId(`shopping-recipe-result-${id}`));
    const pv = await screen.findByTestId('shopping-recipe-preview');
    fireEvent.click(within(pv).getByTestId('shopping-preview-add'));
  };

  it('a built-in dish: kind, built_in, its slug, where=list and the counts', async () => {
    render(<Harness />);
    await addFrom('bolognese', 'dish:beef-bolognese');
    await waitFor(() => expect(events().some(([n]) => n === 'shop_recipe_added')).toBe(true));
    const [, params] = events().find(([n]) => n === 'shop_recipe_added');
    expect(params).toMatchObject({ kind: 'dish', origin: 'built_in', slug: 'beef-bolognese', where: 'list', merged: 0 });
    expect(params.added).toBeGreaterThan(3);
    expect(Object.keys(params).sort()).toEqual(['added', 'kind', 'merged', 'origin', 'slug', 'where']);
  });

  it('adding a second recipe that shares an ingredient reports the merge', async () => {
    render(<Harness />);
    await addFrom('bolognese', 'dish:beef-bolognese');
    await addFrom('carbonara', 'dish:spaghetti-carbonara');
    await waitFor(() => expect(events().filter(([n]) => n === 'shop_recipe_added')).toHaveLength(2));
    const second = events().filter(([n]) => n === 'shop_recipe_added')[1][1];
    expect(second.merged).toBeGreaterThanOrEqual(1);
  });

  it("the cook's own recipe: origin own, no slug, and neither its name nor its ingredients are sent", async () => {
    render(<Harness />);
    await addFrom('secret', 'own:recipe:r1');
    await waitFor(() => expect(events().some(([n]) => n === 'shop_recipe_added')).toBe(true));
    const [, params] = events().find(([n]) => n === 'shop_recipe_added');
    expect(params).toEqual({ kind: 'dish', origin: 'own', where: 'list', added: 2, merged: 0 });
    expect(JSON.stringify(events())).not.toMatch(/Secret|Grandma|lentils|garlic|r1/);
  });

  it('nothing is sent when the add asks first and the cook cancels', async () => {
    render(<Harness />);
    await addFrom('bolognese', 'dish:beef-bolognese');
    await waitFor(() => expect(events().filter(([n]) => n === 'shop_recipe_added')).toHaveLength(1));
    if (!screen.queryByTestId('shopping-recipe-search')) fireEvent.click(screen.getByTestId('shopping-recipe-toggle'));
    fireEvent.change(await screen.findByTestId('shopping-recipe-search'), { target: { value: 'bolognese' } });
    fireEvent.click(await screen.findByTestId('shopping-recipe-result-dish:beef-bolognese'));
    fireEvent.click(within(await screen.findByTestId('shopping-recipe-preview')).getByTestId('shopping-preview-add'));
    fireEvent.click(await screen.findByTestId('shopping-preview-ask-cancel'));
    await flush();
    expect(events().filter(([n]) => n === 'shop_recipe_added')).toHaveLength(1);
  });
});

describe('shop_recipe_added from a What do I need? panel', () => {
  function Panel({ recipe, missing }) {
    const [state, setState] = useState(emptyShopping());
    latest = state;
    return (
      <AddToShoppingList
        recipe={recipe}
        missing={missing}
        list={state.list}
        onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })}
      />
    );
  }

  it('a built-in recipe: where=panel, with its slug', async () => {
    render(<Panel recipe={{ kind: 'cocktail', slug: 'negroni', name: 'Negroni' }} missing={[{ name: 'campari', amount: '30 ml' }, { name: 'gin', amount: '30 ml' }]} />);
    fireEvent.click(screen.getByTestId('what-do-i-need-add-shopping'));
    await flush();
    expect(events()).toEqual([['shop_recipe_added', { kind: 'cocktail', origin: 'built_in', slug: 'negroni', where: 'panel', added: 2, merged: 0 }]]);
  });

  it("an own recipe never sends its id or name, whatever the caller holds", async () => {
    render(<Panel recipe={{ kind: 'sauce', id: 'own:sauce:abc123', name: SECRET_RECIPE, slug: 'my-secret' }} missing={[{ name: SECRET_ITEM, amount: '2 jars' }]} />);
    fireEvent.click(screen.getByTestId('what-do-i-need-add-shopping'));
    await flush();
    expect(events()).toEqual([['shop_recipe_added', { kind: 'sauce', origin: 'own', where: 'panel', added: 1, merged: 0 }]]);
    expect(JSON.stringify(events())).not.toMatch(/ramps|Grandma|Secret|abc123|my-secret/);
  });

  it('adding again asks first; Cancel sends nothing, Add it again sends the merge', async () => {
    render(<Panel recipe={{ kind: 'cocktail', slug: 'negroni', name: 'Negroni' }} missing={[{ name: 'gin', amount: '30 ml' }]} />);
    fireEvent.click(screen.getByTestId('what-do-i-need-add-shopping'));
    await flush();
    fireEvent.click(screen.getByTestId('what-do-i-need-add-shopping'));
    fireEvent.click(await screen.findByTestId('what-do-i-need-add-cancel'));
    await flush();
    expect(events()).toHaveLength(1);
    fireEvent.click(screen.getByTestId('what-do-i-need-add-shopping'));
    fireEvent.click(await screen.findByTestId('what-do-i-need-add-again'));
    await flush();
    expect(events()).toHaveLength(2);
    expect(events()[1][1]).toMatchObject({ where: 'panel', added: 0, merged: 1 });
  });
});
