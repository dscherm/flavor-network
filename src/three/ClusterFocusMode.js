/**
 * ClusterFocusMode — controller for cluster-focus isolate + spread.
 *
 * Canonical spec: docs/NETWORK-AND-AFFINITY-SPEC.md §5.6.
 * Source spec:  .omc/specs/deep-interview-cluster-focus-isolate-spread.md.
 *
 * Lifecycle: instantiated in LivingArchView's scene-setup effect once
 * stateRef has a NodeMesh. Exposes engage/exit/tickAnimation/dispose.
 * Called from the animation loop each frame.
 *
 * What it does on engage:
 *   1. Snapshot every node's current matrix into `_canonicalMatrices`.
 *   2. Compute the focused cluster's centroid (mean of member matrices).
 *   3. Compute the adaptive spread factor:
 *        target_min_spacing  = SPREAD_MIN_RADIUS_MULT × node_radius × 2
 *        current_min_spacing = min nearest-neighbor distance in the cluster
 *        factor              = max(1, target / current)
 *   4. Cache per-member target positions (centroid + offset * factor).
 *   5. Set `_targetProgress = 1`. tickAnimation eases progress 0→1.
 *
 * Per-frame (tickAnimation):
 *   - progress eases toward targetProgress over `SPREAD_DURATION_MS`
 *   - eased = easeInOutCubic(progress)
 *   - For focused-cluster members: matrix position = lerp(canonical, target, eased)
 *   - For non-focused members:     matrix scale    = lerp(canonical, 0,      eased)
 *     (scale-0 collapses the instance to a singularity = invisible —
 *     the canonical InstancedMesh hide trick, no shader change needed)
 *
 * On exit:
 *   - Set `_targetProgress = 0`. tickAnimation reverses the lerp.
 *   - When progress reaches 0, restore exact canonical matrices and
 *     mark _engaged = false. Camera reversal is owned by the parent
 *     (LivingArchView calls cameraAnimator.engageClusterFit on engage
 *     and its own restore on exit — this class doesn't touch the camera).
 *
 * Reduced motion:
 *   When the user prefers-reduced-motion: reduce, both spread and hide
 *   snap (no animation). progress jumps to target immediately.
 *
 * Mutex with α-mode:
 *   This class does not check for AffinityMode engagement; the
 *   orchestrator (LivingArchView) calls exit() before engaging α-mode.
 *
 * Edge handling:
 *   This class does not touch EdgeMesh. By default the network renders
 *   no edges when no node is selected (§4.2), so cluster-focus inherits
 *   that empty edge state. The §4.2 intra-cluster edge exception is a
 *   follow-up enhancement, not Phase 1.
 */
import * as THREE from 'three';

export const SPREAD_DURATION_MS = 600;
// Target minimum nearest-neighbor distance after spread = MULT × node diameter.
// 1.5 keeps each pair of sphere surfaces ~0.5 × diameter apart — visually
// distinct without exploding small clusters to fill the viewport.
export const SPREAD_MIN_RADIUS_MULT = 1.5;
// Reference sphere radius. NodeMesh uses sphere instances with per-node
// scale via _baseScaleFor; we use the unit-sphere baseline geometry here
// (geometry radius ≈ 1.0u). The adaptive factor compares cluster-typical
// distances against `nodeRadius × 2 × MULT` ≈ 3u.
const REFERENCE_NODE_RADIUS = 1.0;
// Hard cap on the spread factor. After dynamic cluster compaction
// (2026-05-24 session work) the average cluster's min nearest-neighbor
// distance dropped to ~0.1u, which under the pure `target/current`
// rule would produce factors of ~30× and hurl members to radius 500+
// (past the camera frustum). 5× is the empirically-derived ceiling
// that keeps even the densest cluster inside a comfortable viewport
// while still meaningfully separating members. Some node pairs may
// remain closer than the target (1.5× diameter); accept that as the
// price of staying on-screen.
export const MAX_SPREAD_FACTOR = 5.0;
// Approximate maximum number of nodes used for the nearest-neighbor
// distance probe. Above this we sample to keep the engage step fast
// — pairwise distance on 500 nodes = 250k comparisons, still cheap.
const NN_SAMPLE_MAX = 500;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function detectReducedMotion(opts) {
  if (typeof opts.reducedMotion === 'boolean') return opts.reducedMotion;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Pure: compute the centroid of a list of [x,y,z] positions.
 * Returns [0,0,0] when empty (caller should guard against engaging on
 * empty clusters).
 */
export function computeCentroid(positions) {
  if (!positions || positions.length === 0) return [0, 0, 0];
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < positions.length; i++) {
    sx += positions[i][0];
    sy += positions[i][1];
    sz += positions[i][2];
  }
  const n = positions.length;
  return [sx / n, sy / n, sz / n];
}

/**
 * Pure: minimum nearest-neighbor distance within a position set.
 * Returns Infinity when fewer than 2 positions are provided. Skips
 * exact-coincident pairs (distance 0) so co-located alias nodes don't
 * pull the floor to zero. Sampled to NN_SAMPLE_MAX positions to keep
 * the cost bounded on large clusters.
 */
export function minNearestNeighborDistance(positions) {
  if (!positions || positions.length < 2) return Infinity;
  let sample = positions;
  if (positions.length > NN_SAMPLE_MAX) {
    const step = Math.ceil(positions.length / NN_SAMPLE_MAX);
    sample = [];
    for (let i = 0; i < positions.length; i += step) sample.push(positions[i]);
  }
  let minD = Infinity;
  for (let i = 0; i < sample.length; i++) {
    const a = sample[i];
    let nearest = Infinity;
    for (let j = 0; j < sample.length; j++) {
      if (i === j) continue;
      const b = sample[j];
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 0 && d < nearest) nearest = d;
    }
    if (nearest < minD) minD = nearest;
  }
  return minD;
}

/**
 * Pure: adaptive spread factor for a cluster.
 *   factor = clamp( target_min_spacing / current_min_spacing , 1, MAX_SPREAD_FACTOR )
 * `nodeRadius` defaults to REFERENCE_NODE_RADIUS. Returns 1.0 (no-op)
 * when nodes are already adequately spaced. Returns MAX_SPREAD_FACTOR
 * when the raw target/current ratio would explode the cluster past
 * the viewport (post-compaction min_spacing can drop below 0.1u,
 * which without the cap produces factor ≈ 30 and hurls members to
 * radius 500+).
 */
export function computeSpreadFactor(positions, nodeRadius = REFERENCE_NODE_RADIUS) {
  const target = SPREAD_MIN_RADIUS_MULT * (nodeRadius * 2);
  const current = minNearestNeighborDistance(positions);
  if (!Number.isFinite(current) || current <= 0) return 1.0;
  const raw = target / current;
  return Math.min(MAX_SPREAD_FACTOR, Math.max(1.0, raw));
}

/**
 * Pure: post-spread bounding radius — max distance from centroid to any
 * member position after applying spread_factor. Used by the camera to
 * compute fit_distance.
 */
export function computeSpreadRadius(positions, centroid, factor) {
  let maxR = 0;
  for (let i = 0; i < positions.length; i++) {
    const dx = (positions[i][0] - centroid[0]) * factor;
    const dy = (positions[i][1] - centroid[1]) * factor;
    const dz = (positions[i][2] - centroid[2]) * factor;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r > maxR) maxR = r;
  }
  return maxR;
}

class ClusterFocusMode {
  /**
   * @param {object} opts
   * @param {object} opts.nodeMesh - NodeMesh instance
   * @param {Array} opts.nodeArray - parallel array of node objects (indexed by global idx)
   * @param {boolean} [opts.reducedMotion] - test override; auto-detected from matchMedia otherwise
   */
  constructor({ nodeMesh, nodeArray, ...opts }) {
    if (!nodeMesh) throw new Error('ClusterFocusMode: nodeMesh is required');
    if (!nodeArray) throw new Error('ClusterFocusMode: nodeArray is required');
    this._nodeMesh = nodeMesh;
    this._nodeArray = nodeArray;
    this._reducedMotion = detectReducedMotion(opts);

    this._engaged = false;
    this._focusedClusterId = null;
    this._progress = 0;
    this._targetProgress = 0;

    // Lazily-allocated work buffers. Populated on engage; cleared on exit.
    this._canonicalMatrices = null; // Map<global, Float32Array of 16>
    this._spreadTargets = null;     // Map<global, [x,y,z]> (focused members only)
    this._focusedGlobals = null;    // number[]
    this._hiddenGlobals = null;     // number[]
    this._tmpMatrix = new THREE.Matrix4();
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3();
    this._tmpDummy = new THREE.Object3D();
  }

  isEngaged() { return this._engaged; }
  getFocusedClusterId() { return this._focusedClusterId; }
  getProgress() { return this._progress; }

  /**
   * Engage cluster-focus on the given numeric cluster id. Returns the
   * pre-computed centroid + spread radius so the caller can drive the
   * camera fit in parallel. Returns null when the cluster has no
   * members (no-op).
   */
  engage(focusedClusterId) {
    if (focusedClusterId == null) return null;
    if (this._engaged && this._focusedClusterId === focusedClusterId) {
      // Already engaged on this cluster — just return cached fit info.
      return this._fitInfo;
    }
    // Different cluster while engaged → reset state and re-engage cleanly.
    if (this._engaged) this._restoreCanonical();

    const focusedGlobals = [];
    const hiddenGlobals = [];
    const focusedPositions = [];
    const canonicalMatrices = new Map();

    for (let i = 0; i < this._nodeArray.length; i++) {
      const node = this._nodeArray[i];
      const m = new THREE.Matrix4();
      this._nodeMesh._getMatrixAtGlobal(i, m);
      canonicalMatrices.set(i, m);
      if (node && node.clusterId === focusedClusterId) {
        focusedGlobals.push(i);
        m.decompose(this._tmpPos, this._tmpQuat, this._tmpScale);
        focusedPositions.push([this._tmpPos.x, this._tmpPos.y, this._tmpPos.z]);
      } else {
        hiddenGlobals.push(i);
      }
    }

    if (focusedGlobals.length === 0) {
      // Cluster has no members — no-op.
      return null;
    }

    const centroid = computeCentroid(focusedPositions);
    const factor = computeSpreadFactor(focusedPositions);
    const spreadRadius = computeSpreadRadius(focusedPositions, centroid, factor);

    const spreadTargets = new Map();
    for (let k = 0; k < focusedGlobals.length; k++) {
      const i = focusedGlobals[k];
      const p = focusedPositions[k];
      spreadTargets.set(i, [
        centroid[0] + (p[0] - centroid[0]) * factor,
        centroid[1] + (p[1] - centroid[1]) * factor,
        centroid[2] + (p[2] - centroid[2]) * factor,
      ]);
    }

    this._canonicalMatrices = canonicalMatrices;
    this._spreadTargets = spreadTargets;
    this._focusedGlobals = focusedGlobals;
    this._hiddenGlobals = hiddenGlobals;
    this._focusedClusterId = focusedClusterId;
    this._engaged = true;
    this._targetProgress = 1;

    this._fitInfo = {
      centroid,
      spreadRadius,
      memberCount: focusedGlobals.length,
      spreadFactor: factor,
    };

    if (this._reducedMotion) {
      this._progress = 1;
      this._applyMatrices(1);
    }

    return this._fitInfo;
  }

  /**
   * Begin exit animation. Per-frame tick will reverse progress; once
   * progress hits 0 the canonical matrices are restored exactly and
   * `_engaged` flips false. Returns true when an exit was initiated,
   * false when not engaged.
   */
  exit() {
    if (!this._engaged) return false;
    this._targetProgress = 0;
    if (this._reducedMotion) {
      this._progress = 0;
      this._restoreCanonical();
    }
    return true;
  }

  /**
   * Per-frame tick. Returns true when a matrix update happened (the
   * caller may want to flush instanceMatrix.needsUpdate).
   */
  tickAnimation(dtSec) {
    if (!this._engaged && this._progress === 0) return false;
    if (this._reducedMotion) return false;
    if (this._progress === this._targetProgress) {
      // Exit completion: if we eased to 0, drop canonical state.
      if (this._targetProgress === 0 && this._engaged) {
        this._restoreCanonical();
      }
      return false;
    }
    const step = (dtSec * 1000) / SPREAD_DURATION_MS;
    if (this._targetProgress > this._progress) {
      this._progress = Math.min(this._targetProgress, this._progress + step);
    } else {
      this._progress = Math.max(this._targetProgress, this._progress - step);
    }
    this._applyMatrices(this._progress);
    if (this._progress === 0 && this._targetProgress === 0) {
      this._restoreCanonical();
    }
    return true;
  }

  /**
   * Write per-instance matrices for the given linear progress 0..1
   * (eased internally). Focused members lerp position toward spread
   * target; hidden members lerp scale toward zero.
   */
  _applyMatrices(progress) {
    if (!this._canonicalMatrices) return;
    const eased = easeInOutCubic(progress);
    const dummy = this._tmpDummy;
    const pos = this._tmpPos;
    const quat = this._tmpQuat;
    const scale = this._tmpScale;
    const m = this._tmpMatrix;

    // Focused-cluster members: lerp position canonical → spread target
    for (let k = 0; k < this._focusedGlobals.length; k++) {
      const i = this._focusedGlobals[k];
      m.copy(this._canonicalMatrices.get(i));
      m.decompose(pos, quat, scale);
      const target = this._spreadTargets.get(i);
      const cx = pos.x + (target[0] - pos.x) * eased;
      const cy = pos.y + (target[1] - pos.y) * eased;
      const cz = pos.z + (target[2] - pos.z) * eased;
      dummy.position.set(cx, cy, cz);
      dummy.quaternion.copy(quat);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      this._nodeMesh._setMatrixAtGlobal(i, dummy.matrix);
    }

    // Hidden (non-focused) members: lerp scale → 0. Scale=0 collapses
    // the instance to an invisible singularity. Cheaper than touching
    // the shader; raycast may still register a singular hit but the
    // collapsed sphere has no visible surface to click anyway.
    const hideScale = 1 - eased;
    for (let k = 0; k < this._hiddenGlobals.length; k++) {
      const i = this._hiddenGlobals[k];
      m.copy(this._canonicalMatrices.get(i));
      m.decompose(pos, quat, scale);
      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.set(scale.x * hideScale, scale.y * hideScale, scale.z * hideScale);
      dummy.updateMatrix();
      this._nodeMesh._setMatrixAtGlobal(i, dummy.matrix);
    }

    this._nodeMesh._markMatricesDirty();
  }

  /**
   * Restore exact canonical matrices for every node. Called when the
   * exit animation completes OR when a different cluster is engaged
   * (to avoid drift). Also clears engagement bookkeeping.
   */
  _restoreCanonical() {
    if (!this._canonicalMatrices) return;
    for (const [i, m] of this._canonicalMatrices) {
      this._nodeMesh._setMatrixAtGlobal(i, m);
    }
    this._nodeMesh._markMatricesDirty();
    this._canonicalMatrices = null;
    this._spreadTargets = null;
    this._focusedGlobals = null;
    this._hiddenGlobals = null;
    this._fitInfo = null;
    this._engaged = false;
    this._focusedClusterId = null;
    this._progress = 0;
    this._targetProgress = 0;
  }

  dispose() {
    if (this._engaged) this._restoreCanonical();
    this._nodeMesh = null;
    this._nodeArray = null;
  }
}

export default ClusterFocusMode;
