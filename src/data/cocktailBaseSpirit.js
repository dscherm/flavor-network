/**
 * cocktailBaseSpirit.js — classify a cocktail by its dominant base
 * spirit so the 3D scene can encode that information as node shape
 * (mirrors `sauceShapes.js` for the sauce lab).
 *
 * Distribution across the 441-cocktail v2 corpus:
 *   whiskey   121   (bourbon, rye, scotch, brandy/cognac/calvados)
 *   gin       101
 *   rum        93   (rhum agricole, cachaça)
 *   vodka      51
 *   tequila    17   (incl. mezcal)
 *   liqueur    16   (amaro, Campari, Aperol, Chartreuse, sherry/port-led)
 *   vermouth   10
 *   wine        7   (champagne, prosecco, sake)
 *   other      25   (hard cider, soju, syrups-only, etc.)
 *
 * Shape choices (8 visually-distinct silhouettes):
 *   gin      → cube         (juniper / botanical structure)
 *   whiskey  → cylinder     (barrel column)
 *   rum      → torus        (tropical loops)
 *   vodka    → sphere       (neutral / clean)
 *   tequila  → cone         (agave point)
 *   liqueur  → bipyramid    (sweet aromatic diamond)
 *   vermouth → tetrahedron  (fortified prism)
 *   wine     → octahedron   (effervescent diamond)
 *   other    → torusKnot    (catch-all)
 */

const SPIRIT_PATTERNS = [
  { spirit: 'tequila', shape: 'cone',        rx: /\b(tequila|mezcal)\b/ },
  { spirit: 'gin',     shape: 'cube',        rx: /\bgin\b/ },
  { spirit: 'rum',     shape: 'torus',       rx: /\b(rum|rhum|cachac)/ },
  { spirit: 'vodka',   shape: 'sphere',      rx: /\bvodka\b/ },
  { spirit: 'whiskey', shape: 'cylinder',    rx: /\b(whiskey|whisky|bourbon|rye|scotch|cognac|brandy|armagnac|calvados)\b/ },
  { spirit: 'liqueur', shape: 'bipyramid',   rx: /\b(liqueur|amaro|campari|aperol|chartreuse|drambuie|benedictine|maraschino|sherry|port|pernod|absinthe)\b/ },
  { spirit: 'vermouth',shape: 'tetrahedron', rx: /\bvermouth\b/ },
  { spirit: 'wine',    shape: 'octahedron',  rx: /\b(wine|champagne|prosecco|sake|cava|cider)\b/ },
];

const DEFAULT_SHAPE = 'torusKnot';
const DEFAULT_SPIRIT = 'other';

/**
 * Returns the dominant base spirit string (e.g. 'gin', 'whiskey') so
 * it can drive filter chips in the Browse view. Mirrors
 * cocktailBaseSpiritShape but returns the spirit name instead of the
 * shape token.
 * @param {Array<string|{name?:string, raw?:string}>} ingredientsRaw
 * @returns {string} one of: tequila, gin, rum, vodka, whiskey,
 *                   liqueur, vermouth, wine, other
 */
export function cocktailBaseSpirit(ingredientsRaw) {
  if (!Array.isArray(ingredientsRaw) || ingredientsRaw.length === 0) {
    return DEFAULT_SPIRIT;
  }
  const text = ingredientsRaw
    .map((i) => (typeof i === 'string' ? i : (i?.name || i?.raw || '')))
    .join(' | ')
    .toLowerCase();
  for (const { rx, spirit } of SPIRIT_PATTERNS) {
    if (rx.test(text)) return spirit;
  }
  return DEFAULT_SPIRIT;
}

/**
 * @param {Array<string|{name?:string, raw?:string}>} ingredientsRaw
 * @returns {string} shape key — see ShapeLegend for the full set
 */
export function cocktailBaseSpiritShape(ingredientsRaw) {
  if (!Array.isArray(ingredientsRaw) || ingredientsRaw.length === 0) {
    return DEFAULT_SHAPE;
  }
  const text = ingredientsRaw
    .map((i) => (typeof i === 'string' ? i : (i?.name || i?.raw || '')))
    .join(' | ')
    .toLowerCase();
  // Iterate in priority order — tequila/gin/rum win over the catch-all
  // wine pattern (matters because some tiki recipes call "champagne
  // float on a rum base").
  for (const { rx, shape } of SPIRIT_PATTERNS) {
    if (rx.test(text)) return shape;
  }
  return DEFAULT_SHAPE;
}

export const COCKTAIL_SPIRIT_LEGEND = Object.freeze([
  { category: 'Gin',      shape: 'cube' },
  { category: 'Whiskey',  shape: 'cylinder' },
  { category: 'Rum',      shape: 'torus' },
  { category: 'Vodka',    shape: 'sphere' },
  { category: 'Tequila',  shape: 'cone' },
  { category: 'Liqueur',  shape: 'bipyramid' },
  { category: 'Vermouth', shape: 'tetrahedron' },
  { category: 'Wine',     shape: 'octahedron' },
  { category: 'Other',    shape: 'torusKnot' },
]);
