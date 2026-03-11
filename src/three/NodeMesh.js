import {
  InstancedMesh,
  SphereGeometry,
  MeshStandardMaterial,
  Matrix4,
  Vector3,
  Color,
  Object3D,
} from 'three';

const TASTE_COLORS = {
  sweet: '#ff6b9d',
  sour: '#4ecdc4',
  bitter: '#9b59b6',
  umami: '#f39c12',
  spicy: '#e74c3c',
  hot: '#e74c3c',
};

const DEFAULT_COLOR = '#4f8fff';

function getColorForNode(node) {
  const taste = (node.taste || '').toLowerCase().trim();
  for (const [key, hex] of Object.entries(TASTE_COLORS)) {
    if (taste.includes(key)) {
      return new Color(hex);
    }
  }
  return new Color(DEFAULT_COLOR);
}

class NodeMesh {
  constructor({ nodes, positions }) {
    this._nameToIndex = new Map();
    this._nodeList = [];
    this._defaultColors = [];

    const posMap = positions.positions || positions;
    const nodeArray = Array.from(nodes.values());
    const count = nodeArray.length;

    const geometry = new SphereGeometry(1, 16, 16);
    const material = new MeshStandardMaterial({
      emissive: new Color(DEFAULT_COLOR),
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.7,
      transparent: true,
      opacity: 0.9,
    });

    this._mesh = new InstancedMesh(geometry, material, count);
    this._mesh.frustumCulled = true;
    this._geometry = geometry;
    this._material = material;

    const dummy = new Object3D();
    const color = new Color();

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

  setActivation(name, intensity) {
    const index = this._nameToIndex.get(name);
    if (index === undefined) return;

    const base = this._defaultColors[index];
    const activated = base.clone().lerp(new Color('#ffffff'), intensity);
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
