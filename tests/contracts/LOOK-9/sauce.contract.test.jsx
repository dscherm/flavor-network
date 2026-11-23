// @vitest-environment jsdom
// LOOK-9 contract tests (blind): the Sauce Lab (menu, My pantry, sauce card). Written from plan.md (LOOK-9 AC-1,
// AC-2, AC-3, AC-5, AC-7) and the approved brief .schermness/design/LOOK-9.md (sections 3.4-3.6, 5, 7 D3, 9).
// No file under src/ was read; render setups reused from src/components/__tests__/SauceLab.shopping.test.jsx,
// SauceLab.pantry.test.jsx, labIngredientSearch.test.jsx, InventThis.test.jsx and DishStory.test.jsx.
//
// The codex is mocked (as SauceLab.shopping does): Béchamel and Marinara in family 0, Hollandaise and Beurre Blanc in
// family 3. All are French except Marinara (Italian), so choosing the "Italian" cuisine chip leaves Marinara alone.
// Stories (fetch routed by URL to dish_stories.json): Béchamel has a photo, Hollandaise a story without a photo,
// Beurre Blanc and Marinara no story at all.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { useState } from 'react';
import {
  hasBorder, hasBoxShadow, hasBackgroundImage, minHeightPx, primaries,
  expectOnePrimary, expectNoOtherAccentFill, expectSelectedNotFilled,
} from './helpers.js';

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

vi.mock('../../../src/data/sauceCodex.js', () => ({
  loadSauceCodex: vi.fn().mockResolvedValue({
    nodes: new Map([
      ['Hollandaise', node('Hollandaise', 3, ['egg yolk', 'butter', 'lemon juice', 'salt'], { isRoot: true })],
      ['Beurre Blanc', node('Beurre Blanc', 3, ['cold butter', 'shallot', 'white wine'])],
      ['Béchamel', node('Béchamel', 0, ['butter', 'flour', 'milk', 'nutmeg'], { isRoot: true })],
      ['Marinara', node('Marinara', 0, ['tomato', 'garlic', 'basil', 'olive oil'], { cuisine: 'Italian' })],
    ]),
    edges: [],
    ingredientList: ['Béchamel', 'Hollandaise'],
    ingredientToSauces: new Map(),
    codex: { clusters: [{ id: 0, name: 'Béchamel', color: '#f5f0d6' }, { id: 3, name: 'Hollandaise', color: '#f3d44e' }] },
    ingredientMeta: [
      { name: 'butter', category: 'Fat' }, { name: 'egg yolk', category: 'Thickener' }, { name: 'flour', category: 'Thickener' },
      { name: 'lemon juice', category: 'Acid' }, { name: 'milk', category: 'Liquid' }, { name: 'nutmeg', category: 'Seasoning' },
      { name: 'shallot', category: 'Aromatic' }, { name: 'white wine', category: 'Liquid' }, { name: 'tomato', category: 'Vegetable' },
      { name: 'garlic', category: 'Aromatic' }, { name: 'basil', category: 'Herb' }, { name: 'olive oil', category: 'Fat' },
    ],
    pairings: [{ source: 'butter', target: 'egg yolk', strength: 0.9 }],
  }),
  computeSauceCodexPositions: vi.fn().mockReturnValue({}),
}));
vi.mock('../../../src/components/SaucePairings.jsx', () => ({ default: () => null }));

import SauceLab from '../../../src/components/SauceLab.jsx';
import SauceBrowse from '../../../src/components/SauceBrowse.jsx';
import { commitList, emptyShopping } from '../../../src/data/shoppingStore.js';
import { _resetDishStories } from '../../../src/data/dishStories.js';

const PHOTO = {
  src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Bechamel.jpg/500px-Bechamel.jpg',
  w: 500, h: 375,
  page: 'https://commons.wikimedia.org/wiki/File:Bechamel.jpg',
  artist: 'Jane Cook', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
};
const STORIES = {
  _meta: {},
  recipes: {},
  sauces: {
    'Béchamel': { title: 'Béchamel sauce', text: 'Béchamel is a French mother sauce.', url: 'https://en.wikipedia.org/wiki/B%C3%A9chamel_sauce', photo: PHOTO },
    Hollandaise: { title: 'Hollandaise sauce', text: 'Hollandaise is an emulsion of egg yolk and butter.', url: 'https://en.wikipedia.org/wiki/Hollandaise_sauce' },
  },
  cocktails: {},
  wines: {},
};

function Lab() {
  const [state, setState] = useState(emptyShopping());
  const up = {
    profile: { sauces: [], shopping: state },
    saveInvention: vi.fn(), deleteInvention: vi.fn(),
    updateShopping: (change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); }),
  };
  return <SauceLab userProfile={up} auth={{ user: null }} onOpenShopping={vi.fn()} onOpenRecipeLab={vi.fn()} />;
}

beforeEach(() => {
  localStorage.clear();
  _resetDishStories(null);
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  global.fetch = vi.fn(async (url) => (/dish_stories\.json/.test(String(url))
    ? { ok: true, json: async () => STORIES }
    : { ok: false, json: async () => ({}) }));
});
afterEach(() => { cleanup(); _resetDishStories(null); });

const rows = () => screen.queryAllByTestId('sauce-row');
const rowNames = () => rows().map((r) => r.textContent);
const filtersToggle = () => screen.queryByTestId('sauce-filters-toggle')
  || screen.getByRole('button', { name: /^\s*filters\b/i });
const cuisineChip = (name) => screen.queryByRole('button', { name: new RegExp(`^\\s*${name}\\b`, 'i') });

async function openMenu() {
  const utils = render(<Lab />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return utils;
}
// The family headers carry the same names as two sauces (Béchamel, Hollandaise), so a sauce is opened from its row.
async function openSauce(name) {
  render(<Lab />);
  const row = await waitFor(() => {
    const r = rows().find((el) => el.textContent.trim().startsWith(name));
    expect(r, `a sauce-row for ${name}`).toBeTruthy();
    return r;
  });
  fireEvent.click(row.tagName === 'BUTTON' ? row : (row.querySelector('button') || row));
  return screen.findByTestId('lab-node-card');
}

describe('LOOK-9 Sauce menu', () => {
  // Covers: AC-1
  it('the Sauce menu has exactly one primary: a button filled with the accent (Invent a sauce)', async () => {
    const { container } = await openMenu();
    const p = expectOnePrimary(expect, container, 'Sauce menu');
    expect(p.textContent).toMatch(/Invent a sauce/i);
  });

  // Covers: AC-2
  it('with a cuisine selected: the chip says so (aria-pressed) and is not filled; nothing but the primary has an accent background', async () => {
    const { container } = await openMenu();
    fireEvent.click(filtersToggle());
    const chip = await waitFor(() => { const c = cuisineChip('Italian'); expect(c).toBeTruthy(); return c; });
    fireEvent.click(chip);
    const selected = cuisineChip('Italian') || [...container.querySelectorAll('[aria-pressed="true"]')].find((el) => /Italian/.test(el.textContent));
    expect(selected, 'the Italian chip is still on screen after choosing it').toBeTruthy();
    expectSelectedNotFilled(expect, selected, 'Italian cuisine chip');
    expectNoOtherAccentFill(expect, container, 'Sauce menu, Italian selected');
    expect(primaries(container).length).toBeLessThanOrEqual(1);
  });

  // Covers: AC-7
  it('no cuisine chip is visible until Filters is pressed (aria-expanded false then true); choosing a chip still filters', async () => {
    await openMenu();
    expect(cuisineChip('Italian'), 'a cuisine chip is visible before Filters is pressed').toBeNull();
    expect(cuisineChip('French'), 'a cuisine chip is visible before Filters is pressed').toBeNull();
    const toggle = filtersToggle();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(filtersToggle()).toHaveAttribute('aria-expanded', 'true');
    expect(rowNames().some((t) => /Béchamel/.test(t))).toBe(true);
    fireEvent.click(await waitFor(() => { const c = cuisineChip('Italian'); expect(c).toBeTruthy(); return c; }));
    await waitFor(() => {
      const names = rowNames();
      expect(names.some((t) => /Marinara/.test(t))).toBe(true);
      expect(names.some((t) => /Béchamel|Hollandaise|Beurre Blanc/.test(t))).toBe(false);
    });
  });

  // Covers: AC-3
  it('every sauce-row in the real Sauce Lab has no border, no box-shadow, no background image and min height >= 44', async () => {
    await openMenu();
    expect(rows().length).toBe(4);
    for (const row of rows()) {
      const tag = `row "${row.textContent}" (style="${row.getAttribute('style')}", class="${row.getAttribute('class')}")`;
      expect(hasBorder(row), `${tag} has a border`).toBe(false);
      expect(hasBoxShadow(row), `${tag} has a box-shadow`).toBe(false);
      expect(hasBackgroundImage(row), `${tag} has a background image`).toBe(false);
      const h = minHeightPx(row);
      expect(h, `${tag} sets no min height`).not.toBeNull();
      expect(h, `${tag} min height`).toBeGreaterThanOrEqual(44);
    }
  });

  // Covers: AC-3
  it('SauceBrowse rows, the selected one included, meet the same rule', () => {
    const sauce = (name, ingredients, extra = {}) => ({ name, family_id: 0, family: 'Tomato', cuisine: 'Italian', ingredients, ...extra });
    const marinara = sauce('Marinara', ['tomato', 'garlic', 'basil'], { isRoot: true });
    const CODEX = {
      codex: { clusters: [{ id: 0, name: 'Tomato', color: '#e05050' }] },
      graph: { nodes: new Map([['Marinara', marinara], ['Arrabbiata', sauce('Arrabbiata', ['tomato', 'garlic', 'chili'])]]) },
    };
    for (const selectedSauce of [marinara, 'Marinara']) {
      const { unmount } = render(
        <SauceBrowse codexData={CODEX} selectedSauce={selectedSauce} onSelectSauce={vi.fn()} filterFamily={null}
          onFilterFamily={vi.fn()} filterCuisine={null} onFilterCuisine={vi.fn()} />,
      );
      const rs = screen.getAllByTestId('sauce-row');
      expect(rs.length).toBe(2);
      for (const row of rs) {
        const tag = `row "${row.textContent}" (style="${row.getAttribute('style')}", class="${row.getAttribute('class')}")`;
        expect(hasBorder(row), `${tag} has a border`).toBe(false);
        expect(hasBoxShadow(row), `${tag} has a box-shadow`).toBe(false);
        expect(hasBackgroundImage(row), `${tag} has a background image`).toBe(false);
        expect(minHeightPx(row) ?? 0, `${tag} min height`).toBeGreaterThanOrEqual(44);
      }
      unmount();
    }
  });
});

describe('LOOK-9 My pantry', () => {
  // Covers: AC-1
  it('the pantry panel has exactly one primary: a button filled with the accent (Invent a sauce)', async () => {
    localStorage.setItem('fn-my-kitchen', JSON.stringify(['egg yolk', 'lemon']));
    render(<Lab />);
    fireEvent.click(await screen.findByTestId('sauce-pantry-open'));
    const panel = screen.getByTestId('sauce-pantry-panel');
    const p = expectOnePrimary(expect, panel, 'My pantry');
    expect(p.textContent).toMatch(/Invent a sauce/i);
    expectNoOtherAccentFill(expect, panel, 'My pantry');
  });
});

describe('LOOK-9 sauce card', () => {
  // Covers: AC-1
  it('a sauce card with an empty kitchen has exactly one primary: Add to shopping list, filled with the accent', async () => {
    const card = await openSauce('Beurre Blanc');
    await within(card).findByTestId('what-do-i-need');
    const p = expectOnePrimary(expect, card, 'Beurre Blanc card, empty kitchen');
    expect(p.textContent).toMatch(/Add to shopping list/i);
  });

  // Covers: AC-2
  it('nothing on the sauce card other than the primary has an accent background', async () => {
    const card = await openSauce('Beurre Blanc');
    await within(card).findByTestId('what-do-i-need');
    expectNoOtherAccentFill(expect, card, 'Beurre Blanc card');
  });
});

describe('LOOK-9 sauce card: a chalk drawing stands in for a missing photo', () => {
  const drawingIn = (card) => card.querySelector('[data-testid="dish-story-drawing"]');
  const isSvgDrawing = (el) => !!el && (el.tagName.toLowerCase() === 'svg' || !!el.querySelector('svg'));
  const firstImg = async (card) => waitFor(() => {
    const el = card.querySelector('img');
    expect(el).toBeTruthy();
    return el;
  });

  // Covers: AC-5
  it('a sauce with a story but no photo shows the dish-story-drawing svg and no empty photo frame', async () => {
    const card = await openSauce('Hollandaise');
    await waitFor(() => expect(isSvgDrawing(drawingIn(card))).toBe(true));
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).queryByTestId('dish-story-photo')).toBeNull();
  });

  // Covers: AC-5
  it('a sauce with no story at all shows the dish-story-drawing svg', async () => {
    const card = await openSauce('Beurre Blanc');
    await waitFor(() => expect(isSvgDrawing(drawingIn(card))).toBe(true));
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).queryByTestId('dish-story-photo')).toBeNull();
  });

  // Covers: AC-5
  it('a sauce whose photo fails to load shows the drawing and no empty frame', async () => {
    const card = await openSauce('Béchamel');
    fireEvent.error(await firstImg(card));
    await waitFor(() => expect(isSvgDrawing(drawingIn(card))).toBe(true));
    expect(card.querySelector('img')).toBeNull();
    expect(within(card).queryByTestId('dish-story-photo')).toBeNull();
  });

  // Covers: AC-5
  it('a sauce whose photo loads shows the photo and no drawing', async () => {
    const card = await openSauce('Béchamel');
    const img = await firstImg(card);
    Object.defineProperty(img, 'naturalWidth', { value: 500, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 375, configurable: true });
    fireEvent.load(img);
    await waitFor(() => expect(card.querySelector('img')).toBeTruthy());
    expect(drawingIn(card)).toBeNull();
  });
});
