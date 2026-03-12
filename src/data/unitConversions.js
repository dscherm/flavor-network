/**
 * unitConversions.js — Comprehensive cooking unit conversion table.
 *
 * Converts common cooking units to a normalized base (mL for volume, grams for weight).
 * Includes ingredient-specific density overrides so that "1 cup flour" != "1 cup butter".
 *
 * Primary export: convertToBase(quantity, unit, ingredientName) -> { value, unit }
 * Legacy export:  toGrams(quantity, unit, ingredientName) -> number|null
 */

// ---------------------------------------------------------------------------
// Volume units -> mL
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
  deciliters: 100,
  cl: 10,
  centiliter: 10,
  centiliters: 10,
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
// Weight units -> grams
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
// Count / descriptive units -> approximate grams
// ---------------------------------------------------------------------------
const COUNT_TO_G = {
  // Small measures
  clove: 5,
  cloves: 5,
  pinch: 0.36,         // ~1/16 tsp
  pinches: 0.36,
  dash: 0.62,          // ~1/8 tsp
  dashes: 0.62,
  smidgen: 0.18,
  drop: 0.05,
  drops: 0.05,

  // Produce & herbs
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
  head: 200,
  heads: 200,
  stalk: 60,
  stalks: 60,
  ear: 150,            // ear of corn
  ears: 150,
  knob: 10,            // e.g., knob of ginger
  strip: 10,
  strips: 10,

  // Dairy / baking
  stick: 113,           // 1 stick butter = 113 g
  sticks: 113,

  // Containers
  can: 400,             // ~14 oz can
  cans: 400,
  packet: 7,            // e.g., yeast packet
  envelope: 7,

  // Proteins
  filet: 170,           // ~6 oz portion
  fillet: 170,
  breast: 200,
  thigh: 120,
  drumstick: 100,
  wing: 50,
  rib: 150,
  chop: 170,
  shank: 350,
  lobe: 200,

  // Informal volume
  handful: 30,
  splash: 5,
  glug: 15,
  drizzle: 5,
  dollop: 30,
  scoop: 60,

  // Size modifiers used as units
  small: 50,
  medium: 100,
  large: 150,
};

// ---------------------------------------------------------------------------
// Vague / qualitative units -> minimum gram estimates
// ---------------------------------------------------------------------------
const VAGUE_TO_G = {
  'to taste': 1,
  'as needed': 5,
  some: 15,
  handful: 30,
  'a little': 5,
  'a lot': 50,
  optional: 0,
  garnish: 2,
  'for garnish': 2,
  'for serving': 15,
  'as desired': 10,
};

// ---------------------------------------------------------------------------
// Ingredient-specific densities -- grams per mL
// Used to convert volume measurements to grams for specific ingredients.
//
// Canonical densities from task spec:
//   water=1.0, flour=0.53, sugar=0.85, butter=0.91, oil=0.92,
//   honey=1.42, rice=0.85, salt=1.22, cocoa=0.52
// ---------------------------------------------------------------------------
const INGREDIENT_DENSITY = {
  // Flours & starches
  flour: 0.53,
  'all-purpose flour': 0.53,
  'ap flour': 0.53,
  'bread flour': 0.55,
  'cake flour': 0.48,
  'whole wheat flour': 0.51,
  'pastry flour': 0.50,
  'almond flour': 0.40,
  'coconut flour': 0.50,
  'rice flour': 0.60,
  'semolina': 0.60,
  cornstarch: 0.54,
  'corn starch': 0.54,
  'tapioca starch': 0.54,
  'arrowroot': 0.54,
  'powdered sugar': 0.50,
  'confectioners sugar': 0.50,
  'icing sugar': 0.50,

  // Sugars & syrups
  sugar: 0.85,
  'granulated sugar': 0.85,
  'white sugar': 0.85,
  'brown sugar': 0.93,
  'light brown sugar': 0.93,
  'dark brown sugar': 0.95,
  'caster sugar': 0.80,
  'demerara sugar': 0.87,
  'turbinado sugar': 0.87,
  honey: 1.42,
  'maple syrup': 1.32,
  molasses: 1.42,
  'corn syrup': 1.38,
  agave: 1.35,
  'golden syrup': 1.38,
  treacle: 1.40,

  // Fats & oils
  butter: 0.91,
  'unsalted butter': 0.91,
  'salted butter': 0.91,
  ghee: 0.93,
  'olive oil': 0.92,
  'extra virgin olive oil': 0.92,
  'vegetable oil': 0.92,
  'canola oil': 0.92,
  'coconut oil': 0.92,
  'sesame oil': 0.92,
  'avocado oil': 0.91,
  'peanut oil': 0.92,
  'sunflower oil': 0.92,
  'grapeseed oil': 0.92,
  oil: 0.92,
  lard: 0.92,
  shortening: 0.82,
  'cream cheese': 0.98,
  margarine: 0.90,

  // Dairy
  milk: 1.03,
  'whole milk': 1.03,
  'skim milk': 1.03,
  '2% milk': 1.03,
  cream: 1.01,
  'heavy cream': 1.01,
  'whipping cream': 1.01,
  'half and half': 1.02,
  'sour cream': 1.01,
  yogurt: 1.03,
  'greek yogurt': 1.10,
  buttermilk: 1.03,
  'condensed milk': 1.28,
  'evaporated milk': 1.07,
  'coconut milk': 0.97,
  'coconut cream': 1.06,

  // Liquids
  water: 1.0,
  broth: 1.0,
  stock: 1.0,
  'chicken broth': 1.0,
  'beef broth': 1.0,
  'vegetable broth': 1.0,
  wine: 0.99,
  'white wine': 0.99,
  'red wine': 0.99,
  beer: 1.01,
  vinegar: 1.01,
  'apple cider vinegar': 1.01,
  'balsamic vinegar': 1.05,
  'rice vinegar': 1.01,
  'white vinegar': 1.01,
  'soy sauce': 1.15,
  'fish sauce': 1.14,
  'worcestershire sauce': 1.13,
  'hot sauce': 1.05,
  juice: 1.04,
  'lemon juice': 1.03,
  'lime juice': 1.03,
  'orange juice': 1.04,
  'tomato paste': 1.10,
  'tomato sauce': 1.04,
  ketchup: 1.14,
  mustard: 1.05,
  mayonnaise: 0.91,

  // Grains & dried goods
  rice: 0.85,
  'white rice': 0.85,
  'brown rice': 0.82,
  'basmati rice': 0.80,
  'jasmine rice': 0.85,
  'arborio rice': 0.85,
  oats: 0.36,
  'rolled oats': 0.36,
  'steel cut oats': 0.60,
  quinoa: 0.74,
  couscous: 0.63,
  breadcrumbs: 0.48,
  panko: 0.22,
  'cocoa powder': 0.52,
  cocoa: 0.52,
  'baking powder': 0.77,
  'baking soda': 0.92,

  // Nuts & seeds
  almonds: 0.60,
  walnuts: 0.47,
  pecans: 0.45,
  'pine nuts': 0.56,
  peanuts: 0.60,
  cashews: 0.55,
  pistachios: 0.52,
  hazelnuts: 0.55,
  macadamia: 0.52,
  'sesame seeds': 0.57,
  'poppy seeds': 0.60,
  'flax seeds': 0.60,
  'chia seeds': 0.65,
  'sunflower seeds': 0.55,
  'pumpkin seeds': 0.55,

  // Nut butters
  'peanut butter': 1.09,
  'almond butter': 1.06,
  tahini: 1.04,

  // Cheese (grated)
  parmesan: 0.42,
  'cheddar cheese': 0.45,
  mozzarella: 0.50,
  'ricotta': 1.02,

  // Spices (ground, approximate)
  salt: 1.22,
  'table salt': 1.22,
  'kosher salt': 0.58,
  'sea salt': 1.10,
  pepper: 0.45,
  'black pepper': 0.45,
  'white pepper': 0.50,
  cinnamon: 0.53,
  'ground cinnamon': 0.53,
  cumin: 0.47,
  'ground cumin': 0.47,
  paprika: 0.46,
  'smoked paprika': 0.46,
  'chili powder': 0.45,
  'cayenne pepper': 0.45,
  'garlic powder': 0.56,
  'onion powder': 0.53,
  ginger: 0.40,
  'ground ginger': 0.40,
  turmeric: 0.63,
  'ground turmeric': 0.63,
  nutmeg: 0.47,
  'ground nutmeg': 0.47,
  cloves: 0.42,
  'ground cloves': 0.42,
  cardamom: 0.40,
  'ground cardamom': 0.40,
  allspice: 0.46,
  'ground allspice': 0.46,
  'curry powder': 0.45,
  'five spice': 0.45,
  'italian seasoning': 0.20,
  oregano: 0.20,
  thyme: 0.27,
  basil: 0.20,
  rosemary: 0.33,
  sage: 0.22,
  'bay leaf': 0.15,
  dill: 0.20,
  parsley: 0.24,
  cilantro: 0.20,
  mint: 0.20,
  tarragon: 0.22,
  marjoram: 0.22,
  'chili flakes': 0.35,
  'red pepper flakes': 0.35,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a raw unit string: lowercase, trim, strip trailing period/comma,
 * collapse whitespace.
 * @param {string|null} unit
 * @returns {string}
 */
export function normalizeUnit(unit) {
  if (!unit) return '';
  return unit.toLowerCase().trim().replace(/[.,]$/, '').replace(/\s+/g, ' ');
}

/**
 * Check if a unit is a volume measurement.
 * @param {string} unit -- normalized unit string
 * @returns {boolean}
 */
export function isVolumeUnit(unit) {
  return unit in VOLUME_TO_ML;
}

/**
 * Check if a unit is a weight measurement.
 * @param {string} unit -- normalized unit string
 * @returns {boolean}
 */
export function isWeightUnit(unit) {
  return unit in WEIGHT_TO_G;
}

/**
 * Check if a unit is a count/descriptive measurement.
 * @param {string} unit -- normalized unit string
 * @returns {boolean}
 */
export function isCountUnit(unit) {
  return unit in COUNT_TO_G;
}

/**
 * Check if a unit is vague/qualitative.
 * @param {string} unit -- normalized unit string
 * @returns {boolean}
 */
export function isVagueUnit(unit) {
  return unit in VAGUE_TO_G;
}

/**
 * Look up ingredient density (g/mL). Falls back to 1.0 (water).
 * Tries exact match first, then substring match against known ingredients.
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

  // Substring match -- e.g. "unsalted butter" matches "butter"
  // Try longer keys first for more specific matches
  const sortedKeys = Object.keys(INGREDIENT_DENSITY)
    .sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (name.includes(key) || key.includes(name)) {
      return INGREDIENT_DENSITY[key];
    }
  }

  return 1.0;
}

// ---------------------------------------------------------------------------
// Quantity parsing helpers
// ---------------------------------------------------------------------------

// Unicode fraction map
const UNICODE_FRACTIONS = {
  '\u00BC': 0.25,  // 1/4
  '\u00BD': 0.5,   // 1/2
  '\u00BE': 0.75,  // 3/4
  '\u2153': 1 / 3, // 1/3
  '\u2154': 2 / 3, // 2/3
  '\u215B': 0.125, // 1/8
  '\u215C': 3 / 8, // 3/8
  '\u215D': 5 / 8, // 5/8
  '\u215E': 7 / 8, // 7/8
};

/**
 * Parse a quantity string that may contain fractions, mixed numbers, ranges,
 * or unicode fraction characters.
 *
 * Examples:
 *   "1"       -> 1
 *   "1/2"     -> 0.5
 *   "1 1/2"   -> 1.5
 *   "2-3"     -> 2.5  (midpoint)
 *   "1/2-1"   -> 0.75 (midpoint)
 *   "\u00BD"  -> 0.5
 *   null      -> null
 *
 * @param {string|number|null} raw
 * @returns {number|null}
 */
export function parseQuantity(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw > 0 ? raw : null;

  let str = String(raw).trim();
  if (!str) return null;

  // Replace unicode fractions
  for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (str.includes(char)) {
      // Handle mixed number like "1\u00BD" -> "1" + 0.5
      str = str.replace(char, ` ${val} `);
    }
  }

  str = str.trim();

  // Handle ranges: "1-2", "1 to 2", "1 - 2"
  const rangeMatch = str.match(
    /^([\d\s./]+?)\s*(?:-|to|or)\s*([\d\s./]+)$/i
  );
  if (rangeMatch) {
    const lo = parseSingleQuantity(rangeMatch[1].trim());
    const hi = parseSingleQuantity(rangeMatch[2].trim());
    if (lo != null && hi != null) return (lo + hi) / 2;
    return lo ?? hi;
  }

  return parseSingleQuantity(str);
}

/**
 * Parse a single (non-range) quantity string.
 * Handles: "3", "1/2", "1 1/2", "2.5"
 * @param {string} str
 * @returns {number|null}
 */
function parseSingleQuantity(str) {
  if (!str) return null;

  // Try plain number first
  const plain = Number(str);
  if (!Number.isNaN(plain) && plain > 0) return plain;

  // Mixed number: "1 1/2" or "2 3/4"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    if (den !== 0) return whole + num / den;
  }

  // Simple fraction: "1/2", "3/4"
  const fracMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (den !== 0) return num / den;
  }

  // Space-separated values that should be summed (from unicode replacement)
  const parts = str.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    let sum = 0;
    for (const p of parts) {
      const v = parseSingleQuantity(p);
      if (v != null) sum += v;
    }
    return sum > 0 ? sum : null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core conversion functions
// ---------------------------------------------------------------------------

/**
 * Convert a quantity + unit pair to a normalized gram equivalent.
 *
 * Strategy:
 *   1. Weight units -> direct conversion to grams.
 *   2. Volume units -> convert to mL, then multiply by ingredient density
 *      (defaults to water = 1.0 g/mL if ingredient unknown).
 *   3. Vague units -> minimum gram estimate.
 *   4. Count/descriptive units -> direct gram estimate.
 *   5. Unitless -> treat as count x 30g default.
 *   6. Unknown unit -> quantity x 15g fallback.
 *
 * @param {number|null} quantity
 * @param {string|null} unit
 * @param {string|null} ingredientName -- optional, for density lookup
 * @returns {number|null} -- grams, or null if quantity is missing/invalid
 */
export function toGrams(quantity, unit, ingredientName = null) {
  if (quantity == null || quantity <= 0) return null;

  const norm = normalizeUnit(unit);

  // No unit -- treat as generic count
  if (!norm) {
    return quantity * 30;
  }

  // Weight units -> direct to grams
  if (norm in WEIGHT_TO_G) {
    return quantity * WEIGHT_TO_G[norm];
  }

  // Volume units -> mL -> grams via density
  if (norm in VOLUME_TO_ML) {
    const ml = quantity * VOLUME_TO_ML[norm];
    const density = getDensity(ingredientName);
    return ml * density;
  }

  // Vague units -> minimum estimate
  if (norm in VAGUE_TO_G) {
    return quantity * VAGUE_TO_G[norm];
  }

  // Count / descriptive units
  if (norm in COUNT_TO_G) {
    return quantity * COUNT_TO_G[norm];
  }

  // Unknown unit fallback
  return quantity * 15;
}

/**
 * Convert a quantity + unit pair to a normalized volume in mL.
 * For weight inputs, uses density to estimate volume.
 * For count/vague inputs, estimates grams then divides by density.
 *
 * @param {number|null} quantity
 * @param {string|null} unit
 * @param {string|null} ingredientName
 * @returns {number|null} -- mL, or null if quantity is missing/invalid
 */
export function toML(quantity, unit, ingredientName = null) {
  if (quantity == null || quantity <= 0) return null;

  const norm = normalizeUnit(unit);
  const density = getDensity(ingredientName);

  // Volume units -> direct to mL
  if (norm && norm in VOLUME_TO_ML) {
    return quantity * VOLUME_TO_ML[norm];
  }

  // Everything else -> grams first, then divide by density
  const grams = toGrams(quantity, unit, ingredientName);
  if (grams == null) return null;
  return grams / density;
}

/**
 * Convert a quantity + unit to a normalized base value, returning both
 * the numeric value and the base unit type ('g' or 'mL').
 *
 * Weight inputs and count/vague inputs -> grams.
 * Volume inputs -> mL.
 *
 * This is the primary API for converting recipe quantities to a common scale.
 *
 * Handles string quantities with fractions and ranges:
 *   convertToBase("1 1/2", "cups", "flour")  -> { value: 188.0, unit: 'mL' }
 *   convertToBase("2-3", "tbsp", "oil")       -> { value: 36.97, unit: 'mL' }
 *   convertToBase(4, "oz", "chicken")          -> { value: 113.4, unit: 'g' }
 *   convertToBase(1, "to taste", "salt")       -> { value: 1, unit: 'g' }
 *
 * @param {number|string|null} quantity -- raw quantity (number, fraction string, range)
 * @param {string|null} unit
 * @param {string|null} ingredientName -- optional, for density-aware conversion
 * @returns {{ value: number, unit: string }|null} -- normalized value and base unit,
 *          or null if quantity cannot be parsed
 */
export function convertToBase(quantity, unit, ingredientName = null) {
  const parsedQty = parseQuantity(quantity);
  if (parsedQty == null || parsedQty <= 0) return null;

  const norm = normalizeUnit(unit);

  // Volume units -> mL
  if (norm && norm in VOLUME_TO_ML) {
    const ml = parsedQty * VOLUME_TO_ML[norm];
    return { value: Math.round(ml * 100) / 100, unit: 'mL' };
  }

  // Everything else -> grams (weight, count, vague, unknown)
  const grams = toGrams(parsedQty, unit, ingredientName);
  if (grams == null) return null;
  return { value: Math.round(grams * 100) / 100, unit: 'g' };
}

// ---------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------

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

/**
 * Get all known vague/qualitative units.
 * @returns {string[]}
 */
export function getVagueUnits() {
  return Object.keys(VAGUE_TO_G);
}

/**
 * Get all known ingredient names with densities.
 * @returns {string[]}
 */
export function getKnownIngredients() {
  return Object.keys(INGREDIENT_DENSITY);
}

// Re-export tables for direct access if needed
export { VOLUME_TO_ML, WEIGHT_TO_G, COUNT_TO_G, VAGUE_TO_G, INGREDIENT_DENSITY };
