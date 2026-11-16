/**
 * shoppingUnits.js (SHOP-6) — how the shopping list SHOWS an amount, in US or metric. Pure except the two
 * small storage helpers at the bottom.
 *
 * What is stored never changes: a line's parts are exactly what was entered (shoppingList.addPart still only
 * sums units of one exact ladder, so 200 g + 8 oz is stored as two parts). This module works the total out
 * for display only, by adding a weight to a weight and a volume to a volume across metric and US. A weight
 * is never turned into a volume, a count word ("2 cloves") is never touched.
 *
 * Factors (as ruled, 2026-11-16): 1 oz = 28.3495 g, 1 lb = 16 oz; 1 US cup = 236.588 ml, 1 tbsp = 14.787 ml,
 * 1 tsp = 4.929 ml, 1 fl oz = 29.574 ml; cl and l as usual.
 *
 * "about": shown only when the number on screen is not exact. A line whose parts are all in the system being
 * shown is written exactly as shoppingList.formatParts always wrote it (no "about"). A line that had to be
 * converted gets "about" unless the converted, rounded number happens to equal the true total.
 *
 * US rounding (never more than one fraction, never a decimal, never 0):
 *   weight   under 1 oz: quarters (down to 1/8 oz) · 1 to 4 oz: halves · 4 oz and up: whole oz ·
 *            16 oz and up: "1 lb 3 oz", and from 3 lb up quarter pounds
 *   volume   under 13 ml: teaspoons in quarters (down to 1/8 tsp) · 13 to 28 ml: tablespoons in halves ·
 *            28 to 57 ml: fl oz in halves · 57 ml and up: cups in 1/4 1/3 1/2 2/3 3/4
 * Metric rounding: grams and ml to 1 under 20, to 5 from 20; from 1000 kilograms or litres to 0.05.
 */
import { formatParts, formatPart } from './shoppingList.js';

export const UNIT_SYSTEMS = Object.freeze(['us', 'metric']);
export const DEFAULT_UNIT_SYSTEM = 'us';
export const UNITS_KEY = 'fn-shopping-units-v1';

const GRAMS = { g: 1, kg: 1000, oz: 28.3495, lb: 16 * 28.3495 };
const MILLILITRES = { ml: 1, cl: 10, l: 1000, tsp: 4.929, tbsp: 14.787, cup: 236.588 };
const OZ_G = GRAMS.oz;
const FLOZ_ML = 29.574;
const CUP_ML = MILLILITRES.cup;
const US_UNITS = new Set(['oz', 'lb', 'tsp', 'tbsp', 'cup']);

const kindOf = (unit) => (unit in GRAMS ? 'mass' : unit in MILLILITRES ? 'vol' : `unit:${unit}`);
const systemOf = (unit) => (US_UNITS.has(unit) ? 'us' : 'metric');
const baseOf = (p) => p.qty * (p.unit in GRAMS ? GRAMS[p.unit] : MILLILITRES[p.unit]);

const nearest = (x, step) => Math.round(x / step) * step;
const FRACS = [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1];
function nearestFraction(x) {
  const whole = Math.floor(x + 1e-9);
  const f = x - whole;
  let best = 0;
  for (const c of FRACS) if (Math.abs(c - f) < Math.abs(best - f)) best = c;
  return whole + best;
}
const num = (n) => String(Math.round(n * 100) / 100);

/** US weight from grams -> { text, base } where base is the grams the text stands for. */
function usMass(g) {
  const oz = g / OZ_G;
  let shown;
  if (oz < 1) shown = Math.max(0.125, nearest(oz, 0.25));
  else if (oz < 4) shown = nearest(oz, 0.5);
  else shown = Math.round(oz);
  if (shown < 16) return { text: formatPart({ qty: shown, unit: 'oz' }), base: shown * OZ_G };
  const lb = shown / 16;
  if (lb >= 3) {
    const q = nearest(lb, 0.25);
    return { text: formatPart({ qty: q, unit: 'lb' }), base: q * 16 * OZ_G };
  }
  const whole = Math.floor(shown / 16);
  const rest = shown - whole * 16;
  const text = rest ? `${formatPart({ qty: whole, unit: 'lb' })} ${formatPart({ qty: rest, unit: 'oz' })}` : formatPart({ qty: whole, unit: 'lb' });
  return { text, base: shown * OZ_G };
}

/** US volume from millilitres -> { text, base }. */
function usVolume(ml) {
  if (ml < 13) {
    const tsp = Math.max(0.125, nearest(ml / MILLILITRES.tsp, 0.25));
    return { text: formatPart({ qty: tsp, unit: 'tsp' }), base: tsp * MILLILITRES.tsp };
  }
  if (ml < 28) {
    const tbsp = Math.max(0.5, nearest(ml / MILLILITRES.tbsp, 0.5));
    return { text: formatPart({ qty: tbsp, unit: 'tbsp' }), base: tbsp * MILLILITRES.tbsp };
  }
  if (ml < 57) {
    const fl = Math.max(1, nearest(ml / FLOZ_ML, 0.5));
    return { text: `${formatPart({ qty: fl, unit: '' })} fl oz`, base: fl * FLOZ_ML };
  }
  const cups = Math.max(0.25, nearestFraction(ml / CUP_ML));
  return { text: formatPart({ qty: cups, unit: 'cup' }), base: cups * CUP_ML };
}

function metricAmount(base, unit, big, bigUnit) {
  if (base >= 1000) {
    const q = nearest(base / 1000, 0.05);
    return { text: `${num(q)} ${bigUnit}`, base: q * 1000 };
  }
  const step = base < 20 ? 1 : 5;
  const q = Math.max(1, nearest(base, step));
  return { text: `${q} ${unit}`, base: q };
}

function convertedText(kind, total, system) {
  if (system === 'us') return kind === 'mass' ? usMass(total) : usVolume(total);
  return kind === 'mass' ? metricAmount(total, 'g', 1000, 'kg') : metricAmount(total, 'ml', 1000, 'l');
}

/**
 * The amount of a line as text in the chosen system ('' for a line with no quantity).
 * system 'us' | 'metric'; anything else shows the parts as entered, exactly as shoppingList.formatParts does.
 */
export function formatAmount(parts, system) {
  if (!parts || !parts.length) return '';
  if (!UNIT_SYSTEMS.includes(system)) return formatParts(parts);
  const order = [];
  const groups = new Map();
  for (const p of parts) {
    const k = kindOf(p.unit);
    if (!groups.has(k)) { groups.set(k, []); order.push(k); }
    groups.get(k).push(p);
  }
  const out = [];
  for (const k of order) {
    const ps = groups.get(k);
    if (!k.startsWith('unit:') && !ps.every((p) => systemOf(p.unit) === system)) {
      const total = ps.reduce((s, p) => s + baseOf(p), 0);
      const { text, base } = convertedText(k, total, system);
      const exact = Math.abs(base - total) <= 1e-6 * Math.max(1, total);
      out.push(exact ? text : `about ${text}`);
    } else {
      out.push(formatParts(ps));
    }
  }
  return out.join(' + ');
}

// ---------------------------------------------------------------------------------------------------------
// The switch's memory: this device only (localStorage). It does not sync with the account.

const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function loadUnitSystem(storage = defaultStorage()) {
  try {
    const v = storage?.getItem(UNITS_KEY);
    return UNIT_SYSTEMS.includes(v) ? v : DEFAULT_UNIT_SYSTEM;
  } catch { return DEFAULT_UNIT_SYSTEM; }
}

export function saveUnitSystem(system, storage = defaultStorage()) {
  if (!UNIT_SYSTEMS.includes(system)) return false;
  try { storage?.setItem(UNITS_KEY, system); return !!storage; } catch { return false; }
}
