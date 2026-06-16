// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SauceLab from '../SauceLab.jsx';

// ── Module mocks ──────────────────────────────────────────────────────────────
// SauceLab calls loadSauceCodex() (async fetch) and mounts Three.js
// child components — all mocked so tests focus on matchesContext wiring.

vi.mock('../NetworkScene.jsx', () => ({
  default: () => <div data-testid="network-scene" />,
}));

vi.mock('../SauceDetailPanel.jsx', () => ({
  default: () => <div data-testid="sauce-detail-panel" />,
}));

vi.mock('../SauceBrowse.jsx', () => ({
  default: ({ codexData }) => (
    <div data-testid="sauce-browse">
      {[...(codexData?.graph?.nodes?.values() || [])].map((n) => (
        <div key={n.name} data-testid="browse-card">{n.name}</div>
      ))}
    </div>
  ),
}));

vi.mock('../ClusterJoystick.jsx', () => ({ default: () => null }));
vi.mock('../ShapeLegend.jsx', () => ({ default: () => null }));
vi.mock('../../three/AxisLabels.js', () => ({
  createClusterLabels: () => ({ add: () => {} }),
  createGlowSprite: () => ({}),
}));

vi.mock('../../data/sauceShapes.js', () => ({ SAUCE_SHAPE_LEGEND: [] }));

// loadSauceCodex is async; mock it to resolve immediately with a
// minimal valid shape so the component doesn't hang in loading state.
vi.mock('../../data/sauceCodex.js', () => ({
  loadSauceCodex: vi.fn().mockResolvedValue({
    nodes: new Map(),
    edges: [],
    ingredientList: [],
    ingredientToSauces: new Map(),
    codex: { clusters: [] },
  }),
  computeSauceCodexPositions: vi.fn().mockReturnValue({ positions: {} }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(name) {
  return {
    name,
    ingredients: ['tomato', 'basil', 'garlic'],
    image: `${name.toLowerCase().replace(/ /g, '-')}.jpg`,
  };
}

const FIXTURE_ITEMS = [
  { item: makeItem('Marinara'),   similarity: 0.91, matchedAromas: ['odor_fruity', 'odor_green'] },
  { item: makeItem('Béchamel'),   similarity: 0.74, matchedAromas: ['odor_fatty'] },
  { item: makeItem('Hollandaise'), similarity: 0.58, matchedAromas: ['odor_floral', 'odor_woody'] },
];

const MATCHES_CONTEXT = {
  recipeName: 'Chicken Piccata',
  items: FIXTURE_ITEMS,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SauceLab — matchesContext=null (regression)', () => {
  it('does NOT render the sauce suggestion deck', async () => {
    render(<SauceLab matchesContext={null} />);
    await vi.waitFor(() => {
      expect(screen.queryByTestId('sauce-suggestion-deck')).toBeNull();
    });
  });
});

describe('SauceLab — matchesContext non-null renders the card deck', () => {
  it('renders the SauceSuggestionDeck', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    expect(screen.getByTestId('sauce-suggestion-deck')).toBeTruthy();
  });

  it('shows one sauce card at a time with a stack size equal to the item count', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    const deck = screen.getByTestId('sauce-suggestion-deck');
    expect(deck.getAttribute('data-stack-size')).toBe('3');
    // Only the top card is rendered at a time.
    expect(screen.getAllByTestId('sauce-card')).toHaveLength(1);
  });

  it('first card shows its sauce name + "matches {recipe}" caption', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    expect(screen.getByTestId('sauce-card-name').textContent).toBe('Marinara');
    expect(screen.getByText(/matches Chicken Piccata/i)).toBeTruthy();
  });

  it('each card renders single-series taste + aroma radars (empty delta)', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    expect(screen.getByTestId('sauce-card-radar-taste')).toBeTruthy();
    expect(screen.getByTestId('sauce-card-radar-aroma')).toBeTruthy();
    // Single series: the sauce's own profile is drawn as the "before" polygon.
    // With delta={} the "after" polygon coincides with it (no separate shift).
    const before = screen.getByTestId('sauce-card-radar-taste-before');
    const after = screen.getByTestId('sauce-card-radar-taste-after');
    expect(before).toBeTruthy();
    expect(after.getAttribute('points')).toBe(before.getAttribute('points'));
  });

  it('▶ advances to the next sauce card', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    fireEvent.click(screen.getByTestId('sauce-deck-next'));
    expect(screen.getByTestId('sauce-card-name').textContent).toBe('Béchamel');
  });

  it('clicking × (close) fires onExitMatches', () => {
    const onExitMatches = vi.fn();
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={onExitMatches} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onExitMatches).toHaveBeenCalledTimes(1);
  });

  it('clicking ← Back fires onBackToRecipe', () => {
    const onBackToRecipe = vi.fn();
    render(
      <SauceLab
        matchesContext={MATCHES_CONTEXT}
        onExitMatches={() => {}}
        onBackToRecipe={onBackToRecipe}
      />,
    );
    fireEvent.click(screen.getByTestId('sauce-deck-back'));
    expect(onBackToRecipe).toHaveBeenCalledTimes(1);
  });

  it('"View sauce" selects the sauce and swaps the deck for the detail card', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    fireEvent.click(screen.getByTestId('sauce-card-view'));
    // Deck is replaced by the detail (LabNodeCard); the deck no longer renders.
    expect(screen.queryByTestId('sauce-suggestion-deck')).toBeNull();
  });
});
