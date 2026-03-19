import * as THREE from 'three';
import {
  InstancedMesh,
  SphereGeometry,
  Color,
  Object3D,
} from 'three';

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

function getColorForNode(node) {
  // Primary: color by taste profile — supports multi-taste blending
  const taste = (node.taste || '').toLowerCase().trim();
  if (taste) {
    const matchedColors = [];
    for (const [key, hex] of Object.entries(TASTE_COLORS)) {
      if (taste.includes(key)) {
        matchedColors.push(new Color(hex));
      }
    }
    if (matchedColors.length === 1) {
      return matchedColors[0];
    }
    if (matchedColors.length >= 2) {
      // Blend all matched colors equally
      const blended = matchedColors[0].clone();
      for (let i = 1; i < matchedColors.length; i++) {
        blended.lerp(matchedColors[i], 1 / (i + 1));
      }
      return blended;
    }
  }

  // Fallback: color by first cuisine
  if (node.cuisines && node.cuisines.length > 0) {
    for (const cuisine of node.cuisines) {
      const hex = CUISINE_COLORS[cuisine.toLowerCase()];
      if (hex) return new Color(hex);
    }
    const hash = node.cuisines[0].split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return new Color().setHSL((hash % 360) / 360, 0.7, 0.55);
  }

  return new Color(DEFAULT_COLOR);
}

export { getColorForNode };

class NodeMesh {
  constructor({ nodes, positions }) {
    this._nameToIndex = new Map();
    this._nodeList = [];
    this._defaultColors = [];

    const posMap = positions.positions || positions;
    const nodeArray = Array.from(nodes.values());
    const count = nodeArray.length;

    const geometry = new SphereGeometry(1, 16, 16);

    // Use MeshBasicMaterial so instance colors show directly without lighting dependency
    // Combined with bloom post-processing, this gives the glowing neural look
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    this._mesh = new InstancedMesh(geometry, material, count);
    this._mesh.frustumCulled = true;
    this._geometry = geometry;
    this._material = material;

    const dummy = new Object3D();

    for (let i = 0; i < count; i++) {
      const node = nodeArray[i];
      const name = node.name;

      this._nameToIndex.set(name, i);
      this._nodeList.push(node);

      const pos = posMap[name];
      if (pos) {
        dummy.position.set(pos[0], pos[1], pos[2]);
      } else {
        dummy.position.set(0, 0, 0);
      }

      const pairingCount = node.pairingCount || 0;
      const s = Math.max(0.3, Math.min(2.0, Math.sqrt(pairingCount) * 0.15));
      dummy.scale.set(s, s, s);

      dummy.updateMatrix();
      this._mesh.setMatrixAt(i, dummy.matrix);

      const nodeColor = getColorForNode(node);
      this._defaultColors.push(nodeColor.clone());
      this._mesh.setColorAt(i, nodeColor);
    }

    this._mesh.instanceMatrix.needsUpdate = true;
    if (this._mesh.instanceColor) {
      this._mesh.instanceColor.needsUpdate = true;
    }
  }

  getMesh() {
    return this._mesh;
  }

  getNodeAtIndex(index) {
    if (index < 0 || index >= this._nodeList.length) return null;
    return this._nodeList[index];
  }

  getIndexForName(name) {
    const idx = this._nameToIndex.get(name);
    return idx !== undefined ? idx : -1;
  }

  /**
   * Dim all nodes to near-invisible. Call before setActivation to make selected network pop.
   */
  dimAll() {
    for (let i = 0; i < this._nodeList.length; i++) {
      const base = this._defaultColors[i];
      const dimmed = base.clone().multiplyScalar(0.15);
      this._mesh.setColorAt(i, dimmed);
    }
    if (this._mesh.instanceColor) {
      this._mesh.instanceColor.needsUpdate = true;
    }
  }

  setActivation(name, intensity) {
    const index = this._nameToIndex.get(name);
    if (index === undefined) return;

    // Restore original color and brighten based on intensity
    const base = this._defaultColors[index];
    const activated = base.clone().lerp(new Color('#ffffff'), intensity * 0.6);
    this._mesh.setColorAt(index, activated);

    if (this._mesh.instanceColor) {
      this._mesh.instanceColor.needsUpdate = true;
    }
  }

  resetActivations() {
    for (let i = 0; i < this._defaultColors.length; i++) {
      this._mesh.setColorAt(i, this._defaultColors[i]);
    }
    if (this._mesh.instanceColor) {
      this._mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Filter nodes by cuisine/taste or by explicit name set. Non-matching nodes get dimmed.
   * @param {{ cuisine?: string, taste?: string }|null} filter - Cuisine/taste filter object
   * @param {Set<string>} [activeNames] - If provided, only these ingredient names pass the filter
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

      if (matches) {
        this._mesh.setColorAt(i, this._defaultColors[i]);
      } else {
        this._mesh.setColorAt(i, dimColor);
      }
    }

    if (this._mesh.instanceColor) {
      this._mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Apply profile weights — scale node size and brightness by personal weight.
   * Nodes with weight 0 get dimmed; higher weight = larger + brighter.
   * @param {Map<string, number>} weights - ingredient name → normalized weight (0–1)
   */
  applyProfileWeights(weights) {
    const dummy = new Object3D();
    const dimColor = new Color('#0d0d15');

    for (let i = 0; i < this._nodeList.length; i++) {
      const node = this._nodeList[i];
      const w = weights.get(node.name) || 0;

      // Update color: dim unweighted, brighten weighted
      if (w > 0) {
        const base = this._defaultColors[i];
        const brightened = base.clone().lerp(new Color('#ffffff'), w * 0.35);
        this._mesh.setColorAt(i, brightened);
      } else {
        this._mesh.setColorAt(i, dimColor);
      }

      // Update scale: base scale from pairing count, boosted by weight
      this._mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const pairingCount = node.pairingCount || 0;
      const baseScale = Math.max(0.3, Math.min(2.0, Math.sqrt(pairingCount) * 0.15));
      const scaleMult = w > 0 ? 1.0 + w * 0.8 : 0.6;
      const s = baseScale * scaleMult;
      dummy.scale.set(s, s, s);

      dummy.updateMatrix();
      this._mesh.setMatrixAt(i, dummy.matrix);
    }

    this._mesh.instanceMatrix.needsUpdate = true;
    if (this._mesh.instanceColor) {
      this._mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Reset node sizes back to defaults (undo profile weight scaling).
   */
  resetProfileWeights() {
    const dummy = new Object3D();

    for (let i = 0; i < this._nodeList.length; i++) {
      const node = this._nodeList[i];

      this._mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const pairingCount = node.pairingCount || 0;
      const s = Math.max(0.3, Math.min(2.0, Math.sqrt(pairingCount) * 0.15));
      dummy.scale.set(s, s, s);

      dummy.updateMatrix();
      this._mesh.setMatrixAt(i, dummy.matrix);

      this._mesh.setColorAt(i, this._defaultColors[i]);
    }

    this._mesh.instanceMatrix.needsUpdate = true;
    if (this._mesh.instanceColor) {
      this._mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    if (this._geometry) {
      this._geometry.dispose();
      this._geometry = null;
    }
    if (this._material) {
      this._material.dispose();
      this._material = null;
    }
    this._mesh = null;
    this._nameToIndex.clear();
    this._nodeList = [];
    this._defaultColors = [];
  }
}

export default NodeMesh;
