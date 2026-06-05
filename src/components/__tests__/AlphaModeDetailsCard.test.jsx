import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// getNeighborsEnriched is the only graph.js dependency — stub it so the
// pairing set is deterministic regardless of edge wiring.
vi.mock('../../data/graph.js', () => ({
  getNeighborsEnriched: () => [
    { name: 'lemon', strength: 0.9 },
    { name: 'thyme', strength: 0.7 },
    { name: 'garlic', strength: 0.5 },
  ],
}));

import AlphaModeDetailsCard, {
  ALPHA_DETAILS_VIEWS,
  tagsForView,
  rankPairings,
  computeCommonCompounds,
} from '../AlphaModeDetailsCard.jsx';

// caffeine is in every fixture node → ubiquitous background molecule.
function makeCtx() {
  const nodes = new Map();
  nodes.set('basil', {
    name: 'basil', cluster: 0,
    flavorGraph: { tier1: ['herbal', 'green'], tier2: ['sweet'], tier3: ['cooling'], leaves: [] },
    cuisines: ['italian', 'thai'], season: 'summer',
    gnnCompounds: { top_compounds: [{ name: 'linalool' }, { name: 'eugenol' }, { name: 'caffeine' }] },
  });
  nodes.set('lemon', {
    name: 'lemon', cluster: 1,
    flavorGraph: { tier1: ['citrus', 'green'], tier2: ['sour'], tier3: [], leaves: [] },
    cuisines: ['italian'], season: 'summer',
    gnnCompounds: { top_compounds: [{ name: 'limonene' }, { name: 'linalool' }, { name: 'caffeine' }] },
  });
  nodes.set('thyme', {
    name: 'thyme', cluster: 2,
    flavorGraph: { tier1: ['herbal'], tier2: ['bitter'], tier3: [], leaves: [] },
    cuisines: ['french'], season: 'spring',
    gnnCompounds: { top_compounds: [{ name: 'thymol' }, { name: 'linalool' }, { name: 'caffeine' }] },
  });
  nodes.set('garlic', {
    name: 'garlic', cluster: 3,
    flavorGraph: { tier1: ['pungent'], tier2: ['umami'], tier3: [], leaves: [] },
    cuisines: ['italian', 'thai'], season: 'fall',
    gnnCompounds: { top_compounds: [{ name: 'allicin' }, { name: 'caffeine' }] },
  });
  return { graph: { nodes, edges: {} } };
}

describe('AlphaModeDetailsCard — pure helpers', () => {
  it('tagsForView reads the right dimension per lens', () => {
    const basil = makeCtx().graph.nodes.get('basil');
    expect(tagsForView(basil, 'aroma')).toEqual(['herbal', 'green']);
    expect(tagsForView(basil, 'cuisine')).toEqual(['italian', 'thai']);
    expect(tagsForView(basil, 'season')).toEqual(['summer']);
  });

  it('chemistry tags drop the ubiquitous-compound set (caffeine et al)', () => {
    const basil = makeCtx().graph.nodes.get('basil');
    // No filter → raw molecules including caffeine.
    expect(tagsForView(basil, 'chemistry')).toEqual(['linalool', 'eugenol', 'caffeine']);
    // With the common set → caffeine excluded.
    const common = new Set(['caffeine']);
    expect(tagsForView(basil, 'chemistry', common)).toEqual(['linalool', 'eugenol']);
  });

  it('computeCommonCompounds flags only molecules above the frequency cap', () => {
    const nodes = makeCtx().graph.nodes; // caffeine in 4/4, linalool in 3/4
    const common = computeCommonCompounds(nodes, 0.9); // >90% → only caffeine
    expect(common.has('caffeine')).toBe(true);
    expect(common.has('linalool')).toBe(false);
  });

  it('chemistry lens exists and every lens has a unique color', () => {
    const chem = ALPHA_DETAILS_VIEWS.find((v) => v.id === 'chemistry');
    expect(chem).toBeTruthy();
    const colors = new Set(ALPHA_DETAILS_VIEWS.map((v) => v.color));
    expect(colors.size).toBe(ALPHA_DETAILS_VIEWS.length);
  });

  it('rankPairings ranks by overlap, isolates on activeTag, ignores caffeine in chemistry', () => {
    const ctx = makeCtx();
    const basil = ctx.graph.nodes.get('basil');
    const all = ['lemon', 'thyme', 'garlic'].map((n) => ({
      name: n, strength: 0.5, node: ctx.graph.nodes.get(n),
    }));
    // Tier lenses (no tag) show ALL the focal's pairings, ranked so the
    // aroma-sharing ones lead — garlic (no shared aroma) still appears.
    const aroma = rankPairings(basil, all, 'aroma', null).map((p) => p.name);
    expect(aroma).toContain('lemon');
    expect(aroma).toContain('thyme');
    expect(aroma).toContain('garlic');
    expect(aroma.slice(0, 2).sort()).toEqual(['lemon', 'thyme']); // sharers ranked first

    // Isolating a specific focal aroma narrows to the partners echoing it.
    const herbalOnly = rankPairings(basil, all, 'aroma', 'herbal').map((p) => p.name);
    expect(herbalOnly).toEqual(['thyme']);

    // Chemistry with caffeine excluded: garlic shares ONLY caffeine → dropped.
    const common = new Set(['caffeine']);
    const chem = rankPairings(basil, all, 'chemistry', null, common).map((p) => p.name).sort();
    expect(chem).toEqual(['lemon', 'thyme']);
    expect(chem).not.toContain('garlic');
  });
});

describe('AlphaModeDetailsCard — render', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('renders stacked card opening on the Aroma lens with focal tags + blurb', () => {
    render(<AlphaModeDetailsCard focal="basil" ctx={makeCtx()} commonCompounds={new Set(['caffeine'])} />);
    expect(screen.getByTestId('alpha-details-card')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-lens-title')).toHaveTextContent('Shared Aroma');
    expect(screen.getByTestId('alpha-focal-tag-herbal')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-pairing-blurb')).toBeInTheDocument();
    // Aroma lens shows ALL the focal's pairings now (garlic included).
    expect(screen.getByTestId('alpha-affinity-node-lemon')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-affinity-node-garlic')).toBeInTheDocument();
  });

  it('Surprising lens shows strong, non-overlapping pairings only', () => {
    render(<AlphaModeDetailsCard focal="basil" ctx={makeCtx()} commonCompounds={new Set(['caffeine'])} />);
    fireEvent.click(screen.getByTestId('alpha-view-dot-surprising'));
    expect(screen.getByTestId('alpha-lens-title')).toHaveTextContent('Surprising Pairings');
    expect(screen.getByTestId('alpha-surprising-hint')).toBeInTheDocument();
    // garlic shares no aroma/taste/texture with basil → surprising.
    expect(screen.getByTestId('alpha-affinity-node-garlic')).toBeInTheDocument();
    // lemon/thyme share an aroma → not surprising.
    expect(screen.queryByTestId('alpha-affinity-node-lemon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alpha-affinity-node-thyme')).not.toBeInTheDocument();
  });

  it('tapping a ring node updates the blurb to explain that pairing', () => {
    render(<AlphaModeDetailsCard focal="basil" ctx={makeCtx()} commonCompounds={new Set(['caffeine'])} />);
    fireEvent.click(screen.getByTestId('alpha-affinity-node-lemon'));
    const blurb = screen.getByTestId('alpha-pairing-blurb');
    expect(blurb).toHaveTextContent('basil + lemon');
    expect(blurb).toHaveTextContent('green'); // the shared aroma
  });

  it('Chemistry lens shows indicative molecules only (no caffeine chip)', () => {
    render(<AlphaModeDetailsCard focal="basil" ctx={makeCtx()} commonCompounds={new Set(['caffeine'])} />);
    fireEvent.click(screen.getByTestId('alpha-view-dot-chemistry'));
    expect(screen.getByTestId('alpha-lens-title')).toHaveTextContent('Shared Chemistry');
    expect(screen.getByTestId('alpha-focal-tag-linalool')).toBeInTheDocument();
    expect(screen.queryByTestId('alpha-focal-tag-caffeine')).not.toBeInTheDocument();
    // lemon + thyme share linalool; garlic shares only caffeine → excluded.
    expect(screen.getByTestId('alpha-affinity-node-lemon')).toBeInTheDocument();
    expect(screen.getByTestId('alpha-affinity-node-thyme')).toBeInTheDocument();
    expect(screen.queryByTestId('alpha-affinity-node-garlic')).not.toBeInTheDocument();
  });

  it('tapping a focal tag isolates the ring to that tag', () => {
    render(<AlphaModeDetailsCard focal="basil" ctx={makeCtx()} commonCompounds={new Set(['caffeine'])} />);
    fireEvent.click(screen.getByTestId('alpha-focal-tag-herbal'));
    expect(screen.getByTestId('alpha-affinity-node-thyme')).toBeInTheDocument();
    expect(screen.queryByTestId('alpha-affinity-node-lemon')).not.toBeInTheDocument();
  });

  it('double-tapping a ring node fires onSelectPairing', () => {
    const onSelectPairing = vi.fn();
    render(<AlphaModeDetailsCard focal="basil" ctx={makeCtx()} onSelectPairing={onSelectPairing} />);
    fireEvent.doubleClick(screen.getByTestId('alpha-affinity-node-lemon'));
    expect(onSelectPairing).toHaveBeenCalledWith('lemon');
  });
});
