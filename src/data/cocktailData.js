/**
 * cocktailData.js — Load and categorize cocktail ingredients.
 *
 * Loads cocktail_augment.json (curated cocktail-specific ingredients + pairings)
 * and provides category membership for each ingredient.
 */

/**
 * Modifier words that precede a base spirit/ingredient — stripped to find the node.
 * e.g. "light rum" → "rum", "spiced rum" → "rum"
 */
export const INGREDIENT_MODIFIERS = /^(light|dark|aged|gold|golden|white|black|silver|amber|blended|spiced|añejo|reposado|blanco|overproof|navy|jamaican|demerara|london dry|dry|sweet|fresh|frozen|powdered|superfine|granulated|crushed|whole|ground|extra|heavy|double|old|young|single|small|large)\s+/i;

/**
 * Cocktail ingredient categories used for Codex positioning and UI grouping.
 */
export const COCKTAIL_CATEGORIES = {
  Spirit: { label: 'Spirits', color: '#e74c3c', codexRole: 'base' },
  Liqueur: { label: 'Liqueurs', color: '#9b59b6', codexRole: 'modifier' },
  Vermouth: { label: 'Vermouth & Wine', color: '#8e44ad', codexRole: 'modifier' },
  Bitters: { label: 'Bitters', color: '#e67e22', codexRole: 'seasoning' },
  Sweetener: { label: 'Sweeteners', color: '#f1c40f', codexRole: 'sweetener' },
  Lengthener: { label: 'Lengtheners', color: '#3498db', codexRole: 'lengthener' },
  'Dairy/Egg': { label: 'Dairy & Egg', color: '#ecf0f1', codexRole: 'texture' },
  Citrus: { label: 'Citrus', color: '#2ecc71', codexRole: 'sour' },
  Herb: { label: 'Herbs & Aromatics', color: '#27ae60', codexRole: 'accent' },
  Fruit: { label: 'Fruits', color: '#e91e63', codexRole: 'accent' },
  Other: { label: 'Other', color: '#95a5a6', codexRole: 'accent' },
};

// Ingredients from the Flavor Bible that map to cocktail categories
const FLAVOR_BIBLE_CATEGORIES = {
  vodka: 'Spirit',
  gin: 'Spirit',
  rum: 'Spirit',
  tequila: 'Spirit',
  whiskey: 'Spirit',
  bourbon: 'Spirit',
  brandy: 'Spirit',
  cognac: 'Spirit',
  sake: 'Spirit',
  champagne: 'Lengthener',
  'amaretto': 'Liqueur',
  lemon: 'Citrus',
  lime: 'Citrus',
  orange: 'Citrus',
  grapefruit: 'Citrus',
  yuzu: 'Citrus',
  sugar: 'Sweetener',
  honey: 'Sweetener',
  'maple syrup': 'Sweetener',
  agave: 'Sweetener',
  mint: 'Herb',
  basil: 'Herb',
  rosemary: 'Herb',
  thyme: 'Herb',
  lavender: 'Herb',
  ginger: 'Herb',
  cinnamon: 'Herb',
  vanilla: 'Herb',
  nutmeg: 'Herb',
  clove: 'Herb',
  'star anise': 'Herb',
  coffee: 'Other',
  chocolate: 'Other',
  tea: 'Other',
  olive: 'Other',
  cherry: 'Fruit',
  cucumber: 'Other',
  pineapple: 'Fruit',
  coconut: 'Fruit',
  'jalapeño': 'Other',
  'chile pepper': 'Other',
  'black pepper': 'Other',
  salt: 'Other',
  cranberry: 'Fruit',
  strawberry: 'Fruit',
  raspberry: 'Fruit',
  blackberry: 'Fruit',
  pomegranate: 'Fruit',
  watermelon: 'Fruit',
  peach: 'Fruit',
  mango: 'Fruit',
  'passion fruit': 'Fruit',
  banana: 'Fruit',
};

/**
 * Load the cocktail augmentation data from the static JSON file.
 * @param {string} basePath - Base path for data files
 * @returns {Promise<Object>} { ingredients, pairings, cocktailIngredientNames }
 */
export async function loadCocktailAugment(basePath = '/data') {
  const res = await fetch(`${basePath}/cocktail_augment.json`);
  if (!res.ok) return { ingredients: [], pairings: [], cocktailIngredientNames: [] };
  return res.json();
}

/**
 * Get the cocktail category for an ingredient.
 * Checks augmented data first, then falls back to Flavor Bible category mapping.
 *
 * @param {string} name - Ingredient name (lowercase)
 * @param {Map<string,Object>} augmentedMap - Map of augmented ingredient data (name → {category})
 * @returns {string} Category key from COCKTAIL_CATEGORIES
 */
export function getCocktailCategory(name, augmentedMap) {
  // Check augmented data first
  if (augmentedMap && augmentedMap.has(name)) {
    return augmentedMap.get(name).category || 'Other';
  }
  // Check Flavor Bible mapping
  const lower = name.toLowerCase();
  if (FLAVOR_BIBLE_CATEGORIES[lower]) {
    return FLAVOR_BIBLE_CATEGORIES[lower];
  }
  // Fuzzy match by checking if the name contains a known key
  for (const [key, cat] of Object.entries(FLAVOR_BIBLE_CATEGORIES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return cat;
    }
  }
  return 'Other';
}

/**
 * Get the Codex role for an ingredient.
 * @param {string} name - Ingredient name
 * @param {Map<string,Object>} augmentedMap - Augmented ingredient data
 * @returns {string} Codex role (base, modifier, sweetener, sour, seasoning, lengthener, texture, accent)
 */
export function getCodexRole(name, augmentedMap) {
  if (augmentedMap && augmentedMap.has(name)) {
    return augmentedMap.get(name).codexRole || 'accent';
  }
  const category = getCocktailCategory(name, augmentedMap);
  return COCKTAIL_CATEGORIES[category]?.codexRole || 'accent';
}
