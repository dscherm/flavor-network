// @vitest-environment jsdom
/**
 * BUILDER-3: the Recipe Notebook tab is the chalkboard builder. Every way into it opens that builder on the
 * handed-over recipe, and the build in progress survives a trip to another tab and back.
 * The real RecipeBuilderTab and InventRecipe run; the door components are stubs with a button each.
 * (Mocks copied from App.inventThis.test.jsx.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

// ── Module mocks ──────────────────────────────────────────────────────────────

// LandingScreen — passive: renders a marker and never auto-picks, so a
// test can see whether the app stopped at the landing picker.
vi.mock('../components/LandingScreen.jsx', () => ({
  default: () => <div data-testid="landing-screen" />,
}));

vi.mock('../components/WineLab.jsx', () => ({ default: () => <div data-testid="wine-lab" /> }));
vi.mock('../components/LivingArchView.jsx',   () => ({ default: () => <div data-testid="living-arch" /> }));
vi.mock('../components/NetworkScene.jsx',     () => ({ default: () => <div data-testid="network-scene" /> }));
vi.mock('../components/SearchBar.jsx',        () => ({ default: ({ onSelect }) => <button data-testid="door-pick-tomato" onClick={() => onSelect('tomato')}>pick</button> }));
vi.mock('../components/IngredientPanel.jsx',  () => ({ default: ({ onBuildRecipe }) => <button data-testid="door-network" onClick={onBuildRecipe}>build</button> }));
vi.mock('../components/Controls.jsx',         () => ({ default: () => null }));
vi.mock('../components/Walkthrough.jsx',      () => ({ default: () => null }));
vi.mock('../components/HelpButton.jsx',       () => ({ default: () => null }));
vi.mock('../components/ProfilePanel.jsx',     () => ({ default: ({ onLoadRecipe, profile }) => (
  <div data-testid="profile-stub">
    {(profile.recipes || []).map((r, i) => <button key={i} data-testid={`door-profile-${i}`} onClick={() => onLoadRecipe(r)}>{r.name}</button>)}
  </div>
) }));
vi.mock('../components/GlobalInsights.jsx',   () => ({ default: () => null }));
vi.mock('../components/FlavorTreeExplorer.jsx', () => ({ default: () => null }));
vi.mock('../components/ClusterJoystick.jsx',  () => ({ default: () => null }));
vi.mock('../components/HowItWorks.jsx',       () => ({ default: () => null }));
vi.mock('../components/TrainingTraceModal.jsx',() => ({ default: () => null }));
vi.mock('../components/MobileTabBar.jsx',     () => ({ default: ({ onTabChange }) => (<div>{['cocktail', 'profile', 'recipe', 'make', 'cookbook', 'pairing'].map((t) => <button key={t} data-testid={`tab-${t}`} onClick={() => onTabChange(t)}>{t}</button>)}</div>) }));
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
  default: ({ onOpenRecipeLab, pickerMode }) => (
    <button data-testid="door-cookbook" data-picker={String(pickerMode)}
      onClick={() => onOpenRecipeLab('recipe', ['tomato', 'basil'], { source: 'make-cookbook', recipeType: 'italian', title: 'Caprese' })}>cookbook</button>
  ),
}));
vi.mock('../components/GuidedTour.jsx',       () => ({ default: () => null }));
vi.mock('../components/LabTour.jsx',          () => ({ default: () => null }));
vi.mock('../components/GuidedDiscoveryResults.jsx', () => ({ default: () => null }));
vi.mock('../components/PairingMode.jsx',      () => ({ default: () => null }));
vi.mock('../components/ErrorCard.jsx',        () => ({ default: () => null }));
vi.mock('../components/BottomSheet.jsx',      () => ({ default: () => null }));
vi.mock('../components/AnimatedLogo.jsx',     () => ({ default: () => null }));

let lastMakeProps = null;
vi.mock('../components/MakeRecipeStart.jsx', () => ({
  default: (props) => {
    lastMakeProps = props;
    return (
      <div data-testid="make-start">
        <button data-testid="door-make-invent" onClick={() => { props.setRecipeMounted(true); props.setActiveTab('recipe'); }}>invent</button>
        <button data-testid="door-make-send" onClick={() => {
          props.setRecipeHandoff({ source: 'make-kitchen', mode: 'recipe', ingredients: ['tomato', 'basil'], title: 'Kitchen dish', steps: ['Chop.', 'Cook.'], stepsFrom: 'Kitchen dish', ts: Date.now() });
          props.setRecipeMounted(true); props.setActiveTab('recipe');
        }}>send</button>
        <button data-testid="door-make-weblink" onClick={() => {
          props.setRecipeHandoff({ source: 'make-weblink', ingredients: ['tomato', 'basil'], title: 'From a link', sourceUrl: 'https://example.com/r', mode: 'recipe', ts: Date.now() });
          props.setRecipeMounted(true); props.setActiveTab('recipe');
        }}>link</button>
        <span data-testid="make-initial-panel">{String(props.initialPanel)}</span>
      </div>
    );
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
        <button data-testid="door-cocktail" onClick={() => props.onOpenRecipeLab('cocktail', ['gin', 'tomato'])}>notebook</button>
        {matchesContext && <button data-testid="cocktail-back" onClick={props.onBackToRecipe}>back to recipe</button>}
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
        <button data-testid="door-sauce" onClick={() => props.onOpenRecipeLab('sauce', ['tomato', 'basil'])}>notebook</button>
      </div>
    );
  },
}));

// The ML runtimes the real builder asks for.
vi.mock('../ml/kitchenRuntime.js', () => ({
  loadRealRecipes: vi.fn(async () => ({ index: { recipes: [], inv: {} }, vocab: [] })),
  loadInventModel: vi.fn(async () => null),
}));
vi.mock('../ml/quantityRuntime.js', () => ({ predictBowlAmounts: vi.fn(async (names) => names.map((name) => ({ name, amount: null }))) }));
vi.mock('../components/PairingLab.jsx', () => ({
  default: ({ onSendToRecipe }) => <button data-testid="door-pairing" onClick={() => onSendToRecipe(['tomato', 'basil'], 'Plate')}>plate</button>,
}));
vi.mock('../components/RecipeFlavorProfilesCard.jsx', () => ({ default: () => null }));

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
const PROFILE = {
  recipes: [
    // saved by the old Notebook: names only
    { name: 'Old Notebook Soup', ingredients: [{ name: 'tomato', quantity: null, unit: null, raw: 'tomato' }, { name: 'basil', quantity: null, unit: null, raw: 'basil' }] },
    // an invention: has an id and amounts
    { id: 'inv-1', source: 'invent', name: 'My Pasta', cuisine: 'Italian', ingredients: [{ name: 'tomato', quantity: null, unit: null, raw: '2 cups tomato' }, { name: 'basil', quantity: null, unit: null, raw: '1 tbsp basil' }] },
  ],
  cocktails: [], sauces: [], shares: [], shopping: {},
};
const SAVE = { fn: null };
vi.mock('../hooks/useUserProfile.js', () => ({
  default: () => ({
    hasIngredient: () => false, toggleIngredient: () => {},
    togglePairing: () => {}, hasPairing: () => false,
    profile: PROFILE,
    saveInvention: (...a) => (SAVE.fn ? SAVE.fn(...a) : { ok: true }),
    updateShopping: () => {},
  }),
}));
vi.mock('../hooks/useAuth.js', () => ({
  default: () => ({ user: { uid: 'u1' }, loginWithGoogle: () => {}, loginWithApple: () => {}, logout: () => {} }),
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


const lineKeys = () => screen.queryAllByTestId('invent-recipe-list-line').map((r) => r.getAttribute('data-key'));
const nameBox = () => screen.getByTestId('invent-recipe-namesave-name');
const goTab = async (t) => { await act(async () => { fireEvent.click(screen.getByTestId(`tab-${t}`)); }); };
const press = async (id) => { await act(async () => { fireEvent.click(screen.getByTestId(id)); }); };
const startWith = async (text) => {
  await act(async () => { fireEvent.change(screen.getByTestId('invent-recipe-start-input'), { target: { value: text } }); });
  await act(async () => { fireEvent.click(screen.getByTestId('invent-recipe-start-go')); });
};
const builder = () => screen.findByTestId('invent-recipe');
const hiddenWrapper = () => screen.getByTestId('recipe-builder-tab').parentElement;

describe('App — the Recipe Notebook tab is the chalkboard builder', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); SAVE.fn = null; });
  afterEach(() => { visit(''); });

  it('?path=notebook shows the chalkboard builder at its first question, and no paper page', async () => {
    visit('?path=notebook');
    await mountApp();
    expect(await builder()).toBeInTheDocument();
    expect(screen.getByTestId('invent-recipe-start-question')).toHaveTextContent('What is the main ingredient?');
    expect(screen.queryByTestId('notebook-paper')).toBeNull();
    expect(document.querySelector('[data-testid="recipe-lab"], [data-testid="recipe-notebook"]')).toBeNull();
  });

  it('door: Network panel "build recipe" opens the builder with the selected ingredients', async () => {
    visit('?path=explore');
    await mountApp();
    await press('door-pick-tomato');
    await press('door-network');
    await builder();
    expect(lineKeys()).toEqual(['tomato']);
  });

  it('door: Profile "load recipe" opens a recipe saved by the old Notebook (names only) with its title', async () => {
    visit('?path=profile');
    await mountApp();
    await press('door-profile-0');
    await builder();
    expect(lineKeys()).toEqual(['tomato', 'basil']);
    expect(nameBox()).toHaveValue('Old Notebook Soup');
  });

  it('door: Profile "load recipe" on an invention keeps its amounts, title and cuisine', async () => {
    visit('?path=profile');
    await mountApp();
    await press('door-profile-1');
    await builder();
    expect(lineKeys()).toEqual(['tomato', 'basil']);
    expect(nameBox()).toHaveValue('My Pasta');
    expect(screen.getByTestId('invent-recipe-list-amount-tomato')).toHaveValue('2 cups');
    expect(screen.getByTestId('invent-recipe-list-amount-basil')).toHaveValue('1 tbsp');
  });

  it("door: Cocktail Lab 'open in Recipe Notebook' opens the builder with the cocktail's ingredients", async () => {
    visit('?path=cocktail');
    await mountApp();
    await press('door-cocktail');
    await builder();
    expect(lineKeys()).toEqual(['gin', 'tomato']);
  });

  it("door: Sauce Lab 'open in Recipe Notebook' opens the builder with the sauce's ingredients", async () => {
    visit('?path=sauce');
    await mountApp();
    await press('door-sauce');
    await builder();
    expect(lineKeys()).toEqual(['tomato', 'basil']);
  });

  it("door: the Cookbook opens the builder with the recipe's ingredients and title", async () => {
    visit('?path=cookbook');
    await mountApp();
    await press('door-cookbook');
    await builder();
    expect(lineKeys()).toEqual(['tomato', 'basil']);
    expect(nameBox()).toHaveValue('Caprese');
  });

  it('door: the Pairing Lab "send to recipe" opens the builder with the plate and its title', async () => {
    visit('?path=pairing');
    await mountApp();
    await press('door-pairing');
    await builder();
    expect(lineKeys()).toEqual(['tomato', 'basil']);
    expect(nameBox()).toHaveValue('Plate');
  });

  it('door: Make a recipe sending a recipe (kitchen) keeps its lines, title and method steps', async () => {
    visit('?path=make');
    await mountApp();
    await press('door-make-send');
    await builder();
    expect(lineKeys()).toEqual(['tomato', 'basil']);
    expect(nameBox()).toHaveValue('Kitchen dish');
    fireEvent.click(within(screen.getByTestId('invent-recipe-handoff-method')).getByRole('button'));
    expect(screen.getByTestId('invent-recipe-handoff-steps')).toHaveTextContent('Chop.');
  });

  it('door: a link import (make-weblink) opens the builder with the parsed ingredients and title', async () => {
    visit('?path=make');
    await mountApp();
    await press('door-make-weblink');
    await builder();
    expect(lineKeys()).toEqual(['tomato', 'basil']);
    expect(nameBox()).toHaveValue('From a link');
  });

  it("door: Make a recipe's Invent a recipe card goes to the same builder tab, at its first question", async () => {
    visit('?path=make');
    await mountApp();
    await press('door-make-invent');
    await builder();
    expect(screen.getByTestId('invent-recipe-start-question')).toBeInTheDocument();
  });

  it('switching to another tab and back keeps the build in progress; a new handoff replaces it', async () => {
    visit('?path=notebook');
    await mountApp();
    await builder();
    await startWith('tomato');
    const before = lineKeys();
    expect(before.length).toBe(1);
    await goTab('cocktail');
    expect(screen.getByTestId('cocktail-lab')).toBeInTheDocument();
    expect(hiddenWrapper().className).toMatch(/hidden/);
    await goTab('recipe');
    expect(lineKeys()).toEqual(before);
    await goTab('make');
    await goTab('recipe');
    expect(lineKeys()).toEqual(before);
    await goTab('cocktail');
    await press('door-cocktail');
    expect(lineKeys()).toEqual(['gin', 'tomato']);
  });

  it('the matches round trip: Find a cocktail from the builder and Back returns to the same build', async () => {
    visit('?path=notebook');
    await mountApp();
    await builder();
    await startWith('tomato');
    const before = lineKeys();
    await act(async () => { fireEvent.click(screen.getByTestId('invent-recipe-find-cocktail')); });
    expect(await screen.findByTestId('cocktail-matches')).toBeInTheDocument();
    expect(hiddenWrapper().className).toMatch(/hidden/);
    await press('cocktail-back');
    expect(hiddenWrapper().className).not.toMatch(/hidden/);
    expect(lineKeys()).toEqual(before);
  });

  it('Back from a builder opened from the Cocktail Lab returns to the Cocktail Lab', async () => {
    visit('?path=cocktail');
    await mountApp();
    await press('door-cocktail');
    await builder();
    await act(async () => { fireEvent.click(screen.getByTestId('invent-recipe-close')); });
    expect(screen.getByTestId('cocktail-lab').parentElement.className).not.toMatch(/hidden/);
    expect(hiddenWrapper().className).toMatch(/hidden/);
  });

  it('a recipe the old Notebook saved (names only), renamed and saved, replaces itself: it appears once', async () => {
    const { saveInvention } = await import('../data/savedInventions.js');
    let profile = { recipes: [...PROFILE.recipes] };
    SAVE.fn = (input) => { const r = saveInvention(profile, input, { makeId: () => 'new-1' }); if (r.ok) profile = r.profile; return r; };
    visit('?path=profile');
    await mountApp();
    await press('door-profile-0');
    await builder();
    await act(async () => { fireEvent.change(nameBox(), { target: { value: 'Tomato Basil Soup' } }); });
    await act(async () => { fireEvent.click(screen.getByTestId('invent-recipe-namesave-save')); });
    await screen.findByTestId('invent-recipe-namesave-status');
    const names = profile.recipes.map((r) => r.name);
    expect(names.filter((n) => n === 'Tomato Basil Soup')).toHaveLength(1);
    expect(names).not.toContain('Old Notebook Soup');
    expect(profile.recipes).toHaveLength(PROFILE.recipes.length);
  });
});
