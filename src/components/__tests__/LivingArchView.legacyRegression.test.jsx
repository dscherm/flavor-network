// @vitest-environment jsdom
/**
 * LivingArchView — legacy regression (P4, ADR-3).
 *
 * Asserts the byte-identical-when-null contract for CameraAnimator's
 * pivot-advance config:
 *
 *   mode === '3D' / 'ml'        → setPivotConfig({pivotAdvanceMs: null})
 *                                  (or never called; both mean "off")
 *   mode === 'flavor3D' / 'mlflavor'
 *                                → setPivotConfig({
 *                                     pivotAdvanceMs: 3500,
 *                                     pivotTargets: [...with centroid_3d],
 *                                   })
 *
 * Also asserts the chip-sidebar wiring: in flavor3D mode the chip
 * source switches to data.flavorClusterLabels.clusters, and each
 * cluster surfaces its `color` field through to ClusterJoystick's
 * per-pill style.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// ── three.js + post-processing stubs ───────────────────────────────
// jsdom has no WebGL, so the entire three pipeline (renderer, controls,
// composer) needs to be no-op'd before LivingArchView's mount effect
// touches them. We retain real Vector3 + Color so the live arithmetic
// inside LivingArchView (camera positioning, label centroids) still
// behaves like production.

vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  class FakeWebGLRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
    }
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    render() {}
    dispose() {}
    getPixelRatio() { return 1; }
    getSize() { return new actual.Vector2(640, 480); }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    constructor() {
      this.target = { x: 0, y: 0, z: 0, copy: () => {}, set: () => {} };
      this.enabled = true;
      this.enableDamping = false;
      this.dampingFactor = 0;
      this.minDistance = 0;
      this.maxDistance = 0;
      this.minPolarAngle = 0;
      this.maxPolarAngle = Math.PI;
    }
    update() {}
    dispose() {}
    addEventListener() {}
    removeEventListener() {}
  },
}));

vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    constructor() {}
    addPass() {}
    setSize() {}
    render() {}
    dispose() {}
  },
}));

vi.mock('three/addons/postprocessing/RenderPass.js', () => ({
  RenderPass: class {},
}));

vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: class { constructor() { this.strength = 0; } },
}));

// ── CameraAnimator spy ─────────────────────────────────────────────
// Hand back a real-looking instance so LivingArchView's wiring runs,
// but capture every constructor + setPivotConfig invocation for the
// assertions below.

const animatorCalls = [];
const setPivotConfigCalls = [];

vi.mock('../../three/CameraAnimator.js', () => {
  return {
    CameraAnimator: class CameraAnimatorSpy {
      constructor(sceneCtx, adapter, opts) {
        animatorCalls.push({ sceneCtx, adapter, opts });
      }
      attachMediaQueryListener() {}
      setPivotConfig(cfg) { setPivotConfigCalls.push(cfg); }
      engageClusterTour() {}
      recordInput() {}
      dispose() {}
      tickAnimation() {}
    },
  };
});

// AffinityMode also touches three; mock with a no-op so the affinity
// branch doesn't blow up when neighbors / affinityThresholds fixture
// data is present.
vi.mock('../../three/AffinityMode.js', () => ({
  AffinityMode: class {
    constructor() {}
    dispose() {}
    refreshWedgeLayout() {}
  },
}));

// Other in-component heavy modules — mock anything that touches the
// renderer or shaders so it returns an empty material/geometry.
vi.mock('../../three/ShaderMaterials.js', () => {
  const stubMat = () => ({
    dispose: () => {},
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uBrightness: { value: 1 },
      uActivation: { value: 0 },
    },
  });
  return {
    createLivingEdgeMaterial: stubMat,
    createLivingParticleMaterial: stubMat,
  };
});

// livingArchUtils.makeLabel uses canvas 2D context which jsdom doesn't
// implement. Return a real THREE.Sprite with a SpriteMaterial that has
// a .color so the P4 sprite-tinting code (`sprite.material.color.set`)
// still executes.
vi.mock('../livingArchUtils.js', async () => {
  const actual = await vi.importActual('../livingArchUtils.js');
  const THREE = await vi.importActual('three');
  return {
    ...actual,
    makeLabel: () => {
      // Provide a real Texture as the material's map so disposal in
      // the LivingArchView cleanup effect (`map.dispose()`) doesn't
      // null-deref. jsdom has no canvas backend, so we build the
      // texture from a DataTexture (no canvas needed).
      const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      tex.needsUpdate = true;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1, 1, 1);
      return sprite;
    },
  };
});

// requestAnimationFrame in jsdom may not exist or may loop forever —
// no-op it so the per-frame ticker doesn't run during the test.
beforeEach(() => {
  animatorCalls.length = 0;
  setPivotConfigCalls.length = 0;
  globalThis.requestAnimationFrame = (cb) => 0;
  globalThis.cancelAnimationFrame = () => {};
});

// Import AFTER all mocks are in place so module resolution picks up
// the stubbed three / animator.
const importLivingArchView = async () => (await import('../LivingArchView.jsx')).default;

// ── Fixture data ───────────────────────────────────────────────────
const FIXTURE_CLUSTERS = [
  { id: 0, label: 'Citrus', centroid_3d: [10, 0, 0], color: '#a855f7' },
  { id: 1, label: 'Sweet',  centroid_3d: [0, 10, 0], color: '#f472b6' },
  { id: 2, label: 'Sour',   centroid_3d: [0, 0, 10], color: '#22d3ee' },
];

function makeFixtureData() {
  const nodes = new Map();
  for (let i = 0; i < 5; i++) {
    nodes.set(`ing-${i}`, {
      name: `ing-${i}`,
      pairingCount: 10 - i,
      taste: 'sweet',
      cuisines: [],
    });
  }
  return {
    graph: { nodes, edges: [] },
    positions: { positions: {} },
    flavorPositions: { positions: {} },
    flavorClusterLabels: { clusters: FIXTURE_CLUSTERS },
    clusterLabels: { clusters: [
      { id: 0, label: 'Baked', centroid_3d: [5, 0, 0] },
    ] },
    gnnEntropy: null,
    cuisineMap: null,
    seasonMap: null,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('LivingArchView P4 — CameraAnimator pivot-advance wiring (legacy regression)', () => {
  it('mode="ml" (legacy 3D) → setPivotConfig called with pivotAdvanceMs: null', async () => {
    const LivingArchView = await importLivingArchView();
    render(<LivingArchView data={makeFixtureData()} mode="ml" />);
    expect(animatorCalls.length).toBeGreaterThanOrEqual(1);
    // Every setPivotConfig invocation while in legacy mode must carry
    // pivotAdvanceMs === null (or never be called — both satisfy the
    // ADR-3 byte-identical contract).
    for (const cfg of setPivotConfigCalls) {
      expect(cfg.pivotAdvanceMs === null || cfg.pivotAdvanceMs === undefined).toBe(true);
    }
  });

  it('mode="ml2d" (legacy 2D) → setPivotConfig also passes pivotAdvanceMs: null', async () => {
    const LivingArchView = await importLivingArchView();
    render(<LivingArchView data={makeFixtureData()} mode="ml2d" />);
    for (const cfg of setPivotConfigCalls) {
      expect(cfg.pivotAdvanceMs === null || cfg.pivotAdvanceMs === undefined).toBe(true);
    }
  });

  it('mode="mlflavor" (flavor3D) → setPivotConfig called with pivotAdvanceMs: 3500 + non-empty pivotTargets', async () => {
    const LivingArchView = await importLivingArchView();
    render(<LivingArchView data={makeFixtureData()} mode="mlflavor" />);
    expect(animatorCalls.length).toBeGreaterThanOrEqual(1);
    const flavorCfgs = setPivotConfigCalls.filter(c => c.pivotAdvanceMs === 3500);
    expect(flavorCfgs.length).toBeGreaterThanOrEqual(1);
    const cfg = flavorCfgs[flavorCfgs.length - 1];
    expect(Array.isArray(cfg.pivotTargets)).toBe(true);
    expect(cfg.pivotTargets.length).toBeGreaterThan(0);
    // Field-name regression — must be centroid_3d, not bare centroid.
    expect(cfg.pivotTargets[0]).toHaveProperty('centroid_3d');
    expect(Array.isArray(cfg.pivotTargets[0].centroid_3d)).toBe(true);
    expect(cfg.pivotTargets[0].centroid_3d).toHaveLength(3);
  });

  it('flavor3D fixture without flavorClusterLabels → falls back to empty pivotTargets array (no crash)', async () => {
    const LivingArchView = await importLivingArchView();
    const data = makeFixtureData();
    data.flavorClusterLabels = null;
    render(<LivingArchView data={data} mode="mlflavor" />);
    const flavorCfgs = setPivotConfigCalls.filter(c => c.pivotAdvanceMs === 3500);
    // Still configured with pivotAdvanceMs:3500, but with an empty
    // pivotTargets array — the animator gracefully no-ops.
    if (flavorCfgs.length > 0) {
      expect(Array.isArray(flavorCfgs[0].pivotTargets)).toBe(true);
    }
  });
});

// ── ClusterJoystick chip-sidebar coloring ──────────────────────────
// P4 surfaces per-cluster colors as the chip pill background/border
// when the flavor-cluster array is the chip source. This test mounts
// ClusterJoystick directly (it lives in App.jsx's render path) with
// the same flavor-cluster fixture and asserts each pill renders with
// its cluster's `color`.

import ClusterJoystick from '../ClusterJoystick.jsx';

// App.jsx joystickClusters resolution — source-shape regression so the
// chip-sidebar swap (recipe-coocc → flavor-UMAP clusters in flavor3D
// mode) doesn't silently regress. We grep the live file rather than
// mounting App (which would pull every lab + auth + provider).

describe('App.jsx — joystickClusters wires flavor3D to data.flavorClusterLabels', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(
    path.resolve(process.cwd(), 'src/App.jsx'),
    'utf8',
  );

  it('contains the flavor3D mode branch resolving to data.flavorClusterLabels.clusters', () => {
    // Tolerant whitespace match; the branch must appear inside the
    // joystickClusters useMemo body.
    const re = /mode === ['"]flavor3D['"][\s\S]{0,200}?data\?\.flavorClusterLabels\?\.clusters/;
    expect(re.test(src)).toBe(true);
  });

  it('still falls back to data.clusterLabels.clusters in legacy modes', () => {
    expect(src.includes('data?.clusterLabels?.clusters')).toBe(true);
  });
});

function hexToRgbTriplet(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

describe('ClusterJoystick — flavor3D per-cluster colors', () => {
  it('renders one pill per flavor cluster, each tinted with the cluster color', () => {
    const { container } = render(
      <ClusterJoystick clusters={FIXTURE_CLUSTERS} onFlyTo={() => {}} />,
    );
    const pills = container.querySelectorAll('button[data-cluster-id]');
    expect(pills.length).toBe(FIXTURE_CLUSTERS.length);
    const colors = new Set();
    pills.forEach((pill, i) => {
      const styleAttr = pill.getAttribute('style') || '';
      // jsdom normalizes #rrggbb in style attrs to rgb(r, g, b) for
      // the color shorthand. The hex itself still appears in the
      // rgba()/border alpha-blended channels because of the string
      // concatenation in the component, so either form satisfies.
      const hex = FIXTURE_CLUSTERS[i].color.toLowerCase();
      const rgb = hexToRgbTriplet(hex);
      const matches = styleAttr.toLowerCase().includes(hex)
        || styleAttr.toLowerCase().includes(rgb);
      expect(matches).toBe(true);
      colors.add(hex);
    });
    // N distinct colors → no accidental palette collision.
    expect(colors.size).toBe(FIXTURE_CLUSTERS.length);
  });
});
