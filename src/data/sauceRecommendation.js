/**
 * sauceRecommendation.js — bowl-aware sauce ranker for the "Suggested
 * sauces" chip row (RL-SAUCE-SUGGEST, RECIPE-LAB-SPEC §15.1).
 *
 * Inputs: bowl ingredient names + parsed sauce list + optional
 * recipeType (Main / Side / Appetizer / Dessert / Drink / Sauce / Other).
 *
 * Score per sauce (descending):
 *   1. Ingredient overlap — number of bowl ingredients also in the
 *      sauce recipe (primary signal)
 *   2. Type-compatibility — gate that drops sauces whose class doesn't
 *      match the chosen recipeType (Dessert → sweet sauces only;
 *      Main/Side/Appetizer → savory; Drink → cocktail; Sauce → all
 *      classes; Other / null → no gate)
 *
 * Aroma-match (§15.1 #2) is intentionally deferred to a later pass; the
 * existing handleFindSauce aroma-match bridge already covers that
 * signal when the user taps a chip and lands in Sauce Lab.
 */

const SWEET_MARKERS = new Set([
  'sugar', 'brown sugar', 'powdered sugar', 'caramel', 'vanilla',
  'chocolate', 'cocoa', 'honey', 'maple syrup', 'syrup', 'fruit',
  'berry', 'cherry', 'strawberry', 'raspberry', 'jam', 'preserves',
  'condensed milk', 'creme anglaise',
]);

const COCKTAIL_MARKERS = new Set([
  'vodka', 'gin', 'rum', 'tequila', 'whiskey', 'whisky', 'bourbon',
  'cognac', 'brandy', 'wine', 'champagne', 'vermouth', 'aperol',
  'campari', 'amaro', 'liqueur', 'bitters',
]);

export function classifySauce(sauce) {
  const ings = (sauce.ingredients || []).map((i) => {
    const name = typeof i === 'string' ? i : i?.name;
    return name ? name.toLowerCase() : '';
  });
  if (ings.some((n) => SWEET_MARKERS.has(n))) return 'sweet';
  if (ings.some((n) => COCKTAIL_MARKERS.has(n))) return 'cocktail';
  return 'savory';
}

const RECIPE_TYPE_ALLOWED = {
  main: new Set(['savory']),
  side: new Set(['savory']),
  appetizer: new Set(['savory']),
  dessert: new Set(['sweet']),
  drink: new Set(['cocktail']),
  sauce: new Set(['savory', 'sweet', 'cocktail']),
};

export function rankSauces(bowl, sauces, recipeType = null, K = 5) {
  if (!Array.isArray(sauces) || sauces.length === 0) return [];
  if (!Array.isArray(bowl) || bowl.length === 0) return [];

  const bowlSet = new Set(bowl.map((n) => String(n).toLowerCase()));
  const allowed = recipeType ? RECIPE_TYPE_ALLOWED[recipeType] : null;

  const ranked = [];
  for (const sauce of sauces) {
    const sauceClass = classifySauce(sauce);
    if (allowed && !allowed.has(sauceClass)) continue;

    const sauceIngs = (sauce.ingredients || []).map((i) => {
      const name = typeof i === 'string' ? i : i?.name;
      return name ? name.toLowerCase() : '';
    });
    const overlap = sauceIngs.filter((n) => bowlSet.has(n)).length;
    if (overlap === 0) continue;

    ranked.push({ name: sauce.name, overlap, class: sauceClass, sauce });
  }

  ranked.sort((a, b) => b.overlap - a.overlap);
  return ranked.slice(0, K);
}
