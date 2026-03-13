/**
 * sauceData.js — Load and categorize sauce ingredients.
 *
 * Loads sauce_augment.json (curated sauce-specific ingredients + pairings)
 * and provides category membership for each ingredient.
 */

/**
 * Sauce ingredient categories used for positioning and UI grouping.
 */
export const SAUCE_CATEGORIES = {
  Fat: { label: 'Fats & Oils', color: '#f1c40f', codexRole: 'base' },
  Liquid: { label: 'Stocks & Liquids', color: '#3498db', codexRole: 'liquid' },
  Thickener: { label: 'Thickeners', color: '#e67e22', codexRole: 'thickener' },
  Aromatic: { label: 'Aromatics', color: '#2ecc71', codexRole: 'aromatic' },
  Acid: { label: 'Acids', color: '#1abc9c', codexRole: 'acid' },
  Seasoning: { label: 'Seasonings', color: '#9b59b6', codexRole: 'seasoning' },
  Herb: { label: 'Herbs & Spices', color: '#27ae60', codexRole: 'accent' },
  Protein: { label: 'Umami & Protein', color: '#e74c3c', codexRole: 'umami' },
  Chili: { label: 'Chilies & Heat', color: '#c0392b', codexRole: 'heat' },
  Other: { label: 'Other', color: '#95a5a6', codexRole: 'other' },
};

// Ingredients from the Flavor Bible that map to sauce categories
const FLAVOR_BIBLE_CATEGORIES = {
  butter: 'Fat',
  'olive oil': 'Fat',
  lard: 'Fat',
  ghee: 'Fat',
  'sesame oil': 'Fat',
  'coconut oil': 'Fat',
  cream: 'Liquid',
  milk: 'Liquid',
  'coconut milk': 'Liquid',
  wine: 'Liquid',
  'red wine': 'Liquid',
  'white wine': 'Liquid',
  stock: 'Liquid',
  flour: 'Thickener',
  cornstarch: 'Thickener',
  onion: 'Aromatic',
  garlic: 'Aromatic',
  shallot: 'Aromatic',
  ginger: 'Aromatic',
  celery: 'Aromatic',
  carrot: 'Aromatic',
  lemongrass: 'Aromatic',
  lemon: 'Acid',
  lime: 'Acid',
  vinegar: 'Acid',
  tomato: 'Acid',
  tamarind: 'Acid',
  salt: 'Seasoning',
  'black pepper': 'Seasoning',
  cumin: 'Seasoning',
  coriander: 'Seasoning',
  turmeric: 'Seasoning',
  paprika: 'Seasoning',
  nutmeg: 'Seasoning',
  cinnamon: 'Seasoning',
  parsley: 'Herb',
  thyme: 'Herb',
  basil: 'Herb',
  oregano: 'Herb',
  cilantro: 'Herb',
  mint: 'Herb',
  tarragon: 'Herb',
  rosemary: 'Herb',
  'bay leaf': 'Herb',
  sage: 'Herb',
  dill: 'Herb',
  anchovy: 'Protein',
  'fish sauce': 'Protein',
  'soy sauce': 'Protein',
  miso: 'Protein',
  'oyster sauce': 'Protein',
  parmesan: 'Protein',
  'chile pepper': 'Chili',
  'jalapeño': 'Chili',
  habanero: 'Chili',
  chipotle: 'Chili',
  chocolate: 'Other',
  honey: 'Other',
  sugar: 'Other',
  peanut: 'Other',
  sesame: 'Other',
  olive: 'Other',
  capers: 'Other',
  mustard: 'Other',
  mango: 'Other',
  egg: 'Thickener',
};

/**
 * Load the sauce augmentation data from the static JSON file.
 * @param {string} basePath - Base path for data files
 * @returns {Promise<Object>} { ingredients, pairings, sauceIngredientNames }
 */
export async function loadSauceAugment(basePath = '/data') {
  const res = await fetch(`${basePath}/sauce_augment.json`);
  if (!res.ok) return { ingredients: [], pairings: [], sauceIngredientNames: [] };
  return res.json();
}

/**
 * Get the sauce category for an ingredient.
 * Checks augmented data first, then falls back to Flavor Bible category mapping.
 *
 * @param {string} name - Ingredient name (lowercase)
 * @param {Map<string,Object>} augmentedMap - Map of augmented ingredient data (name → {category})
 * @returns {string} Category key from SAUCE_CATEGORIES
 */
export function getSauceCategory(name, augmentedMap) {
  if (augmentedMap && augmentedMap.has(name)) {
    return augmentedMap.get(name).category || 'Other';
  }
  const lower = name.toLowerCase();
  if (FLAVOR_BIBLE_CATEGORIES[lower]) {
    return FLAVOR_BIBLE_CATEGORIES[lower];
  }
  for (const [key, cat] of Object.entries(FLAVOR_BIBLE_CATEGORIES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return cat;
    }
  }
  return 'Other';
}

/**
 * Get the sauce role for an ingredient.
 * @param {string} name - Ingredient name
 * @param {Map<string,Object>} augmentedMap - Augmented ingredient data
 * @returns {string} Codex role
 */
export function getSauceRole(name, augmentedMap) {
  if (augmentedMap && augmentedMap.has(name)) {
    return augmentedMap.get(name).codexRole || 'other';
  }
  const category = getSauceCategory(name, augmentedMap);
  return SAUCE_CATEGORIES[category]?.codexRole || 'other';
}
