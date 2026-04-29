/**
 * AffinityMode — controller for the Flavor Affinity Mode (α-mode)
 * scene layer. Owns a 30-instance InstancedMesh of affinity spheres
 * arranged in three concentric rings (★★★ / ★★ / ★) around a focal
 * ingredient, plus a 30-segment LineSegments edge group color-coded
 * by native tier (gold / silver / bronze).
 *
 * Lifecycle: instantiated once after `stateRef.current` is built in
 * LivingArchView; receives stateRef and the affinity-context maps from
 * useProData. Exposes engage/pivot/exit/suspend/resume/dispose plus
 * tickAnimation called from the LivingArchView animator each frame.
 *
 * GPU-resource contract: ONE affinity InstancedMesh + ONE edge
 * BufferGeometry, allocated at construction, mutated in place on
 * engage/pivot. No reallocation across pivots.
 *
 * Mesh-color contract: while engaged, AffinityMode holds exclusive
 * write authority over the shared default mesh's `instanceColor`.
 * Existing mutators in LivingArchView (selection-tint, taste filter,
 * tree filter, bridge path, per-mode coloring, cluster focus) gain
 * `if (affinityModeRef.current?.engaged) return;` guards so they
 * don't clobber the dim writes. On exit() the default colors are
 * re-stamped explicitly — guarded effects do NOT re-fire on exit.
 *
 * See `.omc/plans/ralplan-flavor-affinity-mode.md` for the full plan
 * and `src/data/affinityTiers.js` for tier math.
 */

import * as THREE from 'three';
import { topAffinities } from '../data/affinityTiers.js';
import { makeLabel } from '../components/livingArchUtils.js';
import { affinityShape } from '../data/affinityShapes.js';
import { buildShapeGeometries } from './Geometries.js';

// Ring radii in 3D scene units. Spec § α-mode visual layout.
const RADII = { 3: 12, 2: 22, 1: 35 };

// Golden angle (φ ≈ 137.5°) — distributes ring slots so adjacent
// positions aren't cluster-correlated.
const PHI = Math.PI * (3 - Math.sqrt(5));

// Tier → edge color (spec § α-mode visual layout).
const TIER_COLOR = {
  3: new THREE.Color(0xfacc15), // gold
  2: new THREE.Color(0xa3a3a3), // silver
  1: new THREE.Color(0xa16207), // bronze
};
const TIER_OPACITY = { 3: 0.9, 2: 0.7, 1: 0.5 };

// Dim color applied to non-affinity instances of the shared default
// mesh. Matches the existing `dimColor` used by cluster-focus mode
// at LivingArchView.jsx:725 (`#111118`).
const DIM_COLOR = new THREE.Color(0x111118);

// Cluster-ghost opacity in α-mode — Architect iter-2 opacity authority
// rule: α-mode (0.45) > focused-cluster (0.95/0.22) > default (0.95).
const GHOST_OPACITY = 0.45;

// Affinity sphere visual properties — also the per-instance scale for
// every shape (master geometries are normalized to bounding-sphere
// radius ≈ 1, so this scales them all to the same visual envelope).
const AFFINITY_SPHERE_RADIUS = 1.2;
// The focal (dodecahedron) renders larger so the user always knows
// which node is the active pivot point.
const FOCAL_SCALE_BOOST = 1.6;

// Per-role slot capacity, must sum to 30 affinities (+1 focal).
const RING_CAPACITY = { 3: 5, 2: 10, 1: 15 };
const FOCAL_CAPACITY = 1;

// Performance budget — warn if engage / pivot exceed.
const PERF_BUDGET_MS = 200;

/**
 * Compute one ring slot's 3D position via golden-angle distribution.
 * Slot 0 → +x axis; subsequent slots rotate by PHI radians.
 *
 * @param {3|2|1} ringIdx
 * @param {number} slotIdx
 * @returns {THREE.Vector3}
 */
export function placeOnRing(ringIdx, slotIdx) {
  const angle = slotIdx * PHI;
  const R = RADII[ringIdx];
  return new THREE.Vector3(R * Math.cos(angle), 0, R * Math.sin(angle));
}

export class AffinityMode {
  constructor(stateRef, affinityCtx) {
    this.stateRef = stateRef;
    this.ctx = affinityCtx;
    this._engaged = false;
    this._currentFocal = null;
    this._currentAffinities = []; // last-computed result of topAffinities

    // R14 Phase 5 — per-role shape meshes. Replaces the single
    // 30-instance sphere mesh with four InstancedMeshes (focal + 3
    // rings) so the user can read tier rank from silhouette as well
    // as edge color.
    //
    // Master geometries are normalized to bounding-sphere radius ≈ 1;
    // we scale every instance by AFFINITY_SPHERE_RADIUS (focal also
    // gets FOCAL_SCALE_BOOST so it stays distinct).
    const baseGeos = buildShapeGeometries();
    const usedKeys = new Set([
      affinityShape('focal'),
      affinityShape(3),
      affinityShape(2),
      affinityShape(1),
    ]);
    // Dispose unused master geometries — we own clones below.
    for (const [k, g] of Object.entries(baseGeos)) {
      if (!usedKeys.has(k) && typeof g.dispose === 'function') g.dispose();
    }

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: false,
      transparent: true,
      opacity: 0.9,
    });
    this._sharedMaterial = mat;

    function makeMesh(geo, count) {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = count;
      m.frustumCulled = false;
      m.visible = false;
      const colorArr = new Float32Array(count * 3);
      m.instanceColor = new THREE.InstancedBufferAttribute(colorArr, 3);
      return m;
    }

    this.focalMesh = makeMesh(baseGeos[affinityShape('focal')], FOCAL_CAPACITY);
    this.ring3Mesh = makeMesh(baseGeos[affinityShape(3)], RING_CAPACITY[3]);
    this.ring2Mesh = makeMesh(baseGeos[affinityShape(2)], RING_CAPACITY[2]);
    this.ring1Mesh = makeMesh(baseGeos[affinityShape(1)], RING_CAPACITY[1]);

    // Map ringIdx → { mesh, capacity } for the per-frame writer.
    this._ringMeshes = {
      3: this.ring3Mesh,
      2: this.ring2Mesh,
      1: this.ring1Mesh,
    };

    // Back-compat: the perf test inspects `affinityMesh.count`; alias
    // to the largest ring mesh so the existing assertion still has
    // something to check (the meaning shifted from "30 affinity slots"
    // to "the canonical ring's slot count" but the per-pivot reuse
    // invariant still holds).
    this.affinityMesh = this.ring1Mesh;

    stateRef.scene.add(this.focalMesh);
    stateRef.scene.add(this.ring3Mesh);
    stateRef.scene.add(this.ring2Mesh);
    stateRef.scene.add(this.ring1Mesh);

    // Edge BufferGeometry — 30 line segments from focal (origin) to
    // each affinity sphere. 60 vertices × 3 floats each. Per-vertex
    // color so each segment gets its tier color.
    const edgePositions = new Float32Array(60 * 3);
    const edgeColors = new Float32Array(60 * 3);
    this.edgeGeo = new THREE.BufferGeometry();
    this.edgeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(edgePositions, 3),
    );
    this.edgeGeo.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(edgeColors, 3),
    );
    this.edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    this.edgeLines = new THREE.LineSegments(this.edgeGeo, this.edgeMat);
    this.edgeLines.frustumCulled = false;
    this.edgeLines.visible = false;
    stateRef.scene.add(this.edgeLines);

    // Affinity-name label group — 30 sprites, one per affinity sphere.
    // Re-created on each engage/pivot for simplicity (small number,
    // canvas allocation is fast). Fully removed on exit + dispose.
    this.labelGroup = new THREE.Group();
    this.labelGroup.visible = false;
    stateRef.scene.add(this.labelGroup);

    // Snapshot of mesh.instanceMatrix scales pre-engage, used to
    // restore visibility on exit. We hide non-affinity instances by
    // setting their scale to 0 (rather than dimming color), so the
    // bloom post-process doesn't surface dim-but-visible halos.
    this._nodeCount = stateRef.nodeArray.length;
    this._matrixScratch = new THREE.Matrix4();
    this._scaleZero = new THREE.Vector3(0, 0, 0);
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3();
  }

  get engaged() {
    return this._engaged;
  }

  /**
   * Engage α-mode for `focal`. Computes affinities, writes ring sphere
   * matrices + colors, builds edge buffer, dims shared default mesh,
   * adjusts cluster-label opacity, dispatches camera flight.
   *
   * Performance budget: <200ms (rings visible). Camera flight (~900ms)
   * runs async after this returns.
   *
   * @param {string} focal  ingredient name
   */
  engage(focal) {
    if (typeof performance !== 'undefined') {
      performance.mark('alpha-engage-start');
    }
    if (this._engaged && this._currentFocal === focal) {
      // Idempotent re-engage on the same focal — ignore.
      return;
    }
    if (this._engaged) {
      // Different focal → pivot path.
      this.pivot(focal);
      return;
    }
    this._engaged = true;
    this._currentFocal = focal;
    this._writeRingsAndDim(focal);
    this._flyToFocal(focal);
    if (typeof performance !== 'undefined') {
      performance.mark('alpha-engage-end');
      try {
        const m = performance.measure(
          'alpha-engage',
          'alpha-engage-start',
          'alpha-engage-end',
        );
        if (m && m.duration > PERF_BUDGET_MS) {
          console.warn(
            `[AffinityMode] engage(${focal}) took ${m.duration.toFixed(1)}ms (budget ${PERF_BUDGET_MS}ms)`,
          );
        }
      } catch { /* perf API edge cases — ignore */ }
    }
  }

  /**
   * Re-pivot to a different focal without leaving α-mode. Re-runs the
   * full dim + ring + edge write so the new focal's rings are correct.
   * Does NOT reallocate GPU resources.
   *
   * @param {string} newFocal
   */
  pivot(newFocal) {
    if (!this._engaged) {
      this.engage(newFocal);
      return;
    }
    if (this._currentFocal === newFocal) return;
    if (typeof performance !== 'undefined') {
      performance.mark('alpha-pivot-start');
    }
    this._currentFocal = newFocal;
    this._writeRingsAndDim(newFocal);
    this._flyToFocal(newFocal);
    if (typeof performance !== 'undefined') {
      performance.mark('alpha-pivot-end');
      try {
        performance.measure(
          'alpha-pivot',
          'alpha-pivot-start',
          'alpha-pivot-end',
        );
      } catch { /* ignore */ }
    }
  }

  /**
   * Exit α-mode. Re-stamps default mesh colors, hides affinity mesh +
   * edges, restores cluster-label opacity to non-α precedence.
   *
   * Critic iter-3 fix: explicit teardown sequence because guarded
   * effects do NOT re-fire when `engaged` flips false (engaged isn't
   * in their dep arrays — it's a ref mutation).
   *
   * @param {{immediate?: boolean}} [opts]  reserved for fade animation
   */
  exit(_opts = {}) {
    if (!this._engaged) return;
    this._engaged = false;
    this._currentFocal = null;

    const st = this.stateRef;
    if (!st) return;

    // 1. Restore mesh.instanceMatrix from snapshot (re-show all
    //    hidden nodes) and re-stamp default colors.
    const inClusterMode = st.mode === 'ml' || st.mode === 'ml2d';
    const source = inClusterMode && st.clusterColors ? st.clusterColors : st.defaultColors;
    if (st.mesh) {
      if (this._matrixSnapshot) {
        st.mesh.instanceMatrix.array.set(this._matrixSnapshot);
        st.mesh.instanceMatrix.needsUpdate = true;
      }
      if (source) {
        for (let i = 0; i < this._nodeCount; i++) {
          st.mesh.setColorAt(i, source[i]);
        }
        if (st.mesh.instanceColor) st.mesh.instanceColor.needsUpdate = true;
      }
    }

    // 2. Hide α-mode visuals (focal + 3 ring meshes, edges, labels).
    if (this.focalMesh) this.focalMesh.visible = false;
    if (this.ring3Mesh) this.ring3Mesh.visible = false;
    if (this.ring2Mesh) this.ring2Mesh.visible = false;
    if (this.ring1Mesh) this.ring1Mesh.visible = false;
    this.edgeLines.visible = false;
    this.labelGroup.visible = false;
    // Clear label sprites to release canvas textures.
    while (this.labelGroup.children.length > 0) {
      const s = this.labelGroup.children[0];
      this.labelGroup.remove(s);
      if (s.material?.map) s.material.map.dispose();
      if (s.material) s.material.dispose();
    }
    this._currentAffinities = [];

    // 3. Restore shared edgeMesh + particles.
    if (st.edgeMesh) st.edgeMesh.visible = true;
    if (st.particleMesh) st.particleMesh.visible = true;

    // 4. Restore cluster-ghost opacity + visibility to per-mode default.
    if (st.clusterLabelGroup) {
      st.clusterLabelGroup.children.forEach((sprite) => {
        sprite.material.opacity = 0.95;
      });
      st.clusterLabelGroup.visible = inClusterMode;
    }
    // Connector lines mirror the label group's visibility — see
    // LivingArchView.jsx:471 / :801 where this invariant is set up.
    if (st.clusterConnectorGroup) {
      st.clusterConnectorGroup.visible = inClusterMode;
    }

    // 5. Reset shared edge buffer (positions/colors/opacities back to
    //    defaults). The shared edgeMesh was visible-toggled, but its
    //    buffer is untouched by α-mode — call updateEdgePositions to
    //    refresh against current curPos.
    if (typeof st.updateEdgePositions === 'function') {
      st.updateEdgePositions();
      if (st.edgeGeo) {
        st.edgeGeo.attributes.position.needsUpdate = true;
        st.edgeGeo.attributes.aColor.needsUpdate = true;
        st.edgeGeo.attributes.aOpacity.needsUpdate = true;
      }
    }
  }

  /**
   * Suspend during multi-select (selectedNodes.length >= 2). Hides
   * α-mode visuals but retains internal state so resume() returns to
   * the same focal cleanly.
   */
  suspend() {
    if (!this._engaged) return;
    if (this.focalMesh) this.focalMesh.visible = false;
    if (this.ring3Mesh) this.ring3Mesh.visible = false;
    if (this.ring2Mesh) this.ring2Mesh.visible = false;
    if (this.ring1Mesh) this.ring1Mesh.visible = false;
    this.edgeLines.visible = false;
    this.labelGroup.visible = false;
    const st = this.stateRef;
    if (!st) return;
    // Restore matrix scales + colors + shared edge/particle visibility
    // so the existing selection-shadow UX takes over for multi-select.
    if (st.mesh) {
      if (this._matrixSnapshot) {
        st.mesh.instanceMatrix.array.set(this._matrixSnapshot);
        st.mesh.instanceMatrix.needsUpdate = true;
      }
      const inClusterMode = st.mode === 'ml' || st.mode === 'ml2d';
      const source = inClusterMode && st.clusterColors ? st.clusterColors : st.defaultColors;
      if (source) {
        for (let i = 0; i < this._nodeCount; i++) {
          st.mesh.setColorAt(i, source[i]);
        }
        if (st.mesh.instanceColor) st.mesh.instanceColor.needsUpdate = true;
      }
    }
    if (st.edgeMesh) st.edgeMesh.visible = true;
    if (st.particleMesh) st.particleMesh.visible = true;
    // Cluster labels + connectors were hidden in _writeRingsAndDim;
    // restore for the multi-select selection-shadow UX.
    const inClusterMode = st.mode === 'ml' || st.mode === 'ml2d';
    if (st.clusterLabelGroup) {
      st.clusterLabelGroup.children.forEach((sprite) => {
        sprite.material.opacity = 0.95;
      });
      st.clusterLabelGroup.visible = inClusterMode;
    }
    if (st.clusterConnectorGroup) {
      st.clusterConnectorGroup.visible = inClusterMode;
    }
  }

  /**
   * Resume after multi-select collapses back to a single ingredient.
   * Re-runs dim + ring writes for the current focal.
   */
  resume() {
    if (!this._engaged || !this._currentFocal) return;
    this._writeRingsAndDim(this._currentFocal);
  }

  /**
   * Per-frame animation hook (called from LivingArchView animate()).
   * Currently a no-op placeholder for future fade lerps.
   *
   * @param {number} _deltaSec
   */
  tickAnimation(_deltaSec) {
    // Reserved for cluster-ghost fade-in/out animation. v1 ships with
    // hard-cut visibility; smooth fade is a v1.1 polish.
  }

  /**
   * Release GPU resources. Called from LivingArchView cleanup at
   * line 1141 BEFORE existing teardown so disposed buffers don't
   * outlive the scene.
   */
  dispose() {
    const st = this.stateRef;
    const meshes = [this.focalMesh, this.ring3Mesh, this.ring2Mesh, this.ring1Mesh];
    if (st && st.scene) {
      for (const m of meshes) {
        if (m) st.scene.remove(m);
      }
      if (this.edgeLines) st.scene.remove(this.edgeLines);
      if (this.labelGroup) st.scene.remove(this.labelGroup);
    }
    // Each per-role mesh owns its master geometry; the shared material
    // is disposed once below.
    for (const m of meshes) {
      if (m && m.geometry) m.geometry.dispose();
    }
    if (this._sharedMaterial) this._sharedMaterial.dispose();
    if (this.edgeGeo) this.edgeGeo.dispose();
    if (this.edgeMat) this.edgeMat.dispose();
    if (this.labelGroup) {
      this.labelGroup.children.forEach((s) => {
        if (s.material?.map) s.material.map.dispose();
        if (s.material) s.material.dispose();
      });
    }
    this.focalMesh = null;
    this.ring3Mesh = null;
    this.ring2Mesh = null;
    this.ring1Mesh = null;
    this._ringMeshes = null;
    this.affinityMesh = null;
    this._sharedMaterial = null;
    this.edgeLines = null;
    this.edgeGeo = null;
    this.edgeMat = null;
    this.labelGroup = null;
    this._matrixSnapshot = null;
    this._engaged = false;
    this._currentFocal = null;
    this._currentAffinities = [];
    this.stateRef = null;
  }

  // ─── private ────────────────────────────────────────────────

  /**
   * Compute affinities, position spheres, build edges, dim non-
   * affinity instances on the shared default mesh, set cluster-ghost
   * opacity. Used by engage() and pivot().
   */
  _writeRingsAndDim(focal) {
    const st = this.stateRef;
    if (!st) return;
    const focalIdx = st.nameIdx?.get(focal);
    if (focalIdx === undefined) {
      // Focal not in graph — bail without engaging.
      this._engaged = false;
      this._currentFocal = null;
      return;
    }

    const affinities = topAffinities(focal, this.ctx);
    this._currentAffinities = affinities;

    // R14 Phase 5: focal is now drawn by `focalMesh` (a dodecahedron
    // at the same world position), so it's hidden in the shared mesh
    // along with everything else. The shared mesh shows nothing while
    // α-mode is engaged.
    const affinityIdxSet = new Set();

    // Anchor at focal's CURRENT 3D position. curPos animates during
    // mode transitions; using it keeps rings aligned.
    const cx = st.curPos[focalIdx * 3];
    const cy = st.curPos[focalIdx * 3 + 1];
    const cz = st.curPos[focalIdx * 3 + 2];

    // ─── 1a. Focal placement (focalMesh) ───
    const m = new THREE.Matrix4();
    const tmpV = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    const focalScale = AFFINITY_SPHERE_RADIUS * FOCAL_SCALE_BOOST;
    const focalScaleVec = new THREE.Vector3(focalScale, focalScale, focalScale);
    tmpV.set(cx, cy, cz);
    m.compose(tmpV, tmpQ, focalScaleVec);
    this.focalMesh.setMatrixAt(0, m);
    // Focal is drawn neutral white — no tier; its identity is "the
    // chosen pivot," distinct from every affinity color.
    this.focalMesh.instanceColor.setXYZ(0, 1, 1, 1);
    this.focalMesh.instanceMatrix.needsUpdate = true;
    this.focalMesh.instanceColor.needsUpdate = true;
    this.focalMesh.visible = true;

    // ─── 1b. Affinity placement on rings (per-tier meshes) ───
    const tmpS = new THREE.Vector3(
      AFFINITY_SPHERE_RADIUS,
      AFFINITY_SPHERE_RADIUS,
      AFFINITY_SPHERE_RADIUS,
    );
    const zeroS = new THREE.Vector3(0, 0, 0);
    const slotCounter = { 3: 0, 2: 0, 1: 0 };
    // Pre-fill ALL ring slots as collapsed (scale=0); the loop below
    // overwrites occupied slots. This guarantees no stale matrices
    // survive a pivot when an affinity count drops below capacity.
    for (const ringIdx of [3, 2, 1]) {
      const mesh = this._ringMeshes[ringIdx];
      const cap = RING_CAPACITY[ringIdx];
      for (let s = 0; s < cap; s++) {
        m.compose(tmpV.set(0, 0, 0), tmpQ, zeroS);
        mesh.setMatrixAt(s, m);
      }
    }
    const sphereWorldPos = []; // for label/edge alignment, in affinity order
    for (let i = 0; i < affinities.length; i++) {
      const aff = affinities[i];
      const ringIdx = aff.ringIdx;
      const mesh = this._ringMeshes[ringIdx];
      const cap = RING_CAPACITY[ringIdx];
      const slot = slotCounter[ringIdx]++;
      if (slot >= cap) {
        // Defensive — topAffinities slices to (5,10,15) so this should
        // never trip, but if a future caller passes larger N, we drop
        // overflow rather than scribbling past the buffer.
        sphereWorldPos.push(null);
        continue;
      }
      const ringPos = placeOnRing(ringIdx, slot);
      tmpV.set(cx + ringPos.x, cy + ringPos.y, cz + ringPos.z);
      sphereWorldPos.push([tmpV.x, tmpV.y, tmpV.z]);
      m.compose(tmpV, tmpQ, tmpS);
      mesh.setMatrixAt(slot, m);
      const c = TIER_COLOR[aff.tier] ?? TIER_COLOR[1];
      mesh.instanceColor.setXYZ(slot, c.r, c.g, c.b);
    }
    for (const ringIdx of [3, 2, 1]) {
      const mesh = this._ringMeshes[ringIdx];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.visible = true;
    }

    // ─── 2. Edge buffer (focal → each affinity) ───
    const posAttr = this.edgeGeo.attributes.position;
    const colAttr = this.edgeGeo.attributes.color;
    for (let i = 0; i < 30; i++) {
      const o = i * 6;
      // Source vertex = focal position (always).
      posAttr.array[o]     = cx;
      posAttr.array[o + 1] = cy;
      posAttr.array[o + 2] = cz;
      if (i < affinities.length && sphereWorldPos[i]) {
        const aff = affinities[i];
        const [tx, ty, tz] = sphereWorldPos[i];
        posAttr.array[o + 3] = tx;
        posAttr.array[o + 4] = ty;
        posAttr.array[o + 5] = tz;
        const c = TIER_COLOR[aff.tier] ?? TIER_COLOR[1];
        const op = TIER_OPACITY[aff.tier] ?? TIER_OPACITY[1];
        colAttr.array[o]     = c.r * op;
        colAttr.array[o + 1] = c.g * op;
        colAttr.array[o + 2] = c.b * op;
        colAttr.array[o + 3] = c.r * op;
        colAttr.array[o + 4] = c.g * op;
        colAttr.array[o + 5] = c.b * op;
      } else {
        // Collapsed segment — match source endpoint, color black.
        posAttr.array[o + 3] = cx;
        posAttr.array[o + 4] = cy;
        posAttr.array[o + 5] = cz;
        for (let k = 0; k < 6; k++) colAttr.array[o + k] = 0;
      }
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.edgeLines.visible = true;

    // ─── 3. Hide non-affinity nodes via scale-0 instanceMatrix ───
    // Color-dim alone wasn't enough: bloom amplified the dim values
    // to a visible haze. Snapshot is taken on first engage; restored
    // on exit().
    if (st.mesh) {
      if (!this._matrixSnapshot) {
        const arr = st.mesh.instanceMatrix.array;
        this._matrixSnapshot = new Float32Array(arr.length);
        this._matrixSnapshot.set(arr);
      }
      for (let i = 0; i < this._nodeCount; i++) {
        if (!affinityIdxSet.has(i)) {
          // Decompose existing matrix to keep position; zero scale.
          this._matrixScratch.fromArray(st.mesh.instanceMatrix.array, i * 16);
          this._matrixScratch.decompose(this._tmpPos, this._tmpQuat, this._tmpScale);
          this._matrixScratch.compose(this._tmpPos, this._tmpQuat, this._scaleZero);
          st.mesh.setMatrixAt(i, this._matrixScratch);
        } else {
          // Restore from snapshot in case earlier pivot scaled it.
          this._matrixScratch.fromArray(this._matrixSnapshot, i * 16);
          st.mesh.setMatrixAt(i, this._matrixScratch);
          // Brighten / restore native color.
          const inClusterMode = st.mode === 'ml' || st.mode === 'ml2d';
          const source = inClusterMode && st.clusterColors ? st.clusterColors : st.defaultColors;
          if (source) st.mesh.setColorAt(i, source[i]);
        }
      }
      st.mesh.instanceMatrix.needsUpdate = true;
      if (st.mesh.instanceColor) st.mesh.instanceColor.needsUpdate = true;
    }

    // ─── 4. Hide shared edgeMesh + particles to silence the rest ───
    // Per spec § α-mode interaction model: "Edges only render between
    // focal ↔ affinity." The shared scene edges + particles add noise.
    if (st.edgeMesh) st.edgeMesh.visible = false;
    if (st.particleMesh) st.particleMesh.visible = false;

    // Race fix: the per-node label effect in LivingArchView may have
    // run BEFORE α-mode engaged on this selection (React effect order),
    // leaving a stale `_nodeLabelGroup` in the scene with focal/
    // highlightPairings sprites at the un-pivoted positions. Tear it
    // down here so AffinityMode's labelGroup is the only label source.
    if (st._nodeLabelGroup) {
      st.scene.remove(st._nodeLabelGroup);
      st._nodeLabelGroup.children.forEach((s) => {
        if (s.material?.map) s.material.map.dispose();
        if (s.material) s.material.dispose();
      });
      st._nodeLabelGroup = null;
    }

    // ─── 5. Hide cluster labels + their connector lines ───
    // The user found even GHOST_OPACITY=0.45 still leaves visible
    // clutter around the affinity rings; the connector lines (which
    // run from each label to its cluster centroid) were never gated
    // at all and rendered through the rings. Hide both entirely.
    // exit() restores them based on inClusterMode.
    if (st.clusterLabelGroup) st.clusterLabelGroup.visible = false;
    if (st.clusterConnectorGroup) st.clusterConnectorGroup.visible = false;

    // ─── 6. Affinity labels (focal name + each affinity name) ───
    this._buildLabels(focal, sphereWorldPos, [cx, cy, cz]);
    void DIM_COLOR; // retained constant for future dim-color path
  }

  /**
   * Build / rebuild the 31-sprite label group: focal at origin + 30
   * affinities at their ring positions.
   */
  _buildLabels(focal, sphereWorldPos, focalWorld) {
    // Clear previous sprites.
    while (this.labelGroup.children.length > 0) {
      const s = this.labelGroup.children[0];
      this.labelGroup.remove(s);
      if (s.material?.map) s.material.map.dispose();
      if (s.material) s.material.dispose();
    }
    // Focal label — largest, white.
    const focalSprite = makeLabel(focal, '#ffffff', 9, { glow: false });
    focalSprite.position.set(focalWorld[0], focalWorld[1] + 3.5, focalWorld[2]);
    this.labelGroup.add(focalSprite);
    // Affinity labels — colored by tier (matches edge color so user
    // associates label tone with chemistry signal).
    for (let i = 0; i < this._currentAffinities.length; i++) {
      const aff = this._currentAffinities[i];
      const pos = sphereWorldPos[i];
      if (!pos) continue;
      const c = TIER_COLOR[aff.tier] ?? TIER_COLOR[1];
      // CSS-friendly hex string for canvas fillStyle.
      const hex = '#' + c.getHexString();
      const sprite = makeLabel(aff.name, hex, 7, { glow: false });
      sprite.position.set(pos[0], pos[1] + 3, pos[2]);
      this.labelGroup.add(sprite);
    }
    this.labelGroup.visible = true;
  }

  /**
   * Custom bird's-eye camera flight to frame the affinity rings.
   *
   * The existing flyToPoint() is designed for cluster-label framing
   * (camera lands BEYOND a label looking at the cluster centroid),
   * which is wrong for α-mode where we want the rings centered and
   * fully visible. Instead, this places the camera directly above the
   * focal at a distance that fits the ★ ring (radius 35) with ~10%
   * padding, looking straight down. 1200ms eased flight matches
   * spec § α-mode visual layout.
   */
  _flyToFocal(focal) {
    const st = this.stateRef;
    if (!st || !st.camera || !st.controls) return;
    const idx = st.nameIdx?.get(focal);
    if (idx === undefined) return;
    const fx = st.curPos[idx * 3];
    const fy = st.curPos[idx * 3 + 1];
    const fz = st.curPos[idx * 3 + 2];

    // Ring 1 radius is 35; +10% padding → 38.5. With a 50° FOV camera
    // (Three.js default ≈ 50°), the half-angle is 25°. Required
    // distance = 38.5 / tan(25°) ≈ 82 units. Use 75 — slightly closer
    // for a fuller frame.
    const dist = 75;
    const startPos = st.camera.position.clone();
    const startTarget = st.controls.target.clone();
    const endPos = new THREE.Vector3(fx, fy + dist, fz);
    const endTarget = new THREE.Vector3(fx, fy, fz);

    const t0 = performance.now();
    const DURATION = 1200;
    const camera = st.camera;
    const controls = st.controls;
    const tween = () => {
      // Bail if scene torn down or α-mode exited mid-flight.
      if (!this.stateRef || !this._engaged || this._currentFocal !== focal) return;
      const dt = Math.min(1, (performance.now() - t0) / DURATION);
      // ease-in-out cubic
      const e = dt < 0.5
        ? 4 * dt ** 3
        : 1 - Math.pow(-2 * dt + 2, 3) / 2;
      camera.position.lerpVectors(startPos, endPos, e);
      controls.target.lerpVectors(startTarget, endTarget, e);
      controls.update();
      if (dt < 1) requestAnimationFrame(tween);
    };
    tween();
  }
}
