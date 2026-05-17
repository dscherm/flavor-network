// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CocktailLabV2 from '../CocktailLabV2.jsx';

// ── Module mocks ──────────────────────────────────────────────────────────────
// CocktailLabV2 loads cocktail_codex_v2.json via fetch and builds a
// Three.js scene — both are heavy/unavailable in jsdom. We mock the
// data module and all Three.js-touching child components so the test
// focuses purely on the matchesContext prop wiring.

vi.mock('../NetworkScene.jsx', () => ({
  default: ({ data }) => (
    <div data-testid="network-scene">
      {data?.graph?.nodes
        ? [...data.graph.nodes.keys()].map((n) => (
            <div key={n} data-testid="cocktail-node">{n}</div>
          ))
        : null}
    </div>
  ),
}));

vi.mock('../CocktailDetailPanel.jsx', () => ({
  default: () => <div data-testid="cocktail-detail-panel" />,
}));

vi.mock('../CocktailBrowse.jsx', () => ({
  default: ({ graph }) => (
    <div data-testid="cocktail-browse">
      {graph?.cocktails?.map((c) => (
        <div key={c.name} data-testid="browse-card">{c.name}</div>
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

vi.mock('../../data/cocktailCodexV2.js', () => ({
  loadCodexV2: (raw) => raw,
  placeCocktailInFamily: () => ({ x: 0, y: 0, z: 0 }),
  topSimilar: () => [],
  crossFamilySimilar: () => [],
  cocktailSimilarity: () => 0,
}));

vi.mock('../../data/cocktailBaseSpirit.js', () => ({
  cocktailBaseSpiritShape: () => 'sphere',
  COCKTAIL_SPIRIT_LEGEND: [],
}));

// Stub fetch so the codex load doesn't throw in the test environment.
// The codex response is structured to minimally satisfy loadCodexV2
// (which is mocked above to return its argument directly).
const MOCK_CODEX = {
  families: [],
  cocktails: [],
  byFamily: new Map(),
  byCanonical: new Map(),
  rootByFamily: new Map(),
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_CODEX,
  });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeItem(name) {
  return {
    name,
    ingredients: ['whiskey', 'vermouth', 'bitters'],
    image: `${name.toLowerCase().replace(/ /g, '-')}.jpg`,
  };
}

const FIXTURE_ITEMS = [
  { item: makeItem('Old Fashioned'), similarity: 0.87, matchedAromas: ['odor_fruity', 'odor_woody'] },
  { item: makeItem('Negroni'),       similarity: 0.72, matchedAromas: ['odor_floral'] },
  { item: makeItem('Margarita'),     similarity: 0.61, matchedAromas: ['odor_fruity', 'odor_green'] },
];

const MATCHES_CONTEXT = {
  recipeName: 'Spaghetti Bolognese',
  items: FIXTURE_ITEMS,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CocktailLabV2 — matchesContext=null (regression)', () => {
  it('does NOT render a "Matches for" header chip', async () => {
    const { queryByText } = render(<CocktailLabV2 matchesContext={null} />);
    // Wait one tick for the async fetch mock to resolve.
    await vi.waitFor(() => {
      expect(queryByText(/Matches for/i)).toBeNull();
    });
  });
});

describe('CocktailLabV2 — matchesContext non-null', () => {
  it('renders exactly 3 cards for the 3-item fixture', () => {
    const { getAllByRole } = render(
      <CocktailLabV2 matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />,
    );
    // Each card is a <button> inside a <li>. There may also be "Show all"
    // button, so we check the list items specifically.
    const listItems = document.querySelectorAll('li');
    expect(listItems).toHaveLength(3);
  });

  it('shows the "Matches for Spaghetti Bolognese" header chip', () => {
    render(<CocktailLabV2 matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    expect(screen.getByText('Matches for Spaghetti Bolognese')).toBeTruthy();
  });

  it('each card has a similarity badge matching /^\\d{1,3}% match$/', () => {
    render(<CocktailLabV2 matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    const badges = screen.getAllByText(/^\d{1,3}% match$/);
    expect(badges).toHaveLength(3);
  });

  it('each card has at least one matched-aroma chip', () => {
    const { container } = render(
      <CocktailLabV2 matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />,
    );
    // Aroma chips are spans with class containing "rounded-full" and
    // text like "Fruity", "Woody", "Floral", "Green". Each item in the
    // fixture has ≥1 matchedAromas entry.
    const aromaChips = container.querySelectorAll('li span.rounded-full');
    expect(aromaChips.length).toBeGreaterThanOrEqual(3); // ≥1 per card
  });

  it('renders the "Show all cocktails" button with the correct accessible name', () => {
    render(<CocktailLabV2 matchesContext={MATCHES_CONTEXT} onExitMatches={() => {}} />);
    const btn = screen.getByRole('button', {
      name: 'Exit matches and browse all cocktails',
    });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toMatch(/Show all cocktails/i);
  });

  it('clicking "Show all cocktails" fires onExitMatches', () => {
    const onExitMatches = vi.fn();
    render(
      <CocktailLabV2 matchesContext={MATCHES_CONTEXT} onExitMatches={onExitMatches} />,
    );
    const btn = screen.getByRole('button', {
      name: 'Exit matches and browse all cocktails',
    });
    fireEvent.click(btn);
    expect(onExitMatches).toHaveBeenCalledTimes(1);
  });

  it('reads name, ingredients, and image from item schema', () => {
    const singleCtx = {
      recipeName: 'Test Recipe',
      items: [
        {
          item: { name: 'Manhattan', ingredients: ['whiskey', 'vermouth', 'bitters'], image: 'manhattan.jpg' },
          similarity: 0.9,
          matchedAromas: ['odor_fruity'],
        },
      ],
    };
    render(<CocktailLabV2 matchesContext={singleCtx} onExitMatches={() => {}} />);
    // Name is rendered in the card button
    expect(screen.getByText('Manhattan')).toBeTruthy();
    // Similarity badge
    expect(screen.getByText('90% match')).toBeTruthy();
    // Aroma chip — "odor_fruity" → "Fruity"
    expect(screen.getByText('Fruity')).toBeTruthy();
  });
});
