/**
 * portionParser — RECIPE-LAB-SPEC §11.2 free-text amount parser +
 * §13.2 UNIT_DENSITY gram-conversion table.
 *
 * Forgiving parser that turns user free-text like "1 1/2 cups" /
 * "a pinch" / "to taste" into structured `{qty, unit}` for §13
 * focal-weighted suggestion ranking. Free-text is the source of
 * truth for display; structured fields are derived.
 *
 * Returns `null` for unparseable input; the caller stores only
 * `amount.raw` in that case (no UI error).
 */

// §13.2 — gram-conversion density for every input token §11.2 lists.
// Approximate water-equivalent values; goal is proportional ordering,
// not nutritional accuracy. Both canonical short forms ('tsp') and
// long aliases ('teaspoon') are keyed so downstream consumers can
// look up either form directly without normalization.
export const UNIT_DENSITY = {
  tsp: 5, teaspoon: 5, t: 5,
  tbsp: 15, tablespoon: 15, T: 15,
  cup: 240, c: 240,
  g: 1, gram: 1,
  oz: 28.35, ounce: 28.35,
  lb: 453.6, pound: 453.6,
  ml: 1,
  l: 1000, liter: 1000,
  each: 100,
  medium: 100,
  small: 50,
  large: 200,
  pinch: 1,
  dash: 1,
  sprig: 2,
  clove: 3,
  handful: 30,
  to_taste: 1,
};

// Input-variant → canonical short form mapping. parseAmount always
// returns the canonical (e.g. 'tsp' not 'teaspoon', 'cup' not 'cups')
// so the unit field is stable across user input variations.
const UNIT_NORMALIZE = {
  tsp: 'tsp', teaspoon: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp',
  cup: 'cup', c: 'cup',
  g: 'g', gram: 'g',
  oz: 'oz', ounce: 'oz',
  lb: 'lb', pound: 'lb',
  ml: 'ml',
  l: 'l', liter: 'l', litre: 'l',
  each: 'each',
  medium: 'medium',
  small: 'small',
  large: 'large',
  pinch: 'pinch',
  dash: 'dash',
  sprig: 'sprig',
  clove: 'clove',
  handful: 'handful',
  to_taste: 'to_taste',
};

function normalizeUnitToken(token) {
  // Case-sensitive 't'/'T' disambiguation per recipe convention
  // (lowercase t = teaspoon, uppercase T = tablespoon). This is the
  // ONLY case-sensitive token; everything else lowercases first.
  if (token === 'T') return 'tbsp';
  if (token === 't') return 'tsp';
  const lower = token.toLowerCase();
  if (UNIT_NORMALIZE[lower]) return UNIT_NORMALIZE[lower];
  // Basic plural fallback: strip trailing 's' and retry.
  if (lower.endsWith('s')) {
    const singular = lower.slice(0, -1);
    if (UNIT_NORMALIZE[singular]) return UNIT_NORMALIZE[singular];
  }
  return null;
}

function parseQuantity(token) {
  // Mixed: "1 1/2"
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const w = parseInt(mixed[1], 10);
    const n = parseInt(mixed[2], 10);
    const d = parseInt(mixed[3], 10);
    if (d === 0) return null;
    return w + n / d;
  }
  // Simple fraction: "1/2"
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const n = parseInt(frac[1], 10);
    const d = parseInt(frac[2], 10);
    if (d === 0) return null;
    return n / d;
  }
  // Decimal or integer: "1.5", "2"
  const num = token.match(/^(\d+(?:\.\d+)?)$/);
  if (num) return parseFloat(num[1]);
  return null;
}

export function parseAmount(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Sentinel: "to taste" (case-insensitive, any whitespace between words)
  if (/^to\s+taste$/i.test(trimmed)) {
    return { qty: null, unit: 'to_taste' };
  }

  // Article + unit, no qty: "a pinch", "an ounce" → {qty: null, unit}
  const articleMatch = trimmed.match(/^(?:a|an)\s+(\S+)$/i);
  if (articleMatch) {
    const unit = normalizeUnitToken(articleMatch[1]);
    if (unit) return { qty: null, unit };
    return null;
  }

  // Mixed number + unit: "1 1/2 cups"
  const mixedMatch = trimmed.match(/^(\d+\s+\d+\/\d+)\s+(\S+)$/);
  if (mixedMatch) {
    const qty = parseQuantity(mixedMatch[1]);
    const unit = normalizeUnitToken(mixedMatch[2]);
    if (qty !== null && unit) return { qty, unit };
    return null;
  }

  // Number + unit (decimal, integer, simple fraction): "1 tbsp", "0.5 cup", "1/2 cup"
  const simpleMatch = trimmed.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s+(\S+)$/);
  if (simpleMatch) {
    const qty = parseQuantity(simpleMatch[1]);
    const unit = normalizeUnitToken(simpleMatch[2]);
    if (qty !== null && unit) return { qty, unit };
    return null;
  }

  // Compact: "1tbsp" (no space)
  const compactMatch = trimmed.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (compactMatch) {
    const qty = parseFloat(compactMatch[1]);
    const unit = normalizeUnitToken(compactMatch[2]);
    if (!Number.isNaN(qty) && unit) return { qty, unit };
    return null;
  }

  // Bare unit, no qty: "pinch", "to_taste"
  const bareUnit = normalizeUnitToken(trimmed);
  if (bareUnit) return { qty: null, unit: bareUnit };

  return null;
}
