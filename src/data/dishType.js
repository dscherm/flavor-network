/**
 * dishType.js — what kind of dish a Cookbook recipe is (DESIGN-3).
 *
 * Drives the chalk drawing on each recipe tile and at the top of the
 * recipe popup (DishArt in chalkArt.jsx). Derived from the fields every
 * recipe already carries — name, cluster and ingredients — so user-saved
 * recipes get a picture too. Rules run in order; the first match wins.
 *
 * 'plate' is the generic fallback. No seed recipe should land on it
 * (dishType.test.js checks all 83).
 */

export const DISH_TYPES = {
  soup:     'Soup',
  noodles:  'Noodles',
  pasta:    'Pasta',
  rice:     'Rice',
  curry:    'Curry',
  stew:     'Stew & braise',
  grill:    'Grill & skewers',
  fish:     'Fish & shellfish',
  salad:    'Salad',
  wok:      'Stir-fry',
  taco:     'Taco',
  wrap:     'Wrap',
  baguette: 'Baguette sandwich',
  sandwich: 'Sandwich & burger',
  dumpling: 'Dumplings',
  dip:      'Dip',
  tapas:    'Small plates',
  skillet:  'Skillet',
  pizza:    'Pizza',
  bake:     'Bread & bakes',
  dessert:  'Dessert',
  veg:      'Vegetables',
  plate:    'Dish',
};

const SWEET = /^(sugar|brown sugar|honey|maple syrup|chocolate|chocolate chip|cocoa|vanilla|caramel)$/;
const FISH = /\b(fish|salmon|tuna|cod|shrimp|prawn|clam|mussel|oyster|scallop|crab|lobster|squid|anchovy|sardine)\b/;

// [type, test on the lower-cased name] — checked before ingredient rules.
const NAME_RULES = [
  ['soup', /\b(soup|chowder|gumbo|pozole|bouillabaisse|gazpacho|tom yum|bisque|broth|consomm)/],
  ['noodles', /\b(ramen|pho|laksa|pad thai|udon|soba|lo mein|chow mein)\b/],
  ['curry', /\b(curry|masala|paneer|dal|tikka|butter chicken|korma|vindaloo)\b/],
  ['pizza', /\b(pizza|flatbread)\b/],
  ['grill', /\b(satay|souvlaki|kofta|kebab|skewer|ribs?|bbq|barbecue|bulgogi|fried chicken|grilled|wings)\b/],
  ['taco', /\b(tacos?|tostadas?|quesadillas?)\b/],
  ['wrap', /\b(shawarma|falafel|enchiladas?|burritos?|wraps?|gyros?|fajitas?)\b/],
  // (bánh mì sits outside the \b group: JS \b treats "ì" as a non-word char)
  ['baguette', /b[aá]nh m[iì]|\b(baguette|po'? ?boy|hoagie)\b/],
  ['sandwich', /\b(burgers?|cheeseburger|sandwich|sub|panini|toastie|hot dog)\b/],
  ['dumpling', /\b(gyoza|dumplings?|samosas?|empanadas?|wontons?|pierogi|bao)\b/],
  ['dip', /\b(hummus|guacamole|dip|baba ganoush|tzatziki|salsa)\b/],
  ['salad', /\b(salad|tabbouleh|som tam|ni[cç]oise|slaw)\b/],
  ['wok', /\b(tofu|kung pao|stir[- ]?fry|bok choy|chop suey)\b/],
  ['rice', /\b(risotto|biryani|bibimbap|paella|pilaf|pilau|mujadara|fried rice|sushi|roll|jambalaya)\b/],
  ['stew', /\b(bourguignon|coq au vin|ratatouille|osso buco|mole|stew|braise|ragu|tagine|chili|goulash|cassoulet)\b/],
  ['tapas', /\b(bravas|tapas|croquetas?|pintxos|gambas)\b/],
  ['skillet', /\b(shakshuka|frittata|hash|omelett?e|tortilla espa)/],
  ['bake', /\b(croissant|naan|quiche|pie|tart|bread|loaf|moussaka|spanakopita|gratin|focaccia|bun|scone|muffin)\b/],
];

/**
 * @param {{name?: string, cluster?: string, ingredients?: string[]}} recipe
 * @returns {keyof typeof DISH_TYPES}
 */
export function dishTypeOf(recipe) {
  const name = String(recipe?.name || '').toLowerCase();
  const cluster = String(recipe?.cluster || '').toLowerCase();
  const ings = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((s) => String(s || '').toLowerCase().trim());
  const has = (re) => ings.some((i) => re.test(i));

  // Sweet bakes first: a baking-cluster recipe with sugar and no yeast is a
  // dessert (croissant and naan carry sugar but rise with yeast).
  if (cluster === 'baking' && has(SWEET) && !has(/\byeast\b/)) return 'dessert';
  if (/\b(cake|cookies?|brownies?|pudding|ice cream|mousse|cr[eè]me br[uû]l[eé]e|panna cotta|tiramisu|churros|baklava|pancakes?|crumble)\b/.test(name)) return 'dessert';

  for (const [type, re] of NAME_RULES) {
    if (re.test(name)) return type;
  }

  // Ingredient fallbacks — mostly for user-saved recipes, whose names
  // are free text.
  if (has(/\b(rice noodle|ramen noodle|udon|soba|egg noodle)\b/)) return 'noodles';
  if (has(/\b(pasta|linguine|spaghetti|macaroni|penne|lasagna|tagliatelle|fettuccine)\b/)) return 'pasta';
  if (has(/\b(corn tortilla|taco shell)\b/)) return 'taco';
  if (has(/\b(tortilla|flour tortilla|pita bread|lavash)\b/)) return 'wrap';
  if (has(/\b(hamburger bun|bread baguette|sandwich bread|sliced bread)\b/)) return 'sandwich';
  if (has(/\b(curry paste|garam masala|curry powder)\b/)) return 'curry';
  if (cluster === 'seafood' || has(FISH)) return 'fish';
  if (has(/^rice$/)) return 'rice';
  if (cluster === 'baking') return 'bake';
  if (has(/\b(stock|broth)\b/)) return 'soup';
  if (cluster === 'vegetable') return 'veg';
  if (has(/\b(lettuce|romaine|arugula|mixed greens)\b/)) return 'salad';
  if (has(/\b(beef|pork|lamb|chicken|steak|veal|sausage)\b/)) return 'grill';
  return 'plate';
}

export function dishTypeLabel(type) {
  return DISH_TYPES[type] || DISH_TYPES.plate;
}
