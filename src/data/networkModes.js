/**
 * networkModes.js — shared mode taxonomy for the Network tab.
 *
 * Original cycle (4 modes — geometry-driven):
 *   ml      → 3D Pairings  (recipe co-occurrence graph in 3D)
 *   ml2d    → 2D Pairings  (PCA-projected layout)
 *   neural  → 3D Flavors   (taste-channel positioning in 3D)
 *   taste2d → 2D Flavors   (taste-wheel layout)
 *
 * Categorical wheel modes (added Phase 2 — categorical bucketing):
 *   aromas2d  → Aromas  (6 dominant odor families: fruity/floral/green/woody/spicy/fatty)
 *   cuisine2d → Cuisine (8 regional buckets: European, Americas, East Asian, …)
 *   season2d  → Season  (5 buckets: Spring/Summer/Autumn/Winter/All Year)
 *   family2d  → Family  (~11 culinary categories: Protein/Dairy/Veg/…)
 *
 * Each new mode is a flat-plane wheel laid out by
 * src/data/categoricalWheelPositions.js — bucket centroids on a
 * circle of radius 60, members on a phyllotaxis sub-disc per bucket.
 *
 * Lifted to a separate module so LivingArchView (renderer) and
 * MobileTabBar (Network button dropdown) stay in lockstep on which
 * keys exist + how they label.
 */
export const MODE_CYCLE = [
  'ml', 'ml2d', 'neural', 'taste2d',
  'aromas2d', 'cuisine2d', 'season2d', 'family2d',
];

export const MODE_LABELS = {
  ml: '3D Pairings',
  ml2d: '2D Pairings',
  neural: '3D Flavors',
  taste2d: '2D Flavors',
  aromas2d: '2D Aromas',
  cuisine2d: '2D Cuisine',
  season2d: '2D Season',
  family2d: '2D Family',
};

// Set of mode keys whose layout is a flat 2D plane (camera looks
// straight down). Used by LivingArchView for camera positioning,
// orbit constraints, and wheel-style label sprites.
export const MODE_IS_2D = new Set([
  'ml2d', 'taste2d', 'aromas2d', 'cuisine2d', 'season2d', 'family2d',
]);

// Set of categorical-wheel mode keys (those served by
// categoricalWheelPositions.js). taste2d is included here as of
// the "tastes-as-clusters" layout swap — it now renders the same
// 8-bucket wheel-of-sub-discs as the other categorical modes
// (one sub-disc per dominant taste), replacing the legacy
// octagonal sector wheel.
export const MODE_IS_CATEGORICAL = new Set([
  'taste2d', 'aromas2d', 'cuisine2d', 'season2d', 'family2d',
]);

// Convenience: mode key → categorical axis key (for looking up
// positions from categoricalWheelPositions.js).
export const MODE_TO_AXIS = {
  taste2d:  'taste',
  aromas2d: 'aromas',
  cuisine2d: 'cuisine',
  season2d: 'season',
  family2d: 'family',
};
