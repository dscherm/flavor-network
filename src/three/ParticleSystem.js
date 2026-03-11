import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
} from 'three';

import { createParticleMaterial } from './ShaderMaterials.js';

const STRENGTH_THRESHOLD = 0.3;
const BASE_SPEED = 0.15;
const MAX_SPEED = 0.6;

class ParticleSystem {
  /**
   * @param {Object} opts
   * @param {Array<{source: string, target: string, strength: number}>} opts.edges
   * @param {Object} opts.positions - either { positions: { name: [x,y,z] } } or flat { name: [x,y,z] }
   * @param {number} [opts.particlesPerEdge=2]
   */
  constructor({ edges, positions, particlesPerEdge = 2 }) {
    const posMap = positions.positions || positions;

    this._particles = [];

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const strength = edge.strength || 0;
      if (strength <= STRENGTH_THRESHOLD) continue;

      const srcPos = posMap[edge.source];
      const tgtPos = posMap[edge.target];
      if (!srcPos || !tgtPos) continue;

      const speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * strength;

      for (let p = 0; p < particlesPerEdge; p++) {
        this._particles.push({
          srcX: srcPos[0],
          srcY: srcPos[1],
          srcZ: srcPos[2],
          tgtX: tgtPos[0],
          tgtY: tgtPos[1],
          tgtZ: tgtPos[2],
          progress: p / particlesPerEdge,
          speed,
        });
      }
    }

    const count = this._particles.length;
    const positionArray = new Float32Array(count * 3);
    const opacityArray = new Float32Array(count);

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
