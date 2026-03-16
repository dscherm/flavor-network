import {
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  ShaderMaterial,
  AdditiveBlending,
  Color,
} from 'three';

const BASE_COLOR = new Color('#1a3a5c');
const BRIGHT_COLOR = new Color('#4f8fff');

const MIN_OPACITY = 0.025;
const MAX_OPACITY = 0.2;

const edgeVertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aOpacity;

  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    vColor = aColor;
    vOpacity = aOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    gl_FragColor = vec4(vColor, vOpacity);
  }
`;

class EdgeMesh {
  constructor({ edges, positions }) {
    const posMap = positions.positions || positions;

    this._edgeList = [];
    this._nameToEdgeIndices = new Map();

    const validEdges = [];
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const srcPos = posMap[edge.source];
      const tgtPos = posMap[edge.target];
      if (!srcPos || !tgtPos) continue;
      validEdges.push({ edge, srcPos, tgtPos });
    }

    const vertexCount = validEdges.length * 2;
    const positionArray = new Float32Array(vertexCount * 3);
    const colorArray = new Float32Array(vertexCount * 3);
    const opacityArray = new Float32Array(vertexCount);

    const tmpColor = new Color();

    for (let i = 0; i < validEdges.length; i++) {
      const { edge, srcPos, tgtPos } = validEdges[i];
      const strength = edge.strength || 0;
      const vi = i * 2;

      positionArray[vi * 3] = srcPos[0];
      positionArray[vi * 3 + 1] = srcPos[1];
      positionArray[vi * 3 + 2] = srcPos[2];

      positionArray[(vi + 1) * 3] = tgtPos[0];
      positionArray[(vi + 1) * 3 + 1] = tgtPos[1];
      positionArray[(vi + 1) * 3 + 2] = tgtPos[2];

      tmpColor.copy(BASE_COLOR).lerp(BRIGHT_COLOR, strength);

      colorArray[vi * 3] = tmpColor.r;
      colorArray[vi * 3 + 1] = tmpColor.g;
      colorArray[vi * 3 + 2] = tmpColor.b;

      colorArray[(vi + 1) * 3] = tmpColor.r;
      colorArray[(vi + 1) * 3 + 1] = tmpColor.g;
      colorArray[(vi + 1) * 3 + 2] = tmpColor.b;

      const opacity = MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * strength;
      opacityArray[vi] = opacity;
      opacityArray[vi + 1] = opacity;

      this._edgeList.push({
        source: edge.source,
        target: edge.target,
        strength,
        vertexIndex: vi,
      });

      const edgeIndex = this._edgeList.length - 1;

      if (!this._nameToEdgeIndices.has(edge.source)) {
        this._nameToEdgeIndices.set(edge.source, []);
      }
      this._nameToEdgeIndices.get(edge.source).push(edgeIndex);

      if (!this._nameToEdgeIndices.has(edge.target)) {
        this._nameToEdgeIndices.set(edge.target, []);
      }
      this._nameToEdgeIndices.get(edge.target).push(edgeIndex);
    }

    this._geometry = new BufferGeometry();
    this._geometry.setAttribute('position', new Float32BufferAttribute(positionArray, 3));
    this._geometry.setAttribute('aColor', new Float32BufferAttribute(colorArray, 3));
    this._geometry.setAttribute('aOpacity', new Float32BufferAttribute(opacityArray, 1));

    this._defaultColors = new Float32Array(colorArray);
    this._defaultOpacities = new Float32Array(opacityArray);

    this._material = new ShaderMaterial({
      vertexShader: edgeVertexShader,
      fragmentShader: edgeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this._mesh = new LineSegments(this._geometry, this._material);
  }

  getMesh() {
    return this._mesh;
  }

  /**
   * Dim all edges to near-invisible.
   */
  dimAll() {
    const opacityAttr = this._geometry.getAttribute('aOpacity');
    const colorAttr = this._geometry.getAttribute('aColor');

    for (let i = 0; i < opacityAttr.count; i++) {
      opacityAttr.setX(i, 0.01);
      colorAttr.setXYZ(i, 0.04, 0.04, 0.06);
    }

    opacityAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  highlightEdgesFor(name, intensity) {
    const indices = this._nameToEdgeIndices.get(name);
    if (!indices) return;

    const colorAttr = this._geometry.getAttribute('aColor');
    const opacityAttr = this._geometry.getAttribute('aOpacity');
    const tmpColor = new Color();

    for (let i = 0; i < indices.length; i++) {
      const edgeInfo = this._edgeList[indices[i]];
      const vi = edgeInfo.vertexIndex;

      tmpColor.copy(BASE_COLOR).lerp(BRIGHT_COLOR, edgeInfo.strength);
      tmpColor.lerp(new Color('#ffffff'), intensity * 0.6);

      colorAttr.setXYZ(vi, tmpColor.r, tmpColor.g, tmpColor.b);
      colorAttr.setXYZ(vi + 1, tmpColor.r, tmpColor.g, tmpColor.b);

      const baseOpacity = MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * edgeInfo.strength;
      const highlightOpacity = Math.min(1.0, baseOpacity + intensity * 0.6);
      opacityAttr.setX(vi, highlightOpacity);
      opacityAttr.setX(vi + 1, highlightOpacity);
    }

    colorAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  }

  resetHighlights() {
    const colorAttr = this._geometry.getAttribute('aColor');
    const opacityAttr = this._geometry.getAttribute('aOpacity');

    colorAttr.array.set(this._defaultColors);
    opacityAttr.array.set(this._defaultOpacities);

    colorAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  }

  /**
   * Apply profile weights — brighten edges between high-weight nodes, dim the rest.
   * @param {Map<string, number>} weights - ingredient name → normalized weight (0–1)
   */
  applyProfileWeights(weights) {
    const colorAttr = this._geometry.getAttribute('aColor');
    const opacityAttr = this._geometry.getAttribute('aOpacity');
    const tmpColor = new Color();
    const dimColor = new Color('#060610');

    for (let i = 0; i < this._edgeList.length; i++) {
      const edge = this._edgeList[i];
      const vi = edge.vertexIndex;
      const srcW = weights.get(edge.source) || 0;
      const tgtW = weights.get(edge.target) || 0;

      // Edge relevance = average of endpoint weights
      const edgeWeight = (srcW + tgtW) / 2;

      if (edgeWeight > 0) {
        tmpColor.copy(BASE_COLOR).lerp(BRIGHT_COLOR, edge.strength);
        tmpColor.lerp(new Color('#ffffff'), edgeWeight * 0.4);

        colorAttr.setXYZ(vi, tmpColor.r, tmpColor.g, tmpColor.b);
        colorAttr.setXYZ(vi + 1, tmpColor.r, tmpColor.g, tmpColor.b);

        const baseOpacity = MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * edge.strength;
        const boostedOpacity = Math.min(0.8, baseOpacity + edgeWeight * 0.4);
        opacityAttr.setX(vi, boostedOpacity);
        opacityAttr.setX(vi + 1, boostedOpacity);
      } else {
        colorAttr.setXYZ(vi, dimColor.r, dimColor.g, dimColor.b);
        colorAttr.setXYZ(vi + 1, dimColor.r, dimColor.g, dimColor.b);
        opacityAttr.setX(vi, 0.01);
        opacityAttr.setX(vi + 1, 0.01);
      }
    }

    colorAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  }

  /**
   * Filter edges — only show edges where both endpoints are in the active set.
   * @param {Set<string>} activeNames - set of ingredient names that pass the filter
   */
  applyFilter(activeNames) {
    const colorAttr = this._geometry.getAttribute('aColor');
    const opacityAttr = this._geometry.getAttribute('aOpacity');
    const dimColor = new Color('#060610');

    for (let i = 0; i < this._edgeList.length; i++) {
      const edge = this._edgeList[i];
      const vi = edge.vertexIndex;
      const bothMatch = activeNames.has(edge.source) && activeNames.has(edge.target);

      if (bothMatch) {
        // Restore default
        colorAttr.setXYZ(vi, this._defaultColors[vi * 3], this._defaultColors[vi * 3 + 1], this._defaultColors[vi * 3 + 2]);
        colorAttr.setXYZ(vi + 1, this._defaultColors[(vi + 1) * 3], this._defaultColors[(vi + 1) * 3 + 1], this._defaultColors[(vi + 1) * 3 + 2]);
        opacityAttr.setX(vi, this._defaultOpacities[vi]);
        opacityAttr.setX(vi + 1, this._defaultOpacities[vi + 1]);
      } else {
        colorAttr.setXYZ(vi, dimColor.r, dimColor.g, dimColor.b);
        colorAttr.setXYZ(vi + 1, dimColor.r, dimColor.g, dimColor.b);
        opacityAttr.setX(vi, 0.01);
        opacityAttr.setX(vi + 1, 0.01);
      }
    }

    colorAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  }

  setVisible(visible) {
    this._mesh.visible = visible;
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
    this._edgeList = [];
    this._nameToEdgeIndices.clear();
    this._defaultColors = null;
    this._defaultOpacities = null;
  }
}

export default EdgeMesh;
