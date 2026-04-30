/**
 * R14: CameraAnimator performance + leak tests.
 *
 * Covers AC-MA-3 (100 mount/dispose cycles → scene.children unchanged)
 * and the engage-time budget for the cluster tour.
 *
 * Test env: vitest default (`node`). Pure CPU math; no canvas / WebGL.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraAnimator, STATES } from './CameraAnimator.js';

function buildSyntheticScene(numClusters = 10) {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  camera.position.set(0, 40, 120);
  const scene = new THREE.Scene();
  // Pre-populate the scene with one InstancedMesh + one Group of label
  // sprites, mirroring how LivingArchView builds its scene. This is
  // the baseline child count we assert AGAINST after 100 cycles.
  const sphereGeo = new THREE.SphereGeometry(1, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial();
  scene.add(new THREE.InstancedMesh(sphereGeo, sphereMat, 100));
  const labelGroup = new THREE.Group();
  const centroids = [];
  for (let i = 0; i < numClusters; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
    sprite.userData = { clusterId: i };
    labelGroup.add(sprite);
    centroids.push({
      id: i,
      position: [Math.cos(i) * 30, Math.sin(i * 0.7) * 20, Math.cos(i * 1.3) * 25],
      labelSprite: sprite,
    });
  }
  scene.add(labelGroup);
  const controls = {
    target: new THREE.Vector3(),
    enabled: true,
    update: () => {},
  };
  return { camera, controls, scene, centroids };
}

describe('CameraAnimator — leak test (AC-MA-3)', () => {
  it('100 construct/engage/dispose cycles do not add scene children', () => {
    const { camera, controls, scene, centroids } = buildSyntheticScene();
    const baselineChildren = scene.children.length;

    // Iteration 0 — sanity.
    const a0 = new CameraAnimator(
      { camera, controls, scene },
      () => centroids,
      { mediaMatcher: () => ({ matches: false }) },
    );
    a0.engageClusterTour();
    a0.dispose();
    expect(scene.children.length).toBe(baselineChildren);

    // 100 cycles.
    for (let i = 0; i < 100; i++) {
      const a = new CameraAnimator(
        { camera, controls, scene },
        () => centroids,
        { mediaMatcher: () => ({ matches: false }) },
      );
      a.engageClusterTour();
      // Run a few ticks to exercise glide/dwell paths.
      a.tickAnimation(0.1);
      a.tickAnimation(0.1);
      a.dispose();
    }
    expect(scene.children.length).toBe(baselineChildren);
  });
});

describe('CameraAnimator — engage budget', () => {
  it('engageClusterTour returns under 50ms for a 10-cluster scene', () => {
    const { camera, controls, scene, centroids } = buildSyntheticScene(10);
    const animator = new CameraAnimator(
      { camera, controls, scene },
      () => centroids,
      { mediaMatcher: () => ({ matches: false }) },
    );
    const t0 = performance.now();
    animator.engageClusterTour();
    const elapsed = performance.now() - t0;
    expect(animator.state).toBe(STATES.TOUR_GLIDING);
    // Plan budget is <200ms for engage. Cluster-tour engage is far
    // simpler than focal-orbit engage; 50ms is a generous bound that
    // would catch any accidental O(N²) regression.
    expect(elapsed).toBeLessThan(50);
    animator.dispose();
  });

  it('engageFocalOrbit returns under 50ms', () => {
    const { camera, controls, scene, centroids } = buildSyntheticScene(10);
    const animator = new CameraAnimator(
      { camera, controls, scene },
      () => centroids,
      { mediaMatcher: () => ({ matches: false }) },
    );
    const t0 = performance.now();
    animator.engageFocalOrbit(42, [10, 5, -3]);
    const elapsed = performance.now() - t0;
    expect(animator.state).toBe(STATES.FOCAL_FLYING);
    expect(elapsed).toBeLessThan(50);
    animator.dispose();
  });
});
