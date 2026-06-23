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
  try { localStorage.clear(); } catch { /* ignore */ }
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
    // Page 0 Overview, page 1 Flavor map; two pages to the strongest axis (sweet).
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByText('Sweet')).toBeInTheDocument();
    expect(screen.getByText(/Driven by:/)).toBeInTheDocument();
  });

  it('renders the Overview flavor bar chart on page 0', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    expect(screen.getByTestId('profiles-overview')).toBeInTheDocument();
    const bars = screen.getAllByTestId('overview-bar');
    // sweet (honey), sour (lemon), creamy/odor_fatty (butter) all fire.
    expect(bars.length).toBeGreaterThanOrEqual(3);
    expect(bars.some((b) => b.getAttribute('data-axis') === 'sweet')).toBe(true);
  });

  it('weights the Overview by entered amounts when bowlEntries is provided', () => {
    // A big pour of lemon vs a pinch of honey → sour should out-share sweet.
    const entries = [
      { ingredient: 'honey', amount: { raw: 'a pinch', qty: null, unit: 'pinch', inferred: false } },
      { ingredient: 'lemon', amount: { raw: '2 cups', qty: 2, unit: 'cup', inferred: false } },
    ];
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon']} bowlEntries={entries} nodes={nodes} />);
    expect(screen.getByText(/weighted by amount/i)).toBeInTheDocument();
    const bars = screen.getAllByTestId('overview-bar');
    // First (top) bar is the dominant axis → sour, since lemon vastly outweighs honey.
    expect(bars[0].getAttribute('data-axis')).toBe('sour');
  });

  it('renders a rule-based flavor description on the Overview page', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    const desc = screen.getByTestId('profiles-description');
    expect(desc).toBeInTheDocument();
    expect(desc.textContent).toMatch(/recipe/i);
    expect(desc.textContent).toMatch(/sweet/i); // honey-led bowl
  });

  it('exposes an Enhance page reachable from the carousel', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    fireEvent.click(screen.getByLabelText('Enhance page')); // dot for the Enhance page
    expect(screen.getByTestId('profiles-enhance')).toBeInTheDocument();
    expect(screen.getByText('Enhance')).toBeInTheDocument();
    // The model pool doesn't load in jsdom → the empty-state hint is shown.
    expect(screen.getByText(/suggestions appear here/i)).toBeInTheDocument();
  });

  it('renders the Flavor map on page 1 with one dot per ingredient that has gnnProbs', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter', 'mystery']} nodes={nodes} />);
    fireEvent.click(screen.getByLabelText('Next')); // Overview → Flavor map
    const map = screen.getByTestId('flavor-map-radar');
    expect(map).toBeInTheDocument();
    // honey/lemon/butter have probs; mystery has none → 3 plotted ingredients.
    const ings = screen.getAllByTestId('flavor-map-ingredient');
    expect(ings.length).toBe(3);
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
    expect(dots.length).toBe(7); // Overview + Flavor map + 3 firing axes + Enhance + Pairings
    // dot[0] → Overview
    fireEvent.click(dots[0]);
    expect(screen.getByTestId('profiles-overview')).toBeInTheDocument();
    // dot[1] → Flavor map
    fireEvent.click(dots[1]);
    expect(screen.getByTestId('flavor-map-radar')).toBeInTheDocument();
    // dot[5] → Enhance page
    fireEvent.click(dots[5]);
    expect(screen.getByTestId('profiles-enhance')).toBeInTheDocument();
    // dot[6] (last) → Pairings page
    fireEvent.click(dots[6]);
    expect(screen.getByText('Pairs well with')).toBeInTheDocument();
    // swipe right (dx > 0) → previous page, leaving Pairings
    const card = screen.getByTestId('flavor-profiles-card');
    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 50 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 200, clientY: 55 }] });
    expect(screen.queryByText('Pairs well with')).not.toBeInTheDocument();
  });

  it('shows a help bubble explaining the carousel (HELP-5)', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    expect(screen.queryByTestId('profiles-help-popover')).toBeNull();
    fireEvent.click(screen.getByTestId('profiles-help'));
    const pop = screen.getByTestId('profiles-help-popover');
    expect(pop).toHaveTextContent(/swipe/i);
    expect(pop).toHaveTextContent(/Boost or Temper/i);
  });

  it('shows a first-open swipe hint, then retires it after navigation + on later opens (HELP-5)', () => {
    const { unmount } = render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    expect(screen.getByTestId('profiles-swipe-hint')).toBeInTheDocument();
    // Navigating dismisses the hint and persists the seen flag.
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.queryByTestId('profiles-swipe-hint')).toBeNull();
    unmount();
    // A later open does not show it again.
    render(<RecipeFlavorProfilesCard bowlNames={['honey', 'lemon', 'butter']} nodes={nodes} />);
    expect(screen.queryByTestId('profiles-swipe-hint')).toBeNull();
  });
});
