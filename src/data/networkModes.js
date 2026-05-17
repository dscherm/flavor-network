/**
 * networkModes.js — shared mode taxonomy for the Network tab.
 *
 * R16 Phase 1 collapse: the previous 8-entry `MODE_CYCLE` (ml / ml2d /
 * neural / taste2d + the 4 categorical wheels) has been reduced to two
 * geometry modes only — `3D` and `2D`. The categorical wheel layouts
 * (aromas / cuisine / season / family / taste) survive as *morph
 * overlays* driven by an orthogonal `filterStack` rather than as
 * dropdown entries. See `.omc/plans/r16-network-filter-consolidation-plan.md`
 * for the full rationale.
 *
 * The legacy mode keys + axis mappings stay defined internally
 * (`LEGACY_MODE_TO_FILTER`, `MODE_TO_AXIS`, `MODE_IS_2D`,
 * `MODE_IS_CATEGORICAL`) so the renderer's existing `posForMode`
 * dispatch + cluster-color paths can be migrated incrementally
 * across Phase 2/3 without a single-commit rip-out.
 */

// ===== Mode picker (collapsed) ===========================================
// `flavor3D` is the C₁′ prototype: positions come from a UMAP of per-
// ingredient GNN taste+aroma vectors (public/proDataset/flavor_positions.json)
// rather than from the Node2Vec recipe-cooccurrence embedding. Position
// = flavor identity; edges still encode pairing.
export const MODE_CYCLE = ['3D', '2D', 'flavor3D'];

export const MODE_LABELS = {
  '3D': '3D Pairings',
  '2D': '2D Pairings',
  'flavor3D': 'Flavor Space (beta)',
};

// ===== Filter pill row (new in R16 Phase 1) ==============================
// Ordered list of filter keys rendered in the FilterPillRow. The "None"
// pill is presentational (active when filterStack.length === 0) and is
// NOT listed here — it's rendered separately.
export const FILTER_KEYS = [
  'aroma',
  'cuisine',
  'season',
  'family',
  'taste',
  'cocktail-scope',
  'sauce-scope',
];

export const FILTER_LABELS = {
  'aroma':          'Aroma',
  'cuisine':        'Cuisine',
  'season':         'Season',
  'family':         'Family',
  'taste':          'Taste',
  'cocktail-scope': 'Cocktail Scope',
  'sauce-scope':    'Sauce Scope',
};

// Singular filter key → plural axis key consumed by
// `categoricalWheelPositions.js`. Scope filters resolve to `null`
// because they have no wheel data — they are visibility-only and
// must NOT drive the morph layout.
export const FILTER_TO_AXIS = {
  'aroma':          'aromas',     // singular → plural
  'cuisine':        'cuisine',
  'season':         'season',
  'family':         'family',
  'taste':          'taste',
  'cocktail-scope': null,
  'sauce-scope':    null,
};

/**
 * Resolve the morph-driver axis for a given filter stack.
 *
 * Walks the stack tail-first and returns the most-recent filter whose
 * `FILTER_TO_AXIS` entry is non-null. Scope filters (axis === null) are
 * skipped — they restrict visibility but never drive the layout.
 *
 * Returns `null` when the stack is empty OR contains only scope
 * filters — in which case the renderer should fall back to the
 * cooccurrence layout (posA for 3D, posB for 2D).
 */
export function morphAxisForStack(filterStack) {
  if (!Array.isArray(filterStack)) return null;
  for (let i = filterStack.length - 1; i >= 0; i--) {
    const axis = FILTER_TO_AXIS[filterStack[i]];
    if (axis !== null && axis !== undefined) return axis;
  }
  return null;
}

/**
 * Replaces the legacy `MODE_IS_CATEGORICAL` set. Returns true when the
 * filter stack has at least one entry — i.e. the renderer should hide
 * edges + particles and treat the layout as "categorical view."
 */
export function HAS_ACTIVE_FILTER(filterStack) {
  return Array.isArray(filterStack) && filterStack.length > 0;
}

// ===== Legacy mappings (kept internal for renderer migration) ============
// Pre-Phase-1 the renderer indexed `posForMode` by these mode keys.
// During the Phase 1 collapse the renderer is being migrated to a
// (geometryMode, morphAxis) tuple, but the wheel-position cache itself
// is still keyed by axis name — these tables let us look up the right
// Float32Array without touching `categoricalWheelPositions.js` internals.

// Mode keys whose layout is a flat 2D plane (camera looks straight
// down). Used by LivingArchView for camera positioning, orbit
// constraints, and wheel-style label sprites.
export const MODE_IS_2D = new Set([
  'ml2d', 'taste2d', 'aromas2d', 'cuisine2d', 'season2d', 'family2d',
]);

// Set of categorical-wheel mode keys (those served by
// categoricalWheelPositions.js). Kept for code paths that haven't
// migrated to `HAS_ACTIVE_FILTER(filterStack)` yet.
export const MODE_IS_CATEGORICAL = new Set([
  'taste2d', 'aromas2d', 'cuisine2d', 'season2d', 'family2d',
]);

// Convenience: legacy mode key → categorical axis key (for looking
// up positions from categoricalWheelPositions.js).
export const MODE_TO_AXIS = {
  taste2d:  'taste',
  aromas2d: 'aromas',
  cuisine2d: 'cuisine',
  season2d: 'season',
  family2d: 'family',
};

// Legacy mode key → filter key mapping. Reserved for migration logic
// that needs to translate "what categorical mode was the user in?" to
// "what filter would represent that state?". Not used in Phase 1.
export const LEGACY_MODE_TO_FILTER = {
  taste2d:   'taste',
  aromas2d:  'aroma',
  cuisine2d: 'cuisine',
  season2d:  'season',
  family2d:  'family',
};

/**
 * Axis-key (plural — `taste` / `aromas` / `cuisine` / `season` /
 * `family`) → legacy mode key the renderer's `posForMode` and
 * `categoricalOutByMode` tables use. Phase 1 derives an effective
 * legacy mode from `(mode, morphAxis)` so the existing rendering
 * pipeline (transition lerps, bucket colors, label visibility) does
 * not need a single-commit rewrite.
 */
export const AXIS_TO_LEGACY_MODE = {
  taste:   'taste2d',
  aromas:  'aromas2d',
  cuisine: 'cuisine2d',
  season:  'season2d',
  family:  'family2d',
};

/**
 * Derive the legacy mode key (`ml` / `ml2d` / `mlflavor` / `taste2d` /
 * `aromas2d` / `cuisine2d` / `season2d` / `family2d`) from the
 * (geometryMode, morphAxis) tuple. Used as the bridge between R16
 * Phase 1's new (mode, filterStack) state and the renderer's existing
 * mode-keyed position / color / label tables.
 *
 *   morphAxis === null  → ml (3D) | ml2d (2D) | mlflavor (flavor3D)
 *   morphAxis !== null  → `${axis}2d` (always a wheel layout)
 *
 * Filter-stack semantics for flavor3D: the morph axes (taste / aroma /
 * cuisine / season / family) re-flatten the geometry to their wheels —
 * those wheels live in their own 2D space and override the flavor 3D
 * layout, same as they override the recipe-coocc 3D layout. So when a
 * filter is active, we fall through to the wheel mode regardless of
 * whether the user picked 3D, 2D, or flavor3D.
 */
export function effectiveLegacyMode(mode, morphAxis) {
  if (!morphAxis) {
    if (mode === '3D') return 'ml';
    if (mode === '2D') return 'ml2d';
    if (mode === 'flavor3D') return 'mlflavor';
    return 'ml';
  }
  return AXIS_TO_LEGACY_MODE[morphAxis] || (mode === '3D' ? 'ml' : 'ml2d');
}
