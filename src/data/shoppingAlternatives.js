/**
 * shoppingAlternatives.js (SHOP-4) — "Store doesn't have it?": up to three alternatives for one shopping row.
 *
 * Pure. Two sources, and only these two (a wrong stand-in is worse than none):
 *
 *  1. kitchenSwaps.swapsFor(row.key) — the hand-written food table (same role AND same kind). Called the way a
 *     recipe-less shopping context allows: `main` is unknown, so a swap that holds only for a SUPPORTING item
 *     (butter -> oil for the pan) is skipped (the same as passing main:true); `sauce` is true when the row comes
 *     from a sauce, so swaps flagged sauce:false are skipped then; `inRecipe` is not used because there is no
 *     recipe in hand. findSwap is not used because it wants a `has` and returns one swap; the same filters
 *     (isSuggestable, supportingOnly, sauce) are applied here to every entry so up to three can be shown.
 *  2. cocktailRiff.swapCandidates — for a base spirit only, and only a plain bottle of the SAME FAMILY (bourbon: rye,
 *     scotch, whiskey; never gin for bourbon). The candidates come from swapCandidates over the role pool; the
 *     family filter is applied on top because the raw role pool offers soda water for tonic and chocolate for
 *     soda. No pairing index is loaded on this screen, so ranking inside the family is by how common the bottle
 *     is in cocktails, and the drink itself is not used even when a row has one cocktail source.
 *
 * A third source (neighbours in the same curated category) is deliberately NOT used: no category rule is safe
 * ("no basil? use mint" would pass a category test).
 *
 * FOUR KINDS (STANDIN-1). The sheet reads every kind through kitchenSwaps.standInsFor: 'swap' ("Use instead"),
 * 'form' ("Another form": dried thyme for fresh), 'make' ("Make it": simple syrup from sugar and water) and 'none'
 * (an honest "nothing really replaces it" with the reason; it wins over any other entry for that ingredient). Each
 * alternative carries its `kind`, a short `note` and an `amountNote` ("1 tsp dried for 1 tbsp fresh"). The recipe
 * side (findSwap and friends) never sees form, make or none: see the header of kitchenSwaps.js.
 *
 * THE ROW'S RECIPE. A swap flagged supportingOnly (butter and olive oil for the pan) is offered only when the row
 * came from at least one recipe in which the ingredient is NOT a main (ctx.main === false), and withheld when it
 * is a main of one (true) or when the row has no recipe (null/undefined). rowMain() decides that from the recipes
 * the list already stores (see there).
 *
 * Quantities: a numeric `ratio` scales a row with exactly one numeric part; an `amountNote` without a ratio means
 * the conversion is not one factor, so the row's number is dropped (it would be wrong in the new form) and the
 * note carries the amount; a swap with neither keeps the original quantity. Nothing here applies anything; the
 * screen does, on a tap.
 */
import { standInsFor as realStandInsFor, standInKind, swapUseText } from './kitchenSwaps.js';
import { mainsOf } from './recipeMains.js';
import { resolveIngredientName } from './recipePairingMatch.js';
import { buildRolePool, swapCandidates, roleOf, familyKey } from './cocktailRiff.js';
import { isBooze, coverLine } from './myBar.js';
import { isSuggestable } from './curation/suggestable.js';
import { addPart, canonicalKey } from './shoppingList.js';

export const MAX_ALTERNATIVES = 3;
const SPIRIT_FAMILIES = new Set(['whiskey', 'rum', 'brandy', 'agave spirit', 'gin', 'vodka']);
// A bar candidate is a plain bottle of the family ("rye", "cognac", "irish whiskey", "dark rum"), never a flavoured
// or fruit one ("raspberry vodka", "apricot brandy", "coconut rum") and never the umbrella word ("whiskey"/"whisky").
const STYLE_WORDS = new Set(['dark', 'white', 'gold', 'golden', 'light', 'silver', 'aged', 'overproof', 'scotch', 'irish', 'canadian', 'tennessee', 'rye', 'bourbon', 'blended']);
const plainBottle = (name, family) => {
  const words = name.split(' ');
  return name !== family && name !== 'whisky' && words.slice(0, -1).every((w) => STYLE_WORDS.has(w));
};
const NO_PAIRING = { names: new Set(), strength: new Map() };

const RATIO_WORDS = new Map([[0.25, 'a quarter'], [0.5, 'half'], [0.75, 'three quarters'], [2, 'twice'], [1.5, 'one and a half times']]);
const ratioText = (r) => `${RATIO_WORDS.get(r) || `${Math.round(r * 100)}%`} as much`;
const validRatio = (r) => (typeof r === 'number' && Number.isFinite(r) && r > 0 && r !== 1 ? r : null);

export const KIND_LABEL = Object.freeze({ swap: 'Use instead', form: 'Another form', make: 'Make it' });
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Is `item` a main of the recipes it came from? true | false | null.
 *   null   the row has no recipe (typed by hand), or none of its recipes is in `recipes`
 *   true   a main of at least one recipe, or it came from a cocktail or a sauce (those have no main/supporting
 *          split, so the conservative answer is the main one: butter in a hot buttered rum is the drink)
 *   false  it came from dishes only and is a supporting ingredient in every one of them
 * A dish is judged by the Cookbook's own rule (recipeMains.mainsOf: the dish's name, its hand-listed mains, then the
 * ingredient's category), the same split "Add from a recipe" uses for flavourings. It needs only what the list
 * already holds (item.from and list.recipes: id, kind, name) and the ingredient category table the screen has
 * loaded; no recipe data is fetched. A built-in dish id is `dish:<slug>`; the slug is the key the hand-listed mains
 * use. The cook's own recipe is judged by its name and the categories.
 * @param {{ key: string, from?: string[] }} item
 * @param {Array<{ id: string, kind: string, name?: string }>} recipes  list.recipes
 * @param {{ categoryOf?: (name: string) => string|null, names?: Set<string>|null }} ctx
 */
export function rowMain(item, recipes = [], { categoryOf = () => null, names = null } = {}) {
  const byId = new Map((recipes || []).map((r) => [r.id, r]));
  const found = (item?.from || []).map((id) => byId.get(id)).filter(Boolean);
  if (!found.length) return null;
  const resolve = names && names.size ? (n) => resolveIngredientName(n, names) : null;
  for (const r of found) {
    if (r.kind !== 'dish') return true;
    const id = String(r.id).startsWith('dish:') ? String(r.id).slice(5) : undefined;
    if (mainsOf({ id, name: r.name || '' }, { categoryOf, resolve })(item.key)) return true;
  }
  return false;
}

// Two names for one ingredient: the same curated name after the aliases, or each one covers the other in the
// bar's own equivalence table ("rye" and "rye whiskey", "lemon" and "lemon juice"). A same-family bottle that merely
// could stand in (bourbon for rye) is a substitution, not the same ingredient.
const covers = (a, b) => { const r = coverLine({ key: a }, new Set([b])); return r.covered && !r.substitution; };
export function sameIngredient(a, b, names = null) {
  return a === b || canonicalKey(a) === canonicalKey(b) || (names && names.size && canonicalKey(a, names) === canonicalKey(b, names)) || (covers(a, b) && covers(b, a));
}

/** The clearer of two names for one ingredient: the fuller one ("rye whiskey" over "rye"); the first on a tie. */
const clearer = (a, b) => (b.split(' ').length > a.split(' ').length ? b : a);

/** Fold alternatives that are one ingredient under two names into one entry, keeping the clearer name. */
function foldSameIngredient(list) {
  const out = [];
  for (const a of list) {
    // Another form of the same ingredient (dried thyme, thyme powder) is a different answer, never folded away.
    if (a.kind === 'form') { out.push(a); continue; }
    const at = out.findIndex((o) => o.kind !== 'form' && sameIngredient(o.key, a.key));
    if (at < 0) { out.push(a); continue; }
    const o = out[at];
    const keep = clearer(o.key, a.key) === o.key ? o : a;
    out[at] = { ...keep, have: o.have || a.have };
  }
  return out;
}

/** True when a bar-spirit alternative is even possible for this key (the screen loads the role table only then). */
export function needsRoles(key) {
  return isBooze(key);
}

/**
 * @param {{ key: string, label?: string }} item  a shopping row
 * @param {{ has?: (key: string) => boolean, roles?: object|null, names?: Set<string>|null, sauce?: boolean,
 *           main?: boolean|null, swaps?: (name: string) => Array, max?: number }} ctx
 *   has   — does the cook have it (kitchen, pantry or bar; makeHas)
 *   roles — public/data/cocktail_roles.json byIngredient; without it no bar alternative is offered
 *   main  — rowMain(): is the ingredient a main of the row's recipe(s)? Only false offers a supportingOnly swap
 *   swaps — the food table lookup, every kind (defaults to kitchenSwaps.standInsFor; tests inject entries)
 * @returns {{ alternatives: Array<{ key, label, kind: 'swap'|'form'|'make', source: 'kitchenSwaps'|'cocktailRiff', plus: string[],
 *   useText: string, ratio: number|null, amountNote: string|null, note: string|null, dropQty: boolean,
 *   sameKey: boolean (a form the list stores under the row's own key), have: boolean }>,
 *   known: boolean, none?: { reason: string }, withheld?: Array<{ key: string, reason: string }> }}
 *   (none and withheld are present only when there is something to say)
 *   none — an honest "nothing replaces it" (no alternatives are then listed); withheld — supporting-only swaps
 *   left out, each with the reason, so the sheet can say why.
 */
export function alternativesFor(item, { has = () => false, roles = null, names = null, sauce = false, main = null, swaps = realStandInsFor, max = MAX_ALTERNATIVES } = {}) {
  const key = String(item?.key || '');
  const out = [];
  const withheld = [];
  const seen = new Set([key]);
  const entries = swaps(key);

  const nothing = entries.find((s) => standInKind(s) === 'none');
  if (nothing) return { alternatives: [], known: false, none: { reason: String(nothing.reason || '') } };

  for (const s of entries) {
    if (sauce && s.sauce === false) continue;
    const form = standInKind(s) === 'form';
    // A form of the row's own ingredient ("dried thyme" for "thyme") resolves to the same list key on purpose; any
    // other kind of stand-in that is the same ingredient as the row is no stand-in at all.
    if (seen.has(s.use) || (form ? s.use === key : sameIngredient(key, s.use, names)) || !isSuggestable(s.use)) continue;
    let note = s.note ? String(s.note) : null;
    if (s.supportingOnly) {
      if (main !== false) {
        if (!withheld.some((w) => w.key === s.use)) {
          withheld.push({ key: s.use, reason: main === true
            ? `${cap(s.use)} for ${key} only works where ${key} is not the point of the dish, and here it is.`
            : `${cap(s.use)} for ${key} only works where ${key} is not the point of the dish, and this row did not come from a recipe I can check.` });
        }
        continue;
      }
      note = `${s.supportingNote || 'fine as a supporting ingredient'}; not if ${key} is the point of the dish`;
    }
    seen.add(s.use);
    const kind = standInKind(s);
    const plus = [...(s.plus || [])];
    const ratio = validRatio(s.ratio);
    const amountNote = s.amountNote ? String(s.amountNote) : null;
    const text = swapUseText(s);
    out.push({
      key: s.use, label: s.use, kind, source: 'kitchenSwaps', plus, ratio, amountNote, note,
      dropQty: kind === 'make' || (!ratio && !!amountNote),
      sameKey: form && sameIngredient(key, s.use, names),
      useText: kind === 'make' ? `Make it from ${text}.` : `Use ${text} instead.${ratio ? ` Use ${ratioText(ratio)}.` : ''}`,
      // The kitchen stores one name for fresh and dried, so it cannot say the cook has this FORM.
      have: !(form && sameIngredient(key, s.use, names)) && has(s.use) && plus.every((p) => has(p)),
    });
  }

  if (roles && roles[key]?.role === 'spirit' && isBooze(key, roles) && roleOf(key, roles) === 'spirit') {
    const family = familyKey(key);
    if (SPIRIT_FAMILIES.has(family) && (key === family || key === 'whisky' || plainBottle(key, family))) {
      const pool = buildRolePool(roles, names || new Set());
      const rows = [{ key, role: 'spirit', swappable: true }];
      for (const c of swapCandidates(rows, 0, pool, NO_PAIRING, 60)) {
        if (seen.has(c.name) || sameIngredient(key, c.name) || familyKey(c.name) !== family || !plainBottle(c.name, family)) continue;
        seen.add(c.name);
        out.push({
          key: c.name, label: c.name, kind: 'swap', source: 'cocktailRiff', plus: [], ratio: null, amountNote: null, note: null, dropQty: false, sameKey: false,
          useText: `Another ${family} could stand in; it will taste a little different.`,
          have: has(c.name),
        });
      }
    }
  }

  // Ones the cook already has first; otherwise the order the sources gave (stable).
  const folded = foldSameIngredient(out);
  const ordered = [...folded.filter((a) => a.have), ...folded.filter((a) => !a.have)].slice(0, max);
  return { alternatives: ordered, known: ordered.length > 0, ...(withheld.length ? { withheld } : {}) };
}

/**
 * The amount to give replaceItem for a swap, or undefined to keep the row's own quantity. A ratio from the table
 * scales a row with exactly one numeric part. '' (no quantity at all) when the entry is a 'make' or converts by an
 * amountNote alone: the row's number would be wrong for the new thing, and the note carries the amount.
 */
export function swappedAmount(item, alt) {
  if (alt?.dropQty) return '';
  const r = validRatio(alt?.ratio);
  const parts = item?.parts || [];
  if (!r || parts.length !== 1 || !(parts[0].qty > 0)) return undefined;
  const qty = Math.round(parts[0].qty * r * 100) / 100;
  return `${qty}${parts[0].unit ? ` ${parts[0].unit}` : ''}`;
}

/**
 * Put a removed row back exactly where it was ("Use what I have", then Undo). If the same ingredient was added
 * again meanwhile, fold it into that line by the merge rule instead of listing it twice.
 */
export function restoreRow(list, row, index, now = Date.now()) {
  const items = list.items.slice();
  const twin = row.checked ? -1 : items.findIndex((i) => !i.checked && i.key === row.key);
  if (twin < 0) {
    items.splice(Math.min(Math.max(index, 0), items.length), 0, { ...row, updatedAt: now });
  } else {
    let parts = items[twin].parts;
    for (const p of row.parts) parts = addPart(parts, p);
    items[twin] = { ...items[twin], parts, from: [...new Set([...items[twin].from, ...row.from])], updatedAt: now };
  }
  return { ...list, items };
}
