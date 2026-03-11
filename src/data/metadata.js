/**
 * Metadata accessors — convenience functions for ingredient properties.
 * Works with the data structures returned by loader.js and graph.js.
 */

/**
 * Get the taste profile for an ingredient (e.g. "sweet", "sour", "bitter").
 */
export function getTaste(nodes, name) {
  return nodes.get(name)?.taste || null;
}

/**
 * Get the weight for an ingredient (e.g. "light", "medium", "heavy").
 */
export function getWeight(nodes, name) {
  return nodes.get(name)?.weight || null;
}

/**
 * Get the volume for an ingredient (e.g. "quiet", "moderate", "loud").
 */
export function getVolume(nodes, name) {
  return nodes.get(name)?.volume || null;
}

/**
 * Get the season for an ingredient (e.g. "autumn–winter", "spring–summer").
 */
export function getSeason(nodes, name) {
  return nodes.get(name)?.season || null;
}

/**
 * Get tips for an ingredient.
 */
export function getTips(nodes, name) {
  return nodes.get(name)?.tips || [];
}

/**
 * Get all cuisines an ingredient belongs to.
 */
export function getCuisines(nodes, name) {
  return nodes.get(name)?.cuisines || [];
}

/**
 * Get flavor affinities (combos) for an ingredient.
 */
export function getAffinities(nodes, name) {
  return nodes.get(name)?.affinities || [];
}

/**
 * Get full metadata object for an ingredient.
 */
export function getIngredientData(nodes, name) {
  return nodes.get(name) || null;
}

/**
 * Filter ingredients by taste.
 */
export function filterByTaste(nodes, taste) {
  const result = [];
  for (const [name, node] of nodes) {
    if (node.taste && node.taste.toLowerCase().includes(taste.toLowerCase())) {
      result.push(node);
    }
  }
  return result;
}

/**
 * Filter ingredients by cuisine.
 */
export function filterByCuisine(nodes, cuisine) {
  const result = [];
  for (const [name, node] of nodes) {
    if (node.cuisines.some(c => c.includes(cuisine.toLowerCase()))) {
      result.push(node);
    }
  }
  return result;
}

/**
 * Filter ingredients by season.
 */
export function filterBySeason(nodes, season) {
  const result = [];
  for (const [name, node] of nodes) {
    if (node.season && node.season.toLowerCase().includes(season.toLowerCase())) {
      result.push(node);
    }
  }
  return result;
}

/**
 * Get unique list of all cuisines in the dataset.
 */
export function getAllCuisines(nodes) {
  const cuisines = new Set();
  for (const [, node] of nodes) {
    for (const c of node.cuisines) {
      cuisines.add(c);
    }
  }
  return [...cuisines].sort();
}

/**
 * Get unique list of all taste values in the dataset.
 */
export function getAllTastes(nodes) {
  const tastes = new Set();
  for (const [, node] of nodes) {
    if (node.taste) tastes.add(node.taste);
  }
  return [...tastes].sort();
}
