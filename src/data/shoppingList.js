/**
 * shoppingList.js (SHOP-1) — the shopping list, as pure functions. No storage, no DOM, no clock of its own.
 *
 *   List = { items: [Item], recipes: [{ id, kind, name, addedAt }] }
 *   Item = { id, key, label, parts: [{ qty, unit }], checked, from: [recipeId], updatedAt,
 *            swappedFrom?: key, was?: {…}, note?: string }
 *
 * Every function returns a NEW list and never touches its input. A list is plain JSON (no Maps, Sets or
 * functions) because it is stored as it is. Functions that stamp a time take `{ now }`; `now` falls back to
 * Date.now() only when the caller gives none, so tests pass a fixed one. Item ids come from `newId` (default
 * a time + random id), which tests replace with a counter.
 *
 * THE MERGE RULE (owner's criterion, spec Decision 3): an ingredient already on the list (unchecked, same
 * canonical key) is never listed twice; a quantity is added on only when BOTH sides have a specific one.
 *   existing none          + anything → one line, still none
 *   existing a quantity    + none     → quantity unchanged
 *   quantity + quantity, ADDABLE units → summed
 *   quantity + quantity, other units   → one line, both parts ("2 cloves + 1 tbsp"); nothing is converted
 * Addable units are those whose conversion is exact by definition, in four ladders and nothing wider:
 *   metric mass g, kg · metric volume ml, cl, l · US volume tsp, tbsp, cup · US mass oz, lb.
 * Metric and US are never converted in what is STORED (so 200 g + 8 oz is two parts), nor mass to volume,
 * nor a count ("2 cloves") to either; any other unit (clove, can, bunch, dash…) adds only to the very same
 * unit. SHOP-6: the DISPLAY (shoppingUnits.formatAmount) adds a weight to a weight and a volume to a volume
 * across metric and US, in the system the cook chose, and says "about" when the number shown is not exact.
 *
 * DISPLAY of a sum: the units allowed are the units already present on the line plus the incoming one, so
 * a sum never invents a unit nobody wrote: 200 g + 300 g = "500 g" (not ½ kg); 500 g + 1 kg = "1 kg 500 g";
 * 1 cup + 2 tbsp = "1 cup 2 tbsp"; 3 tbsp + 3 tbsp = "6 tbsp". The sum is written in the largest allowed
 * unit that fits whole, the remainder in the next, and only the smallest allowed unit may carry a fraction.
 * Parts of one ladder are shown joined by a space, separate groups by " + ".
 *
 * VAGUE AMOUNTS: a range ("2-3 oz", "2 to 3 cups", "1 or 2"), "a pinch", "to taste", "top with soda",
 * "for serving", a descriptive fragment with no number — none of these is a specific quantity. The line
 * has no quantity and the text is not kept (the list is what to buy, not the recipe). A bare number
 * ("3", "1/2") is a count with no unit word.
 */
import { parseAmountText } from './amountGrams.js';
import { isBasic, haveIngredient } from './myKitchen.js';
import { shoppingListText } from './whatDoINeed.js';
import { resolveIngredient } from './curation/resolveIngredient.js';
import { curationKey } from './curation/normalize.js';
import { resolveIngredientName } from './recipePairingMatch.js';
import { formatAmount } from './shoppingUnits.js';

export const MAX_ITEMS = 200;
export const CAP_MESSAGE = `The shopping list holds up to ${MAX_ITEMS} items. Remove or check off some items to add more.`;

// ---------------------------------------------------------------------------------------------------------
// Names

/**
 * Same ingredient under different words that the curation alias table does not carry. Kept short on
 * purpose: only pairs a shopper would call one item. (The kitchen's own "equivalent" table is about what
 * covers what, not what is one line on a list.)
 */
export const LIST_SYNONYMS = Object.freeze({
  scallion: 'scallion', scallions: 'scallion', 'green onion': 'scallion', 'green onions': 'scallion',
  'spring onion': 'scallion', 'spring onions': 'scallion',
  eggs: 'egg', lemons: 'lemon', limes: 'lime', onions: 'onion', tomatoes: 'tomato', potatoes: 'potato',
  carrots: 'carrot', 'garlic cloves': 'garlic', 'clove garlic': 'garlic', 'cloves garlic': 'garlic',
});

/**
 * The key two lines share when they are one ingredient. A recipe line's key is looked up through the
 * curation aliases (and LIST_SYNONYMS); typed text, when the graph's names are given, is resolved the way
 * the kitchen and bar resolve it; text that matches nothing is just its normalised self (lower case,
 * accents and extra spaces gone), so only identical text merges.
 */
export function canonicalKey(raw, names = null) {
  const base = curationKey(raw).replace(/[.!?;:]+$/g, '').trim();
  if (!base) return '';
  const direct = LIST_SYNONYMS[base] ?? resolveIngredient(base);
  if (LIST_SYNONYMS[direct]) return LIST_SYNONYMS[direct];
  if (names && names.size && !names.has(direct)) {
    const r = resolveIngredientName(String(raw), names);
    if (r) return LIST_SYNONYMS[r] ?? resolveIngredient(r);
  }
  return direct;
}

// ---------------------------------------------------------------------------------------------------------
// Amounts

const LADDERS = {
  mass_metric: { g: 1, kg: 1000 },
  vol_metric: { ml: 1, cl: 10, l: 1000 },
  vol_us: { tsp: 1, tbsp: 3, cup: 48 },
  mass_us: { oz: 1, lb: 16 },
};
const LADDER_OF = {};
for (const [id, units] of Object.entries(LADDERS)) for (const u of Object.keys(units)) LADDER_OF[u] = id;

const groupOf = (unit) => LADDER_OF[unit] || `unit:${unit}`;
const sizeOf = (unit) => (LADDER_OF[unit] ? LADDERS[LADDER_OF[unit]][unit] : 1);

const VAGUE_UNITS = new Set(['to_taste', 'top', 'fill']);
const RANGE = /\d\s*(?:-|–|—|to|or)\s*\d/i;
const BARE_NUMBER = /^[\d¼½¾⅓⅔⅛⅜⅝⅞./\s]+$/;
const NUMBER_ONLY_WORD = /\d/;

/**
 * An amount → one { qty, unit } part, or null when it is not a specific quantity (see VAGUE AMOUNTS).
 * Accepts the text of a recipe line, an existing { qty, unit }, or null. unit '' is a bare count.
 * Built on parseAmountText; this adds only the range check, the bare count and the vague-unit rule.
 */
export function partFromAmount(amount) {
  if (amount == null || amount === '') return null;
  let parsed;
  if (typeof amount === 'object') {
    parsed = { qty: amount.qty, unit: amount.unit ?? '' };
  } else {
    const s = String(amount).trim();
    if (!s || RANGE.test(s)) return null;
    if (BARE_NUMBER.test(s) && NUMBER_ONLY_WORD.test(s)) parsed = parseAmountText(`${s} each`);
    else parsed = parseAmountText(s);
  }
  if (!parsed || typeof parsed.qty !== 'number' || !Number.isFinite(parsed.qty) || parsed.qty <= 0) return null;
  const unit = parsed.unit === 'each' || parsed.unit == null ? '' : String(parsed.unit);
  if (VAGUE_UNITS.has(unit)) return null;
  return { qty: round6(parsed.qty), unit };
}

const round6 = (x) => Math.round(x * 1e6) / 1e6;

/** Add one part to a parts array by the merge rule. Returns a new array; [] (no quantity) stays []. */
export function addPart(parts, incoming) {
  if (!parts || !parts.length || !incoming) return parts ? parts.map((p) => ({ ...p })) : [];
  const order = [];
  const groups = new Map();
  for (const p of [...parts, incoming]) {
    const g = groupOf(p.unit);
    if (!groups.has(g)) { groups.set(g, { total: 0, units: new Set() }); order.push(g); }
    const gr = groups.get(g);
    gr.total += p.qty * sizeOf(p.unit);
    gr.units.add(p.unit);
  }
  const out = [];
  for (const g of order) {
    const { total, units } = groups.get(g);
    const list = [...units].sort((a, b) => sizeOf(b) - sizeOf(a));
    let rest = round6(total);
    list.forEach((u, i) => {
      const size = sizeOf(u);
      if (i === list.length - 1) {
        const q = round6(rest / size);
        if (q > 0) out.push({ qty: q, unit: u });
      } else {
        const n = Math.floor(rest / size + 1e-9);
        if (n > 0) out.push({ qty: n, unit: u });
        rest = round6(rest - n * size);
      }
    });
  }
  return out;
}

const PLURAL = {
  cup: 'cups', clove: 'cloves', leaf: 'leaves', can: 'cans', pinch: 'pinches', dash: 'dashes', sprig: 'sprigs',
  handful: 'handfuls', bunch: 'bunches', slice: 'slices', wedge: 'wedges', stalk: 'stalks', drop: 'drops',
  splash: 'splashes', shot: 'shots', jigger: 'jiggers', part: 'parts', barspoon: 'barspoons',
};
const FRACTIONS = [[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔'], [0.125, '⅛']];

export function formatQty(q) {
  const r = Math.round(q * 100) / 100;
  const whole = Math.floor(r + 1e-9);
  const frac = r - whole;
  if (frac < 0.005) return String(whole);
  const hit = FRACTIONS.find(([v]) => Math.abs(frac - v) < 0.01);
  if (hit) return `${whole || ''}${hit[1]}`;
  return String(r);
}

export function formatPart(part) {
  const unit = part.unit ? (part.qty > 1 && PLURAL[part.unit] ? PLURAL[part.unit] : part.unit) : '';
  return `${formatQty(part.qty)}${unit ? ` ${unit}` : ''}`;
}

/** "2 cloves + 1 tbsp", "1 cup 2 tbsp", "500 g", or '' for a line with no quantity. */
export function formatParts(parts) {
  let out = '';
  let prev = null;
  for (const p of parts || []) {
    const g = groupOf(p.unit);
    const text = formatPart(p);
    out += out ? (g === prev ? ` ${text}` : ` + ${text}`) : text;
    prev = g;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// The list

export const emptyList = () => ({ items: [], recipes: [] });

const stamp = (opts) => (Number.isFinite(opts?.now) ? opts.now : Date.now());
let idSeq = 0;
const defaultNewId = (now) => `s${now.toString(36)}${Math.random().toString(36).slice(2, 8)}${(idSeq++).toString(36)}`;
const makeId = (opts, now) => (typeof opts?.newId === 'function' ? opts.newId() : defaultNewId(now));

const union = (a, b) => [...a, ...b.filter((x) => !a.includes(x))];

export const uncheckedCount = (list) => (list?.items || []).filter((i) => !i.checked).length;

function pruneRecipes(items, recipes) {
  const used = new Set(items.flatMap((i) => i.from));
  return recipes.filter((r) => used.has(r.id));
}

function withItems(list, items) {
  return { items, recipes: pruneRecipes(items, list.recipes) };
}

const nameOfLine = (line) => line?.key ?? line?.name ?? line?.text ?? '';

/**
 * Put one line into a working copy of the items (internal). Returns { status, index, item } and edits
 * `items` in place (the array is the caller's private copy; item objects are replaced, never mutated).
 */
function putLine(items, line, ctx) {
  const key = canonicalKey(nameOfLine(line), ctx.names);
  if (!key) return { status: 'empty' };
  const part = partFromAmount(line.amount);
  const from = line.recipeId ? [line.recipeId] : [];
  const at = items.findIndex((i) => !i.checked && i.key === key);
  if (at >= 0) {
    const cur = items[at];
    const parts = addPart(cur.parts, part);
    const item = { ...cur, parts, from: union(cur.from, from), updatedAt: ctx.now };
    items[at] = item;
    return { status: 'merged', index: at, item };
  }
  if (items.length >= MAX_ITEMS) return { status: 'capped' };
  const label = String(line.label || (typeof line.text === 'string' ? line.text.trim() : '') || nameOfLine(line)).trim() || key;
  const item = {
    id: ctx.newId(), key, label, parts: part ? [part] : [], checked: false, from, updatedAt: ctx.now,
    ...(line.note ? { note: String(line.note) } : {}),
  };
  items.push(item);
  return { status: 'added', index: items.length - 1, item };
}

const ctxOf = (opts) => {
  const now = stamp(opts);
  return { now, names: opts?.names || null, newId: () => makeId(opts, now) };
};

/**
 * Add one ingredient. line = { key | text | name, label?, amount?, note?, recipeId? }.
 * @returns {{ list, status: 'added'|'merged'|'capped'|'empty', item?, message? }}
 *   'merged' = it was already on the list (unchecked) and was folded in by the merge rule.
 */
export function addLine(list, line, opts = {}) {
  const items = list.items.slice();
  const r = putLine(items, line, ctxOf(opts));
  if (r.status === 'capped') return { list, status: 'capped', message: CAP_MESSAGE };
  if (r.status === 'empty') return { list, status: 'empty' };
  return { list: withItems({ ...list, recipes: list.recipes }, items), status: r.status, item: r.item };
}

export const recipeIdOf = (recipe) => recipe?.id || `${recipe?.kind || 'recipe'}:${recipe?.slug || curationKey(recipe?.name)}`;

/**
 * Add a recipe's lines that the cook lacks.
 *  recipe — the normalised recipe the app already uses: { kind, slug?, id?, name, lines: [{ key, amount, label? }] }
 *           (sharedRecipe.normaliseBuiltIn / fromOwnItem).
 *  has    — (key, line) => boolean, ONE predicate over everything the cook has (see makeHas).
 * Basics (isBasic: salt, pepper, water, oil, butter, sugar, flour, ice…) are skipped unless includeBasics.
 * A recipe that is already on the list (some unchecked line lists it) is NOT added again unless `force`;
 * summary.alreadyOnList tells the screen to ask first.
 * @returns {{ list, summary: { added, merged, skippedHave, skippedBasics, alreadyOnList, capped,
 *   message?, addedLines: {key,label}[], mergedLines: {key,label,now,parts}[] } }}
 *   `now` on a merged line is the line's quantity text after the merge ("garlic: now 5 cloves"; '' when none).
 */
export function addRecipe(list, recipe, has = () => false, opts = {}) {
  const { includeBasics = false, force = false } = opts;
  const id = recipeIdOf(recipe);
  const summary = { added: 0, merged: 0, skippedHave: 0, skippedBasics: 0, alreadyOnList: false, capped: 0, addedLines: [], mergedLines: [] };
  if (list.items.some((i) => !i.checked && i.from.includes(id))) {
    summary.alreadyOnList = true;
    if (!force) return { list, summary };
  }
  const ctx = ctxOf(opts);
  const items = list.items.slice();
  for (const line of recipe?.lines || []) {
    const key = canonicalKey(nameOfLine(line), ctx.names);
    if (!key) continue;
    if (!includeBasics && isBasic(key)) { summary.skippedBasics += 1; continue; }
    if (has(key, line)) { summary.skippedHave += 1; continue; }
    const r = putLine(items, { ...line, key, recipeId: id }, ctx);
    if (r.status === 'capped') summary.capped += 1;
    else if (r.status === 'added') { summary.added += 1; summary.addedLines.push({ key, label: r.item.label }); }
    else if (r.status === 'merged') { summary.merged += 1; summary.mergedLines.push({ key, label: r.item.label, now: formatParts(r.item.parts), parts: r.item.parts }); }
  }
  if (summary.capped) summary.message = `${CAP_MESSAGE} ${summary.capped} ${summary.capped === 1 ? 'ingredient was' : 'ingredients were'} left off.`;
  const touched = items.some((i) => i.from.includes(id));
  const entry = { id, kind: recipe?.kind || 'recipe', name: recipe?.name || '', addedAt: ctx.now };
  const recipes = touched ? [...list.recipes.filter((r) => r.id !== id), entry] : list.recipes;
  return { list: { items, recipes: pruneRecipes(items, recipes) }, summary };
}

/** Check or uncheck a line. Unchecking one whose ingredient is now on the list again folds it into that line. */
export function toggle(list, id, opts = {}) {
  const at = list.items.findIndex((i) => i.id === id);
  if (at < 0) return list;
  const now = stamp(opts);
  const cur = list.items[at];
  const items = list.items.slice();
  if (!cur.checked) { items[at] = { ...cur, checked: true, updatedAt: now }; return withItems(list, items); }
  const other = items.findIndex((i, n) => n !== at && !i.checked && i.key === cur.key);
  if (other < 0) { items[at] = { ...cur, checked: false, updatedAt: now }; return withItems(list, items); }
  let parts = items[other].parts;
  for (const p of cur.parts) parts = addPart(parts, p);
  items[other] = { ...items[other], parts, from: union(items[other].from, cur.from), updatedAt: now };
  items.splice(at, 1);
  return withItems(list, items);
}

export function remove(list, id) {
  if (!list.items.some((i) => i.id === id)) return list;
  return withItems(list, list.items.filter((i) => i.id !== id));
}

export function clearChecked(list) {
  return withItems(list, list.items.filter((i) => !i.checked));
}

/**
 * Swap a line for an alternative (the store has none of the original). alt = { key | text, label?, amount?, note? }.
 * The quantity stays the original's unless alt.amount is given; the use hint ("use ¾ as much") goes in alt.note.
 * The new line carries swappedFrom (the original key) and was (everything needed to undo exactly).
 * An alternative already on the list (unchecked) is MERGED into by the merge rule instead of making a second line.
 * @returns {{ list, status: 'replaced'|'merged'|'same'|'missing'|'empty' }}
 */
export function replaceItem(list, id, alt, opts = {}) {
  const at = list.items.findIndex((i) => i.id === id);
  if (at < 0) return { list, status: 'missing' };
  const ctx = ctxOf(opts);
  const orig = list.items[at];
  const key = canonicalKey(nameOfLine(alt), ctx.names);
  if (!key) return { list, status: 'empty' };
  if (key === orig.key) return { list, status: 'same' };
  const items = list.items.slice();
  const note = alt.note ? { note: String(alt.note) } : {};
  const target = items.findIndex((i, n) => n !== at && !i.checked && i.key === key);
  if (target >= 0) {
    const before = items[target];
    const incoming = alt.amount != null ? [partFromAmount(alt.amount)].filter(Boolean) : orig.parts;
    let parts = before.parts;
    for (const p of incoming) parts = addPart(parts, p);
    items[target] = {
      ...before, parts, from: union(before.from, orig.from), swappedFrom: orig.key, updatedAt: ctx.now, ...note,
      was: { row: orig, at, targetBefore: before },
    };
    items.splice(at, 1);
    return { list: withItems(list, items), status: 'merged' };
  }
  const label = String(alt.label || (typeof alt.text === 'string' ? alt.text.trim() : '') || key).trim();
  const parts = alt.amount != null ? [partFromAmount(alt.amount)].filter(Boolean) : orig.parts;
  items[at] = {
    id: orig.id, key, label, parts, checked: orig.checked, from: orig.from, updatedAt: ctx.now,
    swappedFrom: orig.key, ...note, was: { row: orig, at },
  };
  return { list: withItems(list, items), status: 'replaced' };
}

/**
 * The same ingredient in another FORM (dried thyme for fresh thyme, garlic powder for a clove; a 'form' stand-in whose
 * name the list resolves to the row's own key, so replaceItem would say 'same'). The row keeps its key (so it still
 * merges and never doubles), takes the new label, and takes the amount given: alt.amount, or none when alt.amount is
 * '' (a converted amount is not the original number). It carries swappedFrom (the original label) and was, so
 * undoReplace puts the original row back exactly.
 * alt = { label, amount?, note? }
 * @returns {{ list, status: 'reformed'|'same'|'missing'|'empty' }}
 */
export function reformItem(list, id, alt, opts = {}) {
  const at = list.items.findIndex((i) => i.id === id);
  if (at < 0) return { list, status: 'missing' };
  const orig = list.items[at];
  const label = String(alt?.label || '').trim();
  if (!label) return { list, status: 'empty' };
  if (label.toLowerCase() === String(orig.label || '').toLowerCase()) return { list, status: 'same' };
  const ctx = ctxOf(opts);
  const parts = alt.amount != null ? [partFromAmount(alt.amount)].filter(Boolean) : orig.parts;
  const items = list.items.slice();
  items[at] = {
    ...orig, label, parts, swappedFrom: orig.label || orig.key, updatedAt: ctx.now,
    ...(alt.note ? { note: String(alt.note) } : {}), was: { row: orig, at },
  };
  return { list: withItems(list, items), status: 'reformed' };
}

/**
 * Undo a replaceItem on the row that carries `was`. The row comes back exactly (only updatedAt is new) unless,
 * since the swap, the same ingredient was added to the list again: then it is folded into that line by the
 * merge rule, because an ingredient is never on the list twice.
 */
export function undoReplace(list, id, opts = {}) {
  const at = list.items.findIndex((i) => i.id === id);
  const cur = list.items[at];
  if (at < 0 || !cur.was) return list;
  const now = stamp(opts);
  const items = list.items.slice();
  const { row, at: was, targetBefore } = cur.was;
  items.splice(at, 1);
  const restore = (r, index) => {
    const twin = r.checked ? -1 : items.findIndex((i) => !i.checked && i.key === r.key);
    if (twin < 0) { items.splice(Math.min(index, items.length), 0, { ...r, updatedAt: now }); return; }
    let parts = items[twin].parts;
    for (const p of r.parts) parts = addPart(parts, p);
    items[twin] = { ...items[twin], parts, from: union(items[twin].from, r.from), updatedAt: now };
  };
  if (targetBefore) restore(targetBefore, at);
  restore(row, was);
  return withItems(list, items);
}

// ---------------------------------------------------------------------------------------------------------
// What the cook has

/**
 * ONE predicate over everything the cook has: My kitchen, the sauce pantry (the same shared list, passed
 * separately only so a caller can hand over whichever it holds) and My bar. Coverage is the kitchen's own
 * (myKitchen.haveIngredient): exact name, a plain-language equivalent ("lemon" covers "lemon juice"), and
 * the spice rack when it is on. Basics are NOT decided here: addRecipe skips them first.
 */
export function makeHas({ kitchen = [], pantry = [], bar = [], names = null, spiceRack = false } = {}) {
  const set = new Set();
  for (const k of [...kitchen, ...pantry, ...bar]) { set.add(k); set.add(canonicalKey(k)); }
  return (key) => {
    const k = String(key || '').toLowerCase().trim();
    return haveIngredient(k, set, { assumeBasics: false, spiceRack, names }).covered
      || haveIngredient(canonicalKey(k), set, { assumeBasics: false, spiceRack, names }).covered;
  };
}

// ---------------------------------------------------------------------------------------------------------
// Aisles

export const AISLES = Object.freeze(['produce', 'dairy', 'meat and fish', 'dry goods', 'spices', 'drinks', 'other']);

/** Curated ingredient category (categoryScheme.js) → aisle. */
export const AISLE_OF_CATEGORY = Object.freeze({
  vegetable: 'produce', fruit: 'produce', citrus: 'produce', aromatic: 'produce', herb: 'produce', chili: 'produce',
  dairy: 'dairy',
  protein: 'meat and fish',
  grain: 'dry goods', baked: 'dry goods', confection: 'dry goods', sweetener: 'dry goods', fat: 'dry goods',
  nut: 'dry goods', condiment: 'dry goods', 'savory seasoning': 'dry goods', acid: 'dry goods',
  thickener: 'dry goods', liquid: 'dry goods',
  spice: 'spices', seasoning: 'spices',
  juice: 'drinks', wine: 'drinks', beer: 'drinks', spirit: 'drinks', liqueur: 'drinks', mixer: 'drinks', bitters: 'drinks',
  other: 'other',
});
// Where a shop puts it, whatever the category says.
const AISLE_OF_KEY = Object.freeze({ egg: 'dairy', 'egg yolk': 'dairy', 'egg white': 'dairy', butter: 'dairy' });

export function aisleOf(key, category) {
  return AISLE_OF_KEY[key] || AISLE_OF_CATEGORY[category] || 'other';
}

/**
 * Items grouped by aisle in AISLES order, empty aisles left out; inside an aisle unchecked first, then
 * checked, each in the order added. categoryOf: key → curated category (a function, Map or object);
 * a key it does not know goes to "other".
 * @returns {{ aisle: string, items: Item[] }[]}
 */
export function groupByAisle(list, categoryOf = () => null) {
  const lookup = (k) => (categoryOf instanceof Map ? categoryOf.get(k) : categoryOf?.[k]);
  const cat = typeof categoryOf === 'function' ? categoryOf : (k) => { const v = lookup(k); return typeof v === 'string' ? v : v?.category; };
  const by = new Map(AISLES.map((a) => [a, []]));
  for (const item of list.items) by.get(aisleOf(item.key, cat(item.key))).push(item);
  return AISLES.map((aisle) => ({
    aisle,
    items: [...by.get(aisle).filter((i) => !i.checked), ...by.get(aisle).filter((i) => i.checked)],
  })).filter((g) => g.items.length);
}

// ---------------------------------------------------------------------------------------------------------
// Copy

/**
 * The quantity of a line as text ('' when it has none). `system` 'us' | 'metric' shows it in that system
 * (shoppingUnits.formatAmount, SHOP-6); left out, the parts are shown as entered.
 */
export const itemAmountText = (item, system) => formatAmount(item.parts, system);

/**
 * The "Copy shopping list" text, in the format the What do I need? panels already copy
 * (whatDoINeed.shoppingListText): "Shopping list[ for X]:" then "- <amount> <name>" per UNCHECKED line.
 */
export function toText(list, { title = '', system } = {}) {
  const missing = list.items.filter((i) => !i.checked).map((i) => ({ name: i.label, amount: itemAmountText(i, system) }));
  return shoppingListText(title, missing);
}
