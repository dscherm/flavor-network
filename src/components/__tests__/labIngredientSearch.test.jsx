// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CocktailBrowse from '../CocktailBrowse.jsx';
import SauceBrowse from '../SauceBrowse.jsx';

// ── Cocktail fixture ─────────────────────────────────────────────────
function cocktail(name, ings, extra = {}) {
  return {
    name, canonical: name.toLowerCase(), family_id: 0, subcluster_id: '0.1',
    ingredients_raw: ings.map((raw) => ({ raw })), ...extra,
  };
}
const COCKTAILS = [
  cocktail('Gimlet', ['Gin', 'Lime juice', 'Simple syrup'], { is_root: true, build_method: 'shake', ice_format: 'up' }),
  cocktail('Negroni', ['Gin', 'Campari', 'Sweet vermouth'], { build_method: 'stir', ice_format: 'rocks' }),
  cocktail('Moscow Mule', ['Vodka', 'Ginger beer', 'Lime juice'], { build_method: 'build', ice_format: 'tall' }),
];
const COCKTAIL_GRAPH = {
  families: [{ id: 0, name: 'Sours', color: '#88ccff' }],
  byFamily: new Map([[0, COCKTAILS]]),
};

function renderCocktails() {
  return render(
    <CocktailBrowse
      graph={COCKTAIL_GRAPH}
      selectedCocktail={null}
      onSelectCocktail={vi.fn()}
      filterFamily={null}
      onFilterFamily={vi.fn()}
      filterSpirit={null}
      onFilterSpirit={vi.fn()}
    />,
  );
}

const shown = (names) => names.filter((n) => screen.queryByText(n));

describe('Cocktail Lab — ingredient search', () => {
  it('shows every cocktail with no query', () => {
    renderCocktails();
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toHaveLength(3);
  });

  it('finds cocktails by ingredient, not just name', () => {
    renderCocktails();
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'lime' } });
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toEqual(['Gimlet', 'Moscow Mule']);
    expect(screen.getByText(/2 cocktails match/)).toBeInTheDocument();
    expect(screen.getAllByText('with Lime juice')).toHaveLength(2);
  });

  it('"gin" does not pull in ginger-beer drinks', () => {
    renderCocktails();
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'gin' } });
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toEqual(['Gimlet', 'Negroni']);
  });

  it('combines comma-separated ingredients with AND', () => {
    renderCocktails();
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'gin, lime' } });
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toEqual(['Gimlet']);
  });

  it('shows the empty state when nothing matches', () => {
    renderCocktails();
    fireEvent.change(screen.getByLabelText(/search cocktails/i), { target: { value: 'durian' } });
    expect(screen.getByText(/No cocktails match/)).toBeInTheDocument();
  });
});

describe('Cocktail Lab — facet chips', () => {
  // DESIGN-1: the facet rows sit behind one Filters chip.
  const openFilters = () => fireEvent.click(screen.getByTestId('cocktail-filters-toggle'));

  it('hides the facet rows behind a Filters chip that counts active filters', () => {
    renderCocktails();
    const toggle = screen.getByTestId('cocktail-filters-toggle');
    expect(screen.queryByTestId('cocktail-facet-rail')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    openFilters();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^strong/ }));
    fireEvent.click(screen.getByLabelText('No egg'));
    expect(toggle).toHaveTextContent(/Filters\s*2/);
    // Closing keeps the filters applied, and offers a way to clear them.
    openFilters();
    expect(screen.queryByTestId('cocktail-facet-rail')).toBeNull();
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toEqual(['Negroni']);
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(toggle).toHaveTextContent(/^\s*Filters\s*▾/);
  });

  it('renders the facet rail and filters by strength', () => {
    renderCocktails();
    openFilters();
    expect(screen.getByTestId('cocktail-facet-rail')).toBeInTheDocument();
    // Negroni: stirred spirit + amaro + vermouth, no sour → strong. The others are not.
    fireEvent.click(screen.getByRole('button', { name: /^strong/ }));
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toEqual(['Negroni']);
    // Clear filters restores everything.
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toHaveLength(3);
  });

  it('a chip in another group that would leave nothing is disabled, with a count of 0', () => {
    renderCocktails();
    openFilters();
    fireEvent.click(screen.getByRole('button', { name: /^light/ }));
    // Only the (strong) Negroni is a nightcap, so with "light" active the chip is dead.
    const nightcap = screen.getByRole('button', { name: /^nightcap 0/ });
    expect(nightcap).toBeDisabled();
    // Within the same single-choice group a chip shows what switching would give.
    expect(screen.getByRole('button', { name: /^strong 1/ })).toBeEnabled();
  });

  it('bubbly character picks the soda highball', () => {
    renderCocktails();
    openFilters();
    fireEvent.click(screen.getByRole('button', { name: /^bubbly/ }));
    expect(shown(['Gimlet', 'Negroni', 'Moscow Mule'])).toEqual(['Moscow Mule']);
  });
});

// ── Sauce fixture ────────────────────────────────────────────────────
function sauce(name, ingredients, extra = {}) {
  return { name, family_id: 0, cuisine: 'Italian', ingredients, ...extra };
}
const SAUCE_CODEX = {
  codex: { clusters: [{ id: 0, name: 'Tomato', color: '#e05050' }] },
  graph: {
    nodes: new Map([
      ['Marinara', sauce('Marinara', ['tomato', 'garlic', 'basil', 'olive oil'], { isRoot: true })],
      ['Arrabbiata', sauce('Arrabbiata', ['tomato', 'garlic', 'red pepper flakes'])],
      ['Pesto', sauce('Pesto', ['basil', 'pine nut', 'parmesan'])],
    ]),
  },
};

function renderSauces() {
  return render(
    <SauceBrowse
      codexData={SAUCE_CODEX}
      selectedSauce={null}
      onSelectSauce={vi.fn()}
      filterFamily={null}
      onFilterFamily={vi.fn()}
      filterCuisine={null}
      onFilterCuisine={vi.fn()}
    />,
  );
}

describe('Sauce Lab — ingredient search', () => {
  it('finds sauces by ingredient', () => {
    renderSauces();
    fireEvent.change(screen.getByLabelText(/search sauces/i), { target: { value: 'basil' } });
    expect(shown(['Marinara', 'Arrabbiata', 'Pesto'])).toEqual(['Marinara', 'Pesto']);
    expect(screen.getByText(/2 sauces match/)).toBeInTheDocument();
  });

  it('combines ingredients with AND', () => {
    renderSauces();
    fireEvent.change(screen.getByLabelText(/search sauces/i), { target: { value: 'tomato + basil' } });
    expect(shown(['Marinara', 'Arrabbiata', 'Pesto'])).toEqual(['Marinara']);
  });

  it('still matches by sauce name', () => {
    renderSauces();
    fireEvent.change(screen.getByLabelText(/search sauces/i), { target: { value: 'arrab' } });
    expect(shown(['Marinara', 'Arrabbiata', 'Pesto'])).toEqual(['Arrabbiata']);
  });
});
