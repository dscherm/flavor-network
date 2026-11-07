/**
 * recipeMains.js — which ingredients of a recipe are its MAINS and which
 * are SUPPORTING (WEAK-3).
 *
 * A Cookbook recipe is "you can make" when the kitchen covers every main;
 * missing supporting items are shown as "even better with: thyme, parsley".
 * A cook makes chana masala without the cilantro garnish; nobody makes it
 * without the chickpeas.
 *
 * Mains are the food a dish is made of: protein, vegetable, grain, dairy,
 * fruit, legumes, bread and pastry, stock. Supporting items change the
 * flavour, not what the dish is: spices, herbs, condiments, sweeteners,
 * acids and citrus, chilies, fats, umami seasonings, wine, nuts used as a
 * garnish. The category comes from the ingredient graph
 * (public/proDataset/ingredients.json `category`, carried on graph nodes);
 * a name-based guess (ingredientRoles.getGeneralRole) fills in when no
 * category is known.
 *
 * Decided here, in order (first match wins):
 *   1. A per-recipe list of flavourings that ARE the dish (basil in pesto,
 *      curry paste in a Thai curry, red wine in coq au vin).
 *   2. An ingredient the recipe's name names is main ("Garlic Naan",
 *      "Butter Chicken", "Saffron Risotto", "French Onion Soup").
 *   3. A short per-ingredient override list (onion is main; parmesan is a
 *      cheese; panko is a coating).
 *   4. In a bake or dessert, the structure is main: sugar, butter, yeast,
 *      gelatin, nuts, chocolate.
 *   5. The category default.
 *
 * Garlic and onion are both aromatics. Onion counts as MAIN: it goes in by
 * the cupful as the body of a curry, ragù, soup or stew, and leaving it out
 * changes the dish, not just its seasoning (and shallot, leek or scallion
 * can stand in through the swap table). Garlic counts as SUPPORTING: it
 * goes in by the clove, it seasons rather than bulks, and a cook who is
 * out of garlic still makes the dish. When garlic IS the dish the name
 * says so (Garlic Naan, Garlic Bok Choy) and rule 2 makes it main.
 */
import { getGeneralRole } from './ingredientRoles.js';

/** Ingredient-graph categories that are the food of a dish. */
export const MAIN_CATEGORIES = new Set([
  'protein', 'vegetable', 'grain', 'dairy', 'fruit', 'baked', 'confection', 'liquid',
]);

/**
 * Categories that support (season, sharpen, sweeten, garnish). Listed for
 * documentation and tests; anything not in MAIN_CATEGORIES is supporting.
 */
export const SUPPORTING_CATEGORIES = new Set([
  'spice', 'herb', 'seasoning', 'condiment', 'sweetener', 'acid', 'citrus', 'chili',
  'aromatic', 'umami', 'fat', 'nut', 'thickener', 'other', 'spirit', 'liqueur', 'mixer', 'bitters',
]);

// In a bake or a dessert these give the dish its structure, so they are mains.
const BAKE_MAIN_CATEGORIES = new Set(['sweetener', 'fat', 'nut', 'confection', 'thickener', 'other']);

/** Per-ingredient overrides of the category default. */
export const INGREDIENT_CLASS = {
  // Onions are the body of a dish (see the header).
  onion: 'main', 'purple onion': 'main', 'red onion': 'main', 'white onion': 'main',
  'yellow onion': 'main', 'sweet onion': 'main', 'pearl onion': 'main',
  // Hard cheeses the graph files under "umami": in carbonara or lasagna they are cheese.
  parmesan: 'main', pecorino: 'main', 'parmigiano reggiano': 'main', 'pecorino romano': 'main',
  // Coatings and toppings filed under grain / baked.
  panko: 'supporting', breadcrumb: 'supporting', breadcrumbs: 'supporting',
  'bread crumbs': 'supporting', crouton: 'supporting', 'garlic crouton': 'supporting',
};

// Cooking wine, sake, mirin, spirits: a splash that flavours (category liquid
// for some). Main only where a recipe says so (coq au vin).
const WINE = /\b(wine|sake|mirin|sherry|vermouth|beer|brandy|cognac|madeira|marsala|shaoxing)\b/;

/**
 * Flavourings that ARE the dish, by Cookbook recipe id. Kept short: each
 * line is a dish a cook would not call by its name without that item.
 */
export const RECIPE_MAINS = {
  'margherita-pizza': ['basil'],
  'pesto-genovese': ['basil', 'pine nut'],
  'caprese-salad': ['basil'],
  tabbouleh: ['parsley', 'mint'],
  hummus: ['tahini'],
  'mole-poblano': ['ancho chili'],
  'thai-green-curry': ['curry paste'],
  laksa: ['curry paste'],
  'mapo-tofu': ['doubanjiang'],
  'pozole-rojo': ['guajillo chili'],
  'chiles-rellenos': ['poblano pepper'],
  shakshuka: ['red pepper'],
  'tom-yum': ['lemongrass', 'galangal'],
  pho: ['star anise'],
  'sushi-roll': ['nori'],
  'miso-soup': ['dashi'],
  'teriyaki-salmon': ['soy sauce', 'mirin'],
  'beef-bulgogi': ['soy sauce'],
  'kung-pao-chicken': ['peanut', 'chili'],
  'chana-masala': ['garam masala'],
  'chicken-satay': ['peanut butter'],
  'bbq-ribs': ['barbecue sauce'],
  elote: ['mayonnaise'],
  'coq-au-vin': ['red wine'],
  'beef-bourguignon': ['red wine'],
};

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does the recipe's name name this ingredient? ("Garlic Naan" → garlic). */
export function nameNames(recipeName, ingredient) {
  const title = norm(recipeName);
  const ing = norm(ingredient);
  if (!title || !ing) return false;
  return new RegExp(`(^|[^a-z])${escape(ing)}(e?s)?([^a-z]|$)`).test(title);
}

function isBake(recipe) {
  if (!recipe) return false;
  if (String(recipe.cluster || '').toLowerCase() === 'baking') return true;
  return /\b(cake|cookies?|brownies?|pudding|mousse|panna cotta|tiramisu|churros|baklava|pancakes?|crumble|tart|pie|bread|brul[eé]e)\b/
    .test(norm(recipe.name));
}

// Name-based guess when the graph has no category for an ingredient.
const GENERAL_ROLE_MAIN = new Set(['protein', 'vegetable', 'fruit', 'dairy', 'starch']);

/**
 * Main or supporting, for one ingredient of one recipe.
 * @param {string} name
 * @param {{ recipe?: {id?: string, name?: string, cluster?: string}|null, category?: string|null }} ctx
 * @returns {'main'|'supporting'}
 */
export function ingredientClass(name, { recipe = null, category = null } = {}) {
  const n = norm(name);
  if (!n) return 'supporting';
  if (recipe?.id && (RECIPE_MAINS[recipe.id] || []).includes(n)) return 'main';
  if (recipe?.name && nameNames(recipe.name, n)) return 'main';
  if (INGREDIENT_CLASS[n]) return INGREDIENT_CLASS[n];
  if (WINE.test(n)) return 'supporting';
  const cat = category ? String(category).toLowerCase() : null;
  if (cat) {
    if (isBake(recipe) && BAKE_MAIN_CATEGORIES.has(cat)) return 'main';
    return MAIN_CATEGORIES.has(cat) ? 'main' : 'supporting';
  }
  const role = getGeneralRole(n, null);
  if (isBake(recipe) && (role === 'sweetener' || role === 'fat' || role === 'thickener')) return 'main';
  // Lemon is "fruit" to the name guesser; citrus seasons a dish.
  if (/\b(lemon|lime|yuzu)\b/.test(n)) return 'supporting';
  return GENERAL_ROLE_MAIN.has(role) ? 'main' : 'supporting';
}

/** True when the ingredient is a main of the recipe. */
export function isMainIngredient(name, ctx) {
  return ingredientClass(name, ctx) === 'main';
}

/**
 * A category lookup over graph nodes (Map or plain object of name → node
 * with `category`). Returns a function name → category | null.
 */
export function categoryLookup(nodes) {
  if (!nodes) return () => null;
  const get = nodes instanceof Map ? (k) => nodes.get(k) : (k) => nodes[k];
  return (name) => {
    const n = String(name || '').toLowerCase().trim();
    return get(n)?.category || null;
  };
}

/**
 * `mainOf` for one recipe: name → is it a main? Resolves the name to a
 * graph name first when `resolve` is given (so "cold butter" reads as butter).
 */
export function mainsOf(recipe, { categoryOf = () => null, resolve = null } = {}) {
  return (name) => {
    const cat = categoryOf(name) || (resolve ? categoryOf(resolve(name) || '') : null);
    return isMainIngredient(name, { recipe, category: cat });
  };
}

/** Split a recipe's ingredient names into mains and supporting. */
export function splitRecipe(recipe, opts = {}) {
  const isMain = mainsOf(recipe, opts);
  const main = [];
  const supporting = [];
  for (const raw of recipe?.ingredients || []) {
    const name = typeof raw === 'string' ? raw : raw?.name;
    if (!name) continue;
    (isMain(name) ? main : supporting).push(name);
  }
  return { main, supporting };
}
