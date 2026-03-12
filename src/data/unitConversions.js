/**
 * unitConversions.js — Comprehensive cooking unit conversion table.
 *
 * Converts common cooking units to a normalized base (mL for volume, grams for weight).
 * Includes ingredient-specific density overrides so that "1 cup flour" ≠ "1 cup butter".
 */

// ---------------------------------------------------------------------------
// Volume units → mL
// ---------------------------------------------------------------------------
const VOLUME_TO_ML = {
  // Metric
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  dl: 100,
  deciliter: 100,
  // US customary
  tsp: 4.929,
  teaspoon: 4.929,
  teaspoons: 4.929,
  tbsp: 14.787,
  tablespoon: 14.787,
  tablespoons: 14.787,
  'fl oz': 29.574,
  fl_oz: 29.574,
  'fluid ounce': 29.574,
  'fluid ounces': 29.574,
  cup: 236.588,
  cups: 236.588,
  pint: 473.176,
  pints: 473.176,
  pt: 473.176,
  quart: 946.353,
  quarts: 946.353,
  qt: 946.353,
  gallon: 3785.41,
  gallons: 3785.41,
  gal: 3785.41,
};

// ---------------------------------------------------------------------------
// Weight units → grams
// ---------------------------------------------------------------------------
const WEIGHT_TO_G = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

// ---------------------------------------------------------------------------
// Count / descriptive units → approximate grams
// ---------------------------------------------------------------------------
const COUNT_TO_G = {
  clove: 5,
  cloves: 5,
  pinch: 0.36,       // ~1/16 tsp
  pinches: 0.36,
  dash: 0.62,        // ~1/8 tsp
  dashes: 0.62,
  smidgen: 0.18,
  bunch: 30,
  bunches: 30,
  sprig: 2,
  sprigs: 2,
  leaf: 0.5,
  leaves: 0.5,
  slice: 15,
  slices: 15,
  piece: 30,
  pieces: 30,
  whole: 100,
  can: 400,           // ~14 oz can
  cans: 400,
  head: 200,
  heads: 200,
  stalk: 60,
  stalks: 60,
  stick: 113,         // 1 stick butter = 113g
  sticks: 113,
  ear: 150,           // ear of corn
  ears: 150,
  strip: 10,
  strips: 10,
  filet: 170,         // ~6 oz portion
  fillet: 170,
  breast: 200,
  thigh: 120,
  drumstick: 100,
  wing: 50,
  rib: 150,
  chop: 170,
  shank: 350,
  lobe: 200,
  knob: 10,           // e.g., knob of ginger
  handful: 30,
  drop: 0.05,
  drops: 0.05,
  splash: 5,
  glug: 15,
  drizzle: 5,
  dollop: 30,
  scoop: 60,
  packet: 7,          // e.g., yeast packet
  envelope: 7,
  'to taste': 1,      // minimal placeholder
  'as needed': 5,
  some: 15,
  small: 50,
  medium: 100,
  large: 150,
};

// ---------------------------------------------------------------------------
// Ingredient-specific densities — grams per mL (cup of water = 1.0 g/mL)
// Used to convert volume measurements to grams for specific ingredients.
// ---------------------------------------------------------------------------
const INGREDIENT_DENSITY = {
  // Flours & starches (lighter than water)
  flour: 0.53,
  'all-purpose flour': 0.53,
  'bread flour': 0.55,
  'cake flour': 0.48,
  'whole wheat flour': 0.51,
  'almond flour': 0.40,
  'coconut flour': 0.50,
  cornstarch: 0.54,
  'corn starch': 0.54,
  'powdered sugar': 0.50,
  'confectioners sugar': 0.50,

  // Sugars
  sugar: 0.85,
  'granulated sugar': 0.85,
  'brown sugar': 0.93,
  'caster sugar': 0.80,
  honey: 1.42,
  'maple syrup': 1.32,
  molasses: 1.42,
  'corn syrup': 1.38,
  agave: 1.35,

  // Fats & oils
  butter: 0.96,
  ghee: 0.93,
  'olive oil': 0.92,
  'vegetable oil': 0.92,
  'coconut oil': 0.92,
  'sesame oil': 0.92,
  oil: 0.92,
  lard: 0.92,
  shortening: 0.82,
  'cream cheese': 0.98,

  // Dairy
  milk: 1.03,
  'whole milk': 1.03,
  cream: 1.01,
  'heavy cream': 1.01,
  'sour cream': 1.01,
  yogurt: 1.03,
  'greek yogurt': 1.10,
  'buttermilk': 1.03,

  // Liquids
  water: 1.0,
  broth: 1.0,
  stock: 1.0,
  wine: 0.99,
  vinegar: 1.01,
  'soy sauce': 1.15,
  'fish sauce': 1.14,
  juice: 1.04,
  'lemon juice': 1.03,
  'lime juice': 1.03,

  // Grains & dried goods
  rice: 0.75,
  oats: 0.36,
  'rolled oats': 0.36,
  breadcrumbs: 0.48,
  'panko': 0.22,
  'cocoa powder': 0.42,
  'baking powder': 0.77,
  'baking soda': 0.92,

  // Nuts & seeds
  almonds: 0.60,
  walnuts: 0.47,
  pecans: 0.45,
  'pine nuts': 0.56,
  peanuts: 0.60,
  cashews: 0.55,
  'sesame seeds': 0.57,
  'poppy seeds': 0.60,
  'flax seeds': 0.60,
  'chia seeds': 0.65,

  // Cheese (grated)
  parmesan: 0.42,
  'cheddar cheese': 0.45,
  'mozzarella': 0.50,

  // Spices (ground, approximate)
  salt: 1.22,
  'kosher salt': 0.58,
  'sea salt': 1.10,
  pepper: 0.45,
  'black pepper': 0.45,
  cinnamon: 0.53,
  cumin: 0.47,
  paprika: 0.46,
  'chili powder': 0.45,
  'garlic powder': 0.56,
  'onion powder': 0.53,
  ginger: 0.40,
  turmeric: 0.63,
  nutmeg: 0.47,
  oregano: 0.20,
  thyme: 0.27,
  basil: 0.20,
  rosemary: 0.33,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a unit is a volume measurement.
 * @param {string} unit — normalized unit string
 * @returns {boolean}
 */
export function isVolumeUnit(unit) {
  return unit in VOLUME_TO_ML;
}

/**
 * Check if a unit is a weight measurement.
 * @param {string} unit — normalized unit string
 * @returns {boolean}
 */
export function isWeightUnit(unit) {
  return unit in WEIGHT_TO_G;
}

/**
 * Normalize a raw unit string: lowercase, trim, strip trailing period,
 * collapse whitespace.
 * @param {string|null} unit
 * @returns {string}
 */
export function normalizeUnit(unit) {
  if (!unit) return '';
  return unit.toLowerCase().trim().replace(/\.$/, '').replace(/\s+/g, ' ');
}

/**
 * Convert a quantity + unit pair to a normalized gram equivalent.
 *
 * Strategy:
 *   1. Weight units → direct conversion to grams.
 *   2. Volume units → convert to mL, then multiply by ingredient density
 *      (defaults to water = 1.0 g/mL if ingredient unknown).
 *   3. Count/descriptive units → direct gram estimate.
 *   4. Unitless → treat as count × 30g default.
 *   5. Unknown unit → quantity × 15g fallback.
 *
 * @param {number|null} quantity
 * @param {string|null} unit
 * @param {string|null} ingredientName — optional, for density lookup
 * @returns {number|null} — grams, or null if quantity is missing/invalid
 */
export function toGrams(quantity, unit, ingredientName = null) {
  if (quantity == null || quantity <= 0) return null;

  const norm = normalizeUnit(unit);

  // No unit — treat as generic count
  if (!norm) {
    return quantity * 30;
  }

  // Weight units → direct to grams
  if (norm in WEIGHT_TO_G) {
    return quantity * WEIGHT_TO_G[norm];
  }

  // Volume units → mL → grams via density
  if (norm in VOLUME_TO_ML) {
    const ml = quantity * VOLUME_TO_ML[norm];
    const density = getDensity(ingredientName);
    return ml * density;
  }

  // Count / descriptive units
  if (norm in COUNT_TO_G) {
    return quantity * COUNT_TO_G[norm];
  }

  // Unknown unit fallback
  return quantity * 15;
}

/**
 * Look up ingredient density (g/mL). Falls back to 1.0 (water).
 * Tries exact match first, then substring match.
 * @param {string|null} ingredientName
 * @returns {number}
 */
export function getDensity(ingredientName) {
  if (!ingredientName) return 1.0;
  const name = ingredientName.toLowerCase().trim();

  // Exact match
  if (name in INGREDIENT_DENSITY) {
    return INGREDIENT_DENSITY[name];
  }

  // Substring match — e.g. "unsalted butter" matches "butter"
  for (const [key, density] of Object.entries(INGREDIENT_DENSITY)) {
    if (name.includes(key) || key.includes(name)) {
      return density;
    }
  }

  return 1.0;
}

/**
 * Get all known volume units.
 * @returns {string[]}
 */
export function getVolumeUnits() {
  return Object.keys(VOLUME_TO_ML);
}

/**
 * Get all known weight units.
 * @returns {string[]}
 */
export function getWeightUnits() {
  return Object.keys(WEIGHT_TO_G);
}

/**
 * Get all known count/descriptive units.
 * @returns {string[]}
 */
export function getCountUnits() {
  return Object.keys(COUNT_TO_G);
}

// Re-export tables for direct access if needed
export { VOLUME_TO_ML, WEIGHT_TO_G, COUNT_TO_G, INGREDIENT_DENSITY };
