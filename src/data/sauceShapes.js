/**
 * sauceShapes.js — map a sauce's `cuisine` field to a master-kit shape
 * key. Mirrors `cocktailShapes.js` but uses cuisine instead of
 * subcluster category.
 *
 * Cuisine frequency in `public/data/sauce_augment.json` (77 sauces):
 *
 *   French         21
 *   Mexican         9
 *   Indian          8
 *   Italian         5
 *   American        5
 *   Japanese        5
 *   Chinese         4
 *   Thai            4   ─┐
 *   Middle Eastern  4    ├─ folded into "Other" (octahedron)
 *   African         4    │
 *   Korean          3    │
 *   Mediterranean   2    │
 *   Peruvian        1    │
 *   Vietnamese      1    │
 *   Argentine       1   ─┘
 *
 * The top-7 cuisines get their own dedicated shape; anything else
 * folds into a single "Other" shape so the user has at most 8 shapes
 * to learn (matches the cap we set in the deep interview).
 *
 *   French    → cube         (the canonical mother sauces — square / structured)
 *   Italian   → torus        (tomato + emulsion loops — closed)
 *   Indian    → bipyramid    (warm spice diamond)
 *   Mexican   → cone         (chile heat narrowing to a point)
 *   American  → cylinder     (BBQ + diner — straight column)
 *   Japanese  → tetrahedron  (precise / minimalist polyhedron)
 *   Chinese   → sphere       (round / wok-tossed silhouette)
 *   Other     → octahedron   (single fallback; one polyhedron only)
 *
 * Per Pass-4 user feedback, polyhedrons are deliberately kept rare:
 * only Indian (bipyramid), Japanese (tetrahedron), and Other
 * (octahedron) use them. Curved + open-ended silhouettes (torus,
 * cylinder, cone) do most of the differentiation work.
 */

const CUISINE_TO_SHAPE = Object.freeze({
  french: 'cube',
  italian: 'torus',
  indian: 'bipyramid',
  mexican: 'cone',
  american: 'cylinder',
  japanese: 'tetrahedron',
  chinese: 'sphere',
});

const DEFAULT_SHAPE = 'octahedron'; // "Other" cuisines

/**
 * @param {string|null|undefined} cuisine
 * @returns {string} a shape key from SHAPE_KEYS
 */
export function sauceShapeKey(cuisine) {
  if (!cuisine) return DEFAULT_SHAPE;
  const k = String(cuisine).toLowerCase().trim();
  return CUISINE_TO_SHAPE[k] || DEFAULT_SHAPE;
}

/**
 * Ordered category → shape pairs for the legend UI.
 */
export const SAUCE_SHAPE_LEGEND = Object.freeze([
  { category: 'French',   shape: 'cube' },
  { category: 'Italian',  shape: 'torus' },
  { category: 'Indian',   shape: 'bipyramid' },
  { category: 'Mexican',  shape: 'cone' },
  { category: 'American', shape: 'cylinder' },
  { category: 'Japanese', shape: 'tetrahedron' },
  { category: 'Chinese',  shape: 'sphere' },
  { category: 'Other',    shape: 'octahedron' },
]);
