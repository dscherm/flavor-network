// @vitest-environment jsdom
// LOOK-9 contract tests (blind): the Cookbook menu and the dish card. Written from plan.md (LOOK-9 AC-1, AC-2,
// AC-4) and the approved brief .schermness/design/LOOK-9.md (sections 3.2, 3.3, 7 D1 and D2, 9). No file under src/
// was read; render setups reused from src/components/__tests__/CookbookLab.shopping.test.jsx (kitchen through
// localStorage, shopping state held by commitList) and CookbookLab.design3.test.jsx (pair-card-* with handlers).
//
// The card root: decision D1 makes the dish card full screen. The tests find its root as the nearest ancestor of
// [data-testid="recipe-meta"] that is [data-testid="recipe-detail"] or, failing that, [role="dialog"] (what the
// existing tests query today). The implementer keeps one of the two on the card's outermost element.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { useState } from 'react';
import {
  hasBorder, hasBoxShadow, hasAnyBackground, hasRoundedFull, primaries,
  expectOnePrimary, expectNoOtherAccentFill, expectSelectedNotFilled,
} from './helpers.js';
import CookbookLab from '../../../src/components/CookbookLab.jsx';
import { SEED_RECIPES } from '../../../src/data/seedRecipes.js';
import { MY_KITCHEN_KEY } from '../../../src/data/myKitchen.js';
import { commitList, emptyShopping } from '../../../src/data/shoppingStore.js';

vi.setConfig({ testTimeout: 20000 });
vi.mock('../../../src/components/NetworkScene.jsx', () => ({ default: () => null }));

const CATS = { beef: 'protein', tomato: 'vegetable', onion: 'aromatic', carrot: 'vegetable', celery: 'vegetable', garlic: 'aromatic', 'red wine': 'liquid', pasta: 'grain' };
const bolognese = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
const ctx = { graph: { nodes: new Map(bolognese.ingredients.map((n) => [n, { name: n, category: CATS[n], taste: 'umami', cuisines: ['italian'] }])) } };
const OWNED = ['beef', 'tomato', 'onion', 'carrot', 'celery', 'pasta', 'garlic', 'red wine'];

function Lab(props) {
  const [state, setState] = useState(emptyShopping());
  const up = {
    profile: { recipes: [], shopping: state },
    updateShopping: (change, opts) => setState((s) => { const next = change(s.list); return next === s.list ? s : commitList(s, next, opts); }),
  };
  return <CookbookLab ctx={ctx} userProfile={up} onOpenShopping={vi.fn()} {...props} />;
}
const HANDLERS = () => ({ onFindWine: vi.fn(), onFindCocktail: vi.fn(), onFindSauce: vi.fn(), onOpenRecipeLab: vi.fn(), onOpenInNetwork: vi.fn() });

beforeEach(() => {
  localStorage.clear();
  if (typeof globalThis.ResizeObserver === 'undefined') globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

function cardRoot() {
  const meta = screen.getByTestId('recipe-meta');
  const root = meta.closest('[data-testid="recipe-detail"]') || meta.closest('[role="dialog"]');
  expect(root, 'the dish card root ([data-testid="recipe-detail"] or [role="dialog"]) around recipe-meta').toBeTruthy();
  return root;
}
function openBolognese(props = {}) {
  const utils = render(<Lab {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Beef Bolognese/i }));
  return { ...utils, card: cardRoot() };
}
const describeEl = (el) => `<${el.tagName.toLowerCase()} data-testid="${el.getAttribute('data-testid') || ''}" style="${el.getAttribute('style') || ''}" class="${el.getAttribute('class') || ''}">`;

describe('LOOK-9 Cookbook menu', () => {
  // Covers: AC-1
  it('the Cookbook menu has no [data-primary="true"]', () => {
    const { container } = render(<Lab />);
    expect(screen.getByRole('button', { name: /Beef Bolognese/i })).toBeInTheDocument();
    expect(primaries(container)).toHaveLength(0);
  });

  // Covers: AC-2
  it('the selected kind of dish says so (aria-pressed) and is not filled; no accent background on the menu', () => {
    const { container } = render(<Lab />);
    // The Cookbook opens on the "savory" kind (CookbookLab.pickerMode / cookbookUserRecipes tests).
    const pressed = [...container.querySelectorAll('button[aria-pressed="true"]')];
    expect(pressed.length, 'a selected kind-of-dish button with aria-pressed="true"').toBeGreaterThan(0);
    for (const b of pressed) expectSelectedNotFilled(expect, b, `selected "${b.textContent.trim() || b.getAttribute('aria-label')}"`);
    expectNoOtherAccentFill(expect, container, 'Cookbook menu');
    // choosing another kind moves the selection; still not filled
    fireEvent.click(screen.getByRole('button', { name: 'All types' }));
    const all = screen.getByRole('button', { name: 'All types' });
    expectSelectedNotFilled(expect, all, '"All types"');
    expectNoOtherAccentFill(expect, container, 'Cookbook menu, All types');
  });
});

describe('LOOK-9 Cookbook dish card: one primary', () => {
  // Covers: AC-1
  it('the Bolognese card with an empty kitchen has exactly one primary: Add to shopping list, filled with the accent', () => {
    const { card, container } = openBolognese(HANDLERS());
    within(card).getByTestId('what-do-i-need');
    const p = expectOnePrimary(expect, card, 'Bolognese card, empty kitchen');
    expect(p.textContent).toMatch(/Add to shopping list/i);
    // "Open in the Recipe Notebook" is no longer a second filled button
    expect(primaries(container)).toHaveLength(1);
  });

  // Covers: AC-1
  it('a Cookbook card whose ingredients are all owned has no primary', () => {
    localStorage.setItem(MY_KITCHEN_KEY, JSON.stringify(OWNED));
    const { card, container } = openBolognese(HANDLERS());
    within(card).getByTestId('what-do-i-need');
    expect(primaries(card)).toHaveLength(0);
    expect(primaries(container)).toHaveLength(0);
    expectNoOtherAccentFill(expect, container, 'Bolognese card, everything owned');
  });

  // Covers: AC-2
  it('nothing on the card other than the primary has an accent background, with the Flavor profile open', () => {
    const { card } = openBolognese(HANDLERS());
    expectNoOtherAccentFill(expect, card, 'Bolognese card');
    const toggle = within(card).queryByRole('button', { name: /flavor profile/i });
    if (toggle) fireEvent.click(toggle);
    expectNoOtherAccentFill(expect, card, 'Bolognese card, Flavor profile open');
  });
});

describe('LOOK-9 Cookbook dish card: no frame (decision D1)', () => {
  // Covers: AC-4
  it('the card root, and every element between it and the dish header, has no border and no box-shadow', () => {
    const { card } = openBolognese(HANDLERS());
    const chain = [];
    for (let el = screen.getByTestId('recipe-meta').parentElement; el; el = el.parentElement) {
      chain.push(el);
      if (el === card) break;
    }
    const framed = chain.filter((el) => hasBorder(el) || hasBoxShadow(el)).map(describeEl);
    expect(framed, 'card root or a wrapper round the whole card with a border or box-shadow').toEqual([]);
  });

  // Covers: AC-4
  it('a Back control closes the card', () => {
    openBolognese(HANDLERS());
    const card = cardRoot();
    const back = within(card).getByRole('button', { name: /^\s*back\b/i });
    fireEvent.click(back);
    expect(screen.queryByTestId('recipe-meta')).toBeNull();
    // the menu is there again
    expect(screen.getByRole('button', { name: /Beef Bolognese/i })).toBeInTheDocument();
  });

  // Covers: AC-4
  it('Escape closes the card', () => {
    openBolognese(HANDLERS());
    fireEvent.keyDown(screen.getByTestId('recipe-meta'), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('recipe-meta')).toBeNull();
  });

  // Covers: AC-4
  it('recipe-ingredients li are plain rows: no border, no background, no rounded-full (nor a filled pill inside)', () => {
    const { card } = openBolognese(HANDLERS());
    const items = [...within(card).getByTestId('recipe-ingredients').querySelectorAll('li')];
    expect(items.length).toBeGreaterThanOrEqual(bolognese.ingredients.length);
    const bad = [];
    for (const li of items) {
      if (hasBorder(li) || hasAnyBackground(li) || hasRoundedFull(li)) bad.push(describeEl(li));
      for (const inner of li.querySelectorAll('*')) if (hasRoundedFull(inner) && hasAnyBackground(inner)) bad.push(`inside: ${describeEl(inner)}`);
    }
    expect(bad).toEqual([]);
  });

  // Covers: AC-4
  it('the pair-card-* buttons under Goes well with have no border, no background and no rounded-full', () => {
    const { card } = openBolognese(HANDLERS());
    const tiles = [...card.querySelectorAll('[data-testid^="pair-card-"]')];
    expect(tiles.length).toBe(3);
    const bad = [];
    for (const t of tiles) {
      // the testid may sit on the button or on a wrapper round it
      const btn = t.tagName === 'BUTTON' ? t : t.querySelector('button') || t;
      for (const el of new Set([t, btn])) if (hasBorder(el) || hasAnyBackground(el) || hasRoundedFull(el)) bad.push(describeEl(el));
    }
    expect(bad).toEqual([]);
  });
});
