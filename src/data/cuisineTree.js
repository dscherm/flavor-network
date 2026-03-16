/**
 * cuisineTree.js — Hierarchical cuisine tree structure.
 *
 * Region → Cuisine → Signature Ingredients
 * Each node has aggregate flavor profile (taste distribution, top pairings).
 */

/**
 * Region → Cuisine mapping based on the 49 cuisines in the dataset.
 * Cuisines are matched by lowercase partial string from node.cuisines[].
 */
const REGION_MAP = {
  European: [
    'french cuisine',
    'italian cuisine',
    'spanish cuisine',
    'greek cuisine',
    'british cuisine',
    'german cuisine',
    'hungarian cuisine',
    'portuguese cuisine',
    'scandinavian cuisine',
    'polish cuisine',
    'russian cuisine',
  ],
  Asian: [
    'chinese cuisine',
    'japanese cuisine',
    'korean cuisine',
    'thai cuisine',
    'vietnamese cuisine',
    'indian cuisine',
    'indonesian cuisine',
    'malaysian cuisine',
    'filipino cuisine',
    'pakistani cuisine',
    'sri lankan cuisine',
  ],
  Americas: [
    'american cuisine',
    'mexican cuisine',
    'brazilian cuisine',
    'argentine cuisine',
    'peruvian cuisine',
    'caribbean cuisine',
    'cajun/creole cuisine',
    'southern us cuisine',
    'tex-mex cuisine',
  ],
  African: [
    'ethiopian cuisine',
    'moroccan cuisine',
    'west african cuisine',
    'south african cuisine',
  ],
  'Middle Eastern': [
    'turkish cuisine',
    'lebanese cuisine',
    'persian cuisine',
    'israeli cuisine',
  ],
  Oceanian: [
    'australian cuisine',
    'pacific islander cuisine',
  ],
};

/**
 * Display-friendly cuisine name (strip " cuisine" suffix, capitalize).
 */
function displayName(cuisine) {
  return cuisine
    .replace(/ cuisines?$/i, '')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Build the cuisine hierarchy tree from graph nodes.
 *
 * @param {Map<string, Object>} nodes - Graph nodes from buildGraph()
 * @returns {Object[]} Tree structure:
 *   [{ id, name, type:'region', children: [
 *     { id, name, type:'cuisine', rawName, ingredients: string[],
 *       tasteProfile: Object, topPairings: string[], ingredientCount: number }
 *   ], ingredientCount, tasteProfile }]
 */
export function buildCuisineTree(nodes) {
  if (!nodes) return [];

  // Build reverse map: cuisine → ingredient names
  const cuisineIngredients = new Map();
  for (const [name, node] of nodes) {
    for (const cuisine of (node.cuisines || [])) {
      const key = cuisine.toLowerCase();
      if (!cuisineIngredients.has(key)) {
        cuisineIngredients.set(key, []);
      }
      cuisineIngredients.get(key).push(name);
    }
  }

  // Build taste profile for a set of ingredient names
  function computeTasteProfile(ingredientNames) {
    const tastes = {};
    let total = 0;
    for (const name of ingredientNames) {
      const node = nodes.get(name);
      if (!node || !node.taste) continue;
      const t = node.taste.toLowerCase();
      tastes[t] = (tastes[t] || 0) + 1;
      total++;
    }
    if (total > 0) {
      for (const t in tastes) {
        tastes[t] = Math.round((tastes[t] / total) * 100) / 100;
      }
    }
    return tastes;
  }

  // Get top pairings for a set of ingredients (most connected within the set)
  function computeTopPairings(ingredientNames) {
    const nameSet = new Set(ingredientNames);
    const pairingCounts = {};
    for (const name of ingredientNames) {
      const node = nodes.get(name);
      if (!node || !node.pairings) continue;
      for (const p of node.pairings) {
        const pName = typeof p === 'string' ? p : p.name || p.target;
        if (pName && nameSet.has(pName)) {
          const key = [name, pName].sort().join('|');
          pairingCounts[key] = (pairingCounts[key] || 0) + 1;
        }
      }
    }
    return Object.entries(pairingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key]) => key.split('|'));
  }

  const tree = [];

  for (const [regionName, cuisineList] of Object.entries(REGION_MAP)) {
    const children = [];
    const allRegionIngredients = [];

    for (const cuisine of cuisineList) {
      const key = cuisine.toLowerCase();
      const ingredients = cuisineIngredients.get(key) || [];
      if (ingredients.length === 0) continue;

      allRegionIngredients.push(...ingredients);

      children.push({
        id: key.replace(/\s+/g, '-'),
        name: displayName(cuisine),
        type: 'cuisine',
        rawName: cuisine,
        ingredients: [...new Set(ingredients)].sort(),
        ingredientCount: new Set(ingredients).size,
        tasteProfile: computeTasteProfile(ingredients),
        topPairings: computeTopPairings(ingredients),
      });
    }

    if (children.length === 0) continue;

    // Sort cuisines by ingredient count descending
    children.sort((a, b) => b.ingredientCount - a.ingredientCount);

    const uniqueRegionIngredients = [...new Set(allRegionIngredients)];

    tree.push({
      id: regionName.toLowerCase().replace(/\s+/g, '-'),
      name: regionName,
      type: 'region',
      children,
      ingredientCount: uniqueRegionIngredients.length,
      tasteProfile: computeTasteProfile(uniqueRegionIngredients),
    });
  }

  // Sort regions by ingredient count descending
  tree.sort((a, b) => b.ingredientCount - a.ingredientCount);

  return tree;
}

/**
 * Get all ingredients for a tree node (region or cuisine).
 * @param {Object} treeNode - A node from the cuisine tree
 * @returns {string[]} Unique ingredient names
 */
export function getTreeIngredients(treeNode) {
  if (treeNode.type === 'cuisine') {
    return treeNode.ingredients;
  }
  // Region: collect from all children
  const all = new Set();
  for (const child of (treeNode.children || [])) {
    for (const ing of (child.ingredients || [])) {
      all.add(ing);
    }
  }
  return [...all].sort();
}

/**
 * Find a tree node by id (region or cuisine).
 * @param {Object[]} tree - The full cuisine tree
 * @param {string} id - Node id to find
 * @returns {Object|null}
 */
export function findTreeNode(tree, id) {
  for (const region of tree) {
    if (region.id === id) return region;
    for (const cuisine of (region.children || [])) {
      if (cuisine.id === id) return cuisine;
    }
  }
  return null;
}

export { REGION_MAP };
