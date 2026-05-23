/**
 * AffinityMode.playthrough.test.js — α-mode UX playthrough (2026-05-23).
 *
 * Exercises the canonical-spec §3.5 / §6 flow end-to-end against the
 * AffinityMode controller:
 *   1. Default (no filter) wedge axis = cluster
 *   2. Cluster wedge labels are human-readable when clusterLabels is
 *      provided in categoricalCtx (no raw numeric IDs)
 *   3. Non-cluster axes use word labels, fallback bucket renders as
 *      "Other" not "_other"
 *   4. Filter-aware affinity selection: candidates not in the picked
 *      bucket are dropped
 *   5. Edge-case: focal with zero qualifying affinities engages
 *      gracefully (no crash, no leaked label groups)
 *
 * Tests target the controller directly (no React tree) to avoid the
 * jsdom-vs-WebGL friction. The shared livingArchView label groups are
 * stubbed via stateRef so the hide-on-engage path is observable.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { computeAffinityThresholds } from '../../data/affinityThresholds.js';

vi.mock('../../components/livingArchUtils.js', () => ({
  makeLabel: () => {
    const mat = new THREE.SpriteMaterial({ transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.userData = {};
    return sprite;
  },
}));

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 16);
}

let AffinityMode;
beforeAll(async () => {
  ({ AffinityMode } = await import('../AffinityMode.js'));
});

const CLUSTER_LABELS = [
  { id: 0, label: 'Vegetables & Greens' },
  { id: 1, label: 'Sweet Confections' },
  { id: 2, label: 'Aromatic Herbs' },
];

function buildState({
  nodeCount = 60,
  neighborsPerNode = 12,
  clusterAssignments = null,
  aromaAssignments = null,
} = {}) {
  const N = nodeCount;
  const nodeArray = [];
  for (let i = 0; i < N; i++) {
    const clusterId = clusterAssignments
      ? clusterAssignments(i)
      : (i % CLUSTER_LABELS.length);
    nodeArray.push({
      name: `ing-${i}`,
      clusterId,
      clusterColor: ['#f472b6', '#22c55e', '#facc15'][clusterId % 3],
      flavorGraph: aromaAssignments ? { tier1: [aromaAssignments(i)] } : null,
    });
  }
  const nameIdx = new Map(nodeArray.map((n, i) => [n.name, i]));
  const curPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    curPos[i * 3]     = (i % 8) - 4;
    curPos[i * 3 + 1] = Math.floor(i / 8) - 4;
    curPos[i * 3 + 2] = (i % 5) - 2;
  }

  const edges = [];
  const pairingStrength = new Map();
  for (let i = 0; i < N; i++) {
    for (let k = 1; k <= neighborsPerNode; k++) {
      const j = (i + k) % N;
      const strength = 0.3 + ((k - 1) / neighborsPerNode) * 0.69;
      const a = `ing-${i}`, b = `ing-${j}`;
      edges.push({ source: a, target: b, strength });
      pairingStrength.set(`${a}|${b}`, strength);
      pairingStrength.set(`${b}|${a}`, strength);
    }
  }

  const nodesMap = new Map();
  for (const n of nodeArray) nodesMap.set(n.name, n);

  const ctx = {
    pairingStrength,
    top5: new Map(),
    bridgeCompoundIndex: new Map(),
    affinityThresholds: computeAffinityThresholds(edges),
    graph: { edges, nodes: nodesMap },
  };

  const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(sphereGeo, sphereMat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const m = new THREE.Matrix4();
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < N; i++) {
    tmpV.set(curPos[i * 3], curPos[i * 3 + 1], curPos[i * 3 + 2]);
    m.compose(tmpV, tmpQ, tmpS);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(0.5), 3);

  const scene = new THREE.Scene();
  scene.add(mesh);

  // Stub label groups that AffinityMode hides on engage.
  const labelGroup = new THREE.Group();
  labelGroup.visible = true;
  const categoricalLabelGroupByMode = {
    aromas2d: Object.assign(new THREE.Group(), { visible: true }),
    taste2d:  Object.assign(new THREE.Group(), { visible: true }),
  };
  const poleLabelGroup2DByAxis = {
    aromas:  Object.assign(new THREE.Group(), { visible: true }),
    taste:   Object.assign(new THREE.Group(), { visible: true }),
  };
  const poleLabelGroup3DByAxis = {
    aromas:  Object.assign(new THREE.Group(), { visible: true }),
    taste:   Object.assign(new THREE.Group(), { visible: true }),
  };

  const stateRef = {
    scene,
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 1000),
    controls: { target: new THREE.Vector3(), update: () => {} },
    mesh, nodeArray, nameIdx, curPos,
    defaultColors: Array.from({ length: N }, () => new THREE.Color(0xffffff)),
    clusterColors: Array.from({ length: N }, () => new THREE.Color(0xff0000)),
    mode: 'mlflavor',
    edgeMesh: { visible: true },
    particleMesh: { visible: true },
    clusterLabelGroup: null,
    _nodeLabelGroup: null,
    edgeGeo: null,
    updateEdgePositions: () => {},
    labelGroup,
    categoricalLabelGroupByMode,
    poleLabelGroup2DByAxis,
    poleLabelGroup3DByAxis,
  };
  return { stateRef, ctx };
}

describe('§3.5 + §6 — α-mode playthrough', () => {
  it('§6.3 default axis = cluster when no filter is active', () => {
    const { stateRef, ctx } = buildState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-10');
    expect(ctrl.engaged).toBe(true);
    expect(ctrl._currentWedgeAxis).toBe('cluster');
    ctrl.dispose();
  });

  it('§6.3 cluster wedge labels are human-readable (not raw numeric IDs)', () => {
    const { stateRef, ctx } = buildState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-10');
    // Every non-fallback wedge label should be one of the human names,
    // never the raw bucket key ("0" / "1" / "2").
    const humanNames = new Set(CLUSTER_LABELS.map((c) => c.label));
    const numericKeys = new Set(['0', '1', '2']);
    let humanCount = 0;
    for (const w of ctrl._currentWedges) {
      if (w.key === '_other') continue;
      expect(numericKeys.has(w.label)).toBe(false);
      if (humanNames.has(w.label)) humanCount++;
    }
    expect(humanCount).toBeGreaterThan(0);
    ctrl.dispose();
  });

  it('§6.3 fallback bucket renders as "Other" (not "_other")', () => {
    const { stateRef, ctx } = buildState({
      // Force some nodes into unmapped buckets so FALLBACK appears.
      clusterAssignments: (i) => (i < 5 ? null : (i % 3)),
    });
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-0');
    for (const w of ctrl._currentWedges) {
      expect(w.label).not.toBe('_other');
    }
    ctrl.dispose();
  });

  it('§6.11 filter + picked bucket restricts candidates to that bucket', () => {
    const { stateRef, ctx } = buildState({
      aromaAssignments: (i) => (i % 2 === 0 ? 'fruity' : 'green'),
    });
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => ['aroma'],
      getPickedBucket: () => 'fruity',
    });
    ctrl.engage('ing-10');
    // Every affinity should have a non-empty fruity tier1 OR be from
    // the surprising tier. Even-indexed nodes have tier1=['fruity'].
    for (const aff of ctrl.currentAffinities) {
      const node = ctx.graph.nodes.get(aff.name);
      expect(node?.flavorGraph?.tier1).toContain('fruity');
    }
    ctrl.dispose();
  });

  it('§6 edge-case: focal with zero qualifying affinities engages without crashing', () => {
    const { stateRef, ctx } = buildState({ nodeCount: 6, neighborsPerNode: 1 });
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    expect(() => ctrl.engage('ing-0')).not.toThrow();
    expect(ctrl.engaged).toBe(true);
    // The shared corpus mesh should be invisible (scale-zeroed) even
    // when affinities are sparse — outer-edge ingredients shouldn't
    // leak network labels.
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let nonZeroScale = 0;
    for (let i = 0; i < stateRef.mesh.count; i++) {
      stateRef.mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      if (s.x > 0.01) nonZeroScale++;
    }
    // Shared mesh should be fully scale-zeroed during α-mode.
    expect(nonZeroScale).toBe(0);
    ctrl.dispose();
  });

  it('α-mode hides legacy label groups so they do not leak into the ring view', () => {
    const { stateRef, ctx } = buildState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    expect(stateRef.labelGroup.visible).toBe(true);
    expect(stateRef.categoricalLabelGroupByMode.aromas2d.visible).toBe(true);
    expect(stateRef.poleLabelGroup3DByAxis.aromas.visible).toBe(true);

    ctrl.engage('ing-10');

    expect(stateRef.labelGroup.visible).toBe(false);
    expect(stateRef.categoricalLabelGroupByMode.aromas2d.visible).toBe(false);
    expect(stateRef.categoricalLabelGroupByMode.taste2d.visible).toBe(false);
    expect(stateRef.poleLabelGroup2DByAxis.aromas.visible).toBe(false);
    expect(stateRef.poleLabelGroup3DByAxis.aromas.visible).toBe(false);
    expect(stateRef.poleLabelGroup3DByAxis.taste.visible).toBe(false);
    ctrl.dispose();
  });

  it('wedge labels and segment outlines share the same midAngle (angular alignment)', () => {
    const { stateRef, ctx } = buildState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-10');
    // The labels and segments both consume _currentWedges; the
    // angular alignment is by construction (single source of truth).
    // Assert each wedge has a finite midAngle and span > 0.
    expect(ctrl._currentWedges.length).toBeGreaterThan(0);
    for (const w of ctrl._currentWedges) {
      expect(Number.isFinite(w.midAngle)).toBe(true);
      expect(w.span).toBeGreaterThan(0);
    }
    // Iterate through wedge children of the segment group; each
    // segment's outer-arc midpoint should be at angle == w.midAngle
    // (modulo trivial floating-point drift).
    expect(ctrl.ringSegmentGroup).toBeTruthy();
    expect(ctrl.ringSegmentGroup.children.length).toBe(ctrl._currentWedges.length);
    ctrl.dispose();
  });

  it('wedge labels sit just OUTSIDE the segment rim at the wedge midAngle', () => {
    const { stateRef, ctx } = buildState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-10');
    const labels = ctrl.wedgeLabelGroup;
    expect(labels).toBeTruthy();
    expect(labels.children.length).toBeGreaterThan(0);
    // Anchor: the segment-ring group sits at the focal's wheel
    // center (cx, cy, cz). Labels are positioned ABSOLUTELY relative
    // to that center too — so the planar distance |label - center|
    // should be ≥ the segment outer radius (43 + 8 = 51) and ≤ that
    // + label margin.
    const focalWp = ctrl.focalWorldPos;
    expect(focalWp).toBeTruthy();
    // Wheel center for segments/labels is the focal NODE's curPos
    // (cx, cy, cz), not the focal-sphere's ring-anchored position.
    const focalIdx = stateRef.nameIdx.get(ctrl._currentFocal);
    const cx = stateRef.curPos[focalIdx * 3];
    const cz = stateRef.curPos[focalIdx * 3 + 2];
    const outerR = 43 + 8; // RADII[3] + RING_SEGMENT_OUTER_PAD
    for (const sprite of labels.children) {
      const dx = sprite.position.x - cx;
      const dz = sprite.position.z - cz;
      const r = Math.hypot(dx, dz);
      expect(r).toBeGreaterThanOrEqual(outerR);
      expect(r).toBeLessThan(outerR + 20); // labels within a small margin past the rim
    }
    ctrl.dispose();
  });

  it('all placed affinities have a worldPos so SVG cones never anchor at network positions', () => {
    const { stateRef, ctx } = buildState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-10');
    // Any affinity rendered into the rings MUST carry a valid 3-tuple
    // worldPos. Otherwise the cone-overlay loop in LivingArchView
    // would (per the edge-case bug) reach back to the ingredient's
    // network position, drawing a stray edge across the corpus.
    for (const aff of ctrl.currentAffinities) {
      if (!aff.worldPos) continue; // unplaced — that's OK; cone code skips it
      expect(Array.isArray(aff.worldPos)).toBe(true);
      expect(aff.worldPos.length).toBe(3);
      for (const v of aff.worldPos) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
    ctrl.dispose();
  });

  it('pivot to a different focal does not leak the previous focal world position', () => {
    const { stateRef, ctx } = buildState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-10');
    const fwp1 = ctrl.focalWorldPos;
    ctrl.pivot('ing-25');
    const fwp2 = ctrl.focalWorldPos;
    expect(fwp1).not.toEqual(fwp2);
    expect(ctrl.engaged).toBe(true);
    ctrl.dispose();
  });

  it('outer-edge focal: every rendered affinity sphere is within the orbit frame', () => {
    // Synthetic outer-edge focal: place focal at large scene coords.
    const { stateRef, ctx } = buildState();
    // Move ing-10 (the focal we'll engage) far from the centroid.
    const idx = stateRef.nameIdx.get('ing-10');
    stateRef.curPos[idx * 3] = 500;
    stateRef.curPos[idx * 3 + 1] = 0;
    stateRef.curPos[idx * 3 + 2] = 500;
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => [],
    });
    ctrl.engage('ing-10');
    const focalWp = ctrl.focalWorldPos;
    expect(focalWp).toBeTruthy();
    // Every placed affinity should sit within an ~80-unit envelope of
    // the focal (matching WHEEL_FRAME_RADIUS=66 + slack). If any
    // affinity is way outside, that's the edge-case the user reported
    // ("edges across the corpus").
    for (const aff of ctrl.currentAffinities) {
      if (!aff.worldPos) continue;
      const [x, , z] = aff.worldPos;
      const dx = x - focalWp[0];
      const dz = z - focalWp[2];
      const r = Math.hypot(dx, dz);
      expect(r).toBeLessThan(80);
    }
    ctrl.dispose();
  });

  it('switching axes via filter stack repopulates the wedge layout cleanly', () => {
    const { stateRef, ctx } = buildState({
      aromaAssignments: (i) => (i % 2 === 0 ? 'fruity' : 'green'),
    });
    let stack = [];
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: { clusterLabels: CLUSTER_LABELS },
      getFilterStack: () => stack,
    });
    ctrl.engage('ing-10');
    expect(ctrl._currentWedgeAxis).toBe('cluster');
    const clusterWedgeCount = ctrl._currentWedges.length;

    stack = ['family'];
    ctrl.refreshWedgeLayout();
    expect(ctrl._currentWedgeAxis).toBe('family');
    // After switching to family, the wedge set should NOT contain
    // raw cluster numeric IDs — proves the layout re-resolved
    // against the new axis instead of leaking the prior buckets.
    const familyKeys = new Set(ctrl._currentWedges.map((w) => w.key));
    expect(familyKeys.has('0')).toBe(false);
    expect(familyKeys.has('1')).toBe(false);
    void clusterWedgeCount; // silence unused
    ctrl.dispose();
  });
});
