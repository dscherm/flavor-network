// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import MakeRecipeCardsGrid from '../MakeRecipeCardsGrid.jsx';
import MakeRecipeView from '../MakeRecipeView.jsx';

vi.mock('../IngredientPicker.jsx', () => ({
  __esModule: true,
  default: function StubPicker({ onSelect }) {
    return (
      <div data-testid="picker-stub">
        <button
          type="button"
          data-testid="picker-stub-pick-basil"
          onClick={() => onSelect?.('basil')}
        >
          pick basil
        </button>
      </div>
    );
  },
}));
vi.mock('../CocktailLabV2.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="cocktail-lab-stub" />,
}));
vi.mock('../SauceLab.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="sauce-lab-stub" />,
}));

function buildData() {
  const nodes = new Map([
    ['basil', { name: 'basil', cluster: 0, cuisines: ['Italian'] }],
    ['lemon', { name: 'lemon', cluster: 1, cuisines: ['Mediterranean'] }],
    ['garlic', { name: 'garlic', cluster: 2, cuisines: ['Italian', 'Mediterranean'] }],
  ]);
  return { graph: { nodes, edges: [] } };
}

describe('MakeRecipeCardsGrid', () => {
  it('renders empty state when no ingredients', () => {
    render(<MakeRecipeCardsGrid ingredients={[]} nodes={null} />);
    expect(screen.getByTestId('make-recipe-empty')).toBeInTheDocument();
  });

  it('renders one card per ingredient', () => {
    render(
      <MakeRecipeCardsGrid
        ingredients={['basil', 'lemon']}
        nodes={buildData().graph.nodes}
      />,
    );
    expect(screen.getByTestId('make-recipe-card-basil')).toBeInTheDocument();
    expect(screen.getByTestId('make-recipe-card-lemon')).toBeInTheDocument();
    expect(screen.getByTestId('make-recipe-cards-grid').getAttribute('data-count')).toBe('2');
  });

  it('card tap fires onCardTap with name', () => {
    const onCardTap = vi.fn();
    render(
      <MakeRecipeCardsGrid
        ingredients={['basil']}
        nodes={buildData().graph.nodes}
        onCardTap={onCardTap}
      />,
    );
    fireEvent.click(screen.getByTestId('make-recipe-card-basil'));
    expect(onCardTap).toHaveBeenCalledWith('basil');
  });

  it('remove button fires onRemove without triggering onCardTap', () => {
    const onCardTap = vi.fn();
    const onRemove = vi.fn();
    render(
      <MakeRecipeCardsGrid
        ingredients={['basil']}
        nodes={buildData().graph.nodes}
        onCardTap={onCardTap}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByTestId('make-recipe-remove-basil'));
    expect(onRemove).toHaveBeenCalledWith('basil');
    expect(onCardTap).not.toHaveBeenCalled();
  });
});

describe('MakeRecipeView', () => {
  it('defaults to cards-grid body (no dish-type)', () => {
    render(<MakeRecipeView data={buildData()} initialIngredients={['basil']} />);
    expect(screen.getByTestId('make-recipe-cards-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('cocktail-lab-stub')).toBeNull();
    expect(screen.queryByTestId('sauce-lab-stub')).toBeNull();
  });

  it('renders cocktail variant when dish-type = drink', () => {
    render(<MakeRecipeView data={buildData()} initialDishType="drink" />);
    expect(screen.getByTestId('make-recipe-cocktail-variant')).toBeInTheDocument();
  });

  it('renders sauce variant when dish-type = sauce', () => {
    render(<MakeRecipeView data={buildData()} initialDishType="sauce" />);
    expect(screen.getByTestId('make-recipe-sauce-variant')).toBeInTheDocument();
  });

  it('"+ Add" opens picker modal; picker pick adds to grid', () => {
    render(<MakeRecipeView data={buildData()} />);
    fireEvent.click(screen.getByTestId('make-recipe-add'));
    expect(screen.getByTestId('make-recipe-picker-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('picker-stub-pick-basil'));
    expect(screen.getByTestId('make-recipe-card-basil')).toBeInTheDocument();
  });

  it('menu opens "Save to Notebook" + "Examine in Network" stubs', () => {
    const onSave = vi.fn();
    const onTour = vi.fn();
    render(
      <MakeRecipeView
        data={buildData()}
        initialIngredients={['basil']}
        onSaveToNotebook={onSave}
        onExamineInNetwork={onTour}
      />,
    );
    fireEvent.click(screen.getByTestId('make-recipe-menu'));
    const popover = screen.getByTestId('make-recipe-menu-popover');
    fireEvent.click(within(popover).getByTestId('make-recipe-menu-save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      ingredients: ['basil'],
    }));
    fireEvent.click(screen.getByTestId('make-recipe-menu'));
    const popover2 = screen.getByTestId('make-recipe-menu-popover');
    fireEvent.click(within(popover2).getByTestId('make-recipe-menu-tour'));
    expect(onTour).toHaveBeenCalled();
  });

  it('card tap forwards to onCardTap', () => {
    const onCardTap = vi.fn();
    render(
      <MakeRecipeView
        data={buildData()}
        initialIngredients={['lemon']}
        onCardTap={onCardTap}
      />,
    );
    fireEvent.click(screen.getByTestId('make-recipe-card-lemon'));
    expect(onCardTap).toHaveBeenCalledWith('lemon');
  });

  it('portion card renders under each ingredient', () => {
    render(<MakeRecipeView data={buildData()} initialIngredients={['basil', 'lemon']} />);
    expect(screen.getByTestId('make-recipe-portion-basil')).toBeInTheDocument();
    expect(screen.getByTestId('make-recipe-portion-lemon')).toBeInTheDocument();
  });

  it('portion input updates per-ingredient state', () => {
    render(<MakeRecipeView data={buildData()} initialIngredients={['basil']} />);
    const input = screen.getByTestId('make-recipe-portion-input-basil');
    fireEvent.change(input, { target: { value: '2 tbsp' } });
    expect(input.value).toBe('2 tbsp');
  });

  it('Suggest button label = "Choose more ingredients" when count < 3, disabled', () => {
    render(<MakeRecipeView data={buildData()} initialIngredients={['basil', 'lemon']} />);
    const btn = screen.getByTestId('make-recipe-suggest-basil');
    expect(btn.textContent).toContain('Choose more ingredients');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('Suggest button autofills when count >= 3', () => {
    render(<MakeRecipeView data={buildData()} initialIngredients={['basil', 'lemon', 'garlic']} />);
    const btn = screen.getByTestId('make-recipe-suggest-basil');
    expect(btn.textContent).toContain('Suggest portion');
    expect(btn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(btn);
    const input = screen.getByTestId('make-recipe-portion-input-basil');
    // basil has no category in fixture → falls back to 'to taste'.
    expect(input.value.length).toBeGreaterThan(0);
  });

  it('removing an ingredient also clears its portion', () => {
    render(<MakeRecipeView data={buildData()} initialIngredients={['basil', 'lemon', 'garlic']} />);
    fireEvent.click(screen.getByTestId('make-recipe-suggest-basil'));
    const input = screen.getByTestId('make-recipe-portion-input-basil');
    expect(input.value.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('make-recipe-remove-basil'));
    expect(screen.queryByTestId('make-recipe-portion-basil')).toBeNull();
  });
});
