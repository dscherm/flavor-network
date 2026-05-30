// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IngredientSuggestionsPopout from '../IngredientSuggestionsPopout.jsx';
import { bowlFromIngredients } from '../../data/bowlEntry.js';

vi.mock('../../data/tastePositioning.js', () => ({
  scoreIngredient: () => ({ channels: {} }),
}));
vi.mock('../../utils/color.js', () => ({
  TASTE_COLORS: { default: '#888888' },
}));
vi.mock('../../data/recipeScoring.js', () => ({
  AROMA_COLORS: {},
}));
vi.mock('../../data/ingredientRoles.js', () => ({
  roleOf: () => 'other',
  rolesCompatible: () => true,
}));
vi.mock('../../data/graph.js', () => ({
  getNeighborsEnriched: () => [],
}));

const NODES = new Map([
  ['salt',     { category: 'seasoning' }],
  ['pepper',   { category: 'spice' }],
  ['cinnamon', { category: 'spice' }],
  ['vanilla',  { category: 'spice' }],
  ['nutmeg',   { category: 'spice' }],
  ['basil',    { category: 'herb' }],
  ['oregano',  { category: 'herb' }],
  ['garlic',   { category: 'aromatic' }],
  ['ginger',   { category: 'aromatic' }],
  ['cumin',    { category: 'spice' }],
  ['paprika',  { category: 'spice' }],
  ['tomato',   { category: 'vegetable' }],
  ['beef',     { category: 'protein' }],
  ['apple',    { category: 'fruit' }],
]);

function buildCtx() {
  return {
    recipePairs: {
      tomato: { basil: 1000, oregano: 600, garlic: 800, pepper: 500 },
      beef:   { pepper: 900, cumin: 700, paprika: 600, garlic: 500 },
      apple:  { cinnamon: 900, vanilla: 700, ginger: 600, nutmeg: 500 },
    },
    globalCount: {
      salt: 9000, pepper: 8000, basil: 3000, oregano: 1200, garlic: 4500,
      cinnamon: 1500, vanilla: 1800, ginger: 1100, cumin: 800, paprika: 700,
      nutmeg: 600, tomato: 5000, beef: 6000, apple: 4000,
    },
  };
}

function mount(overrides = {}) {
  const ctx = buildCtx();
  return render(
    <IngredientSuggestionsPopout
      ingredient={null}
      recipeIngredients={['beef', 'tomato']}
      bowl={bowlFromIngredients(['beef', 'tomato'])}
      nodes={NODES}
      edges={[]}
      scopeFilter={null}
      labMode="taste"
      onAdd={() => {}}
      onClose={() => {}}
      recipePairs={ctx.recipePairs}
      globalCount={ctx.globalCount}
      recipeType={null}
      {...overrides}
    />,
  );
}

describe('IngredientSuggestionsPopout — RL-SEASONING-SUGGEST (§15.3 chip row)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('renders "Suggested seasonings" row with seasoning chips when bowl has ingredients', () => {
    mount();
    expect(screen.getByTestId('suggested-seasonings-row')).toBeInTheDocument();
    // beef + tomato pair with pepper, cumin, paprika, garlic, basil, etc.
    expect(screen.getByTestId('seasoning-chip-pepper')).toBeInTheDocument();
  });

  it('row is hidden when the bowl is empty', () => {
    mount({ recipeIngredients: [], bowl: bowlFromIngredients([]) });
    expect(screen.queryByTestId('suggested-seasonings-row')).toBeNull();
  });

  it('row is hidden in replace-mode (ingredient set)', () => {
    mount({
      ingredient: 'tomato',
      recipeIngredients: ['basil'],
      bowl: bowlFromIngredients(['basil']),
    });
    expect(screen.queryByTestId('suggested-seasonings-row')).toBeNull();
  });

  it('row is hidden when recipePairs / globalCount / nodes missing', () => {
    mount({ recipePairs: null });
    expect(screen.queryByTestId('suggested-seasonings-row')).toBeNull();
    mount({ globalCount: null });
    expect(screen.queryByTestId('suggested-seasonings-row')).toBeNull();
  });

  it('tap chip fires onAdd with the seasoning name', () => {
    const onAdd = vi.fn();
    mount({ onAdd });
    fireEvent.click(screen.getByTestId('seasoning-chip-pepper'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('pepper');
  });

  it('chip names are seasoning-category only (no proteins / vegetables)', () => {
    mount();
    const chips = screen.getAllByTestId(/^seasoning-chip-/);
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      const name = chip.getAttribute('data-testid').replace('seasoning-chip-', '');
      const node = NODES.get(name);
      expect(node).toBeTruthy();
      expect(['spice', 'herb', 'aromatic', 'seasoning']).toContain(node.category);
    }
  });

  it('recipeType="dessert" hides savory spices and surfaces sweet-friendly only', () => {
    mount({
      recipeIngredients: ['apple'],
      bowl: bowlFromIngredients(['apple']),
      recipeType: 'dessert',
    });
    // cinnamon, vanilla, nutmeg, ginger should surface
    expect(screen.queryByTestId('seasoning-chip-pepper')).toBeNull();
    expect(screen.queryByTestId('seasoning-chip-cumin')).toBeNull();
    expect(screen.queryByTestId('seasoning-chip-paprika')).toBeNull();
    // Sweet-friendly chips should appear
    const sweetChips = ['cinnamon', 'vanilla', 'nutmeg', 'ginger'];
    const surfaced = sweetChips.filter((n) =>
      screen.queryByTestId(`seasoning-chip-${n}`) !== null,
    );
    expect(surfaced.length).toBeGreaterThan(0);
  });

  it('emits at most 5 chips', () => {
    mount();
    const chips = screen.getAllByTestId(/^seasoning-chip-/);
    expect(chips.length).toBeLessThanOrEqual(5);
  });

  it('bowl members are never returned as seasoning chips', () => {
    mount({
      recipeIngredients: ['basil', 'garlic'],
      bowl: bowlFromIngredients(['basil', 'garlic']),
    });
    expect(screen.queryByTestId('seasoning-chip-basil')).toBeNull();
    expect(screen.queryByTestId('seasoning-chip-garlic')).toBeNull();
  });
});
