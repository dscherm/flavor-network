// @vitest-environment jsdom
// KITCHEN-2: Recipe Lab handoffs (make-kitchen / make-invent) get their own
// toast, and a method handed over with the recipe shows as a fold.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecipeLabMobile from '../RecipeLabMobile.jsx';

function buildFullData(list = ['chicken', 'lemon', 'garlic', 'salt']) {
  const nodes = new Map(list.map((n) => [n, { name: n, taste: 'umami' }]));
  return { graph: { nodes, edges: [], ingredientList: list }, cuisineNeighborIndex: null };
}

function handOver(handoff) {
  const { rerender } = render(<RecipeLabMobile fullData={buildFullData()} initialIngredients={[]} />);
  rerender(<RecipeLabMobile fullData={buildFullData()} initialIngredients={[]} handoff={handoff} />);
  return rerender;
}

describe('RecipeLabMobile — KITCHEN-2 handoffs', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    }
  });

  it('make-kitchen: toast names the recipe and what is still needed; the method folds open', async () => {
    handOver({
      ts: 21, source: 'make-kitchen', mode: 'recipe', title: 'Garlic Lemon Chicken',
      ingredients: ['chicken', 'lemon', 'garlic', 'salt'], missing: ['thyme'],
      steps: ['Brown the chicken.', 'Add garlic and lemon.'], stepsFrom: 'Garlic Lemon Chicken',
    });
    expect(await screen.findByText(/From your kitchen: "Garlic Lemon Chicken" — 4 ingredients; still need thyme/)).toBeInTheDocument();
    const fold = screen.getByRole('button', { name: /Method \(2 steps\)/ });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Brown the chicken.')).toBeNull();
    fireEvent.click(fold);
    expect(screen.getByText('Brown the chicken.')).toBeInTheDocument();
  });

  it('make-invent: toast says it is an idea; the method credits the real recipe it came from', async () => {
    handOver({
      ts: 22, source: 'make-invent', mode: 'recipe', title: 'Chicken & Lemon Skillet',
      ingredients: [{ ingredient: 'chicken', amount: { raw: '1 lb', qty: 1, unit: 'lb', inferred: true } }, { ingredient: 'lemon', amount: null }],
      steps: ['Cook.'], stepsFrom: 'Lemon Chicken',
    });
    expect(await screen.findByText(/Invented: "Chicken & Lemon Skillet" — an idea to taste and adjust/)).toBeInTheDocument();
    expect(screen.getByTestId('recipe-handoff-method')).toHaveTextContent('from “Lemon Chicken”');
  });

  it('a later handoff without steps clears the method', () => {
    const rerender = handOver({ ts: 23, source: 'make-kitchen', title: 'X', ingredients: ['chicken'], steps: ['Cook.'] });
    expect(screen.getByTestId('recipe-handoff-method')).toBeInTheDocument();
    rerender(<RecipeLabMobile fullData={buildFullData()} initialIngredients={[]} handoff={{ ts: 24, source: 'cookbook', ingredients: ['lemon'] }} />);
    expect(screen.queryByTestId('recipe-handoff-method')).toBeNull();
  });
});
