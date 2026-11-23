/**
 * recipeLines.js - one way to read a recipe line into amount, unit and name,
 * and one way to write it back (amount first, the way a cook writes a spec).
 *
 * "3 tblsp Coconut milk" used to be read as amount "3" and name "tblsp Coconut
 * milk" because the unit list did not know "tblsp"; the card then showed the
 * name with a stray unit and the amount on the wrong side. Every place that
 * splits a line (cocktail cards, What do I need, the check script) goes
 * through here.
 */

const UNIT_ALIASES = {
  tbsp: ['tbsp', 'tbsps', 'tblsp', 'tblsps', 'tbs', 'tbl', 'tbls', 'tablespoon', 'tablespoons'],
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons'],
  oz: ['oz', 'ounce', 'ounces'],
  ml: ['ml'],
  cl: ['cl'],
  dl: ['dl'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  g: ['g', 'gram', 'grams'],
  kg: ['kg'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  cup: ['cup', 'cups'],
  dash: ['dash', 'dashes'],
  pinch: ['pinch', 'pinches'],
  drop: ['drop', 'drops'],
  splash: ['splash', 'splashes'],
  part: ['part', 'parts'],
  shot: ['shot', 'shots'],
  cube: ['cube', 'cubes'],
  barspoon: ['barspoon', 'barspoons'],
};

const UNIT_LOOKUP = new Map();
for (const [canon, words] of Object.entries(UNIT_ALIASES)) for (const w of words) UNIT_LOOKUP.set(w, canon);

// Units that read as a plural when the amount is more than one.
const PLURAL = { cup: 'cups', dash: 'dashes', pinch: 'pinches', drop: 'drops', splash: 'splashes', part: 'parts', shot: 'shots', cube: 'cubes', barspoon: 'barspoons' };

// Unit words that, at the start of an ingredient name, mean the line was read wrongly.
const STRICT_UNITS = new Set(['tbsp', 'tsp', 'oz', 'ml', 'cl', 'dl', 'cup', 'lb', 'kg', 'dash', 'pinch']);
// Units that may open a line with no amount ("dash of bitters", "pinch salt").
const LEADING_UNITS = new Set(['dash', 'pinch', 'splash', 'drop']);

const FRAC = '[¼½¾⅓⅔⅛⅜⅝⅞]';
const NUM = `(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+\\s*${FRAC}|${FRAC}|\\d+(?:[.,]\\d+)?)`;
const AMOUNT = `${NUM}(?:\\s*-\\s*${NUM})?`;
const LEAD_RE = new RegExp(`^(${AMOUNT})(?=\\s|$)\\s*(.*)$`);
const TRAIL_RE = new RegExp(`^(.+?)\\s+(${AMOUNT})$`);
// "4cl Gin": the unit written straight after the amount.
const ATTACHED_RE = new RegExp(`^(${AMOUNT})([a-zA-Z]+)(?=\\s|$)\\s*(.*)$`);

/** Canonical unit for one word, or '' when it is not a unit. Capital T / small t are tbsp / tsp. */
function unitOf(word, { single = true } = {}) {
  const w = String(word || '').replace(/\.$/, '');
  if (!w) return '';
  if (w === 'T') return single ? 'tbsp' : '';
  if (w === 't') return single ? 'tsp' : '';
  if (!single && w.length < 3) return '';
  return UNIT_LOOKUP.get(w.toLowerCase()) || '';
}

/**
 * "3 tbsp Coconut milk" or the reversed "tblsp Coconut milk 3"
 * -> { amount: '3', unit: 'tbsp', name: 'Coconut milk' }. Always three strings.
 */
export function splitRecipeLine(line) {
  const s = String(line ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return { amount: '', unit: '', name: '' };

  const attached = ATTACHED_RE.exec(s);
  if (attached && unitOf(attached[2])) {
    return { amount: attached[1].replace(/\s+/g, ' ').trim(), unit: unitOf(attached[2]), name: attached[3].trim() };
  }

  const lead = LEAD_RE.exec(s);
  if (lead) {
    const amount = lead[1].replace(/\s+/g, ' ').trim();
    const rest = lead[2].trim();
    const [first, ...others] = rest.split(' ');
    const unit = unitOf(first);
    if (unit) return { amount, unit, name: others.join(' ').trim() };
    return { amount, unit: '', name: rest };
  }

  const [first, ...others] = s.split(' ');
  const trailing = others.length ? TRAIL_RE.exec(others.join(' ')) : null;
  const rev = unitOf(first, { single: false });
  if (rev && trailing) return { amount: trailing[2].trim(), unit: rev, name: trailing[1].trim() };

  const unit = unitOf(first, { single: false });
  if (unit && !others.length) return { amount: '', unit, name: '' };
  if (unit && LEADING_UNITS.has(unit)) {
    return { amount: '', unit, name: others.join(' ').replace(/^of\s+/i, '').trim() };
  }
  return { amount: '', unit: '', name: s };
}

function amountValue(amount) {
  const a = String(amount || '').trim();
  if (!a) return 0;
  if (/-/.test(a)) return Infinity;
  const FR = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  let total = 0;
  for (const tok of a.split(/\s+/)) {
    const m = /^(\d+)?([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(tok);
    if (m) total += Number(m[1] || 0) + FR[m[2]];
    else if (/^\d+\/\d+$/.test(tok)) { const [n, d] = tok.split('/').map(Number); total += n / d; }
    else total += Number(tok.replace(',', '.')) || 0;
  }
  return total;
}

/** { amount, unit, name } -> "3 tbsp Coconut milk". Units read plural where the amount is more than one. */
export function formatRecipeLine({ amount = '', unit = '', name = '' } = {}) {
  const u = unit && PLURAL[unit] && amountValue(amount) > 1 ? PLURAL[unit] : unit;
  return [amount, u, name].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
}

/** First word of a name when it is a unit word the name should never start with. */
function leadingUnitWord(name) {
  const first = String(name || '').split(/\s+/)[0];
  const unit = unitOf(first, { single: false });
  return STRICT_UNITS.has(unit) ? first : '';
}

/** Why a line reads wrongly, or '' when it is fine. */
export function lineProblem(line) {
  const { amount, unit, name } = splitRecipeLine(line);
  if (!name) return amount || unit ? 'amount or unit but no ingredient name' : 'empty line';
  if (leadingUnitWord(name)) return 'name starts with a unit word';
  // "151 proof rum" and "Pimm's No. 1" are names; "Coconut milk 3" is a misread amount.
  if (/^\d/.test(name) && !/^\d+\s*(proof\b|-\s*[a-z])/i.test(name)) return 'name starts with a number';
  if (/\s\d{1,2}([./]\d+)?$/.test(name) && !/\bno\.?\s*\d+$/i.test(name)) return 'name ends with a number';
  return '';
}

/**
 * recipes: [{ kind, id, name, lines: string[] }] -> one report per bad line:
 * { kind, id, name, line, problem }.
 */
export function findBadLines(recipes) {
  const out = [];
  for (const r of recipes || []) {
    for (const line of r?.lines || []) {
      const problem = lineProblem(line);
      if (problem) out.push({ kind: r.kind, id: r.id, name: r.name, line, problem });
    }
  }
  return out;
}
