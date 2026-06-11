import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RecipeFlavorProfilesCard from '../RecipeFlavorProfilesCard.jsx';
import { AXES } from '../../data/recipeProfileAnalysis.js';

const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const probs = (o) => ({ ...z(), ...o });
function nodesFrom(map) {
  return new Map(Object.entries(map).map(([k, gnnProbs]) => [k, { gnnProbs }]));
}

beforeEach(() => {
  // directions index + recipe vocab fetches → skip gracefully
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
});

describe('RecipeFlavorProfilesCard', () => {
  const nodes = nodesFrom({
    honey: probs({ sweet: 0.9 }),
    lemon: probs({ sour: 0.8 }),
    butter: probs({ odor_fatty: 0.6 }),
  });

  it('renders the static per-axis analysis (no model needed)', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    expect(screen.getByText('Flavor Profiles')).toBeInTheDocument();
    // Strongest axis (sweet, 0.30 aggregate) leads; its drivers + insight show.
    expect(screen.getByText('Sweet')).toBeInTheDocument();
    expect(screen.getByText(/Driven by:/)).toBeInTheDocument();
  });

  it('shows an empty hint when no ingredient has flavor data', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['mystery']} nodes={nodesFrom({})} />);
    expect(screen.getByText(/Add ingredients with flavor data/)).toBeInTheDocument();
  });

  it('calls onClose when the × is tapped', () => {
    const onClose = vi.fn();
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon']} nodes={nodes} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
