// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecipeLabMobile from '../RecipeLabMobile.jsx';

function buildFullData(ingredientList = ['tomato', 'basil', 'olive oil']) {
  const nodes = new Map(ingredientList.map((n) => [n, { name: n, taste: 'umami' }]));
  const edges = [];
  for (let i = 0; i < ingredientList.length; i++) {
    for (let j = i + 1; j < ingredientList.length; j++) {
      edges.push({ source: ingredientList[i], target: ingredientList[j], strength: 0.5 });
    }
  }
  return { graph: { nodes, edges, ingredientList }, cuisineNeighborIndex: null };
}

describe('RecipeLabMobile — MAKE-HANDOFF-SOURCE empty-bowl bypass for make-*', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class {
        observe() {} unobserve() {} disconnect() {}
      };
    }
  });

  it('empty-bowl handoff with source="make-scratch" executes the watcher (clears bowl, no rows)', () => {
    const { rerender } = render(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={['tomato', 'basil']}
      />,
    );
    expect(screen.getByTestId('amount-input-tomato')).toBeInTheDocument();
    expect(screen.getByTestId('amount-input-basil')).toBeInTheDocument();

    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={['tomato', 'basil']}
        handoff={{ ts: 1, source: 'make-scratch', ingredients: [], mode: null }}
      />,
    );

    expect(screen.queryByTestId('amount-input-tomato')).toBeNull();
    expect(screen.queryByTestId('amount-input-basil')).toBeNull();
  });

  it('empty-bowl handoff WITHOUT make-* source is ignored (legacy invariant preserved)', () => {
    const { rerender } = render(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={['tomato', 'basil']}
      />,
    );

    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={['tomato', 'basil']}
        handoff={{ ts: 2, source: 'cocktail', ingredients: [], mode: 'cocktail' }}
      />,
    );

    expect(screen.getByTestId('amount-input-tomato')).toBeInTheDocument();
    expect(screen.getByTestId('amount-input-basil')).toBeInTheDocument();
  });

  // MAKE-E2E-AUDIT (2026-05-30): the generic "Loaded 0 ingredients from
  // recipe" toast was confusing for zero-bowl Make handoffs. Per-subtype
  // copy now renders, with non-Make handoffs keeping the count format.
  it('make-photo handoff surfaces a photo-specific toast ("Photo attached")', async () => {
    const { rerender } = render(
      <RecipeLabMobile fullData={buildFullData()} initialIngredients={[]} />,
    );
    const file = new File(['x'], 'r.jpg', { type: 'image/jpeg' });
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={[]}
        handoff={{ ts: 10, source: 'make-photo', ingredients: [], image: file, mode: null }}
      />,
    );
    expect(await screen.findByText(/Photo attached/i)).toBeInTheDocument();
  });

  it('make-scratch handoff surfaces a scratch-specific toast ("Empty recipe ready")', async () => {
    const { rerender } = render(
      <RecipeLabMobile fullData={buildFullData()} initialIngredients={[]} />,
    );
    rerender(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={[]}
        handoff={{ ts: 11, source: 'make-scratch', ingredients: [], mode: null }}
      />,
    );
    expect(await screen.findByText(/Empty recipe ready/i)).toBeInTheDocument();
  });
});
