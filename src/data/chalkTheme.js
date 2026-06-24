/**
 * chalkTheme.js — shared "kitchen-world" chalkboard DNA.
 *
 * The 2D lab surfaces (Cocktail menu, Sauce specials board, Cookbook) are
 * drawn as colored chalk on slate, matching the RecipeFlavorProfilesCard.
 * Caveat carries names/headings; small data (counts, badges) stays in a
 * legible sans. These tokens live here so every chalkboard surface reads
 * like the same board rather than diverging per-component.
 */

export const FONT = 'Caveat, cursive';

// Slate wash — a radial gradient over near-black.
export const CHALK_GRADIENT = 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%)';
export const CHALK_BG = `${CHALK_GRADIENT}, #0a0a0a`;

// Chalk inks.
export const CHALK_CREAM = '#f5efde'; // primary chalk
export const CHALK_DIM = '#bdb6a3';   // muted chalk
export const CHALK_SUB = '#8a8478';   // faint chalk (captions)
export const CHALK_RAIL = '#4a4a4a';  // slate rail / frame
export const CHALK_SHADOW = '0 0 1px rgba(245,239,222,0.5), 0 0 3px rgba(245,239,222,0.2)';

// Faint chalk-dust grain (SVG fractal noise, ~5% white). Layer it ABOVE the
// slate gradient so the board reads like a real surface, not flat black.
// Subtle by design; must not hurt text legibility.
export const CHALK_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E\")";

/** Layered background style for a chalkboard surface (texture over slate). */
export function chalkSurfaceStyle() {
  return {
    backgroundColor: '#0a0a0a',
    backgroundImage: `${CHALK_TEXTURE}, ${CHALK_GRADIENT}`,
    backgroundSize: '180px 180px, cover',
    backgroundRepeat: 'repeat, no-repeat',
  };
}

// Cream "recipe-box" card tokens — for the Cookbook, where a paper recipe
// card reads better than a chalk row.
export const CARD_CREAM = '#f4ecd8';
export const CARD_CREAM_EDGE = '#e4d8bd';
export const CARD_INK = '#2e2a22';
export const CARD_INK_SUB = '#6b6353';
