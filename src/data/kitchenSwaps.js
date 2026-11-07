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
 * Checked against the blended everyday-pairs index (scripts/
 * measureKitchenMakeable.mjs): the two sides of each swap share partners.
 */

const S = (forName, use, role, kind, extra = {}) => ({ for: forName, use, role, kind, plus: [], ...extra });
/** A two-way swap: a for b and b for a. */
const both = (a, b, role, kind, extra = {}) => [S(a, b, role, kind, extra), S(b, a, role, kind, extra)];

export const SWAPS = [
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
  ...both('butter', 'olive oil', 'fat', 'cooking fat', { supportingOnly: true, sauce: false }),
  S('butter', 'vegetable oil', 'fat', 'cooking fat', { supportingOnly: true, sauce: false }),
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
];

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const BY_FOR = new Map();
for (const s of SWAPS) {
  const k = norm(s.for);
  if (!BY_FOR.has(k)) BY_FOR.set(k, []);
  BY_FOR.get(k).push(s);
}

/** Every swap for one recipe item (table order). */
export function swapsFor(name) {
  return BY_FOR.get(norm(name)) || [];
}

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
    if (inRecipe.has(norm(s.use))) continue;
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
