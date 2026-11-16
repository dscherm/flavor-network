/**
 * kitchenSwaps.js — everyday substitutions for "What's in my kitchen?" and
 * "What do I need?" (WEAK-3): "use your onion for the scallion".
 *
 * One hand-written table. The rule is the Sauce Lab stand-in rule (see
 * saucePantry.js): a swap stays within one ROLE and one KIND, never across.
 * Onion for scallion (both alliums), cilantro for parsley (both soft
 * herbs), stock for white wine (both the cooking liquid of a pan), never
 * garlic for onion or flour for egg.
 *
 * Each entry: `for` the recipe's item, `use` the kitchen item that stands
 * in for it, `plus` any helpers the swap needs (milk + butter for cream),
 * `role` the ingredient-graph category both sides share, `kind` the finer
 * group, and:
 *   - `supportingOnly`: the swap holds only when the item is a supporting
 *     one in that recipe (butter ↔ oil for sautéing, not in a pastry);
 *   - `sauce: false`: the swap does not hold in a sauce (milk will not
 *     reduce like cream; sour cream splits). The Sauce Lab's pantry stays
 *     strict, and a test checks this flag never contradicts its stand-in
 *     rule (saucePantry.sameRoleAndKind).
 *
 * FOUR KINDS of answer (STANDIN-1). An entry carries an optional `type`:
 *   'swap' (the default, and what every entry above is): another ingredient, shallot for onion;
 *   'form': the same thing in another form (dried thyme for fresh, garlic powder for a clove);
 *   'make': made from things (simple syrup from sugar and water): `use` is the first part, `plus` the rest;
 *   'none': nothing replaces it (`reason` says why; no `use`).
 * Any kind may carry `ratio` (one numeric factor, applied to a row's single number), `amountNote` (a conversion that
 * is not one factor: "1 tsp dried for 1 tbsp fresh") and `note`.
 *
 * WHO MAY USE WHICH. The recipe side (findSwap, swapsFor, SWAPS: "what do I need", "what can I cook", the invent
 * panels, the Sauce Lab) reads ONLY swap-kind entries, exactly as before: a recipe is never counted as makeable
 * through a dried herb for a fresh one, or a syrup made from sugar. The shopping sheet reads every kind through
 * standInsFor / STAND_INS. A swap-kind entry may keep its `plus` helpers (cream: milk and butter); those are
 * untyped on purpose, so the recipe side and the sheet treat them as they always did.
 *
 * Checked against the blended everyday-pairs index (scripts/
 * measureKitchenMakeable.mjs): the two sides of each swap share partners.
 */
import { isSuggestable } from './curation/suggestable.js';

const S = (forName, use, role, kind, extra = {}) => ({ for: forName, use, role, kind, plus: [], ...extra });
/** A two-way swap: a for b and b for a. */
const both = (a, b, role, kind, extra = {}) => [S(a, b, role, kind, extra), S(b, a, role, kind, extra)];
/** The same thing in another form: dried thyme for fresh thyme. */
export const FORM = (forName, use, role, kind, extra = {}) => S(forName, use, role, kind, { type: 'form', ...extra });
/** Made from parts: parts[0] is `use`, the rest are `plus`. */
export const MAKE = (forName, parts, role, kind, extra = {}) => S(forName, parts[0], role, kind, { type: 'make', plus: parts.slice(1), ...extra });
/** Nothing replaces it; `reason` is one line saying why. */
export const NONE = (forName, reason, role = null, kind = null, extra = {}) => ({ for: forName, use: null, role, kind, plus: [], type: 'none', reason, ...extra });

const TABLE = [
  // Alliums. Never garlic: it is not an onion.
  S('scallion', 'onion', 'aromatic', 'onion'),
  S('shallot', 'onion', 'aromatic', 'onion'),
  S('leek', 'onion', 'aromatic', 'onion'),
  ...both('onion', 'purple onion', 'aromatic', 'onion'),
  S('pearl onion', 'onion', 'aromatic', 'onion'),
  S('onion', 'shallot', 'aromatic', 'onion'),
  S('scallion', 'leek', 'aromatic', 'onion'),
  // Soft herbs.
  ...both('parsley', 'cilantro', 'herb', 'soft herb'),
  // Citrus.
  ...both('lime', 'lemon', 'citrus', 'citrus'),
  ...both('lime juice', 'lemon juice', 'citrus', 'citrus'),
  // Cooking liquid. Wine → stock in a pan or braise; not in a sauce (the
  // Sauce Lab treats wine and stock as different kinds).
  S('white wine', 'chicken stock', 'liquid', 'cooking liquid', { sauce: false }),
  S('white wine', 'vegetable broth', 'liquid', 'cooking liquid', { sauce: false }),
  S('white wine', 'stock', 'liquid', 'cooking liquid', { sauce: false }),
  S('white wine', 'broth', 'liquid', 'cooking liquid', { sauce: false }),
  ...both('beef stock', 'chicken stock', 'liquid', 'stock'),
  ...both('vegetable broth', 'chicken stock', 'liquid', 'stock'),
  S('beef stock', 'stock', 'liquid', 'stock'),
  S('vegetable broth', 'stock', 'liquid', 'stock'),
  S('beef stock', 'broth', 'liquid', 'stock'),
  S('vegetable broth', 'broth', 'liquid', 'stock'),
  // Cultured and rich dairy.
  ...both('yogurt', 'sour cream', 'dairy', 'cultured dairy'),
  S('creme fraiche', 'sour cream', 'dairy', 'cultured dairy', { sauce: false }),
  S('creme fraiche', 'cream', 'dairy', 'cream'),
  S('cream', 'milk', 'dairy', 'cream', { plus: ['butter'], sauce: false }),
  S('buttermilk', 'milk', 'dairy', 'cultured dairy', { plus: ['lemon'], sauce: false }),
  S('buttermilk', 'yogurt', 'dairy', 'cultured dairy'),
  // Cheeses of one kind.
  ...both('parmesan', 'pecorino', 'umami', 'hard cheese'),
  ...both('cheddar', 'monterey jack cheese', 'dairy', 'melting cheese'),
  ...both('feta', 'cotija cheese', 'dairy', 'crumbly cheese'),
  // Fat for the pan (not for a pastry or a cake).
  ...both('butter', 'olive oil', 'fat', 'cooking fat', { supportingOnly: true, sauce: false, supportingNote: 'fine for frying' }),
  S('butter', 'vegetable oil', 'fat', 'cooking fat', { supportingOnly: true, sauce: false, supportingNote: 'fine for frying' }),
  S('ghee', 'butter', 'fat', 'butter'),
  // Sweeteners.
  ...both('honey', 'sugar', 'sweetener', 'sweet'),
  ...both('honey', 'maple syrup', 'sweetener', 'sweet'),
  S('brown sugar', 'sugar', 'sweetener', 'sweet'),
  S('palm sugar', 'brown sugar', 'sweetener', 'sweet'),
  S('palm sugar', 'sugar', 'sweetener', 'sweet'),
  // Vinegars.
  S('rice vinegar', 'apple cider vinegar', 'acid', 'vinegar'),
  S('sherry vinegar', 'red wine vinegar', 'acid', 'vinegar'),
  ...both('apple cider vinegar', 'white wine vinegar', 'acid', 'vinegar'),
  // Fresh chilies.
  ...both('jalapeno chile', 'serrano pepper', 'chili', 'fresh chili'),
  S('green chili pepper', 'jalapeno chile', 'chili', 'fresh chili'),
  S('green chili pepper', 'serrano pepper', 'chili', 'fresh chili'),
  // Bread, pasta and tortillas of one shape.
  S('bread baguette', 'bread', 'grain', 'bread'),
  S('linguine pasta', 'pasta', 'grain', 'long pasta'),
  S('linguine pasta', 'spaghetti', 'grain', 'long pasta'),
  S('pasta', 'spaghetti', 'grain', 'pasta'),
  S('macaroni', 'pasta', 'grain', 'short pasta'),
  S('corn tortilla', 'tortilla', 'grain', 'tortilla'),
  S('corn tortilla', 'flour tortilla', 'grain', 'tortilla'),
  // The other three kinds. STANDIN-1 writes ONE real entry, an honest 'none' (egg); STANDIN-2 and STANDIN-3 write
  // the forms and the makes (the tests build theirs with FORM / MAKE / NONE). Written from common cooking
  // knowledge (the assistant's judgement).
  NONE('egg', 'an egg sets and binds a custard, a quiche or a hollandaise; nothing else does both', 'protein', 'egg'),
];

const kindOf = (s) => s.type || 'swap';
/** Every entry of every kind (the shopping sheet reads this). */
export const STAND_INS = TABLE;
/** The swap-kind entries only: the recipe side's table, and what the strictness tests check. */
export const SWAPS = TABLE.filter((s) => kindOf(s) === 'swap');

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const group = (list) => {
  const by = new Map();
  for (const s of list) {
    const k = norm(s.for);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  return by;
};
const BY_FOR = group(SWAPS);
const ALL_BY_FOR = group(STAND_INS);

/** Every SWAP for one recipe item (table order). The recipe side's lookup: never a form, a make or a none. */
export function swapsFor(name) {
  return BY_FOR.get(norm(name)) || [];
}

/** Every stand-in of every kind for one item (table order). The shopping sheet's lookup. */
export function standInsFor(name) {
  return ALL_BY_FOR.get(norm(name)) || [];
}

/** 'swap' | 'form' | 'make' | 'none' */
export const standInKind = kindOf;

/**
 * The first swap from the table the kitchen can make for one missing item.
 *
 * @param {string} name — the recipe's item
 * @param {(item: string) => boolean} has — does the kitchen cover an item
 *   (directly, by an equivalent, or as an assumed basic)? No swaps inside.
 * @param {{ main?: boolean, inRecipe?: Set<string>, sauce?: boolean }} opts
 *   main — the item is a main of this recipe (drops `supportingOnly` swaps);
 *   inRecipe — items the recipe already uses (they cannot double up);
 *   sauce — only swaps that hold in a sauce.
 * @returns {{ for: string, use: string, plus: string[], role: string, kind: string } | null}
 */
export function findSwap(name, has, { main = false, inRecipe = new Set(), sauce = false } = {}) {
  for (const s of swapsFor(name)) {
    if (main && s.supportingOnly) continue;
    if (sauce && s.sauce === false) continue;
    if (inRecipe.has(norm(s.use)) || !isSuggestable(s.use)) continue;
    if (!has(s.use) || !s.plus.every(has)) continue;
    return { for: name, use: s.use, plus: [...s.plus], role: s.role, kind: s.kind };
  }
  return null;
}

/** "your onion" · "your milk and butter" */
export function swapUseText(swap) {
  if (!swap) return '';
  const items = [swap.use, ...(swap.plus || [])];
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
