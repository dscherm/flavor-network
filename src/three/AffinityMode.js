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
import { topAffinities, surprisingAffinities } from '../data/affinityTiers.js';
import { makeLabel } from '../components/livingArchUtils.js';
import { affinityShape } from '../data/affinityShapes.js';
import { buildShapeGeometries } from './Geometries.js';
import { computeWheelLayout } from '../components/RadialAffinityWheelGeometry.jsx';
import { CATEGORICAL_AXES, bucketOf as resolveBucket } from '../data/categoricalAxes.js';
import { FILTER_TO_AXIS, morphAxisForStack } from '../data/networkModes.js';
import { cuisineColor } from '../data/cuisinePairings.js';

// Ring radii in 3D scene units. Spec § α-mode visual layout.
// Canonical-spec §6.3 — full 6 concentric categorical rings.
// Ring index legacy 3/2/1/0 retained for cluster/aroma/taste/family
// (v2.0 set); ring 4 + ring 5 added for cuisine + season at outer
// radii. RING_AXIS lookup drives placement; raycast & dispose paths
// updated below.
const RING_AXIS = {
  3: 'cluster',   // innermost — ring 1 in spec wording
  2: 'aromas',    // ring 2
  1: 'taste',     // ring 3
  0: 'family',    // ring 4
  4: 'cuisine',   // ring 5
  5: 'season',    // ring 6 — outermost
};
const RADII = { 3: 12, 2: 22, 1: 35, 0: 48, 4: 60, 5: 72 };
// Y-elevation per ring keeps stacked affinities readable when the
// camera looks down a shallow angle. Outer rings step up gently.
const RING_ELEVATION = { 3: 0, 2: 4, 1: 8, 0: 12, 4: 16, 5: 20 };
// All ring indices, ordered innermost → outermost (drives the
// placement loop + dispose + raycast loops). The legacy 3-2-1-0
// order is preserved for clusters/aroma/taste/family; cuisine and
// season sit at the periphery (4, 5).
const RING_INDICES = [3, 2, 1, 0, 4, 5];

// Golden angle (φ ≈ 137.5°) — distributes ring slots so adjacent
// positions aren't cluster-correlated.
//
// LEGACY_STAR_RADIATION reference: prior to 2026-05-13 this constant
// drove a star-radiating placement (golden-angle slots on concentric
// rings). The new wedge layout (computed via computeWheelLayout from
// RadialAffinityWheelGeometry.jsx) groups neighbors angularly by
// bucket instead. PHI is preserved for `placeOnRing()`, which is
// retained as an exported helper for tests + debug A/B.
const PHI = Math.PI * (3 - Math.sqrt(5));

// Wedge layout — outer ring radius for the bucket arc outlines.
// Sized to sit just outside ring 0 (RADII[0]=48) so the arcs frame
// the affinity spheres without overlapping them.
const WEDGE_RADIUS = 52;
// Iter (2026-05-16 user feedback): camera framing radius for the
// focal-orbit. Covers the radial-stagger max (WEDGE_RADIUS × 1.20 =
// 62.4), the bucket labels (WEDGE_LABEL_RADIUS = 58.24), and the
// accent mesh radius (AFFINITY_SPHERE_RADIUS = 1.2) with a small
// breathing buffer. Passed to CameraAnimator.engageFocalOrbit /
// repivot so the orbit distance fits the wheel on any window size
// or device — the animator computes the actual distance from the
// live FOV + viewport aspect.
const WHEEL_FRAME_RADIUS = 66;
// Bucket-label radius — slightly outside the arc so the text floats
// past the outline rather than sitting on it.
const WEDGE_LABEL_RADIUS = WEDGE_RADIUS * 1.12;
// Number of points sampled per wedge arc. 24 segments per π is plenty
// for a smooth read at the camera distance the focal-orbit uses.
const WEDGE_ARC_SEGMENTS_PER_PI = 24;
// Default morph axis when no filter is active (matches the SVG wheel's
// default in IngredientPanel/FullWheel).
const DEFAULT_WEDGE_AXIS = 'aromas';
// Fallback bucket key for neighbors with no axis-specific bucket
// (compound-foods + hub ingredients with no GNN aroma classification,
// or cuisine-less / season-less nodes when those filters are active).
// Without this, those neighbors get dropped from the layout entirely.
const FALLBACK_BUCKET_KEY = '_other';
const FALLBACK_BUCKET_LABEL = 'Other';
const FALLBACK_BUCKET_COLOR = '#475569';

// Tier → edge color (spec § α-mode visual layout).
const TIER_COLOR = {
  3: new THREE.Color(0xfacc15), // gold
  2: new THREE.Color(0xa3a3a3), // silver
  1: new THREE.Color(0xa16207), // bronze
  0: new THREE.Color(0xe879f9), // fuchsia — Surprising
};
const TIER_OPACITY = { 3: 0.9, 2: 0.7, 1: 0.5, 0: 0.55 };

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

// Per-ring slot capacity. v2 6-axis design: each ring holds up to N
// affinities at their bucket on that ring's axis (cross-ring
// duplication — the same affinity appears on every ring where it
// has a bucket). Capacity 30 per ring = top-30 strength-ranked
// affinities × 4 axes = 120 max slots. Edge buffer separately sized
// (one edge per UNIQUE affinity, not per ring instance).
const RING_CAPACITY = { 3: 30, 2: 30, 1: 30, 0: 30, 4: 30, 5: 30 };
const TOTAL_RING_CAPACITY = RING_INDICES.reduce((sum, i) => sum + RING_CAPACITY[i], 0);
// Unique affinity cap — number of distinct ingredients in the rings
// (top-N by strength), independent of how many rings each appears on.
// One edge from focal per UNIQUE affinity, colored by native tier.
const UNIQUE_AFFINITY_CAP = 30;
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
  /**
   * @param {object} stateRef  shared scene state from LivingArchView
   * @param {object} affinityCtx  pairing/top5/bridge/threshold maps
   * @param {object} [cameraAnimator]  optional R14 CameraAnimator. When
   *   present, _flyToFocal delegates to its engageFocalOrbit / repivot
   *   so the user gets the angled bird's-eye orbit instead of the
   *   legacy top-down fly. exit() also notifies the animator so the
   *   tour-resume timer starts ticking. Null in tests + when the
   *   feature flag is off.
   */
  constructor(stateRef, affinityCtx, cameraAnimator = null, options = {}) {
    this.stateRef = stateRef;
    this.ctx = affinityCtx;
    this._cameraAnimator = cameraAnimator;
    // Wedge-layout inputs (additional context only used by the bucket
    // grouping; absence falls back to single-bucket layout):
    //   categoricalCtx — { gnnEntropy, cuisineMap, seasonMap, ... }
    //     same shape App.jsx passes to LivingArchView's other bucketers.
    //   getFilterStack — () => string[]  (live filter stack from
    //     LivingArchView / App.jsx). Used to pick the wedge axis.
    this._categoricalCtx = options.categoricalCtx || {};
    this._getFilterStack = typeof options.getFilterStack === 'function'
      ? options.getFilterStack
      : () => [];
    this._engaged = false;
    this._currentFocal = null;
    this._currentAffinities = []; // last-computed result of topAffinities
    // Per-engage cache populated by _writeRingsAndDim so _buildLabels
    // can render bucket labels without recomputing wedge geometry.
    this._currentWedges = [];
    this._currentBucketColors = {};

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
      affinityShape(0),
      'pennant',  // cuisine-anchored neighbor flag (see cuisineFlagMesh below)
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
    this.ring0Mesh = makeMesh(baseGeos[affinityShape(0)], RING_CAPACITY[0]);
    // v2.1: cuisine + season rings — outermost. Reuse the same sphere
    // geometry as ring 0 since affinityShape() doesn't have entries
    // for indices 4/5 (it falls back to the default sphere via the
    // 'else' branch).
    this.ring4Mesh = makeMesh(baseGeos[affinityShape(4)] || baseGeos[affinityShape(0)], RING_CAPACITY[4]);
    this.ring5Mesh = makeMesh(baseGeos[affinityShape(5)] || baseGeos[affinityShape(0)], RING_CAPACITY[5]);

    // Cuisine-anchor flag mesh — one pennant per neighbor whose pair
    // carries a `cuisineAnchor` payload. Lives in its own mesh so the
    // flag color (cuisine identity) doesn't conflict with the per-tier
    // sphere coloring. Capacity = TOTAL_RING_CAPACITY so every ring slot
    // can fly a flag; instances scale to 0 when the slot's neighbor
    // isn't cuisine-anchored.
    this.cuisineFlagMesh = makeMesh(baseGeos.pennant, TOTAL_RING_CAPACITY);

    // Map ringIdx → mesh for the per-frame writer.
    this._ringMeshes = {
      3: this.ring3Mesh,
      2: this.ring2Mesh,
      1: this.ring1Mesh,
      0: this.ring0Mesh,
      4: this.ring4Mesh,
      5: this.ring5Mesh,
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
    stateRef.scene.add(this.ring0Mesh);
    stateRef.scene.add(this.ring4Mesh);
    stateRef.scene.add(this.ring5Mesh);
    stateRef.scene.add(this.cuisineFlagMesh);

    // Edge BufferGeometry — TOTAL_RING_CAPACITY line segments from
    // focal (origin) to each affinity sphere. 2*TOTAL vertices × 3
    // floats each. Per-vertex color so each segment gets its tier
    // color.
    const edgePositions = new Float32Array(TOTAL_RING_CAPACITY * 2 * 3);
    const edgeColors = new Float32Array(TOTAL_RING_CAPACITY * 2 * 3);
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

    // Focal-name label group — one sprite, the focal ingredient's name
    // floating above the dodecahedron hub. Lives in its own Group so it
    // can stay visible while `labelGroup` (the accent name sprites) is
    // hidden to avoid doubled labels with the SVG overlay. User feedback
    // 2026-05-17: focal name had vanished from α-mode after Track 2
    // (SVG accent labels) hid the entire 3D label group.
    this.focalLabelGroup = new THREE.Group();
    this.focalLabelGroup.visible = false;
    stateRef.scene.add(this.focalLabelGroup);

    // Wedge-arc Line group + bucket-label sprite group. Both rebuilt
    // on each engage/pivot (bucket count + bucket axis can change with
    // filterStack). Geometry/material allocations live inside the
    // builder so we can dispose cleanly between rebuilds.
    this.wedgeArcGroup = new THREE.Group();
    this.wedgeArcGroup.visible = false;
    stateRef.scene.add(this.wedgeArcGroup);
    this.wedgeLabelGroup = new THREE.Group();
    this.wedgeLabelGroup.visible = false;
    stateRef.scene.add(this.wedgeLabelGroup);

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
   * Read-only access to the affinity list computed at the last engage
   * or pivot — used by AffinityTriangleOverlay so the overlay can
   * render apex shape icons (bipyramid / cylinder / sphere / star)
   * that match the 3D affinity legend. Empty array when not engaged.
   * Each entry: { name, ringIdx, strength, tier, bridge } per
   * topAffinities() + surprisingAffinities() output.
   */
  get currentAffinities() {
    return this._engaged ? this._currentAffinities : [];
  }

  /**
   * World-space [x, y, z] of the focal hub mesh, captured at engage /
   * pivot time. Lets AffinityTriangleOverlay anchor its cone bases at
   * the actual focal-mesh position rather than the underlying network
   * curPos of the focal ingredient (which may differ slightly during
   * mode transitions).
   */
  get focalWorldPos() {
    return this._engaged ? this._focalWorldPos : null;
  }

  /**
   * Live wedge axis ('aromas' | 'cuisine' | 'season' | …) used by the
   * affinity layout. Lets AffinityTriangleOverlay paint each cone in
   * the bucket color for the same axis that drives its direction.
   */
  get currentWedgeAxis() {
    return this._engaged ? this._currentWedgeAxis : null;
  }

  /**
   * Re-pivot in place to recompute the camera orbit distance from the
   * live camera FOV + viewport aspect. Called on window resize / iOS
   * rotation so the wheel stays framed when the viewport changes.
   * No-op when α-mode is not engaged.
   */
  refreshFrame() {
    if (!this._engaged) return;
    if (!this._cameraAnimator || this._cameraAnimator.isDisabled) return;
    const st = this.stateRef;
    if (!st || !st.curPos || !st.nameIdx) return;
    const idx = st.nameIdx.get(this._currentFocal);
    if (idx == null) return;
    const fx = st.curPos[idx * 3];
    const fy = st.curPos[idx * 3 + 1];
    const fz = st.curPos[idx * 3 + 2];
    this._cameraAnimator.repivot(idx, [fx, fy, fz], WHEEL_FRAME_RADIUS);
  }

  /**
   * Raycast targets for affinity-aware click handling. The visible
   * focal + ring meshes sit at orbit positions far from the
   * underlying ingredients' real layout coordinates, so the parent
   * raycaster needs to test these meshes directly to let the user
   * click on a ring sphere and re-pivot to the corresponding
   * ingredient. Returns [] when not engaged.
   */
  getRaycastMeshes() {
    if (!this._engaged) return [];
    return [this.focalMesh, this.ring3Mesh, this.ring2Mesh, this.ring1Mesh, this.ring0Mesh, this.ring4Mesh, this.ring5Mesh];
  }

  /**
   * Map a ring-mesh hit (mesh + instanceId) back to a global node
   * index. Returns -1 if the slot is unoccupied or the mesh is not
   * one of ours.
   */
  resolveRingHit(mesh, instanceId) {
    if (!mesh || typeof instanceId !== 'number') return -1;
    const map = mesh.userData?.slotToGlobalIdx;
    if (!map || instanceId < 0 || instanceId >= map.length) return -1;
    return map[instanceId];
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
    if (this.ring0Mesh) this.ring0Mesh.visible = false;
    if (this.ring4Mesh) this.ring4Mesh.visible = false;
    if (this.ring5Mesh) this.ring5Mesh.visible = false;
    if (this.cuisineFlagMesh) this.cuisineFlagMesh.visible = false;
    this.edgeLines.visible = false;
    this.labelGroup.visible = false;
    if (this.focalLabelGroup) this.focalLabelGroup.visible = false;
    if (this.wedgeArcGroup) this.wedgeArcGroup.visible = false;
    if (this.wedgeLabelGroup) this.wedgeLabelGroup.visible = false;
    // Clear label sprites to release canvas textures.
    while (this.labelGroup.children.length > 0) {
      const s = this.labelGroup.children[0];
      this.labelGroup.remove(s);
      if (s.material?.map) s.material.map.dispose();
      if (s.material) s.material.dispose();
    }
    if (this.focalLabelGroup) {
      while (this.focalLabelGroup.children.length > 0) {
        const s = this.focalLabelGroup.children[0];
        this.focalLabelGroup.remove(s);
        if (s.material?.map) s.material.map.dispose();
        if (s.material) s.material.dispose();
      }
    }
    this._disposeWedgeArcs();
    this._disposeWedgeLabels();
    this._currentAffinities = [];
    this._currentWedges = [];
    this._currentBucketColors = {};

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

    // 6. R14 Phase 4: notify the animator the orbit is over so the
    //    cluster tour can resume after the idle timer.
    if (this._cameraAnimator) {
      this._cameraAnimator.exitFocalOrbit();
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
    if (this.ring0Mesh) this.ring0Mesh.visible = false;
    if (this.ring4Mesh) this.ring4Mesh.visible = false;
    if (this.ring5Mesh) this.ring5Mesh.visible = false;
    if (this.cuisineFlagMesh) this.cuisineFlagMesh.visible = false;
    this.edgeLines.visible = false;
    this.labelGroup.visible = false;
    if (this.focalLabelGroup) this.focalLabelGroup.visible = false;
    if (this.wedgeArcGroup) this.wedgeArcGroup.visible = false;
    if (this.wedgeLabelGroup) this.wedgeLabelGroup.visible = false;
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
    const meshes = [this.focalMesh, this.ring3Mesh, this.ring2Mesh, this.ring1Mesh, this.ring0Mesh, this.ring4Mesh, this.ring5Mesh, this.cuisineFlagMesh];
    if (st && st.scene) {
      for (const m of meshes) {
        if (m) st.scene.remove(m);
      }
      if (this.edgeLines) st.scene.remove(this.edgeLines);
      if (this.labelGroup) st.scene.remove(this.labelGroup);
      if (this.focalLabelGroup) st.scene.remove(this.focalLabelGroup);
      if (this.wedgeArcGroup) st.scene.remove(this.wedgeArcGroup);
      if (this.wedgeLabelGroup) st.scene.remove(this.wedgeLabelGroup);
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
    if (this.focalLabelGroup) {
      this.focalLabelGroup.children.forEach((s) => {
        if (s.material?.map) s.material.map.dispose();
        if (s.material) s.material.dispose();
      });
    }
    this._disposeWedgeArcs();
    this._disposeWedgeLabels();
    this.focalMesh = null;
    this.ring3Mesh = null;
    this.ring2Mesh = null;
    this.ring1Mesh = null;
    this.ring0Mesh = null;
    this.ring4Mesh = null;
    this.ring5Mesh = null;
    this.cuisineFlagMesh = null;
    this._ringMeshes = null;
    this.affinityMesh = null;
    this._sharedMaterial = null;
    this.edgeLines = null;
    this.edgeGeo = null;
    this.edgeMat = null;
    this.labelGroup = null;
    this.focalLabelGroup = null;
    this.wedgeArcGroup = null;
    this.wedgeLabelGroup = null;
    this._matrixSnapshot = null;
    this._engaged = false;
    this._currentFocal = null;
    this._currentAffinities = [];
    this._currentWedges = [];
    this._currentBucketColors = {};
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

    const tiered = topAffinities(focal, this.ctx);
    // Append surprising candidates as ring 0. The Surprising tier is
    // bridged-but-corpus-untiered (strength below ★) so the
    // surprisingAffinities helper applies its own filtering — we just
    // tack the result onto the same list the renderer iterates.
    const surprising = surprisingAffinities(focal, this.ctx, { N: RING_CAPACITY[0] });
    // Drop dupes that already appeared as a tiered affinity (cheap;
    // surprising lists are ≤ 8).
    const tieredNames = new Set(tiered.map((a) => a.name));
    const dedupedSurprising = surprising.filter((a) => !tieredNames.has(a.name));
    const affinities = [...tiered, ...dedupedSurprising];
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

    // ─── 1b. Affinity placement — WEDGE LAYOUT ───
    // Replaces the legacy star-radiating placeOnRing math. We bucket
    // each neighbor under the active filter axis (or DEFAULT_WEDGE_AXIS
    // when no filter is active) and drop them into bucket-grouped
    // angular sectors via computeWheelLayout. The 2D layout's (x, y)
    // is mapped to scene-space (x, 0, z) — XZ plane, Y up — matching
    // the ring meshes' existing convention (placeOnRing returns y=0
    // points on the +x axis).
    //
    // ringIdx (3/2/1/0) is preserved on each affinity so we can still
    // pick the right per-tier InstancedMesh for shape + color and so
    // the slot→global-idx map keeps click-to-pivot working.
    const tmpS = new THREE.Vector3(
      AFFINITY_SPHERE_RADIUS,
      AFFINITY_SPHERE_RADIUS,
      AFFINITY_SPHERE_RADIUS,
    );
    const zeroS = new THREE.Vector3(0, 0, 0);
    const slotCounter = { 3: 0, 2: 0, 1: 0, 0: 0 };
    // Pre-fill ALL ring slots as collapsed (scale=0); the loop below
    // overwrites occupied slots. This guarantees no stale matrices
    // survive a pivot when an affinity count drops below capacity.
    //
    // Also reset the per-mesh slot→global-idx map so click resolution
    // (livingArchView's affinity-aware raycaster) sees -1 for any
    // unoccupied slot rather than a stale ingredient from a prior pivot.
    for (const ringIdx of RING_INDICES) {
      const mesh = this._ringMeshes[ringIdx];
      const cap = RING_CAPACITY[ringIdx];
      for (let s = 0; s < cap; s++) {
        m.compose(tmpV.set(0, 0, 0), tmpQ, zeroS);
        mesh.setMatrixAt(s, m);
      }
      const slotMap = mesh.userData.slotToGlobalIdx
        ?? (mesh.userData.slotToGlobalIdx = new Int32Array(cap));
      slotMap.fill(-1);
    }
    const focalSlotMap = this.focalMesh.userData.slotToGlobalIdx
      ?? (this.focalMesh.userData.slotToGlobalIdx = new Int32Array(FOCAL_CAPACITY));
    focalSlotMap.fill(-1);
    focalSlotMap[0] = focalIdx;

    // ─── v2 6-axis (4-axis impl ships now) placement ───
    // Each of the 4 axes (cluster/aromas/taste/family) gets its own
    // ring mesh. For each axis we run computeWheelLayout to get
    // bucket angles, then place every affinity that has a bucket on
    // this axis at the corresponding ring radius + segment angle.
    // The focal goes on the innermost (cluster) ring at its cluster's
    // segment angle — NOT at the wheel center (canonical-spec §6.4).
    const layoutViewportFor = (radius) => ({
      width: radius / 0.42,
      height: radius / 0.42,
    });
    const layoutByRing = {};
    const bucketColorsByRing = {};
    for (const ringIdx of RING_INDICES) {
      const axisKey = RING_AXIS[ringIdx];
      const wedgeContext = this._resolveWedgeContext(affinities, axisKey);
      const { palette, bucketColors, neighborWithBucket } = wedgeContext;
      const layout = computeWheelLayout({
        focal: { name: focal },
        neighbors: neighborWithBucket,
        axis: axisKey,
        viewport: layoutViewportFor(RADII[ringIdx]),
        bucketColors,
        bucketOrder: palette?.labels ? [...palette.labels, FALLBACK_BUCKET_KEY] : null,
      });
      const layoutScale = layout.radius > 0 ? (RADII[ringIdx] / layout.radius) : 1;
      const dotByName = new Map();
      for (const dot of layout.dots) {
        const n = dot.neighbor;
        if (n && n.name) dotByName.set(n.name, dot);
      }
      // Build a quick wedge-by-key index so focal can look up its
      // cluster's segment angle below.
      const wedgeByKey = new Map();
      for (const w of layout.wedges) wedgeByKey.set(w.key, w);
      layoutByRing[ringIdx] = { layout, layoutScale, dotByName, bucketColors, wedgeByKey, axisKey };
      bucketColorsByRing[ringIdx] = bucketColors;
    }
    // Legacy single-axis surface (preserved for SVG overlay + tests):
    // _currentWedges + _currentWedgeAxis follow the filter-driven axis
    // (or DEFAULT_WEDGE_AXIS 'aromas' when no filter). The v2 cluster
    // ring data is surfaced separately under _clusterRing for new code.
    const filterStack = (this._getFilterStack && this._getFilterStack()) || [];
    const filterMorphAxis = morphAxisForStack(filterStack) || DEFAULT_WEDGE_AXIS;
    const filterRingIdx = filterMorphAxis === 'cluster' ? 3
      : filterMorphAxis === 'aromas'  ? 2
      : filterMorphAxis === 'taste'   ? 1
      : filterMorphAxis === 'family'  ? 0
      : filterMorphAxis === 'cuisine' ? 4
      : filterMorphAxis === 'season'  ? 5
      : 2; // default 'aromas' ring
    const surfacedRing = layoutByRing[filterRingIdx] || layoutByRing[2];
    this._currentWedges = surfacedRing.layout.wedges;
    this._currentBucketColors = surfacedRing.bucketColors;
    this._currentWedgeAxis = surfacedRing.axisKey;
    this._clusterRing = layoutByRing[3];

    // ─── 1a-revised. Focal placement ON cluster ring at cluster segment ───
    // Override the earlier "focal at wheel center" placement (which
    // we did at line ~765 above). Move focal to ring 3 at its own
    // cluster's segment angle. Camera-orbit framing stays at the
    // wheel center; the focal sphere just sits on the cluster ring.
    const focalNode = st.nodeArray?.[focalIdx] || null;
    const focalClusterId = focalNode?.clusterId;
    const focalWedge = focalClusterId != null
      ? clusterRing.wedgeByKey.get(String(focalClusterId))
      : null;
    let focalRingX = cx;
    let focalRingZ = cz;
    if (focalWedge) {
      const fa = focalWedge.midAngle;
      focalRingX = cx + RADII[3] * Math.cos(fa);
      focalRingZ = cz + RADII[3] * Math.sin(fa);
      const fmS = new THREE.Vector3(focalScale, focalScale, focalScale);
      const fmM = new THREE.Matrix4();
      const fmV = new THREE.Vector3(focalRingX, cy + RING_ELEVATION[3], focalRingZ);
      const fmQ = new THREE.Quaternion();
      fmM.compose(fmV, fmQ, fmS);
      this.focalMesh.setMatrixAt(0, fmM);
      this.focalMesh.instanceMatrix.needsUpdate = true;
    }

    // ─── 1b-revised. Affinity placement — walk axes, place each
    //              affinity at its bucket on each ring it has one ───
    // sphereWorldPos[i] stores the affinity's CLUSTER-RING position
    // for downstream edge/flag rendering (one edge per unique aff,
    // not one per ring instance).
    const sphereWorldPos = []; // for edge alignment, in affinity order
    for (const aff of affinities) sphereWorldPos.push(null);

    // Track which ring's position should be exposed as the canonical
    // aff.worldPos (consumed by SVG overlay + cuisine flags + legacy
    // wedge tests). When a filter pill is active, worldPos points at
    // the filter-driven ring so the overlay groups affinities by the
    // user's currently-focused axis. Otherwise default to the cluster
    // ring (innermost, primary navigation axis).
    const canonicalRingIdx = filterRingIdx;

    for (const ringIdx of RING_INDICES) {
      const ring = layoutByRing[ringIdx];
      const mesh = this._ringMeshes[ringIdx];
      const cap = RING_CAPACITY[ringIdx];
      let slot = 0;
      for (let i = 0; i < affinities.length; i++) {
        const aff = affinities[i];
        const dot = ring.dotByName.get(aff.name);
        if (!dot) continue; // affinity has no bucket on this axis
        if (slot >= cap) break;
        const px = dot.x * ring.layoutScale;
        const pz = dot.y * ring.layoutScale;
        const yLift = RING_ELEVATION[ringIdx] ?? 0;
        tmpV.set(cx + px, cy + yLift, cz + pz);
        const worldXyz = [tmpV.x, tmpV.y, tmpV.z];
        if (ringIdx === canonicalRingIdx) {
          sphereWorldPos[i] = worldXyz;
          aff.worldPos = worldXyz;
          aff.bucketKey = dot?.neighbor?.bucketKey ?? null;
        }
        m.compose(tmpV, tmpQ, tmpS);
        mesh.setMatrixAt(slot, m);
        const bucketHex = dot?.neighbor?.bucketKey ? ring.bucketColors[dot.neighbor.bucketKey] : null;
        let cr, cg, cb;
        if (bucketHex) {
          const bc = new THREE.Color(bucketHex);
          cr = bc.r; cg = bc.g; cb = bc.b;
        } else {
          const c = TIER_COLOR[aff.tier] ?? TIER_COLOR[1];
          cr = c.r; cg = c.g; cb = c.b;
        }
        mesh.instanceColor.setXYZ(slot, cr, cg, cb);
        const affGlobalIdx = st.nameIdx?.get(aff.name);
        if (typeof affGlobalIdx === 'number') {
          mesh.userData.slotToGlobalIdx[slot] = affGlobalIdx;
        }
        slot++;
      }
    }
    // For any affinity that didn't get placed on the canonical ring
    // (the affinity has no bucket on that axis), use the first ring
    // it does have a placement on. Cuisine flags + edges + SVG cones
    // need a worldPos to anchor against.
    const tryRings = [canonicalRingIdx, ...RING_INDICES];
    for (let i = 0; i < affinities.length; i++) {
      if (sphereWorldPos[i] !== null) continue;
      const aff = affinities[i];
      for (const ringIdx of tryRings) {
        const ring = layoutByRing[ringIdx];
        const dot = ring.dotByName.get(aff.name);
        if (!dot) continue;
        const px = dot.x * ring.layoutScale;
        const pz = dot.y * ring.layoutScale;
        const yLift = RING_ELEVATION[ringIdx] ?? 0;
        const worldXyz = [cx + px, cy + yLift, cz + pz];
        sphereWorldPos[i] = worldXyz;
        aff.worldPos = worldXyz;
        aff.bucketKey = dot?.neighbor?.bucketKey ?? null;
        break;
      }
    }
    for (const ringIdx of RING_INDICES) {
      const mesh = this._ringMeshes[ringIdx];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.visible = true;
    }

    // ─── 1c. Wedge arc outlines (legacy single-axis arcs) ───
    // Draw arcs for the filter-driven axis ring (matches legacy SVG
    // overlay's wedge layout). The 4-ring v2 placement still happens
    // above; arcs frame the user's currently-active filter axis.
    this._buildWedgeArcs(
      surfacedRing.layout,
      surfacedRing.layoutScale,
      [cx, cy, cz],
    );

    // ─── 2. Edge buffer (focal → each affinity) ───
    const posAttr = this.edgeGeo.attributes.position;
    const colAttr = this.edgeGeo.attributes.color;
    for (let i = 0; i < TOTAL_RING_CAPACITY; i++) {
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
    // Track 2 (2026-05-16) — 3D edge lines are now superseded by the
    // AffinityTriangleOverlay's SVG cones. The cones carry color +
    // tier semantics and the user reported the in-scene edges felt
    // duplicative ("the previous lines and icons still exist").
    this.edgeLines.visible = false;

    // ─── 2b. Cuisine-anchor flags ───
    // For each neighbor whose pair carries a cuisineAnchor (provenance =
    // 'both' or 'cuisine' from the enriched neighbor index, OR a Pass-4
    // promotion in surprisingAffinities), place a tiny pennant above the
    // sphere with the cuisine's color. Slots without cuisine-anchored
    // pairs collapse to scale 0.
    let anyCuisineFlag = false;
    for (let i = 0; i < TOTAL_RING_CAPACITY; i++) {
      const aff = i < affinities.length ? affinities[i] : null;
      const pos = sphereWorldPos[i];
      const cuiName = aff?.cuisineAnchor?.cuisine || aff?.cuisineAnchor?.primary || null;
      if (aff && pos && cuiName) {
        const [tx, ty, tz] = pos;
        this._matrixScratch.compose(
          new THREE.Vector3(tx, ty + 3.2, tz),
          this._tmpQuat.identity(),
          new THREE.Vector3(1.2, 1.2, 1.2),
        );
        this.cuisineFlagMesh.setMatrixAt(i, this._matrixScratch);
        const hex = cuisineColor(cuiName) || '#94a3b8';
        const c = new THREE.Color(hex);
        this.cuisineFlagMesh.instanceColor.array[i * 3]     = c.r;
        this.cuisineFlagMesh.instanceColor.array[i * 3 + 1] = c.g;
        this.cuisineFlagMesh.instanceColor.array[i * 3 + 2] = c.b;
        anyCuisineFlag = true;
      } else {
        // Collapse to zero scale — instance lives but is invisible.
        this._matrixScratch.compose(
          this._tmpPos.set(0, 0, 0),
          this._tmpQuat.identity(),
          this._scaleZero,
        );
        this.cuisineFlagMesh.setMatrixAt(i, this._matrixScratch);
      }
    }
    this.cuisineFlagMesh.instanceMatrix.needsUpdate = true;
    if (this.cuisineFlagMesh.instanceColor) {
      this.cuisineFlagMesh.instanceColor.needsUpdate = true;
    }
    this.cuisineFlagMesh.visible = anyCuisineFlag;
    // Surface focal world position so the SVG overlay can project the
    // hub anchor without needing st.curPos (which doesn't account for
    // any per-frame tween the focal mesh might do during engage).
    this._focalWorldPos = [cx, cy, cz];

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
   * affinities at their ring positions. Also rebuilds the bucket-name
   * sprites (one per wedge) sitting at the outer label radius.
   */
  _buildLabels(focal, sphereWorldPos, focalWorld) {
    // Clear previous affinity-name sprites.
    while (this.labelGroup.children.length > 0) {
      const s = this.labelGroup.children[0];
      this.labelGroup.remove(s);
      if (s.material?.map) s.material.map.dispose();
      if (s.material) s.material.dispose();
    }
    // Focal label — largest, white. Sizes bumped on user feedback
    // ("labels are too hard to read"): focal 9→14, affinities 7→11.
    // Y-offsets nudged up to keep the sprites clear of the larger
    // tier shapes.
    // Clear previous focal sprite from its dedicated group.
    while (this.focalLabelGroup.children.length > 0) {
      const s = this.focalLabelGroup.children[0];
      this.focalLabelGroup.remove(s);
      if (s.material?.map) s.material.map.dispose();
      if (s.material) s.material.dispose();
    }
    const focalSprite = makeLabel(focal, '#ffffff', 14, { glow: false });
    focalSprite.position.set(focalWorld[0], focalWorld[1] + 4.5, focalWorld[2]);
    this.focalLabelGroup.add(focalSprite);
    this.focalLabelGroup.visible = true;
    // Affinity labels — colored by tier (matches edge color so user
    // associates label tone with chemistry signal).
    for (let i = 0; i < this._currentAffinities.length; i++) {
      const aff = this._currentAffinities[i];
      const pos = sphereWorldPos[i];
      if (!pos) continue;
      const c = TIER_COLOR[aff.tier] ?? TIER_COLOR[1];
      // CSS-friendly hex string for canvas fillStyle.
      const hex = '#' + c.getHexString();
      const sprite = makeLabel(aff.name, hex, 11, { glow: false });
      sprite.position.set(pos[0], pos[1] + 4, pos[2]);
      this.labelGroup.add(sprite);
    }
    // Track 2 (2026-05-16) — accent name labels are now carried by
    // AffinityTriangleOverlay in SVG. Keeping the 3D sprites visible
    // produced doubled labels ("cheese cheese", "flour flour" in the
    // user's screenshot). The sprite buffer is still populated so any
    // future code path can flip this back on, but the default is off.
    this.labelGroup.visible = false;

    // Bucket-name labels — one per wedge, sitting at the outer label
    // radius in the same XZ plane as the wedge arcs. Re-uses makeLabel
    // for visual consistency with the affinity-name sprites.
    this._buildWedgeLabels(focalWorld);
  }

  /**
   * Resolve the wedge axis + per-neighbor bucket assignment from the
   * live filter stack. Pure inputs → pure output (besides the affinity
   * list mutation that adds a `bucketKey` field).
   *
   * Returns:
   *   axisKey            — plural axis key ('aromas' / 'cuisine' / …)
   *   palette            — { labels, colors } from CATEGORICAL_AXES
   *   bucketColors       — { [bucketLabel]: hexColor } including fallback
   *   neighborWithBucket — affinities[] with `bucketKey` filled in
   */
  _resolveWedgeContext(affinities, axisOverride = null) {
    let axisKey = axisOverride;
    if (!axisKey) {
      const filterStack = (this._getFilterStack && this._getFilterStack()) || [];
      const morphAxis = morphAxisForStack(filterStack);
      axisKey = morphAxis || DEFAULT_WEDGE_AXIS;
    }
    const filterKey = axisKey === 'aromas' ? 'aroma' : axisKey;
    const nodes = this.ctx?.graph?.nodes;
    const ctx = this._categoricalCtx || {};

    // Special path for the cluster axis: buckets are derived from
    // node.clusterId (the v3 cluster index) + cluster_labels_v3
    // mappings already attached to nodes by useProData. CATEGORICAL_AXES
    // doesn't have a 'cluster' entry — synthesize palette + buckets
    // from the live nodes.
    if (axisKey === 'cluster') {
      const labels = new Set();
      const colors = {};
      const palette = { labels: [], colors: [] };
      const neighborWithBucket = affinities.map((aff) => {
        const node = (nodes && typeof nodes.get === 'function')
          ? (nodes.get(aff.name) || { name: aff.name })
          : { name: aff.name };
        const cid = node.clusterId;
        const bucketKey = cid != null ? String(cid) : FALLBACK_BUCKET_KEY;
        if (cid != null && !labels.has(bucketKey)) {
          labels.add(bucketKey);
          palette.labels.push(bucketKey);
          const hex = node.clusterColor || FALLBACK_BUCKET_COLOR;
          palette.colors.push(hex);
          colors[bucketKey] = hex;
        }
        return { ...aff, bucketKey };
      });
      colors[FALLBACK_BUCKET_KEY] = FALLBACK_BUCKET_COLOR;
      return { axisKey, palette, bucketColors: colors, neighborWithBucket };
    }

    const palette = CATEGORICAL_AXES[axisKey] || null;
    const bucketColors = {};
    if (palette && Array.isArray(palette.labels)) {
      for (let i = 0; i < palette.labels.length; i++) {
        bucketColors[palette.labels[i]] = palette.colors[i];
      }
    }
    bucketColors[FALLBACK_BUCKET_KEY] = FALLBACK_BUCKET_COLOR;

    // Look up each neighbor's bucket via the same path the SVG wheel +
    // LivingArchView visibility predicate use, so compound-foods +
    // hub ingredients land in the same bucket as elsewhere in the app.
    const neighborWithBucket = affinities.map((aff) => {
      const node = (nodes && typeof nodes.get === 'function')
        ? (nodes.get(aff.name) || { name: aff.name })
        : { name: aff.name };
      let bucketKey = resolveBucket(filterKey, node, ctx) || null;
      // Never drop a neighbor from the layout — assign FALLBACK_BUCKET
      // so the affinity still places on a ring; otherwise the user
      // loses information about that ingredient.
      if (!bucketKey) bucketKey = FALLBACK_BUCKET_KEY;
      return { ...aff, bucketKey };
    });
    return { axisKey, palette, bucketColors, neighborWithBucket };
  }

  /**
   * Rebuild bucket-colored arc outlines, one Line per wedge. Disposes
   * any previous arc geometry/materials before allocating new ones so
   * we don't leak across pivots.
   */
  _buildWedgeArcs(layout, layoutScale, focalWorld) {
    if (!this.wedgeArcGroup) return;
    this._disposeWedgeArcs();
    const wedges = layout?.wedges || [];
    if (wedges.length === 0) {
      this.wedgeArcGroup.visible = false;
      return;
    }
    const [fx, fy, fz] = focalWorld;
    for (const w of wedges) {
      // Skip the empty-anchor sentinel wedge that computeWheelLayout
      // emits when there are no buckets at all (defensive — we always
      // pass at least the fallback bucket, so this should be unreachable).
      if (w.key === '_empty') continue;
      const startAngle = w.midAngle - w.span / 2;
      const segCount = Math.max(
        4,
        Math.ceil((Math.abs(w.span) * WEDGE_ARC_SEGMENTS_PER_PI) / Math.PI),
      );
      // P6 (ADR-3) — TubeGeometry swap for iOS parity.
      //
      // iOS WebGL ignores `LineBasicMaterial.linewidth > 1`, leaving wedge
      // arcs as 1-pixel hairlines that visually disappear at the camera
      // distance the affinity view uses. Replacing the Line with a
      // Mesh(TubeGeometry, MeshBasicMaterial) gives a guaranteed-thick arc
      // on all backends (iOS + desktop) and stays bloom-compatible because
      // MeshBasicMaterial is unlit.
      //
      // Build a CatmullRomCurve3 (centripetal mode = minimal overshoot,
      // closely follows the sampled arc points) and extrude a 6-sided tube
      // along it. The mesh's `raycast` is stubbed to () => {} so click
      // events pass through to the underlying ingredient nodes — without
      // this stub, the cone visuals would intercept clicks that the user
      // intended for the affinity sphere behind them.
      const arcPoints = new Array(segCount + 1);
      for (let i = 0; i <= segCount; i++) {
        const t = i / segCount;
        const angle = startAngle + t * w.span;
        const x = Math.cos(angle) * WEDGE_RADIUS;
        const z = Math.sin(angle) * WEDGE_RADIUS;
        arcPoints[i] = new THREE.Vector3(fx + x, fy, fz + z);
      }
      const curve = new THREE.CatmullRomCurve3(arcPoints, false, 'centripetal');
      const geo = new THREE.TubeGeometry(
        curve,
        Math.max(segCount * 2, 12), // tubularSegments — extra subdivision for smoothness
        0.4,                         // tube radius (px-equivalent at affinity zoom)
        6,                           // radialSegments — hex cross-section reads as round under bloom
        false,                       // open-ended (no caps; arcs flow into one another visually)
      );
      const color = new THREE.Color(w.color || FALLBACK_BUCKET_COLOR);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
      });
      const tube = new THREE.Mesh(geo, mat);
      tube.frustumCulled = false;
      tube.userData = { bucketKey: w.key };
      // Click-through: cones must not steal pointer events from the
      // ingredient nodes they visually overlay (Architect ADR-3 hard
      // requirement).
      tube.raycast = () => {};
      this.wedgeArcGroup.add(tube);
    }
    // Suppress the noop reference for the unused layoutScale param —
    // arcs sit at the world-space WEDGE_RADIUS regardless of layout
    // scale; the param is kept on the signature for symmetry with
    // future enhancements (e.g. radius-tier-aware arcs).
    void layoutScale;
    this.wedgeArcGroup.visible = true;
  }

  /**
   * Build bucket-name label sprites — one per wedge, at the outer
   * label radius. Shared with _buildLabels via the affinity sprite
   * builder so visual treatment matches the rest of α-mode.
   */
  _buildWedgeLabels(focalWorld) {
    if (!this.wedgeLabelGroup) return;
    this._disposeWedgeLabels();
    const wedges = this._currentWedges || [];
    if (wedges.length === 0) {
      this.wedgeLabelGroup.visible = false;
      return;
    }
    const [fx, fy, fz] = focalWorld;
    for (const w of wedges) {
      if (w.key === '_empty' || !w.label) continue;
      const x = Math.cos(w.midAngle) * WEDGE_LABEL_RADIUS;
      const z = Math.sin(w.midAngle) * WEDGE_LABEL_RADIUS;
      const color = w.color || FALLBACK_BUCKET_COLOR;
      const sprite = makeLabel(String(w.label), color, 12, { glow: false });
      sprite.position.set(fx + x, fy + 1, fz + z);
      sprite.userData = { wedgeKey: w.key };
      this.wedgeLabelGroup.add(sprite);
    }
    this.wedgeLabelGroup.visible = true;
  }

  _disposeWedgeArcs() {
    if (!this.wedgeArcGroup) return;
    while (this.wedgeArcGroup.children.length > 0) {
      const line = this.wedgeArcGroup.children[0];
      this.wedgeArcGroup.remove(line);
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    }
  }

  _disposeWedgeLabels() {
    if (!this.wedgeLabelGroup) return;
    while (this.wedgeLabelGroup.children.length > 0) {
      const s = this.wedgeLabelGroup.children[0];
      this.wedgeLabelGroup.remove(s);
      if (s.material?.map) s.material.map.dispose();
      if (s.material) s.material.dispose();
    }
  }

  /**
   * Public-API: re-render the wedge layout for the currently engaged
   * focal. Call this after the filter stack changes so the wedge axis
   * + bucket assignment update without a full pivot. No-op when not
   * engaged.
   */
  refreshWedgeLayout() {
    if (!this._engaged || !this._currentFocal) return;
    this._writeRingsAndDim(this._currentFocal);
  }

  /**
   * Camera flight to frame the focal ingredient.
   *
   * R14 Phase 4: when a CameraAnimator was injected, delegate to it.
   *   - If the animator is already focal-flying / focal-orbiting,
   *     call repivot() so the orbit angle accumulator continues
   *     from its current value (AC-FO-7 continuity contract).
   *   - Otherwise, engageFocalOrbit() resets the angle and starts
   *     a fresh angled-orbit cycle.
   * The user sees a 60°-elevation orbit instead of the legacy
   * top-down fly; rings stay visible throughout.
   *
   * Legacy path (no animator): top-down camera placement at
   * y = focal.y + 75, looking straight down. Used when Phase 1's
   * feature flag is off, or in tests that construct AffinityMode
   * with two args.
   */
  _flyToFocal(focal) {
    const st = this.stateRef;
    if (!st || !st.camera || !st.controls) return;
    const idx = st.nameIdx?.get(focal);
    if (idx === undefined) return;
    const fx = st.curPos[idx * 3];
    const fy = st.curPos[idx * 3 + 1];
    const fz = st.curPos[idx * 3 + 2];

    // R14 Phase 4: delegate to injected animator when available.
    if (this._cameraAnimator && !this._cameraAnimator.isDisabled) {
      const animState = this._cameraAnimator.state;
      if (animState === 'focal-flying' || animState === 'focal-orbiting') {
        this._cameraAnimator.repivot(idx, [fx, fy, fz], WHEEL_FRAME_RADIUS);
      } else {
        this._cameraAnimator.engageFocalOrbit(idx, [fx, fy, fz], WHEEL_FRAME_RADIUS);
      }
      return;
    }

    // Legacy top-down path. Ring 1 radius is 35; +10% padding → 38.5.
    // With a 50° FOV camera the half-angle is 25°. Required distance
    // = 38.5 / tan(25°) ≈ 82 units. Use 75 — slightly closer for a
    // fuller frame.
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
