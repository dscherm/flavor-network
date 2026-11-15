import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import RecipeFlavorProfilesCard from '../RecipeFlavorProfilesCard.jsx';
import { AXES } from '../../data/recipeProfileAnalysis.js';

const z = () => Object.fromEntries(AXES.map((a) => [a, 0]));
const probs = (o) => ({ ...z(), ...o });
// (Fixture names are NOT in the FLAVOR-4 strength table, so these tests exercise the label path for TASTE.
// AROMA comes from the FLAVOR-5 aroma table by name: strawberry and cranberry are fruity, coconut cream is fatty
// and fruity, none of them has a taste line. The model's values (gnnProbs) are never read.)
// A value is a curated taste label; a second array element is ignored (kept so old fixtures read the same).
function nodesFrom(map) {
  return new Map(Object.entries(map).map(([k, v]) => {
    const [taste] = Array.isArray(v) ? v : [v];
    return [k, { taste, gnnProbs: probs({}) }];
  }));
}

beforeEach(() => {
  // directions index + recipe vocab fetches → skip gracefully
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }));
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('RecipeFlavorProfilesCard', () => {
  const nodes = nodesFrom({
    'strawberry': 'sweet',
    'cranberry': 'sour',
    'coconut cream': ['rich sweet', { odor_fatty: 0.6 }],
  });

  it('renders the static per-axis analysis (no model needed)', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    expect(screen.getByText('Flavor Profiles')).toBeInTheDocument();
    // Page 0 Overview, page 1 Flavor map; two pages to the strongest axis (sweet).
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    // strawberry and cranberry are fruity by the aroma table, which outweighs the label-derived tastes
    expect(screen.getByRole('heading', { name: /fruity/i })).toBeInTheDocument();
    expect(screen.getByText(/Driven by:/)).toBeInTheDocument();
  });

  it('renders the Overview flavor bar chart on page 0', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    expect(screen.getByTestId('profiles-overview')).toBeInTheDocument();
    const bars = screen.getAllByTestId('overview-bar');
    // sweet (honey), sour (lemon), creamy/odor_fatty (butter) all fire.
    expect(bars.length).toBeGreaterThanOrEqual(3);
    expect(bars.some((b) => b.getAttribute('data-axis') === 'sweet')).toBe(true);
  });

  it('weights the Overview by entered amounts when bowlEntries is provided', () => {
    // A big pour of lemon vs a pinch of honey → sour should out-share sweet.
    const entries = [
      { ingredient: 'strawberry', amount: { raw: 'a pinch', qty: null, unit: 'pinch', inferred: false } },
      { ingredient: 'cranberry', amount: { raw: '2 cups', qty: 2, unit: 'cup', inferred: false } },
    ];
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry']} bowlEntries={entries} nodes={nodes} />);
    expect(screen.getByText(/weighted by amount/i)).toBeInTheDocument();
    const bars = screen.getAllByTestId('overview-bar');
    // First (top) bar is the dominant axis → sour, since lemon vastly outweighs honey.
    expect(bars[0].getAttribute('data-axis')).toBe('sour');
  });

  it('renders a rule-based flavor description on the Overview page', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    const desc = screen.getByTestId('profiles-description');
    expect(desc).toBeInTheDocument();
    expect(desc.textContent).toMatch(/recipe/i);
    expect(desc.textContent).toMatch(/sweet/i); // honey-led bowl
  });

  it('exposes an Enhance page reachable from the carousel', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    fireEvent.click(screen.getByLabelText('Enhance page')); // dot for the Enhance page
    expect(screen.getByTestId('profiles-enhance')).toBeInTheDocument();
    expect(screen.getByText('Enhance')).toBeInTheDocument();
    // The model pool doesn't load in jsdom → the empty-state hint is shown.
    expect(screen.getByText(/suggestions appear here/i)).toBeInTheDocument();
  });

  it('renders the Flavor map on page 1 with one dot per ingredient that has gnnProbs', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream', 'mystery']} nodes={nodes} />);
    fireEvent.click(screen.getByLabelText('Next')); // Overview → Flavor map
    const map = screen.getByTestId('flavor-map-radar');
    expect(map).toBeInTheDocument();
    // honey/lemon/butter have probs; mystery has none → 3 plotted ingredients.
    const ings = screen.getAllByTestId('flavor-map-ingredient');
    expect(ings.length).toBe(3);
  });

  it('shows an empty hint when no ingredient has flavor data', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['mystery']} nodes={nodesFrom({})} />);
    expect(screen.getByText('Not enough flavor data for a chart yet.')).toBeInTheDocument();
  });

  it('a recipe whose ingredients have no taste label, no taste line and no aroma line draws no chart and shows the plain line', () => {
    const names = ['zzz one', 'zzz two', 'zzz three', 'zzz four'];
    render(<RecipeFlavorProfilesCard bowlNames={names} nodes={new Map(names.map((k) => [k, {}]))} />);
    expect(screen.getByTestId('profiles-no-chart')).toHaveTextContent('Not enough flavor data for a chart yet.');
    expect(screen.queryByTestId('profiles-overview')).toBeNull();
    expect(screen.queryAllByTestId('overview-bar')).toHaveLength(0);
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.queryByTestId('flavor-map-radar')).toBeNull();
    expect(screen.getByTestId('profiles-no-chart')).toBeInTheDocument();
  });

  it('the same ingredients with their curated taste labels DO chart, sugar sweet, lemon sour and coffee bitter', () => {
    const labels = JSON.parse(readFileSync('public/proDataset/taste_labels.json', 'utf8'));
    const names = ['sugar', 'salt', 'coffee', 'lemon'];
    const withLabels = new Map(names.map((k) => [k, { taste: labels[k] }]));
    render(<RecipeFlavorProfilesCard bowlNames={names} nodes={withLabels} />);
    expect(screen.queryByTestId('profiles-no-chart')).toBeNull();
    const axes = screen.getAllByTestId('overview-bar').map((b) => b.getAttribute('data-axis'));
    for (const a of ['sweet', 'salty', 'bitter']) expect(axes).toContain(a);
  });

  it('charts Heat for a recipe with chili: labelled Heat, with its own colour, and a page of its own', () => {
    const heatNodes = nodesFrom({ chili: 'spicy pungent', lime: 'sour', salt: 'salty' });
    render(<RecipeFlavorProfilesCard bowlNames={['chili', 'lime', 'salt']} nodes={heatNodes} />);
    const bars = screen.getAllByTestId('overview-bar');
    const heat = bars.find((b) => b.getAttribute('data-axis') === 'heat');
    expect(heat).toBeTruthy();
    expect(heat).toHaveTextContent('Heat');
    const tasteBars = bars.filter((b) => !b.getAttribute('data-axis').startsWith('odor_'));
    expect(tasteBars[0].getAttribute('data-axis')).toBe('heat'); // chili's heat beats lime's sour and the salt on equal footing
    expect(heat.querySelectorAll('div')[1].style.background).toMatch(/rgb\(255, 68, 68\)|#ff4444/i);
    for (let i = 0; i < 10 && !screen.queryByRole('heading', { name: 'Heat' }); i++) fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByRole('heading', { name: 'Heat' })).toBeInTheDocument();
  });

  it('a recipe of only neutral ingredients shows the plain line and does not crash', () => {
    const water = new Map(['water', 'ice', 'flour'].map((k) => [k, { taste: 'neutral' }]));
    render(<RecipeFlavorProfilesCard bowlNames={['water', 'ice', 'flour']} nodes={water} />);
    expect(screen.getByTestId('profiles-no-chart')).toHaveTextContent('Not enough flavor data for a chart yet.');
    fireEvent.click(screen.getByLabelText('Next'));
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.getByTestId('flavor-profiles-card')).toBeInTheDocument();
  });

  it('calls onClose when the × is tapped', () => {
    const onClose = vi.fn();
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry']} nodes={nodes} onClose={onClose} />);
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
      'strawberry': ['sweet', { odor_fruity: 0.4 }],
      'coconut cream': ['rich', { odor_fatty: 0.6 }],
      gin: ['bitter', { odor_woody: 0.5 }],
      tomato: ['sweet sour umami', { odor_green: 0.5 }],
    });
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'coconut cream']} nodes={richNodes} recipeType="main" onFindCocktail={vi.fn()} onFindSauce={vi.fn()} />);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('Next')); // → Pairings page
    await waitFor(() => expect(screen.getByTestId('pairings-cocktail-names')).toBeInTheDocument());
    expect(screen.getByText('Negroni')).toBeInTheDocument();
    expect(screen.getByTestId('pairings-sauce-names')).toBeInTheDocument();
    expect(screen.getByText('Marinara')).toBeInTheDocument();
  });

  it('ranks Pairings by ingredient co-occurrence when pairing edges are passed', async () => {
    global.fetch = vi.fn((url) => {
      const u = String(url);
      if (u.includes('cocktail_codex_v2')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ cocktails: [
          { name: 'Gin Fizz', ingredients_raw: ['gin', 'lemon'] },
          { name: 'Honey Toddy', ingredients_raw: ['whiskey', 'honey', 'lemon'] },
        ] }) });
      }
      if (u.includes('sauce_augment')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ sauces: [] }) });
      return Promise.resolve({ ok: false });
    });
    const pairNodes = nodesFrom({
      honey: 'sweet', butter: ['rich', { odor_fatty: 0.6 }],
      gin: 'bitter', lemon: 'sour', whiskey: 'bitter sweet',
    });
    const edges = [
      { source: 'butter', target: 'whiskey', strength: 0.9, known: true },
      { source: 'gin', target: 'lemon', strength: 0.9, known: true },
    ];
    // The card caches the cocktail list at module level; load a fresh copy
    // so this test sees its own fixture, not an earlier test's.
    vi.resetModules();
    const { default: FreshCard } = await import('../RecipeFlavorProfilesCard.jsx');
    render(<FreshCard bowlNames={['honey', 'butter']} nodes={pairNodes} edges={edges} recipeType="drink" onFindCocktail={vi.fn()} />);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('Next'));
    await waitFor(() => expect(screen.getByTestId('pairings-cocktail-names')).toBeInTheDocument());
    const names = screen.getByTestId('pairings-cocktail-names').textContent;
    // Honey Toddy shares honey and its whiskey pairs with butter; Gin Fizz pairs with nothing in the bowl.
    expect(names.indexOf('Honey Toddy')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('Gin Fizz') === -1 || names.indexOf('Honey Toddy') < names.indexOf('Gin Fizz')).toBe(true);
  });

  it('falls back to Find cocktails/sauces buttons when no aroma matches', async () => {
    // beforeEach fetch returns ok:false → no cocktail/sauce data → fallback.
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'coconut cream']} nodes={nodes} recipeType="main" onFindCocktail={vi.fn()} onFindSauce={vi.fn()} />);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('Next'));
    await waitFor(() => expect(screen.getByText('🍸 Find cocktails')).toBeInTheDocument());
    expect(screen.getByText('🥣 Find sauces')).toBeInTheDocument();
  });

  it('hides the sauce pairing entirely for drink recipes (gate)', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'coconut cream']} nodes={nodes} recipeType="drink" onFindCocktail={vi.fn()} onFindSauce={vi.fn()} />);
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.queryByText('🥣 Sauces')).not.toBeInTheDocument();
  });

  it('renders page-indicator dots and navigates via dot tap + touch-swipe', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    const dots = screen.getByTestId('profiles-page-dots').querySelectorAll('[role="tab"]');
    expect(dots.length).toBe(8); // Overview + Flavor map + 4 firing axes (sweet, sour, fruity, fatty) + Enhance + Pairings
    // dot[0] → Overview
    fireEvent.click(dots[0]);
    expect(screen.getByTestId('profiles-overview')).toBeInTheDocument();
    // dot[1] → Flavor map
    fireEvent.click(dots[1]);
    expect(screen.getByTestId('flavor-map-radar')).toBeInTheDocument();
    // dot[6] → Enhance page
    fireEvent.click(dots[6]);
    expect(screen.getByTestId('profiles-enhance')).toBeInTheDocument();
    // dot[7] (last) → Pairings page
    fireEvent.click(dots[7]);
    expect(screen.getByText('Pairs well with')).toBeInTheDocument();
    // drag right (dx > 0) → previous page, leaving Pairings (pointer = mouse OR touch)
    const card = screen.getByTestId('flavor-profiles-card');
    fireEvent.pointerDown(card, { clientX: 100, clientY: 50 });
    fireEvent.pointerUp(card, { clientX: 200, clientY: 55 });
    expect(screen.queryByText('Pairs well with')).not.toBeInTheDocument();
  });

  it('shows a help bubble explaining the carousel (HELP-5)', () => {
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    expect(screen.queryByTestId('profiles-help-popover')).toBeNull();
    fireEvent.click(screen.getByTestId('profiles-help'));
    const pop = screen.getByTestId('profiles-help-popover');
    expect(pop).toHaveTextContent(/swipe/i);
    expect(pop).toHaveTextContent(/Boost or Temper/i);
  });

  it('shows a first-open swipe hint, then retires it after navigation + on later opens (HELP-5)', () => {
    const { unmount } = render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    expect(screen.getByTestId('profiles-swipe-hint')).toBeInTheDocument();
    // Navigating dismisses the hint and persists the seen flag.
    fireEvent.click(screen.getByLabelText('Next'));
    expect(screen.queryByTestId('profiles-swipe-hint')).toBeNull();
    unmount();
    // A later open does not show it again.
    render(<RecipeFlavorProfilesCard bowlNames={['strawberry', 'cranberry', 'coconut cream']} nodes={nodes} />);
    expect(screen.queryByTestId('profiles-swipe-hint')).toBeNull();
  });
});
