/**
 * cocktailShapes.js — map a Cocktail Codex subcluster category to a
 * master-kit shape key.
 *
 * The codex has 32 subclusters across 7 cocktail families, but the
 * subcluster names cluster into 7 semantic categories that repeat:
 *
 *   Root            → sphere     (the family hub — round/whole)
 *   Core            → cube       (the canonical members — solid)
 *   Balance         → torus      (closed loop = balanced)
 *   Seasoning       → cylinder   (column = "added on top")
 *   Variations      → cone       (open-ended, expanding silhouette)
 *   Extended Family → torus knot (twisted = complex cousin linkage)
 *   Recipes         → bipyramid  (diamond = a complete recipe, top + bottom)
 *
 * Pass-3 redesign rationale (per user feedback): the prior mapping
 * relied on three regular polyhedra (octahedron, dodecahedron,
 * icosahedron) which all read as "ball with facets" at viewing scale
 * and were hard to tell apart. The new mapping uses curved + open-
 * ended silhouettes wherever possible — only one polyhedron (cube)
 * survives, and the cone / torus / torusKnot / bipyramid family is
 * far more visually distinct.
 *
 * Two source-data variants get folded:
 *   - "Experimenting with Balance" / "Experimenting with the Balance"
 *     → Balance
 *   - "Variations & Extended Family" → Extended Family
 *
 * The "Syrups" cluster (family_id=6) doesn't have subcluster categories
 * and falls through to sphere via DEFAULT_SHAPE.
 */

const SUBCLUSTER_TO_SHAPE = Object.freeze({
  'root': 'sphere',
  'core': 'cube',
  'balance': 'torus',
  'experimenting with balance': 'torus',
  'experimenting with the balance': 'torus',
  'seasoning': 'cylinder',
  'variations': 'cone',
  'extended family': 'torusKnot',
  'variations & extended family': 'torusKnot',
  'recipes': 'bipyramid',
});

const DEFAULT_SHAPE = 'sphere';

/**
 * @param {string|null|undefined} subclusterLabel
 * @returns {string} a shape key from SHAPE_KEYS
 */
export function cocktailShapeKey(subclusterLabel) {
  if (!subclusterLabel) return DEFAULT_SHAPE;
  const k = String(subclusterLabel).toLowerCase().trim();
  return SUBCLUSTER_TO_SHAPE[k] || DEFAULT_SHAPE;
}

/**
 * Ordered category → shape pairs for the legend UI. Folded duplicates
 * excluded.
 */
export const COCKTAIL_SHAPE_LEGEND = Object.freeze([
  { category: 'Root', shape: 'sphere' },
  { category: 'Core', shape: 'cube' },
  { category: 'Balance', shape: 'torus' },
  { category: 'Seasoning', shape: 'cylinder' },
  { category: 'Variations', shape: 'cone' },
  { category: 'Extended Family', shape: 'torusKnot' },
  { category: 'Recipes', shape: 'bipyramid' },
]);
