/**
 * drinkColor.js — the colour of a drink in its glass (DESIGN-2).
 *
 * Simple on purpose: a drink is its family colour unless one of its
 * ingredients is strongly coloured (campari, grenadine, blue curaçao …),
 * in which case the coloured ingredients set the hue. Clear spirits,
 * citrus juice, syrups and soda do not tint.
 */

// First match per ingredient wins, so specific names sit above general ones.
export const COLOURANTS = [
  { rx: /blue cura[cç]ao|\bblue\b.*liqueur/i, color: '#1d8fe0' },
  { rx: /campari|bitter aperitivo/i, color: '#c8102e' },
  { rx: /aperol/i, color: '#f26b21' },
  { rx: /grenadine|pomegranate/i, color: '#c2183f' },
  { rx: /cranberr/i, color: '#b5163b' },
  { rx: /cr[eè]me de cassis|chambord|blackberr|raspberr|sloe gin/i, color: '#7a1f4a' },
  { rx: /strawberr|watermelon/i, color: '#e2475b' },
  { rx: /midori|melon liqueur/i, color: '#5fbf3a' },
  { rx: /green chartreuse|cr[eè]me de menthe|green cr[eè]me/i, color: '#4caf50' },
  { rx: /yellow chartreuse|galliano|advocaat/i, color: '#e8c21a' },
  { rx: /cr[eè]me de violette|parfait amour|butterfly pea/i, color: '#7b5ea7' },
  { rx: /coffee|espresso|kahl[uú]a|cola\b|stout|guinness/i, color: '#3b2416' },
  { rx: /irish cream|baileys|\bcream\b|\bmilk\b|coconut cream|cream of coconut|egg white/i, color: '#eadfc4' },
  { rx: /tomato/i, color: '#b8322a' },
  { rx: /orange juice|passion fruit|mango|peach/i, color: '#f5a524' },
  { rx: /pineapple/i, color: '#f2d15c' },
  { rx: /red wine|\bport\b|sweet vermouth|rosso vermouth|dubonnet|amaro|fernet|jägermeister|jagermeister/i, color: '#6e1f1f' },
  { rx: /dark rum|añejo|anejo|bourbon|\brye\b|whisk(e)?y|scotch|cognac|brandy|armagnac/i, color: '#b36b1f' },
];

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** Average of hex colours (RGB mean). */
export function mixColors(colors) {
  const rgbs = colors.map(parseHex).filter(Boolean);
  if (!rgbs.length) return null;
  return toHex([0, 1, 2].map((i) => rgbs.reduce((s, c) => s + c[i], 0) / rgbs.length));
}

/** The colourant hex an ingredient name contributes, or null. */
export function ingredientColour(name) {
  const s = String(name || '');
  for (const { rx, color } of COLOURANTS) if (rx.test(s)) return color;
  return null;
}

/**
 * The drink's colour from its ingredient names (strings, or objects with
 * `key`/`name`/`raw`). Strong colourants (the first eleven entries above:
 * red/blue/green aperitifs, syrups and berries) win over the browner
 * spirit/vermouth tones, which only show when nothing brighter is there.
 * Returns `{ color, tinted }`; falls back to `fallback` (the family colour).
 */
export function drinkColor(ingredients = [], fallback = '#9a8f7a') {
  const names = (ingredients || []).map((x) => (typeof x === 'string' ? x : x?.key || x?.name || x?.raw || ''));
  const hits = names.map(ingredientColour).filter(Boolean);
  if (!hits.length) return { color: fallback, tinted: false };
  const strongSet = new Set(COLOURANTS.slice(0, 11).map((c) => c.color));
  const strong = hits.filter((c) => strongSet.has(c));
  return { color: mixColors(strong.length ? strong : hits), tinted: true };
}

/**
 * Lift a dark colour toward chalk cream so it reads as a line on the
 * near-black board; bright colours pass through unchanged.
 */
export function liftColor(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.5) return hex;
  const t = Math.min(0.65, (0.5 - lum) * 1.8);
  const cream = [245, 239, 222];
  return toHex(rgb.map((c, i) => c + (cream[i] - c) * t));
}
