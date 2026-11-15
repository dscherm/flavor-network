/**
 * flavorAroma.js — the aroma half of every flavor chart (FLAVOR-5), the way flavorTaste.js is the taste half.
 * Pure: no fetch, no React.
 *
 * Six chart axes (ids kept from the model-era chart so every surface keeps working): odor_fruity, odor_floral,
 * odor_green, odor_woody, odor_spicy, odor_fatty. "spicy" is the aroma of aromatic spice, not chili heat (heat is a
 * taste axis); the chart's label for it is "Spice" (recipeScoring.AROMA_LABELS). See flavorAromas.js for what each
 * axis means and where the numbers come from.
 *
 * Each ingredient with a line in flavorAromas.js counts as having aroma data, including ones with no aroma of their
 * own (water, sugar, salt, vodka), which dilute the rest at AROMALESS_WEIGHT of their amount. An ingredient with no
 * line has NO aroma data and is not counted. `lookup` is an optional fallback source (key => { axes, potency } | null)
 * consulted only for ingredients the table does not hold; the app passes none.
 *
 * A chart value for an axis = sum(grams x potency x strength/3) / sum(grams x potency), so it stays within 0..1.
 */
import { amountGrams } from './amountGrams.js';
import { defaultGrams } from './flavorStrengths.js';
import { aromaFor } from './flavorAromas.js';

export const AROMA_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const SHORT = AROMA_AXES.map((a) => a.slice(5));
/** The top of the 0..3 strength scale used by flavorAromas.js. */
export const AROMA_STRENGTH_MAX = 3;

/**
 * How much of its amount an ingredient with no aroma of its own counts against the rest. Same reasoning as
 * TASTELESS_WEIGHT in flavorTaste.js: a long drink should read fainter than the same drink neat, and soda must not
 * wipe the chart out.
 */
export const AROMALESS_WEIGHT = 0.25;
/** Grams one counted unit of an unmeasured, strongly aromatic ingredient is taken as (when nothing better is known). */
export const POTENT_AROMA_DEFAULT_GRAMS = 3;

const zeroAxes = () => Object.fromEntries(AROMA_AXES.map((a) => [a, 0]));

/**
 * One ingredient's aroma on the 0..3 scale: { axes (odor_ ids), potency, any, aromaless, fromTable } or
 * { any: false } when nothing is known about it.
 */
export function ingredientAroma(key, { table = aromaFor, lookup = null } = {}) {
  const row = (table ? table(key) : null) || (lookup ? lookup(key) : null);
  if (!row) return { axes: zeroAxes(), potency: 0, any: false, aromaless: true, fromTable: false };
  const axes = zeroAxes();
  for (const a of SHORT) axes[`odor_${a}`] = row.axes?.[a] ?? row.axes?.[`odor_${a}`] ?? 0;
  const aromaless = row.potency <= 0 || !AROMA_AXES.some((a) => axes[a] > 0);
  return { axes, potency: row.potency, any: true, aromaless, fromTable: Boolean(table && table(key)) };
}

/**
 * A bare count of a whole citrus fruit ("1 orange", "twist orange peel: 1") counts for AROMA as its zest, not the whole
 * fruit: the smell of a citrus fruit lives in the peel, and a recipe line that says "orange peel" resolves to the fruit.
 * (The taste half still weighs the whole fruit: flavorStrengths.DEFAULT_GRAMS.)
 */
export const CITRUS_ZEST_GRAMS = { lemon: 6, lime: 5, orange: 8, grapefruit: 10 };

/** Grams to use for an aroma line whose amount cannot be read: a typical portion, or null (the recipe's mean is used). */
function unmeasuredGrams(key, amount, row) {
  const zest = CITRUS_ZEST_GRAMS[String(key).trim().toLowerCase()];
  if (zest != null) {
    const m = String(typeof amount === 'object' && amount ? (amount.qty ?? '') : (amount ?? '')).trim().match(/^(\d+(?:\.\d+)?)/);
    return zest * (m ? Number(m[1]) : 1);
  }
  const g = defaultGrams(key, amount);
  if (g != null) return g;
  if (!row.any || row.aromaless || row.potency <= 2) return null;
  const m = String(amount ?? '').trim().match(/^(\d+(?:\.\d+)?)/);
  return POTENT_AROMA_DEFAULT_GRAMS * (m ? Number(m[1]) : 1);
}

/**
 * aromaProfile(lines, lookup, opts) → { scores, counted, uncounted, n, weighted, drivers, charted }
 *  lines   [{ key, amount? }]; amount is a string ("2 oz"), a { qty, unit } object or grams (number)
 *  lookup  optional (key) => { axes, potency } | null, a fallback for ingredients the table lacks
 *  opts    { aromalessWeight = AROMALESS_WEIGHT, table }  (table: null switches the hand-tuned table off)
 * scores is keyed odor_fruity ... odor_fatty. No amounts known: equal weights. Some known: the unknown ones get a
 * typical portion if the ingredient has one, else the mean known amount. `charted` is false when every counted
 * ingredient has no aroma of its own.
 */
export function aromaProfile(lines, lookup = null, opts = {}) {
  const f = opts.aromalessWeight ?? AROMALESS_WEIGHT;
  const table = opts.table === null ? null : (opts.table || aromaFor);
  const rows = [];
  const counted = [];
  const uncounted = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    const key = typeof l === 'string' ? l : l?.key;
    if (!key) continue;
    const a = ingredientAroma(key, { table, lookup });
    if (!a.any) { uncounted.push(key); continue; }
    counted.push(key);
    const amount = typeof l === 'string' ? null : l.amount;
    const grams = typeof l === 'string' ? null : amountGrams(amount);
    rows.push({ key, a, grams, dflt: grams == null && typeof l !== 'string' ? unmeasuredGrams(key, amount, a) : null });
  }
  const known = rows.map((r) => r.grams).filter((g) => g != null && g > 0);
  const weighted = known.length > 0;
  const fallback = weighted ? known.reduce((s, g) => s + g, 0) / known.length : 1;

  const scores = zeroAxes();
  const contrib = Object.fromEntries(AROMA_AXES.map((a) => [a, []]));
  let denom = 0;
  for (const r of rows) {
    const base = r.grams != null && r.grams > 0 ? r.grams : (r.dflt ?? fallback);
    const wt = r.a.aromaless ? base * f : base * r.a.potency;
    denom += wt;
    if (r.a.aromaless) continue;
    for (const ax of AROMA_AXES) {
      if (r.a.axes[ax] <= 0) continue;
      const v = (wt * r.a.axes[ax]) / AROMA_STRENGTH_MAX;
      scores[ax] += v;
      contrib[ax].push({ key: r.key, v });
    }
  }
  const charted = denom > 0 && AROMA_AXES.some((a) => scores[a] > 0);
  for (const ax of AROMA_AXES) scores[ax] = charted ? Math.min(1, scores[ax] / denom) : 0;
  const drivers = Object.fromEntries(AROMA_AXES.map((ax) => [
    ax, contrib[ax].sort((x, y) => y.v - x.v).slice(0, 3).map((c) => c.key),
  ]));
  return { scores, counted, uncounted, n: rows.length, weighted, drivers, charted };
}
