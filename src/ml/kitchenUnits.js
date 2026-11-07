/**
 * kitchenUnits.js — WEAK-4: kitchen-sensible units and quantities.
 *
 * Pure helpers shared by the amount-model build script
 * (flavor-gnn/scripts/weak4_quantity_model.mjs) and the in-app predictor
 * (src/ml/quantityModel.js):
 *
 *   normalizeUnit(token)        'c' / 'cups' / 'T' / 'Tbsp.' / 'lbs' → 'cup' / 'tbsp' / 'lb'
 *   unitDimension(unit)         'volume' | 'weight' | 'count'
 *   toBase(qty, unit)           volume → ml, weight → g, count → itself
 *   chooseVolumeUnit(ml, cat)   category rules: spices → tsp, oils/sauces → tbsp, …
 *   chooseWeightUnit(g, cat)    meat/fish/pasta → lb; small weights → oz
 *   roundKitchen(qty, unit)     ¼ ½ ¾ 1 1½ 2 …; g/ml to 25 steps; never "3.6 each"
 *   kitchenAmount(…)            base amount + dimension + category → {unit, qty}
 *   isKitchenQty(qty, unit)     the "no non-kitchen fraction" predicate
 *
 * Every unit this module emits is a key of UNIT_DENSITY / parseAmount's
 * vocabulary (src/data/portionParser.js), so the Notebook's gram weighting and
 * the re-parse of `amount.raw` keep working.
 */

// Raw token (lowercased, trailing dots stripped) → canonical unit.
// 't' / 'T' are case-sensitive and handled in normalizeUnit before lowering.
const ALIASES = {
  tsp: 'tsp', tsps: 'tsp', tspn: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', ts: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', tbls: 'tbsp', tblsp: 'tbsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp',
  c: 'cup', cup: 'cup', cups: 'cup',
  oz: 'oz', ozs: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', gm: 'g', gms: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', mls: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  pt: 'pint', pint: 'pint', pints: 'pint',
  qt: 'quart', qts: 'quart', quart: 'quart', quarts: 'quart',
  gal: 'gallon', gallon: 'gallon', gallons: 'gallon',
  pinch: 'pinch', pinches: 'pinch', dash: 'dash', dashes: 'dash',
  clove: 'clove', cloves: 'clove',
  sprig: 'sprig', sprigs: 'sprig',
  handful: 'handful', handfuls: 'handful',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  pkg: 'pkg', pkgs: 'pkg', pk: 'pkg', pkt: 'pkg', pkts: 'pkg', package: 'pkg', packages: 'pkg',
  packet: 'pkg', packets: 'pkg', box: 'pkg', boxes: 'pkg', bag: 'pkg', bags: 'pkg',
  jar: 'pkg', jars: 'pkg', bottle: 'pkg', bottles: 'pkg', envelope: 'pkg', envelopes: 'pkg',
  carton: 'pkg', cartons: 'pkg', container: 'pkg', containers: 'pkg', ctn: 'pkg',
  each: 'each', ea: 'each', whole: 'each', piece: 'each', pieces: 'each', pc: 'each', pcs: 'each',
  slice: 'each', slices: 'each', stalk: 'each', stalks: 'each', rib: 'each', ribs: 'each',
  head: 'each', heads: 'each', bunch: 'each', bunches: 'each', fillet: 'each', fillets: 'each',
  ear: 'each', ears: 'each', sq: 'each', square: 'each', squares: 'each', leaf: 'each', leaves: 'each',
  stick: 'stick', sticks: 'stick',
  small: 'each', sm: 'each', medium: 'each', med: 'each', large: 'each', lg: 'each', lge: 'each',
  dozen: 'dozen', doz: 'dozen',
  to_taste: 'to_taste',
};

/**
 * Normalise a unit token to its canonical kitchen name, or null when it is
 * not a unit. 'T' (capital) is tablespoon and 't' is teaspoon, per recipe
 * convention; every other token is case-insensitive ('C.' is a cup).
 */
export function normalizeUnit(token) {
  if (token == null) return null;
  const raw = String(token).trim().replace(/\.+$/, '');
  if (!raw) return null;
  if (raw === 'T' || raw === 'Tb' || raw === 'TB') return 'tbsp';
  if (raw === 't') return 'tsp';
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');
  if (lower === 'fl oz' || lower === 'fl. oz' || lower === 'floz') return 'floz';
  return ALIASES[lower] || null;
}

// ml per volume unit; g per weight unit.
export const VOLUME_ML = { tsp: 5, tbsp: 15, cup: 240, floz: 30, ml: 1, l: 1000, pint: 480, quart: 960, gallon: 3840, pinch: 0.3, dash: 0.6, stick: 120 };
export const WEIGHT_G = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
export const COUNT_UNITS = new Set(['each', 'clove', 'sprig', 'handful', 'can', 'pkg', 'dozen']);

/** 'volume' | 'weight' | 'count' | null for a canonical unit. */
export function unitDimension(unit) {
  if (VOLUME_ML[unit] != null) return 'volume';
  if (WEIGHT_G[unit] != null) return 'weight';
  if (COUNT_UNITS.has(unit)) return 'count';
  return null;
}

/** Convert to the dimension's base: ml, g, or a count (dozen → 12 each). */
export function toBase(qty, unit) {
  if (VOLUME_ML[unit] != null) return qty * VOLUME_ML[unit];
  if (WEIGHT_G[unit] != null) return qty * WEIGHT_G[unit];
  if (unit === 'dozen') return qty * 12;
  return qty;
}

// Category (public/proDataset/ingredients.json `category`) → the dimension a
// cook would measure it in when the recipe data is split. Tie-break only.
export const CATEGORY_DEFAULT_DIMENSION = {
  protein: 'weight',
  vegetable: 'count', fruit: 'count', aromatic: 'count', citrus: 'count', chili: 'count',
  fat: 'volume', condiment: 'volume', liquid: 'volume', acid: 'volume', umami: 'volume',
  sweetener: 'volume', spice: 'volume', seasoning: 'volume', herb: 'volume', dairy: 'volume',
  grain: 'volume', thickener: 'volume', nut: 'volume', confection: 'volume', baked: 'volume',
  spirit: 'volume', liqueur: 'volume', mixer: 'volume', bitters: 'volume', other: 'volume',
};

// Measured by the spoon well past the point other things go into a cup.
const SPICE_CATEGORIES = new Set(['spice', 'seasoning']);

/**
 * Pick the volume unit a cook would use for `ml` of an ingredient.
 * Below a tablespoon → tsp; spices/seasonings stay in spoons up to 3 tbsp
 * (½ cup of cumin is a spice-blend batch, not a recipe line); oils, sauces
 * and everything else → tbsp below ¼ cup, then cups (so 2 tbsp olive oil,
 * but ¼ cup vinegar rather than "4 tbsp").
 */
export function chooseVolumeUnit(ml, category) {
  if (ml < 14) return 'tsp';
  if (SPICE_CATEGORIES.has(category)) return ml <= 45 ? 'tbsp' : 'cup';
  return ml < 58 ? 'tbsp' : 'cup';
}

/** Meat, fish and dry pasta/grains by the pound from ~½ lb; else ounces under ~1 lb. */
export function chooseWeightUnit(g, category) {
  if (g >= 400) return 'lb';
  if ((category === 'protein' || category === 'grain') && g >= 200) return 'lb';
  return 'oz';
}

// Measuring spoons come in ⅛ ¼ ½ ¾ (no thirds); cups in ¼ ⅓ ½ ⅔ ¾ (no eighths).
const SPOON_FRACTIONS = [1 / 8, 1 / 4, 1 / 2, 3 / 4];
const CUP_FRACTIONS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];
const QUARTERS = [1 / 4, 1 / 2, 3 / 4];

function nearest(q, candidates) {
  let best = candidates[0];
  for (const c of candidates) if (Math.abs(c - q) < Math.abs(best - q) - 1e-12) best = c;
  return best;
}

function withWholes(fracs, max) {
  const out = [];
  for (let w = 0; w <= max; w++) {
    if (w > 0) out.push(w);
    for (const f of fracs) out.push(w + f);
  }
  return out;
}
const SPOON_STEPS = withWholes(SPOON_FRACTIONS, 1).concat([2]); // ⅛ ¼ ½ ¾ 1 1⅛ … 2
const CUP_STEPS = withWholes(CUP_FRACTIONS, 1).concat([2]);     // ¼ ⅓ ½ ⅔ ¾ 1 … 2
const QUARTER_STEPS = withWholes(QUARTERS, 1).concat([2]);      // ¼ … 1¾ 2

/**
 * Round to a quantity a cook can measure.
 *  - g / ml: 5-unit steps below 25, then 25-unit steps.
 *  - lb: quarter-pound steps (¼ ½ ¾ 1 1¼ …), halves above 2.
 *  - whole-item units (clove, sprig, handful, can, pkg): whole numbers, min 1.
 *  - each: ½ steps below 2 (half an onion), whole numbers from 2.
 *  - oz: ½ steps below 4, whole numbers above.
 *  - tsp / tbsp: ⅛ ¼ ½ ¾ 1 … below 2; cups and anything else: ¼ ⅓ ½ ⅔ ¾ 1 …
 *    below 2; then ½ steps to 5, whole numbers above.
 */
export function roundKitchen(qty, unit) {
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0) return null;
  if (unit === 'g' || unit === 'ml') {
    if (qty < 25) return Math.max(5, Math.round(qty / 5) * 5);
    return Math.round(qty / 25) * 25;
  }
  if (['clove', 'sprig', 'handful', 'can', 'pkg', 'pinch', 'dash'].includes(unit)) return Math.max(1, Math.round(qty));
  if (unit === 'each' || unit === 'small' || unit === 'medium' || unit === 'large') {
    if (qty < 2) return Math.max(0.5, Math.round(qty * 2) / 2);
    return Math.round(qty);
  }
  if (unit === 'lb') {
    if (qty <= 2) return nearest(qty, QUARTER_STEPS);
    return Math.round(qty * 2) / 2;
  }
  if (unit === 'oz') {
    if (qty < 4) return Math.max(0.5, Math.round(qty * 2) / 2);
    return Math.round(qty);
  }
  if (qty <= 2) return nearest(qty, unit === 'tsp' || unit === 'tbsp' ? SPOON_STEPS : CUP_STEPS);
  if (qty < 5) return Math.round(qty * 2) / 2;
  return Math.round(qty);
}

/** True when `qty` is something you could measure in `unit` (see roundKitchen). */
export function isKitchenQty(qty, unit) {
  const r = roundKitchen(qty, unit);
  return r != null && Math.abs(r - qty) < 1e-6;
}

/**
 * Turn a base amount (ml / g / count) in a chosen dimension into the
 * kitchen {unit, qty} for an ingredient category. `countUnit` is the modal
 * count unit for count-dimension ingredients (each / clove / can …).
 */
export function kitchenAmount({ dimension, base, category, countUnit = 'each' }) {
  if (!(base > 0)) return null;
  if (dimension === 'volume') {
    let unit = chooseVolumeUnit(base, category);
    let qty = roundKitchen(base / VOLUME_ML[unit], unit);
    // 3 tsp is a tablespoon; 4 tbsp of a non-spoon ingredient is ¼ cup.
    if (unit === 'tsp' && qty >= 3) { unit = 'tbsp'; qty = roundKitchen(qty / 3, 'tbsp'); }
    return { unit, qty };
  }
  if (dimension === 'weight') {
    const unit = chooseWeightUnit(base, category);
    return { unit, qty: roundKitchen(base / WEIGHT_G[unit], unit) };
  }
  if (dimension === 'count') {
    const unit = countUnit === 'dozen' ? 'each' : countUnit;
    return { unit, qty: roundKitchen(base, unit) };
  }
  return null;
}

/**
 * Normalise + round an arbitrary {unit, qty} (e.g. from an older artifact or
 * a hand-entered amount) into kitchen form. Volume and weight units are
 * re-expressed in the closest kitchen unit (0.83 c → ¾ cup; 3 tsp → 1 tbsp);
 * count units keep their noun and round.
 */
export function toKitchen(unit, qty, category) {
  const u = normalizeUnit(unit) || unit;
  if (typeof qty !== 'number' || !(qty > 0)) return { unit: u, qty };
  const dim = unitDimension(u);
  if (dim === 'volume' && u !== 'pinch' && u !== 'dash') {
    return kitchenAmount({ dimension: 'volume', base: toBase(qty, u), category });
  }
  if (dim === 'weight') {
    // Respect metric input: grams stay grams (25 g steps), kg → g.
    if (u === 'g' || u === 'kg') return { unit: 'g', qty: roundKitchen(toBase(qty, u), 'g') };
    return kitchenAmount({ dimension: 'weight', base: toBase(qty, u), category });
  }
  if (u === 'dozen') return { unit: 'each', qty: roundKitchen(qty * 12, 'each') };
  return { unit: u, qty: roundKitchen(qty, u) ?? qty };
}

/** "1 1/2", "3/4", "2" — ASCII kitchen fractions that parseAmount re-reads. */
export function formatKitchenQty(qty) {
  if (typeof qty !== 'number' || !Number.isFinite(qty)) return '';
  const whole = Math.floor(qty + 1e-9);
  const frac = qty - whole;
  const names = [[1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']];
  const hit = names.find(([v]) => Math.abs(v - frac) < 0.01);
  if (frac < 0.01) return String(whole);
  if (!hit) return String(Math.round(qty * 100) / 100);
  return whole ? `${whole} ${hit[1]}` : hit[1];
}
