/**
 * flavorTaste.js — the taste half of every flavor chart, worked out from the curated taste label each
 * ingredient carries (one to three words, strongest first) and weighted by how much of it the recipe
 * uses. Pure: no fetch, no React.
 *
 * Six chart axes: sweet, sour, bitter, salty, umami, heat.
 *   word 1 counts 1.0, word 2 counts 0.6, word 3 counts 0.35
 *   'spicy' and 'pungent' both feed heat; 'astringent' feeds half its weight to bitter
 *   'neutral' (no taste of its own: water, starch, vodka) feeds no axis
 *   'rich' (fat, creaminess) is a mouthfeel, not a taste: it feeds no axis and is reported separately
 *   a word the vocabulary does not know is ignored and reported
 * An ingredient with a label COUNTS as having data, including neutral and rich ones. Ingredients with
 * no taste at all (neutral, or rich with nothing after it) dilute the rest at TASTELESS_WEIGHT of their
 * amount: see the numbers in docs/flavor-profile.md, "After FLAVOR-3".
 *
 * FLAVOR-4: a label only says WHICH tastes, not how strong. An ingredient with a line in flavorStrengths.js
 * (hand-tuned, 0..3 per taste plus a potency) uses that line INSTEAD of its label. Every other ingredient is
 * put on the same scale: a label word's weight (1.0 / 0.6 / 0.35) times LABEL_STRENGTH_PER_WEIGHT, potency 1.
 * Each ingredient counts in proportion to grams x potency (an ingredient with no taste, or potency 0, counts at
 * grams x TASTELESS_WEIGHT instead), and a chart value is the weighted mean of strength / STRENGTH_MAX. So every
 * value stays within 0..1, and a label-only recipe reads as it did before the table existed, except that one
 * ingredient's strength is now capped at the top of the scale (spicy + pungent on one label is 3, not 4.8).
 */
import { amountGrams } from './amountGrams.js';
import { strengthFor, defaultGrams } from './flavorStrengths.js';

export const TASTE_AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'];
export const POSITION_WEIGHTS = [1, 0.6, 0.35];

/** The top of the 0..3 strength scale used by flavorStrengths.js. */
export const STRENGTH_MAX = 3;
/**
 * How a curated label is put on that scale: a word's position weight times this. 3 means the FIRST word of a
 * label is "what the ingredient is" (strength 3), the second 1.8 and the third 1.05, so a recipe made only of
 * label-only ingredients charts exactly as it did under FLAVOR-3 (the mean of the label weights).
 */
export const LABEL_STRENGTH_PER_WEIGHT = 3;

const WORD_AXES = {
  sweet: [['sweet', 1]],
  sour: [['sour', 1]],
  bitter: [['bitter', 1]],
  salty: [['salty', 1]],
  umami: [['umami', 1]],
  spicy: [['heat', 1]],
  pungent: [['heat', 1]],
  astringent: [['bitter', 0.5]],
};
const KNOWN_WORDS = new Set([...Object.keys(WORD_AXES), 'neutral', 'rich']);

/**
 * How much of its amount an ingredient with no taste of its own (neutral, or fat only) counts against the
 * rest. 1 would let soda and ice wash a highball's chart out; 0 would ignore them and make a long drink
 * read as strong as a short one. A quarter keeps both honest. It never changes which taste leads
 * (every taste is diluted alike), only how strong the bars read: see docs/flavor-profile.md.
 */
export const TASTELESS_WEIGHT = 0.25;

const zeroAxes = () => Object.fromEntries(TASTE_AXES.map((a) => [a, 0]));

/**
 * One label → { axes, rich, neutral, unknown, any }.
 *  axes     weights on the six chart axes
 *  rich     weight of the word 'rich' (0 when absent), outside the six axes
 *  neutral  true when the label says 'neutral'
 *  unknown  words the vocabulary does not know (ignored)
 *  any      true when the label has at least one known word (the ingredient counts as having data)
 */
export function labelWeights(label) {
  const axes = zeroAxes();
  let rich = 0;
  let neutral = false;
  let any = false;
  const unknown = [];
  String(label || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 3).forEach((word, i) => {
    if (!KNOWN_WORDS.has(word)) { unknown.push(word); return; }
    any = true;
    const w = POSITION_WEIGHTS[i];
    if (word === 'neutral') { neutral = true; return; }
    if (word === 'rich') { rich += w; return; }
    for (const [axis, f] of WORD_AXES[word]) axes[axis] += w * f;
  });
  return { axes, rich, neutral, unknown, any };
}

/** True when the weights put nothing on any of the six axes. */
export const isTasteless = (w) => !TASTE_AXES.some((a) => w.axes[a] > 0);

/**
 * One ingredient's taste on the 0..3 scale: { axes, potency, rich, any, tasteless, fromTable }.
 * A line in flavorStrengths.js wins (and counts as data even when the ingredient has no label); otherwise the
 * label is converted (position weight x LABEL_STRENGTH_PER_WEIGHT, capped at STRENGTH_MAX, potency 1).
 * Potency 0 or no taste at all means tasteless: it counts as data and dilutes at TASTELESS_WEIGHT.
 */
export function ingredientTaste(key, label, { strengths = strengthFor } = {}) {
  const lw = labelWeights(label);
  const row = strengths ? strengths(key) : null;
  if (row) {
    const tasteless = row.potency <= 0 || !TASTE_AXES.some((a) => row.axes[a] > 0);
    return { axes: row.axes, potency: row.potency, rich: lw.rich, any: true, tasteless, fromTable: true };
  }
  const axes = zeroAxes();
  for (const a of TASTE_AXES) axes[a] = Math.min(STRENGTH_MAX, lw.axes[a] * LABEL_STRENGTH_PER_WEIGHT);
  return { axes, potency: 1, rich: lw.rich, any: lw.any, tasteless: isTasteless(lw), fromTable: false };
}

/**
 * tasteProfile(lines, lookup, opts) → { scores, counted, uncounted, n, weighted, rich, drivers, charted }
 *  lines   [{ key, amount? }]; amount is a string ("2 oz"), a { qty, unit } object or grams (number)
 *  lookup  (key) => curated label string or null
 *  opts    { tastelessWeight = TASTELESS_WEIGHT, strengths }  (strengths: null turns the hand-tuned table off)
 * Amount-weighted mean of the label weights. No amounts known: equal weights. Some known: the unknown
 * ones get the mean known amount. `charted` is false when every counted ingredient is tasteless.
 */
export function tasteProfile(lines, lookup, opts = {}) {
  const f = opts.tastelessWeight ?? TASTELESS_WEIGHT;
  const rows = [];
  const counted = [];
  const uncounted = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    const key = typeof l === 'string' ? l : l?.key;
    if (!key) continue;
    const t = ingredientTaste(key, lookup?.(key), { strengths: opts.strengths === null ? null : strengthFor });
    if (!t.any) { uncounted.push(key); continue; }
    counted.push(key);
    const grams = typeof l === 'string' ? null : amountGrams(l.amount);
    rows.push({ key, t, grams, dflt: grams == null && typeof l !== 'string' && t.fromTable ? defaultGrams(key, l.amount) : null });
  }
  const known = rows.map((r) => r.grams).filter((g) => g != null && g > 0);
  const weighted = known.length > 0;
  const fallback = weighted ? known.reduce((s, g) => s + g, 0) / known.length : 1;

  const scores = zeroAxes();
  const contrib = Object.fromEntries(TASTE_AXES.map((a) => [a, []]));
  let denom = 0;
  let richSum = 0;
  for (const r of rows) {
    const base = r.grams != null && r.grams > 0 ? r.grams : (r.dflt ?? fallback);
    const wt = r.t.tasteless ? base * f : base * r.t.potency;
    denom += wt;
    richSum += wt * r.t.rich;
    if (r.t.tasteless) continue;
    for (const a of TASTE_AXES) {
      if (r.t.axes[a] <= 0) continue;
      const v = (wt * r.t.axes[a]) / STRENGTH_MAX;
      scores[a] += v;
      contrib[a].push({ key: r.key, v });
    }
  }
  const charted = denom > 0 && TASTE_AXES.some((a) => scores[a] > 0);
  for (const a of TASTE_AXES) scores[a] = charted ? Math.min(1, scores[a] / denom) : 0;
  const drivers = Object.fromEntries(TASTE_AXES.map((a) => [
    a, contrib[a].sort((x, y) => y.v - x.v).slice(0, 3).map((c) => c.key),
  ]));
  return { scores, counted, uncounted, n: rows.length, weighted, rich: denom > 0 ? Math.min(1, richSum / denom) : 0, drivers, charted };
}
