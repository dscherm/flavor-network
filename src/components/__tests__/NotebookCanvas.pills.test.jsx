// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipeNotebook from '../RecipeNotebook.jsx';
import { bowlFromIngredients } from '../../data/bowlEntry.js';

// ── Module mocks ──────────────────────────────────────────────────────────────
// RecipeNotebook uses getNeighborsEnriched from graph.js and scoreIngredient
// from tastePositioning.js — stub them so we don't need real graph data.

vi.mock('../../data/graph.js', () => ({
  getNeighborsEnriched: () => [],
}));

vi.mock('../../data/tastePositioning.js', () => ({
  scoreIngredient: () => ({ channels: {} }),
}));

vi.mock('../../utils/color.js', () => ({
  TASTE_COLORS: { default: '#888888' },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Minimal nodes Map where every ingredient has gnnProbs so aromaDisabled=false
const NODES_WITH_GNN = new Map([
  ['tomato', { taste: 'sour', gnnProbs: { odor_fruity: 0.7, odor_fatty: 0.1, odor_green: 0.4, odor_woody: 0.2, odor_spicy: 0.05, odor_floral: 0.15 } }],
  ['basil',  { taste: 'bitter', gnnProbs: { odor_fruity: 0.2, odor_fatty: 0.05, odor_green: 0.8, odor_woody: 0.1, odor_spicy: 0.3, odor_floral: 0.4 } }],
]);

// Nodes where NO ingredient has gnnProbs → aromaDisabled should be true
const NODES_NO_GNN = new Map([
  ['flour', { taste: 'neutral', gnnProbs: null }],
  ['water', { taste: 'neutral' }],
]);

const RECIPE_WITH_GNN    = ['tomato', 'basil'];
const RECIPE_WITHOUT_GNN = ['flour', 'water'];

// ── Helper ────────────────────────────────────────────────────────────────────

function renderNotebook({
  ingredients = RECIPE_WITH_GNN,
  nodes = NODES_WITH_GNN,
  onFindCocktail = undefined,
  onFindSauce = undefined,
  aromaDisabled = false,
  recipeTitle = 'Test Recipe',
} = {}) {
  return render(
    <RecipeNotebook
      bowl={bowlFromIngredients(ingredients)}
      centerIngredient={ingredients[0] || null}
      nodes={nodes}
      edges={[]}
      onRemove={() => {}}
      onRecenter={() => {}}
      onFocusIngredient={() => {}}
      onRequestAdd={() => {}}
      onRequestSuggestions={() => {}}
      onFindCocktail={onFindCocktail}
      onFindSauce={onFindSauce}
      aromaDisabled={aromaDisabled}
      recipeTitle={recipeTitle}
      onTitleChange={() => {}}
      compatibility={null}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecipeNotebook — aroma-match pills not rendered when callbacks absent', () => {
  it('renders NO cocktail pill when onFindCocktail is not provided', () => {
    renderNotebook({ onFindCocktail: undefined, onFindSauce: undefined });
    expect(screen.queryByText(/Find a Cocktail/i)).toBeNull();
    expect(screen.queryByText(/Need a sauce/i)).toBeNull();
  });
});

describe('RecipeNotebook — pills enabled (GNN coverage present)', () => {
  it('renders the cocktail pill when onFindCocktail is provided', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: false });
    expect(screen.getByText('Find a Cocktail to serve with this recipe')).toBeTruthy();
  });

  it('renders the sauce pill when onFindSauce is provided', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: false });
    expect(screen.getByText('Need a sauce for this recipe?')).toBeTruthy();
  });

  it('cocktail pill is NOT disabled when aromaDisabled=false', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: false });
    const btn = screen.getByText('Find a Cocktail to serve with this recipe').closest('button');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });

  it('sauce pill is NOT disabled when aromaDisabled=false', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: false });
    const btn = screen.getByText('Need a sauce for this recipe?').closest('button');
    expect(btn.disabled).toBe(false);
  });

  it('clicking cocktail pill fires onFindCocktail', () => {
    const onFindCocktail = vi.fn();
    renderNotebook({ onFindCocktail, onFindSauce: vi.fn(), aromaDisabled: false });
    const btn = screen.getByText('Find a Cocktail to serve with this recipe').closest('button');
    fireEvent.click(btn);
    expect(onFindCocktail).toHaveBeenCalledTimes(1);
  });

  it('clicking sauce pill fires onFindSauce', () => {
    const onFindSauce = vi.fn();
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce, aromaDisabled: false });
    const btn = screen.getByText('Need a sauce for this recipe?').closest('button');
    fireEvent.click(btn);
    expect(onFindSauce).toHaveBeenCalledTimes(1);
  });

  it('cocktail pill accessible name includes the recipe title', () => {
    renderNotebook({
      onFindCocktail: vi.fn(),
      onFindSauce: vi.fn(),
      aromaDisabled: false,
      recipeTitle: 'Pasta Bolognese',
    });
    const btn = screen.getByRole('button', { name: /Find a cocktail to pair with Pasta Bolognese/i });
    expect(btn).toBeTruthy();
  });

  it('sauce pill accessible name includes the recipe title', () => {
    renderNotebook({
      onFindCocktail: vi.fn(),
      onFindSauce: vi.fn(),
      aromaDisabled: false,
      recipeTitle: 'Pasta Bolognese',
    });
    const btn = screen.getByRole('button', { name: /Find a sauce to pair with Pasta Bolognese/i });
    expect(btn).toBeTruthy();
  });
});

describe('RecipeNotebook — pills disabled (zero GNN coverage)', () => {
  it('cocktail pill is disabled when aromaDisabled=true', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: true });
    const btn = screen.getByText('Find a Cocktail to serve with this recipe').closest('button');
    expect(btn.disabled).toBe(true);
  });

  it('sauce pill is disabled when aromaDisabled=true', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: true });
    const btn = screen.getByText('Need a sauce for this recipe?').closest('button');
    expect(btn.disabled).toBe(true);
  });

  it('cocktail pill title contains exact tooltip text when disabled', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: true });
    const btn = screen.getByText('Find a Cocktail to serve with this recipe').closest('button');
    expect(btn.title).toBe('Need at least one ingredient with flavor data');
  });

  it('sauce pill title contains exact tooltip text when disabled', () => {
    renderNotebook({ onFindCocktail: vi.fn(), onFindSauce: vi.fn(), aromaDisabled: true });
    const btn = screen.getByText('Need a sauce for this recipe?').closest('button');
    expect(btn.title).toBe('Need at least one ingredient with flavor data');
  });

  it('clicking a disabled cocktail pill does NOT fire onFindCocktail', () => {
    const onFindCocktail = vi.fn();
    renderNotebook({ onFindCocktail, onFindSauce: vi.fn(), aromaDisabled: true });
    const btn = screen.getByText('Find a Cocktail to serve with this recipe').closest('button');
    fireEvent.click(btn);
    expect(onFindCocktail).not.toHaveBeenCalled();
  });
});
