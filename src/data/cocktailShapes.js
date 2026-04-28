/**
 * cocktailShapes.js — map a Cocktail Codex subcluster category to a
 * master-kit shape key.
 *
 * The codex has 32 subclusters across 7 cocktail families, but the
 * subcluster names cluster into 7 semantic categories that repeat:
 *
 *   Root           → cube         (the structural hub of each family)
 *   Core           → sphere       (the canonical default form)
 *   Balance        → octahedron   (symmetric across two axes)
 *   Seasoning      → cylinder     (column = "added on top")
 *   Variations     → dodecahedron (many-faceted = many variations)
 *   Extended Family → icosahedron (most-faceted = broadest cousin set)
 *   Recipes        → torus        (closed loop = a complete recipe)
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
  'root': 'cube',
  'core': 'sphere',
  'balance': 'octahedron',
  'experimenting with balance': 'octahedron',
  'experimenting with the balance': 'octahedron',
  'seasoning': 'cylinder',
  'variations': 'dodecahedron',
  'extended family': 'icosahedron',
  'variations & extended family': 'icosahedron',
  'recipes': 'torus',
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
  { category: 'Root', shape: 'cube' },
  { category: 'Core', shape: 'sphere' },
  { category: 'Balance', shape: 'octahedron' },
  { category: 'Seasoning', shape: 'cylinder' },
  { category: 'Variations', shape: 'dodecahedron' },
  { category: 'Extended Family', shape: 'icosahedron' },
  { category: 'Recipes', shape: 'torus' },
]);
