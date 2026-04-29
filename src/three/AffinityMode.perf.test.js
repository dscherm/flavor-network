/**
 * R13-8: AffinityMode performance + GPU-resource leak test.
 *
 * Verifies:
 *  1. engage() finishes inside the <200ms budget on a graph the size
 *     of the shipped dataset (~3,000 nodes, ~50,000 edges).
 *  2. 100 rapid pivots do not add scene objects (the 30-instance mesh
 *     + edge buffer + label group are reused, never reallocated).
 *
 * Design notes:
 *  - Default test env is `node`, which has no `document` and no
 *    `requestAnimationFrame`. We mock `makeLabel` (the only canvas
 *    consumer) and shim `requestAnimationFrame` before the controller
 *    runs.
 *  - We exercise the real AffinityMode + real Three.js — there is no
 *    WebGL context, but every method we call is pure CPU (matrix /
 *    buffer math). InstancedMesh / BufferGeometry / Sprite / Color /
 *    Vector3 / Matrix4 all work outside a renderer.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { computeAffinityThresholds } from '../data/affinityThresholds.js';

// Stub makeLabel so we don't need canvas in node test env. Sprite
// material has the same .opacity / .map fields so AffinityMode's
// dispose path runs cleanly.
vi.mock('../components/livingArchUtils.js', () => ({
  makeLabel: () => {
    const mat = new THREE.SpriteMaterial({ transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.userData = {};
    return sprite;
  },
}));

// rAF shim so _flyToFocal's tween can schedule frames.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 16);
}

// Defer import so the mock is live before the module evaluates.
let AffinityMode;
beforeAll(async () => {
  ({ AffinityMode } = await import('./AffinityMode.js'));
});

function buildSyntheticState({ nodeCount = 3000, neighborsPerNode = 30 } = {}) {
  const N = nodeCount;
  const nodeArray = Array.from({ length: N }, (_, i) => ({ name: `ing-${i}` }));
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
      // Spread strengths from 0.3 to 0.99 so quantiles produce
      // realistic star1/star2/star3 thresholds.
      const strength = 0.3 + ((k - 1) / neighborsPerNode) * 0.69;
      const a = `ing-${i}`, b = `ing-${j}`;
      edges.push({ source: a, target: b, strength });
      pairingStrength.set(`${a}|${b}`, strength);
      pairingStrength.set(`${b}|${a}`, strength);
    }
  }

  const top5 = new Map(); // empty → lenient branch
  const bridgeCompoundIndex = new Map();
  const affinityThresholds = computeAffinityThresholds(edges);
  const ctx = { pairingStrength, top5, bridgeCompoundIndex, affinityThresholds, graph: { edges } };

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

describe('AffinityMode — engage performance budget', () => {
  it('engage() completes under 200ms on a 3000-node / 90,000-edge graph', () => {
    const { stateRef, ctx } = buildSyntheticState();
    const ctrl = new AffinityMode(stateRef, ctx);
    const t0 = performance.now();
    ctrl.engage('ing-1500');
    const elapsed = performance.now() - t0;
    expect(ctrl.engaged).toBe(true);
    // Generous budget — synthetic graph is comparable in size to the
    // shipped 3,913-node graph; warn on regression.
    expect(elapsed).toBeLessThan(200);
    ctrl.dispose();
  });
});

describe('AffinityMode — GPU resource reuse across pivots', () => {
  it('100 pivots do not add scene children (4 meshes + edges + labels reused)', () => {
    const { stateRef, ctx } = buildSyntheticState({ nodeCount: 1500, neighborsPerNode: 25 });
    const ctrl = new AffinityMode(stateRef, ctx);
    ctrl.engage('ing-100');
    const childrenAfterEngage = stateRef.scene.children.length;
    // R14 Phase 5: AffinityMode now adds 6 children (focalMesh,
    // ring3Mesh, ring2Mesh, ring1Mesh, edgeLines, labelGroup) on top
    // of the synthetic shared mesh.
    for (let i = 0; i < 100; i++) {
      ctrl.pivot(`ing-${(i + 200) % 1500}`);
    }
    expect(stateRef.scene.children.length).toBe(childrenAfterEngage);
    // Per-role InstancedMesh capacities are preserved across pivots.
    expect(ctrl.focalMesh.count).toBe(1);
    expect(ctrl.ring3Mesh.count).toBe(5);
    expect(ctrl.ring2Mesh.count).toBe(10);
    expect(ctrl.ring1Mesh.count).toBe(15);
    // Total affinity-side capacity still equals 30 — the canonical
    // invariant the original test guarded.
    const total = ctrl.ring3Mesh.count + ctrl.ring2Mesh.count + ctrl.ring1Mesh.count;
    expect(total).toBe(30);
    // Labels are rebuilt per pivot but never exceed 31 (1 focal + 30 affinities).
    expect(ctrl.labelGroup.children.length).toBeLessThanOrEqual(31);
    ctrl.dispose();
  });
});
