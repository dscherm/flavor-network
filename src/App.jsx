import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import useProData from './hooks/useProData.js';
import { topAffinities } from './data/affinityTiers.js';
const MoleculeLab = lazy(() => import('./components/MoleculeLab.jsx'));
// MoleculeOfTheDay shelved — the floating card is no longer mounted, but
// the component + fetch logic stay in src/components/MoleculeOfTheDay.jsx
// so we can re-surface it as a feature later (e.g. as a card on the
// landing page or inside Molecule Lab). Re-enable: uncomment this lazy
// import and the JSX block further down.
// const MoleculeOfTheDay = lazy(() => import('./components/MoleculeOfTheDay.jsx'));
// DiscoverPatterns + DiscoverCTA + FlavorBridge removed from the
// shipping surface per polish pass; GlobalInsights is kept in the
// codebase but no longer reachable from the UI.
import ClusterJoystick from './components/ClusterJoystick.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import TrainingTraceModal from './components/TrainingTraceModal.jsx';
// StartPage left in the codebase as a fallback — superseded by
// LandingScreen as of the brand-mark refresh. Re-enable by swapping
// the import back if LandingScreen needs to be reverted.
// import StartPage from './components/StartPage.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import ErrorCard from './components/ErrorCard.jsx';
import {
  readStartPageFlag,
  writeStartPageFlag,
  clearStartPageFlag,
} from './utils/startPageFlag.js';
import SearchBar from './components/SearchBar.jsx';
import IngredientPanel from './components/IngredientPanel.jsx';
import Controls from './components/Controls.jsx';
import { getNeighbors, getNeighborsEnriched, findStrongestPath } from './data/graph.js';
import { getAllCuisines, getAllTastes } from './data/metadata.js';
import Walkthrough from './components/Walkthrough.jsx';
import HelpButton from './components/HelpButton.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import GlobalInsights from './components/GlobalInsights.jsx';
import FlavorTreeExplorer from './components/FlavorTreeExplorer.jsx';
import LivingArchView from './components/LivingArchView.jsx';
import CocktailLabV2 from './components/CocktailLabV2.jsx';
import SauceLab from './components/SauceLab.jsx';
import RecipeLab from './components/RecipeLab.jsx';
import MobileTabBar from './components/MobileTabBar.jsx';
import GuidedDiscoverySwipe from './components/GuidedDiscoverySwipe.jsx';
import CookbookLab from './components/CookbookLab.jsx';
import MakeRecipeStart from './components/MakeRecipeStart.jsx';
import GuidedTour from './components/GuidedTour.jsx';
import LabTour from './components/LabTour.jsx';
import GuidedDiscoveryResults from './components/GuidedDiscoveryResults.jsx';
import { deriveFilterStackFromBubbles } from './data/guidedDiscovery.js';
import {
  MODE_CYCLE as NETWORK_MODE_CYCLE,
  MODE_LABELS as NETWORK_MODE_LABELS,
  MODE_TO_AXIS as NETWORK_MODE_TO_AXIS,
  DEFAULT_MODE as NETWORK_DEFAULT_MODE,
  FILTER_TO_AXIS,
  morphAxisForStack,
} from './data/networkModes.js';
import { CATEGORICAL_AXES, bucketOf } from './data/categoricalAxes.js';
import FilterPillRow from './components/FilterPillRow.jsx';
import FilterBreadcrumb from './components/FilterBreadcrumb.jsx';
import HUDAnnouncer from './components/HUDAnnouncer.jsx';
import FilterPullSlider from './components/FilterPullSlider.jsx';
import InsightChip from './components/InsightChip.jsx';
import BridgePulseOverlay from './components/BridgePulseOverlay.jsx';
import AffinityTriangleOverlay from './components/AffinityTriangleOverlay.jsx';
import WedgeGridFlavorWheel from './components/WedgeGridFlavorWheel.jsx';
import InsightDrawer from './components/InsightDrawer.jsx';
import { rankBridges } from './data/bridgeRanker.js';
import { computeRecipeAroma, rankByAromaSimilarity } from './data/recipeAromaSimilarity.js';
import { computeClusterBucketOverlap } from './data/clusterBucketOverlap.js';
import { computeBucketPoles2D, computeBucketPoles3D, fibonacciSphere, POLE_RADIUS } from './data/bucketPoles.js';
import { getCocktailScope, getSauceScope } from './data/labScope.js';
import BottomSheet from './components/BottomSheet.jsx';
import useIsMobile from './hooks/useIsMobile.js';
import useUserProfile from './hooks/useUserProfile.js';
import useAuth from './hooks/useAuth.js';

// Spec §1.H — URL deep-link routing. `?path=<slug>` ↔ activeTab.
// 2026-05-29 DOCS-RL-COOKBOOK-RENAME: 'cookbook' tab key renamed to
// 'cookbook'. Legacy URL slug `?path=recipes` still resolves to the
// new cookbook tab via the PATH_TO_TAB back-compat alias so any
// previously-shared links keep working.
const TAB_TO_PATH = {
  network: 'explore',
  cocktail: 'cocktail',
  sauce: 'sauce',
  recipe: 'notebook',
  cookbook: 'cookbook',
  guided: 'guided',
  'guided-results': 'guided',         // ephemeral; collapse to entry
  make: 'make',
  profile: 'profile',
};
const PATH_TO_TAB = Object.fromEntries(
  Object.entries({
    explore: 'network',
    cocktail: 'cocktail',
    sauce: 'sauce',
    notebook: 'recipe',
    cookbook: 'cookbook',
    recipes: 'cookbook',  // back-compat alias for pre-rename shared URLs
    guided: 'guided',
    build: 'make',        // MAKE-BUILD-DEPRECATE: legacy ?path=build → make
    make: 'make',
    profile: 'profile',
  }),
);

export default function App() {
  // StartPage gate — ALWAYS shown on launch. Users explicitly pick a
  // model entry (Pairing / Cocktail / Sauce) every time the app opens
  // so the experience reads as "pick what you want to explore" rather
  // than dropping the user into wherever they were last. While false,
  // useProData is disabled so the 27MB pairings payload does not
  // download until the user clicks a card.
  const [startPageComplete, setStartPageComplete] = useState(false);
  const [howItWorksInitialOpen, setHowItWorksInitialOpen] = useState(false);
  // R20.1 — lift HowItWorks open state so the Network-tab dropdown can
  // trigger the modal alongside the legacy floating "?" button on other
  // tabs. Floating button is hidden on the Network tab to avoid two
  // simultaneous question icons fighting for top-right real-estate.
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  // R8-49 — first-launch training-trace modal. Triggered once per user
  // via localStorage['fn-training-trace-seen']; ?reset=trace clears it.
  const [trainingTraceOpen, setTrainingTraceOpen] = useState(false);
  const trainingTraceCheckedRef = useRef(false);
  const handleTrainingTraceClose = useCallback(() => {
    setTrainingTraceOpen(false);
    try { localStorage.setItem('fn-training-trace-seen', '1'); } catch {}
  }, []);
  // Tracks which landing tile the user just tapped, so the loading
  // surface (LandingScreen with isLoading=true) can shimmer the picked
  // tile rather than the whole row. Reset on handleStartOver.
  const [landingPick, setLandingPick] = useState(null);

  // Primary data source: ProData (proprietary dataset from RecipeNLG + MealDB + CocktailDB)
  const { loading, error, data, retry } = useProData({ enabled: startPageComplete });
  const { user, loginWithGoogle, loginWithApple, logout } = useAuth();
  // R8-49 — auto-open the Training Trace modal once after data is ready
  // and the user has cleared the landing screen. ?reset=trace lets a
  // user replay the onboarding by clearing the localStorage flag.
  useEffect(() => {
    if (trainingTraceCheckedRef.current) return;
    if (loading || !data || !startPageComplete) return;
    trainingTraceCheckedRef.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === 'trace') {
        localStorage.removeItem('fn-training-trace-seen');
      }
      if (localStorage.getItem('fn-training-trace-seen') !== '1') {
        setTrainingTraceOpen(true);
      }
    } catch {}
  }, [loading, data, startPageComplete]);
  // Spec §1.H — URL deep-link routing. `?path=…` lets users share a
  // link to any top-level surface. Only stable surfaces are routable;
  // ephemeral states (guided-results) fall back to their entry tab.
  // Legacy `?path=build` redirects to make. Reverse mapping in PATH_TO_TAB.
  const initialTab = (() => {
    if (typeof window === 'undefined') return 'network';
    const path = new URLSearchParams(window.location.search).get('path');
    return PATH_TO_TAB[path] || 'network';
  })();
  const [activeTab, setActiveTab] = useState(initialTab); // 'network' | 'cocktail' | 'sauce' | 'recipe' | 'guided' | 'guided-results' | 'build' | 'profile' | 'cookbook'

  // Write the current tab back to the URL so reload + share both work.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = TAB_TO_PATH[activeTab];
    const params = new URLSearchParams(window.location.search);
    if (target) params.set('path', target);
    else params.delete('path');
    const next = params.toString();
    const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, '', url);
    }
  }, [activeTab]);

  // UX pipeline Phase 1 (2026-05-16) — when the Explore sub-nav is
  // visible (network / cocktail / sauce / recipe), bump `--nav-h` so
  // SearchBar + IngredientPanel + the cluster joystick + every other
  // consumer of `var(--nav-h)` clears the secondary row instead of
  // sitting under it. Primary row = 2.5rem; secondary row = 2rem.
  useEffect(() => {
    const isExplore = ['network', 'cocktail', 'sauce', 'recipe'].includes(activeTab);
    const baseRem = isExplore ? 4.5 : 2.5;
    document.documentElement.style.setProperty(
      '--nav-h',
      `calc(${baseRem}rem + env(safe-area-inset-top, 0px))`,
    );
  }, [activeTab]);
  // P8 ADR-2: Clear aroma-match context when user leaves the target Lab.
  // Prevents stale match state from persisting if user returns to Cocktail /
  // Sauce Lab via a different path (e.g. clicking the tab directly).
  useEffect(() => {
    if (activeTab !== 'cocktail' && activeTab !== 'sauce') {
      setMatchesContext(null);
    }
  }, [activeTab]);

  // Phase 3 Guided Discovery — bubbleStack is plumbed at the App level
  // so GuidedDiscoveryStart can hand off to GuidedDiscoveryResults
  // without losing state on tab flip. Per Constraint #4, the only
  // place setFilterStack is called from a Guided context is
  // onExploreInNetwork below (the canonical bridge).
  const [bubbleStack, setBubbleStack] = useState([]);
  // Track 3 / P5 — GuidedDiscoverySwipe's new `{ ingredient, filterType }`
  // payload feeds GuidedDiscoveryResults' initial pill via this state.
  const [guidedInitialFilterType, setGuidedInitialFilterType] = useState(null);
  // Phase 5 (2026-05-16) — Build path mirrors bubbleStack but the
  // ingredient bubble's value carries a `{ingredients: string[]}`
  // array instead of `{ingredient: string}`. Kept separate from the
  // Guided bubbleStack so the two flows don't cross-contaminate
  // state if the user bounces between them.
  // externalLabFilter is passed to Cocktail/Sauce/Recipes labs when
  // bridging from the Build flow. Pill state in the destination lab
  // reads this prop on mount.
  const [externalLabFilter, setExternalLabFilter] = useState(null);
  // P8: aroma-match context. Set when user clicks a "Find a Cocktail /
  // Sauce" pill in the Recipe Notebook. Cleared when the user leaves
  // the target Lab tab (ADR-2 contract).
  // Shape: { recipeName: string, items: AromaMatchResult[] } | null
  const [matchesContext, setMatchesContext] = useState(null);
  // Phase 6 (2026-05-16) — Guided Tour controller state. Set by a
  // radar click on the Guided/Build results pages; consumed by the
  // GuidedTour overlay mounted on the network tab.
  const [tourActive, setTourActive] = useState(false);
  const [tourAxis, setTourAxis] = useState('taste');
  const [tourFocal, setTourFocal] = useState(null);
  // §2.J — per-lab follow-on tour. Set when user picks a lab from the
  // main tour's chooseLab stage. Cleared when the lab tour ends.
  const [labTourKey, setLabTourKey] = useState(null);
  // rAF handle for the tour's pullStrength animation. Held in a ref so
  // sceneHandle methods can cancel an in-flight animation when the
  // user advances stages or skips the tour.
  const tourAnimRef = useRef(null);
  // §2.G.3 — pill-pulse highlight. ClusterJoystick reads this prop and
  // adds a pulse animation to the matching pill.
  const [tourHighlightedCluster, setTourHighlightedCluster] = useState(null);
  // GD-TOUR-AXIS-INTENT-CARRY (2026-05-30): the axis label the user
  // tapped on the radar (e.g. 'sweet') is distinct from the filterType
  // morph axis (e.g. 'taste'). The focal pulls to its OWN bucket on
  // the morph axis (umami for tomato) — bridge the mental model by
  // surfacing both the focal's bucket and the chosen sub-axis on
  // Step 1's popup.
  const [tourChosenAxisKey, setTourChosenAxisKey] = useState(null);
  const [tourFocalBucket, setTourFocalBucket] = useState(null);
  // GD-TOUR-STEP4-CLARITY (2026-05-30): runClusterDemo picks a random
  // cluster each tour run; surface its name to GuidedTour so Step 4's
  // copy can name the specific pill the user should watch for.
  const [tourPickedClusterName, setTourPickedClusterName] = useState(null);
  // §2.H.1 — programmatically glow N ingredient nodes. LivingArchView
  // already overlays glow on selectedNodes; we reuse that channel for
  // tour-time multi-selection.
  const [tourGlowNodes, setTourGlowNodes] = useState(null);
  // joystickClusters snapshot for sceneHandle.flyToCluster — the
  // sceneHandle useMemo runs before joystickClusters, so we mirror
  // it into a ref the handle methods can read at call time.
  const joystickClustersRef = useRef(null);
  // Holds the cluster picked by runClusterDemo so subsequent stages
  // (glow, final affinity) can read it without re-rolling the dice.
  const tourClusterRef = useRef(null);
  const [cocktailMounted, setCocktailMounted] = useState(false);
  const [sauceMounted, setSauceMounted] = useState(false);
  const [recipeMounted, setRecipeMounted] = useState(false);
  const [recipeInitialMode, setRecipeInitialMode] = useState(null);
  const [cookbookPickerMode, setCookbookPickerMode] = useState(null);
  // One-shot handoff payload to the Recipe Lab. ONLY explicit user
  // actions ("Build Recipe" from the IngredientPanel, "Open in Recipe
  // Lab" from a cocktail/sauce card) write to this. The Recipe Lab
  // resets its bowl every time `ts` changes — never on plain
  // `selectedNodes` updates, so clicking around in the Network /
  // Cocktail / Sauce tabs no longer silently pollutes the recipe.
  const [recipeHandoff, setRecipeHandoff] = useState(null);
  const [moleculeLabOpen, setMoleculeLabOpen] = useState(false);
  // SMILES to seed the Molecule Lab with on open (set when user clicks
  // "Open in Molecule Lab" on the Molecule of the Day card).
  const [moleculeLabPreset, setMoleculeLabPreset] = useState('');
  const [labDropdownOpen, setLabDropdownOpen] = useState(false);
  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  // Desktop Network-button dropdown — same dual-role behavior as
  // MobileTabBar's Network button: tap to switch tabs, tap when
  // already on Network to open the 4-way mode selector.
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  // R16 Phase 1: split the old single `livingMode` into two orthogonal
  // controls — `mode` (3D/2D geometry) and `filterStack` (ordered
  // categorical filters that drive the morph axis + visibility
  // predicate). Legacy mode keys (ml/ml2d/neural/taste2d/aromas2d/
  // cuisine2d/season2d/family2d) are no longer reachable from the
  // dropdown but are still understood by the renderer as fallbacks.
  const [mode, setMode] = useState(NETWORK_DEFAULT_MODE);
  // Default to Flavor Graph (chef-tier1 aroma coloring) so the scene
  // lands on the semantically-meaningful color axis instead of the
  // raw multi-tag fallback. Chef-user 2026-05-29: the "Flavor Graph"
  // pill colors nodes by chef tier1 family; "None" defaults to a
  // less-readable per-node fallback. Defaulting to Flavor Graph keeps
  // the visual story consistent with the GAT-positioned clusters.
  const [filterStack, setFilterStack] = useState(['flavor-category']);
  // R17/R18 — continuous pull strength. 0 = pure cooccurrence, 1 =
  // full bucket-pole snap. Starts at 0 on every fresh activation
  // (filterStack going from empty → non-empty resets it via the
  // useEffect below) so the user is shown the unaltered network
  // first, then drags the slider to reveal the morph.
  const [pullStrength, setPullStrength] = useState(0);
  const prevFilterStackLenRef = useRef(0);
  useEffect(() => {
    if (prevFilterStackLenRef.current === 0 && filterStack.length > 0) {
      setPullStrength(0);
    }
    prevFilterStackLenRef.current = filterStack.length;
  }, [filterStack.length]);
  const [showEdges, setShowEdges] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [edgeBrightness] = useState(0.3);
  const [particleBrightness] = useState(0.3);
  const [selectedNodes, setSelectedNodes] = useState([]);
  // Two-stage selection per canonical spec §3.5: single-click → panel
  // only (selectedNodes set); double-click on the same node within
  // 350ms → also sets affinityRequested → α-mode engages. Long-press
  // (touch-hold ≥350ms) also sets affinityRequested. ESC clears only
  // affinityRequested (keeps the panel open).
  const [affinityRequested, setAffinityRequested] = useState(false);
  const lastNodeClickRef = useRef({ name: null, at: 0 });
  // Canonical-spec (2026-05-23 user-iter): single-click on a network
  // node spawns a SMALL POPUP near the cursor showing the flavor
  // graph rows (aroma / taste / mouthfeel / leaves). The full
  // IngredientPanel still opens in the side drawer with the rest of
  // the details; the popup is just a quick read of the tier data.
  const [tierPopup, setTierPopup] = useState(null); // { name, x, y } | null
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [selectedTaste, setSelectedTaste] = useState('');
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem('flavor-tour-complete')
  );
  // GlobalInsights kept in the codebase (component file + this state)
  // but no longer reachable from the UI per the polish pass — no
  // toggle is wired up after this change. Re-expose by adding a
  // setShowGlobalInsights(true) trigger when ready to ship.
  const [showGlobalInsights, setShowGlobalInsights] = useState(false);
  const [showTreeExplorer, setShowTreeExplorer] = useState(false);
  const [treeFilterIngredients, setTreeFilterIngredients] = useState(null);
  const [treeFilterLabel, setTreeFilterLabel] = useState(null);
  const [showFilteredList, setShowFilteredList] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [hoveredPole, setHoveredPole] = useState(null);
  // R19 Phase 3 — one-shot bridge pulse snapshot. LivingArchView fires
  // this when pullStrength crosses 0.5; the BridgePulseOverlay below
  // self-clears after the 1.5s animation completes.
  const [bridgePulse, setBridgePulse] = useState(null);
  // Track 2 — AffinityTriangleOverlay reads from this ref via its own
  // ~20Hz RAF instead of going through React state, so 60Hz camera
  // motion doesn't force App-level re-renders. LivingArchView writes
  // here per-frame while AffinityMode is engaged.
  const affinityProjectionRef = useRef(null);
  // R19 Phase 4 — opt-in InsightDrawer toggle. Closed by default;
  // user clicks the `?` button next to the FilterPillRow to open.
  const [insightDrawerOpen, setInsightDrawerOpen] = useState(false);
  const [highlightPairings, setHighlightPairings] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [clusterHighlights, setClusterHighlights] = useState(null);
  const [focusedCluster, setFocusedCluster] = useState(null);
  const isMobile = useIsMobile();
  // R13-6: kill-switch URL param ?affinity=v0 disables α-mode + β-mode.
  // Phase 1 (cluster relabel) ships unconditionally — not gated.
  const affinityEnabled = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return new URLSearchParams(window.location.search).get('affinity') !== 'v0';
  }, []);

  const [activePanel, setActivePanel] = useState(null);
  const userProfile = useUserProfile(user);

  // R16 Phase 1: derived values from the (mode, filterStack) tuple.
  //   activeFilter — the tail of the stack (most-recently-toggled filter)
  //   morphAxis    — the axis that drives the wheel layout. Walks the
  //                  stack tail-first, skipping scope filters whose
  //                  FILTER_TO_AXIS entry is null. `null` = cooccurrence.
  const activeFilter = filterStack.length > 0 ? filterStack[filterStack.length - 1] : null;
  const morphAxis = morphAxisForStack(filterStack);

  // R17 — the effectiveLegacyMode translation shim from R16 P1 is
  // gone. Position is now a continuous lerp between cooccurrence base
  // (mode-dependent: posA / posB) and the bucket pole (axis-dependent)
  // weighted by pullStrength. The renderer reads (mode, filterStack,
  // morphAxis, pullStrength) and does the lerp per-instance.
  const handlePullChange = useCallback((v) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('r17-pull-change');
    }
    setPullStrength(v);
  }, []);

  // Imperative scene handle for GuidedTour (F-1). Wraps the App-level
  // setters that drive the live scene so the tour controller can
  // engage AffinityMode, animate the pull tab from 0→1 on an axis, and
  // clear filters between stages — without LivingArchView needing its
  // own forwardRef. Animation is plain rAF over ~2.5s, cancelable via
  // tourAnimRef so stage advance / skip don't leave a stuck animator.
  const sceneHandle = useMemo(() => ({
    engageAffinity(name) {
      if (!name) return;
      setSelectedNodes([name]);
      setAffinityRequested(true);
    },
    animatePull(axis) {
      const axisFilter = axis === 'aroma' ? 'aromas' : axis;
      // 2.E.1 — disengage AffinityMode before morphing the network;
      // affinity rings would float over the bucket-pole layout and
      // confuse the pull-tab demo. Selection clears = α-mode exits.
      setSelectedNodes([]);
      setFilterStack((prev) => (prev.length === 1 && prev[0] === axisFilter ? prev : [axisFilter]));
      setPullStrength(0);
      if (tourAnimRef.current) {
        cancelAnimationFrame(tourAnimRef.current);
        tourAnimRef.current = null;
      }
      const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const duration = 2500;
      const tick = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setPullStrength(eased);
        if (t < 1) {
          tourAnimRef.current = requestAnimationFrame(tick);
        } else {
          tourAnimRef.current = null;
        }
      };
      tourAnimRef.current = requestAnimationFrame(tick);
    },
    clearFilters() {
      if (tourAnimRef.current) {
        cancelAnimationFrame(tourAnimRef.current);
        tourAnimRef.current = null;
      }
      setFilterStack([]);
      setPullStrength(0);
    },
    // §2.G.3 — pulse a cluster pill in ClusterJoystick.
    highlightCluster(clusterId) {
      setTourHighlightedCluster(clusterId);
    },
    // §2.G.4 — programmatic camera fly-to a cluster. Resolves the
    // cluster object from joystickClustersRef so LivingArchView's
    // flyToTarget useEffect picks it up the same way a user pill-tap
    // would. Falls back to a no-op if the cluster isn't found.
    flyToCluster(clusterId) {
      const list = joystickClustersRef.current || [];
      const cluster = list.find((c) => c && c.id === clusterId);
      if (!cluster) return;
      setFlyToTarget({ ...cluster, ts: Date.now() });
    },
    // §2.H.1 — multi-select ingredient nodes so LivingArchView's
    // glow shader paints them. Names must exist in the current
    // graph. Pass null/[] to clear.
    highlightNodes(names) {
      if (!Array.isArray(names) || names.length === 0) {
        setTourGlowNodes(null);
        setSelectedNodes([]);
        return;
      }
      setTourGlowNodes(names);
      setSelectedNodes(names);
    },
    // §2.G.3 + §2.G.4 composite: highlight a random cluster pill,
    // then fly the camera to it 1.5s later. Stores the picked cluster
    // on tourClusterRef so the next stage can read it for the
    // ingredient glow.
    // GD-TOUR-STEP4-CLUSTER-DEMO-RACE (2026-05-30): Step 4 fires
    // clearFilters() + runClusterDemo() in the same synchronous tick
    // via GuidedTour.jsx. clearFilters sets filterStack=[] which
    // re-derives joystickClusters to the real chef clusters (id >= 0),
    // but React hasn't committed yet — joystickClustersRef.current
    // is still Step 3's morph-axis pseudo-clusters (id = -100, -101,
    // ...). The id >= 0 filter then returns empty and the body
    // silently no-ops. setTimeout(0) defers the body to the next
    // macrotask, by which time the ref has been updated.
    runClusterDemo() {
      window.setTimeout(() => {
        const list = joystickClustersRef.current || [];
        // Filter out morphAxis pseudo-clusters (id <= -100) — those are
        // bucket poles, not real recipe clusters. Spec asks for an
        // actual recipe-cluster destination.
        const real = list.filter((c) => c && typeof c.id === 'number' && c.id >= 0);
        if (real.length === 0) return;
        const pick = real[Math.floor(Math.random() * real.length)];
        setTourHighlightedCluster(pick.id);
        tourClusterRef.current = pick;
        // GD-TOUR-STEP4-CLARITY: surface the pick's name so Step 4's
        // popup can read it. The pick is random per tour run.
        setTourPickedClusterName(pick.name || pick.label || null);
        window.setTimeout(() => {
          setFlyToTarget({ ...pick, ts: Date.now() });
        }, 1500);
      }, 0);
    },
    // §2.H.1 composite: glow 4-6 ingredients from the cluster picked
    // in runClusterDemo. Uses cluster.top_ingredients when available.
    runIngredientGlow() {
      const pick = tourClusterRef.current;
      if (!pick) return;
      const pool = Array.isArray(pick.top_ingredients) ? pick.top_ingredients : [];
      const names = pool.slice(0, 6);
      if (names.length === 0) return;
      setTourGlowNodes(names);
      setSelectedNodes(names);
    },
    // §2.I.1: clean up the multi-glow and pivot to single-ingredient
    // affinity engagement on the first glowed ingredient.
    // GD-TOUR-COPY-MATCH (2026-05-30): set affinityRequested=true so the
    // α-rings actually render — Stage 7 popup says "Affinity mode is
    // engaged on this ingredient" and now that's true (same fix
    // GD-TOUR-AFFINITY-ENGAGE applied to engageAffinity).
    engageFinalAffinity() {
      const pick = tourClusterRef.current;
      const pool = Array.isArray(pick?.top_ingredients) ? pick.top_ingredients : [];
      const lead = pool[0];
      setTourGlowNodes(null);
      setTourHighlightedCluster(null);
      if (lead) {
        setSelectedNodes([lead]);
        setAffinityRequested(true);
      }
    },
  }), []);

  const toggleFilter = useCallback((key) => {
    // R16 Phase 4: perf instrumentation. Plan budget: pill toggle
    // ≤16ms. Mark the start; the visibility-predicate effect inside
    // LivingArchView marks the end via `r16-filter-applied`.
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`r16-filter-toggle:${key}`);
    }
    setFilterStack((prev) => {
      const idx = prev.indexOf(key);
      if (idx >= 0) {
        // Already in stack — remove it (preserves order of the rest).
        // C2: removing a non-tail filter preserves the tail and thus
        // preserves morphAxis, so no morph dispatches.
        return prev.filter((f) => f !== key);
      }
      // Append to tail. Active filter becomes this key; morph axis
      // updates if FILTER_TO_AXIS[key] !== null.
      return [...prev, key];
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilterStack([]);
  }, []);

  // Task-6 Phase-2 wiring: thin adapter so the wedge-grid wheel can drive
  // the same filterStack reducer FilterPillRow uses. The `axis` argument
  // is documentation-only — `toggleFilter` already takes a single bucket
  // key (e.g. 'sweet', 'fruity', 'french'). Reserved for future per-axis
  // routing if filter-pill state ever splits per axis.
  const onFilterBucketFromWheel = useCallback((axis, bucketKey) => {
    if (!bucketKey) return;
    toggleFilter(bucketKey);
  }, [toggleFilter]);

  // Pop breadcrumb to length N. Length 0 = clear all; length 1 keeps
  // only the first filter; etc. Used by FilterBreadcrumb segment clicks.
  const popBreadcrumb = useCallback((n) => {
    setFilterStack((prev) => (n <= 0 ? [] : prev.slice(0, n)));
  }, []);

  // R16 Phase 2 — load cocktail + sauce scope ingredient sets once.
  // These power the cocktail-scope / sauce-scope filter pills' real
  // bucketOf detection (Phase 1 shipped them as no-op stubs).
  const [cocktailScope, setCocktailScope] = useState(null);
  const [sauceScope, setSauceScope] = useState(null);
  // Visible-node count lifted from LivingArchView so HUDAnnouncer can
  // surface it to screen readers. Null until the scene has computed it.
  const [visibleNodeCount, setVisibleNodeCount] = useState(null);
  useEffect(() => {
    if (!startPageComplete) return;
    getCocktailScope().then(setCocktailScope).catch(() => {});
    getSauceScope().then(setSauceScope).catch(() => {});
  }, [startPageComplete]);

  // Resolve the joystick-picked bucket label from focusedCluster + morphAxis
  // (pseudo-cluster IDs are -100 - i where i indexes axis.labels).
  const focusedBucketLabel = useMemo(() => {
    if (focusedCluster == null || focusedCluster > -100 || !morphAxis) return null;
    const axis = CATEGORICAL_AXES[morphAxis];
    const idx = -100 - focusedCluster;
    return axis?.labels?.[idx] ?? null;
  }, [focusedCluster, morphAxis]);

  // R19 Phase 1A — per-bucket member counts on the active morph axis,
  // restricted to nodes that pass every filter in filterStack (matches
  // the AND-intersection visibility predicate in LivingArchView). Feeds
  // InsightChip's "Largest: <bucket> (N)" / "Densest: …" templates.
  // Null when there is no morphAxis (empty stack OR scope-only stack).
  const bucketCounts = useMemo(() => {
    if (!data?.graph?.nodes || !morphAxis) return null;
    const axis = CATEGORICAL_AXES[morphAxis];
    if (!axis) return null;
    const ctx = {
      gnnEntropy: data.gnnEntropy || null,
      cuisineMap: data.cuisineMap || null,
      seasonMap: data.seasonMap || null,
      cocktailScope,
      sauceScope,
    };
    const counts = {};
    for (const label of axis.labels) counts[label] = 0;
    for (const node of data.graph.nodes.values()) {
      let visible = true;
      for (const f of filterStack) {
        if (bucketOf(f, node, ctx) === null) { visible = false; break; }
      }
      if (!visible) continue;
      const label = axis.bucketOf(node, ctx);
      if (label && counts[label] !== undefined) counts[label] += 1;
    }
    return counts;
  }, [data, morphAxis, filterStack, cocktailScope, sauceScope]);

  // R19 Phase 4 — drawer-side derivations. Computed lazily here (only
  // when the drawer is open) so the cost is paid on a user toggle, not
  // on every filter / pull change. All three useMemos return null when
  // there's no active morph axis (scope-only stack) so the drawer can
  // gracefully render only the sections it has data for.
  const insightAxisBucketOf = useMemo(() => {
    if (!data?.graph?.nodes || !morphAxis) return null;
    const axis = CATEGORICAL_AXES[morphAxis];
    if (!axis) return null;
    const ctx = {
      gnnEntropy: data.gnnEntropy || null,
      cuisineMap: data.cuisineMap || null,
      seasonMap: data.seasonMap || null,
    };
    const m = new Map();
    for (const [name, node] of data.graph.nodes) {
      const label = axis.bucketOf(node, ctx);
      if (label) m.set(name, label);
    }
    return m;
  }, [data, morphAxis]);

  const insightBridges = useMemo(() => {
    if (!insightDrawerOpen) return null;
    if (!data?.graph?.nodes || !morphAxis || !insightAxisBucketOf) return null;
    return rankBridges(morphAxis, {
      nodes: data.graph.nodes,
      edges: data.graph.edges,
      bucketOf: insightAxisBucketOf,
    }, { topN: 12 });
  }, [insightDrawerOpen, data, morphAxis, insightAxisBucketOf]);

  const insightClusterOverlap = useMemo(() => {
    if (!insightDrawerOpen) return null;
    if (!data?.graph?.nodes || !insightAxisBucketOf) return null;
    const axis = morphAxis ? CATEGORICAL_AXES[morphAxis] : null;
    return computeClusterBucketOverlap({
      nodes: data.graph.nodes,
      bucketOf: insightAxisBucketOf,
      bucketOrder: axis?.labels,
    });
  }, [insightDrawerOpen, data, morphAxis, insightAxisBucketOf]);

  const insightBucketColorMap = useMemo(() => {
    if (!morphAxis) return null;
    const axis = CATEGORICAL_AXES[morphAxis];
    if (!axis) return null;
    const m = {};
    axis.labels.forEach((label, i) => { m[label] = axis.colors[i]; });
    return m;
  }, [morphAxis]);

  // Reset focused cluster when the morph axis changes. Pseudo-cluster
  // IDs assigned by the categorical-wheel joystick are axis-specific
  // (-100 - i for each axis's bucket labels), so a Sweet focus carried
  // into the Cuisine wheel would highlight nothing — clearer to drop
  // the focus on axis change and let the user re-pick. Keyed on
  // `morphAxis` (not raw filter key) so toggling a scope filter on/off
  // does NOT clear the focus (scope filters don't change the axis).
  useEffect(() => {
    setFocusedCluster(null);
  }, [morphAxis]);

  // ClusterJoystick pills depend on the resolved morph axis:
  //   - morphAxis === null  → real cluster taxonomy from cluster_labels.json
  //                           (no filter active OR only scope filters)
  //   - morphAxis === 'taste' | 'aromas' | 'cuisine' | 'season' | 'family'
  //     → categorical buckets synthesized from CATEGORICAL_AXES (one
  //       pill per bucket, fly-to centroid computed on the same
  //       RING_RADIUS=90 wheel layout).
  const joystickClusters = useMemo(() => {
    if (morphAxis && CATEGORICAL_AXES[morphAxis]) {
      const axis = CATEGORICAL_AXES[morphAxis];
      const N = axis.labels.length;
      // R18 — pole positions match what the renderer uses for the
      // pull-lerp targets, so the fly-to-wheel handler in onFlyTo()
      // lands the camera ON the actual pole the user sees:
      //   3D mode → Fibonacci sphere from bucketPoles.js
      //   2D mode → flat ring at y=0 (legacy R17 layout)
      const fibDirs = mode === '3D' ? fibonacciSphere(N) : null;
      return axis.labels.map((label, i) => {
        let centroid;
        if (fibDirs) {
          const [x, y, z] = fibDirs[i];
          centroid = [x * POLE_RADIUS, y * POLE_RADIUS, z * POLE_RADIUS];
        } else {
          const angle = (2 * Math.PI * i) / N - Math.PI / 2;
          centroid = [Math.cos(angle) * POLE_RADIUS, 0, Math.sin(angle) * POLE_RADIUS];
        }
        return {
          id: -100 - i,
          name: label,
          color: axis.colors[i],
          centroid_3d: centroid,
          top_ingredients: [],
        };
      });
    }
    // P4: in flavor3D mode the chip sidebar surfaces the flavor-UMAP
    // k-means clusters from flavor_cluster_labels.json. Each entry
    // carries its own `color` (written in P2) so the chip strip
    // shows N distinct per-cluster colors instead of the recipe-
    // coocc CLUSTER_HEX palette. Recipe-coocc clusters remain the
    // source for plain 3D / 2D modes.
    if (mode === 'flavor3D') {
      return data?.flavorClusterLabels?.clusters;
    }
    return data?.clusterLabels?.clusters;
  }, [morphAxis, mode, data]);

  // Mirror joystickClusters into the sceneHandle's ref so its
  // flyToCluster(id) method can resolve a cluster by id without a
  // forward dep on the joystickClusters useMemo.
  useEffect(() => {
    joystickClustersRef.current = joystickClusters;
  }, [joystickClusters]);

  const handleModeSelect = useCallback((mode) => {
    writeStartPageFlag();
    setStartPageComplete(true);
    setLandingPick(mode);
    if (mode === 'pairing') {
      // Pairing model — the 3,913-ingredient network with chemistry-
      // based clustering. Lands on the Network tab.
      setActiveTab('network');
    } else if (mode === 'cocktail') {
      // Cocktail model — 6 family taxonomy with cocktails as nodes.
      setCocktailMounted(true);
      setActiveTab('cocktail');
    } else if (mode === 'sauce') {
      // Sauce model — the 10-mother-family codex with sauces as nodes.
      setSauceMounted(true);
      setActiveTab('sauce');
    } else if (mode === 'recipe') {
      // Recipe Lab — notebook-style recipe builder with live pairing
      // strength + GNN aroma scoring.
      setRecipeMounted(true);
      setActiveTab('recipe');
    } else if (mode === 'guided') {
      // Phase 3 Guided Discovery — Screen 1 (thought bubbles).
      setActiveTab('guided');
    } else if (mode === 'make') {
      setActiveTab('make');
    }
  }, []);

  const handleStartOver = useCallback(() => {
    clearStartPageFlag();
    setStartPageComplete(false);
    setHowItWorksInitialOpen(false);
    setMoleculeLabOpen(false);
    setActiveTab('network');
    setLandingPick(null);
  }, []);


  // Derived state
  const selectedNode = selectedNodes.length > 0 ? selectedNodes[0] : null;

  const ingredientList = useMemo(() => {
    if (!data) return [];
    return data.graph.ingredientList;
  }, [data]);

  const cuisines = useMemo(() => {
    if (!data) return [];
    return getAllCuisines(data.graph.nodes);
  }, [data]);

  const tastes = useMemo(() => {
    if (!data) return [];
    return getAllTastes(data.graph.nodes);
  }, [data]);

  const neighbors = useMemo(() => {
    if (!data || !selectedNode) return [];
    return getNeighborsEnriched(selectedNode, data.graph.edges, data.cuisineNeighborIndex);
  }, [data, selectedNode]);

  const commonPairings = useMemo(() => {
    if (!data || selectedNodes.length < 2) return [];
    const pairingsByNode = selectedNodes.map((name) => {
      const nbrs = getNeighborsEnriched(name, data.graph.edges, data.cuisineNeighborIndex);
      return new Map(nbrs.map((n) => [n.name, n.strength]));
    });
    const allNames = new Set();
    for (const m of pairingsByNode) for (const k of m.keys()) allNames.add(k);
    const shared = [];
    for (const name of allNames) {
      if (selectedNodes.includes(name)) continue;
      let minStrength = Infinity;
      let allHave = true;
      for (const m of pairingsByNode) {
        if (!m.has(name)) { allHave = false; break; }
        minStrength = Math.min(minStrength, m.get(name));
      }
      if (allHave) shared.push({ name, strength: minStrength });
    }
    return shared.sort((a, b) => b.strength - a.strength).slice(0, 20);
  }, [data, selectedNodes]);

  const selectedNodeData = useMemo(() => {
    if (!data || !selectedNode) return null;
    return data.graph.nodes.get(selectedNode) || null;
  }, [data, selectedNode]);

  // Auto-compute flavor path between exactly 2 selected ingredients
  const flavorPath = useMemo(() => {
    if (!data || selectedNodes.length !== 2) return null;
    const path = getNeighbors ? findStrongestPath(selectedNodes[0], selectedNodes[1], data.graph.edges) : [];
    if (path.length <= 2) return null; // Direct connection, no interesting path
    return path;
  }, [data, selectedNodes]);

  const handleNodeClick = useCallback((node, screenPos) => {
    // Cluster-focus gate: when a cluster is focused, an empty-space
    // click exits focus (but no longer clears the IngredientPanel —
    // panel only closes via its X button). Clicking a node outside
    // the focused cluster is ignored.
    if (focusedCluster !== null) {
      if (!node) {
        setFocusedCluster(null);
        return;
      }
      // For categorical wheel modes (taste / aromas / cuisine / season /
      // family) the focused-cluster id is a synthetic negative
      // (-100 - bucketIndex) and node.clusterId never matches. The
      // upstream click gate in LivingArchView already enforced bucket
      // membership before we got here, so we just trust the click and
      // skip the clusterId comparison. `morphAxis` resolved to non-null
      // means a categorical wheel is currently driving the layout.
      const isCategoricalFocus = morphAxis && focusedCluster <= -100;
      if (!isCategoricalFocus && node.clusterId !== focusedCluster) return;
    }
    // Empty-space click is a no-op so OrbitControls drags / camera
    // moves don't dismiss the open panel and selected ingredients.
    if (!node) return;
    setHighlightPairings(null);
    const name = node.name;

    // Canonical-spec §3.5 two-stage selection:
    //   single click on new node → replace selection (panel opens), no α-mode
    //   single click on currently-selected node → deselect (close panel)
    //   double click within 350ms (same node) → α-mode engages
    //   single click on different node while α-mode active → re-pivot
    //     (affinityRequested stays true)
    // Long-press is handled at the pointer layer in LivingArchView.
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const last = lastNodeClickRef.current;
    const isDoubleClick = last.name === name && now - last.at < 350;
    lastNodeClickRef.current = { name, at: now };

    if (isDoubleClick) {
      // Double-click commit → engage α-mode on this node.
      setSelectedNodes([name]);
      setAffinityRequested(true);
      setActivePanel('ingredient');
      setTierPopup(null);
    } else {
      // Single-click ALWAYS opens panel only — never α-mode, even if
      // α-mode was previously engaged. Forces affinityRequested=false
      // so any in-flight α-mode rings dismiss when the user clicks a
      // new node. To re-engage α-mode the user must explicitly
      // double-click or long-press.
      setAffinityRequested(false);
      let shouldOpenPopup = true;
      setSelectedNodes((prev) => {
        if (prev.length === 1 && prev[0] === name) {
          // Same node clicked again outside the double-click window →
          // deselect (close panel + popup).
          setActivePanel(null);
          shouldOpenPopup = false;
          return [];
        }
        return [name];
      });
      // Open the ingredient panel — mobile drawer gate (activePanel ===
      // 'ingredient') needs this to show the tier 1/2/3 data. Desktop
      // panel always renders when selectedNodeData is set; this is the
      // mobile-specific unlock.
      setActivePanel('ingredient');
      if (shouldOpenPopup && screenPos) {
        setTierPopup({ name, x: screenPos.x, y: screenPos.y });
      } else if (!shouldOpenPopup) {
        setTierPopup(null);
      }
    }
  }, [focusedCluster, morphAxis]);

  // Canonical-spec §3.5 — long-press on a node engages α-mode
  // (same effect as a double-click). Wired into LivingArchView's
  // touch press timer.
  const handleNodeLongPress = useCallback((node) => {
    if (!node) return;
    setSelectedNodes([node.name]);
    setAffinityRequested(true);
  }, []);

  const handleSearchSelect = useCallback((name) => {
    setSelectedNodes((prev) => {
      if (prev.includes(name)) return prev;
      // Don't auto-open on search either; same explicit-button rule
      // as tap-on-canvas (see handleNodeClick).
      return [...prev, name];
    });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedNodes([]);
    setHighlightPairings(null);
    setActivePanel(null);
  }, []);

  // R6-37 a11y: Escape on the network canvas. Clears selection AND
  // exits cluster focus so the keyboard escape hatch always reaches
  // the empty network state.
  const handleClearSelection = useCallback(() => {
    setSelectedNodes([]);
    setHighlightPairings(null);
    setActivePanel(null);
    setFocusedCluster(null);
  }, []);

  // Canon §5.6.4 — ESC must exit cluster-focus regardless of which
  // element has focus. The canvas wrapper's onKeyDown only fires when
  // the wrapper itself is focused; after tapping a joystick pill,
  // focus stays on the pill button and ESC never reaches the canvas.
  // A document-level listener, gated on focusedCluster being set,
  // closes that gap without firing ESC handlers in unrelated contexts.
  useEffect(() => {
    if (focusedCluster === null) return undefined;
    const onDocKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClearSelection();
      }
    };
    document.addEventListener('keydown', onDocKey);
    return () => document.removeEventListener('keydown', onDocKey);
  }, [focusedCluster, handleClearSelection]);

  const handleLabSelectionChange = useCallback((nodes) => {
    setSelectedNodes(nodes);
  }, []);

  // P8: Aroma-match handlers. Called from the Recipe Notebook pills.
  // Each handler:
  //   1. Computes the recipe's 6-axis aroma vector (returns early if null).
  //   2. Fetches the target lab's item list from its source JSON.
  //   3. Ranks by cosine aroma similarity and sets matchesContext.
  //   4. Navigates to the target lab tab (lazy-mounts if needed).
  const handleFindCocktail = useCallback(async (recipeIngredients, recipeName) => {
    if (!data?.graph?.nodes) return;
    const nodesObj = Object.fromEntries(data.graph.nodes);
    const recipeVec = computeRecipeAroma(recipeIngredients, nodesObj);
    if (!recipeVec) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/cocktail_codex_v2.json`);
      if (!res.ok) return;
      const codex = await res.json();
      // Normalize cocktails to have a string[] `ingredients` field so
      // rankByAromaSimilarity can call computeRecipeAroma on each item.
      const items = (codex.cocktails || []).map(c => ({
        ...c,
        ingredients: (c.ingredients_raw || []).map(r =>
          typeof r === 'string' ? r : (r.raw || r.name || '')
        ).filter(Boolean),
      }));
      const ranked = rankByAromaSimilarity(recipeVec, items, nodesObj, 8);
      setMatchesContext({ recipeName: recipeName || 'this recipe', items: ranked });
      setCocktailMounted(true);
      setActiveTab('cocktail');
    } catch { /* network failure — fail silently, pills remain active */ }
  }, [data]);

  const handleFindSauce = useCallback(async (recipeIngredients, recipeName) => {
    if (!data?.graph?.nodes) return;
    const nodesObj = Object.fromEntries(data.graph.nodes);
    const recipeVec = computeRecipeAroma(recipeIngredients, nodesObj);
    if (!recipeVec) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/sauce_augment.json`);
      if (!res.ok) return;
      const augment = await res.json();
      // sauce_augment sauces have ingredients: [{name, measure}] — normalize
      // to string[] so rankByAromaSimilarity can score each sauce.
      const items = (augment.sauces || []).map(s => ({
        ...s,
        ingredients: (s.ingredients || []).map(i =>
          typeof i === 'string' ? i : (i.name || '')
        ).filter(Boolean),
      }));
      const ranked = rankByAromaSimilarity(recipeVec, items, nodesObj, 8);
      setMatchesContext({ recipeName: recipeName || 'this recipe', items: ranked });
      setSauceMounted(true);
      setActiveTab('sauce');
    } catch { /* network failure — fail silently */ }
  }, [data]);

  // Parse URL parameters on mount to pre-load shared recipe ingredients
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const ingredientsParam = params.get('ingredients');
    if (ingredientsParam) {
      const names = ingredientsParam.split(',').map(s => s.trim().toLowerCase());
      const knownNodes = data.graph.nodes;
      const matched = names.filter(n => knownNodes.has(n));
      if (matched.length > 0) {
        setSelectedNodes(matched);
      }
    }
  }, [data]);

  // Keyboard shortcuts. The arrow keys "walk" the graph: when an
  // ingredient is selected, ArrowDown/Right steps to its strongest
  // pairing (pushing the current node onto a history stack) and
  // ArrowUp/Left rewinds. Escape clears selection. `/` jumps to search.
  // Skipped when the user is typing in an input/textarea.
  const keyNavHistoryRef = useRef([]);
  useEffect(() => {
    function isTyping(target) {
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    }
    function handleKeyDown(e) {
      if (isTyping(e.target)) return;
      if (e.key === 'Escape') {
        // Canonical-spec §6.8: ESC exits α-mode but keeps the panel open.
        // Press ESC again to clear the selection fully.
        if (affinityRequested) {
          setAffinityRequested(false);
          return;
        }
        setSelectedNodes([]);
        setHighlightPairings(null);
        setActivePanel(null);
        keyNavHistoryRef.current = [];
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) searchInput.focus();
        return;
      }
      if (!data) return;
      const current = selectedNodes.length > 0 ? selectedNodes[0] : null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        if (!current) return;
        const recent = new Set(keyNavHistoryRef.current.slice(-5));
        recent.add(current);
        // R13-7: When α-mode is engaged (single ingredient selected and
        // not killed via ?affinity=v0), step to strongest unvisited
        // NATIVE ★★★ affinity. Falls back to ★★, then ★, then any
        // neighbor — so the pivot never stalls when the focal has no
        // ★★★ candidates. Identical on desktop and iOS.
        const alphaEngaged = affinityEnabled && selectedNodes.length === 1 && affinityRequested;
        let next = null;
        if (alphaEngaged && data.pairingStrength) {
          const aff = topAffinities(current, data);
          const tryTier = (t) =>
            aff.find((a) => a.tier === t && !recent.has(a.name));
          next = tryTier(3) || tryTier(2) || tryTier(1) || aff.find((a) => !recent.has(a.name));
          if (next) next = { name: next.name };
        }
        if (!next) {
          const nbrs = getNeighborsEnriched(current, data.graph.edges, data.cuisineNeighborIndex);
          if (nbrs.length === 0) return;
          next = nbrs.find((n) => !recent.has(n.name)) || nbrs[0];
        }
        keyNavHistoryRef.current.push(current);
        setSelectedNodes([next.name]);
        // No auto-open: keyboard nav engages α-mode rings only; user
        // taps Details tab/button to view info.
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        const prev = keyNavHistoryRef.current.pop();
        if (!prev) return;
        setSelectedNodes([prev]);
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, selectedNodes, affinityEnabled, affinityRequested]);

  // Canonical-spec sync: when selection clears (background click,
  // panel close, etc), drop the α-mode request so it doesn't
  // re-engage on the next selection.
  useEffect(() => {
    if (selectedNodes.length === 0 && affinityRequested) {
      setAffinityRequested(false);
    }
  }, [selectedNodes, affinityRequested]);

  // Double-tap on canvas to clear tree filter
  const handleCanvasDoubleTap = useCallback(() => {
    setTreeFilterIngredients(null);
    setTreeFilterLabel(null);
    setShowFilteredList(false);
  }, []);

  // Auto-show filtered list when filter is set
  useEffect(() => {
    if (treeFilterIngredients && treeFilterIngredients.length > 0) {
      setShowFilteredList(true);
    }
  }, [treeFilterIngredients]);

  // Clear filter handler
  const handleClearTreeFilter = useCallback(() => {
    setTreeFilterIngredients(null);
    setTreeFilterLabel(null);
    setShowFilteredList(false);
  }, []);

  if (error) {
    return <ErrorCard onRetry={retry} onStartOver={handleStartOver} />;
  }

  // LandingScreen is the entry surface AND the loading surface. Pre-pick
  // it shows the three tiles; post-pick (loading=true) it dims the
  // unpicked tiles and shimmers the picked one. This replaces both the
  // legacy StartPage and the standalone spinner.
  if (!startPageComplete || loading) {
    return (
      <LandingScreen
        onModeSelect={handleModeSelect}
        isLoading={loading}
        picked={landingPick}
      />
    );
  }

  return (
    <>
      {/* Screen-reader-only live region: announces the currently-selected
          ingredient and its top pairings so keyboard/screen-reader users
          know what's happening in the 3D canvas they can't see. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {selectedNodeData
          ? `Selected ${selectedNodeData.name}. ${selectedNodeData.pairingCount || 0} pairings. `
            + `Taste: ${selectedNodeData.taste || 'unknown'}. `
            + (neighbors.length > 0
              ? `Top pairings: ${neighbors.slice(0, 3).map((n) => n.name).join(', ')}.`
              : '')
          : selectedNodes.length > 1
            ? `${selectedNodes.length} ingredients selected.`
            : 'No ingredient selected.'}
      </div>

      {/* Top-level tab navigation — UX pipeline Phase 1 (2026-05-16):
          Primary row = 3 tabs matching the 3 landing cards (Explore /
          Guided / Build). Secondary row appears only when Explore is
          active, showing the 4 sublistings (Network / Cocktail /
          Sauce / Recipes-notebook). The notebook RecipeLab is kept
          accessible until Phase 5 ships the Build path replacement —
          marked "Recipe (notebook)" so users know it's the older
          surface. */}
      <nav className="fixed top-0 left-0 right-0 z-[60] flex flex-col bg-[#0a0a12]/95 backdrop-blur-md border-b border-[#1e1e2e] safe-top">
        {/* Primary row — always visible. */}
        <div className="flex items-center h-10">
        {/* Mobile: show app name */}
        <span className="sm:hidden px-3 text-xs text-cyan-300/80 font-medium tracking-wide" style={{ textShadow: '0 0 10px rgba(79,143,255,0.3)' }}>
          Flavor Network
        </span>
        <div className="hidden sm:flex items-center gap-0.5 px-3 h-full">
          {/* Primary 3-tab nav (Phase 1). Each tab maps to one of the
              landing-card paths. "Build" placeholder ships in Phase 5. */}

          {/* Explore — renamed from "Network". Same Network surface
              underneath. Tap once to switch tabs; tap again to open the
              3D/2D mode + ingredient-tree + sauce/molecule overflow. */}
          <div className="relative">
            <button
              onClick={() => {
                if (activeTab === 'network') {
                  setNetworkDropdownOpen(v => !v);
                  setLabDropdownOpen(false);
                  setExploreDropdownOpen(false);
                } else {
                  setActiveTab('network');
                  setNetworkDropdownOpen(false);
                  setLabDropdownOpen(false);
                  setExploreDropdownOpen(false);
                }
              }}
              aria-haspopup="menu"
              aria-expanded={networkDropdownOpen}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'network'
                  ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              {activeTab === 'network' && NETWORK_MODE_LABELS[mode] !== 'Network'
                ? `Explore · ${NETWORK_MODE_LABELS[mode]}`
                : 'Explore'}
              {activeTab === 'network' && (
                <svg className={`w-3 h-3 transition-transform ${networkDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              )}
            </button>
            {networkDropdownOpen && activeTab === 'network' && (
              <>
                <div className="fixed inset-0 z-[59]" onClick={() => setNetworkDropdownOpen(false)} />
                <div role="menu" aria-label="Explore" className="absolute top-full left-0 mt-1 w-52 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[61] overflow-hidden">
                  {NETWORK_MODE_CYCLE.map((m) => (
                    <button
                      key={m}
                      role="menuitem"
                      onClick={() => { setMode(m); setNetworkDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                        mode === m
                          ? 'text-cyan-300 bg-cyan-500/10'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                      }`}
                    >
                      {NETWORK_MODE_LABELS[m]}
                      {mode === m && (
                        <svg className="w-3 h-3 ml-auto text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-[#2a2a3a]" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      setActiveTab('sauce');
                      setSauceMounted(true);
                      setNetworkDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 11.33L18 2l-1.73-1-5.27 9.33L5.73 1 4 2l5 9.33V19H6v2h12v-2h-3v-7.67z" />
                    </svg>
                    Sauce Lab
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMoleculeLabOpen(v => !v); setNetworkDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                      moleculeLabOpen ? 'text-cyan-300 bg-cyan-500/10' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="5" cy="6" r="1.5" />
                      <circle cx="19" cy="6" r="1.5" />
                      <circle cx="5" cy="18" r="1.5" />
                      <circle cx="19" cy="18" r="1.5" />
                      <line x1="6.2" y1="7" x2="10.8" y2="11" />
                      <line x1="17.8" y1="7" x2="13.2" y2="11" />
                      <line x1="6.2" y1="17" x2="10.8" y2="13" />
                      <line x1="17.8" y1="17" x2="13.2" y2="13" />
                    </svg>
                    Molecule Lab
                  </button>
                  <div className="border-t border-[#2a2a3a]" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      setHowItWorksOpen(true);
                      setNetworkDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-400 hover:text-cyan-300 hover:bg-[#1a1a2a] transition-colors"
                  >
                    <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] font-bold leading-none">?</span>
                    How it works
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Guided — promoted to top-level. Routes to GuidedDiscoveryStart. */}
          <button
            onClick={() => {
              setActiveTab('guided');
              setNetworkDropdownOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'guided' || activeTab === 'guided-results'
                ? 'text-pink-300 bg-pink-500/10 border border-pink-500/20'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
            aria-label="Guided Discovery"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Guided
          </button>

          {/* Profile — icon-only, sits at the right edge of the nav block. */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`ml-1 flex items-center justify-center w-8 h-8 rounded-md transition-all ${
              activeTab === 'profile'
                ? 'text-blue-300 bg-blue-500/10 border border-blue-500/20'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
            aria-label="Profile"
            title="Profile"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
        <div className="ml-auto px-3 text-[9px] text-gray-600 tracking-wider uppercase">
          Powered by the Flavor Network
        </div>
        </div>{/* end primary row */}

        {/* Secondary sub-nav — Phase 1. Visible only when the user is
            inside Explore (network OR one of its lab sublistings).
            Mounted with !hidden on sm+ to mirror the desktop primary
            row's responsive behaviour. */}
        {(activeTab === 'network' || activeTab === 'cocktail' || activeTab === 'sauce' || activeTab === 'recipe' || activeTab === 'cookbook') && (
          <div
            data-testid="explore-secondary-nav"
            className="hidden sm:flex items-center h-8 px-3 gap-0.5 border-t border-[#1e1e2e] bg-[#0a0a12]/80"
          >
            <span className="text-[9px] uppercase tracking-widest text-gray-600 mr-2">Explore →</span>
            {/* Secondary nav: 3 spec-mandated labs + the notebook
                Recipe Lab. The notebook is the working surface for
                composing a recipe (canvas-driven, pen-and-paper feel);
                Recipes (3D) is the browseable curated set. Both live
                here so users can switch between exploring and
                authoring without leaving the Explore context. */}
            <button
              onClick={() => { setActiveTab('cocktail'); setCocktailMounted(true); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                activeTab === 'cocktail' ? 'text-amber-300 bg-amber-500/10' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Cocktail Lab
            </button>
            <button
              onClick={() => { setActiveTab('sauce'); setSauceMounted(true); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                activeTab === 'sauce' ? 'text-orange-300 bg-orange-500/10' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Sauce Lab
            </button>
            <button
              onClick={() => setActiveTab('cookbook')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                activeTab === 'cookbook' ? 'text-pink-300 bg-pink-500/10' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Recipe browser — 15 hand-curated dishes"
            >
              Cookbook
            </button>
            <button
              onClick={() => { setActiveTab('recipe'); setRecipeMounted(true); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                activeTab === 'recipe' ? 'text-emerald-300 bg-emerald-500/10' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Notebook-style recipe builder — compose your own"
            >
              Recipes Notebook
            </button>
          </div>
        )}
      </nav>

      {/* Network tab */}
      <div className={`transition-opacity duration-300 ${activeTab === 'network' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'}`}>
      <LivingArchView
        data={data}
        onNodeClick={handleNodeClick}
        onNodeLongPress={handleNodeLongPress}
        onNodeHover={(node, pos) => {
          setHoveredNode(node);
          setHoverPos(pos);
        }}
        onPoleHover={setHoveredPole}
        onBridgePulse={setBridgePulse}
        neighbors={neighbors}
        affinityProjectionRef={affinityProjectionRef}
        selectedNode={selectedNode}
        selectedNodes={selectedNodes}
        showEdges={showEdges}
        showParticles={showParticles}
        edgeBrightness={edgeBrightness}
        particleBrightness={particleBrightness}
        filterTaste={selectedTaste}
        treeFilterIngredients={treeFilterIngredients}
        mode={mode === '3D' ? 'ml' : mode === 'flavor3D' ? 'mlflavor' : 'ml2d'}
        onModeChange={setMode}
        filterStack={filterStack}
        morphAxis={morphAxis}
        pullStrength={pullStrength}
        cocktailScope={cocktailScope}
        sauceScope={sauceScope}
        onVisibleCountChange={setVisibleNodeCount}
        onDoubleTap={handleCanvasDoubleTap}
        highlightPairings={highlightPairings}
        flyToTarget={flyToTarget}
        highlightIngredients={clusterHighlights}
        focusedClusterId={focusedCluster}
        affinityEnabled={affinityEnabled}
        affinityRequested={affinityRequested}
        pickedBucket={focusedBucketLabel}
        isMobile={isMobile}
        onClearSelection={handleClearSelection}
      />
      {/* R19 Phase 3 — bridge-pulse rings on pull crossing 0.5. */}
      <BridgePulseOverlay pulse={bridgePulse} />
      {/* Task-6 Track 2 — corner wedge-grid overlay removed per user
          feedback (2026-05-16). Replaced by AffinityTriangleOverlay
          (in-scene SVG triangle wedges from focal to each accent). */}
      <AffinityTriangleOverlay projectionRef={affinityProjectionRef} />
      {/* Hover tooltip — shows ingredient name at cursor position */}
      {hoveredNode && hoverPos && (
        <div
          className="fixed z-[70] px-2 py-1 rounded bg-[#0d0d16]/95 border border-purple-500/40 text-xs text-white pointer-events-none whitespace-nowrap"
          style={{ left: hoverPos.x + 12, top: hoverPos.y - 8 }}
        >
          <span className="font-medium">{hoveredNode.name}</span>
          {hoveredNode.flavorGraph?.tier1?.length > 0 && (
            <span className="ml-2 text-amber-300">
              {hoveredNode.flavorGraph.tier1.join(', ')}
            </span>
          )}
          {hoveredNode.taste && (
            <span className="ml-2 text-gray-400">{hoveredNode.taste}</span>
          )}
        </div>
      )}
      {/* Canonical-spec (2026-05-23): tier popup on single-click of a
          network node. Reads the flavor-graph rows (aroma / taste /
          mouthfeel / leaves) at a glance, anchored near the click
          point. The full IngredientPanel still opens in the side
          drawer with the rest of the metadata. Click outside / click
          a new node dismisses it; double-click engages α-mode and
          dismisses it too. */}
      {tierPopup && (() => {
        const popupNode = data?.graph?.nodes?.get?.(tierPopup.name);
        if (!popupNode) return null;
        const fg = popupNode.flavorGraph || {};
        const rows = [
          { label: 'Aroma',     items: fg.tier1 || [], color: '#fbbf24' }, // amber
          { label: 'Taste',     items: fg.tier2 || [], color: '#9ca3af' }, // gray
          { label: 'Mouthfeel', items: fg.tier3 || [], color: '#a78bfa' }, // violet
          { label: 'Leaves',    items: fg.leaves || [], color: '#86efac' }, // green
        ];
        const hasAny = rows.some((r) => r.items.length > 0);
        // Clamp position so the popup stays on-screen.
        const px = Math.min(tierPopup.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240);
        const py = Math.min(tierPopup.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200);
        return (
          <div
            className="fixed z-[72] px-3 py-2 rounded-md bg-[#0d0d16]/95 border border-purple-500/50 text-xs text-white shadow-lg"
            style={{ left: px, top: py, maxWidth: 240 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-medium text-sm">{popupNode.name}</span>
              <button
                type="button"
                className="text-gray-500 hover:text-white text-base leading-none -mr-1"
                onClick={() => setTierPopup(null)}
                aria-label="Close"
              >×</button>
            </div>
            {hasAny ? (
              <div className="space-y-1">
                {rows.map((r) => r.items.length > 0 && (
                  <div key={r.label} className="flex gap-1.5">
                    <span
                      className="text-[10px] uppercase tracking-wider font-medium shrink-0 w-16"
                      style={{ color: r.color }}
                    >{r.label}</span>
                    <span className="text-[11px] text-gray-200 leading-tight">
                      {r.items.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-500 italic">
                No flavor-graph data for this ingredient.
              </div>
            )}
          </div>
        );
      })()}
      {/* R18 — pole-label tooltip. Mirrors the node tooltip's styling but
          uses the bucket's color as the border + shows the member count.
          R19 Phase 2 enriches the body with the top 3 bucket members and
          one cross-bucket bridge ingredient. */}
      {hoveredPole && (
        <div
          className="fixed z-[70] px-2 py-1.5 rounded bg-[#0d0d16]/95 text-xs text-white pointer-events-none shadow-lg"
          style={{
            left: hoveredPole.x + 12,
            top: hoveredPole.y - 8,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: hoveredPole.color,
            maxWidth: 320,
          }}
        >
          <div className="whitespace-nowrap">
            <span className="font-medium uppercase tracking-wider" style={{ color: hoveredPole.color }}>
              {hoveredPole.label}
            </span>
            <span className="ml-2 text-gray-400">· {hoveredPole.memberCount} ingredients</span>
          </div>
          {Array.isArray(hoveredPole.topMembers) && hoveredPole.topMembers.length > 0 && (
            <div className="mt-1 text-[11px] text-gray-300 truncate">
              <span className="text-gray-500">Top:</span> {hoveredPole.topMembers.join(' · ')}
            </div>
          )}
          {hoveredPole.bridge && (
            <div className="mt-0.5 text-[11px] text-gray-300 truncate">
              <span className="text-gray-500">Bridge:</span> {hoveredPole.bridge.name}
              {hoveredPole.bridge.topPeer && (
                <span className="text-gray-400"> → {hoveredPole.bridge.topPeer}</span>
              )}
              {hoveredPole.bridge.otherBucket && (
                <span className="text-gray-500"> ({hoveredPole.bridge.otherBucket})</span>
              )}
            </div>
          )}
        </div>
      )}
      <SearchBar
        ingredients={ingredientList}
        onSelect={handleSearchSelect}
      />

      {/* Ingredient detail panel (desktop only) */}
      {!isMobile && (
        <IngredientPanel
          node={selectedNodeData}
          neighbors={neighbors}
          onClose={handlePanelClose}
          onSelectIngredient={handleSearchSelect}
          onFilterBucket={onFilterBucketFromWheel}
          onHighlightPairings={(names) => setHighlightPairings(
            highlightPairings ? null : names
          )}
          commonPairings={commonPairings}
          selectedNodes={selectedNodes}
          selectedNodesData={selectedNodes.map(n => data?.graph?.nodes?.get(n)).filter(Boolean)}
          selectedCount={selectedNodes.length}
          flavorPath={flavorPath}
          affinityEngaged={affinityEnabled && selectedNodes.length === 1 && affinityRequested}
          onBuildRecipe={() => {
            setRecipeHandoff({
              source: 'network',
              ingredients: [...selectedNodes],
              mode: null,
              ts: Date.now(),
            });
            setRecipeMounted(true);
            setActiveTab('recipe');
          }}
          isFavorite={selectedNode ? userProfile.hasIngredient(selectedNode) : false}
          onToggleFavorite={userProfile.toggleIngredient}
          onTogglePairing={userProfile.togglePairing}
          hasPairing={userProfile.hasPairing}
          graphNodes={data?.graph?.nodes}
          bridgeCompounds={data?.bridgeCompounds}
          gnnEntropy={data?.gnnEntropy}
          odorThresholds={data?.odorThresholds}
          ingredientThresholds={data?.ingredientThresholds}
          compoundTastes={data?.compoundTastes}
          cuisinePairLookup={data?.cuisinePairLookup}
        />
      )}

      {/* Details + Clear Selection — upper-right, stacked vertically
          below the centered SearchBar. Share button removed per user
          feedback (it was rarely used and crowded the focal-orbit UI). */}
      {selectedNodes.length > 0 && (
        <div className="fixed top-[100px] right-2 z-50 flex flex-col items-end gap-2">
          {/* Mobile-only Details button — desktop has the right-edge
              "Details" tab on IngredientPanel. Per user request
              2026-04-29 we no longer auto-open the panel on tap, so
              this button is the explicit entry point on mobile. Iter
              2026-05-16: matches desktop tab's attention-pulse styling
              (user audit: Details was hidden behind other features). */}
          {isMobile && activePanel !== 'ingredient' && (
            <button
              onClick={() => setActivePanel('ingredient')}
              className="details-tab-mobile px-3 py-1.5 min-h-[44px] text-xs text-cyan-300 hover:text-cyan-200 bg-[#12121a]/95 backdrop-blur-md border border-cyan-400/60 rounded-lg transition-colors select-none flex items-center gap-1.5 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Details
              <style>{`
                @keyframes detailsTabMobilePulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.0); }
                  50%      { box-shadow: 0 0 14px -2px rgba(34, 211, 238, 0.6); }
                }
                .details-tab-mobile { animation: detailsTabMobilePulse 2.4s ease-in-out infinite; }
              `}</style>
            </button>
          )}
          <button
            onClick={handleClearSelection}
            className="px-3 py-1.5 min-h-[44px] text-xs text-gray-400 hover:text-red-400 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Selection
            <span className="text-gray-600">({selectedNodes.length})</span>
          </button>
        </div>
      )}

      {/* Filtered ingredients panel — shows when a tree filter is active */}
      {treeFilterIngredients && treeFilterIngredients.length > 0 && showFilteredList && (
        <div className="fixed left-2 z-40 w-72 sm:w-80 max-h-[50vh] flex flex-col bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e] rounded-lg overflow-hidden" style={{ top: 'calc(var(--nav-h) + 3.5rem)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neural-glow">{treeFilterLabel}</span>
              <span className="text-[10px] text-gray-500">{treeFilterIngredients.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowFilteredList(false)}
                className="text-gray-500 hover:text-gray-300 text-xs min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Minimize"
              >
                &minus;
              </button>
              <button
                onClick={handleClearTreeFilter}
                className="text-gray-500 hover:text-red-400 text-xs min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Clear filter (or double-tap canvas)"
              >
                &times;
              </button>
            </div>
          </div>
          {/* Scrollable ingredient cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {treeFilterIngredients.map(name => {
              const node = data?.graph?.nodes?.get(name);
              const taste = node?.taste || '';
              const pairingCount = node?.pairingCount || 0;
              return (
                <button
                  key={name}
                  onClick={() => handleSearchSelect(name)}
                  className="w-full min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-md bg-[#1a1a2a]/60 hover:bg-[#1a1a2a] border border-[#2a2a3a]/50 transition-colors text-left"
                >
                  <span className="text-xs text-gray-200 flex-1 truncate">{name}</span>
                  {taste && (
                    <span className="text-[9px] text-gray-500 capitalize">{taste}</span>
                  )}
                  <span className="text-[9px] text-gray-600">{pairingCount}p</span>
                </button>
              );
            })}
          </div>
          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-[#1e1e2e] text-[9px] text-gray-600 text-center">
            Double-tap canvas to clear filter
          </div>
        </div>
      )}

      {/* Minimized filter indicator */}
      {treeFilterIngredients && treeFilterIngredients.length > 0 && !showFilteredList && (
        <button
          onClick={() => setShowFilteredList(true)}
          className="fixed left-2 z-40 px-3 py-1.5 min-h-[44px] bg-[#12121a]/90 backdrop-blur-md border border-neural-glow/30 rounded-lg text-xs text-neural-glow flex items-center gap-2 transition-colors hover:bg-[#1a1a2a]"
          style={{ top: 'calc(var(--nav-h) + 3.5rem)' }}
        >
          <span>{treeFilterLabel}</span>
          <span className="text-gray-500">{treeFilterIngredients.length}</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleClearTreeFilter(); }}
            className="text-gray-500 hover:text-red-400 ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            &times;
          </button>
        </button>
      )}

      {/* Taste-color Legend slide-out removed per UX cleanup — the
          filter row in the Network tab covers the same intent. */}
      {/* Controls panel removed — brightness fixed at 30% */}
      <Walkthrough
        active={showTour}
        onComplete={() => setShowTour(false)}
        onSkip={() => setShowTour(false)}
      />
      <GlobalInsights
        nodes={data ? data.graph.nodes : null}
        edges={data ? data.graph.edges : null}
        filterCuisine={selectedCuisine}
        filterTaste={selectedTaste}
        treeFilterIngredients={treeFilterIngredients}
        treeFilterLabel={treeFilterLabel}
        selectedNodes={selectedNodes}
        isOpen={showGlobalInsights}
        onClose={() => setShowGlobalInsights(false)}
      />
      <FlavorTreeExplorer
        nodes={data ? data.graph.nodes : null}
        isOpen={showTreeExplorer}
        onClose={() => { setShowTreeExplorer(false); }}
        onFilterIngredients={(ingredients, label) => {
          setTreeFilterIngredients(ingredients);
          setTreeFilterLabel(label || null);
          // Auto-close the tree panel when a filter is selected
          if (ingredients) setShowTreeExplorer(false);
        }}
      />
      <HelpButton onClick={() => setShowTour(true)} />
      <HowItWorks
        initialOpen={howItWorksInitialOpen}
        isOpen={howItWorksOpen}
        onRequestOpen={() => setHowItWorksOpen(true)}
        onClose={() => setHowItWorksOpen(false)}
        showButton={activeTab !== 'network'}
      />
      <TrainingTraceModal
        isOpen={trainingTraceOpen}
        onClose={handleTrainingTraceClose}
      />
      </div>

      {/* Phase 3 Guided Discovery — Screen 1 (bubbles). Mounted as a
          sibling of the Network wrapper so its opacity-0 cascade
          doesn't suppress the bubble grid. */}
      {activeTab === 'guided' && (
        <div className="fixed inset-0 z-[40] overflow-y-auto">
          {/* Phase 2 — swap from legacy bubble-grid (GuidedDiscoveryStart)
              to Tinder-style centered-card deck (GuidedDiscoverySwipe).
              Legacy component preserved for its existing test suite
              but no longer rendered. */}
          <GuidedDiscoverySwipe
            ingredients={ingredientList}
            onComplete={(payload) => {
              // P5 (Track 3) — payload shape changed from a bubbleStack
              // array to `{ ingredient, filterType }`. Reconstruct a
              // minimal bubbleStack so downstream consumers (chip strip,
              // focalFromStack) still work. Pass filterType through to
              // GuidedDiscoveryResults as initialFilterType.
              if (Array.isArray(payload)) {
                // Legacy array shape (defensive — should not occur post-P5).
                setBubbleStack(payload);
                setGuidedInitialFilterType(null);
              } else if (payload && typeof payload === 'object') {
                const { ingredient, filterType } = payload;
                setBubbleStack(ingredient ? [{
                  key: 'ingredient',
                  label: 'Starts with a specific ingredient',
                  value: { ingredient },
                  axisHint: null,
                }] : []);
                setGuidedInitialFilterType(filterType || null);
              }
              setActiveTab('guided-results');
            }}
          />
        </div>
      )}

      {/* Phase 3 Guided Discovery — Screen 2 (P6: GuidedProfileRadar +
          GuidedResultsFilterPills + ProvenancePanel). The
          onExploreInNetwork handler is the canonical bridge into
          App.jsx's network filterStack per Constraint #4. */}
      {activeTab === 'guided-results' && (
        <div className="fixed inset-0 z-[40] overflow-y-auto">
          <GuidedDiscoveryResults
            bubbleStack={bubbleStack}
            initialFilterType={guidedInitialFilterType}
            // `data` from useProData IS the affinityCtx contract:
            // it carries pairingStrength, top5, bridgeCompoundIndex,
            // affinityThresholds, graph.{nodes,edges}, gnnEntropy,
            // bridgeCompounds — exactly what surprisingAffinities /
            // topAffinities / CuratedWheel consume. Without this prop
            // GuidedDiscoveryResults stays in the empty-state and the
            // user never sees the curated wheel for their focal pick.
            ctx={data}
            onBackToBubbles={() => setActiveTab('guided')}
            onAxisSelect={(axis, chosenAxisKey = null) => {
              // Phase 6 — radar click sets filter pills + activates
              // the GuidedTour overlay on the network tab.
              // GD-TOUR-AFFINITY-ENGAGE: alphaEngaged requires BOTH
              // selectedNodes.length === 1 AND affinityRequested. Set
              // both so the network paints with α-rings live on landing
              // (matching Step 1's "We've engaged the Affinity view"
              // popup copy).
              const axisFilter = axis === 'aroma' ? 'aromas' : axis;
              setFilterStack([
                axisFilter,
                ...deriveFilterStackFromBubbles(bubbleStack).filter((f) => f !== axisFilter),
              ]);
              const focal = bubbleStack.find((b) => b.key === 'ingredient')?.value?.ingredient || null;
              if (focal) {
                setSelectedNodes([focal]);
                setAffinityRequested(true);
              }
              setTourAxis(axis);
              setTourFocal(focal);
              setTourChosenAxisKey(chosenAxisKey);
              // GD-TOUR-AXIS-INTENT-CARRY: resolve the focal's bucket
              // on the morph axis so Step 1 can name it (e.g. tomato →
              // umami). bucketOf returns null when the node lacks the
              // axis data; the popup hides the context line in that case.
              const axisDef = CATEGORICAL_AXES[axisFilter];
              const focalNode = focal && data?.graph?.nodes
                ? data.graph.nodes.get(focal)
                : null;
              if (axisDef && focalNode) {
                const bucketCtx = {
                  gnnEntropy: data.gnnEntropy || null,
                  cuisineMap: data.cuisineMap || null,
                  seasonMap: data.seasonMap || null,
                  cocktailScope, sauceScope,
                };
                setTourFocalBucket(axisDef.bucketOf(focalNode, bucketCtx) || null);
              } else {
                setTourFocalBucket(null);
              }
              setTourActive(true);
              setActiveTab('network');
            }}
            onExploreInNetwork={() => {
              // Constraint #4: this is the ONLY place setFilterStack
              // is called from a Guided Discovery context.
              setFilterStack(deriveFilterStackFromBubbles(bubbleStack));
              setActiveTab('network');
            }}
          />
        </div>
      )}

      {/* Profile tab — full screen, mounted only when active. MUST be a
          sibling of the Network wrapper (not nested inside it), otherwise
          the Network wrapper's opacity-0 cascades to ProfilePanel. */}
      <div className={`transition-opacity duration-300 ${activeTab === 'profile' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'}`}>
        {activeTab === 'profile' && (
          <ProfilePanel
            profile={userProfile.profile}
            actions={userProfile}
            ingredientList={ingredientList}
            cuisines={cuisines}
            onClose={() => setActiveTab('network')}
            graphNodes={data?.graph?.nodes}
            onSelectIngredient={(name) => {
              handleSearchSelect(name);
              setActiveTab('network');
            }}
            onLoadRecipe={(recipe) => {
              const ingredients = (recipe?.ingredients || [])
                .map((i) => (typeof i === 'string' ? i : i?.name))
                .filter(Boolean);
              setRecipeHandoff({
                source: 'profile',
                ingredients,
                mode: 'recipe',
                ts: Date.now(),
                title: recipe?.name || '',
              });
              setRecipeInitialMode(null);
              setRecipeMounted(true);
              setActiveTab('recipe');
            }}
            user={user}
            onLogin={loginWithGoogle}
            onLoginWithApple={loginWithApple}
            onLogout={logout}
            onReplayTour={() => { setActiveTab('network'); setShowTour(true); }}
          />
        )}
      </div>

      {/* Cocktail Lab tab — lazy-mounted. v2 (6-family taxonomy)
          fully replaces the legacy 7-archetype lab as of this commit. */}
      {cocktailMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'cocktail' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <CocktailLabV2
            onSelectionChange={handleLabSelectionChange}
            externalFilter={externalLabFilter}
            matchesContext={matchesContext}
            onExitMatches={() => setMatchesContext(null)}
            onOpenRecipeLab={(_mode, initialIngredients) => {
              setRecipeHandoff({
                source: 'cocktail',
                ingredients: Array.isArray(initialIngredients) ? [...initialIngredients] : [],
                mode: 'cocktail',
                ts: Date.now(),
              });
              setRecipeInitialMode('cocktail');
              setRecipeMounted(true);
              setActiveTab('recipe');
            }}
          />
        </div>
      )}

      {/* Sauce Lab tab — lazy-mounted */}
      {sauceMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'sauce' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <SauceLab
            fullData={data}
            userProfile={userProfile}
            externalFilter={externalLabFilter}
            matchesContext={matchesContext}
            onExitMatches={() => setMatchesContext(null)}
            onSelectionChange={handleLabSelectionChange}
            onOpenRecipeLab={(_mode, initialIngredients) => {
              // Same one-shot handoff pattern as Cocktail Lab —
              // replaces the bowl rather than appending to whatever
              // was already there.
              setRecipeHandoff({
                source: 'sauce',
                ingredients: Array.isArray(initialIngredients) ? [...initialIngredients] : [],
                mode: 'sauce',
                ts: Date.now(),
              });
              setRecipeInitialMode('sauce');
              setRecipeMounted(true);
              setActiveTab('recipe');
            }}
          />
        </div>
      )}

      {/* Recipe Lab — with internal mode switcher */}
      {recipeMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'recipe'
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <RecipeLab
            fullData={data}
            initialIngredient={selectedNode}
            initialIngredients={selectedNodes}
            initialMode={recipeInitialMode}
            handoff={recipeHandoff}
            userProfile={userProfile}
            isMobile={isMobile}
            onFindCocktail={handleFindCocktail}
            onFindSauce={handleFindSauce}
          />
        </div>
      )}

      {/* Make picker — 3-card entry router (existing / scratch / photo)
          per MAKE-MODE-SPEC §2. Pure router: synthesizes a recipeHandoff
          (with source='make-*') or delegates to Cookbook Lab in picker
          mode. Owns no persistent state. */}
      {activeTab === 'make' && (
        <div className="fixed inset-0 overflow-y-auto" style={{ paddingTop: 'var(--nav-h)' }}>
          <MakeRecipeStart
            setRecipeHandoff={setRecipeHandoff}
            setRecipeMounted={setRecipeMounted}
            setActiveTab={setActiveTab}
            setCookbookPickerMode={setCookbookPickerMode}
          />
        </div>
      )}

      {/* CookbookLab — Phase 4 (pipeline 2026-05-16; renamed from
          RecipesLab 2026-05-29 via DOCS-RL-COOKBOOK-RENAME). 3D
          aesthetic recipe browser with 15 hand-curated dishes. Lives
          alongside the Recipes Notebook authoring surface as a
          sub-tab under Explore. */}
      {activeTab === 'cookbook' && (
        <div className="fixed inset-0 overflow-y-auto" style={{ paddingTop: 'var(--nav-h)' }}>
          <CookbookLab
            externalFilter={externalLabFilter}
            ctx={data}
            pickerMode={cookbookPickerMode}
            onExitPickerMode={() => {
              setCookbookPickerMode(null);
              setActiveTab('make');
            }}
            onOpenInNetwork={(ingredientName) => {
              if (ingredientName) {
                setSelectedNode(ingredientName);
                setSelectedNodes([ingredientName]);
              }
              setActiveTab('network');
            }}
            onOpenRecipeLab={(_mode, initialIngredients, extras = {}) => {
              setRecipeHandoff({
                source: 'cookbook',
                ingredients: Array.isArray(initialIngredients) ? [...initialIngredients] : [],
                mode: 'recipe',
                ts: Date.now(),
                ...extras,
              });
              setRecipeInitialMode('recipe');
              setRecipeMounted(true);
              setCookbookPickerMode(null);
              setActiveTab('recipe');
            }}
          />
        </div>
      )}

      {/* R16 Phase 1: FilterPillRow — pinned to the top-center, just below
          the main nav. Tapping a filter pill morphs the wheel layout to
          that axis. Multi-select pills compose AND-intersection on
          node visibility. */}
      {activeTab === 'network' && (
        <>
          {/* R20.1 — SearchBar sits at var(--nav-h). The filter stack
              below uses calc against the same CSS variable so iOS safe-
              area insets push everything down correctly:
                pill row    nav + 3.5rem  (above SearchBar's bottom + 10px gap)
                breadcrumb  nav + 7rem
                slider      nav + 9.5rem
                insight chip nav + 12rem
              The InsightDrawer `?` toggle lives in a separate top-right
              slot so a long filter chain can scroll without squeezing
              the button off-screen on iOS. */}
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[68] pointer-events-none flex items-center gap-2 max-w-[calc(100vw-4rem)]"
            style={{ top: 'calc(var(--nav-h) + 3.5rem)' }}
          >
            <div className="bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] rounded-full shadow-lg pointer-events-auto min-w-0">
              <FilterPillRow
                filterStack={filterStack}
                onToggle={toggleFilter}
                onClear={clearFilters}
                mode={mode}
              />
            </div>
          </div>
          {/* R20.1 — InsightDrawer `?` toggle: top-right of the network
              tab, replacing the spot the HowItWorks `?` used to occupy.
              HowItWorks is now reachable from the Network mode dropdown
              so the corner stays uncluttered. */}
          <button
            type="button"
            onClick={() => setInsightDrawerOpen((v) => !v)}
            aria-label={insightDrawerOpen ? 'Close layout insight drawer' : 'Open layout insight drawer'}
            aria-pressed={insightDrawerOpen}
            data-testid="insight-drawer-toggle"
            className={`fixed right-4 z-[68] pointer-events-auto w-9 h-9 rounded-full border text-sm font-bold leading-none flex items-center justify-center transition-colors shadow-lg ${
              insightDrawerOpen
                ? 'bg-cyan-500/30 border-cyan-300 text-cyan-100'
                : 'bg-[#0a0a12]/85 border-[#2a2a3a] text-gray-400 hover:text-cyan-200 hover:border-cyan-500/40'
            }`}
            style={{ top: 'calc(var(--nav-h) + 0.5rem)' }}
          >
            ?
          </button>
          {/* R16 Phase 3 "Colors: …" chip removed per user feedback
              (2026-05-16) — bucket pills + the ShapeLegend already
              carry the color/shape semantics; the chip just crowded
              the screen. The same a11y signal is still available via
              HUDAnnouncer when the filter changes. */}
          {/* R16 Phase 4: screen-reader announcer for filter changes
              + visible-node-count updates. Visually hidden via sr-only. */}
          <HUDAnnouncer filterStack={filterStack} visibleCount={visibleNodeCount} pullStrength={pullStrength} />
          {/* R16 Phase 2: FilterBreadcrumb — sits just below the pill
              row, derived from filterStack + focusedBucketLabel. Click
              a segment to pop the stack back to that depth. */}
          {filterStack.length > 0 && (
            <div
              className="fixed left-1/2 -translate-x-1/2 z-[68] pointer-events-auto"
              style={{ top: 'calc(var(--nav-h) + 7rem)' }}
            >
              <FilterBreadcrumb
                filterStack={filterStack}
                focusedBucketLabel={focusedBucketLabel}
                onPop={popBreadcrumb}
                isMobile={isMobile}
              />
            </div>
          )}
          {/* R17 — FilterPullSlider: continuous pull strength between
              cooccurrence base (left) and bucket-pole snap (right).
              Hidden when no filter is active (nothing to pull toward).
              Also hidden when only scope filters (cocktail-scope /
              sauce-scope) are active — those are visibility-only and
              have no morph axis to pull toward, so a slider would be
              inert. Gate on `morphAxis` (non-null only when a
              non-scope filter is present). */}
          {filterStack.length > 0 && morphAxis && (
            <div
              className="fixed left-1/2 -translate-x-1/2 z-[68] pointer-events-auto"
              style={{ top: 'calc(var(--nav-h) + 9.5rem)' }}
            >
              <FilterPullSlider
                pullStrength={pullStrength}
                onPullChange={handlePullChange}
                disabled={false}
              />
            </div>
          )}
          {/* R19 Phase 1A — InsightChip: derived narrative of what the
              current (filterStack × pullStrength) layout is doing. Sits
              below the breadcrumb + slider stack; hidden when no filter
              is active. */}
          {filterStack.length > 0 && morphAxis && (
            <div
              className="fixed left-1/2 -translate-x-1/2 z-[68] pointer-events-auto"
              style={{ top: 'calc(var(--nav-h) + 12rem)' }}
            >
              <InsightChip
                filterStack={filterStack}
                pullStrength={pullStrength}
                visibleCount={visibleNodeCount}
                morphAxis={morphAxis}
                bucketCounts={bucketCounts}
              />
            </div>
          )}
          {/* R19 Phase 4 — full narrative drawer, opt-in. */}
          <InsightDrawer
            isOpen={insightDrawerOpen}
            onClose={() => setInsightDrawerOpen(false)}
            isMobile={isMobile}
            filterStack={filterStack}
            pullStrength={pullStrength}
            visibleCount={visibleNodeCount}
            morphAxis={morphAxis}
            bucketCounts={bucketCounts}
            bucketColorMap={insightBucketColorMap}
            bridges={insightBridges}
            clusterOverlap={insightClusterOverlap}
          />
        </>
      )}

      {/* ClusterJoystick — pinned bottom-center pill strip. In Network
          modes the pills are clusters; in Taste modes they're tastes. */}
      {activeTab === 'network' && joystickClusters && (
        <ClusterJoystick
          clusters={joystickClusters}
          morphAxis={morphAxis}
          focusedClusterId={focusedCluster}
          highlightedClusterId={tourHighlightedCluster}
          onClusterFocus={(id) => {
            setFocusedCluster(id);
            // Exiting focus also clears any stale selection so the user
            // isn't stuck with panels open for ingredients they can no
            // longer reach.
            if (id === null) {
              setSelectedNodes([]);
              setActivePanel(null);
            }
          }}
          onFlyTo={(target) => {
            // Cluster object (has typeof id === 'number' + centroid_3d
            // from cluster_labels.json) OR raw {position, ts} target
            // for taste pills. Earlier code checked for `label_anchor_3d`,
            // a field added by an offline R11 script that never made it
            // into the shipped cluster_labels.json, so the cluster
            // branch was silently dead in 'Cooks With · 3D / 2D' modes.
            const isCluster = target && typeof target.id === 'number' && Array.isArray(target.centroid_3d);
            if (isCluster) {
              // Pass clusterId so LivingArchView resolves the live label
              // sprite + runtime centroid (post-GNN-blend, mode-aware).
              // The static centroid_3d we pass as `position` is just a
              // fallback when the sprite isn't found.
              setFlyToTarget({
                position: target.centroid_3d,
                clusterId: target.id,
                ts: Date.now(),
              });
              // Surface top-5 cluster members so the user sees "what's
              // actually here" after the camera lands.
              const names = (target.top_ingredients || []).slice(0, 5);
              setClusterHighlights(names.length > 0 ? [...names] : null);
            } else if (target && target.position) {
              setFlyToTarget({
                position: target.position,
                taste: target.taste || null,
                ts: Date.now(),
              });
              setClusterHighlights(null);
            }
          }}
        />
      )}

      {/* Molecule Lab — slide-out card */}
      <Suspense fallback={null}>
        <MoleculeLab
          isOpen={moleculeLabOpen}
          onClose={() => { setMoleculeLabOpen(false); setMoleculeLabPreset(''); }}
          selectedNodes={selectedNodes}
          selectedNodesData={selectedNodes.map(n => data?.graph?.nodes?.get(n)).filter(Boolean)}
          graphNodes={data?.graph?.nodes}
          onSelectIngredient={handleSearchSelect}
          initialSmiles={moleculeLabPreset}
        />
      </Suspense>

      {/* Molecule of the Day — shelved. The component, fetch logic, and
          card rendering live in src/components/MoleculeOfTheDay.jsx and
          can be re-enabled by uncommenting the lazy import at the top of
          this file and the JSX block below. We may want to use it as a
          feature another day — e.g. a tile on the landing page or a
          rotating spotlight inside Molecule Lab.
      {startPageComplete && activeTab === 'network' && !moleculeLabOpen && !isMobile && (
        <Suspense fallback={null}>
          <MoleculeOfTheDay
            onOpen={(preset) => {
              if (preset?.smiles) setMoleculeLabPreset(preset.smiles);
              setMoleculeLabOpen(true);
            }}
          />
        </Suspense>
      )}
      */}

      {/* Mobile bottom sheet for panels */}
      {isMobile && (
        <BottomSheet
          isOpen={activePanel != null}
          onClose={() => {
            // Closing the sheet on mobile must also clear the selection
            // — without this, the selected ingredient stays "open" in
            // state and re-tapping the same node is a no-op (it's
            // already in selectedNodes, so the next tap removes rather
            // than re-opens). Mirrors handlePanelClose on desktop.
            if (activePanel === 'ingredient') {
              setSelectedNodes([]);
              setHighlightPairings(null);
            }
            setActivePanel(null);
          }}
          title={
            activePanel === 'ingredient' ? (selectedNodeData?.name || 'Details') :
            activePanel === 'global-insights' ? 'Network Analysis' :
            'Panel'
          }
        >
          {activePanel === 'ingredient' && selectedNodeData && (
            <IngredientPanel
              node={selectedNodeData}
              neighbors={neighbors}
              onClose={handlePanelClose}
              onSelectIngredient={handleSearchSelect}
              onFilterBucket={onFilterBucketFromWheel}
              onHighlightPairings={(names) => setHighlightPairings(
                highlightPairings ? null : names
              )}
              commonPairings={commonPairings}
              selectedNodes={selectedNodes}
              selectedNodesData={selectedNodes.map(n => data?.graph?.nodes?.get(n)).filter(Boolean)}
              selectedCount={selectedNodes.length}
              affinityEngaged={affinityEnabled && selectedNodes.length === 1 && affinityRequested}
              isFavorite={selectedNode ? userProfile.hasIngredient(selectedNode) : false}
              onToggleFavorite={userProfile.toggleIngredient}
          onTogglePairing={userProfile.togglePairing}
          hasPairing={userProfile.hasPairing}
              graphNodes={data?.graph?.nodes}
              cuisinePairLookup={data?.cuisinePairLookup}
              bridgeCompounds={data?.bridgeCompounds}
              embedded
            />
          )}
          {activePanel === 'global-insights' && (
            <GlobalInsights
              nodes={data ? data.graph.nodes : null}
              edges={data ? data.graph.edges : null}
              filterCuisine={selectedCuisine}
              filterTaste={selectedTaste}
              treeFilterIngredients={treeFilterIngredients}
              treeFilterLabel={treeFilterLabel}
              selectedNodes={selectedNodes}
              isOpen={true}
              onClose={() => setActivePanel(null)}
              embedded
            />
          )}
        </BottomSheet>
      )}

      {/* GuidedTour overlay — Phase 6 (2026-05-16). Activated by a
          radar click from Guided/Build results. Pops up over the
          network canvas, walks the user through 6 stages with copy +
          accent gradients. Honors localStorage feature flag. */}
      {tourActive && activeTab === 'network' && (
        <GuidedTour
          axis={tourAxis}
          focalName={tourFocal}
          chosenAxisKey={tourChosenAxisKey}
          focalBucket={tourFocalBucket}
          pickedClusterName={tourPickedClusterName}
          sceneHandle={sceneHandle}
          onExit={() => {
            setTourActive(false);
            // Cancel any in-flight pull animation when the user exits.
            if (tourAnimRef.current) {
              cancelAnimationFrame(tourAnimRef.current);
              tourAnimRef.current = null;
            }
          }}
          onPickLab={(labKey) => {
            setTourActive(false);
            if (tourAnimRef.current) {
              cancelAnimationFrame(tourAnimRef.current);
              tourAnimRef.current = null;
            }
            if (labKey === 'recipes') { setActiveTab('cookbook'); setLabTourKey('recipes'); }
            else if (labKey === 'cocktail') { setCocktailMounted(true); setActiveTab('cocktail'); setLabTourKey('cocktail'); }
            else if (labKey === 'sauce') { setSauceMounted(true); setActiveTab('sauce'); setLabTourKey('sauce'); }
            // labKey === 'done' → leave user on network tab
          }}
        />
      )}

      {/* Per-lab tour overlay — Spec §2.J. Activated when the main
          GuidedTour's chooseLab stage picks a lab. Mounts on top of
          the active lab and walks through that lab's mechanics. */}
      {labTourKey && (
        ((labTourKey === 'recipes' && activeTab === 'cookbook') ||
          (labTourKey === 'cocktail' && activeTab === 'cocktail') ||
          (labTourKey === 'sauce' && activeTab === 'sauce')) && (
          <LabTour
            labKey={labTourKey}
            onExit={() => setLabTourKey(null)}
          />
        )
      )}

      {/* Mobile tab bar */}
      {isMobile && (
        <MobileTabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'cocktail') setCocktailMounted(true);
            if (tab === 'sauce') setSauceMounted(true);
            if (tab === 'recipe') setRecipeMounted(true);
            setLabDropdownOpen(false);
          }}
          networkMode={mode}
          onNetworkModeChange={setMode}
          onOpenProfile={() => setActiveTab('profile')}
        />
      )}

    </>
  );
}
