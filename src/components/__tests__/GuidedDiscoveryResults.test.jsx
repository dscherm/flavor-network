// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidedDiscoveryResults from '../GuidedDiscoveryResults.jsx';
import * as bubbles from '../../data/guidedDiscovery.js';

const T = { star3: 0.9, star2: 0.6, star1: 0.3 };

/**
 * Build a context shaped like the one CuratedWheel + GuidedProfileRadar
 * expect, with a synthetic edges set carrying breakdown.x3 so the
 * chemistry-banner predicate can be exercised in isolation. Nodes
 * carry taste/aroma/season/cuisine fields so the radar's predicates
 * have signal to read.
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
  const edges = neighbors.map((n) => ({
    source: focal,
    target: n,
    // GD-RADAR-AFFINITY-COHERENCE (2026-05-30): heroPairings now sources
    // from getNeighborsEnriched(edges, ...) which reads edge.strength
    // directly. Mirror the pairingStrength Map values onto edges.
    strength: strengths[`${focal}|${n}`] ?? 0,
    sharedCompounds: [],
    breakdown: {
      x1: 0, x2: 0,
      x3: n === 'ginger' ? x3ForGinger : 0.5,
      x4: 0, x5: 0, x6: 0, x7: 0, x8: 0,
    },
  }));
  const nodes = new Map();
  // Focal is umami; basil + oregano are "green" aroma-tagged; everyone
  // gets a taste so the radar can plot dots regardless of filterType.
  const tasteByName = {
    tomato: 'umami',
    basil: 'green, sweet',
    'olive oil': 'creamy',
    garlic: 'pungent',
    parmesan: 'umami, salty',
    oregano: 'bitter, green',
    ginger: 'spicy',
  };
  const gnnProbsByName = {
    basil:    { odor_green: 0.9, odor_floral: 0.6 },
    oregano:  { odor_green: 0.85, odor_woody: 0.55 },
    parmesan: { odor_fatty: 0.7 },
    'olive oil': { odor_fatty: 0.75 },
    garlic:   { odor_spicy: 0.6 },
    ginger:   { odor_spicy: 0.8, odor_woody: 0.5 },
  };
  const seasonByName = {
    basil: 'summer',
    oregano: 'summer',
    parmesan: 'winter',
  };
  const cuisinesByName = {
    basil: ['European'],
    oregano: ['European', 'Middle Eastern'],
    'olive oil': ['European'],
    ginger: ['East Asian'],
  };
  for (const name of [focal, ...neighbors]) {
    nodes.set(name, {
      name,
      taste: tasteByName[name] || 'umami',
      category: 'Vegetable',
      gnnProbs: gnnProbsByName[name] || null,
      season: seasonByName[name] || null,
      cuisines: cuisinesByName[name] || [],
    });
  }
  return {
    pairingStrength,
    top5: top5Map,
    bridgeCompoundIndex,
    affinityThresholds: T,
    graph: { edges, nodes },
  };
}

// Stack with an ingredient bubble — focalFromStack reads this.
const ingredientStack = [
  { key: 'ingredient', label: 'Starts with a specific ingredient', value: { ingredient: 'tomato' }, axisHint: null },
  { key: 'taste',      label: 'Goes with a taste',                 value: { tasteBucket: 'umami' },  axisHint: 'taste' },
];

describe('GuidedDiscoveryResults — P6 composition', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does NOT render CuratedWheel', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    // CuratedWheel mounts a wedge layer; assert that layer is absent.
    expect(document.querySelector('[data-layer="wedges"]')).toBeNull();
    expect(document.querySelector('[data-layer="dots"]')).toBeNull();
  });

  it('does NOT render MultiAxisRadarStack', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    // MultiAxisRadarStack mounts ProfileAxisRadar instances which use
    // testid 'profile-axis-radar'; assert no such element exists.
    expect(screen.queryAllByTestId('profile-axis-radar')).toHaveLength(0);
  });

  it('renders GuidedProfileRadar', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    expect(screen.getByTestId('guided-profile-radar')).toBeInTheDocument();
  });

  it('renders GuidedResultsFilterPills', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    // The pills render as a radiogroup with 4 radio buttons.
    const group = screen.getByRole('radiogroup', { name: /result filter type/i });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
  });

  it('renders the "Show me where this data comes from" provenance button', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    const btn = screen.getByText(/Show me where.*data.*from/i);
    expect(btn).toBeInTheDocument();
    // Clicking opens the ProvenancePanel (role=dialog).
    fireEvent.click(btn);
    expect(screen.getByRole('dialog', { name: /where does this data come from/i })).toBeInTheDocument();
  });

  it('tapping an aroma axis dims non-matching pairings to 0.35 and keeps matches at 1.0', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        initialFilterType="aroma"
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    // Tap the "green" aroma axis.
    const greenAxisBtn = screen.getByTestId('guided-radar-axis-green');
    fireEvent.click(greenAxisBtn);
    // After the tap, plotted pairings carry data-pairing-match +
    // data-pairing-opacity attributes; matching pairings get opacity 1,
    // non-matching pairings get 0.35.
    const dots = screen.getAllByTestId('guided-radar-pairing');
    expect(dots.length).toBeGreaterThan(0);
    const opacities = dots.map((d) => d.getAttribute('data-pairing-opacity'));
    // At least one matching dot at 1.0
    expect(opacities.some((o) => o === '1')).toBe(true);
    // At least one non-matching dot at 0.35
    expect(opacities.some((o) => o === '0.35')).toBe(true);
  });

  it('switching pill from aroma to taste flips axis count to 8 and resets chosenValue to null', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        initialFilterType="aroma"
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    // Tap "green" first so chosenValue is set.
    fireEvent.click(screen.getByTestId('guided-radar-axis-green'));
    expect(screen.getByTestId('guided-profile-radar').getAttribute('data-chosen-value'))
      .toBe('green');
    // Now switch the pill to 'taste'.
    const tasteRadio = screen.getAllByRole('radio').find(
      (r) => r.textContent?.toLowerCase().includes('taste'),
    );
    expect(tasteRadio).toBeDefined();
    fireEvent.click(tasteRadio);
    // Axis count flips to 8 (taste has 8 axes).
    // After re-render, query the radar's axis buttons by their testid prefix.
    const axisButtons = Array.from(document.querySelectorAll('[data-testid^="guided-radar-axis-"]'));
    expect(axisButtons).toHaveLength(8);
    // chosenValue reset to null (data-chosen-value === '').
    expect(screen.getByTestId('guided-profile-radar').getAttribute('data-chosen-value'))
      .toBe('');
    // No wedge fill rendered.
    expect(screen.queryByTestId('guided-radar-wedge-fill')).toBeNull();
  });

  it('chemistry banner OQ4 closure: fires when ≥50% of hero pairings have breakdown.x3 === 0.5', () => {
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

  it('chemistry banner is ABOVE the radar in DOM order', () => {
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        ctx={buildCtx({ x3ForGinger: 0.5 })}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    const banner = screen.getByTestId('guided-results-chemistry-banner');
    const radar = screen.getByTestId('guided-profile-radar');
    // banner comes before radar in document order.
    expect(banner.compareDocumentPosition(radar) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('does NOT render the banner when most hero pairings have breakdown.x3 !== 0.5', () => {
    const ctx = buildCtx({ x3ForGinger: 1.0 });
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
    expect(screen.queryByTestId('guided-results-empty-state')).toBeNull();
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

  // DOCS-GD-TWO-TAP — two-step commit gesture (spec §11 O-2).
  it('two-tap commit: first tap on axis arms wedge only, does NOT fire onAxisSelect', () => {
    const onAxisSelect = vi.fn();
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        initialFilterType="aroma"
        ctx={buildCtx()}
        onAxisSelect={onAxisSelect}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('guided-radar-axis-green'));
    expect(screen.getByTestId('guided-profile-radar').getAttribute('data-chosen-value'))
      .toBe('green');
    expect(screen.getByTestId('guided-radar-wedge-fill')).toBeInTheDocument();
    expect(onAxisSelect).not.toHaveBeenCalled();
  });

  it('two-tap commit: second tap on same axis fires onAxisSelect(filterType)', () => {
    const onAxisSelect = vi.fn();
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        initialFilterType="aroma"
        ctx={buildCtx()}
        onAxisSelect={onAxisSelect}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    const greenAxisBtn = screen.getByTestId('guided-radar-axis-green');
    fireEvent.click(greenAxisBtn);
    expect(onAxisSelect).not.toHaveBeenCalled();
    fireEvent.click(greenAxisBtn);
    expect(onAxisSelect).toHaveBeenCalledTimes(1);
    expect(onAxisSelect).toHaveBeenCalledWith('aroma');
  });

  it('two-tap commit: tap on different axis re-arms (no commit, chosenValue swaps)', () => {
    const onAxisSelect = vi.fn();
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        initialFilterType="aroma"
        ctx={buildCtx()}
        onAxisSelect={onAxisSelect}
        onBackToBubbles={() => {}}
        onExploreInNetwork={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('guided-radar-axis-green'));
    expect(screen.getByTestId('guided-profile-radar').getAttribute('data-chosen-value'))
      .toBe('green');
    fireEvent.click(screen.getByTestId('guided-radar-axis-woody'));
    expect(screen.getByTestId('guided-profile-radar').getAttribute('data-chosen-value'))
      .toBe('woody');
    expect(onAxisSelect).not.toHaveBeenCalled();
  });

  // G6 — NEW10 bridge-stale assertion (named exactly per ralplan §2.4).
  it('App bridge does not call deriveFilterStackFromBubbles with the new payload shape', () => {
    const spy = vi.spyOn(bubbles, 'deriveFilterStackFromBubbles');
    const onExplore = vi.fn();
    render(
      <GuidedDiscoveryResults
        bubbleStack={ingredientStack}
        initialFilterType="aroma"
        ctx={buildCtx()}
        onBackToBubbles={() => {}}
        onExploreInNetwork={onExplore}
      />,
    );
    // Walk the new flow: tap an axis to set chosenValue, then click Explore.
    fireEvent.click(screen.getByTestId('guided-radar-axis-green'));
    fireEvent.click(screen.getByTestId('guided-results-explore'));
    // The Results component never invokes deriveFilterStackFromBubbles
    // directly (Constraint #4 — App.jsx owns the bridge). And even when
    // the bridge IS called by App.jsx, it must NOT be called with the
    // new { ingredient, filterType } object payload — only with the
    // legacy bubbleStack array shape.
    for (const call of spy.mock.calls) {
      const arg0 = call[0];
      // Reject the new object payload shape — it would no-op since
      // deriveFilterStackFromBubbles expects an array.
      const isNewPayloadShape =
        arg0 && typeof arg0 === 'object' && !Array.isArray(arg0) &&
        typeof arg0.ingredient === 'string' && typeof arg0.filterType === 'string';
      expect(isNewPayloadShape).toBe(false);
    }
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({
      ingredient: expect.any(String),
      filterType: expect.any(String),
    }));
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
