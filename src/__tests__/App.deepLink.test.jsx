// @vitest-environment jsdom
/**
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
vi.mock('../components/CookbookLab.jsx',      () => ({ default: () => null }));
vi.mock('../components/GuidedTour.jsx',       () => ({ default: () => null }));
vi.mock('../components/LabTour.jsx',          () => ({ default: () => null }));
vi.mock('../components/GuidedDiscoveryResults.jsx', () => ({ default: () => null }));
vi.mock('../components/IngredientPicker.jsx', () => ({ default: () => null }));
vi.mock('../components/PairingMode.jsx',      () => ({ default: () => null }));
vi.mock('../components/MakeRecipeView.jsx',   () => ({ default: () => null }));
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

function visit(search) {
  window.history.replaceState(null, '', `/${search}`);
}

describe('App — shared links open the named surface', () => {
  afterEach(() => { visit(''); });

  it('?path=cocktail skips the landing picker and opens the Cocktail Lab', async () => {
    visit('?path=cocktail');
    await mountApp();
    expect(screen.queryByTestId('landing-screen')).toBeNull();
    expect(screen.getByTestId('cocktail-lab')).toBeInTheDocument();
  });

  it('?path=sauce opens the Sauce Lab', async () => {
    visit('?path=sauce');
    await mountApp();
    expect(screen.getByTestId('sauce-lab')).toBeInTheDocument();
  });

  it('a bare visit shows the landing picker and leaves the URL clean', async () => {
    visit('');
    await mountApp();
    expect(screen.getByTestId('landing-screen')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('an unknown ?path= falls back to the landing picker', async () => {
    visit('?path=nonsense');
    await mountApp();
    expect(screen.getByTestId('landing-screen')).toBeInTheDocument();
  });
});
