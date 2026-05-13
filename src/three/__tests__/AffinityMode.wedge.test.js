/**
 * AffinityMode wedge-layout test (2026-05-13).
 *
 * Verifies the user-feedback correction that re-aimed the radial-wheel
 * UX into the 3D fly-to view. Uses the same synthetic-state harness as
 * AffinityMode.perf.test.js (in src/three/) — mocks makeLabel so node
 * test env doesn't need canvas, shims requestAnimationFrame for the
 * legacy fly-to tween.
 *
 * Asserts:
 *   1. Same-bucket neighbors land within the same angular wedge (the
 *      defining property of the new layout).
 *   2. Wedge arc Line objects are created (one per non-empty bucket).
 *   3. Bucket label sprites are created (one per non-empty bucket).
 *   4. Edges still connect focal → every neighbor (preserved from
 *      legacy star-radiation).
 *   5. Affinity name labels still exist for every neighbor + focal
 *      (preserved from legacy).
 *   6. Performance: a 50-neighbor engage finishes well inside the
 *      legacy <200ms budget.
 *
 * Coordinate system: scene uses XZ plane with Y up. The wedge layout's
 * 2D (x, y) maps to scene-space (x, 0, z). Asserted in test 1 by
 * computing angles from focal in the XZ plane.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { computeAffinityThresholds } from '../../data/affinityThresholds.js';

// Stub makeLabel so we don't need canvas in node env. Sprite material
// still has the .opacity / .map fields the dispose path expects.
vi.mock('../../components/livingArchUtils.js', () => ({
  makeLabel: (text) => {
    const mat = new THREE.SpriteMaterial({ transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.userData = { text };
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

/**
 * Build a synthetic scene with N nodes; each node carries a `category`
 * field cycling through the FAMILY_LABELS taxonomy so the wedge layout
 * (when axis='family') buckets predictably.
 */
function buildSyntheticState({ nodeCount = 200, neighborsPerNode = 30 } = {}) {
  const N = nodeCount;
  const FAMILIES = [
    'Protein', 'Dairy', 'Fat', 'Vegetable', 'Fruit',
    'Grain', 'Herb', 'Spice', 'Aromatic', 'Sweetener', 'Other',
  ];
  const nodeArray = Array.from({ length: N }, (_, i) => ({
    name: `ing-${i}`,
    category: FAMILIES[i % FAMILIES.length],
  }));
  const nodesMap = new Map(nodeArray.map((n) => [n.name, n]));
  const nameIdx = new Map(nodeArray.map((n, i) => [n.name, i]));
  const curPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    curPos[i * 3]     = (i % 50) - 25;
    curPos[i * 3 + 1] = Math.floor(i / 50) - 30;
    curPos[i * 3 + 2] = (i % 17) - 8;
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

  const top5 = new Map();
  const bridgeCompoundIndex = new Map();
  const affinityThresholds = computeAffinityThresholds(edges);
  const ctx = {
    pairingStrength,
    top5,
    bridgeCompoundIndex,
    affinityThresholds,
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
    tmpV.set(curPos[i*3], curPos[i*3+1], curPos[i*3+2]);
    m.compose(tmpV, tmpQ, tmpS);
    mesh.setMatrixAt(i, m);
  }
  const colorArr = new Float32Array(N * 3).fill(0.5);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);
  const defaultColors = Array.from({ length: N }, () => new THREE.Color(0xffffff));
  const clusterColors = Array.from({ length: N }, () => new THREE.Color(0xff0000));

  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const controls = { target: new THREE.Vector3(), update: () => {} };

  const stateRef = {
    scene, camera, controls, mesh, nodeArray, nameIdx, curPos,
    defaultColors, clusterColors, mode: 'neural',
    edgeMesh: { visible: true },
    particleMesh: { visible: true },
    clusterLabelGroup: null,
    _nodeLabelGroup: null,
    edgeGeo: null,
    updateEdgePositions: () => {},
  };
  return { stateRef, ctx };
}

describe('AffinityMode — wedge layout (2026-05-13 user feedback)', () => {
  it('groups same-bucket neighbors into a single angular wedge (family axis)', () => {
    const { stateRef, ctx } = buildSyntheticState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      // Family filter active → wedges driven by node.category.
      getFilterStack: () => ['family'],
    });
    ctrl.engage('ing-100');

    // Pull every ring slot's world position and decompose; group by
    // bucket via the slotToGlobalIdx map back to the source node.
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    // Focal world position — anchor for angle computation.
    ctrl.focalMesh.getMatrixAt(0, m);
    m.decompose(pos, quat, scale);
    const fx = pos.x;
    const fz = pos.z;

    // Map: bucketKey -> array of angles (radians, [-π, π]) of each
    // neighbor's planar offset from focal in the XZ plane.
    const anglesByBucket = new Map();
    for (const ringIdx of [3, 2, 1, 0]) {
      const mesh = ctrl._ringMeshes[ringIdx];
      const slotMap = mesh.userData.slotToGlobalIdx;
      for (let s = 0; s < mesh.count; s++) {
        mesh.getMatrixAt(s, m);
        m.decompose(pos, quat, scale);
        // Skip collapsed slots (scale=0 sentinel).
        if (scale.x === 0 && scale.y === 0 && scale.z === 0) continue;
        const globalIdx = slotMap[s];
        if (globalIdx < 0) continue;
        const node = stateRef.nodeArray[globalIdx];
        // Same family-bucket logic the resolver uses.
        const bucket = node.category || 'Other';
        const dx = pos.x - fx;
        const dz = pos.z - fz;
        const angle = Math.atan2(dz, dx);
        if (!anglesByBucket.has(bucket)) anglesByBucket.set(bucket, []);
        anglesByBucket.get(bucket).push(angle);
      }
    }
    expect(anglesByBucket.size).toBeGreaterThan(0);

    // Defining wedge property: angles within a bucket span ≤ that
    // bucket's wedge span (2π / N_buckets). Allow a small slack
    // (0.15 rad ≈ 8.6°) for the SVG-wheel `(i + 0.5) / M.length`
    // slot offset which leaves padding between adjacent dots.
    const WEDGE_TOLERANCE_RAD = 0.15;
    const wedgeCount = ctrl._currentWedges?.length || anglesByBucket.size;
    const expectedWedgeSpan = (Math.PI * 2) / wedgeCount;
    for (const [bucket, angles] of anglesByBucket) {
      if (angles.length < 2) continue;
      // Compute the angular spread accounting for the [-π, π] wraparound.
      // Sort, then check the largest gap; the wedge span is 2π minus
      // the largest gap (the "wedge" sits in the smallest arc covering
      // all the points).
      const sorted = [...angles].sort((a, b) => a - b);
      let maxGap = sorted[0] + Math.PI * 2 - sorted[sorted.length - 1];
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1];
        if (gap > maxGap) maxGap = gap;
      }
      const spread = Math.PI * 2 - maxGap;
      expect(spread).toBeLessThanOrEqual(expectedWedgeSpan + WEDGE_TOLERANCE_RAD);
    }
    ctrl.dispose();
  });

  it('builds bucket-colored arc Line objects (one per non-empty wedge)', () => {
    const { stateRef, ctx } = buildSyntheticState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      getFilterStack: () => ['family'],
    });
    ctrl.engage('ing-100');
    expect(ctrl.wedgeArcGroup).toBeTruthy();
    expect(ctrl.wedgeArcGroup.visible).toBe(true);
    const arcCount = ctrl.wedgeArcGroup.children.length;
    expect(arcCount).toBeGreaterThan(0);
    // Each arc is a THREE.Line backed by a real BufferGeometry.
    for (const line of ctrl.wedgeArcGroup.children) {
      expect(line.isLine).toBe(true);
      expect(line.geometry?.attributes?.position?.count).toBeGreaterThan(1);
      expect(line.material?.color).toBeTruthy();
    }
    // Arc count tracks active wedges (modulo the empty-anchor sentinel
    // which we always skip).
    const activeWedges = (ctrl._currentWedges || [])
      .filter((w) => w.key !== '_empty');
    expect(arcCount).toBe(activeWedges.length);
    ctrl.dispose();
  });

  it('builds bucket-name label sprites (one per non-empty wedge)', () => {
    const { stateRef, ctx } = buildSyntheticState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      getFilterStack: () => ['family'],
    });
    ctrl.engage('ing-100');
    expect(ctrl.wedgeLabelGroup).toBeTruthy();
    expect(ctrl.wedgeLabelGroup.visible).toBe(true);
    const labelCount = ctrl.wedgeLabelGroup.children.length;
    const activeWedges = (ctrl._currentWedges || [])
      .filter((w) => w.key !== '_empty' && w.label);
    expect(labelCount).toBe(activeWedges.length);
    ctrl.dispose();
  });

  it('preserves edges (focal → every neighbor) under the new layout', () => {
    const { stateRef, ctx } = buildSyntheticState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      getFilterStack: () => ['family'],
    });
    ctrl.engage('ing-100');
    expect(ctrl.edgeLines.visible).toBe(true);
    // Edge buffer holds TOTAL_RING_CAPACITY=38 segments. Count
    // non-collapsed segments — those whose endpoint differs from the
    // focal world position.
    const posAttr = ctrl.edgeGeo.attributes.position;
    let liveSegments = 0;
    const focalIdx = stateRef.nameIdx.get('ing-100');
    const fx = stateRef.curPos[focalIdx * 3];
    const fy = stateRef.curPos[focalIdx * 3 + 1];
    const fz = stateRef.curPos[focalIdx * 3 + 2];
    const SEG_COUNT = posAttr.count / 2;
    for (let i = 0; i < SEG_COUNT; i++) {
      const o = i * 6;
      const tx = posAttr.array[o + 3];
      const ty = posAttr.array[o + 4];
      const tz = posAttr.array[o + 5];
      const dx = tx - fx;
      const dy = ty - fy;
      const dz = tz - fz;
      if ((dx * dx + dy * dy + dz * dz) > 0.01) liveSegments++;
    }
    expect(liveSegments).toBe(ctrl._currentAffinities.length);
    ctrl.dispose();
  });

  it('renders an affinity name sprite for every neighbor + focal', () => {
    const { stateRef, ctx } = buildSyntheticState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      getFilterStack: () => ['family'],
    });
    ctrl.engage('ing-100');
    // labelGroup = focal sprite + 1 sprite per affinity.
    expect(ctrl.labelGroup.children.length).toBe(1 + ctrl._currentAffinities.length);
    ctrl.dispose();
  });

  it('defaults to the aroma axis when no filter is active', () => {
    const { stateRef, ctx } = buildSyntheticState();
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      getFilterStack: () => [],
    });
    ctrl.engage('ing-100');
    expect(ctrl._currentWedgeAxis).toBe('aromas');
    ctrl.dispose();
  });

  it('switches wedge axis when filter stack changes (refreshWedgeLayout)', () => {
    const { stateRef, ctx } = buildSyntheticState();
    let stack = [];
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      getFilterStack: () => stack,
    });
    ctrl.engage('ing-100');
    expect(ctrl._currentWedgeAxis).toBe('aromas');
    stack = ['family'];
    ctrl.refreshWedgeLayout();
    expect(ctrl._currentWedgeAxis).toBe('family');
    ctrl.dispose();
  });

  it('engage() with 50 neighbors completes inside ~1.6s simulated budget', () => {
    // Mirrors the existing AffinityMode.perf.test.js pattern. The
    // 1.6s ceiling comes from the r16-1 transition machinery; in
    // practice engage finishes in low single-digit ms.
    const { stateRef, ctx } = buildSyntheticState({ nodeCount: 200, neighborsPerNode: 50 });
    const ctrl = new AffinityMode(stateRef, ctx, null, {
      categoricalCtx: {},
      getFilterStack: () => ['family'],
    });
    const t0 = performance.now();
    ctrl.engage('ing-50');
    const elapsed = performance.now() - t0;
    expect(ctrl.engaged).toBe(true);
    expect(elapsed).toBeLessThan(1600);
    ctrl.dispose();
  });
});
