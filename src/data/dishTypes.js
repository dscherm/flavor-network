/**
 * dishTypes.js — the ONE list of dish types (DATA-7), read by the Cookbook (dishType.js: the drawing and the label on a
 * recipe tile) and by Invent a recipe (dishSkeletons.js, sharedSeed.js, inventSearch.js: which skeleton a recipe opens on).
 * Pure data, no imports.
 *
 * Each type is { id, label, skeleton, why? }:
 *   skeleton  the Invent a recipe skeleton id (dishSkeletons.js DISH_SKELETONS) a dish of this type opens on, or null.
 *   why       required when the skeleton is only the nearest kin or there is none; one line saying why.
 * A type is OWN when its skeleton's `dishType` field is this id (stir-fry <-> wok); otherwise the skeleton is the nearest kin.
 *
 * The rule for a type without a skeleton (skeleton null): Invent opens on the skeleton the ingredients fit best
 * (dishTypeForIngredients), exactly as for a recipe with no type at all. Nothing is guessed from the type.
 *
 * Which type a recipe has is decided in dishType.js (dishTypeOf). Dishes with a single member were folded (DATA-7):
 * pizza into bake, shakshuka (skillet) into stew, taco and wrap into one, sandwich and baguette into one, tapas into veg.
 */

export const DISH_TYPE_LIST = [
  { id: 'soup', label: 'Soup', skeleton: 'soup' },
  { id: 'noodles', label: 'Noodles', skeleton: 'stir-fry', why: 'noodle dishes are tossed in a hot pan or sit in broth; the stir-fry skeleton (main, vegetable, aromatic, sauce, starch) is the closer one' },
  { id: 'pasta', label: 'Pasta', skeleton: 'pasta' },
  { id: 'rice', label: 'Rice', skeleton: 'grain-bowl' },
  { id: 'curry', label: 'Curry', skeleton: 'braise-stew', why: 'a curry is a main simmered in a spiced liquid, which is what the braise / stew skeleton lists' },
  { id: 'stew', label: 'Stew & braise', skeleton: 'braise-stew' },
  { id: 'grill', label: 'Grill & skewers', skeleton: 'roast' },
  { id: 'fish', label: 'Fish & shellfish', skeleton: 'roast', why: 'fish is a main cooked with a fat and herbs, as in the roast skeleton' },
  { id: 'salad', label: 'Salad', skeleton: 'salad' },
  { id: 'wok', label: 'Stir-fry', skeleton: 'stir-fry' },
  { id: 'taco', label: 'Tacos & wraps', skeleton: 'tacos' },
  { id: 'sandwich', label: 'Sandwiches & burgers', skeleton: null, why: 'no skeleton has a bread slot; the type is read from the ingredients' },
  { id: 'dumpling', label: 'Dumplings', skeleton: null, why: 'a filled dough: no skeleton has a dough or a filling slot' },
  { id: 'dip', label: 'Dip', skeleton: null, why: 'a dip is a sauce more than a dish; no skeleton fits' },
  { id: 'bake', label: 'Bread, pizza & bakes', skeleton: null, why: 'baked dough and pastry: no skeleton has a dough slot' },
  { id: 'dessert', label: 'Dessert', skeleton: null, why: 'every skeleton is savoury' },
  { id: 'veg', label: 'Vegetables & small plates', skeleton: null, why: 'a vegetable-led dish has no main to build around; the type is read from the ingredients' },
  { id: 'plate', label: 'Dish', skeleton: null, why: 'the fallback for a recipe that matches nothing; the type is read from the ingredients' },
];

export const DISH_TYPE_BY_ID = new Map(DISH_TYPE_LIST.map((t) => [t.id, t]));

/** Ids that existed before DATA-7 and were folded into another type. A saved or linked old id still resolves. */
export const LEGACY_DISH_TYPE = {
  wrap: 'taco', pizza: 'bake', skillet: 'stew', baguette: 'sandwich', tapas: 'veg',
};

/** The current type id for any id, old or new; 'plate' for anything unknown. */
export function canonicalDishType(id) {
  const key = String(id ?? '');
  if (DISH_TYPE_BY_ID.has(key)) return key;
  return LEGACY_DISH_TYPE[key] || 'plate';
}

/** The Invent a recipe skeleton id a dish type opens on, or null (then the ingredients decide). Accepts old ids. */
export function skeletonForDishType(id) {
  return DISH_TYPE_BY_ID.get(canonicalDishType(id))?.skeleton || null;
}
