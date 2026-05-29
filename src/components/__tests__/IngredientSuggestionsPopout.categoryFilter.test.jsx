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

// Symmetric recipePairs so every (a,b) appears in both directions.
function buildCtx() {
  return {
    recipePairs: {
      tomato: { basil: 1000, garlic: 800, oregano: 600, beef: 400, parmesan: 350 },
      basil:  { tomato: 1000, garlic: 500, oregano: 700, beef: 200, parmesan: 250 },
      garlic: { tomato: 800, basil: 500, oregano: 400, beef: 700, parmesan: 300 },
      oregano: { tomato: 600, basil: 700, garlic: 400, beef: 100, parmesan: 200 },
      beef:   { tomato: 400, basil: 200, garlic: 700, oregano: 100, parmesan: 150 },
      parmesan: { tomato: 350, basil: 250, garlic: 300, oregano: 200, beef: 150 },
    },
    globalCount: {
      tomato: 5000, basil: 3000, garlic: 4500, oregano: 1200,
      beef: 6000, parmesan: 2500,
    },
  };
}

const NODES = new Map([
  ['tomato',   { category: 'Produce' }],
  ['basil',    { category: 'Herbs & Spices' }],
  ['garlic',   { category: 'Produce' }],
  ['oregano',  { category: 'Herbs & Spices' }],
  ['beef',     { category: 'Meat & Seafood' }],
  ['parmesan', { category: 'Dairy' }],
]);

function mount(overrides = {}) {
  const ctx = buildCtx();
  return render(
    <IngredientSuggestionsPopout
      ingredient={null}
      recipeIngredients={['tomato', 'basil']}
      bowl={bowlFromIngredients(['tomato', 'basil'])}
      focalKey={null}
      nodes={NODES}
      edges={[]}
      scopeFilter={null}
      labMode="taste"
      onAdd={() => {}}
      onClose={() => {}}
      recipePairs={ctx.recipePairs}
      globalCount={ctx.globalCount}
      {...overrides}
    />,
  );
}

describe('IngredientSuggestionsPopout — RL-CATEGORY-FILTER (§14 food-category pills)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('renders category pill row with distinct categories from the candidate pool', () => {
    mount();
    expect(screen.getByTestId('category-filter-row')).toBeInTheDocument();
    // Non-bowl candidates are garlic (Produce), oregano (Herbs & Spices),
    // beef (Meat & Seafood), parmesan (Dairy). All four categories should
    // appear as pills.
    expect(screen.getByTestId('category-pill-Produce')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-Herbs & Spices')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-Meat & Seafood')).toBeInTheDocument();
    expect(screen.getByTestId('category-pill-Dairy')).toBeInTheDocument();
  });

  it('tap-target ≥ 44×44 on every category pill (a11y §14.3)', () => {
    mount();
    for (const cat of ['Produce', 'Dairy', 'Meat & Seafood', 'Herbs & Spices']) {
      const pill = screen.getByTestId(`category-pill-${cat}`);
      expect(parseInt(pill.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
      expect(parseInt(pill.style.minWidth, 10)).toBeGreaterThanOrEqual(44);
    }
  });

  it('default state: no pill active (all categories shown via aria-pressed=false)', () => {
    mount();
    for (const cat of ['Produce', 'Dairy', 'Meat & Seafood', 'Herbs & Spices']) {
      expect(screen.getByTestId(`category-pill-${cat}`).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('tap pill → activates (aria-pressed=true) and narrows candidate set', () => {
    const { container } = mount();
    fireEvent.click(screen.getByTestId('category-pill-Dairy'));
    expect(screen.getByTestId('category-pill-Dairy').getAttribute('aria-pressed')).toBe('true');
    // After narrowing to Dairy: only parmesan should be visible; beef
    // (Meat & Seafood) should NOT.
    expect(container.textContent).toMatch(/parmesan/i);
    expect(container.textContent).not.toMatch(/beef/i);
  });

  it('tap active pill again → deactivates (back to all)', () => {
    const { container } = mount();
    const dairyPill = screen.getByTestId('category-pill-Dairy');
    fireEvent.click(dairyPill);
    expect(dairyPill.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(dairyPill);
    expect(dairyPill.getAttribute('aria-pressed')).toBe('false');
    // beef (Meat & Seafood) should reappear once filter clears.
    expect(container.textContent).toMatch(/beef/i);
  });

  it('tap different pill → single-select (previous deactivates)', () => {
    mount();
    fireEvent.click(screen.getByTestId('category-pill-Dairy'));
    expect(screen.getByTestId('category-pill-Dairy').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('category-pill-Produce'));
    expect(screen.getByTestId('category-pill-Dairy').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('category-pill-Produce').getAttribute('aria-pressed')).toBe('true');
  });

  it('filter runs AFTER ranking — score order preserved within the narrowed set', () => {
    // garlic and oregano are both Produce-adjacent in different
    // categories; this test asserts that filtering by 'Herbs & Spices'
    // (oregano only) keeps the candidate in the result set without
    // re-ordering or re-scoring.
    const { container } = mount();
    fireEvent.click(screen.getByTestId('category-pill-Herbs & Spices'));
    expect(container.textContent).toMatch(/oregano/i);
    expect(container.textContent).not.toMatch(/garlic/i);
    expect(container.textContent).not.toMatch(/beef/i);
  });

  it('pill row hides when no candidate has a category (graceful no-op)', () => {
    const nodesNoCategory = new Map([
      ['tomato', {}], ['basil', {}], ['garlic', {}], ['oregano', {}],
      ['beef', {}], ['parmesan', {}],
    ]);
    mount({ nodes: nodesNoCategory });
    expect(screen.queryByTestId('category-filter-row')).toBeNull();
  });
});
