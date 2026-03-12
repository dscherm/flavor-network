/**
 * seasonTree.js — Season hierarchy tree.
 *
 * Season → Sub-season → Peak Ingredients
 * Cross-references with cuisine data to show seasonal cuisine variations.
 */

const SEASON_HIERARCHY = {
  Spring: {
    keywords: ['spring'],
    subseasons: ['Early Spring', 'Late Spring'],
    earlyKeywords: ['early spring'],
    lateKeywords: ['late spring', 'spring-summer', 'spring–summer'],
  },
  Summer: {
    keywords: ['summer'],
    subseasons: ['Early Summer', 'Late Summer'],
    earlyKeywords: ['early summer', 'spring-summer', 'spring–summer'],
    lateKeywords: ['late summer', 'summer-autumn', 'summer–autumn', 'summer-fall', 'summer–fall'],
  },
  Autumn: {
    keywords: ['autumn', 'fall'],
    subseasons: ['Early Autumn', 'Late Autumn'],
    earlyKeywords: ['early autumn', 'early fall', 'summer-autumn', 'summer–autumn', 'summer-fall', 'summer–fall'],
    lateKeywords: ['late autumn', 'late fall', 'autumn-winter', 'autumn–winter', 'fall-winter', 'fall–winter'],
  },
  Winter: {
    keywords: ['winter'],
    subseasons: ['Early Winter', 'Late Winter'],
    earlyKeywords: ['early winter', 'autumn-winter', 'autumn–winter', 'fall-winter', 'fall–winter'],
    lateKeywords: ['late winter', 'winter-spring', 'winter–spring'],
  },
};

/**
 * Check if an ingredient's season string matches a season.
 */
function matchesSeason(seasonStr, keywords) {
  if (!seasonStr) return false;
  const lower = seasonStr.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

/**
 * Classify an ingredient into a sub-season within a main season.
 * Returns 'early', 'late', or 'general'.
 */
function classifySubseason(seasonStr, config) {
  if (!seasonStr) return 'general';
  const lower = seasonStr.toLowerCase();
  const isEarly = config.earlyKeywords.some(kw => lower.includes(kw));
  const isLate = config.lateKeywords.some(kw => lower.includes(kw));
  if (isEarly && !isLate) return 'early';
  if (isLate && !isEarly) return 'late';
  return 'general';
}

/**
 * Build the season hierarchy tree from graph nodes.
 *
 * @param {Map<string, Object>} nodes - Graph nodes from buildGraph()
 * @returns {Object[]} Tree structure:
 *   [{ id, name, type:'season', children: [
 *     { id, name, type:'subseason', ingredients, ingredientCount }
 *   ], ingredientCount, cuisineVariations }]
 */
export function buildSeasonTree(nodes) {
  if (!nodes) return [];

  const tree = [];

  for (const [seasonName, config] of Object.entries(SEASON_HIERARCHY)) {
    const earlyIngs = [];
    const lateIngs = [];
    const generalIngs = [];

    for (const [name, node] of nodes) {
      if (!node.season) continue;
      if (!matchesSeason(node.season, config.keywords)) continue;

      const sub = classifySubseason(node.season, config);
      if (sub === 'early') earlyIngs.push(name);
      else if (sub === 'late') lateIngs.push(name);
      else generalIngs.push(name);
    }

    const allIngs = [...new Set([...earlyIngs, ...lateIngs, ...generalIngs])];
    if (allIngs.length === 0) continue;

    const children = [];

    if (earlyIngs.length > 0) {
      children.push({
        id: `early-${seasonName.toLowerCase()}`,
        name: config.subseasons[0],
        type: 'subseason',
        ingredients: earlyIngs.sort(),
        ingredientCount: earlyIngs.length,
      });
    }

    // General (not specifically early or late) goes under the main season
    if (generalIngs.length > 0) {
      children.push({
        id: `peak-${seasonName.toLowerCase()}`,
        name: `Peak ${seasonName}`,
        type: 'subseason',
        ingredients: generalIngs.sort(),
        ingredientCount: generalIngs.length,
      });
    }

    if (lateIngs.length > 0) {
      children.push({
        id: `late-${seasonName.toLowerCase()}`,
        name: config.subseasons[1],
        type: 'subseason',
        ingredients: lateIngs.sort(),
        ingredientCount: lateIngs.length,
      });
    }

    // Compute cuisine variations for this season
    const cuisineCounts = {};
    for (const name of allIngs) {
      const node = nodes.get(name);
      if (!node) continue;
      for (const c of (node.cuisines || [])) {
        cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
      }
    }
    const cuisineVariations = Object.entries(cuisineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cuisine, count]) => ({ cuisine, count }));

    tree.push({
      id: seasonName.toLowerCase(),
      name: seasonName,
      type: 'season',
      children,
      ingredientCount: allIngs.length,
      cuisineVariations,
    });
  }

  // Add "Year-Round" for ingredients with no season or "year-round"
  const yearRound = [];
  for (const [name, node] of nodes) {
    if (!node.season || node.season.toLowerCase().includes('year')) {
      yearRound.push(name);
    }
  }
  if (yearRound.length > 0) {
    tree.push({
      id: 'year-round',
      name: 'Year-Round',
      type: 'season',
      children: [{
        id: 'always-available',
        name: 'Always Available',
        type: 'subseason',
        ingredients: yearRound.sort(),
        ingredientCount: yearRound.length,
      }],
      ingredientCount: yearRound.length,
      cuisineVariations: [],
    });
  }

  return tree;
}

/**
 * Get all ingredients for a season tree node.
 */
export function getSeasonIngredients(treeNode) {
  if (treeNode.type === 'subseason') {
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

export { SEASON_HIERARCHY };
