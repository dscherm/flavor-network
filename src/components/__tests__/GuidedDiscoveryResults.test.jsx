// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidedDiscoveryResults from '../GuidedDiscoveryResults.jsx';

const T = { star3: 0.9, star2: 0.6, star1: 0.3 };

/**
 * Build a context shaped like the one CuratedWheel expects, with a
 * synthetic edges set carrying breakdown.x3 so the chemistry-banner
 * predicate can be exercised in isolation.
 */
function buildCtx({ x3ForGinger = 0.5 } = {}) {
  const focal = 'tomato';
  const neighbors = ['basil', 'olive oil', 'garlic', 'parmesan', 'oregano', 'ginger'];
  const strengths = {
    'tomato|basil':     0.95,
    'tomato|olive oil': 0.88,
    'tomato|garlic':    0.85,
    'tomato|parmesan':  0.82,
    'tomato|oregano':   0.75,
    'tomato|ginger':    0.05,
  };
  const top5 = {
    tomato:      ['limonene', 'pinene', 'methyl-pyrazine', 'a', 'b'],
    basil:       ['limonene', 'eugenol', 'a', 'b', 'c'],
    'olive oil': ['nonenal', 'pinene', 'a', 'b', 'c'],
    garlic:      ['allicin', 'methyl-pyrazine', 'a', 'b', 'c'],
    parmesan:    ['butyric', 'methional', 'a', 'b', 'c'],
    oregano:     ['carvacrol', 'thymol', 'a', 'b', 'c'],
    ginger:      ['gingerol', 'pinene', 'methyl-pyrazine', 'a', 'b'],
  };
  const bridges = { 'tomato|ginger': ['gingerol'] };
  const pairingStrength = new Map();
  for (const [k, v] of Object.entries(strengths)) {
    pairingStrength.set(k, v);
    const [a, b] = k.split('|');
    pairingStrength.set(`${b}|${a}`, v);
  }
  const top5Map = new Map(Object.entries(top5));
  const bridgeCompoundIndex = new Map();
  for (const [k, names] of Object.entries(bridges)) {
    bridgeCompoundIndex.set(k, { bridges: names.map((name) => ({ name })) });
  }
  // Edges carry breakdown so normalizePair can recover x3 — gives
  // every edge x3 = 0.5 EXCEPT the ginger one (caller-controlled).
  const edges = neighbors.map((n) => ({
    source: focal,
    target: n,
    sharedCompounds: [],
    breakdown: {
      x1: 0, x2: 0,
      x3: n === 'ginger' ? x3ForGinger : 0.5,
      x4: 0, x5: 0, x6: 0, x7: 0, x8: 0,
    },
  }));
  const nodes = new Map();
  for (const name of [focal, ...neighbors]) {
    nodes.set(name, { name, taste: 'umami', category: 'Vegetable' });
  }
  return {
    pairingStrength,
    top5: top5Map,
    bridgeCompoundIndex,
    affinityThresholds: T,
    graph: { edges, nodes },
  };
}

// Stack with a taste-axis bubble — the test fixture nodes carry a
// `taste: 'umami'` field but no GNN entropy, so the taste axis is
// the only one whose bucketOf can resolve a non-null bucket. Aroma
// would render an empty-bucket SVG (no dots) because gnnEntropy is
// not populated in the synthetic ctx.
const ingredientStack = [
  { key: 'ingredient', label: 'Starts with a specific ingredient', value: { ingredient: 'tomato' }, axisHint: null },
  { key: 'taste',      label: 'Goes with a taste',                 value: { tasteBucket: 'umami' },  axisHint: 'taste' },
];

describe('GuidedDiscoveryResults', () => {
  it('renders chemistry banner when ≥50% of hero pairings have breakdown.x3 === 0.5', () => {
    // Default ctx has every edge at x3=0.5 → 100% missing chemistry → banner fires.
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx({ x3ForGinger: 0.5 })}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    const banner = screen.queryByTestId('guided-results-chemistry-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toMatch(/recipe co-occurrence alone/);
  });

  it('does NOT render the banner when most hero pairings have breakdown.x3 !== 0.5', () => {
    // Build a ctx whose every edge has x3 != 0.5. The CuratedWheel will
    // still pick ginger as a hero (surprising path), but we override
    // ginger's x3 to 1.0 so the banner predicate is never satisfied.
    const ctx = buildCtx({ x3ForGinger: 1.0 });
    // Update ALL edges to have x3 != 0.5
    for (const e of ctx.graph.edges) {
      e.breakdown.x3 = 1.0;
    }
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={ctx}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    expect(screen.queryByTestId('guided-results-chemistry-banner')).toBeNull();
  });

  it('renders CuratedWheel (svg) when bubbleStack has an ingredient bubble', () => {
    const { container } = render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.queryByTestId('guided-results-empty-state')).toBeNull();
  });

  it('renders empty-state when no ingredient bubble', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={[
          { key: 'season', label: 'Goes with a season', value: 'summer', axisHint: 'season' },
        ]}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    expect(screen.getByTestId('guided-results-empty-state')).toBeInTheDocument();
  });

  // Bug 2 — when an ingredient IS picked AND ctx is plumbed, the wheel
  // must render and the empty-state must NOT appear. This is the test
  // that would have caught the App.jsx wiring regression.
  it('renders the curated wheel when bubbleStack has an ingredient AND ctx is plumbed', () => {
    const { container } = render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    // Wheel SVG present; empty-state ABSENT.
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.queryByTestId('guided-results-empty-state')).toBeNull();
    expect(screen.queryByTestId('guided-results-loading-state')).toBeNull();
  });

  // Bug 2 — distinguish the wiring-failure case from the empty-state.
  // When focal IS set but ctx is null, render a loading-state, NOT
  // the "pick an ingredient" empty-state (which would mis-signal the
  // user to do something they already did).
  it('renders loading-state when focal is set but ctx is missing', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={null}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    expect(screen.getByTestId('guided-results-loading-state')).toBeInTheDocument();
    // Crucially: the empty-state (which tells the user to "pick an
    // ingredient bubble") must NOT appear when one is already picked.
    expect(screen.queryByTestId('guided-results-empty-state')).toBeNull();
  });

  it('selecting a hero pairing opens StoryPanel', () => {
    const { container } = render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    // Story panel placeholder is shown initially.
    expect(screen.getByTestId('guided-results-story-placeholder')).toBeInTheDocument();
    // Click a wheel dot.
    const dots = container.querySelectorAll('[data-layer="dots"] [data-name]');
    expect(dots.length).toBeGreaterThan(0);
    fireEvent.click(dots[0]);
    // Story panel appears.
    expect(screen.getByTestId('story-panel')).toBeInTheDocument();
    expect(screen.getByTestId('story-causal').textContent).toMatch(/recipe co-occurrence/);
  });

  it('"Back to bubbles" CTA fires onBackToBubbles', () => {
    const onBack = vi.fn();
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={onBack}
        onExploreInNetwork={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('guided-results-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('"Explore in the network" CTA fires onExploreInNetwork', () => {
    const onExplore = vi.fn();
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={onExplore}
      />,
    );
    fireEvent.click(screen.getByTestId('guided-results-explore'));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});

describe('Constraint #4 — GuidedDiscoveryResults purity', () => {
  it('contains zero setFilterStack call sites (mirrors GuidedDiscoveryStart purity check)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const file = path.resolve(__dirname, '..', 'GuidedDiscoveryResults.jsx');
    const src = fs.readFileSync(file, 'utf8');
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const refs = stripped.match(/setFilterStack/g) || [];
    expect(refs).toHaveLength(0);
  });
});
