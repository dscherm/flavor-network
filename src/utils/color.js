/**
 * Color utilities — scales for cuisines, taste profiles, and activation states.
 */

export const TASTE_COLORS = {
  sweet: '#fb92b4',
  sour: '#c9a330',
  bitter: '#a78bfa',
  salty: '#93c5fd',
  umami: '#f9a870',
  spicy: '#f87171',
  hot: '#f87171',
  pungent: '#b48c64',
  astringent: '#4ade80',
  default: '#4f8fff',
};

export const CUISINE_COLORS = {
  'french cuisine': '#3498db',
  'italian cuisine': '#e74c3c',
  'chinese cuisine': '#f1c40f',
  'japanese cuisine': '#e91e63',
  'indian cuisine': '#ff9800',
  'mexican cuisine': '#4caf50',
  'thai cuisine': '#9c27b0',
  'mediterranean cuisine': '#00bcd4',
  'american cuisine': '#795548',
  'korean cuisine': '#ff5722',
  default: '#4f8fff',
};

/**
 * Get color for a taste string.
 */
export function colorForTaste(taste) {
  if (!taste) return TASTE_COLORS.default;
  const lower = taste.toLowerCase();
  for (const [key, color] of Object.entries(TASTE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return TASTE_COLORS.default;
}

/**
 * Get color for a cuisine string.
 */
export function colorForCuisine(cuisine) {
  if (!cuisine) return CUISINE_COLORS.default;
  return CUISINE_COLORS[cuisine.toLowerCase()] || CUISINE_COLORS.default;
}

/**
 * Lerp between two hex colors.
 */
export function lerpColor(color1, color2, t) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 79, g: 143, b: 255 };
}
