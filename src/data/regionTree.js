/**
 * regionTree.js — Region hierarchy tree.
 *
 * Continent → Region → Ingredients
 * Groups the 17 culinary regions into broader continental groupings.
 */

const REGION_HIERARCHY = {
  Europe: {
    regions: ['Mediterranean', 'Western Europe', 'Northern Europe', 'Eastern Europe'],
  },
  Asia: {
    regions: ['East Asia', 'South Asia', 'Southeast Asia', 'Central Asia'],
  },
  'Middle East & Africa': {
    regions: ['Middle East', 'North Africa', 'Sub-Saharan Africa'],
  },
  Americas: {
    regions: ['North America', 'Central America', 'South America', 'Caribbean'],
  },
  Oceania: {
    regions: ['Oceania'],
  },
};

/**
 * Build the region hierarchy tree from graph nodes.
 *
 * @param {Map<string, Object>} nodes - Graph nodes with regions[] arrays
 * @returns {Object[]} Tree structure:
 *   [{ id, name, type:'continent', children: [
 *     { id, name, type:'region', ingredients, ingredientCount, tasteProfile }
 *   ], ingredientCount }]
 */
export function buildRegionTree(nodes) {
  if (!nodes) return [];

  // Index ingredients by region
  const regionIngredients = {};
  for (const [name, node] of nodes) {
    const regions = node.regions || [];
    for (const region of regions) {
      if (!regionIngredients[region]) regionIngredients[region] = [];
      regionIngredients[region].push(name);
    }
  }

  const tree = [];

  for (const [continentName, config] of Object.entries(REGION_HIERARCHY)) {
    const children = [];
    let totalCount = 0;

    for (const regionName of config.regions) {
      const ingredients = regionIngredients[regionName] || [];
      if (ingredients.length === 0) continue;

      // Compute taste profile for this region
      const tasteCounts = {};
      let tasteTotal = 0;
      for (const name of ingredients) {
        const node = nodes.get(name);
        if (!node?.taste) continue;
        const tastes = node.taste.toLowerCase().split(/[\s,]+/);
        for (const t of tastes) {
          if (t) {
            tasteCounts[t] = (tasteCounts[t] || 0) + 1;
            tasteTotal++;
          }
        }
      }
      const tasteProfile = {};
      for (const [taste, count] of Object.entries(tasteCounts)) {
        tasteProfile[taste] = tasteTotal > 0 ? count / tasteTotal : 0;
      }

      children.push({
        id: regionName.toLowerCase().replace(/\s+/g, '-'),
        name: regionName,
        type: 'region',
        ingredients: ingredients.sort(),
        ingredientCount: ingredients.length,
        tasteProfile,
      });

      totalCount += ingredients.length;
    }

    if (children.length === 0) continue;
    children.sort((a, b) => b.ingredientCount - a.ingredientCount);

    tree.push({
      id: continentName.toLowerCase().replace(/\s+/g, '-'),
      name: continentName,
      type: 'continent',
      children,
      ingredientCount: totalCount,
    });
  }

  // Add "Global" for ingredients tagged as Global
  const globalIngs = regionIngredients['Global'] || [];
  if (globalIngs.length > 0) {
    tree.push({
      id: 'global',
      name: 'Global',
      type: 'continent',
      children: [{
        id: 'universal',
        name: 'Universal',
        type: 'region',
        ingredients: globalIngs.sort(),
        ingredientCount: globalIngs.length,
      }],
      ingredientCount: globalIngs.length,
    });
  }

  tree.sort((a, b) => b.ingredientCount - a.ingredientCount);
  return tree;
}

/**
 * Get all ingredients for a region tree node.
 */
export function getRegionIngredients(treeNode) {
  if (treeNode.type === 'region') {
    return treeNode.ingredients;
  }
  const all = new Set();
  for (const child of (treeNode.children || [])) {
    for (const ing of (child.ingredients || [])) {
      all.add(ing);
    }
  }
  return [...all].sort();
}

export { REGION_HIERARCHY };
