/**
 * networkModes.js — shared 4-way mode taxonomy for the Network tab.
 *
 * Cycle order:
 *   ml      → 3D Pairings  (recipe co-occurrence graph in 3D)
 *   ml2d    → 2D Pairings  (PCA-projected layout)
 *   neural  → 3D Flavors   (taste-channel positioning in 3D)
 *   taste2d → 2D Flavors   (taste-wheel layout)
 *
 * Lifted to a separate module so LivingArchView (renderer) and
 * MobileTabBar (Network button dropdown) stay in lockstep on which
 * keys exist + how they label.
 */
export const MODE_CYCLE = ['ml', 'ml2d', 'neural', 'taste2d'];

export const MODE_LABELS = {
  ml: '3D Pairings',
  ml2d: '2D Pairings',
  neural: '3D Flavors',
  taste2d: '2D Flavors',
};
