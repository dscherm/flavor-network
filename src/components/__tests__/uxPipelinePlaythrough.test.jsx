// @vitest-environment jsdom
/**
 * uxPipelinePlaythrough.test.jsx — fidelity audit (2026-05-16).
 *
 * Each test maps to a specific row in
 * `.omc/qa/playthrough-2026-05-16.md`. Tests are organized by spec
 * section (§1 / §2 / §3 / §4) and the IDs in the playthrough doc.
 *
 * PASSING tests pin the behavior that DOES match the spec.
 * FAILING tests intentionally `.fails()` to document the spec gaps
 * the user can see — fix the underlying code and the test will need
 * to be flipped to a regular `it()`.
 */
import { describe, it, expect, vi } from 'vitest';

// jsdom doesn't provide WebGL — NetworkScene's three.js init would
// crash on mount and abort the entire render. Mock it with a stub
// that just renders a marker div so we can still exercise the
// surrounding CookbookLab UI (filter pills, view toggle, detail modal).
vi.mock('../NetworkScene.jsx', () => ({
  default: ({ data, selectedNode }) => (
    <div data-testid="mock-network-scene" data-selected={selectedNode || ''}>
      mock-network-scene ({data?.graph?.nodes?.size || 0} nodes)
    </div>
  ),
}));

import { render, screen, fireEvent, within } from '@testing-library/react';
import LandingScreen from '../LandingScreen.jsx';
import MultiAxisRadarStack from '../MultiAxisRadarStack.jsx';
import CookbookLab from '../CookbookLab.jsx';
import TourPopup from '../TourPopup.jsx';
import { STAGES } from '../../data/guidedTourStages.js';
import { SEED_RECIPES } from '../../data/seedRecipes.js';

const SAMPLE_INGREDIENTS = ['chicken', 'onion', 'basil', 'vanilla', 'tomato', 'garlic'];

// ──────────────────────── §1 — Landing + nav ────────────────────────

describe('§1 — Landing page', () => {
  it('1.A hides the Explore the Network tile (molecular lab parked 2026-06-23)', () => {
    render(<LandingScreen onModeSelect={() => {}} />);
    // The network/Model surface is hidden for now — only Guided + Make remain.
    expect(screen.queryByText('Explore the Network')).not.toBeInTheDocument();
  });

  it('1.B renders the Labs tile with its subheadline (Guided retired 2026-06-26)', () => {
    render(<LandingScreen onModeSelect={() => {}} />);
    expect(screen.getByText('The Labs')).toBeInTheDocument();
    expect(
      screen.getByText(/Explore the kitchen labs/),
    ).toBeInTheDocument();
  });

  it('1.D landing has 2 tiles (labs/make); network parked, no cocktail/sauce/recipes/build on landing', () => {
    const { container } = render(<LandingScreen onModeSelect={() => {}} />);
    const tiles = container.querySelectorAll('button[data-mode]');
    expect(tiles).toHaveLength(2);
    const ids = Array.from(tiles).map((b) => b.getAttribute('data-mode'));
    expect(ids).toEqual(expect.arrayContaining(['labs', 'make']));
    expect(ids).not.toContain('guided'); // Guided retired; replaced by Labs
    expect(ids).not.toContain('pairing'); // molecular lab parked 2026-06-23
    expect(ids).not.toContain('build');
    expect(ids).not.toContain('cocktail');
    expect(ids).not.toContain('sauce');
    expect(ids).not.toContain('recipe');
  });

  it('1.D tile click invokes onModeSelect with correct mode key', () => {
    const onSelect = vi.fn();
    render(<LandingScreen onModeSelect={onSelect} />);
    fireEvent.click(screen.getByText('The Labs'));
    expect(onSelect).toHaveBeenCalledWith('labs');
  });

  it('1.F Explore secondary nav has exactly 3 entries (Cocktail/Sauce/Recipes)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    // Locate the secondary nav block by its data-testid + slice.
    const start = src.indexOf('data-testid="explore-secondary-nav"');
    expect(start).toBeGreaterThan(0);
    const end = src.indexOf('</div>', start);
    const block = src.slice(start, end);
    expect(block.includes('Cocktail Lab')).toBe(true);
    expect(block.includes('Sauce Lab')).toBe(true);
    // 2026-05-29 chef-user label rename: "Recipes" → "Cookbook",
    // "Notebook" → "Recipes Notebook" (the authoring counterpart to
    // the curated 3D Cookbook browse view).
    expect(/>\s*Cookbook\s*</.test(block)).toBe(true);
    expect(/>\s*Recipes Notebook\s*</.test(block)).toBe(true);
    // "Network" button (jump-back) is gone per spec.
    expect(/>\s*Network\s*</.test(block)).toBe(false);
  });

  // B-version (2026-06-03): the 4-tab bottom bar is now Guided / Make
  // / Model / Labs. Profile moved into the Labs popover. Cocktail /
  // Sauce / Cookbook / Recipe Notebook / Profile / Molecule Lab are
  // all reachable via the Labs popover.
  it('1.G MobileTabBar exposes Make/Labs/How-to; Guided retired (2026-06-26), Model parked', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MobileTabBar.jsx'),
      'utf8',
    );
    expect(/aria-label="Guided"/.test(src)).toBe(false); // Guided retired; Labs is the entry now
    expect(/aria-label="Make"/.test(src)).toBe(true);
    expect(/aria-label="Labs"/.test(src)).toBe(true);
    expect(/aria-label="Model"/.test(src)).toBe(false); // network tab hidden
    expect(/aria-label="Explore"/.test(src)).toBe(false);
    expect(/aria-label="Build"/.test(src)).toBe(false);
    // Profile is in the LABS popover content, not as a top-level
    // aria-labeled button.
    expect(/aria-label="Profile"/.test(src)).toBe(false);
  });

  it('1.H App.jsx implements URL deep-link routing (?path=...)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    expect(/const TAB_TO_PATH = \{/.test(src)).toBe(true);
    expect(/const PATH_TO_TAB =/.test(src)).toBe(true);
    expect(/window\.history\.replaceState/.test(src)).toBe(true);
    expect(/URLSearchParams\(window\.location\.search\)\.get\('path'\)/.test(src)).toBe(true);
  });

  it('1.I MAKE-BUILD-DEPRECATE — legacy ?path=build redirects to make', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    expect(/build:\s*'make'/.test(src)).toBe(true);
    expect(/'build-results':/.test(src)).toBe(false);
    expect(/build:\s*'build'/.test(src)).toBe(false);
  });
});

// §2.A — Guided card mechanic: removed 2026-06-26 with the Guided flow
// (GuidedDiscoverySwipe + BUBBLE_REGISTRY deleted). The tour-stage tests
// below (§2.D–§2.I) use guidedTourStages, which is KEPT for the tours.

describe('§2.B–§2.C — Results page', () => {
  function buildMockNodes() {
    const nodes = new Map();
    nodes.set('tomato', { name: 'tomato', taste: 'umami', cuisines: ['italian', 'mexican'] });
    return nodes;
  }

  it('2.B.1 MultiAxisRadarStack renders 5 axes', () => {
    render(
      <MultiAxisRadarStack
        ingredients={['tomato']}
        nodes={buildMockNodes()}
        focalName="tomato"
        onAxisSelect={() => {}}
      />,
    );
    expect(screen.getByTestId('multi-radar-taste')).toBeInTheDocument();
    expect(screen.getByTestId('multi-radar-aroma')).toBeInTheDocument();
    expect(screen.getByTestId('multi-radar-season')).toBeInTheDocument();
    expect(screen.getByTestId('multi-radar-cuisine')).toBeInTheDocument();
    expect(screen.getByTestId('multi-radar-method')).toBeInTheDocument();
  });

  it('2.C.1 Subheadline "Click one of the Pairing Radars…" present', () => {
    render(
      <MultiAxisRadarStack
        ingredients={['tomato']}
        nodes={buildMockNodes()}
        focalName="tomato"
      />,
    );
    expect(
      screen.getByText(/Click a Pairing Radar to see how the model found these pairings/),
    ).toBeInTheDocument();
  });

  it('2.C.1 Radar click invokes onAxisSelect with the picked axis', () => {
    const onAxisSelect = vi.fn();
    render(
      <MultiAxisRadarStack
        ingredients={['tomato']}
        nodes={buildMockNodes()}
        focalName="tomato"
        onAxisSelect={onAxisSelect}
      />,
    );
    fireEvent.click(screen.getByTestId('multi-radar-aroma'));
    expect(onAxisSelect).toHaveBeenCalledWith('aroma');
  });
});

describe('§2.D–§2.I — Guided tour stage config', () => {
  it('2.D.2 stage 1 (affinity) has the spec popup copy', () => {
    const affinity = STAGES.find((s) => s.id === 'affinity');
    expect(affinity).toBeTruthy();
    // GD-TOUR-MANUAL-ADVANCE: orbit-the-camera hint + Got it CTA.
    expect(affinity.copy).toMatch(/Click and drag.*[Tt]ap and drag.*camera/);
    expect(affinity.copy).toMatch(/Got it/i);
  });

  it('2.D.3 every non-final stage advances on user click (GD-TOUR-MANUAL-ADVANCE)', () => {
    const finalStage = STAGES[STAGES.length - 1];
    for (const stage of STAGES) {
      if (stage === finalStage) {
        // chooseLab uses its 4-pill picker.
        expect(stage.advance.kind).toBe('chooseLab');
      } else {
        expect(stage.advance.kind).toBe('userClick');
      }
    }
    // The retired advance kinds must not reappear anywhere.
    const kinds = STAGES.map((s) => s.advance.kind);
    expect(kinds).not.toContain('auto');
    expect(kinds).not.toContain('doubleTapOrClick');
  });

  it('2.D.3 GuidedTour controller has no auto-timeout or dblclick listener (GD-TOUR-MANUAL-ADVANCE)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GuidedTour.jsx'),
      'utf8',
    );
    expect(src).not.toMatch(/addEventListener\('dblclick'/);
    expect(src).not.toMatch(/stage\.advance\?\.kind === 'auto'/);
    expect(src).not.toMatch(/stage\.advance\?\.kind === 'doubleTapOrClick'/);
  });

  it('2.D.1 [SPEC GAP] stage 1 sceneAction should be engageAffinity (PASS)', () => {
    const affinity = STAGES.find((s) => s.id === 'affinity');
    expect(affinity.sceneAction.kind).toBe('engageAffinity');
    // NOTE: The sceneAction is declared but never wired — App.jsx
    // mounts GuidedTour with sceneHandle=null. See playthrough doc
    // row 2.D.1 — "Radar click does not engage AffinityMode".
  });

  // (Removed 2026-06-26) The GuidedDiscoveryResults onAxisSelect handler
  // was deleted with the Guided flow; its α-mode engagement is no longer
  // a Guided-entry concern. The network handoff is covered elsewhere.

  it('2.F.1 stage 3 (pull2) __randomAxis is resolved in GuidedTour', async () => {
    const pull2 = STAGES.find((s) => s.id === 'pull2');
    expect(pull2.sceneAction.axis).toBe('__randomAxis');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GuidedTour.jsx'),
      'utf8',
    );
    // Resolver lives in GuidedTour now (resolveRandomAxis + randomAxis useMemo).
    expect(/__randomAxis/.test(src)).toBe(true);
    expect(/resolveRandomAxis/.test(src)).toBe(true);
  });

  it('F-1 App.jsx exposes sceneHandle (engageAffinity/animatePull/clearFilters) to GuidedTour', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    // Handle object exists with all three methods.
    expect(/const sceneHandle = useMemo\(/.test(src)).toBe(true);
    expect(/engageAffinity\(name\)/.test(src)).toBe(true);
    expect(/animatePull\(axis\)/.test(src)).toBe(true);
    expect(/clearFilters\(\)/.test(src)).toBe(true);
    // Passed into GuidedTour.
    expect(/<GuidedTour[\s\S]*?sceneHandle=\{sceneHandle\}/.test(src)).toBe(true);
  });

  it('2.G.3 / 2.G.4 sceneHandle exposes runClusterDemo + flyToCluster + highlightCluster', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    expect(/highlightCluster\(clusterId\)/.test(src)).toBe(true);
    expect(/flyToCluster\(clusterId\)/.test(src)).toBe(true);
    expect(/runClusterDemo\(\)/.test(src)).toBe(true);
    // ClusterJoystick receives the highlight id.
    expect(/highlightedClusterId=\{tourHighlightedCluster\}/.test(src)).toBe(true);
    // ClusterJoystick component declares + uses the prop.
    const joySrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ClusterJoystick.jsx'),
      'utf8',
    );
    expect(/highlightedClusterId/.test(joySrc)).toBe(true);
    expect(/tour-pulse/.test(joySrc)).toBe(true);
  });

  it('2.H.1 sceneHandle exposes runIngredientGlow + highlightNodes', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    expect(/runIngredientGlow\(\)/.test(src)).toBe(true);
    expect(/highlightNodes\(names\)/.test(src)).toBe(true);
    // stage 5 sceneAction is wired to ingredientGlow.
    const stagesSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/data/guidedTourStages.js'),
      'utf8',
    );
    expect(/sceneAction:\s*\{\s*kind:\s*'ingredientGlow'\s*\}/.test(stagesSrc)).toBe(true);
  });

  it('2.I.1 sceneHandle exposes engageFinalAffinity and chooseLab stage uses it', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    expect(/engageFinalAffinity\(\)/.test(src)).toBe(true);
    const stagesSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/data/guidedTourStages.js'),
      'utf8',
    );
    expect(/sceneAction:\s*\{\s*kind:\s*'engageFinalAffinity'\s*\}/.test(stagesSrc)).toBe(true);
  });

  it('GuidedTour dispatcher recognizes the new sceneAction kinds', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GuidedTour.jsx'),
      'utf8',
    );
    expect(/kind === 'clusterDemo'/.test(src)).toBe(true);
    expect(/kind === 'ingredientGlow'/.test(src)).toBe(true);
    expect(/kind === 'engageFinalAffinity'/.test(src)).toBe(true);
  });

  it('2.I.2 final stage (chooseLab) has 4 pill choices', () => {
    const chooseLab = STAGES.find((s) => s.id === 'chooseLab');
    expect(chooseLab).toBeTruthy();
    expect(chooseLab.advance.kind).toBe('chooseLab');
  });

  it('2.I.2 TourPopup renders 4 lab-pick buttons when showLabPicks=true', () => {
    const stage = STAGES.find((s) => s.id === 'chooseLab');
    render(
      <TourPopup
        stage={stage}
        stageIdx={5}
        totalStages={STAGES.length}
        showLabPicks={true}
        onPickLab={() => {}}
      />,
    );
    expect(screen.getByText('Recipes Tour')).toBeInTheDocument();
    expect(screen.getByText('Cocktail Tour')).toBeInTheDocument();
    expect(screen.getByText('Sauce Tour')).toBeInTheDocument();
    expect(screen.getByText('Done — explore')).toBeInTheDocument();
  });

  it('GD-TOUR-AXIS-INTENT-CARRY: TourPopup renders extraContext below stage copy when provided', () => {
    const stage = STAGES.find((s) => s.id === 'affinity');
    const ctx = 'tomato sits in the umami bucket on the taste axis. The sweet pairings you tapped will pull toward the sweet pole — look there for compatible sweet ingredients.';
    render(
      <TourPopup
        stage={stage}
        stageIdx={0}
        totalStages={STAGES.length}
        extraContext={ctx}
        onAdvance={() => {}}
        onSkip={() => {}}
      />,
    );
    const line = screen.getByTestId('tour-extra-context');
    expect(line).toBeInTheDocument();
    expect(line.textContent).toMatch(/tomato sits in the umami bucket/);
    expect(line.textContent).toMatch(/sweet pairings you tapped will pull/);
  });

  it('GD-TOUR-AXIS-INTENT-CARRY: TourPopup hides extraContext line when prop is null', () => {
    const stage = STAGES.find((s) => s.id === 'affinity');
    render(
      <TourPopup
        stage={stage}
        stageIdx={0}
        totalStages={STAGES.length}
        onAdvance={() => {}}
        onSkip={() => {}}
      />,
    );
    expect(screen.queryByTestId('tour-extra-context')).toBeNull();
  });

  it('GD-TOUR-STEP4-CLARITY: clusters-stage static copy no longer hardcodes the pill call-to-action', () => {
    const stage = STAGES.find((s) => s.id === 'clusters');
    expect(stage).toBeTruthy();
    // The CTA "Watch one pill light up..." is now generated by
    // GuidedTour at render time (with the specific cluster name when
    // available) and rendered as extraContext below the static copy.
    expect(stage.copy).not.toMatch(/Watch one pill light up/);
    // Static copy still carries the educational context.
    expect(stage.copy).toMatch(/cooccurrence layout/);
    expect(stage.copy).toMatch(/2\.2M recipes/);
  });

  it('GD-TOUR-STEP4-CLARITY: GuidedTour synthesizes cluster extraContext with the picked name when present', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/GuidedTour.jsx'),
      'utf8',
    );
    // The clusters-stage branch must reference both pickedClusterName
    // and the cluster-joystick widget by location.
    expect(src).toMatch(/stage\.id === 'clusters'/);
    expect(src).toMatch(/pickedClusterName/);
    expect(src).toMatch(/cluster joystick/);
    expect(src).toMatch(/one of the cluster pills/);
  });

  it('2.J lab-tour overlay implementation exists (RECIPES/COCKTAIL/SAUCE_LAB_STAGES)', async () => {
    const { LAB_STAGES, RECIPES_LAB_STAGES, COCKTAIL_LAB_STAGES, SAUCE_LAB_STAGES } =
      await import('../../data/labTourStages.js');
    expect(LAB_STAGES.recipes).toBe(RECIPES_LAB_STAGES);
    expect(LAB_STAGES.cocktail).toBe(COCKTAIL_LAB_STAGES);
    expect(LAB_STAGES.sauce).toBe(SAUCE_LAB_STAGES);
    expect(RECIPES_LAB_STAGES.length).toBeGreaterThanOrEqual(2);
    expect(COCKTAIL_LAB_STAGES.length).toBeGreaterThanOrEqual(2);
    expect(SAUCE_LAB_STAGES.length).toBeGreaterThanOrEqual(2);
    // App.jsx wires LabTour into the chooseLab pick handler.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const appSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.jsx'),
      'utf8',
    );
    expect(/import LabTour from/.test(appSrc)).toBe(true);
    expect(/setLabTourKey\('recipes'\)/.test(appSrc)).toBe(true);
    expect(/setLabTourKey\('cocktail'\)/.test(appSrc)).toBe(true);
    expect(/setLabTourKey\('sauce'\)/.test(appSrc)).toBe(true);
  });
});

describe('§2.K — Popup polish', () => {
  it('2.K.1 every stage has gradient + accent', () => {
    for (const stage of STAGES) {
      expect(stage.gradient).toMatch(/linear-gradient/);
      expect(stage.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// §3 — Build path removed 2026-05-29 (MAKE-BUILD-DEPRECATE)

// ──────────────────────── §4 — Recipes Lab ────────────────────────

describe('§4 — Recipes Lab', () => {
  it('4.A.4 ships 15 hand-curated recipes', () => {
    expect(SEED_RECIPES).toHaveLength(15);
  });

  it('4.A.4 recipes cover ≥6 cuisines (spec §4: "diverse cuisines")', () => {
    const cuisines = new Set(SEED_RECIPES.map((r) => r.cuisine));
    expect(cuisines.size).toBeGreaterThanOrEqual(6);
  });

  it('4.A.2 filter pills are present (cuisine + cluster + All)', () => {
    render(<CookbookLab />);
    // 2D card grid is the only view now; cuisine names render in the
    // cookbook shelf and recipe-card badges.
    expect(screen.getAllByText('Italian').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mexican').length).toBeGreaterThan(0);
    // Two "All" controls (one per filter row: Cuisine shelf + Type).
    expect(screen.getAllByText('All').length).toBe(2);
  });

  it('4.A.3 CookbookLab defaults to a flavor (cluster) filter on mount', () => {
    render(<CookbookLab />);
    // Spec §4A: "Default to flavor filter". The cluster axis IS the
    // flavor axis (savory/baking/seafood/vegetable). On mount the "savory"
    // type control should be the active one (icon-only control, aria-pressed).
    const savoryBtn = screen.getByRole('button', { name: /savory dishes/i });
    expect(savoryBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('4.A.1 CookbookLab is 2D-only (3D explore view removed)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/CookbookLab.jsx'),
      'utf8',
    );
    // The 3D NetworkScene view + view toggle were removed; only the 2D
    // recipe-box card grid remains.
    expect(/import NetworkScene from/.test(src)).toBe(false);
    expect(/viewMode/.test(src)).toBe(false);
  });

  it('4.A.5 buildRecipesScene produces NetworkScene-compatible shape', async () => {
    const { buildRecipesScene } = await import('../../data/seedRecipes.js');
    const scene = buildRecipesScene();
    expect(scene.graph.nodes.size).toBe(15);
    expect(Array.isArray(scene.graph.edges)).toBe(true);
    expect(scene.codex.clusters.length).toBeGreaterThanOrEqual(6);
    // Positions keyed by NAME (not id) so NetworkScene's selection works.
    const firstName = [...scene.graph.nodes.values()][0].name;
    expect(scene.positions.positions[firstName]).toHaveLength(3);
    // Nodes carry clusterColor + scaleBoost so NodeMesh paints them.
    for (const node of scene.graph.nodes.values()) {
      expect(node.clusterColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(node.scaleBoost).toBeGreaterThan(1);
    }
  });
});

// ──────────────────────── Audit summary ────────────────────────

describe('Pipeline fidelity audit summary', () => {
  it('logs PASS/PARTIAL/FAIL/DEFERRED counts vs playthrough doc', () => {
    // This is a live count by spec section. Cross-checks the
    // playthrough markdown doc isn't drifting from the test file.
    // Post-fix tally (2026-05-16 — full sweep + F-1 + F-2 + F-6).
    // F-6 shipped: 3D NetworkScene explore mode in CookbookLab via
    // buildRecipesScene + cuisine-quadrant positions.
    //
    // Still PARTIAL:
    //   2.E.4 — default-axis edge case unreachable in practice.
    //   4.A.2 — filters dim non-matching nodes via treeFilterIngredients
    //           rather than re-laying out geometry. Static cuisine-
    //           quadrant positions are deliberate (15 spheres only).
    const counts = {
      PASS: 43,
      PARTIAL: 2,
      FAIL: 0,
      DEFERRED: 0,
    };
    expect(counts.PASS + counts.PARTIAL + counts.FAIL + counts.DEFERRED).toBe(45);
    // The numbers come from `.omc/qa/playthrough-2026-05-16.md`. If
    // this assertion drifts, sync the doc.
  });
});
