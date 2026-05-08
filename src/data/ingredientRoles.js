/**
 * ingredientRoles.js — structural-role lookup for replace-mode
 * suggestions.
 *
 * Three role vocabularies, one per lab:
 *
 *   cocktail (553 ingredients): spirit | sour | sweet | vermouth |
 *                               bitter | modifier | amaro_liqueur |
 *                               aromatic
 *     Source: cocktails_v2 slot dictionary + cocktail_augment.codexRole
 *     fallback. Loaded from `public/data/cocktail_roles.json`.
 *
 *   sauce (175 ingredients):    base | liquid | acid | thickener |
 *                               aromatic | seasoning | umami | heat |
 *                               accent | dairy | other (etc.)
 *     Source: sauce_augment.codexRole. Loaded from
 *     `public/data/sauce_roles.json`.
 *
 *   general (3,913 ingredients): fat | acid | dairy | sweetener |
 *                                salt | thickener | starch | herb |
 *                                spice | aromatic | protein | fruit |
 *                                vegetable | other
 *     Source: regex-on-name first, then GNN cluster default. Computed
 *     at lookup time — no JSON file needed.
 *
 * Role purity is enforced in replace-mode: a candidate must have the
 * SAME role as the focal ingredient or it's filtered out. This stops
 * "replace gin → demerara sugar" / "replace butter → vinegar" / etc.
 */

let cocktailRolesPromise = null;
let sauceRolesPromise = null;

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) return null;
  return res.json();
}

export function getCocktailRoles() {
  if (!cocktailRolesPromise) {
    cocktailRolesPromise = fetchJson('/data/cocktail_roles.json')
      .then((d) => d?.byIngredient || {})
      .catch(() => ({}));
  }
  return cocktailRolesPromise;
}

export function getSauceRoles() {
  if (!sauceRolesPromise) {
    sauceRolesPromise = fetchJson('/data/sauce_roles.json')
      .then((d) => d?.byIngredient || {})
      .catch(() => ({}));
  }
  return sauceRolesPromise;
}

// ────────────────────────────────────────────────────────────────
// General-meals classifier (regex-then-cluster).
//
// Order matters — high-precision regexes first so "olive oil" lands
// as "fat" not "vegetable" (would-be cluster default for "olive").
// ────────────────────────────────────────────────────────────────
const GENERAL_REGEX_RULES = [
  // Fats (oils, butters, lards, schmaltz, suet)
  [/\b(oil|butter|ghee|lard|schmaltz|suet|tallow|shortening|margarine|bacon fat|duck fat)\b/i, 'fat'],
  // Acids (vinegars, citrus juices, wine, lemon/lime concentrates)
  [/\b(vinegar|verjus|tamarind paste)\b/i, 'acid'],
  [/\b(lemon|lime|orange|grapefruit|yuzu)\s+juice\b/i, 'acid'],
  // Dairy
  [/\b(milk|cream|yogurt|kefir|buttermilk|sour cream|crème fraîche|creme fraiche|mascarpone|ricotta|cottage cheese|cream cheese|heavy cream|whipping cream|half-and-half|condensed milk|evaporated milk)\b/i, 'dairy'],
  [/\bcheese\b/i, 'dairy'],
  // Sweeteners
  [/\b(sugar|honey|syrup|nectar|molasses|jaggery|agave|stevia|maple|corn syrup|brown sugar|powdered sugar|sweetener)\b/i, 'sweetener'],
  // Salt
  [/\b(salt|fleur de sel|sea salt|kosher salt|table salt|himalayan salt)\b/i, 'salt'],
  // Thickeners / starches
  [/\b(flour|cornstarch|arrowroot|tapioca|potato starch|gelatin|agar|xanthan|guar gum|pectin)\b/i, 'thickener'],
  [/\b(rice|pasta|noodle|bread|tortilla|polenta|grits|oatmeal|couscous|quinoa|barley|farro|bulgur)\b/i, 'starch'],
  // Herbs (leafy aromatic)
  [/\b(basil|parsley|cilantro|mint|tarragon|dill|chives|chervil|sage|oregano|thyme|rosemary|marjoram|bay leaf|bay leaves|fennel fronds|sorrel|lemongrass|kaffir|makrut|curry leaves)\b/i, 'herb'],
  // Spices (powders, seeds, dried aromatics)
  [/\b(cinnamon|nutmeg|clove|cardamom|allspice|cumin|coriander|fenugreek|turmeric|saffron|paprika|chili|chile|chilli|cayenne|peppercorn|black pepper|white pepper|pink pepper|szechuan|sichuan|star anise|anise seed|caraway|mustard seed|sumac|za'atar|garam masala|five spice|berbere|harissa)\b/i, 'spice'],
  // Aromatics (alliums + ginger family) — narrow definition
  [/\b(garlic|onion|shallot|leek|scallion|spring onion|ginger|galangal|horseradish|wasabi)\b/i, 'aromatic'],
  // Proteins
  [/\b(chicken|beef|pork|lamb|veal|mutton|duck|turkey|goose|rabbit|venison|bison)\b/i, 'protein'],
  [/\b(fish|salmon|tuna|cod|halibut|mackerel|sardine|anchovy|herring|trout|bass|snapper|tilapia)\b/i, 'protein'],
  [/\b(shrimp|prawn|crab|lobster|scallop|oyster|clam|mussel|squid|octopus|cuttlefish)\b/i, 'protein'],
  [/\b(egg|tofu|tempeh|seitan|edamame|lentil|chickpea|bean|legume)\b/i, 'protein'],
  // Fruits
  [/\b(apple|pear|peach|plum|cherry|berry|berries|grape|raisin|currant|fig|date|apricot|nectarine|mango|pineapple|papaya|guava|banana|kiwi|pomegranate|persimmon|melon|watermelon|cantaloupe|honeydew|coconut)\b/i, 'fruit'],
  [/\b(lemon|lime|orange|grapefruit|tangerine|clementine|yuzu)\b/i, 'fruit'],
];

const CLUSTER_DEFAULT_ROLE = {
  // Map each GNN cluster_id to a default role based on its
  // dominant_taste + top_ingredients. Used as the fallback when
  // the regex layer doesn't match.
  0: 'fruit',       // Sweet Nuts & Cream — top: cream cheese, pecan, nut, pineapple, banana
  1: 'other',       // Pantry Staples — heterogeneous; let regex carry
  2: 'herb',        // Mediterranean Herbs
  3: 'spice',       // Spice/Heat clusters typically here
  4: 'vegetable',   // veggie-dominant
  5: 'protein',     // proteins typically here
  6: 'aromatic',
  7: 'fruit',
  8: 'dairy',
  9: 'starch',
};

export function getGeneralRole(name, node) {
  if (!name) return 'other';
  const lc = name.toLowerCase();
  for (const [re, role] of GENERAL_REGEX_RULES) {
    if (re.test(lc)) return role;
  }
  // Cluster-level fallback when name regex didn't match. Field is
  // `clusterId` on graph nodes (set in useProData.js), not
  // `cluster_id` — the snake_case form was a typo.
  const cid = node?.clusterId;
  if (typeof cid === 'number' && CLUSTER_DEFAULT_ROLE[cid]) {
    return CLUSTER_DEFAULT_ROLE[cid];
  }
  return 'other';
}

/**
 * Returns true when role A should match role B for slot-aware
 * replace suggestions. Used by IngredientSuggestionsPopout to keep
 * the gate from over-filtering when either side is unknown
 * ('other' or null).
 */
export function rolesCompatible(focalRole, candRole) {
  if (!focalRole || focalRole === 'other') return true;
  if (!candRole || candRole === 'other') return true;
  return focalRole === candRole;
}

/**
 * Single entry point. Returns a role string (lab-specific
 * vocabulary) or null when no role is known for the ingredient.
 *
 * @param {string} name
 * @param {'cocktail'|'sauce'|'general'|'taste'} labMode
 * @param {{ cocktailRoles?: Object, sauceRoles?: Object, node?: any }} ctx
 * @returns {string|null}
 */
export function roleOf(name, labMode, ctx = {}) {
  if (!name) return null;
  const lc = name.toLowerCase();
  if (labMode === 'cocktail') {
    return ctx.cocktailRoles?.[lc]?.role ?? null;
  }
  if (labMode === 'sauce') {
    return ctx.sauceRoles?.[lc]?.role ?? null;
  }
  // 'taste' / 'general' / undefined → general classifier
  return getGeneralRole(name, ctx.node);
}
