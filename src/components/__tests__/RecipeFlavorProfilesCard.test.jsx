import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('shows aroma-matched cocktail + sauce names on the Pairings page', async () => {
    global.fetch = vi.fn((url) => {
      const u = String(url);
      if (u.includes('cocktail_codex_v2')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ cocktails: [{ name: 'Negroni', ingredients_raw: ['gin'] }] }) });
      }
      if (u.includes('sauce_augment')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ sauces: [{ name: 'Marinara', ingredients: [{ name: 'tomato' }] }] }) });
      }
      return Promise.resolve({ ok: false });
    });
    const richNodes = nodesFrom({
      honey: probs({ sweet: 0.9, odor_fruity: 0.4 }),
      butter: probs({ odor_fatty: 0.6 }),
      gin: probs({ odor_woody: 0.5 }),
      tomato: probs({ odor_green: 0.5 }),
    });
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'butter']} nodes={richNodes} recipeType="main" onFindCocktail={vi.fn()} onFindSauce={vi.fn()} />);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('Next')); // → Pairings page
    await waitFor(() => expect(screen.getByTestId('pairings-cocktail-names')).toBeInTheDocument());
    expect(screen.getByText('Negroni')).toBeInTheDocument();
    expect(screen.getByTestId('pairings-sauce-names')).toBeInTheDocument();
    expect(screen.getByText('Marinara')).toBeInTheDocument();
  });

  it('falls back to Find cocktails/sauces buttons when no aroma matches', async () => {
    // beforeEach fetch returns ok:false → no cocktail/sauce data → fallback.
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'butter']} nodes={nodes} recipeType="main" onFindCocktail={vi.fn()} onFindSauce={vi.fn()} />);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('Next'));
    await waitFor(() => expect(screen.getByText('🍸 Find cocktails')).toBeInTheDocument());
    expect(screen.getByText('🥣 Find sauces')).toBeInTheDocument();
  });

  it('hides the sauce pairing entirely for drink recipes (gate)', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'butter']} nodes={nodes} recipeType="drink" onFindCocktail={vi.fn()} onFindSauce={vi.fn()} />);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.queryByText('🥣 Sauces')).not.toBeInTheDocument();
  });

  it('renders page-indicator dots and navigates via dot tap + touch-swipe', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    const dots = screen.getByTestId('profiles-page-dots').querySelectorAll('[role="tab"]');
    expect(dots.length).toBe(4); // 3 firing axes + Pairings
    // tap the last dot → Pairings page
    fireEvent.click(dots[3]);
    expect(screen.getByText('Pairs well with')).toBeInTheDocument();
    // swipe right (dx > 0) → previous page, leaving Pairings
    const card = screen.getByTestId('flavor-profiles-card');
    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 50 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 200, clientY: 55 }] });
    expect(screen.queryByText('Pairs well with')).not.toBeInTheDocument();
  });
});
