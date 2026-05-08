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

// Master shape kit — biased toward visually-distinctive silhouettes.
// The original kit included three regular polyhedra (octahedron,
// dodecahedron, icosahedron) which all read as "ball with facets" at
// small viewing scale and were hard to distinguish from each other.
// They're kept in the registry so AffinityMode α-mode can still
// reference them, but the lab-view assignments now favor curved /
// open-ended shapes (cone, torusKnot, bipyramid) that have very
// different silhouettes.
export const SHAPE_KEYS = Object.freeze([
  'sphere',
  'cube',
  'tetrahedron',
  'octahedron',
  'dodecahedron',
  'icosahedron',
  'torus',
  'cylinder',
  'cone',
  'torusKnot',
  'bipyramid',
  'star',
]);

export function buildShapeGeometries() {
  // Vertical bipyramid — an octahedron with the Y axis stretched 2×,
  // giving a "diamond / spindle" silhouette that doesn't read as a
  // regular polyhedron from any angle.
  const bipyramidGeo = new THREE.OctahedronGeometry(0.7, 0);
  bipyramidGeo.scale(1, 2, 1);

  // 5-pointed extruded star — used for the α-mode "Surprising" tier
  // (ringIdx=0). Built once at module load: a 2D star shape with 5
  // outer points (radius 1.0) and 5 inner valleys (radius 0.4),
  // extruded 0.3 along Z so it has depth at any camera angle.
  const STAR_POINTS = 5;
  const STAR_OUTER = 1.0;
  const STAR_INNER = 0.4;
  const starShape = new THREE.Shape();
  for (let i = 0; i < STAR_POINTS * 2; i++) {
    const r = i % 2 === 0 ? STAR_OUTER : STAR_INNER;
    const a = (i / (STAR_POINTS * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.3, bevelEnabled: false });
  starGeo.translate(0, 0, -0.15);
  starGeo.computeBoundingSphere();

  return {
    sphere: new THREE.SphereGeometry(1, SEG, SEG),
    // Cube edge length 1.27 → bounding-sphere radius √3/2 · 1.27 ≈ 1.10.
    cube: new THREE.BoxGeometry(1.27, 1.27, 1.27),
    tetrahedron: new THREE.TetrahedronGeometry(1, 0),
    octahedron: new THREE.OctahedronGeometry(1, 0),
    dodecahedron: new THREE.DodecahedronGeometry(1, 0),
    icosahedron: new THREE.IcosahedronGeometry(1, 0),
    // Torus: outer radius 0.7 + tube 0.3 → outer extent = 1.0.
    torus: new THREE.TorusGeometry(0.7, 0.3, 8, 16),
    // Cylinder: radius 0.7, height 1.4 → bounding sphere radius ≈ 0.99.
    cylinder: new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12),
    // Cone: radius 0.7, height 1.4 — same envelope as cylinder but
    // pointed silhouette. Reads instantly as "cone".
    cone: new THREE.ConeGeometry(0.7, 1.4, 16),
    // Torus knot (trefoil, p=2 q=3): a twisted ring. Unmistakable
    // silhouette, never confusable with the simple torus.
    torusKnot: new THREE.TorusKnotGeometry(0.55, 0.18, 64, 8),
    // Bipyramid (vertical diamond) — see geometry construction above.
    bipyramid: bipyramidGeo,
    // 5-pointed extruded star — α-mode "Surprising" tier (ringIdx=0).
    star: starGeo,
  };
}

export function disposeShapeGeometries(geos) {
  if (!geos) return;
  for (const g of Object.values(geos)) {
    if (g && typeof g.dispose === 'function') g.dispose();
  }
}

/**
 * Build EdgesGeometry for each shape — used by NodeMesh to render
 * structural-edge overlays (glow lines that follow the polyhedron's
 * actual ridges) so users can distinguish a cube from an octahedron
 * at a glance even when both render at small size.
 *
 * Threshold angles are tuned per-shape: low for polyhedra (1°, every
 * structural edge counts), high for smooth shapes (30°, suppresses
 * triangulation edges so sphere/torus/cylinder don't look like
 * disco balls).
 *
 * @param {Object} baseGeos - the result of buildShapeGeometries()
 * @returns {Object} same keys, each value is a THREE.EdgesGeometry
 */
export function buildShapeEdgeGeometries(baseGeos) {
  const angles = {
    sphere: 30,
    torus: 30,
    cylinder: 30,
    cone: 30,         // smooth side surface — only base ring + tip edge survive
    torusKnot: 30,    // continuous tube — keep outline minimal
    cube: 1,
    tetrahedron: 1,
    octahedron: 1,
    dodecahedron: 1,
    icosahedron: 1,
    bipyramid: 1,     // 8 hard ridges — render every edge
    star: 1,          // 10 outer + 10 inner edges — read as a star outline
  };
  const result = {};
  for (const [k, g] of Object.entries(baseGeos)) {
    if (g) result[k] = new THREE.EdgesGeometry(g, angles[k] ?? 30);
  }
  return result;
}
