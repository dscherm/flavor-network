import * as THREE from 'three';

/**
 * Master shape vocabulary for the multi-shape NodeMesh. All geometries
 * are normalized so their bounding-sphere radius ≈ 1, which lets the
 * existing per-instance scale (derived from pairing count) treat every
 * shape as roughly equivalent visual weight.
 *
 * Used by the Cocktail Lab (subcluster category → shape), Sauce Lab
 * (cuisine → shape), and Network α-mode (tier → shape). When NodeMesh
 * receives no shapeAssignments map, only `sphere` is allocated and the
 * other geometries are released immediately, so this carries no cost
 * on the default Network surface.
 */

const SEG = 12;

export const SHAPE_KEYS = Object.freeze([
  'sphere',
  'cube',
  'tetrahedron',
  'octahedron',
  'dodecahedron',
  'icosahedron',
  'torus',
  'cylinder',
]);

export function buildShapeGeometries() {
  return {
    sphere: new THREE.SphereGeometry(1, SEG, SEG),
    // Cube edge length 1.27 → bounding-sphere radius √3/2 · 1.27 ≈ 1.10.
    // Slightly larger than r=1 so flat faces don't read smaller than
    // curved siblings under bloom.
    cube: new THREE.BoxGeometry(1.27, 1.27, 1.27),
    tetrahedron: new THREE.TetrahedronGeometry(1, 0),
    octahedron: new THREE.OctahedronGeometry(1, 0),
    dodecahedron: new THREE.DodecahedronGeometry(1, 0),
    icosahedron: new THREE.IcosahedronGeometry(1, 0),
    // Torus: outer radius 0.7 + tube 0.3 → outer extent = 1.0.
    torus: new THREE.TorusGeometry(0.7, 0.3, 8, 16),
    // Cylinder: radius 0.7, height 1.4 → bounding sphere radius ≈ 0.99.
    cylinder: new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12),
  };
}

export function disposeShapeGeometries(geos) {
  if (!geos) return;
  for (const g of Object.values(geos)) {
    if (g && typeof g.dispose === 'function') g.dispose();
  }
}
