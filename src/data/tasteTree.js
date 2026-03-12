/**
 * tasteTree.js — Taste hierarchy tree structure.
 *
 * Primary Taste → Taste Subcategories → Ingredients
 * Each node has intensity score and cuisine associations.
 */

/**
 * Primary taste categories with subcategory keywords.
 * Subcategories match against the node.taste string (which can contain
 * compound descriptions like "sweet, sour" or "pungent, hot").
 */
const TASTE_HIERARCHY = {
  Sweet: {
    keywords: ['sweet'],
    subcategories: {
      'Fruit-Sweet': ['fruit', 'berry', 'apple', 'pear', 'peach', 'mango', 'banana', 'cherry', 'grape', 'melon', 'plum', 'fig', 'date', 'apricot', 'pineapple', 'papaya', 'passion fruit', 'pomegranate', 'cranberry', 'blueberry', 'raspberry', 'strawberry', 'blackberry'],
      'Honey-Sweet': ['honey', 'maple', 'agave', 'molasses'],
      'Caramel-Sweet': ['caramel', 'brown sugar', 'butterscotch', 'toffee'],
      'Floral-Sweet': ['vanilla', 'lavender', 'rose', 'elderflower', 'chamomile'],
      'Other Sweet': [],
    },
  },
  Sour: {
    keywords: ['sour', 'tart', 'acidic'],
    subcategories: {
      'Citrus-Sour': ['lemon', 'lime', 'orange', 'grapefruit', 'yuzu', 'citrus', 'kumquat'],
      'Vinegar-Sour': ['vinegar', 'balsamic'],
      'Fermented-Sour': ['yogurt', 'sour cream', 'buttermilk', 'kimchi', 'sauerkraut', 'pickle'],
      'Other Sour': [],
    },
  },
  Bitter: {
    keywords: ['bitter'],
    subcategories: {
      'Dark Bitter': ['chocolate', 'cocoa', 'coffee', 'espresso'],
      'Green Bitter': ['arugula', 'radicchio', 'endive', 'kale', 'broccoli rabe', 'dandelion'],
      'Herbal Bitter': ['oregano', 'thyme', 'rosemary', 'sage'],
      'Other Bitter': [],
    },
  },
  Salty: {
    keywords: ['salty'],
    subcategories: {
      'Umami-Salty': ['soy sauce', 'miso', 'fish sauce', 'anchovy', 'parmesan', 'mushroom', 'dried tomato'],
      'Brined-Salty': ['olive', 'caper', 'pickle', 'feta'],
      'Mineral-Salty': ['seaweed', 'sea salt'],
      'Other Salty': [],
    },
  },
  Spicy: {
    keywords: ['spicy', 'hot'],
    subcategories: {
      'Chile-Spicy': ['chile', 'cayenne', 'chipotle', 'jalapeño', 'habanero', 'serrano', 'scotch bonnet', 'red pepper'],
      'Pepper-Spicy': ['black pepper', 'white pepper', 'sichuan peppercorn', 'pink peppercorn'],
      'Root-Spicy': ['ginger', 'horseradish', 'wasabi', 'galangal'],
      'Other Spicy': [],
    },
  },
  Pungent: {
    keywords: ['pungent'],
    subcategories: {
      'Allium-Pungent': ['garlic', 'onion', 'shallot', 'leek', 'chive', 'scallion'],
      'Mustard-Pungent': ['mustard', 'horseradish', 'wasabi'],
      'Other Pungent': [],
    },
  },
  Astringent: {
    keywords: ['astringent'],
    subcategories: {
      'Tannin-Astringent': ['tea', 'red wine', 'pomegranate', 'persimmon'],
      'Other Astringent': [],
    },
  },
};

/**
 * Classify an ingredient into taste subcategories.
 * Returns the first matching subcategory, or "Other {Taste}" as fallback.
 */
function classifySubcategory(ingredientName, subcategories) {
  const lower = ingredientName.toLowerCase();
  for (const [subName, keywords] of Object.entries(subcategories)) {
    if (subName.startsWith('Other ')) continue;
    for (const kw of keywords) {
      if (lower.includes(kw) || kw.includes(lower)) {
        return subName;
      }
    }
  }
  // Fallback to "Other" subcategory
  const otherKey = Object.keys(subcategories).find(k => k.startsWith('Other '));
  return otherKey || 'Other';
}

/**
 * Build the taste hierarchy tree from graph nodes.
 *
 * @param {Map<string, Object>} nodes - Graph nodes from buildGraph()
 * @returns {Object[]} Tree structure:
 *   [{ id, name, type:'taste', keywords, children: [
 *     { id, name, type:'subcategory', ingredients: string[], ingredientCount }
 *   ], ingredientCount, cuisineAssociations }]
 */
export function buildTasteTree(nodes) {
  if (!nodes) return [];

  const tree = [];

  for (const [tasteName, config] of Object.entries(TASTE_HIERARCHY)) {
    // Find all ingredients matching this primary taste
    const matchedIngredients = [];
    for (const [name, node] of nodes) {
      if (!node.taste) continue;
      const tasteLower = node.taste.toLowerCase();
      if (config.keywords.some(kw => tasteLower.includes(kw))) {
        matchedIngredients.push(name);
      }
    }

    if (matchedIngredients.length === 0) continue;

    // Group into subcategories
    const subGroups = {};
    for (const subName of Object.keys(config.subcategories)) {
      subGroups[subName] = [];
    }

    for (const name of matchedIngredients) {
      const sub = classifySubcategory(name, config.subcategories);
      if (!subGroups[sub]) subGroups[sub] = [];
      subGroups[sub].push(name);
    }

    // Build subcategory children
    const children = [];
    for (const [subName, ingredients] of Object.entries(subGroups)) {
      if (ingredients.length === 0) continue;
      children.push({
        id: subName.toLowerCase().replace(/\s+/g, '-'),
        name: subName,
        type: 'subcategory',
        ingredients: ingredients.sort(),
        ingredientCount: ingredients.length,
      });
    }

    children.sort((a, b) => b.ingredientCount - a.ingredientCount);

    // Compute cuisine associations for this taste
    const cuisineCounts = {};
    for (const name of matchedIngredients) {
      const node = nodes.get(name);
      if (!node) continue;
      for (const c of (node.cuisines || [])) {
        cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
      }
    }
    const cuisineAssociations = Object.entries(cuisineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cuisine, count]) => ({ cuisine, count }));

    tree.push({
      id: tasteName.toLowerCase(),
      name: tasteName,
      type: 'taste',
      keywords: config.keywords,
      children,
      ingredientCount: matchedIngredients.length,
      cuisineAssociations,
    });
  }

  tree.sort((a, b) => b.ingredientCount - a.ingredientCount);
  return tree;
}

/**
 * Get all ingredients for a taste tree node.
 */
export function getTasteIngredients(treeNode) {
  if (treeNode.type === 'subcategory') {
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

export { TASTE_HIERARCHY };
