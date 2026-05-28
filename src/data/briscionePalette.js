/**
 * briscionePalette.js — category-distinct colors for the Flavor Matrix
 * pie-wheel surfaces (Affinities + Recipe Lab).
 *
 * Briscione's wheel uses one strong color per category band, NOT a
 * blended palette. Each bucket in an axis gets its own visual identity
 * so a filled slice reads as "this bucket is activated" at a glance.
 *
 * Coverage:
 *   - aroma family (6 odor heads from the GNN)
 *   - taste (8 taste families)
 *   - season (4 quarters)
 *   - cooking method (13 methods — defined in cookingMethods.js)
 *   - cuisine — uses categoricalAxes bucket palette (too many buckets
 *     for hand-tuned distinct colors; falls back to the existing
 *     CATEGORICAL_AXES.cuisines bucket colors)
 *
 * Each entry is a hex string. Bucket keys match the lowercase keys
 * used throughout the data layer (gnn_entropy, networkModes,
 * categoricalAxes).
 */

// Chef-vocab expansion (2026-05-27, batch 6) — palette expanded from
// the 5-head GNN set to the 13-category chef-curated vocabulary. New
// categories don't have GNN heads (only chef-CSV labels surface them);
// the 5 GNN-pickable categories (citrus excluded → chef-only) stay at
// fruity/floral/green/woody/creamy. `fatty` was renamed to `creamy`
// to match chef vocab; `spicy` was dropped (mol-F1 0.329 < 0.4 gate).
export const BRISCIONE_AROMA = {
  // Fresh & bright (3) — citrus is chef-only; fruity/floral are GNN-pickable
  citrus:  '#f59e0b',  // saturated amber — lemon zest / limonene
  fruity:  '#dc2626',  // red — bright stone-fruit / berry
  floral:  '#ec4899',  // pink — rose / jasmine
  // Vegetative (2) — herbal is chef-only; green is GNN-pickable + allium
  herbal:  '#84cc16',  // bright lime — terpenes / cardamom / coriander
  green:   '#22c55e',  // emerald — herb / leaf / allium
  // Dairy & fat (1) — creamy is GNN-pickable (maps to odor_fatty column)
  creamy:  '#fde68a',  // pale cream — butter / lactones / dairy
  // Earth & wood (2) — woody is GNN-pickable; earthy chef-only
  woody:   '#92400e',  // umber — cedar / oak / smoke
  earthy:  '#57534e',  // slate brown — geosmin / mushroom / potato
  // Fermentation & heat (3) — chef-only
  roasted: '#713f12',  // deep roast brown — pyrazines / coffee / cocoa
  caramel: '#c2410c',  // burnt amber — Maillard sugars / molasses
  fermented: '#78350f',  // dark mahogany — parmesan / miso / soy / aged cheeses
  // Other (2) — chef-only
  marine:  '#0891b2',  // deep teal — kelp / anchovy / TMA / DMS
  pungent: '#be123c',  // crimson — allium-sulfur / mustard / horseradish
};

export const BRISCIONE_TASTE = {
  sweet:      '#f472b6',  // pink (matches in-app sweet)
  sour:       '#22d3ee',  // cyan (matches in-app sour)
  bitter:     '#a855f7',  // purple
  salty:      '#3b82f6',  // blue
  spicy:      '#ef4444',  // red (kept distinct from sour-aroma red)
  pungent:    '#f97316',  // orange
  astringent: '#14b8a6',  // teal
  umami:      '#facc15',  // gold
};

export const BRISCIONE_SEASON = {
  spring: '#86efac',  // pale green
  summer: '#fde047',  // saturated yellow
  fall:   '#fb923c',  // orange
  winter: '#94a3b8',  // slate blue-gray
};

export const BRISCIONE_METHOD = {
  grill:   '#7f1d1d',
  roast:   '#92400e',
  sear:    '#b45309',
  braise:  '#78350f',
  saute:   '#d97706',
  fry:     '#f59e0b',
  poach:   '#22d3ee',
  boil:    '#0ea5e9',
  steam:   '#67e8f9',
  bake:    '#a16207',
  smoke:   '#475569',
  raw:     '#84cc16',
  confit:  '#fbbf24',
};

const FALLBACK = '#64748b';

const PALETTES = {
  aroma:   BRISCIONE_AROMA,
  taste:   BRISCIONE_TASTE,
  season:  BRISCIONE_SEASON,
  method:  BRISCIONE_METHOD,
  cooking: BRISCIONE_METHOD,
};

/**
 * Resolve a bucket key against an axis palette. Returns a hex color
 * or a slate fallback when the axis is unknown.
 */
export function bucketColor(axis, bucketKey) {
  const palette = PALETTES[axis] || PALETTES[String(axis).toLowerCase()];
  if (!palette) return FALLBACK;
  return palette[bucketKey] || palette[String(bucketKey).toLowerCase()] || FALLBACK;
}

/**
 * Full bucket list for an axis, in canonical order. Used to drive
 * wheel slice layout — slices appear in this order so the wheel is
 * stable across re-renders and across ingredients.
 */
export const BRISCIONE_AXIS_ORDER = {
  aroma:   ['citrus', 'fruity', 'floral', 'herbal', 'green', 'creamy', 'woody', 'earthy', 'roasted', 'caramel', 'fermented', 'marine', 'pungent'],
  taste:   ['sweet', 'sour', 'bitter', 'salty', 'spicy', 'pungent', 'astringent', 'umami'],
  season:  ['spring', 'summer', 'fall', 'winter'],
  method:  ['grill', 'roast', 'sear', 'braise', 'saute', 'fry', 'poach', 'boil', 'steam', 'bake', 'smoke', 'raw', 'confit'],
};

export function axisOrder(axis) {
  return BRISCIONE_AXIS_ORDER[axis] || BRISCIONE_AXIS_ORDER[String(axis).toLowerCase()] || [];
}
