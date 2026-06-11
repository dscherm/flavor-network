import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RecipeDirections from '../RecipeDirections.jsx';

vi.mock('../../ml/directionsRuntime.js', () => ({
  loadDirectionsIndex: vi.fn(() => Promise.resolve({ recipes: [], inv: {} })),
  retrieveDirections: vi.fn(() => [{
    title: 'Test Cake',
    steps: ['Mix the batter.', 'Bake at 350.'],
    overlap: 3,
    jaccard: 0.8,
    matchedNames: ['flour', 'sugar', 'egg'],
    bowlIds: [],
  }]),
}));

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ vocab: ['flour', 'sugar', 'egg'] }),
  }));
});

describe('RecipeDirections', () => {
  it('renders nothing below the minimum bowl size', () => {
    const { container } = render(<RecipeDirections bowlNames={['flour', 'sugar']} />);
    expect(container.textContent).toBe('');
  });

  it('shows grounded directions + provenance for a full bowl', async () => {
    render(<RecipeDirections bowlNames={['flour', 'sugar', 'egg']} />);
    await waitFor(() => expect(screen.getByText(/Test Cake/)).toBeInTheDocument());
    expect(screen.getByText('Mix the batter.')).toBeInTheDocument();
    expect(screen.getByText('Bake at 350.')).toBeInTheDocument();
    // Provenance names the matched ingredients.
    expect(screen.getByText(/matches 3 of your ingredients/)).toBeInTheDocument();
  });

  it('is null-safe when bowlNames is empty', () => {
    const { container } = render(<RecipeDirections bowlNames={[]} />);
    expect(container.textContent).toBe('');
  });
});
