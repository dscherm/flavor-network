/**
 * dietaryFilters — predicate helpers for the Guided Discovery dietary
 * restrictions bubble (Track 3 iter 2026-05-16). Each predicate takes
 * an ingredient name + the canonical ingredient node (from
 * public/proDataset/ingredients.json) and returns `true` if the
 * ingredient is allowed under that restriction.
 *
 * The dataset doesn't carry sub-category labels (everything is just
 * "protein", "dairy", "grain", "sweetener", "spirit", …), so the
 * predicates lean on a curated keyword list per restriction. The
 * lists are intentionally conservative — false-negatives (rejecting
 * a borderline ingredient) are safer than false-positives, since a
 * dietary filter is a trust surface.
 *
 * Kosher + halal are intentionally simplified to ingredient-level
 * exclusions only — full kashrut / halal rules involve recipe-level
 * concerns (meat + dairy separation, sequence of preparation,
 * sourcing-of-supply) that this layer cannot enforce. We surface them
 * as "approximate" filters covering the unambiguous ingredient bans.
 */

// ────────── Restriction keys ──────────
export const DIETARY_RESTRICTIONS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'pescatarian',
  'kosher',
  'halal',
];

// ────────── Curated keyword lists ──────────

// Any name containing one of these substrings is considered a meat or
// poultry ingredient (used by vegetarian, vegan, kosher, halal).
const MEAT_KEYWORDS = [
  'beef', 'steak', 'sirloin', 'chuck', 'brisket', 'rump', 'ribeye',
  'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'sausage',
  'pepperoni', 'salami', 'chorizo', 'mortadella',
  'chicken', 'poultry', 'turkey', 'duck', 'goose', 'quail', 'pheasant',
  'lamb', 'mutton', 'veal', 'rabbit', 'venison', 'bison', 'goat',
  'liver', 'kidney', 'tripe', 'gizzard', 'sweetbread', 'oxtail',
  'meat', 'meatball', 'ground beef', 'minced beef', 'pastrami',
  'frankfurter', 'hot dog', 'bratwurst', 'wiener',
];

// Fish + seafood (used by vegetarian / vegan; pescatarian KEEPS these).
const SEAFOOD_KEYWORDS = [
  'fish', 'tuna', 'salmon', 'cod', 'haddock', 'trout', 'tilapia',
  'bass', 'snapper', 'flounder', 'halibut', 'mackerel', 'sardine',
  'anchovy', 'herring', 'pollock',
  'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'crawfish',
  'oyster', 'clam', 'mussel', 'scallop', 'octopus', 'squid', 'calamari',
  'eel', 'caviar', 'roe',
];

// Dairy products (used by vegan + dairy-free).
const DAIRY_KEYWORDS = [
  'milk', 'cream', 'butter', 'cheese', 'yogurt', 'yoghurt',
  'whey', 'casein', 'ghee', 'buttermilk', 'curd', 'kefir',
  'sour cream', 'condensed milk', 'evaporated milk',
  // Cheese varieties surfaced by name only (no umbrella "cheese" token):
  'mozzarella', 'parmesan', 'parmigiano', 'cheddar', 'gouda', 'brie',
  'feta', 'ricotta', 'mascarpone', 'gruyere', 'provolone', 'manchego',
  'paneer', 'halloumi', 'pecorino', 'romano', 'asiago',
];

// Egg-derived (used by vegan; vegetarian KEEPS eggs).
const EGG_KEYWORDS = ['egg', 'mayonnaise', 'mayo', 'aioli', 'meringue'];

// Honey + bee products (vegan).
const HONEY_KEYWORDS = ['honey', 'bee pollen', 'royal jelly'];

// Gluten-bearing grains (gluten-free filter).
const GLUTEN_KEYWORDS = [
  'wheat', 'flour', 'bread', 'pasta', 'noodle', 'couscous', 'bulgur',
  'farina', 'semolina', 'spelt', 'barley', 'rye', 'malt', 'cracker',
  'tortilla', 'pita', 'bagel', 'biscuit', 'pretzel', 'crouton',
  'beer', 'ale', 'lager', 'stout', 'porter',
  'soy sauce', // most soy sauce contains wheat
  'seitan', 'durum',
];

// Tree-nuts + peanuts (nut-free filter). "Coconut" intentionally
// excluded — botanically a drupe and most nut-allergy guidance allows
// it; users with specific coconut sensitivities can deselect manually.
const NUT_KEYWORDS = [
  'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut',
  'macadamia', 'brazil nut', 'pine nut', 'chestnut', 'filbert',
  'peanut', 'groundnut', 'marzipan', 'praline', 'nougat', 'gianduja',
  // Generic "nut" catches "mixed nuts", "nut milk", etc.
  ' nut',
];

// Shellfish only (kosher excludes shellfish; pescatarian allows them).
const SHELLFISH_KEYWORDS = [
  'shrimp', 'prawn', 'crab', 'lobster', 'crayfish', 'crawfish',
  'oyster', 'clam', 'mussel', 'scallop', 'octopus', 'squid', 'calamari',
];

// Alcohol-derived (halal).
const ALCOHOL_KEYWORDS = [
  'wine', 'beer', 'ale', 'lager', 'whiskey', 'whisky', 'bourbon',
  'vodka', 'gin', 'rum', 'tequila', 'mezcal', 'brandy', 'cognac',
  'liqueur', 'vermouth', 'sake', 'champagne', 'sherry', 'port',
  'cachaca', 'absinthe', 'schnapps', 'sambuca', 'amaretto',
  'cointreau', 'kahlua', 'campari', 'aperol',
];

function nameContainsAny(name, keywords) {
  if (typeof name !== 'string') return false;
  const n = name.toLowerCase();
  for (const k of keywords) {
    if (n.includes(k)) return true;
  }
  return false;
}

function isMeatOrPoultry(name) {
  return nameContainsAny(name, MEAT_KEYWORDS);
}

function isSeafood(name) {
  return nameContainsAny(name, SEAFOOD_KEYWORDS);
}

function isDairy(name, node) {
  if (node?.category === 'dairy') return true;
  return nameContainsAny(name, DAIRY_KEYWORDS);
}

function isEgg(name) {
  return nameContainsAny(name, EGG_KEYWORDS);
}

function isHoney(name) {
  return nameContainsAny(name, HONEY_KEYWORDS);
}

function hasGluten(name) {
  return nameContainsAny(name, GLUTEN_KEYWORDS);
}

function isNut(name, node) {
  if (node?.category === 'nut') return true;
  return nameContainsAny(name, NUT_KEYWORDS);
}

function isShellfish(name) {
  return nameContainsAny(name, SHELLFISH_KEYWORDS);
}

function isAlcohol(name, node) {
  if (node?.category === 'spirit' || node?.category === 'liqueur') return true;
  return nameContainsAny(name, ALCOHOL_KEYWORDS);
}

// ────────── Per-restriction predicates ──────────
// Each returns `true` iff the ingredient is ALLOWED under that
// restriction (i.e., does NOT violate it).

export function isAllowedUnder(restriction, name, node) {
  switch (restriction) {
    case 'vegetarian':
      return !isMeatOrPoultry(name) && !isSeafood(name);
    case 'vegan':
      return (
        !isMeatOrPoultry(name) &&
        !isSeafood(name) &&
        !isDairy(name, node) &&
        !isEgg(name) &&
        !isHoney(name)
      );
    case 'gluten-free':
      return !hasGluten(name);
    case 'dairy-free':
      return !isDairy(name, node);
    case 'nut-free':
      return !isNut(name, node);
    case 'pescatarian':
      return !isMeatOrPoultry(name);
    case 'kosher':
      // Simplified: no pork, no shellfish. (Kashrut also forbids
      // meat+dairy in the same dish, which is recipe-level and out of
      // scope for ingredient filtering.)
      return (
        !nameContainsAny(name, ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard']) &&
        !isShellfish(name)
      );
    case 'halal':
      // Simplified: no pork, no alcohol. (Full halal requires
      // dhabihah-slaughtered meat which we cannot enforce from
      // ingredient name alone.)
      return (
        !nameContainsAny(name, ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard']) &&
        !isAlcohol(name, node)
      );
    default:
      return true;
  }
}

/**
 * Return true iff `name` is allowed under EVERY restriction in
 * `restrictions[]`. Empty array → always allowed (no filter active).
 */
export function passesDietaryFilters(name, node, restrictions) {
  if (!Array.isArray(restrictions) || restrictions.length === 0) return true;
  for (const r of restrictions) {
    if (!isAllowedUnder(r, name, node)) return false;
  }
  return true;
}
