import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  Color,
} from 'three';

import { createParticleMaterial } from './ShaderMaterials.js';
import { getColorForNode } from './NodeMesh.js';

const STRENGTH_THRESHOLD = 0.3;
const BASE_SPEED = 0.15;
const MAX_SPEED = 0.6;

class ParticleSystem {
  /**
   * @param {Object} opts
   * @param {Array<{source: string, target: string, strength: number}>} opts.edges
   * @param {Object} opts.positions - either { positions: { name: [x,y,z] } } or flat { name: [x,y,z] }
   * @param {Map} [opts.nodes] - graph nodes map for color lookup
   * @param {number} [opts.particlesPerEdge=2]
   */
  constructor({ edges, positions, nodes, particlesPerEdge = 2 }) {
    const posMap = positions.positions || positions;

    this._particles = [];
    const particleColors = [];
    const defaultColor = new Color(0x4f8fff);

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const strength = edge.strength || 0;
      if (strength <= STRENGTH_THRESHOLD) continue;

      const srcPos = posMap[edge.source];
      const tgtPos = posMap[edge.target];
      if (!srcPos || !tgtPos) continue;

      const speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * strength;

      // Get color from source node — particle inherits the source ingredient's color
      let color = defaultColor;
      if (nodes) {
        const srcNode = nodes.get(edge.source);
        if (srcNode) {
          color = getColorForNode(srcNode);
        }
      }

      for (let p = 0; p < particlesPerEdge; p++) {
        this._particles.push({
          source: edge.source,
          target: edge.target,
          srcX: srcPos[0],
          srcY: srcPos[1],
          srcZ: srcPos[2],
          tgtX: tgtPos[0],
          tgtY: tgtPos[1],
          tgtZ: tgtPos[2],
          progress: p / particlesPerEdge,
          speed,
        });
        particleColors.push(color.r, color.g, color.b);
      }
    }

    const count = this._particles.length;
    const positionArray = new Float32Array(count * 3);
    const opacityArray = new Float32Array(count);
    const colorArray = new Float32Array(particleColors);

    for (let i = 0; i < count; i++) {
      const pt = this._particles[i];
      const t = pt.progress;
      positionArray[i * 3] = pt.srcX + (pt.tgtX - pt.srcX) * t;
      positionArray[i * 3 + 1] = pt.srcY + (pt.tgtY - pt.srcY) * t;
      positionArray[i * 3 + 2] = pt.srcZ + (pt.tgtZ - pt.srcZ) * t;
      opacityArray[i] = this._computeOpacity(t);
    }

    this._geometry = new BufferGeometry();
    this._geometry.setAttribute('position', new Float32BufferAttribute(positionArray, 3));
    this._geometry.setAttribute('aOpacity', new Float32BufferAttribute(opacityArray, 1));
    this._geometry.setAttribute('aColor', new Float32BufferAttribute(colorArray, 3));
    this._defaultColors = new Float32Array(colorArray);

    this._material = createParticleMaterial();

    this._mesh = new Points(this._geometry, this._material);
    this._mesh.frustumCulled = false;
  }

  /**
   * Compute per-particle opacity that fades near the endpoints for a smoother look.
   * @param {number} t - progress 0..1
   * @returns {number}
   */
  _computeOpacity(t) {
    const fade = Math.min(t, 1.0 - t) * 4.0;
    return Math.min(fade, 1.0);
  }

  /**
   * Returns the THREE.Points object to add to the scene.
   * @returns {Points}
   */
  getMesh() {
    return this._mesh;
  }

  /**
   * Advance all particle positions along their edges.
   * @param {number} deltaTime - seconds since last frame
   */
  update(deltaTime) {
    const posAttr = this._geometry.getAttribute('position');
    const opacityAttr = this._geometry.getAttribute('aOpacity');
    const particles = this._particles;
    const count = particles.length;

    for (let i = 0; i < count; i++) {
      const pt = particles[i];

      pt.progress += pt.speed * deltaTime;
      if (pt.progress >= 1.0) {
        pt.progress -= Math.floor(pt.progress);
      }

      const t = pt.progress;
      posAttr.array[i * 3] = pt.srcX + (pt.tgtX - pt.srcX) * t;
      posAttr.array[i * 3 + 1] = pt.srcY + (pt.tgtY - pt.srcY) * t;
      posAttr.array[i * 3 + 2] = pt.srcZ + (pt.tgtZ - pt.srcZ) * t;

      opacityAttr.array[i] = this._computeOpacity(t);
    }

    posAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  }

  /**
   * Dim all particles to near-invisible.
   */
  dimAll() {
    const colorAttr = this._geometry.getAttribute('aColor');
    for (let i = 0; i < colorAttr.count; i++) {
      colorAttr.setXYZ(i, 0.02, 0.02, 0.03);
    }
    colorAttr.needsUpdate = true;
    this._dimmed = true;
  }

  /**
   * Brighten only particles connected to the given ingredient.
   */
  highlightFor(name) {
    if (!this._defaultColors) return;
    const colorAttr = this._geometry.getAttribute('aColor');

    for (let i = 0; i < this._particles.length; i++) {
      const pt = this._particles[i];
      if (pt.source === name || pt.target === name) {
        colorAttr.setXYZ(i, this._defaultColors[i * 3], this._defaultColors[i * 3 + 1], this._defaultColors[i * 3 + 2]);
      }
    }
    colorAttr.needsUpdate = true;
  }

  /**
   * Restore all particles to their original colors.
   */
  resetHighlights() {
    if (!this._defaultColors) return;
    const colorAttr = this._geometry.getAttribute('aColor');
    colorAttr.array.set(this._defaultColors);
    colorAttr.needsUpdate = true;
    this._dimmed = false;
  }

  /**
   * Toggle visibility of the particle system.
   * @param {boolean} visible
   */
  setVisible(visible) {
    this._mesh.visible = visible;
  }

  /**
   * Cleanup all GPU resources.
   */
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
    this._particles = [];
  }
}

export default ParticleSystem;
