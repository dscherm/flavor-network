// @vitest-environment jsdom
// DESIGN-4 "chalk frame, paper page": the Recipe Notebook sits on the
// chalkboard, opens to a starter state, and keeps every chrome button.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import RecipeLabMobile from '../RecipeLabMobile.jsx';
import { IngredientArt, ingredientArtKind } from '../chalkArt.jsx';

function buildFullData() {
  const spec = [
    ['tomato', 'vegetable', 40],
    ['carrot', 'vegetable', 10],
    ['garlic', 'aromatic', 50],
    ['basil', 'herb', 30],
    ['chicken', 'protein', 60],
    ['sugar', 'sweetener', 99],
    ['olive oil', 'fat', 90],
  ];
  const nodes = new Map(spec.map(([name, category, pairingCount]) => [
    name, { name, category, pairingCount, taste: 'umami' },
  ]));
  const ingredientList = spec.map(([n]) => n);
  const edges = [];
  for (let i = 0; i < ingredientList.length; i++) {
    for (let j = i + 1; j < ingredientList.length; j++) {
      edges.push({ source: ingredientList[i], target: ingredientList[j], strength: 0.5 });
    }
  }
  return { graph: { nodes, edges, ingredientList }, cuisineNeighborIndex: null };
}

beforeEach(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
});

describe('RecipeLabMobile — starter state (empty bowl)', () => {
  it('shows three chalk starter ingredients from the graph, one per starter category', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    const starter = screen.getByTestId('notebook-starter');
    expect(within(starter).getByRole('heading', { name: /start with/i })).toBeInTheDocument();
    // vegetable → tomato (more pairings than carrot), aromatic → garlic, herb → basil
    expect(screen.getByTestId('notebook-starter-tomato')).toBeInTheDocument();
    expect(screen.getByTestId('notebook-starter-garlic')).toBeInTheDocument();
    expect(screen.getByTestId('notebook-starter-basil')).toBeInTheDocument();
    expect(within(starter).getAllByRole('button', { name: /^Add .* to the recipe$/ })).toHaveLength(3);
    // pantry staples are not offered as a start
    expect(screen.queryByTestId('notebook-starter-sugar')).toBeNull();
    // drawings are decorative
    for (const svg of within(starter).getAllByTestId('ingredient-art')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('tapping a starter adds it to the bowl and the starter state goes away', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add garlic to the recipe' }));
    expect(screen.getByTestId('notebook-row-garlic')).toBeInTheDocument();
    expect(screen.queryByTestId('notebook-starter')).toBeNull();
    expect(screen.getByText('1 ingredient')).toBeInTheDocument();
  });

  it('"or open a Cookbook recipe" calls onOpenCookbook', () => {
    const onOpenCookbook = vi.fn();
    render(<RecipeLabMobile fullData={buildFullData()} onOpenCookbook={onOpenCookbook} />);
    fireEvent.click(screen.getByRole('button', { name: /or open a cookbook recipe/i }));
    expect(onOpenCookbook).toHaveBeenCalledTimes(1);
  });

  it('hides the cookbook link when no route is wired', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    expect(screen.queryByTestId('notebook-starter-cookbook')).toBeNull();
  });

  it('still renders (cookbook link only) before the graph has loaded', () => {
    render(<RecipeLabMobile fullData={null} onOpenCookbook={() => {}} />);
    expect(screen.getByTestId('notebook-starter')).toBeInTheDocument();
    expect(screen.getByTestId('notebook-starter-cookbook')).toBeInTheDocument();
  });
});

describe('RecipeLabMobile — chalk frame around a paper page', () => {
  it('the frame is the chalk surface and the page is a separate paper sheet', () => {
    render(<RecipeLabMobile fullData={buildFullData()} initialIngredients={['tomato']} />);
    const lab = screen.getByTestId('recipe-lab');
    expect(lab.getAttribute('data-surface')).toBe('chalk-frame');
    expect(lab.style.backgroundColor).toBe('rgb(10, 10, 10)');
    expect(screen.getByTestId('notebook-paper')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recipe Notebook' })).toBeInTheDocument();
  });

  it('with ingredients, the chrome keeps Suggest / Amounts / Flavor Profiles / + Add / Save / Clear', () => {
    render(
      <RecipeLabMobile
        fullData={buildFullData()}
        initialIngredients={['tomato', 'garlic', 'basil', 'chicken', 'carrot']}
      />,
    );
    const toolbar = screen.getByRole('toolbar', { name: /recipe tools/i });
    expect(within(toolbar).getByTestId('recipe-chrome-suggestions')).toBeInTheDocument();
    expect(within(toolbar).getByTestId('recipe-chrome-quantities')).toBeInTheDocument();
    expect(within(toolbar).getByTestId('recipe-chrome-profiles')).toBeInTheDocument();
    expect(within(toolbar).getByTestId('recipe-chrome-add-ingredient')).toBeInTheDocument();
    expect(screen.getByLabelText(/save recipe to profile/i)).not.toBeDisabled();
    expect(screen.getByText(/^Clear$/)).not.toBeDisabled();
    expect(screen.queryByTestId('notebook-starter')).toBeNull();
  });

  it('empty bowl: only + Add in the toolbar; Save and Clear disabled', () => {
    render(<RecipeLabMobile fullData={buildFullData()} />);
    expect(screen.getByTestId('recipe-chrome-add-ingredient')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-chrome-suggestions')).toBeNull();
    expect(screen.getByLabelText(/save recipe to profile/i)).toBeDisabled();
    expect(screen.getByText(/^Clear$/)).toBeDisabled();
  });

  it('Flavor Profiles still opens its overlay', () => {
    render(<RecipeLabMobile fullData={buildFullData()} initialIngredients={['tomato', 'basil']} />);
    fireEvent.click(screen.getByTestId('recipe-chrome-profiles'));
    expect(screen.getByTestId('recipe-profiles-overlay')).toBeInTheDocument();
  });

  it('each ingredient row on the paper carries its category drawing', () => {
    render(<RecipeLabMobile fullData={buildFullData()} initialIngredients={['basil', 'chicken']} />);
    const basilArt = within(screen.getByTestId('notebook-row-basil')).getByTestId('ingredient-art');
    expect(basilArt.getAttribute('data-kind')).toBe('leaf');
    expect(basilArt.getAttribute('aria-hidden')).toBe('true');
    const chickenArt = within(screen.getByTestId('notebook-row-chicken')).getByTestId('ingredient-art');
    expect(chickenArt.getAttribute('data-kind')).toBe('drumstick');
  });
});

describe('IngredientArt', () => {
  it('maps categories to drawings, falling back to a bowl', () => {
    expect(ingredientArtKind('herb')).toBe('leaf');
    expect(ingredientArtKind('liquid')).toBe('drop');
    expect(ingredientArtKind('chili')).toBe('pepper');
    expect(ingredientArtKind('spice')).toBe('pepper');
    expect(ingredientArtKind('Citrus')).toBe('citrus');
    expect(ingredientArtKind(null)).toBe('bowl');
    expect(ingredientArtKind('mystery')).toBe('bowl');
  });

  it('renders an aria-hidden svg', () => {
    const { container } = render(<IngredientArt category="herb" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('24');
  });
});

describe('ingredient drawings by name', () => {
  it('a few common ingredients get their own drawing ahead of the category', () => {
    expect(ingredientArtKind('vegetable', 'tomato')).toBe('tomato');
    expect(ingredientArtKind('vegetable', 'cherry tomatoes')).toBe('tomato');
    expect(ingredientArtKind('vegetable', 'potato')).toBe('potato');
    expect(ingredientArtKind('aromatic', 'red onion')).toBe('bulb');
    expect(ingredientArtKind('vegetable', 'bell pepper')).toBe('pepper');
    expect(ingredientArtKind('vegetable', 'carrot')).toBe('carrot');
  });
  it('other vegetables are broccoli, not a carrot; processed forms keep their category', () => {
    expect(ingredientArtKind('vegetable', 'zucchini')).toBe('broccoli');
    expect(ingredientArtKind('condiment', 'tomato paste')).toBe('bottle');
    expect(ingredientArtKind('herb', 'peppermint')).toBe('leaf');
  });
});
