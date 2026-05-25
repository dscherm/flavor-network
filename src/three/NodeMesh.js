import * as THREE from 'three';
import {
  InstancedMesh,
  Color,
  Object3D,
} from 'three';
import {
  buildShapeGeometries,
  buildShapeEdgeGeometries,
  SHAPE_KEYS,
} from './Geometries.js';
import { BRISCIONE_AROMA } from '../data/briscionePalette.js';

const CUISINE_COLORS = {
  'french cuisine': '#e63946',
  'italian cuisine': '#2a9d8f',
  'chinese cuisine': '#e9c46a',
  'japanese cuisine': '#f4a261',
  'indian cuisine': '#e76f51',
  'mexican cuisine': '#06d6a0',
  'thai cuisine': '#118ab2',
  'mediterranean cuisine': '#ef476f',
  'american cuisine': '#ffd166',
  'spanish cuisine': '#d62828',
  'korean cuisine': '#7209b7',
  'vietnamese cuisine': '#4cc9f0',
  'greek cuisine': '#3a86ff',
  'moroccan cuisine': '#fb5607',
  'middle eastern cuisine': '#ff006e',
  'african cuisine': '#8338ec',
  'caribbean cuisine': '#06d6a0',
  'german cuisine': '#ffbe0b',
  'british cuisine': '#3f88c5',
  'scandinavian cuisine': '#80ced6',
};

// Taste → color mapping. Order matters: more specific compound tastes first,
// then single-word tastes, so "sour-sweet" matches "sour" before "sweet".
const TASTE_COLORS = {
  pungent: '#e67e22',
  astringent: '#1abc9c',
  salty: '#3498db',
  sour: '#4ecdc4',
  bitter: '#9b59b6',
  umami: '#f39c12',
  hot: '#e74c3c',
  spicy: '#e74c3c',
  sweet: '#ff6b9d',
};

const DEFAULT_COLOR = '#4f8fff';

// Taste filter aliases — when filtering by one of these keys,
// also match the other keys in the same group.
const TASTE_ALIASES = {
  spicy: ['spicy', 'hot'],
  hot: ['spicy', 'hot'],
  pungent: ['pungent'],
  umami: ['umami'],
  astringent: ['astringent'],
};

/**
 * Check if an ingredient's taste matches a filter key.
 * Handles aliases (e.g., "spicy" also matches "hot").
 */
export function tasteMatches(nodeTaste, filterKey) {
  if (!nodeTaste || !filterKey) return false;
  const tasteLower = nodeTaste.toLowerCase();
  const aliases = TASTE_ALIASES[filterKey.toLowerCase()];
  if (aliases) {
    return aliases.some(alias => tasteLower.includes(alias));
  }
  return tasteLower.includes(filterKey.toLowerCase());
}

const UNCERTAINTY_TINT = new Color(0xcc8899);
const UNCERTAINTY_MAX_BLEND = 0.5;

function _applyUncertainty(baseColor, node) {
  const e = node && typeof node.gnnEntropy === 'number' ? node.gnnEntropy : null;
  if (e == null) return baseColor;
  const t = Math.max(0, Math.min(1, e)) * UNCERTAINTY_MAX_BLEND;
  return baseColor.clone().lerp(UNCERTAINTY_TINT, t);
}

function getColorForNode(node) {
  let base;
  // Canonical-spec §3.1 color precedence (post N1-D5 swap, 2026-05-25):
  //   1. Filter-bucket → handled at LivingArchView's palette layer
  //      before this function is hit (overrides per-node logic entirely)
  //   2. node.primaryTier1Aroma (BRISCIONE_AROMA) — chef T1[0] OR
  //      GNN-derived above calibrated threshold. Wins over cluster so
  //      the 5-aroma palette reads as the primary color semantic.
  //   3. node.clusterColor (v3 cluster palette) — defensive fallback
  //      when no T1 is derivable (long-tail without GNN coverage or
  //      compound foods with no Tier1).
  //   4. taste blending
  //   5. neutral gray fallback (set at useProData pre-pass for nodes
  //      outside the v3 universe)
  const tier1 = node?.primaryTier1Aroma;
  if (tier1 && BRISCIONE_AROMA[tier1]) {
    base = new Color(BRISCIONE_AROMA[tier1]);
    return _applyUncertainty(base, node);
  }
  if (node?.clusterColor) {
    base = new Color(node.clusterColor);
    return _applyUncertainty(base, node);
  }
  const taste = (node.taste || '').toLowerCase().trim();
  if (taste) {
    const matchedColors = [];
    for (const [key, hex] of Object.entries(TASTE_COLORS)) {
      if (taste.includes(key)) {
        matchedColors.push(new Color(hex));
      }
    }
    if (matchedColors.length === 1) {
      base = matchedColors[0];
    } else if (matchedColors.length >= 2) {
      const blended = matchedColors[0].clone();
      for (let i = 1; i < matchedColors.length; i++) {
        blended.lerp(matchedColors[i], 1 / (i + 1));
      }
      base = blended;
    }
  }

  if (!base) {
    if (node.cuisines && node.cuisines.length > 0) {
      for (const cuisine of node.cuisines) {
        const hex = CUISINE_COLORS[cuisine.toLowerCase()];
        if (hex) { base = new Color(hex); break; }
      }
      if (!base) {
        const hash = node.cuisines[0].split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        base = new Color().setHSL((hash % 360) / 360, 0.7, 0.55);
      }
    } else {
      base = new Color(DEFAULT_COLOR);
    }
  }

  return _applyUncertainty(base, node);
}

export { getColorForNode };

/**
 * NodeMesh manages the GPU representation of every ingredient/cocktail
 * /sauce node in a 3D view.
 *
 * Default mode (no `shapeAssignments`): one InstancedMesh of spheres.
 * Identical to the original single-shape behavior — every consumer that
 * was working before this multi-shape refactor still works unchanged.
 *
 * Multi-shape mode (`shapeAssignments` provided as Map<name,shapeKey>
 * or plain object): one InstancedMesh per shape, all wrapped in a
 * THREE.Group. Per-mesh `userData.globalIndices` lets the SceneManager
 * raycaster translate (mesh, instanceId) hits back into the global
 * 0..count-1 index space the rest of the app expects.
 */
class NodeMesh {
  constructor({
    nodes,
    positions,
    shapeAssignments = null,
    scaleMultiplier = 1.0,
    showOutlines = null, // null → auto: on in multi-shape mode, off otherwise
  }) {
    this._scaleMultiplier = scaleMultiplier;
    const posMap = positions.positions || positions;
    const nodeArray = Array.from(nodes.values());
    const count = nodeArray.length;

    // Identity tables, parallel to global index 0..count-1.
    this._nodeList = nodeArray;
    this._nameToIndex = new Map();
    for (let i = 0; i < count; i++) this._nameToIndex.set(nodeArray[i].name, i);
    this._defaultColors = new Array(count);

    // Resolve a shape key for each node. Unknown / missing → 'sphere'.
    const shapeOf = new Array(count);
    if (shapeAssignments) {
      const has = typeof shapeAssignments.get === 'function';
      for (let i = 0; i < count; i++) {
        const name = nodeArray[i].name;
        const k = has ? shapeAssignments.get(name) : shapeAssignments[name];
        shapeOf[i] = (k && SHAPE_KEYS.includes(k)) ? k : 'sphere';
      }
    } else {
      shapeOf.fill('sphere');
    }
    this._shapeByGlobal = shapeOf;

    // Group global indices by shape.
    const indicesByShape = new Map();
    for (let i = 0; i < count; i++) {
      const k = shapeOf[i];
      let arr = indicesByShape.get(k);
      if (!arr) { arr = []; indicesByShape.set(k, arr); }
      arr.push(i);
    }

    // Allocate only the geometries we actually use; release the rest.
    const allGeos = buildShapeGeometries();
    this._geometries = {};
    for (const k of indicesByShape.keys()) this._geometries[k] = allGeos[k];
    for (const [k, g] of Object.entries(allGeos)) {
      if (!indicesByShape.has(k)) g.dispose();
    }

    this._material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    // Build one InstancedMesh per used shape, wrapped in a Group.
    this._group = new THREE.Group();
    this._meshByShape = new Map();
    this._localIdxByGlobal = new Array(count);

    const dummy = new Object3D();
    for (const [shapeKey, indices] of indicesByShape) {
      const geo = this._geometries[shapeKey];
      const mesh = new InstancedMesh(geo, this._material, indices.length);
      mesh.frustumCulled = true;
      // SceneManager._raycast uses these to translate localIdx → globalIdx
      // when the raycast target is a Group of multiple meshes.
      mesh.userData.globalIndices = indices.slice();
      mesh.userData.shapeKey = shapeKey;
      this._meshByShape.set(shapeKey, mesh);
      this._group.add(mesh);

      for (let local = 0; local < indices.length; local++) {
        const global = indices[local];
        const node = nodeArray[global];
        this._localIdxByGlobal[global] = local;

        const pos = posMap[node.name];
        if (pos) dummy.position.set(pos[0], pos[1], pos[2]);
        else dummy.position.set(0, 0, 0);
        const s = this._baseScaleFor(node);
        dummy.scale.set(s, s, s);
        dummy.quaternion.identity();
        dummy.updateMatrix();
        mesh.setMatrixAt(local, dummy.matrix);

        const c = getColorForNode(node);
        this._defaultColors[global] = c.clone();
        mesh.setColorAt(local, c);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Edge-outline overlay: structural ridges per shape, baked into one
    // merged LineSegments per shape so flat-faced polyhedra (cube,
    // octahedron, etc.) read distinctly even at small viewing scale.
    // Auto-enabled in multi-shape mode; off by default for the main
    // single-sphere Network view (where wireframe noise hurts).
    const enableOutlines = (showOutlines === null || showOutlines === undefined)
      ? (this._meshByShape.size > 1)
      : Boolean(showOutlines);
    this._edgeGeometries = null;
    this._edgeMeshByShape = null;
    if (enableOutlines) this._buildOutlines(indicesByShape, nodeArray);

    // Always expose the Group as the scene-graph node. Avoids a double-
    // parent warning in single-shape mode where the lone InstancedMesh
    // would otherwise be both a child of `_group` AND added directly to
    // the scene by the consumer. SceneManager._raycast handles Groups
    // by intersecting children and translating local→global indices via
    // `userData.globalIndices`.
    this._mesh = this._group;
  }

  /**
   * Bake one merged THREE.LineSegments per shape, transforming the
   * shape's EdgesGeometry vertices by each instance's matrix. The
   * result reads as crisp glow-edges over the filled mesh, making
   * silhouettes (cube vs. octahedron, dodecahedron vs. icosahedron)
   * legible at small node sizes.
   *
   * Edges are STATIC after construction — fine for the cocktail/sauce
   * codex (positions don't move). If a future caller starts mutating
   * instance matrices (e.g. profile-weight scaling on a multi-shape
   * mesh), call `_rebuildOutlines()` after the matrix changes.
   */
  _buildOutlines(indicesByShape, nodeArray) {
    void nodeArray; // reserved for future per-instance edge styling
    this._edgeGeometries = buildShapeEdgeGeometries(this._geometries);
    this._edgeMeshByShape = new Map();

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this._edgeMaterial = edgeMaterial;

    const tmp = new THREE.Vector3();
    const m4 = new THREE.Matrix4();

    for (const [shapeKey, indices] of indicesByShape) {
      const edgeGeo = this._edgeGeometries[shapeKey];
      if (!edgeGeo) continue;
      const baseEdges = edgeGeo.attributes.position.array;
      const segVerts = baseEdges.length / 3; // total vertex count (pairs of two per segment)
      if (segVerts === 0) {
        // Smooth shape with no surviving edges (e.g. sphere). Skip.
        continue;
      }
      const totalVerts = segVerts * indices.length;
      const out = new Float32Array(totalVerts * 3);

      const instMesh = this._meshByShape.get(shapeKey);
      const instArray = instMesh.instanceMatrix.array;

      let outIdx = 0;
      for (let i = 0; i < indices.length; i++) {
        m4.fromArray(instArray, i * 16);
        for (let v = 0; v < segVerts; v++) {
          tmp.set(
            baseEdges[v * 3],
            baseEdges[v * 3 + 1],
            baseEdges[v * 3 + 2],
          );
          tmp.applyMatrix4(m4);
          out[outIdx++] = tmp.x;
          out[outIdx++] = tmp.y;
          out[outIdx++] = tmp.z;
        }
      }

      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
      const lines = new THREE.LineSegments(merged, edgeMaterial);
      lines.frustumCulled = true;
      // Outlines are visual-only — don't intercept raycasts that should
      // hit the filled mesh underneath.
      lines.userData.skipRaycast = true;
      this._edgeMeshByShape.set(shapeKey, lines);
      this._group.add(lines);
    }
  }

  /**
   * The renderable Object3D for `manager.addToScene()` and
   * `manager.setRaycastTarget()`. Always a THREE.Group — single-shape
   * mode wraps a single InstancedMesh; multi-shape mode wraps several.
   */
  getMesh() {
    return this._group;
  }

  getNodeAtIndex(global) {
    if (global < 0 || global >= this._nodeList.length) return null;
    return this._nodeList[global];
  }

  getIndexForName(name) {
    const idx = this._nameToIndex.get(name);
    return idx !== undefined ? idx : -1;
  }

  // ─── internal helpers ───────────────────────────────────────

  /**
   * Compute the base instance scale for a node from its pairing count,
   * clamped to [0.3, 2.0] then multiplied by the per-view scale
   * multiplier (default 1.0). The Cocktail/Sauce labs pass a higher
   * multiplier so the per-shape geometry is large enough to read.
   */
  _baseScaleFor(node) {
    const pc = node.pairingCount || 0;
    const boost = (typeof node.scaleBoost === 'number' && node.scaleBoost > 0) ? node.scaleBoost : 1.0;
    return Math.max(0.3, Math.min(2.0, Math.sqrt(pc) * 0.15)) * this._scaleMultiplier * boost;
  }

  // ─── internal mesh routing ──────────────────────────────────

  _meshAndLocalFor(global) {
    const k = this._shapeByGlobal[global];
    const mesh = this._meshByShape.get(k);
    const local = this._localIdxByGlobal[global];
    return { mesh, local };
  }

  _markColorsDirty() {
    for (const mesh of this._meshByShape.values()) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  _markMatricesDirty() {
    for (const mesh of this._meshByShape.values()) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  _setColorAtGlobal(global, color) {
    const { mesh, local } = this._meshAndLocalFor(global);
    if (mesh) mesh.setColorAt(local, color);
  }

  _setMatrixAtGlobal(global, matrix) {
    const { mesh, local } = this._meshAndLocalFor(global);
    if (mesh) mesh.setMatrixAt(local, matrix);
  }

  _getMatrixAtGlobal(global, target) {
    const { mesh, local } = this._meshAndLocalFor(global);
    if (mesh) mesh.getMatrixAt(local, target);
    return target;
  }

  // ─── public mutators ────────────────────────────────────────

  /**
   * Dim all nodes to near-invisible. Call before setActivation to make
   * a selected sub-network pop.
   */
  dimAll() {
    for (let i = 0; i < this._nodeList.length; i++) {
      const dimmed = this._defaultColors[i].clone().multiplyScalar(0.15);
      this._setColorAtGlobal(i, dimmed);
    }
    this._markColorsDirty();
  }

  setActivation(name, intensity) {
    const i = this._nameToIndex.get(name);
    if (i === undefined) return;
    const base = this._defaultColors[i];
    const activated = base.clone().lerp(new Color('#ffffff'), intensity * 0.6);
    this._setColorAtGlobal(i, activated);
    this._markColorsDirty();
  }

  resetActivations() {
    for (let i = 0; i < this._defaultColors.length; i++) {
      this._setColorAtGlobal(i, this._defaultColors[i]);
    }
    this._markColorsDirty();
  }

  /**
   * Filter nodes by cuisine/taste or by explicit name set. Non-matching
   * nodes get dimmed.
   */
  applyFilter(filter, activeNames) {
    const dimColor = new Color('#111118');
    for (let i = 0; i < this._nodeList.length; i++) {
      const node = this._nodeList[i];
      let matches;
      if (activeNames) {
        matches = activeNames.has(node.name);
      } else {
        matches = true;
        const cuisine = filter?.cuisine;
        const taste = filter?.taste;
        if (cuisine) {
          matches = matches && node.cuisines && node.cuisines.some(
            c => c.toLowerCase().includes(cuisine.toLowerCase())
          );
        }
        if (taste) {
          matches = matches && tasteMatches(node.taste, taste);
        }
      }
      this._setColorAtGlobal(i, matches ? this._defaultColors[i] : dimColor);
    }
    this._markColorsDirty();
  }

  /**
   * Apply profile weights — scale node size and brightness by personal
   * weight. Nodes with weight 0 get dimmed; higher weight = larger +
   * brighter.
   */
  applyProfileWeights(weights) {
    const dummy = new Object3D();
    const dimColor = new Color('#0d0d15');

    for (let i = 0; i < this._nodeList.length; i++) {
      const node = this._nodeList[i];
      const w = weights.get(node.name) || 0;

      if (w > 0) {
        const brightened = this._defaultColors[i].clone().lerp(new Color('#ffffff'), w * 0.35);
        this._setColorAtGlobal(i, brightened);
      } else {
        this._setColorAtGlobal(i, dimColor);
      }

      this._getMatrixAtGlobal(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const baseScale = this._baseScaleFor(node);
      const scaleMult = w > 0 ? 1.0 + w * 0.8 : 0.6;
      const s = baseScale * scaleMult;
      dummy.scale.set(s, s, s);

      dummy.updateMatrix();
      this._setMatrixAtGlobal(i, dummy.matrix);
    }

    this._markMatricesDirty();
    this._markColorsDirty();
  }

  resetProfileWeights() {
    const dummy = new Object3D();

    for (let i = 0; i < this._nodeList.length; i++) {
      const node = this._nodeList[i];

      this._getMatrixAtGlobal(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const s = this._baseScaleFor(node);
      dummy.scale.set(s, s, s);

      dummy.updateMatrix();
      this._setMatrixAtGlobal(i, dummy.matrix);

      this._setColorAtGlobal(i, this._defaultColors[i]);
    }

    this._markMatricesDirty();
    this._markColorsDirty();
  }

  dispose() {
    if (this._geometries) {
      for (const g of Object.values(this._geometries)) {
        if (g && typeof g.dispose === 'function') g.dispose();
      }
      this._geometries = null;
    }
    if (this._edgeGeometries) {
      for (const g of Object.values(this._edgeGeometries)) {
        if (g && typeof g.dispose === 'function') g.dispose();
      }
      this._edgeGeometries = null;
    }
    if (this._edgeMeshByShape) {
      for (const lines of this._edgeMeshByShape.values()) {
        if (lines.geometry && typeof lines.geometry.dispose === 'function') {
          lines.geometry.dispose();
        }
      }
      this._edgeMeshByShape = null;
    }
    if (this._edgeMaterial) {
      this._edgeMaterial.dispose();
      this._edgeMaterial = null;
    }
    if (this._material) {
      this._material.dispose();
      this._material = null;
    }
    if (this._group) {
      while (this._group.children.length > 0) {
        this._group.remove(this._group.children[0]);
      }
      this._group = null;
    }
    this._meshByShape = null;
    this._mesh = null;
    this._nameToIndex.clear();
    this._nodeList = [];
    this._defaultColors = [];
    this._localIdxByGlobal = null;
    this._shapeByGlobal = null;
  }
}

export default NodeMesh;
