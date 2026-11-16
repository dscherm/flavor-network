import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import IngredientProfileCard from '../IngredientProfileCard.jsx';
import { AXES } from '../../data/recipeProfileAnalysis.js';

const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const probs = (o) => ({ ...z(), ...o });

const before = probs({ sweet: 0.4, sour: 0.2 });
const delta = { ...z(), odor_spicy: 0.3, sweet: -0.1 };
const movers = [
  { axis: 'odor_spicy', delta: 0.3 },
  { axis: 'sweet', delta: -0.1 },
];

describe('IngredientProfileCard', () => {
  it('renders the ingredient name', () => {
    render(<IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="add" onCommit={vi.fn()} />);
    expect(screen.getByTestId('ingredient-card-name')).toHaveTextContent('cinnamon');
  });

  it('renders a before and an after fixed grid of seventeen cells each, in the same order', () => {
    const { container } = render(
      <IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="add" onCommit={vi.fn()} />,
    );
    const cellsOf = (id) => [...container.querySelectorAll(`[data-testid="${id}"] [data-testid="flavor-grid-cell"]`)];
    const b = cellsOf('ingredient-card-grid-before');
    const a = cellsOf('ingredient-card-grid-after');
    expect(b).toHaveLength(17);
    expect(a.map((c) => c.dataset.axis)).toEqual(b.map((c) => c.dataset.axis));
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getByText('With cinnamon')).toBeInTheDocument();
    expect(container.querySelector('polygon[data-testid]')).toBeNull();
  });

  it('swap mode titles the after grid "With <new> for <old>"', () => {
    render(<IngredientProfileCard name="cinnamon" replacing="ginger" before={before} delta={delta} movers={movers} mode="replace" onCommit={vi.fn()} />);
    expect(screen.getByText('With cinnamon for ginger')).toBeInTheDocument();
  });

  it('shows "+ Add" in add mode', () => {
    render(<IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="add" onCommit={vi.fn()} />);
    expect(screen.getByTestId('deck-commit')).toHaveTextContent('+ Add');
  });

  it('shows "Swap" in replace mode', () => {
    render(<IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="replace" onCommit={vi.fn()} />);
    expect(screen.getByTestId('deck-commit')).toHaveTextContent('Swap');
  });

  it('calls onCommit when the pill is clicked', () => {
    const onCommit = vi.fn();
    render(<IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="add" onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('deck-commit'));
    expect(onCommit).toHaveBeenCalled();
  });

  it('names the two notes that move most in the caption, which labels the pair', () => {
    render(<IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="add" onCommit={vi.fn()} />);
    expect(screen.getByTestId('ingredient-card-caption')).toHaveTextContent('More spice, less sweet');
    expect(screen.getByTestId('ingredient-card-pair')).toHaveAttribute('aria-labelledby', 'ingredient-card-caption');
  });

  it('renders an empty placeholder when name is missing', () => {
    render(<IngredientProfileCard name={null} before={before} delta={delta} movers={movers} onCommit={vi.fn()} />);
    expect(screen.getByTestId('ingredient-card-empty')).toBeInTheDocument();
  });
});
