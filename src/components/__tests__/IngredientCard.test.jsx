// @vitest-environment jsdom
// BUILDER-4: tap an ingredient name to see its card. One provider owns the overlay; surfaces only render a name.
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { IngredientCardProvider, IngredientBuilderScope, IngredientName } from '../IngredientCardProvider.jsx';
import InventList from '../InventList.jsx';
import InventSuggestions from '../InventSuggestions.jsx';
import IngredientProfileCard from '../IngredientProfileCard.jsx';
import LabNodeCard from '../LabNodeCard.jsx';
import WhatDoINeed from '../WhatDoINeed.jsx';
import RecipeFlavorProfilesCard from '../RecipeFlavorProfilesCard.jsx';
import CookbookLab from '../CookbookLab.jsx';
import ShoppingList from '../ShoppingList.jsx';
import { commitList, emptyShopping } from '../../data/shoppingStore.js';
import { addLine } from '../../data/shoppingList.js';
import { resetShoppingIngredients } from '../../data/shoppingIngredients.js';
import { needsFromKitchen } from '../../data/whatDoINeed.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../MultiAxisRadarStack.jsx', () => ({ default: () => null }));

const NAMES = ['gin', 'garlic', 'tomato', 'lemon', 'mint', 'campari', 'milk', 'cheddar'];
const makeData = (names = NAMES) => ({
  graph: {
    nodes: new Map(names.map((n) => [n, { name: n, taste: 'sweet' }])),
    edges: [
      { source: 'gin', target: 'lemon', strength: 0.9 },
      { source: 'gin', target: 'mint', strength: 0.7 },
      { source: 'garlic', target: 'tomato', strength: 0.8 },
    ],
    ingredientList: names,
  },
});

afterEach(cleanup);

// The card is a lazy chunk: the first open suspends for a tick. Warm it once so the tests below can assert synchronously.
beforeAll(async () => {
  render(<IngredientCardProvider data={makeData()}><IngredientName name="gin" /></IngredientCardProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
  await screen.findByRole('dialog', { name: 'gin card' });
  cleanup();
});

const dialogFor = (name) => screen.getByRole('dialog', { name: `${name} card` });
const closed = () => expect(screen.queryByTestId('ingredient-card-overlay')).toBeNull();

describe('IngredientCard: the overlay and how it closes', () => {
  const lines = [{ key: 'gin', amount: '2 oz', have: true }, { key: 'lemon', have: true }];
  const setup = (extra = {}) => render(
    <IngredientCardProvider data={makeData()} {...extra}>
      <InventList lines={lines} testidPrefix="l" onRemove={() => {}} onAdd={() => {}} />
    </IngredientCardProvider>,
  );

  it('opens the right ingredient from a builder line, labelled "About gin"', () => {
    setup();
    const link = screen.getByRole('button', { name: 'About gin' });
    fireEvent.click(link);
    expect(dialogFor('gin')).toBeTruthy();
    expect(within(dialogFor('gin')).getByTestId('ingredient-card-pairs')).toHaveTextContent('lemon');
    // a different line opens a different card
    fireEvent.click(screen.getByTestId('ingredient-card-back'));
    fireEvent.click(screen.getByRole('button', { name: 'About lemon' }));
    expect(dialogFor('lemon')).toBeTruthy();
  });

  it.each([
    ['the Back button', () => fireEvent.click(screen.getByTestId('ingredient-card-back'))],
    ['Escape', () => fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' })],
    ['a tap outside the card', () => fireEvent.click(screen.getByTestId('ingredient-card-overlay'))],
  ])('closes with %s and hands focus back to the name that opened it', (_label, close) => {
    setup();
    const link = screen.getByRole('button', { name: 'About gin' });
    link.focus();
    fireEvent.click(link);
    expect(dialogFor('gin')).toBeTruthy();
    expect(dialogFor('gin').contains(document.activeElement)).toBe(true);
    close();
    closed();
    expect(document.activeElement).toBe(link);
  });

  it('a tap inside the card does not close it', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    fireEvent.click(dialogFor('gin'));
    expect(dialogFor('gin')).toBeTruthy();
  });

  it('tab stays inside the card', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    const dialog = dialogFor('gin');
    const focusables = dialog.querySelectorAll('button');
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(document.activeElement, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
    fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });

  it('tapping a partner on the card shows that ingredient, with what the two share', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    fireEvent.click(within(dialogFor('gin')).getByRole('button', { name: 'About lemon' }));
    expect(dialogFor('lemon')).toBeTruthy();
    expect(screen.getByTestId('ingredient-card-insight')).toHaveTextContent(/gin/);
  });

  it('"Open in Pairing Lab" closes the card and hands the ingredient to the app', () => {
    const onOpenPairingLab = vi.fn();
    setup({ onOpenPairingLab });
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    fireEvent.click(screen.getByTestId('ingredient-card-pairing-lab'));
    expect(onOpenPairingLab).toHaveBeenCalledWith('gin');
    closed();
  });

  it('without an onOpenPairingLab handler the button is absent', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    expect(screen.queryByTestId('ingredient-card-pairing-lab')).toBeNull();
  });
});

describe('IngredientCard: inside a builder', () => {
  const Builder = ({ onAdd, onReplace = vi.fn(), have = [] }) => (
    <IngredientCardProvider data={makeData()}>
      <IngredientBuilderScope onAdd={onAdd} has={(k) => have.includes(k)} addLabel="Add to this recipe">
        <InventSuggestions items={[{ key: 'lemon' }, { key: 'mint' }]} onAdd={() => {}} />
        <InventList lines={[{ key: 'campari', have: false }, { key: 'gin', have: true }]} testidPrefix="l" onRemove={() => {}} onAdd={() => {}}
          onReplace={onReplace} replacementsFor={() => [{ key: 'lemon' }]} />
      </IngredientBuilderScope>
    </IngredientCardProvider>
  );

  it('"Add to this recipe" adds the ingredient once and closes', () => {
    const onAdd = vi.fn();
    render(<Builder onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'About mint' }));
    expect(dialogFor('mint')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ingredient-card-add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('mint');
    closed();
  });

  it('tapping the chip itself still only adds (it does not open the card)', () => {
    const onAdd = vi.fn();
    const { container } = render(
      <IngredientCardProvider data={makeData()}>
        <InventSuggestions items={[{ key: 'mint' }]} onAdd={onAdd} />
      </IngredientCardProvider>,
    );
    fireEvent.click(container.querySelector('[data-testid="suggest-item"]'));
    expect(onAdd).toHaveBeenCalledWith('mint');
    closed();
  });

  it('an ingredient already in the recipe says so instead of offering Add', () => {
    const onAdd = vi.fn();
    render(<Builder onAdd={onAdd} have={['gin']} />);
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    expect(screen.queryByTestId('ingredient-card-add')).toBeNull();
    expect(screen.getByTestId('ingredient-card-have')).toHaveTextContent('Already in this recipe');
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('from a replacement it offers "Swap it in" and swaps the line', () => {
    const onReplace = vi.fn();
    const onAdd = vi.fn();
    render(<Builder onAdd={onAdd} onReplace={onReplace} />);
    fireEvent.click(screen.getByTestId('l-need-campari'));
    fireEvent.click(screen.getByTestId('l-replace-info'));
    expect(dialogFor('lemon')).toBeTruthy();
    expect(screen.queryByTestId('ingredient-card-add')).toBeNull();
    fireEvent.click(screen.getByTestId('ingredient-card-swap'));
    expect(onReplace).toHaveBeenCalledWith('campari', 'lemon');
    expect(onAdd).not.toHaveBeenCalled();
    closed();
  });

  it('outside a builder there is no Add button', () => {
    render(
      <IngredientCardProvider data={makeData()}>
        <IngredientName name="gin" />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    expect(screen.queryByTestId('ingredient-card-add')).toBeNull();
  });

  it('a deck card name opens the card; its Add commits the deck card', () => {
    const onCommit = vi.fn();
    render(
      <IngredientCardProvider data={makeData()}>
        <IngredientProfileCard name="mint" before={{}} delta={{}} mode="add" onCommit={onCommit} />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'About mint' }));
    fireEvent.click(screen.getByTestId('ingredient-card-add'));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('a deck card in swap mode offers "Swap it in for …"', () => {
    const onCommit = vi.fn();
    render(
      <IngredientCardProvider data={makeData()}>
        <IngredientProfileCard name="mint" before={{}} delta={{}} mode="replace" replacing="basil" onCommit={onCommit} />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'About mint' }));
    expect(screen.getByTestId('ingredient-card-swap')).toHaveTextContent('Swap it in for basil');
    fireEvent.click(screen.getByTestId('ingredient-card-swap'));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

describe('IngredientCard: names the app does and does not know', () => {
  it('an alias opens the canonical ingredient card', () => {
    render(
      <IngredientCardProvider data={makeData()}>
        <IngredientName name="tomatoe" />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'About tomatoe' }));
    expect(dialogFor('tomato')).toBeTruthy();
  });

  it('a free-text line the app does not know renders no link', () => {
    render(
      <IngredientCardProvider data={makeData()}>
        <InventList lines={[{ key: 'zzyzx glaze' }, { key: 'gin' }]} testidPrefix="l" onRemove={() => {}} onAdd={() => {}} />
      </IngredientCardProvider>,
    );
    expect(screen.queryByRole('button', { name: 'About zzyzx glaze' })).toBeNull();
    expect(screen.getByText('zzyzx glaze')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'About gin' })).toBeTruthy();
  });

  it('without a provider a name is plain text', () => {
    render(<IngredientName name="gin" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('gin')).toBeTruthy();
  });
});

describe('IngredientCard: while the dataset is still loading', () => {
  it('shows a loading state after the tap, then the card; the loader runs once', async () => {
    let resolve;
    const loadData = vi.fn(() => new Promise((r) => { resolve = r; }));
    render(
      <IngredientCardProvider data={null} loadData={loadData}>
        <IngredientName name="gin" />
      </IngredientCardProvider>,
    );
    expect(loadData).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    expect(screen.getByTestId('ingredient-card-loading')).toHaveTextContent(/loading/i);
    await waitFor(() => expect(loadData).toHaveBeenCalledTimes(1));
    await act(async () => { resolve(makeData()); });
    expect(await screen.findByRole('dialog', { name: 'gin card' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('ingredient-card-back'));
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    expect(loadData).toHaveBeenCalledTimes(1);
  });

  it('shows the card when the data prop arrives later (the app case: no loader needed)', () => {
    const { rerender } = render(
      <IngredientCardProvider data={null}>
        <IngredientName name="gin" />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'About gin' }));
    expect(screen.getByTestId('ingredient-card-loading')).toBeTruthy();
    rerender(
      <IngredientCardProvider data={makeData()}>
        <IngredientName name="gin" />
      </IngredientCardProvider>,
    );
    expect(dialogFor('gin')).toBeTruthy();
  });

  it('an ingredient loaded data does not contain says so plainly when a card is forced', async () => {
    const loadData = vi.fn(() => Promise.resolve(makeData(['gin'])));
    render(
      <IngredientCardProvider data={null} loadData={loadData}>
        <IngredientName name="saffron" />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'About saffron' }));
    expect(await screen.findByTestId('ingredient-card-unknown')).toHaveTextContent('There is no card for “saffron”');
  });

  it('the public shared recipe page is not wired to the card and loads nothing new', () => {
    const page = readFileSync('src/components/SharedRecipePage.jsx', 'utf8');
    const main = readFileSync('src/main.jsx', 'utf8');
    expect(page).not.toMatch(/IngredientCard|IngredientName|useIngredientCard/);
    expect(main).not.toMatch(/IngredientCard/);
    // the provider is mounted once, by the app, from data it already holds (no loader passed)
    const app = readFileSync('src/App.jsx', 'utf8');
    expect(app).toMatch(/<IngredientCardProvider data=\{data\} onOpenPairingLab=\{openPairingLabFor\}>/);
    expect(app).not.toMatch(/IngredientCardProvider[^>]*loadData/);
  });
});

describe('IngredientCard: the other surfaces', () => {
  it('cocktail card: ingredient lines and "pairs with" chips open the card; a name the app lacks stays text', () => {
    render(
      <IngredientCardProvider data={makeData()}>
        <LabNodeCard kind="cocktail" name="Negroni" ingredients={[{ name: 'Gin', measure: '1 oz' }, { name: 'Campari', measure: '1 oz' }, { name: 'Zzyzx', measure: '1 oz' }]}
          pairsWith={['lemon', 'Nonesuch']} onClose={() => {}} />
      </IngredientCardProvider>,
    );
    fireEvent.click(within(screen.getByTestId('lab-node-card-ingredients')).getByRole('button', { name: 'About Gin' }));
    expect(dialogFor('gin')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ingredient-card-back'));
    expect(within(screen.getByTestId('lab-node-card-ingredients')).queryByRole('button', { name: 'About Zzyzx' })).toBeNull();
    fireEvent.click(within(screen.getByTestId('lab-node-card-pairs-with')).getByRole('button', { name: 'About lemon' }));
    expect(dialogFor('lemon')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ingredient-card-back'));
    expect(within(screen.getByTestId('lab-node-card-pairs-with')).queryByRole('button', { name: 'About Nonesuch' })).toBeNull();
  });

  it('What do I need: a missing ingredient opens the card', () => {
    render(
      <IngredientCardProvider data={makeData()}>
        <WhatDoINeed title="Pomodoro" needs={needsFromKitchen(['garlic', 'tomato'], ['tomato'])} />
      </IngredientCardProvider>,
    );
    fireEvent.click(within(screen.getByTestId('what-do-i-need-missing')).getByRole('button', { name: 'About garlic' }));
    expect(dialogFor('garlic')).toBeTruthy();
  });

  it('Flavor Profiles "Driven by" names open the card', () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
    const nodes = new Map([['strawberry', { taste: 'sweet' }], ['cranberry', { taste: 'sour' }]]);
    render(
      <IngredientCardProvider data={{ graph: { nodes, edges: [] } }}>
        <RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry']} nodes={nodes} />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    const links = within(screen.getByTestId('axis-drivers')).getAllByRole('button');
    expect(links.length).toBeGreaterThan(0);
    const label = links[0].getAttribute('aria-label').replace('About ', '');
    fireEvent.click(links[0]);
    expect(dialogFor(label)).toBeTruthy();
  });

  it('Cookbook recipe card: an ingredient opens the card', () => {
    if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    const recipe = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
    const ctx = { graph: { nodes: new Map(recipe.ingredients.map((n) => [n, { name: n }])), edges: [] } };
    render(
      <IngredientCardProvider data={ctx}>
        <CookbookLab ctx={ctx} />
      </IngredientCardProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Beef Bolognese/i }));
    const first = recipe.ingredients[0];
    const list = screen.getByTestId('recipe-ingredients');
    fireEvent.click(within(list).getByRole('button', { name: `About ${first}` }));
    expect(screen.getByRole('dialog', { name: `${first} card` })).toBeTruthy();
  });
});

describe('IngredientCard: shopping list rows', () => {
  const CATS = new Map([['milk', 'dairy'], ['cheddar', 'dairy']]);
  const INGREDIENTS = { names: new Set(CATS.keys()), vocab: [...CATS.keys()], categories: CATS };
  let latest;
  function Harness() {
    let list = { items: [], recipes: [] };
    let n = 0;
    for (const l of [{ key: 'milk', label: 'milk', amount: '1 l' }, { key: 'zzyzx', label: 'zzyzx glaze' }]) {
      list = addLine(list, l, { now: 1000 + n, newId: () => `i${n++}`, names: INGREDIENTS.names }).list;
    }
    const [state, setState] = useState(() => ({ list, removed: {} }));
    latest = state;
    return (
      <IngredientCardProvider data={makeData()}>
        <ShoppingList shopping={state} loadIngredients={() => Promise.resolve(INGREDIENTS)} onClose={() => {}}
          onChange={(change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); })} />
      </IngredientCardProvider>
    );
  }

  it('the checkbox still ticks the row and opens no card; the name opens the card and does not tick', async () => {
    localStorage.clear();
    resetShoppingIngredients();
    render(<Harness />);
    await screen.findByTestId('shopping-row-milk');
    const box = screen.getByRole('checkbox', { name: /milk/ });
    fireEvent.click(box);
    expect(latest.list.items.find((i) => i.key === 'milk').checked).toBe(true);
    closed();
    const name = screen.getByTestId('shopping-name-milk');
    expect(name.getAttribute('aria-label')).toBe('About milk');
    fireEvent.click(name);
    expect(dialogFor('milk')).toBeTruthy();
    expect(latest.list.items.find((i) => i.key === 'milk').checked).toBe(true);
    fireEvent.click(screen.getByTestId('ingredient-card-back'));
    // an item the app has no card for is plain text and its row still ticks
    expect(screen.getByTestId('shopping-name-zzyzx').tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: /About zzyzx/ })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /zzyzx glaze/ }));
    expect(latest.list.items.find((i) => i.key === 'zzyzx').checked).toBe(true);
  });
});
