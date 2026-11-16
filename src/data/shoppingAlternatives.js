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
 * Quantities: no entry in the swap table carries a numeric ratio, so today the original quantity is always kept
 * and the usage sentence is shown as a note. If an entry gains a numeric `ratio`, a row with exactly one numeric
 * part is scaled by it. Nothing here applies anything; the screen does, on a tap.
 */
import { swapsFor as realSwapsFor, swapUseText } from './kitchenSwaps.js';
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

// Two names for one ingredient: the same curated name after the aliases, or each one covers the other in the
// bar's own equivalence table ("rye" and "rye whiskey", "lemon" and "lemon juice"). A same-family bottle that merely
// could stand in (bourbon for rye) is a substitution, not the same ingredient.
const covers = (a, b) => { const r = coverLine({ key: a }, new Set([b])); return r.covered && !r.substitution; };
export function sameIngredient(a, b) {
  return a === b || canonicalKey(a) === canonicalKey(b) || (covers(a, b) && covers(b, a));
}

/** The clearer of two names for one ingredient: the fuller one ("rye whiskey" over "rye"); the first on a tie. */
const clearer = (a, b) => (b.split(' ').length > a.split(' ').length ? b : a);

/** Fold alternatives that are one ingredient under two names into one entry, keeping the clearer name. */
function foldSameIngredient(list) {
  const out = [];
  for (const a of list) {
    const at = out.findIndex((o) => sameIngredient(o.key, a.key));
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
 *           swaps?: (name: string) => Array, max?: number }} ctx
 *   has   — does the cook have it (kitchen, pantry or bar; makeHas)
 *   roles — public/data/cocktail_roles.json byIngredient; without it no bar alternative is offered
 *   swaps — the food table lookup (defaults to kitchenSwaps.swapsFor; tests inject entries to try a ratio)
 * @returns {{ alternatives: Array<{ key, label, source: 'kitchenSwaps'|'cocktailRiff', plus: string[], useText: string,
 *   ratio: number|null, have: boolean }>, known: boolean }}
 */
export function alternativesFor(item, { has = () => false, roles = null, names = null, sauce = false, swaps = realSwapsFor, max = MAX_ALTERNATIVES } = {}) {
  const key = String(item?.key || '');
  const out = [];
  const seen = new Set([key]);

  for (const s of swaps(key)) {
    if (s.supportingOnly) continue;
    if (sauce && s.sauce === false) continue;
    if (seen.has(s.use) || sameIngredient(key, s.use) || !isSuggestable(s.use)) continue;
    seen.add(s.use);
    const plus = [...(s.plus || [])];
    const ratio = validRatio(s.ratio);
    const text = swapUseText(s);
    out.push({
      key: s.use, label: s.use, source: 'kitchenSwaps', plus, ratio,
      useText: `Use ${text} instead.${ratio ? ` Use ${ratioText(ratio)}.` : ''}`,
      have: has(s.use) && plus.every((p) => has(p)),
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
          key: c.name, label: c.name, source: 'cocktailRiff', plus: [], ratio: null,
          useText: `Another ${family} could stand in; it will taste a little different.`,
          have: has(c.name),
        });
      }
    }
  }

  // Ones the cook already has first; otherwise the order the sources gave (stable).
  const folded = foldSameIngredient(out);
  const ordered = [...folded.filter((a) => a.have), ...folded.filter((a) => !a.have)].slice(0, max);
  return { alternatives: ordered, known: ordered.length > 0 };
}

/**
 * The amount to give replaceItem for a swap, or undefined to keep the row's own quantity. Only a ratio from the
 * table, and only a row with exactly one numeric part, changes a number.
 */
export function swappedAmount(item, alt) {
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
