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
});
