// @vitest-environment jsdom
// LOOK-7 contract tests (blind): the drink card. Written from plan.md (LOOK-7 AC-1..AC-7) and the approved
// brief .schermness/design/LOOK-7.md (owner ruling at the top; sections 3.2, 9). No file under src/ was read
// except existing tests under src/components/__tests__ (CocktailLabV2.shopping, LabNodeCard, DishStory), whose
// render setups are reused here.
//
// How the card is rendered: the real Cocktail Lab (CocktailLabV2) over the curated codex, with the heavy 3D
// pieces mocked exactly as CocktailLabV2.shopping.test.jsx does; a drink is opened by clicking its name in the
// menu. The bar is set through localStorage (MY_BAR_KEY), as the existing tests do:
//   empty bar  -> []                                  (every Negroni ingredient missing)
//   owned      -> ['gin', 'campari', 'sweet vermouth'] (nothing missing)
// Photos come from the real public/data/dish_stories.json (fetch is routed by URL): Negroni has a photo,
// "20th Century" has a story but no photo, "Vermouth Cocktail" has no story at all.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { hasBorder, hasAnyBackground, hasRoundedFull, primaries, expectOnePrimary, expectNoOtherAccentFill } from './helpers.js';

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ingredients = read('public/proDataset/ingredients.json');
const STORIES = read('public/data/dish_stories.json');

vi.mock('../../../src/components/NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../../../src/components/ClusterJoystick.jsx', () => ({ default: () => null }));
vi.mock('../../../src/components/ShapeLegend.jsx', () => ({ default: () => null }));
vi.mock('../../../src/three/AxisLabels.js', () => ({ createClusterLabels: () => ({ add: () => {} }), createGlowSprite: () => ({}) }));
vi.mock('../../../src/data/cocktailCodexV2.js', () => ({
  loadCodexV2: (raw) => raw,
  curateCodexRaw: (raw) => raw,
  placeCocktailInFamily: () => ({ x: 0, y: 0, z: 0 }),
  topSimilar: () => [],
  crossFamilySimilar: () => [],
  cocktailSimilarity: () => 0,
}));
vi.mock('../../../src/data/ingredientRoles.js', async (orig) => ({
  ...(await orig()),
  getCocktailRoles: vi.fn(async () => JSON.parse((await import('node:fs')).default.readFileSync(`${process.cwd()}/public/data/cocktail_roles.json`, 'utf8')).byIngredient),
}));
vi.mock('../../../src/components/InventCocktail.jsx', () => ({ default: () => null }));

import CocktailLabV2 from '../../../src/components/CocktailLabV2.jsx';
import LabNodeCard from '../../../src/components/LabNodeCard.jsx';
import { readCuratedCodex } from '../../../scripts/lib/curatedCodex.mjs';
import { commitList, emptyShopping } from '../../../src/data/shoppingStore.js';
import { MY_BAR_KEY } from '../../../src/data/myBar.js';
import { _resetDishStories } from '../../../src/data/dishStories.js';

const codex = readCuratedCodex();
const keep = new Set(['Negroni', '20th Century', 'Vermouth Cocktail']);
const picked = codex.cocktails.filter((c) => keep.has(c.name));
const GRAPH = {
  ...codex,
  cocktails: picked,
  byFamily: new Map(codex.families.map((f) => [f.id, picked.filter((c) => c.family_id === f.id)])),
  byCanonical: new Map(picked.map((c) => [c.canonical, c])),
};
const fullData = { graph: { nodes: new Map(Object.entries(ingredients)), edges: [] } };

function Lab() {
  const [state, setState] = useState(emptyShopping());
  const up = {
    profile: { cocktails: [], shopping: state },
    saveInvention: vi.fn(), deleteInvention: vi.fn(),
    updateShopping: (change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); }),
  };
  return <CocktailLabV2 fullData={fullData} userProfile={up} auth={{ user: null }} onOpenShopping={vi.fn()} />;
}

const routeFetch = (stories = STORIES) => vi.fn(async (url) => {
  const u = String(url);
  if (/dish_stories\.json/.test(u)) return { ok: true, json: async () => stories };
  return { ok: true, json: async () => GRAPH };
});

beforeEach(() => {
  localStorage.clear();
  _resetDishStories(null);
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  global.fetch = routeFetch();
});
afterEach(() => { cleanup(); _resetDishStories(null); });

async function openDrink(name) {
  render(<Lab />);
  fireEvent.click((await screen.findAllByText(name))[0]);
  return screen.findByTestId('lab-node-card');
}

describe('LOOK-7 drink card: one filled primary', () => {
  // Covers: AC-1
  it('the Negroni card with an empty bar has exactly one primary: a button filled with the accent (Add to shopping list)', async () => {
    localStorage.setItem(MY_BAR_KEY, JSON.stringify([]));
    const card = await openDrink('Negroni');
    await within(card).findByTestId('what-do-i-need');
    const p = expectOnePrimary(expect, card, 'Negroni card, empty bar');
    // Brief D1: the one filled button on the drink card is "Add to shopping list".
    expect(p.textContent).toMatch(/Add to shopping list/i);
  });

  // Covers: AC-2
  it('a drink card whose ingredients are all owned has no primary', async () => {
    localStorage.setItem(MY_BAR_KEY, JSON.stringify(['gin', 'campari', 'sweet vermouth']));
    const card = await openDrink('Negroni');
    await within(card).findByTestId('what-do-i-need');
    expect(primaries(card)).toHaveLength(0);
  });

  // Covers: AC-3
  it('nothing on the Negroni card other than the primary has the accent as its background', async () => {
    localStorage.setItem(MY_BAR_KEY, JSON.stringify([]));
    const card = await openDrink('Negroni');
    await within(card).findByTestId('what-do-i-need');
    expectNoOtherAccentFill(expect, card, 'Negroni card, empty bar');
  });

  // Covers: AC-3
  it('opening the Flavor profile on the card (current state) still fills nothing else with the accent', async () => {
    localStorage.setItem(MY_BAR_KEY, JSON.stringify([]));
    const card = await openDrink('Negroni');
    await within(card).findByTestId('what-do-i-need');
    const toggle = within(card).queryByRole('button', { name: /flavor profile/i });
    if (toggle) fireEvent.click(toggle);
    expectNoOtherAccentFill(expect, card, 'Negroni card, flavor profile open');
    expect(primaries(card).length).toBeLessThanOrEqual(1);
  });
});

describe('LOOK-7 drink card: Cocktails like this is a plain list', () => {
  // Covers: AC-4
  it('lab-node-card-like-this is a ul; its buttons have no border and no background; nothing in it is rounded-full', () => {
    render(
      <LabNodeCard
        kind="cocktail"
        name="Negroni"
        clusterName="Aromatic Stirred"
        clusterColor="#fb7185"
        clusterTag="Aperitivo"
        details={[{ label: 'Glass', value: 'Rocks' }]}
        ingredients={['Gin', 'Campari', 'Sweet Vermouth']}
        prep="Stir with ice, strain over a large cube, garnish with orange."
        likeThis={[
          { name: 'Boulevardier', similarity: 0.9, color: '#fb7185' },
          { name: 'Americano', similarity: 0.8, color: '#fb7185' },
          { name: 'Old Pal', similarity: 0.7, color: '#fb7185' },
        ]}
        bridges={[{ name: 'Martinez', family_name: 'Old-School', color: '#06b6d4' }]}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const list = screen.getByTestId('lab-node-card-like-this');
    expect(list.tagName).toBe('UL');
    const buttons = within(list).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const b of buttons) {
      expect(hasBorder(b), `like-this button "${b.textContent}" has a border (style="${b.getAttribute('style')}", class="${b.getAttribute('class')}")`).toBe(false);
      expect(hasAnyBackground(b), `like-this button "${b.textContent}" has a background (style="${b.getAttribute('style')}", class="${b.getAttribute('class')}")`).toBe(false);
    }
    const pills = [list, ...list.querySelectorAll('*')].filter(hasRoundedFull);
    expect(pills.map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
    // Still works: a name still opens that drink (existing behaviour, testid kept).
    expect(screen.getByTestId('labcard-chip-boulevardier')).toBeTruthy();
  });
});

describe('LOOK-7 drink card: a chalk drawing of the drink when there is no photo', () => {
  const drawingIn = (card) => card.querySelector('[data-testid="drink-drawing"]');
  const isSvgDrawing = (el) => !!el && (el.tagName.toLowerCase() === 'svg' || !!el.querySelector('svg'));
  const gradientPlaceholders = (card) => [card, ...card.querySelectorAll('*')]
    .filter((el) => /gradient/i.test(`${el.style.background} ${el.style.backgroundImage}`));

  // Covers: AC-6
  it('a drink with a story but no photo shows an svg chalk drawing, no empty frame and no gradient placeholder', async () => {
    const card = await openDrink('20th Century');
    await waitFor(() => expect(isSvgDrawing(drawingIn(card))).toBe(true));
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).queryByTestId('dish-story-photo')).toBeNull();
    expect(gradientPlaceholders(card).map((el) => el.getAttribute('style'))).toEqual([]);
  });

  // Covers: AC-6
  it('a drink with no story at all still shows the svg chalk drawing', async () => {
    const card = await openDrink('Vermouth Cocktail');
    await waitFor(() => expect(isSvgDrawing(drawingIn(card))).toBe(true));
    expect(card.querySelector('img')).toBeNull();
    expect(gradientPlaceholders(card).map((el) => el.getAttribute('style'))).toEqual([]);
  });

  // Covers: AC-6
  it('a drink whose photo fails to load shows the svg chalk drawing in the drink colour, and no empty frame', async () => {
    const card = await openDrink('Negroni');
    const img = await waitFor(() => {
      const el = card.querySelector('img');
      expect(el).toBeTruthy();
      return el;
    });
    fireEvent.error(img);
    await waitFor(() => expect(isSvgDrawing(drawingIn(card))).toBe(true));
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).queryByTestId('dish-story-photo')).toBeNull();
    expect(gradientPlaceholders(card).map((el) => el.getAttribute('style'))).toEqual([]);
    // Owner ruling: the glass is filled in the drink's colour (drinkColor). A Negroni (gin, campari,
    // sweet vermouth) is #c8102e by drinkColor (asserted in src/components/__tests__/drinkGlasses.test.jsx).
    expect(drawingIn(card).outerHTML).toMatch(/#c8102e|rgb\(\s*200,\s*16,\s*46\s*\)/i);
  });

  // Covers: AC-6
  it('a drink whose photo loads shows the photo and no drawing', async () => {
    const card = await openDrink('Negroni');
    const img = await waitFor(() => {
      const el = card.querySelector('img');
      expect(el).toBeTruthy();
      return el;
    });
    Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 533, configurable: true });
    fireEvent.load(img);
    await waitFor(() => expect(card.querySelector('img')).toBeTruthy());
    expect(drawingIn(card)).toBeNull();
  });
});
