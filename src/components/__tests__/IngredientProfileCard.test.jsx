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

  it('renders separate taste + aroma radars, each with before + after polygons', () => {
    const { container } = render(
      <IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="add" onCommit={vi.fn()} />,
    );
    // taste radar
    expect(container.querySelector('[data-testid="ingredient-card-radar-taste"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ingredient-card-radar-taste-before"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ingredient-card-radar-taste-after"]')).toBeInTheDocument();
    // aroma radar
    expect(container.querySelector('[data-testid="ingredient-card-radar-aroma"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ingredient-card-radar-aroma-before"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="ingredient-card-radar-aroma-after"]')).toBeInTheDocument();
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

  it('renders a delta caption from movers', () => {
    render(<IngredientProfileCard name="cinnamon" before={before} delta={delta} movers={movers} mode="add" onCommit={vi.fn()} />);
    const caption = screen.getByTestId('ingredient-card-caption');
    expect(caption).toHaveTextContent('adds');
    expect(caption).toHaveTextContent('tempers');
  });

  it('renders an empty placeholder when name is missing', () => {
    render(<IngredientProfileCard name={null} before={before} delta={delta} movers={movers} onCommit={vi.fn()} />);
    expect(screen.getByTestId('ingredient-card-empty')).toBeInTheDocument();
  });
});
