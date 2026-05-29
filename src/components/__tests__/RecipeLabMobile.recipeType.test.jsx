// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipeLabMobile from '../RecipeLabMobile.jsx';

function buildFullData(ingredientList = ['tomato', 'basil', 'olive oil']) {
  const nodes = new Map(ingredientList.map(n => [n, { name: n, taste: 'umami' }]));
  const edges = [];
  for (let i = 0; i < ingredientList.length; i++) {
    for (let j = i + 1; j < ingredientList.length; j++) {
      edges.push({ source: ingredientList[i], target: ingredientList[j], strength: 0.5 });
    }
  }
  return { graph: { nodes, edges, ingredientList }, cuisineNeighborIndex: null };
}

describe('RecipeLabMobile — recipe-type pill row integration (RL-RECIPETYPE)', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  it('renders the recipe-type pill row on the mobile surface', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    expect(screen.getByTestId('recipe-type-pills')).toBeInTheDocument();
    for (const t of ['main', 'side', 'appetizer', 'dessert', 'drink', 'sauce', 'other']) {
      expect(screen.getByTestId(`recipe-type-pill-${t}`)).toBeInTheDocument();
    }
  });

  it('starts unset (no aria-checked=true on any pill)', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    const checked = Array.from(document.querySelectorAll('[data-testid^="recipe-type-pill-"]'))
      .filter(el => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(0);
  });

  it('tap → set + visible aria-checked=true on the chosen pill', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    fireEvent.click(screen.getByTestId('recipe-type-pill-dessert'));
    expect(screen.getByTestId('recipe-type-pill-dessert').getAttribute('aria-checked')).toBe('true');
  });

  it('re-tap clears + tap-different switches (full gesture on the live surface)', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    const dessert = screen.getByTestId('recipe-type-pill-dessert');
    const drink = screen.getByTestId('recipe-type-pill-drink');
    fireEvent.click(dessert);
    expect(dessert.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(dessert);
    expect(dessert.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(drink);
    expect(drink.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(dessert);
    expect(drink.getAttribute('aria-checked')).toBe('false');
    expect(dessert.getAttribute('aria-checked')).toBe('true');
  });

  it('handoff payload with recipeType hydrates the pill row', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    expect(screen.getByTestId('recipe-type-pill-sauce').getAttribute('aria-checked')).toBe('false');
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, ingredients: ['tomato', 'basil'], mode: 'sauce', recipeType: 'sauce' }}
      />,
    );
    expect(screen.getByTestId('recipe-type-pill-sauce').getAttribute('aria-checked')).toBe('true');
  });

  it('handoff without recipeType clears any prior recipeType (REPLACE semantics)', () => {
    const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} />);
    fireEvent.click(screen.getByTestId('recipe-type-pill-main'));
    expect(screen.getByTestId('recipe-type-pill-main').getAttribute('aria-checked')).toBe('true');
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        handoff={{ ts: 1, ingredients: ['basil'], mode: 'taste' }}
      />,
    );
    expect(screen.getByTestId('recipe-type-pill-main').getAttribute('aria-checked')).toBe('false');
  });

  it('pill row is rendered directly below the mode tab strip (spec §16.2)', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    const modeStrip = document.querySelector('div.flex.items-center.gap-1.p-1.rounded-lg.border.border-\\[\\#c9b99a\\].bg-\\[\\#f5edd0\\]');
    const pillRow = screen.getByTestId('recipe-type-pills');
    expect(modeStrip).not.toBeNull();
    expect(pillRow.compareDocumentPosition(modeStrip) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});
