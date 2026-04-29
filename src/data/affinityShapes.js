/**
 * affinityShapes.js — map an α-mode role (focal or tier ring) to a
 * master-kit shape key. Mirrors `cocktailShapes.js` / `sauceShapes.js`.
 *
 * α-mode renders four roles:
 *
 *   focal      → dodecahedron   (the unique "hero" — one polyhedron,
 *                                 reads as a special hub)
 *   ★★★ (3)    → bipyramid       (vertical diamond — "premium" silhouette)
 *   ★★  (2)    → cylinder        (column — solid mid-tier)
 *   ★   (1)    → sphere          (default baseline)
 *
 * Edge color (gold/silver/bronze) is set elsewhere (AffinityMode.js
 * TIER_COLOR); shape encodes the rank dimension visually so the user
 * can tell tiers apart without needing to read edge color.
 *
 * Per Pass-4 user feedback ("limit polyhedra"), only the focal
 * (dodecahedron) and ★★★ (bipyramid) use polyhedron silhouettes —
 * everything else is curved / open-ended.
 */

const ROLE_TO_SHAPE = Object.freeze({
  focal: 'dodecahedron',
  3: 'bipyramid',
  2: 'cylinder',
  1: 'sphere',
});

/**
 * @param {'focal'|3|2|1} role
 * @returns {string} a shape key from SHAPE_KEYS (defaults to 'sphere'
 *                   for unknown roles)
 */
export function affinityShape(role) {
  return ROLE_TO_SHAPE[role] || 'sphere';
}

/**
 * Ordered role → shape pairs for the legend UI.
 */
export const AFFINITY_SHAPE_LEGEND = Object.freeze([
  { category: 'Focal',           shape: 'dodecahedron' },
  { category: '★★★ (chemistry)', shape: 'bipyramid' },
  { category: '★★ (strong)',     shape: 'cylinder' },
  { category: '★ (good)',         shape: 'sphere' },
]);
