/**
 * sharedSeed.js — "Make it your own": a shared recipe as the `seed` of its lab's Invent
 * panel (the same shapes inventSearch.js produces), so the panel opens with every line
 * of the recipe in the list and its category already chosen. Pure. Loaded on demand by
 * the shared page (it pulls in the invent data modules).
 *
 *   inventSeedForShared(recipe) → { lab: 'cocktail'|'sauce'|'make', seed } | null
 *     cocktail  { familyId, fromName: true, pinned }    family = the cocktail's own
 *     sauce     { styleId,  fromName: true, pinned }    style = its mother sauce
 *     dish      { type,     fromName: true, main?, pinned }   type = its dish type's skeleton
 * Without a known category fromName is left off (the panel opens with the lines and no
 * style chosen). Amounts are not carried: the panel suggests its own.
 */
import { FAMILY_SKELETONS } from './cocktailInvent.js';
import { INVENT_STYLE_BY_ID } from './inventSauce.js';
import { DISH_SKELETONS, dishTypeForIngredients, isMainKey } from './dishSkeletons.js';
import { barKey } from './myBar.js';
import { kitchenKey } from './myKitchen.js';

const pins = (keys) => keys.map((key) => ({ key, source: 'search' }));
const uniq = (list) => [...new Set(list.filter(Boolean))];
const NEAREST_SKELETON = { curry: 'braise-stew', noodles: 'stir-fry', fish: 'roast', wrap: 'tacos' };
const SKELETON_BY_DISH_TYPE = new Map(Object.values(DISH_SKELETONS).map((d) => [d.dishType, d.id]));

export function inventSeedForShared(recipe) {
  if (!recipe || !Array.isArray(recipe.lines) || !recipe.lines.length) return null;

  if (recipe.kind === 'cocktail') {
    const pinned = uniq(recipe.lines.map((l) => barKey(l.label || l.key) || l.key));
    const known = FAMILY_SKELETONS[recipe.categoryId];
    return { lab: 'cocktail', seed: { ...(known ? { familyId: recipe.categoryId, fromName: true } : {}), pinned: pins(pinned) } };
  }
  if (recipe.kind === 'sauce') {
    const pinned = uniq(recipe.lines.map((l) => kitchenKey(l.key)));
    const known = INVENT_STYLE_BY_ID.has(recipe.categoryId);
    return { lab: 'sauce', seed: { ...(known ? { styleId: recipe.categoryId, fromName: true } : {}), pinned: pins(pinned) } };
  }
  if (recipe.kind === 'dish') {
    const keys = uniq(recipe.lines.map((l) => kitchenKey(l.key)));
    const type = SKELETON_BY_DISH_TYPE.get(recipe.categoryId) || NEAREST_SKELETON[recipe.categoryId] || dishTypeForIngredients(keys);
    const main = keys.find((k) => isMainKey(k)) || null;
    return {
      lab: 'make',
      seed: { ...(DISH_SKELETONS[type] ? { type, fromName: true } : {}), ...(main ? { main } : {}), pinned: pins(keys.filter((k) => k !== main)) },
    };
  }
  return null;
}
