/**
 * R15-6 closure test: cluster + axis + node labels are all THREE.Sprite
 * instances, which billboard automatically (Three.js handles the
 * camera-facing transform in SpriteMaterial's vertex shader). No frame-
 * by-frame `lookAt(camera)` call is needed for labels to face the
 * camera. This test pins that contract so a refactor to e.g. THREE.Mesh
 * + plane geometry would be caught by the test suite, not at runtime.
 *
 * Why this matters: a previous task assumed labels needed manual
 * billboarding logic. They don't — Sprite is the billboard primitive.
 * Closing R15-6 as moot is the documented decision; this test
 * prevents accidental regression.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import {
  createNodeLabel,
  createCocktailAxisLabels,
  createSauceAxisLabels,
  createClusterLabels,
} from '../AxisLabels.js';

// jsdom ships HTMLCanvasElement but not the 2D context. AxisLabels uses
// ctx.font / measureText / fillText to size and rasterize the label
// texture, so stub a minimal-fidelity context that returns the calls
// `createTextSprite` makes. We don't care what the texture LOOKS like —
// the test only checks that the result is a billboard primitive.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return {
      font: '',
      textAlign: 'center',
      textBaseline: 'middle',
      fillStyle: '#fff',
      strokeStyle: '#000',
      lineWidth: 1,
      lineJoin: 'round',
      miterLimit: 2,
      measureText: () => ({ width: 100 }),
      fillText: () => {},
      strokeText: () => {},
      beginPath: () => {},
      roundRect: () => {},
      fill: () => {},
      fillRect: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
    };
  };
});

describe('R15-6: labels are billboards (THREE.Sprite)', () => {
  it('createNodeLabel returns a Sprite', () => {
    const label = createNodeLabel('basil', [1, 2, 3]);
    expect(label).toBeInstanceOf(THREE.Sprite);
  });

  it('createCocktailAxisLabels returns a group of 6 Sprites', () => {
    const group = createCocktailAxisLabels();
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBe(6);
    for (const child of group.children) {
      expect(child).toBeInstanceOf(THREE.Sprite);
    }
  });

  it('createSauceAxisLabels returns a group of 6 Sprites', () => {
    const group = createSauceAxisLabels();
    expect(group.children.length).toBe(6);
    for (const child of group.children) {
      expect(child).toBeInstanceOf(THREE.Sprite);
    }
  });

  it('createClusterLabels returns Sprites with clusterId tags', () => {
    const clusters = [
      { id: 1, label: 'Sour', color: '#f00' },
      { id: 2, label: 'Stirred', color: '#0f0' },
    ];
    const centroids = new Map([
      [1, [0, 0, 0]],
      [2, [10, 0, 0]],
    ]);
    const group = createClusterLabels(clusters, centroids);
    expect(group.children.length).toBe(2);
    for (const child of group.children) {
      expect(child).toBeInstanceOf(THREE.Sprite);
      expect(typeof child.userData.clusterId).toBe('number');
    }
  });
});
