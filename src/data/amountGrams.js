/**
 * amountGrams.js — how much an ingredient line weighs, as a gram-equivalent, so a flavor chart can weight
 * a dash of bitters against two ounces of gin. Pure.
 *
 * Accepts what the surfaces hold: a { qty, unit } object (the Recipe Notebook's BowlEntry.amount, from
 * portionParser.parseAmount), a number (grams), or the free text of a recipe line ("2 oz", "~¾ oz",
 * "3 cl", "2 dashes", "Top with soda", "1 tbsp, grated"). Returns null when the amount is unknown; the
 * caller then gives the line the mean known weight.
 */
import { UNIT_DENSITY, parseAmount } from './portionParser.js';

const VULGAR = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

// Words a recipe line uses → the key in UNIT_DENSITY.
const UNIT_WORD = {
  oz: 'oz', ounce: 'oz', cl: 'cl', ml: 'ml', dash: 'dash', drop: 'drop', splash: 'splash', shot: 'shot',
  jigger: 'jigger', part: 'part', barspoon: 'barspoon', 'bar spoon': 'barspoon', tsp: 'tsp', teaspoon: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', cup: 'cup', g: 'g', gram: 'g', kg: 'kg', kilogram: 'kg', kilo: 'kg', lb: 'lb', pound: 'lb', l: 'l', liter: 'l', litre: 'l',
  pinch: 'pinch', sprig: 'sprig', clove: 'clove', handful: 'handful', can: 'can', bunch: 'bunch', top: 'top', fill: 'fill',
  slice: 'slice', wedge: 'wedge', leaf: 'leaf', leaves: 'leaf', leave: 'leaf', stalk: 'stalk', each: 'each', medium: 'medium', small: 'small', large: 'large',
};

const unitKey = (word) => {
  const w = String(word || '').toLowerCase().replace(/\.$/, '');
  return UNIT_WORD[w] || UNIT_WORD[w.replace(/s$/, '')] || UNIT_WORD[w.replace(/es$/, '')] || null;
};

/** Free text → { qty, unit } with a unit key UNIT_DENSITY knows, or null. */
export function parseAmountText(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toLowerCase().replace(/^[~≈]\s*/, '').replace(/^about\s+/, '');
  s = s.replace(/(\d)\s*([¼½¾⅓⅔⅛⅜⅝⅞])/g, (_, d, f) => String(Number(d) + VULGAR[f]))
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (f) => String(VULGAR[f]));
  s = s.split(',')[0].trim();
  if (!s) return null;
  const strict = parseAmount(s);
  if (strict && strict.unit && UNIT_DENSITY[strict.unit] != null) return strict;
  const top = s.match(/^(top|fill)\b/);
  if (top) return { qty: 1, unit: top[1] };
  const m = s.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([a-z][a-z ]*)?/);
  if (m) {
    const q = m[1].includes('/')
      ? m[1].trim().split(/\s+/).reduce((t, p) => t + (p.includes('/') ? Number(p.split('/')[0]) / Number(p.split('/')[1]) : Number(p)), 0)
      : Number(m[1]);
    const words = (m[2] || '').trim().split(/\s+/);
    const unit = unitKey(words.slice(0, 2).join(' ')) || unitKey(words[0]);
    return unit && Number.isFinite(q) ? { qty: q, unit } : null;
  }
  const bare = unitKey(s.replace(/^(a|an)\s+/, '').split(/\s+/)[0]);
  return bare ? { qty: 1, unit: bare } : null;
}

/**
 * Gram-equivalent weight of an amount, or null when unknown. A unit-only amount ("a pinch") counts as
 * one; an object whose unit is not in UNIT_DENSITY counts as 'each'. A bare count with no unit is
 * unknown, not a measure.
 */
export function amountGrams(amount) {
  if (amount == null || amount === '') return null;
  if (typeof amount === 'number') return amount > 0 ? amount : null;
  const a = typeof amount === 'string' ? parseAmountText(amount) : amount;
  if (!a) return null;
  const { qty, unit } = a;
  if (qty == null && unit == null) return null;
  const density = unit ? (UNIT_DENSITY[unit] != null ? UNIT_DENSITY[unit] : UNIT_DENSITY.each) : null;
  if (density == null) return null;
  return (qty == null ? 1 : qty) * density;
}
