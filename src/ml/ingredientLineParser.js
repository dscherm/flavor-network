/**
 * ingredientLineParser.js — WEAK-4: parse the leading amount of a RecipeNLG
 * ingredient LINE ("1 (16 oz.) pkg. spaghetti", "2 lbs. chicken",
 * "3 cloves garlic", "1 1/2 cups milk") into a kitchen-normalised amount.
 *
 * Build-time only (flavor-gnn/scripts/weak4_quantity_model.mjs); not imported
 * by the app. It replaces FM-Q1's parseLeadingAmount, which only recognised a
 * unit when the lowercased token was literally a UNIT_DENSITY key, so every
 * plural ("cups", "lbs", "ounces", "tablespoons"), every package
 * ("1 (16 oz.) pkg.") and every "garlic cloves" fell through to 'each'
 * (100 g) — and "T." (tablespoon) became 't' (teaspoon).
 *
 * Returns { qty, unit, dimension, base } or null:
 *   unit      canonical unit (kitchenUnits.normalizeUnit vocabulary)
 *   dimension 'volume' | 'weight' | 'count'
 *   base      ml | g | count (dozen → 12 each)
 */
import { normalizeUnit, unitDimension, toBase } from './kitchenUnits.js';

const UNICODE_FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)`;
const LEAD = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–|to|or)\s*(${NUM}))?\s*`, 'i');
const PAREN = new RegExp(String.raw`^\(\s*(?:about\s+|approx\.?\s+)?(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s*-?\s*(fl\.?\s*oz|[a-zA-Z]+)\.?[^)]*\)\s*`, 'i');
const TOKEN = /^([a-zA-Z]+)\.?(?=[\s,;)(-]|$)\s*/;
// Words between the number and the unit that don't change the amount.
const MODIFIERS = new Set(['heaping', 'heaped', 'level', 'rounded', 'scant', 'generous', 'good', 'big', 'extra', 'very', 'jumbo', 'fresh', 'x']);
// Size words: a count, possibly followed by a container/count noun ("1 small jar").
const SIZE_WORDS = new Set(['small', 'sm', 'medium', 'med', 'large', 'lg', 'lge', 'whole']);
// Count nouns found later in the line ("2 garlic cloves", "4 chicken breasts" → each).
const LOOKAHEAD_COUNT = ['clove', 'cloves', 'sprig', 'sprigs', 'can', 'cans', 'jar', 'jars', 'pkg', 'package', 'packages', 'envelope', 'box'];
const STICK_IS_VOLUME = /butter|margarine|shortening|oleo/i;

function parseNum(s) {
  const t = s.trim();
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return +m[3] ? +m[1] + +m[2] / +m[3] : null;
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return +m[2] ? +m[1] / +m[2] : null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

function parseRange(a, b) {
  const x = parseNum(a);
  if (x == null) return null;
  if (!b) return x;
  const y = parseNum(b);
  return y != null && y >= x ? (x + y) / 2 : x;
}

function readParen(rest) {
  const m = rest.match(PAREN);
  if (!m) return null;
  const qty = parseRange(m[1], m[2]);
  const unit = normalizeUnit(m[3].replace(/\.\s*/, ' ').replace(/\s+/, ' '));
  const dim = unitDimension(unit);
  if (qty == null || !(qty > 0) || (dim !== 'volume' && dim !== 'weight')) return { len: m[0].length, size: null };
  return { len: m[0].length, size: { qty, unit } };
}

function amount(qty, unit) {
  const dimension = unitDimension(unit);
  if (!dimension || !(qty > 0)) return null;
  return { qty, unit, dimension, base: toBase(qty, unit) };
}

/**
 * @param {string} line   one RecipeNLG ingredient line
 * @param {string} [name] the ingredient (NER token) — disambiguates "stick"
 */
export function parseIngredientLine(line, name = '') {
  if (!line) return null;
  let s = String(line).trim();
  s = s.replace(/(\d)\s*([½¼¾⅓⅔⅛⅜⅝⅞])/g, (_, d, f) => `${d} ${UNICODE_FRACTIONS[f]}`)
       .replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, (f) => UNICODE_FRACTIONS[f]);
  const lead = s.match(LEAD);
  if (!lead) return null;
  const qty = parseRange(lead[1], lead[2]);
  if (qty == null || !(qty > 0)) return null;
  let rest = s.slice(lead[0].length);

  // "1 (16 oz.) pkg. spaghetti" / "2 (6 oz.) salmon fillets"
  let size = null;
  const p1 = readParen(rest);
  if (p1) { size = p1.size; rest = rest.slice(p1.len); }

  // Unit token, skipping modifiers ("1 heaping tsp").
  let unit = null;
  let sizeWord = false;
  for (let guard = 0; guard < 3; guard++) {
    const t = rest.match(TOKEN);
    if (!t) break;
    const word = t[1];
    const lower = word.toLowerCase();
    if (MODIFIERS.has(lower)) { rest = rest.slice(t[0].length); continue; }
    if (SIZE_WORDS.has(lower)) { sizeWord = true; rest = rest.slice(t[0].length); continue; }
    if (lower === 'fl' && /^fl\.?\s*oz/i.test(rest)) { unit = 'floz'; rest = rest.replace(/^fl\.?\s*oz\.?\s*/i, ''); break; }
    const u = normalizeUnit(word);
    // After a size word only container/count nouns count ("1 large can");
    // "1 large egg" leaves the size word as the count.
    if (u && (!sizeWord || unitDimension(u) === 'count')) { unit = u; rest = rest.slice(t[0].length); }
    break;
  }
  if (unit === 'stick') unit = STICK_IS_VOLUME.test(`${name} ${rest}`) ? 'stick' : 'each';

  // "1 pkg. (8 oz.) cream cheese"
  if (!size && (unit === 'can' || unit === 'pkg' || unit == null || unit === 'each')) {
    const p2 = readParen(rest);
    if (p2 && p2.size) size = p2.size;
  }

  // A package / count with a stated size is really that weight or volume.
  if (size && (unit == null || unitDimension(unit) === 'count')) {
    const mult = unit === 'dozen' ? 12 : 1;
    return amount(qty * mult * size.qty, size.unit);
  }

  if (!unit) {
    // "2 garlic cloves", "1 tomato paste can": a count noun later in the line.
    const words = rest.toLowerCase().split(/[\s,;()]+/).slice(0, 4).map((w) => w.replace(/\.+$/, ''));
    const hit = words.find((w) => LOOKAHEAD_COUNT.includes(w));
    unit = hit ? normalizeUnit(hit) : 'each';
  }
  return amount(qty, unit);
}

// Plausibility caps per line, by dimension (a recipe line is never 5 kg of
// salt; "350" is an oven temperature that leaked into the line).
export const LINE_CAPS = { volume: 4000, weight: 5000, count: 48 };

export function isPlausible(a) {
  return !!a && a.base > 0 && a.base <= (LINE_CAPS[a.dimension] ?? Infinity);
}
