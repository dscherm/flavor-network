/**
 * ingredientFamilyTree.js — Group ingredients into botanical/culinary families.
 *
 * Family → Subfamily → Ingredients
 * Enables family-level analysis of pairing patterns.
 */

/**
 * Ingredient family definitions.
 * Keywords are matched against ingredient names (case-insensitive).
 * Order matters: first match wins.
 */
const FAMILIES = [
  {
    name: 'Alliums',
    keywords: ['garlic', 'onion', 'shallot', 'leek', 'chive', 'scallion', 'ramp', 'spring onion'],
  },
  {
    name: 'Aromatics',
    keywords: ['ginger', 'lemongrass', 'galangal', 'turmeric', 'cardamom', 'cinnamon', 'clove', 'nutmeg', 'star anise', 'allspice', 'bay leaf', 'saffron', 'vanilla', 'curry leaf'],
  },
  {
    name: 'Herbs',
    keywords: ['basil', 'cilantro', 'parsley', 'rosemary', 'thyme', 'mint', 'dill', 'oregano', 'tarragon', 'chervil', 'sage', 'marjoram', 'lavender', 'lemon verbena', 'epazote', 'savory', 'lovage', 'sorrel', 'borage', 'hyssop', 'lemon balm', 'chamomile', 'spearmint'],
  },
  {
    name: 'Nightshades',
    keywords: ['tomato', 'pepper', 'eggplant', 'potato', 'chile', 'bell pepper', 'paprika', 'cayenne', 'chipotle', 'jalapeño', 'habanero', 'tomatillo'],
  },
  {
    name: 'Citrus',
    keywords: ['lemon', 'lime', 'orange', 'grapefruit', 'yuzu', 'kumquat', 'tangerine', 'mandarin', 'bergamot', 'citron', 'pomelo', 'blood orange'],
  },
  {
    name: 'Cruciferous',
    keywords: ['broccoli', 'cauliflower', 'cabbage', 'kale', 'brussels sprout', 'arugula', 'radish', 'turnip', 'watercress', 'mustard green', 'bok choy', 'kohlrabi', 'horseradish'],
  },
  {
    name: 'Legumes',
    keywords: ['bean', 'lentil', 'chickpea', 'pea', 'edamame', 'fava', 'black-eyed pea', 'peanut', 'soybean', 'tofu', 'tempeh'],
  },
  {
    name: 'Nuts & Seeds',
    keywords: ['almond', 'walnut', 'pecan', 'pistachio', 'cashew', 'hazelnut', 'pine nut', 'macadamia', 'chestnut', 'coconut', 'sesame', 'sunflower', 'pumpkin seed', 'poppy seed', 'flax', 'chia'],
  },
  {
    name: 'Stone & Tropical Fruits',
    keywords: ['peach', 'plum', 'cherry', 'apricot', 'nectarine', 'mango', 'papaya', 'passion fruit', 'pineapple', 'banana', 'guava', 'lychee', 'coconut'],
  },
  {
    name: 'Berries & Pome Fruits',
    keywords: ['strawberry', 'raspberry', 'blueberry', 'blackberry', 'cranberry', 'gooseberry', 'currant', 'apple', 'pear', 'quince', 'fig', 'grape', 'pomegranate', 'date', 'raisin', 'prune'],
  },
  {
    name: 'Root Vegetables',
    keywords: ['carrot', 'beet', 'parsnip', 'celery root', 'sweet potato', 'yam', 'ginger', 'jicama', 'rutabaga'],
  },
  {
    name: 'Squash & Gourds',
    keywords: ['squash', 'pumpkin', 'zucchini', 'cucumber', 'melon', 'watermelon'],
  },
  {
    name: 'Mushrooms',
    keywords: ['mushroom', 'truffle', 'shiitake', 'porcini', 'chanterelle', 'morel', 'oyster mushroom', 'portobello', 'cremini', 'enoki', 'maitake'],
  },
  {
    name: 'Dairy',
    keywords: ['butter', 'cream', 'milk', 'cheese', 'yogurt', 'sour cream', 'crème fraîche', 'mascarpone', 'ricotta', 'mozzarella', 'parmesan', 'goat cheese', 'blue cheese', 'feta', 'brie', 'ghee', 'buttermilk'],
  },
  {
    name: 'Proteins — Meat',
    keywords: ['beef', 'pork', 'lamb', 'chicken', 'turkey', 'duck', 'veal', 'venison', 'rabbit', 'bacon', 'ham', 'prosciutto', 'sausage', 'pancetta'],
  },
  {
    name: 'Proteins — Seafood',
    keywords: ['salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'squid', 'octopus', 'anchovy', 'sardine', 'cod', 'halibut', 'sea bass', 'trout', 'swordfish', 'mahi', 'snapper'],
  },
  {
    name: 'Grains & Starches',
    keywords: ['rice', 'wheat', 'corn', 'oat', 'barley', 'quinoa', 'couscous', 'pasta', 'bread', 'flour', 'polenta', 'grits', 'noodle', 'bulgur', 'farro', 'millet', 'buckwheat'],
  },
  {
    name: 'Fats & Oils',
    keywords: ['olive oil', 'sesame oil', 'coconut oil', 'vegetable oil', 'canola', 'grapeseed', 'avocado oil', 'walnut oil', 'peanut oil', 'truffle oil', 'lard'],
  },
  {
    name: 'Vinegars & Acids',
    keywords: ['vinegar', 'balsamic', 'rice vinegar', 'wine vinegar', 'sherry vinegar', 'cider vinegar', 'verjuice', 'tamarind'],
  },
  {
    name: 'Sweeteners',
    keywords: ['sugar', 'honey', 'maple', 'molasses', 'agave', 'caramel', 'brown sugar', 'corn syrup', 'stevia'],
  },
  {
    name: 'Fermented & Umami',
    keywords: ['soy sauce', 'miso', 'fish sauce', 'worcestershire', 'kimchi', 'sauerkraut', 'kombucha', 'tempeh', 'natto'],
  },
  {
    name: 'Spice Blends & Condiments',
    keywords: ['curry', 'garam masala', 'five-spice', 'za\'atar', 'ras el hanout', 'berbere', 'jerk', 'harissa', 'sriracha', 'hot sauce', 'ketchup', 'mayonnaise', 'mustard'],
  },
];

/**
 * Build the ingredient family tree from graph nodes.
 *
 * @param {Map<string, Object>} nodes - Graph nodes from buildGraph()
 * @returns {Object[]} Tree structure:
 *   [{ id, name, type:'family', ingredients: string[], ingredientCount,
 *      avgPairings: number, dominantTaste: string }]
 */
export function buildIngredientFamilyTree(nodes) {
  if (!nodes) return [];

  const assigned = new Set();
  const tree = [];

  for (const family of FAMILIES) {
    const matched = [];

    for (const [name] of nodes) {
      if (assigned.has(name)) continue;
      const lower = name.toLowerCase();
      if (family.keywords.some(kw => lower.includes(kw) || kw.includes(lower))) {
        matched.push(name);
        assigned.add(name);
      }
    }

    if (matched.length === 0) continue;

    // Compute average pairings
    let totalPairings = 0;
    const tasteCounts = {};
    for (const name of matched) {
      const node = nodes.get(name);
      if (node) {
        totalPairings += (node.pairings || []).length;
        if (node.taste) {
          const t = node.taste.toLowerCase().split(/[,/]/).map(s => s.trim())[0];
          if (t) tasteCounts[t] = (tasteCounts[t] || 0) + 1;
        }
      }
    }

    const dominantTaste = Object.entries(tasteCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    tree.push({
      id: family.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: family.name,
      type: 'family',
      ingredients: matched.sort(),
      ingredientCount: matched.length,
      avgPairings: matched.length > 0 ? Math.round(totalPairings / matched.length) : 0,
      dominantTaste,
    });
  }

  // Collect unassigned ingredients into "Other"
  const unassigned = [];
  for (const [name] of nodes) {
    if (!assigned.has(name)) {
      unassigned.push(name);
    }
  }
  if (unassigned.length > 0) {
    tree.push({
      id: 'other',
      name: 'Other',
      type: 'family',
      ingredients: unassigned.sort(),
      ingredientCount: unassigned.length,
      avgPairings: 0,
      dominantTaste: '',
    });
  }

  tree.sort((a, b) => b.ingredientCount - a.ingredientCount);
  return tree;
}

/**
 * Find which family an ingredient belongs to.
 * @param {Object[]} tree - The family tree
 * @param {string} ingredientName - Name to find
 * @returns {Object|null} The family node, or null
 */
export function findIngredientFamily(tree, ingredientName) {
  const lower = ingredientName.toLowerCase();
  for (const family of tree) {
    if (family.ingredients.some(i => i.toLowerCase() === lower)) {
      return family;
    }
  }
  return null;
}

export { FAMILIES };
