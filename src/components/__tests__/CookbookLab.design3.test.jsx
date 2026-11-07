// @vitest-environment jsdom
// DESIGN-3: picture-led Cookbook tiles + popup, and the nested-button fix
// in MultiAxisRadarStack.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CookbookLab from '../CookbookLab.jsx';
import MultiAxisRadarStack from '../MultiAxisRadarStack.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';
import { dishTypeOf } from '../../data/dishType.js';

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));

const bolognese = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
const CATEGORY = { beef: 'protein', tomato: 'vegetable', onion: 'vegetable', carrot: 'vegetable', celery: 'vegetable', garlic: 'aromatic', 'red wine': 'liquid', pasta: 'grain' };
const ctx = {
  graph: {
    nodes: new Map(bolognese.ingredients.map((n) => [n, { name: n, taste: 'umami', category: CATEGORY[n], cuisines: ['italian'] }])),
  },
};

function openBolognese(props = {}) {
  render(<CookbookLab ctx={ctx} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Beef Bolognese/i }));
  return screen.getByRole('dialog');
}

/** Elements in document order → index of the first match for each test id. */
function orderOf(root, ids) {
  const all = [...root.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'));
  return ids.map((id) => all.indexOf(id));
}

describe('Cookbook tiles (DESIGN-3)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    }
  });

  it('every tile carries a hidden chalk dish drawing of its dish type, and keeps the name as text', () => {
    render(<CookbookLab ctx={ctx} />);
    // show all types so every seed recipe has a tile
    fireEvent.click(screen.getByRole('button', { name: 'All types' }));
    for (const r of SEED_RECIPES) {
      const tile = screen.getByTestId(`recipe-card-${r.id}`);
      const art = within(tile).getByTestId('dish-art');
      expect(art.getAttribute('aria-hidden')).toBe('true');
      expect(art.getAttribute('data-kind')).toBe(dishTypeOf(r));
      expect(art.getAttribute('data-kind')).not.toBe('plate');
      expect(tile).toHaveTextContent(r.name);
    }
  });
});

describe('Cookbook popup (DESIGN-3)', () => {
  let errSpy;
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    }
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errSpy.mockRestore());

  it('leads with picture: head (dish art + meta) → radar → ingredients → method → goes well with', () => {
    const dialog = openBolognese({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), onFindWine: vi.fn() });
    const order = orderOf(dialog, ['recipe-head', 'dish-art', 'recipe-meta', 'recipe-profile', 'recipe-ingredients', 'recipe-method', 'recipe-goes-well-with']);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(within(dialog).getByTestId('dish-art').getAttribute('aria-hidden')).toBe('true');
    // the radar is a real chart, near the top, with working axis chips
    const profile = within(dialog).getByTestId('recipe-profile');
    expect(within(profile).getByRole('img', { name: /Taste radar/i })).toBeInTheDocument();
    fireEvent.click(within(profile).getByRole('button', { name: 'Aroma' }));
    expect(within(profile).getByRole('img', { name: /Aroma radar/i })).toBeInTheDocument();
  });

  it('meta reads as accessible text: serves, time and ingredient count', () => {
    const dialog = openBolognese();
    const d = RECIPE_DETAILS['beef-bolognese'];
    const meta = within(dialog).getByTestId('recipe-meta');
    expect(meta).toHaveTextContent(`Serves ${d.serves}`);
    expect(meta).toHaveTextContent(d.time);
    expect(meta).toHaveTextContent(`${bolognese.ingredients.length} ingredients`);
  });

  it('ingredients are chips with amount + name, and a category glyph where the graph has one', () => {
    const dialog = openBolognese();
    const list = within(dialog).getByTestId('recipe-ingredients');
    const chips = within(list).getAllByRole('listitem');
    expect(chips).toHaveLength(bolognese.ingredients.length);
    const beef = chips.find((c) => c.textContent.includes('beef'));
    expect(beef).toHaveTextContent(RECIPE_DETAILS['beef-bolognese'].amounts.beef);
    expect(within(beef).getByTestId('ingredient-glyph').getAttribute('data-kind')).toBe('meat');
  });

  it('the method fold is closed by default and toggles open and shut', () => {
    const dialog = openBolognese();
    const n = RECIPE_DETAILS['beef-bolognese'].steps.length;
    const method = within(dialog).getByTestId('recipe-method');
    const fold = within(method).getByRole('button', { name: `Method (${n} steps)` });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(within(method).queryAllByRole('listitem')).toHaveLength(0);
    fireEvent.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    expect(within(method).getAllByRole('listitem')).toHaveLength(n);
    fireEvent.click(fold);
    expect(within(method).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('every action still fires: wines, cocktails, sauces, Recipe Notebook, network', () => {
    const h = {
      onFindWine: vi.fn(), onFindCocktail: vi.fn(), onFindSauce: vi.fn(),
      onOpenRecipeLab: vi.fn(), onOpenInNetwork: vi.fn(),
    };
    const dialog = openBolognese(h);
    const well = within(dialog).getByTestId('recipe-goes-well-with');
    for (const k of ['wine', 'cocktail', 'sauce']) {
      // each mini-card is a drawing (hidden) + a short label
      const svg = within(well).getByTestId(`pair-card-${k}`).querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    fireEvent.click(within(well).getByRole('button', { name: 'Matching wines' }));
    fireEvent.click(within(well).getByRole('button', { name: 'Matching cocktails' }));
    fireEvent.click(within(well).getByRole('button', { name: 'Matching sauces' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Open in Recipe Notebook/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Explore in Network/i }));
    expect(h.onFindWine).toHaveBeenCalledWith(bolognese.ingredients, 'Beef Bolognese', expect.objectContaining({ cuisine: 'Italian', dishType: 'savory' }));
    expect(h.onFindCocktail).toHaveBeenCalledWith(bolognese.ingredients, 'Beef Bolognese');
    expect(h.onFindSauce).toHaveBeenCalledWith(bolognese.ingredients, 'Beef Bolognese');
    expect(h.onOpenRecipeLab).toHaveBeenCalledWith('recipe', bolognese.ingredients);
    expect(h.onOpenInNetwork).toHaveBeenCalledWith('beef');
  });

  it('renders without a nested-button DOM warning', () => {
    openBolognese({ onFindCocktail: vi.fn() });
    const nesting = errSpy.mock.calls.filter((c) => String(c[0]).includes('validateDOMNesting') || String(c.join(' ')).includes('cannot appear as a descendant'));
    expect(nesting).toEqual([]);
  });
});

describe('MultiAxisRadarStack nested-button fix (DESIGN-3)', () => {
  it('has no <button> inside another <button> and stays keyboard-operable', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onAxisSelect = vi.fn();
    const { container } = render(
      <MultiAxisRadarStack ingredients={['tomato']} nodes={new Map([['tomato', { name: 'tomato', taste: 'umami' }]])} focalName="tomato" onAxisSelect={onAxisSelect} />,
    );
    expect(container.querySelectorAll('button button')).toHaveLength(0);
    expect(container.querySelectorAll('[role="button"] button')).toHaveLength(0);
    const card = screen.getByTestId('multi-radar-season');
    expect(card).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onAxisSelect).toHaveBeenCalledTimes(2);
    expect(onAxisSelect).toHaveBeenCalledWith('season');
    expect(errSpy.mock.calls.filter((c) => String(c.join(' ')).includes('descendant'))).toEqual([]);
    errSpy.mockRestore();
  });
});
