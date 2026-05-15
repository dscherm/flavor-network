/**
 * cookingMethods.js — Phase 3 of task 6.
 *
 * Defines a 13-method culinary cooking taxonomy + a role → compatible
 * methods lookup. Lets the FlavorPieWheel (and its consumers) treat
 * "method" as a first-class axis alongside aroma, taste, and season.
 *
 * v1 is heuristic — methods are derived from the ingredient's role
 * (protein → grill/roast/sear/braise/sauté/fry/poach/smoke/confit;
 * vegetable → roast/sauté/braise/grill/steam/raw; herb → raw/garnish;
 * etc.). v2 would mine the RecipeNLG corpus for actual co-occurrence
 * between an ingredient name and method verbs.
 *
 * Used by AffinityFlavorWheel via neighborBucketKey('method', node).
 */

import { getGeneralRole } from './ingredientRoles.js';

export const COOKING_METHODS = [
  'grill', 'roast', 'sear', 'braise', 'saute', 'fry',
  'poach', 'boil', 'steam', 'bake', 'smoke', 'raw', 'confit',
];

// Role → likely cooking methods (rough heuristic). Order matters: the
// FIRST entry is the "dominant" method, surfaced as the bucket key
// when assigning a single ingredient to one bucket.
const ROLE_TO_METHODS = {
  protein:   ['roast', 'grill', 'sear', 'braise', 'saute', 'fry', 'smoke', 'poach', 'confit'],
  starch:    ['boil', 'bake', 'steam', 'saute'],
  vegetable: ['roast', 'saute', 'braise', 'grill', 'steam', 'raw'],
  fruit:     ['raw', 'bake', 'roast', 'poach'],
  dairy:     ['raw', 'bake'],
  fat:       ['saute', 'fry', 'confit'],
  acid:      ['raw'],
  sweetener: ['bake'],
  aromatic:  ['saute', 'roast', 'raw'],
  herb:      ['raw'],
  spice:     ['saute', 'roast', 'bake'],
  thickener: ['boil'],
  salt:      ['raw'],
  other:     ['raw'],
};

/**
 * Returns the list of cooking methods that pair well with this
 * ingredient. Defaults to ['raw'] when no role hits.
 *
 * @param {string} name
 * @param {object=} node
 * @returns {string[]}
 */
export function methodsFor(name, node) {
  const role = getGeneralRole(name, node);
  return ROLE_TO_METHODS[role] || ['raw'];
}

/**
 * Returns a SINGLE dominant method bucket-key — used by wheel
 * classifiers that pick one bucket per ingredient.
 *
 * @returns {string}
 */
export function dominantMethodFor(name, node) {
  const methods = methodsFor(name, node);
  return methods[0] || 'raw';
}

/**
 * Method → role compatibility (inverse map for ingredient suggestion).
 */
export function rolesForMethod(method) {
  const out = [];
  for (const [role, methods] of Object.entries(ROLE_TO_METHODS)) {
    if (methods.includes(method)) out.push(role);
  }
  return out;
}
