// @vitest-environment jsdom
/**
 * INVENT-6 / BUILDER-3: the Cookbook's "✨ Invent this" hands a Recipe Lab seed to the Recipe Notebook builder (the one chalkboard builder).
 * (Mocks copied from App.deepLink.test.jsx.)
 * Shared links: a URL that names a surface (`?path=cocktail`) opens that
 * surface directly; a bare visit still shows the landing picker and does
 * not gain a ?path= before the user picks. Mocks are copied from
 * App.handoff.test.jsx with a passive LandingScreen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Module mocks ──────────────────────────────────────────────────────────────

// LandingScreen — passive: renders a marker and never auto-picks, so a
// test can see whether the app stopped at the landing picker.
vi.mock('../components/LandingScreen.jsx', () => ({
  default: () => <div data-testid="landing-screen" />,
}));

vi.mock('../components/WineLab.jsx', () => ({ default: () => <div data-testid="wine-lab" /> }));
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
vi.mock('../components/GuidedDiscoveryFocalPicker.jsx', () => ({ default: () => null }));
vi.mock('../components/AlphaModeDetailsCard.jsx', () => ({ default: () => null }));
vi.mock('../components/LabsFab.jsx', () => ({ default: () => null }));
// INVENT-6: a Cookbook stub whose button hands App a Recipe Lab seed.
vi.mock('../components/CookbookLab.jsx', () => ({
  default: ({ onInventThis }) => (
    <button data-testid="cookbook-stub-invent"
      onClick={() => onInventThis({ type: 'stir-fry', main: 'chicken', pinned: [{ key: 'ginger', source: 'search' }] })}>invent</button>
  ),
}));
vi.mock('../components/GuidedTour.jsx',       () => ({ default: () => null }));
vi.mock('../components/LabTour.jsx',          () => ({ default: () => null }));
vi.mock('../components/GuidedDiscoveryResults.jsx', () => ({ default: () => null }));
vi.mock('../components/PairingMode.jsx',      () => ({ default: () => null }));
vi.mock('../components/ErrorCard.jsx',        () => ({ default: () => null }));
vi.mock('../components/BottomSheet.jsx',      () => ({ default: () => null }));
vi.mock('../components/AnimatedLogo.jsx',     () => ({ default: () => null }));

// WEBLINK-17: capture what App hands MakeRecipeStart for ?import=.
let lastMakeProps = null;
vi.mock('../components/MakeRecipeStart.jsx', () => ({
  default: (props) => {
    lastMakeProps = props;
    return <div data-testid="make-start" data-seed={props.initialInventSeed ? props.initialInventSeed.main : ''} />;
  },
}));

// CocktailLabV2 — capture matchesContext + expose an exit button.
let lastCocktailCtx   = undefined;
let lastCocktailProps = null;
let lastSauceProps    = null;
let capturedExitFn    = null;

vi.mock('../components/CocktailLabV2.jsx', () => ({
  default: (props) => {
    const { matchesContext, onExitMatches } = props;
    lastCocktailProps = props;
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
  default: (props) => {
    const { matchesContext, onExitMatches } = props;
    lastSauceProps = props;
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

// RecipeBuilderTab (the Recipe Notebook tab) — capture what App hands it.
let lastBuilderProps = null;
vi.mock('../components/RecipeBuilderTab.jsx', () => ({
  default: (props) => {
    lastBuilderProps = props;
    return <div data-testid="builder-stub" data-active={String(props.active)} />;
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
  lastBuilderProps     = null;

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

function visit(search) {
  window.history.replaceState(null, '', `/${search}`);
}


describe('App — Cookbook ✨ Invent this hands a seed to the recipe builder', () => {
  beforeEach(() => { lastMakeProps = null; lastBuilderProps = null; });
  afterEach(() => { visit(''); });

  it('switches to the Recipe Notebook builder and hands it the seed as the handoff', async () => {
    visit('?path=cookbook');
    await mountApp();
    fireEvent.click(screen.getByTestId('cookbook-stub-invent'));
    const stub = screen.getByTestId('builder-stub');
    expect(stub).toHaveAttribute('data-active', 'true');
    expect(lastBuilderProps.handoff.seed).toEqual({ type: 'stir-fry', main: 'chicken', pinned: [{ key: 'ginger', source: 'search' }] });
    expect(lastBuilderProps.handoff.ts).toBeGreaterThan(0);
  });
});

// SHARE-3: "Make it your own" on a shared recipe page leaves a seed in sessionStorage; App takes it once.
describe('App — a seed left by the shared recipe page', () => {
  beforeEach(() => { lastMakeProps = null; lastBuilderProps = null; lastCocktailProps = null; lastSauceProps = null; sessionStorage.clear(); });
  afterEach(() => { visit(''); sessionStorage.clear(); });

  const stash = (lab, seed) => sessionStorage.setItem('shared-invent-seed', JSON.stringify({ lab, seed, at: Date.now() }));

  it('cocktail: opens the Cocktail Lab with the seed, removes the stash, and clears it once consumed', async () => {
    const seed = { familyId: 1, fromName: true, pinned: [{ key: 'gin', source: 'search' }, { key: 'campari', source: 'search' }] };
    stash('cocktail', seed);
    visit('?path=cocktail');
    await mountApp();
    expect(screen.getByTestId('cocktail-lab')).toBeInTheDocument();
    expect(lastCocktailProps.initialInventSeed).toEqual(seed);
    expect(sessionStorage.getItem('shared-invent-seed')).toBeNull();
    await act(async () => { lastCocktailProps.onInventSeedConsumed(); });
    expect(lastCocktailProps.initialInventSeed).toBeNull();
  });

  it('sauce: the seed goes to the Sauce Lab only', async () => {
    const seed = { styleId: 'Hollandaise', fromName: true, pinned: [{ key: 'butter', source: 'search' }] };
    stash('sauce', seed);
    visit('?path=sauce');
    await mountApp();
    expect(lastSauceProps.initialInventSeed).toEqual(seed);
    expect(sessionStorage.getItem('shared-invent-seed')).toBeNull();
  });

  it('dish: the recipe builder opens on it (and Make a recipe is not involved)', async () => {
    const seed = { type: 'braise-stew', fromName: true, main: 'beef', pinned: [{ key: 'carrot', source: 'search' }] };
    stash('make', seed);
    visit('?path=make');
    await mountApp();
    expect(screen.getByTestId('builder-stub')).toHaveAttribute('data-active', 'true');
    expect(lastBuilderProps.handoff.seed).toEqual(seed);
    expect(sessionStorage.getItem('shared-invent-seed')).toBeNull();
  });

  it('with no stash nothing is handed over', async () => {
    visit('?path=cocktail');
    await mountApp();
    expect(lastCocktailProps.initialInventSeed).toBeNull();
  });
});
