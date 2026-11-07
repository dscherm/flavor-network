// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CookbookLab from '../CookbookLab.jsx';
import { SEED_RECIPES } from '../../data/seedRecipes.js';
import { RECIPE_DETAILS } from '../../data/seedRecipeDetails.js';

vi.mock('../NetworkScene.jsx', () => ({ default: () => null }));
vi.mock('../MultiAxisRadarStack.jsx', () => ({ default: () => null }));

const bolognese = SEED_RECIPES.find((r) => r.id === 'beef-bolognese');
// Every bolognese ingredient resolves in the graph.
const ctx = { graph: { nodes: new Map(bolognese.ingredients.map((n) => [n, { name: n }])) } };

function openBolognese(props = {}) {
  render(<CookbookLab ctx={ctx} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Beef Bolognese/i }));
  return screen.getByRole('dialog');
}

describe('Cookbook recipe popup — cookable details', () => {
  beforeEach(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    }
  });

  it('shows servings, time, amounts and numbered method steps', () => {
    const dialog = openBolognese();
    const d = RECIPE_DETAILS['beef-bolognese'];
    expect(within(dialog).getByTestId('recipe-meta')).toHaveTextContent(`Serves ${d.serves}`);
    expect(within(dialog).getByText(d.amounts['red wine'])).toBeInTheDocument();
    const method = within(dialog).getByTestId('recipe-method');
    // DESIGN-3: the method sits behind a "Method (N steps)" fold.
    fireEvent.click(within(method).getByRole('button', { name: `Method (${d.steps.length} steps)` }));
    expect(within(method).getAllByRole('listitem')).toHaveLength(d.steps.length);
  });

  it('"Matching cocktails" / "Matching sauces" hand the recipe to the labs', () => {
    const onFindCocktail = vi.fn();
    const onFindSauce = vi.fn();
    const dialog = openBolognese({ onFindCocktail, onFindSauce });
    fireEvent.click(within(dialog).getByRole('button', { name: /matching cocktails/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /matching sauces/i }));
    expect(onFindCocktail).toHaveBeenCalledWith(bolognese.ingredients, 'Beef Bolognese');
    expect(onFindSauce).toHaveBeenCalledWith(bolognese.ingredients, 'Beef Bolognese');
  });

  it('"Matching wines" passes cuisine, dish type and method so the wine ranker can use them', () => {
    const onFindWine = vi.fn();
    const dialog = openBolognese({ onFindWine });
    fireEvent.click(within(dialog).getByRole('button', { name: /matching wines/i }));
    expect(onFindWine).toHaveBeenCalledTimes(1);
    const [ings, name, extras] = onFindWine.mock.calls[0];
    expect(ings).toEqual(bolognese.ingredients);
    expect(name).toBe('Beef Bolognese');
    expect(extras).toEqual(expect.objectContaining({ cuisine: 'Italian', dishType: 'savory' }));
    expect(extras.methodText).toMatch(/simmer/i);
  });

  it('hides "Goes well with" when no handlers are wired', () => {
    const dialog = openBolognese();
    expect(within(dialog).queryByTestId('recipe-goes-well-with')).toBeNull();
  });
});
