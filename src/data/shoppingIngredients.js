/**
 * shoppingIngredients.js (SHOP-2) — what the shopping list screen needs to know about ingredients, loaded
 * lazily and once: the curated ingredient NAMES (for the add box) and their CATEGORIES (for the aisles).
 * That is proDataset/ingredients.json (about 0.6 MB, curated) and nothing else: not the pairings, not the
 * graph, not any model. Nothing is fetched until the shopping screen is opened; a failed load is not cached,
 * so a later open tries again, and the list itself works without it (free text, "other" aisle).
 */
import { loadCuratedIngredients } from './curation/loadDataset.js';
import { kitchenVocab } from './kitchenRecipes.js';

let pending = null;

export function shapeIngredients(ingredients) {
  const names = new Set();
  const categories = new Map();
  for (const [name, info] of Object.entries(ingredients || {})) {
    if (name.startsWith('_') || !info) continue;
    names.add(name);
    if (typeof info.category === 'string') categories.set(name, info.category);
  }
  return { names, vocab: kitchenVocab(names), categories };
}

/** @returns {Promise<{ names: Set<string>, vocab: string[], categories: Map<string, string> }>} */
export function loadShoppingIngredients(fetchFn = (url) => fetch(url)) {
  if (!pending) {
    pending = loadCuratedIngredients(fetchFn).then(shapeIngredients, (err) => { pending = null; throw err; });
  }
  return pending;
}

/** For tests. */
export function resetShoppingIngredients() { pending = null; }
