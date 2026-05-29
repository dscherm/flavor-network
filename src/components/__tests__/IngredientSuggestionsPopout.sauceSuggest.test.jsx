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

const SAUCES = [
  {
    name: 'Béchamel',
    ingredients: [{ name: 'butter' }, { name: 'flour' }, { name: 'milk' }, { name: 'salt' }, { name: 'nutmeg' }],
  },
  {
    name: 'Hollandaise',
    ingredients: [{ name: 'butter' }, { name: 'egg yolk' }, { name: 'lemon juice' }],
  },
  {
    name: 'Caramel sauce',
    ingredients: [{ name: 'sugar' }, { name: 'butter' }, { name: 'cream' }],
  },
  {
    name: 'Tomato sauce',
    ingredients: [{ name: 'tomato' }, { name: 'garlic' }, { name: 'basil' }, { name: 'olive oil' }],
  },
];

const NODES = new Map([
  ['butter', {}], ['flour', {}], ['milk', {}],
  ['tomato', {}], ['basil', {}], ['garlic', {}],
]);

function mount(overrides = {}) {
  return render(
    <IngredientSuggestionsPopout
      ingredient={null}
      recipeIngredients={['tomato', 'basil', 'garlic']}
      bowl={bowlFromIngredients(['tomato', 'basil', 'garlic'])}
      nodes={NODES}
      edges={[]}
      scopeFilter={null}
      labMode="taste"
      onAdd={() => {}}
      onClose={() => {}}
      sauces={SAUCES}
      recipeType={null}
      onSelectSauce={() => {}}
      {...overrides}
    />,
  );
}

describe('IngredientSuggestionsPopout — RL-SAUCE-SUGGEST (§15.1 Suggested sauces chip row)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('renders "Suggested sauces" row with the top-overlap chips first', () => {
    mount();
    expect(screen.getByTestId('suggested-sauces-row')).toBeInTheDocument();
    // Tomato sauce overlaps 3 of [tomato, basil, garlic] → top chip.
    expect(screen.getByTestId('sauce-chip-Tomato sauce')).toBeInTheDocument();
  });

  it('row is hidden when the bowl is empty', () => {
    mount({ recipeIngredients: [], bowl: bowlFromIngredients([]) });
    expect(screen.queryByTestId('suggested-sauces-row')).toBeNull();
  });

  it('row is hidden when no sauce in the list overlaps the bowl', () => {
    mount({
      recipeIngredients: ['quinoa', 'kale'],
      bowl: bowlFromIngredients(['quinoa', 'kale']),
    });
    expect(screen.queryByTestId('suggested-sauces-row')).toBeNull();
  });

  it('row is hidden when sauces prop is null/empty', () => {
    mount({ sauces: null });
    expect(screen.queryByTestId('suggested-sauces-row')).toBeNull();
  });

  it('row is hidden in replace-mode (ingredient set)', () => {
    mount({
      ingredient: 'tomato',
      recipeIngredients: ['basil', 'garlic'],
      bowl: bowlFromIngredients(['basil', 'garlic']),
    });
    expect(screen.queryByTestId('suggested-sauces-row')).toBeNull();
  });

  it('tap chip fires onSelectSauce with the sauce name', () => {
    const onSelectSauce = vi.fn();
    mount({ onSelectSauce });
    fireEvent.click(screen.getByTestId('sauce-chip-Tomato sauce'));
    expect(onSelectSauce).toHaveBeenCalledTimes(1);
    expect(onSelectSauce).toHaveBeenCalledWith('Tomato sauce');
  });

  it('recipeType="dessert" hides savory sauces and surfaces sweet only', () => {
    mount({
      recipeIngredients: ['butter', 'milk', 'sugar', 'flour'],
      bowl: bowlFromIngredients(['butter', 'milk', 'sugar', 'flour']),
      recipeType: 'dessert',
    });
    expect(screen.getByTestId('sauce-chip-Caramel sauce')).toBeInTheDocument();
    expect(screen.queryByTestId('sauce-chip-Béchamel')).toBeNull();
    expect(screen.queryByTestId('sauce-chip-Hollandaise')).toBeNull();
  });

  it('recipeType="main" hides sweet sauces and surfaces savory only', () => {
    mount({
      recipeIngredients: ['butter', 'milk', 'sugar'],
      bowl: bowlFromIngredients(['butter', 'milk', 'sugar']),
      recipeType: 'main',
    });
    expect(screen.queryByTestId('sauce-chip-Caramel sauce')).toBeNull();
    expect(screen.getByTestId('sauce-chip-Béchamel')).toBeInTheDocument();
  });

  it('emits at most 5 chips', () => {
    const manySauces = Array.from({ length: 12 }, (_, i) => ({
      name: `Sauce ${i}`,
      ingredients: [{ name: 'tomato' }, { name: 'basil' }],
    }));
    mount({ sauces: manySauces });
    const chips = screen.getAllByTestId(/^sauce-chip-/);
    expect(chips.length).toBeLessThanOrEqual(5);
  });
});
