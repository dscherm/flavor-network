// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  it('does NOT render a "Matches for" header chip', async () => {
    const { queryByText } = render(<SauceLab matchesContext={null} />);
    await vi.waitFor(() => {
      expect(queryByText(/Matches for/i)).toBeNull();
    });
  });
});

describe('SauceLab — matchesContext non-null', () => {
  it('renders exactly 3 cards for the 3-item fixture', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    const listItems = document.querySelectorAll('li');
    expect(listItems).toHaveLength(3);
  });

  it('shows the "Matches for Chicken Piccata" header chip', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    expect(screen.getByText('Matches for Chicken Piccata')).toBeTruthy();
  });

  it('each card has a similarity badge matching /^\\d{1,3}% match$/', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    const badges = screen.getAllByText(/^\d{1,3}% match$/);
    expect(badges).toHaveLength(3);
  });

  it('each card has at least one matched-aroma chip', () => {
    const { container } = render(
      <SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />,
    );
    const aromaChips = container.querySelectorAll('li span.rounded-full');
    expect(aromaChips.length).toBeGreaterThanOrEqual(3); // ≥1 per card
  });

  it('renders the "Show all sauces" button with the correct accessible name', () => {
    render(<SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    const btn = screen.getByRole('button', {
      name: 'Exit matches and browse all sauces',
    });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Show all sauces/i);
  });

  it('clicking "Show all sauces" fires onExitMatches', () => {
    const onExitMatches = vi.fn();
    render(
      <SauceLab matchesContext={MATCHES_CONTEXT} onExitMatches={onExitMatches} />,
    );
    const btn = screen.getByRole('button', {
      name: 'Exit matches and browse all sauces',
    });
    fireEvent.click(btn);
    expect(onExitMatches).toHaveBeenCalledTimes(1);
  });

  it('reads name, ingredients, and image from item schema', () => {
    const singleCtx = {
      recipeName: 'Test Recipe',
      items: [
        {
          item: { name: 'Hollandaise', ingredients: ['butter', 'egg yolk', 'lemon'], image: 'hollandaise.jpg' },
          similarity: 0.83,
          matchedAromas: ['odor_fatty'],
        },
      ],
    };
    render(<SauceLab matchesContext={singleCtx} onExitMatches={() => {}} />);
    // Name rendered in card
    expect(screen.getByText('Hollandaise')).toBeTruthy();
    // Similarity badge
    expect(screen.getByText('83% match')).toBeTruthy();
    // Aroma chip — "odor_fatty" → "Creamy" (2026-05-27 chef-vocab rename)
    expect(screen.getByText('Creamy')).toBeTruthy();
  });
});
