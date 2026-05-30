// @vitest-environment jsdom
/**
 * P8: App-level aroma-match handoff tests.
 *
 * Verifies:
 *   1. onFindCocktail / onFindSauce callbacks are passed to RecipeLab.
 *   2. Calling those callbacks sets matchesContext on CocktailLabV2 / SauceLab.
 *   3. Switching tabs away from cocktail/sauce clears matchesContext (ADR-2).
 *
 * Strategy: mock all heavy child components; bypass the LandingScreen by
 * stubbing onModeSelect so startPageComplete=true fires synchronously.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Module mocks ──────────────────────────────────────────────────────────────

// LandingScreen — fires onModeSelect('network') immediately on render so
// startPageComplete becomes true without user interaction.
vi.mock('../components/LandingScreen.jsx', () => ({
  default: ({ onModeSelect }) => {
    // Call in a useEffect so it's synchronous within act() boundaries.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { useEffect } = require('react');
    useEffect(() => { onModeSelect?.('network'); }, []);
    return <div data-testid="landing-screen" />;
  },
}));

vi.mock('../components/LivingArchView.jsx',   () => ({ default: () => <div data-testid="living-arch" /> }));
vi.mock('../components/NetworkScene.jsx',     () => ({ default: () => <div data-testid="network-scene" /> }));
vi.mock('../components/SearchBar.jsx',        () => ({ default: () => null }));
vi.mock('../components/IngredientPanel.jsx',  () => ({ default: () => null }));
vi.mock('../components/Controls.jsx',         () => ({ default: () => null }));
vi.mock('../components/Walkthrough.jsx',      () => ({ default: () => null }));
vi.mock('../components/HelpButton.jsx',       () => ({ default: () => null }));
vi.mock('../components/ProfilePanel.jsx',     () => ({ default: () => null }));
vi.mock('../components/GlobalInsights.jsx',   () => ({ default: () => null }));
vi.mock('../components/FlavorTreeExplorer.jsx', () => ({ default: () => null }));
vi.mock('../components/ClusterJoystick.jsx',  () => ({ default: () => null }));
vi.mock('../components/HowItWorks.jsx',       () => ({ default: () => null }));
vi.mock('../components/TrainingTraceModal.jsx',() => ({ default: () => null }));
vi.mock('../components/MobileTabBar.jsx',     () => ({ default: () => null }));
vi.mock('../components/FilterPillRow.jsx',    () => ({ default: () => null }));
vi.mock('../components/FilterBreadcrumb.jsx', () => ({ default: () => null }));
vi.mock('../components/HUDAnnouncer.jsx',     () => ({ default: () => null }));
vi.mock('../components/FilterPullSlider.jsx', () => ({ default: () => null }));
vi.mock('../components/InsightChip.jsx',      () => ({ default: () => null }));
vi.mock('../components/BridgePulseOverlay.jsx',() => ({ default: () => null }));
vi.mock('../components/AffinityTriangleOverlay.jsx', () => ({ default: () => null }));
vi.mock('../components/WedgeGridFlavorWheel.jsx', () => ({ default: () => null }));
vi.mock('../components/InsightDrawer.jsx',    () => ({ default: () => null }));
vi.mock('../components/GuidedDiscoverySwipe.jsx', () => ({ default: () => null }));
vi.mock('../components/CookbookLab.jsx',      () => ({ default: () => null }));
vi.mock('../components/GuidedTour.jsx',       () => ({ default: () => null }));
vi.mock('../components/LabTour.jsx',          () => ({ default: () => null }));
vi.mock('../components/GuidedDiscoveryResults.jsx', () => ({ default: () => null }));
vi.mock('../components/ErrorCard.jsx',        () => ({ default: () => null }));
vi.mock('../components/BottomSheet.jsx',      () => ({ default: () => null }));
vi.mock('../components/AnimatedLogo.jsx',     () => ({ default: () => null }));

// CocktailLabV2 — capture matchesContext + expose an exit button.
let lastCocktailCtx   = undefined;
let capturedExitFn    = null;

vi.mock('../components/CocktailLabV2.jsx', () => ({
  default: ({ matchesContext, onExitMatches }) => {
    lastCocktailCtx = matchesContext;
    capturedExitFn  = onExitMatches;
    return (
      <div data-testid="cocktail-lab">
        {matchesContext && (
          <span data-testid="cocktail-matches">
            Matches for {matchesContext.recipeName}
          </span>
        )}
        <button data-testid="cocktail-exit" onClick={onExitMatches}>exit</button>
      </div>
    );
  },
}));

// SauceLab — capture matchesContext.
let lastSauceCtx = undefined;

vi.mock('../components/SauceLab.jsx', () => ({
  default: ({ matchesContext, onExitMatches }) => {
    lastSauceCtx = matchesContext;
    return (
      <div data-testid="sauce-lab">
        {matchesContext && (
          <span data-testid="sauce-matches">
            Matches for {matchesContext.recipeName}
          </span>
        )}
        <button data-testid="sauce-exit" onClick={onExitMatches}>exit</button>
      </div>
    );
  },
}));

// RecipeLab — capture the pill callbacks and render trigger buttons.
let capturedFindCocktail = null;
let capturedFindSauce    = null;

vi.mock('../components/RecipeLab.jsx', () => ({
  default: ({ onFindCocktail, onFindSauce }) => {
    capturedFindCocktail = onFindCocktail;
    capturedFindSauce    = onFindSauce;
    return (
      <div data-testid="recipe-lab">
        <button
          data-testid="pill-cocktail"
          onClick={() => onFindCocktail?.(['tomato', 'basil'], 'Pasta')}
        >Find Cocktail</button>
        <button
          data-testid="pill-sauce"
          onClick={() => onFindSauce?.(['tomato', 'basil'], 'Pasta')}
        >Find Sauce</button>
      </div>
    );
  },
}));

// useProData — immediately resolves with nodes that have gnnProbs.
const MOCK_NODES = new Map([
  ['tomato', {
    name: 'tomato', taste: 'sour', cuisines: [], season: 'summer',
    gnnProbs: { odor_fruity: 0.7, odor_floral: 0.1, odor_green: 0.4,
                odor_woody: 0.2, odor_spicy: 0.05, odor_fatty: 0.1 },
  }],
  ['basil', {
    name: 'basil', taste: 'bitter', cuisines: [], season: 'summer',
    gnnProbs: { odor_fruity: 0.2, odor_floral: 0.4, odor_green: 0.8,
                odor_woody: 0.1, odor_spicy: 0.3, odor_fatty: 0.05 },
  }],
]);

vi.mock('../hooks/useProData.js', () => ({
  default: () => ({
    loading: false,
    error: null,
    retry: () => {},
    data: {
      graph: { nodes: MOCK_NODES, edges: [], ingredientList: ['tomato', 'basil'] },
      positions: {}, flavorPositions: {}, flavorClusterLabels: [], clusterLabels: [],
      clusterExplanations: {}, bridgeCompounds: null, bridgeMolecules3D: null,
      gnnEntropy: null, odorThresholds: null, ingredientThresholds: null,
      compoundTastes: null, recipePairs: [], globalCount: 0,
      pairingStrength: new Map(), top5: new Map(), bridgeCompoundIndex: new Map(),
      affinityThresholds: { weak: 0.2, moderate: 0.5, strong: 0.8 },
      cuisinePairings: null, cuisinePairLookup: new Map(), cuisineNeighborIndex: null,
      cuisineMap: {}, seasonMap: {}, embeddings: null, raw: {},
    },
  }),
}));

vi.mock('../hooks/useIsMobile.js',    () => ({ default: () => false }));
vi.mock('../hooks/useUserProfile.js', () => ({
  default: () => ({
    hasIngredient: () => false, toggleIngredient: () => {},
    togglePairing: () => {}, hasPairing: () => false,
  }),
}));
vi.mock('../hooks/useAuth.js', () => ({
  default: () => ({ user: null, loginWithGoogle: () => {}, loginWithApple: () => {}, logout: () => {} }),
}));

// Heavy data modules
vi.mock('../data/affinityTiers.js',       () => ({ topAffinities: () => [] }));
vi.mock('../data/graph.js',               () => ({ getNeighbors: () => [], getNeighborsEnriched: () => [], findStrongestPath: () => [] }));
vi.mock('../data/metadata.js',            () => ({ getAllCuisines: () => [], getAllTastes: () => [] }));
vi.mock('../data/guidedDiscovery.js',     () => ({ deriveFilterStackFromBubbles: () => ({}) }));
vi.mock('../data/networkModes.js',        () => ({
  MODE_CYCLE: ['network'], MODE_LABELS: { network: 'Network' },
  MODE_TO_AXIS: {}, FILTER_TO_AXIS: {}, morphAxisForStack: () => 'network',
  DEFAULT_MODE: 'network',
}));
vi.mock('../data/categoricalAxes.js',     () => ({ CATEGORICAL_AXES: [], bucketOf: () => null }));
vi.mock('../data/bridgeRanker.js',        () => ({ rankBridges: () => [] }));
vi.mock('../data/clusterBucketOverlap.js',() => ({ computeClusterBucketOverlap: () => ({}) }));
vi.mock('../data/bucketPoles.js',         () => ({
  computeBucketPoles2D: () => ({}), computeBucketPoles3D: () => ({}),
  fibonacciSphere: () => [], POLE_RADIUS: 90,
}));
vi.mock('../data/labScope.js', () => ({
  getCocktailScope: () => Promise.resolve(new Set()),
  getSauceScope:    () => Promise.resolve(new Set()),
}));
vi.mock('../utils/startPageFlag.js', () => ({
  readStartPageFlag: () => false, writeStartPageFlag: () => {}, clearStartPageFlag: () => {},
}));

// fetch mock — returns minimal payloads for cocktail_codex_v2 and sauce_augment.
const MOCK_CODEX = {
  families: [],
  cocktails: [{
    name: 'Old Fashioned', canonical: 'old fashioned',
    family_id: 1, subcluster_id: '1.1', is_root: false, iba_official: false,
    ingredients_raw: [{ raw: 'whiskey' }, { raw: 'bitters' }],
  }],
};

const MOCK_SAUCE_AUGMENT = {
  sauces: [{
    name: 'Tomato Sauce', motherSauce: 'Tomato',
    ingredients: [{ name: 'tomato', measure: '2 cups' }, { name: 'basil', measure: '1 tbsp' }],
  }],
};

beforeEach(() => {
  lastCocktailCtx      = undefined;
  lastSauceCtx         = undefined;
  capturedExitFn       = null;
  capturedFindCocktail = null;
  capturedFindSauce    = null;

  global.fetch = vi.fn().mockImplementation((url) => {
    if (String(url).includes('cocktail_codex_v2')) {
      return Promise.resolve({ ok: true, json: async () => MOCK_CODEX });
    }
    if (String(url).includes('sauce_augment')) {
      return Promise.resolve({ ok: true, json: async () => MOCK_SAUCE_AUGMENT });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });

  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function mountApp() {
  const { default: App } = await import('../App.jsx');
  await act(async () => { render(<App />); });
  // Allow any pending microtasks / effects to flush.
  await act(async () => {});
}

// Simulate clicking the Notebook sub-nav button to switch to the recipe tab.
function clickNotebookTab() {
  // The sub-nav button for Notebook has title "Notebook-style recipe builder"
  const btn = screen.queryByTitle(/notebook-style recipe builder/i)
           || screen.queryByText(/^Notebook$/i);
  if (btn) fireEvent.click(btn);
  return !!btn;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('App — RecipeLab receives pill callbacks', () => {
  it('passes onFindCocktail function to RecipeLab', async () => {
    await mountApp();
    // Navigate to recipe tab to mount RecipeLab
    await act(async () => { clickNotebookTab(); });
    expect(typeof capturedFindCocktail).toBe('function');
  });

  it('passes onFindSauce function to RecipeLab', async () => {
    await mountApp();
    await act(async () => { clickNotebookTab(); });
    expect(typeof capturedFindSauce).toBe('function');
  });
});

describe('App — matchesContext lifts when pill fires', () => {
  it('onFindCocktail sets non-null matchesContext on CocktailLabV2', async () => {
    await mountApp();
    await act(async () => { clickNotebookTab(); });

    // Fire the callback directly (simulates pill click in RecipeLab).
    await act(async () => {
      await capturedFindCocktail?.(['tomato', 'basil'], 'Pasta');
    });

    expect(lastCocktailCtx).not.toBeNull();
    expect(lastCocktailCtx?.recipeName).toBe('Pasta');
    expect(Array.isArray(lastCocktailCtx?.items)).toBe(true);
  });

  it('onFindSauce sets non-null matchesContext on SauceLab', async () => {
    await mountApp();
    await act(async () => { clickNotebookTab(); });

    await act(async () => {
      await capturedFindSauce?.(['tomato', 'basil'], 'Pasta');
    });

    expect(lastSauceCtx).not.toBeNull();
    expect(lastSauceCtx?.recipeName).toBe('Pasta');
    expect(Array.isArray(lastSauceCtx?.items)).toBe(true);
  });
});

describe('App — ADR-2: matchesContext clears on tab leave', () => {
  it('matchesContext is null before any pill fires', async () => {
    await mountApp();
    // CocktailLabV2 receives null (its default) when no pill has fired yet.
    expect(lastCocktailCtx === null || lastCocktailCtx === undefined).toBe(true);
  });

  it('onExitMatches callback clears matchesContext', async () => {
    await mountApp();
    await act(async () => { clickNotebookTab(); });

    // Set matchesContext via cocktail pill.
    await act(async () => {
      await capturedFindCocktail?.(['tomato', 'basil'], 'Pasta');
    });
    expect(lastCocktailCtx).not.toBeNull();

    // Fire onExitMatches — simulates user clicking "Show all cocktails".
    await act(async () => { capturedExitFn?.(); });
    expect(lastCocktailCtx).toBeNull();
  });

  it('switching to Notebook tab clears matchesContext (ADR-2)', async () => {
    await mountApp();
    await act(async () => { clickNotebookTab(); });

    // Set matchesContext.
    await act(async () => {
      await capturedFindCocktail?.(['tomato', 'basil'], 'Pasta');
    });
    expect(lastCocktailCtx).not.toBeNull();

    // Switch back to Notebook tab — the useEffect should clear matchesContext.
    await act(async () => { clickNotebookTab(); });
    expect(lastCocktailCtx).toBeNull();
  });
});

// ── GD-TOUR-AFFINITY-ENGAGE (2026-05-30) ──────────────────────────────────
// Regression: alphaEngaged = affinityEnabled && selectedNodes.length === 1
// && affinityRequested. The Guided Discovery → network handoff sets selectedNodes
// but historically forgot affinityRequested — so Step 1's "We've engaged the
// Affinity view" popup lied. Source-grep test asserts the fix stays in place.
describe('GD-TOUR-AFFINITY-ENGAGE — α-mode engagement on Guided handoff', () => {
  it('sceneHandle.engageAffinity calls both setSelectedNodes and setAffinityRequested(true)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    // Match the engageAffinity body: a setSelectedNodes call and a
    // setAffinityRequested(true) call must both appear before the next
    // sceneHandle method (animatePull).
    const engageBlock = src.match(/engageAffinity\(name\)\s*\{[\s\S]*?animatePull/);
    expect(engageBlock).toBeTruthy();
    expect(engageBlock[0]).toMatch(/setSelectedNodes\(\[name\]\)/);
    expect(engageBlock[0]).toMatch(/setAffinityRequested\(true\)/);
  });

  it('GuidedDiscoveryResults onAxisSelect handler sets affinityRequested=true alongside selectedNodes=[focal]', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    // Locate the onAxisSelect inline handler from the GuidedDiscoveryResults
    // mount block by its distinctive tour-activation call.
    const startIdx = src.indexOf('onAxisSelect={(axis) =>');
    expect(startIdx).toBeGreaterThan(0);
    const endIdx = src.indexOf('setTourActive(true)', startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    const block = src.slice(startIdx, endIdx);
    expect(block).toMatch(/setSelectedNodes\(\[focal\]\)/);
    expect(block).toMatch(/setAffinityRequested\(true\)/);
  });
});

// ── GD-NODE-COLOR-FOLLOW-FILTER (2026-05-30) ──────────────────────────────
// Regression: when α-mode disengages while a categorical filter is active,
// the restored palette must be the filter's bucket palette (taste / aromas
// / cuisine / season / family) — not defaultColors. Otherwise the tour's
// Step 2 morph coloring gets clobbered when Step 2 fires
// setSelectedNodes([]) which disengages α-mode in the same render.
describe('GD-NODE-COLOR-FOLLOW-FILTER — α-mode exit honors active filter palette', () => {
  it('AffinityMode.exit picks filterPalette from categoricalColorByMode when filterStack is active', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/three/AffinityMode.js'),
      'utf8',
    );
    // Capture exit body up to its terminating `\n  }\n` (method
    // close). Use a coarse upper bound — the body is < 6 KB.
    const exitStart = src.indexOf('exit(_opts');
    expect(exitStart).toBeGreaterThan(0);
    const exitBody = src.slice(exitStart, exitStart + 6000);
    expect(exitBody).toMatch(/st\.filterStack/);
    expect(exitBody).toMatch(/categoricalColorByMode/);
    expect(exitBody).toMatch(/filterPalette/);
    // Filter palette must take precedence over the clusterMode/default
    // fallback (filterPalette ?? ... or filterPalette || ...).
    expect(exitBody).toMatch(/filterPalette\s*(?:\|\||\?\?)/);
  });

  it('LivingArchView stateRef exposes a filterStack getter so AffinityMode can read it', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/LivingArchView.jsx'),
      'utf8',
    );
    // Within the stateRef.current = { ... } block, a `get filterStack()`
    // getter must read filterStackRef.current.
    expect(src).toMatch(/get filterStack\(\)\s*\{\s*return filterStackRef\.current/);
  });
});

// ── GD-TOUR-STEP4-CLUSTER-DEMO-RACE (2026-05-30) ──────────────────────────
// Regression: sceneHandle.runClusterDemo must defer its body via
// setTimeout(0) so the cleared filterStack commits before the ref read.
// Without the defer, joystickClustersRef.current still holds Step 3's
// morph-axis pseudo-clusters (id <= -100) and the id >= 0 filter empties.
describe('GD-TOUR-STEP4-CLUSTER-DEMO-RACE — runClusterDemo defers past React commit', () => {
  it('runClusterDemo wraps its body in setTimeout(..., 0) before reading joystickClustersRef', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    // Match runClusterDemo body up to its closing — should contain
    // setTimeout(..., 0) wrapping the joystickClustersRef.current read.
    const block = src.match(/runClusterDemo\(\)\s*\{[\s\S]*?engageFinalAffinity/);
    expect(block).toBeTruthy();
    const body = block[0];
    expect(body).toMatch(/window\.setTimeout\([\s\S]*?,\s*0\)/);
    // The ref read must appear AFTER the setTimeout opener, not before.
    const setTimeoutIdx = body.indexOf('window.setTimeout(');
    const refReadIdx = body.indexOf('joystickClustersRef.current');
    expect(setTimeoutIdx).toBeGreaterThan(-1);
    expect(refReadIdx).toBeGreaterThan(setTimeoutIdx);
  });
});
