/**
 * labScope.js — shared cocktail / sauce ingredient-scope predicates.
 *
 * CocktailLab and SauceLab already filter the full proDataset to
 * scope-appropriate ingredients via cocktailGraph.js / sauceGraph.js. This
 * file exposes the same scope as standalone predicates so other surfaces
 * (Recipe Lab's cocktail + sauce modes) can filter search/autocomplete
 * without building the whole subgraph.
 *
 * Returns lowercase-name Sets. Cached after first load.
 */

let cocktailScopePromise = null;
let sauceScopePromise = null;

async function loadScope(path, key) {
  const res = await fetch(path);
  if (!res.ok) return new Set();
  const json = await res.json();
  const names = (json[key] || []).map((n) => n.toLowerCase());
  return new Set(names);
}

export function getCocktailScope() {
  if (!cocktailScopePromise) {
    cocktailScopePromise = loadScope('/data/cocktail_augment.json', 'cocktailIngredientNames');
  }
  return cocktailScopePromise;
}

export function getSauceScope() {
  if (!sauceScopePromise) {
    sauceScopePromise = loadScope('/data/sauce_augment.json', 'sauceIngredientNames');
  }
  return sauceScopePromise;
}

export function isCocktailIngredient(name, scope) {
  return scope instanceof Set && scope.has(String(name).toLowerCase());
}

export function isSauceIngredient(name, scope) {
  return scope instanceof Set && scope.has(String(name).toLowerCase());
}
