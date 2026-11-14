/**
 * dishSkeletons.js — the dish-type skeletons behind "Invent a recipe"
 * (INVENT-4): an optional dish type, applied only when the cook accepts it,
 * gives the checklist of what that dish usually has; the cook adds every
 * ingredient themselves. The food counterpart of the sauce styles
 * in inventSauce.js, and the Recipe Lab's input to inventBuild.js.
 *
 * Pure: no React, no fetch. The caller injects the graph `nodes` (Map name
 * → { category, cuisines?, totalCount? }), the pairing index
 * (recipePairingMatch.buildPairingIndex) and, optionally, the set-completion
 * model's scores for this slot (already fetched).
 *
 * A skeleton is { slots: [{ id, label, required, kinds, not?, accepts(key) }],
 * rules }. Required slots are what makes the dish itself (a stir-fry is a
 * main, a vegetable, an aromatic, a sauce and a starch); optional slots are
 * the finishing touches and start empty.
 *
 * Slot membership (which ingredient fits which slot) is decided by KINDS:
 * a kind is a test on (name, graph category). Categories alone are too
 * coarse (category `condiment` holds soy sauce and cherry pie filling;
 * `grain` holds rice and flour), so most kinds pair a category with a name
 * test. A slot accepts a key when ANY of its kinds matches and its `not`
 * test does not. The `main` kind reuses recipeRoles (inventRecipe.js):
 * proteins and legumes, plus eggs, tofu, mushrooms and the substantial
 * vegetables (cauliflower, eggplant, squash, potato …).
 *
 * Never accepted anywhere: salt, oil, water and the like. They are in every
 * kitchen and make no choice. Basics (isBasic / isBasicLike) are also never
 * RANKED as a candidate, so a suggestion is always a real choice; the one
 * exception is a slot that lists `keepBasics` (the roast's fat may be butter).
 *
 * Ranking (rankDishSlot): the slot's accepted ingredients, kept to ordinary
 * food (pairing-graph degree >= DISH_MIN_DEGREE, same idea as
 * OUTSIDE_MIN_DEGREE), kitchen items first, then by mean pair strength with
 * what is already in the build, blended with the set-completion model's
 * score when the caller has one. A cuisine only adds a small bonus to
 * ingredients of that cuisine: it re-orders, it never filters.
 */
import { recipeRoles, isBasicLike, pairStrength } from './inventRecipe.js';
import { isBasic, haveIngredient } from './myKitchen.js';
import { oneOf, rankCategories, sameKind } from './inventBuild.js';

export const DISH_MIN_DEGREE = 50;     // graph degree an ordinary candidate needs
export const MODEL_WEIGHT = 0.5;       // weight of the set-completion score next to pair strength
export const CUISINE_BONUS = 0.04;     // added when the ingredient's cuisines include the chosen one

const lower = (s) => String(s || '').toLowerCase().trim();
const re = (...parts) => new RegExp(parts.join('|'));

// ---------------------------------------------------------------- kinds
const SALT_OIL_WATER = /(^|\s)(salt|water)$|(^|\s)oils?(\s|$)|\bcooking spray\b|^(black |white |ground )?pepper(corns?)?$/;
// Shop-bought shortcuts and non-ingredients that sit in the graph's food categories.
const NOISE = /\b(mix|flavou?r(ed|ing)?|substitute|powder|extract|cubes?|granules?|soup|filling|topping|instant|jelly|preserves?|spray|cake|cookies?|pie|ice cream|dessert)\b/;

const LEGUME = /\b(beans?|lentils?|chickpeas?|garbanzos?|tofu|tempeh|edamame|split peas?|black-eyed peas?|seitan)\b/;
const MUSHROOM = /\b(mushrooms?|shiitake|portobello|portabella|porcini|cremini|chanterelle|oyster mushroom|enoki|morel)\b/;
const HEARTY_VEG = /^(cauliflower|eggplant|aubergine|(butternut |acorn |winter )?squash|pumpkin|sweet potato|potato|potatoes|yam|jackfruit|cabbage|celeriac|parsnip|turnip|artichoke|zucchini|fennel)$/;
const PROTEIN_NOISE = /\b(bits?|substitute|powder|broth|stock|bouillon|base|flavou?r(ed)?|fat|dripping|grease)\b/;
const BEAN_NOT_VEG = /\bbeans?\b/;

const STIR_VEG_OUT = /potato|yam|cassava|plantain|pumpkin|squash|puree|canned|frozen|hash brown|mashed|juice|sauce|paste|ketchup|pickle|^vegetable$|^corn |cream-style|kernel corn/;
const SALAD_LEAF = /\b(lettuce|romaine|spinach|arugula|rocket|kale|cabbage|endive|radicchio|watercress|mesclun|greens|chard|frisee|escarole|bok choy|cucumber|tomato(e)?s?|fennel|radish|carrot|beet(root)?|celery|sprouts?|snow pea|sugar snap)\b/;
const SALAD_NOT = /juice|sauce|paste|puree|canned|soup|ketchup|dried|sun-dried|pickle|salad dressing/;

const GRAIN_BOWL = /\b(rice|quinoa|barley|farro|bulgur|couscous|millet|freekeh|polenta|orzo|wheat berr(y|ies)|buckwheat|cracked wheat|spelt|wild rice)\b/;
const GRAIN_NOT = /flour|krispie|crisp|cereal|flake|vinegar|wine|milk|paper|pudding|cake|noodle|cracker|wrapper|syrup|cooked rice crumb|bran|germ/;
const RICE_NOODLE = /\b(rice|noodles?|udon|soba|ramen|vermicelli|lo mein|chow mein|mein)\b/;
const RICE_NOODLE_NOT = /flour|krispie|crisp|cereal|flake|vinegar|wine|milk|paper|pudding|cake|cracker|wrapper|syrup|sauce|wine|bran|soup|egg noodle|lasagna|kugel|mix\b/;
const PASTA = /\b(pasta|spaghetti|penne|linguine|fettuccine|fettuccini|macaroni|rigatoni|ziti|rotini|fusilli|farfalle|orzo|tagliatelle|tortellini|ravioli|gnocchi|angel hair|capellini|bucatini|orecchiette|gemelli|cavatappi|egg noodle|elbow|rotelle|conchiglie|shells?|pappardelle|spaghettini|ditalini)\b/;
const PASTA_NOT = /lasagn|manicotti|sauce|salad|soup|bake|casserole|cheese|seasoning|dressing|mix\b|filling/;
const TORTILLA = /\b(tortillas?|taco shells?|tostadas?)\b/;
const TORTILLA_NOT = /chip|soup|crumb|strip|dough|salad|seasoning/;

const STIR_SAUCE = /\b(soy sauce|tamari|oyster sauce|fish sauce|hoisin|teriyaki|worcestershire|ponzu|black bean sauce|black bean|chili sauce|sweet chili|chili paste|sriracha|sambal|gochujang|doubanjiang|miso|coconut amino|kecap manis|mirin|plum sauce|sesame sauce|stir-fry sauce|sweet and sour|bean paste)\b/;
const DRESSING = /\b(dressing|vinaigrette|tahini|hummus|pesto|teriyaki|sriracha|peanut sauce|miso|gochujang|yogurt|ranch|hoisin|soy sauce|tzatziki|chimichurri|hot sauce|harissa|mustard|goddess|green goddess|aioli|mayonnaise|sesame sauce|ponzu)\b/;
const SALSA = /\b(salsa|picante|taco sauce|enchilada sauce|hot sauce|chipotle|guacamole|sour cream|crema|pico de gallo|adobo|tomatillo|tabasco|sriracha|queso|mole|chimichurri|harissa|aioli)\b/;
const TOMATO_BASE = /\b(tomato(e)? sauce|tomato paste|tomato(e)?s?|marinara|passata|spaghetti sauce|pasta sauce|pizza sauce|arrabbiata|crushed tomato(e)?s?|diced tomato(e)?s?|plum tomato(e)?s?|cherry tomato(e)?s?|tomato puree|ragu|bolognese|pomodoro)\b/;
const TOMATO_NOT = /soup|juice|ketchup|green tomato|sun-dried tomato powder/;
const CREAM_BASE = /^(cream|heavy cream|whipping cream|double cream|light cream|half and half|half-and-half|mascarpone|mascarpone cheese|creme fraiche|crème fraîche|alfredo sauce|pesto|basil pesto|pesto sauce)$/;
const STOCK = /\b(stock|broth|consomme|dashi|coconut milk|coconut cream|fish stock|bone broth)\b/;
const STOCK_NOT = /cube|granule|soup|powder|bouillon|base|condensed|cream of|campbell/;
const BRAISE_LIQUID = /\b(stock|broth|consomme|dashi|wine|beer|ale|stout|porter|cider|sake|vermouth|marsala|sherry|port|madeira|coconut milk|passata|crushed tomato(e)?s?|tomato sauce|tomato puree|diced tomato(e)?s?|tomato(e)?s?)\b/;
const BRAISE_LIQUID_NOT = /cube|granule|soup|powder|bouillon|base|condensed|cream of|campbell|vinegar|cooking wine|juice|ketchup|green tomato|ice cream|sour cream|whipped|cream cheese/;
const SPICE_OK = /^(cumin|ground cumin|cumin seed|paprika|smoked paprika|sweet paprika|cinnamon|cinnamon stick|oregano|thyme|nutmeg|bay leaf|coriander|ground coriander|turmeric|garam masala|curry powder|cayenne|cayenne pepper|chili flakes|red pepper flakes|crushed red pepper|allspice|cloves?|star anise|cardamom|fennel seed|mustard seed|saffron|five-spice|chinese five-spice|ras el hanout|za'atar|sumac|juniper|juniper berr(y|ies)|caraway|fenugreek|anise|peppercorns?|ground ginger|curry paste|herbes de provence|italian seasoning|berbere)$/;
const HERB = /\b(parsley|basil|oregano|thyme|cilantro|bay leaf|bay leaves|rosemary|mint|dill|sage|tarragon|chive|chives|marjoram|coriander leaf|savory|lovage|shiso|fenugreek leaves?|lime leaf|lime leaves|makrut lime leaf|curry leaf|curry leaves|chervil|herbs?)\b/;
const HERB_NOT = /matcha|chamomile|elderflower|orange blossom|lemon balm|linden|artemisia|angelica|powder|cornmint|laurel/;
const ACID = /\b(vinegar|lemon|lime|orange|grapefruit|yuzu|calamansi|tamarind|verjuice|sumac|pickle juice|lemon juice|lime juice)\b/;
const ACID_NOT = /tartar|tarter|salt|soda|pie|cake|jell?o|gelatin|candy|drink|zest peel|liqueur|brandy|vodka|rum|tequila|whiskey|schnapps|cola|sprite|7-up|syrup|bitters|extract|marmalade|curd|margarita|sorbet|sherbet|yogurt|balsalmic$/;
const CRUNCH = /\b(peanuts?|cashews?|almonds?|walnuts?|pecans?|pistachios?|hazelnuts?|pine nuts?|sesame seeds?|sunflower seeds?|pumpkin seeds?|croutons?|bread ?crumbs?|panko|fried onions?|bean sprouts?|water chestnuts?|crispy|crunchy|cracker|tortilla chips?|corn chips?|breadsticks?|seeds?|flaked coconut|toasted coconut|wonton strips|chow mein noodles?|dry-roasted|nuts?)\b/;
const CRUNCH_NOT = /butter|milk|oil|flour|powder|extract|cream|water|meal|paste|sauce|butternut|grapeseed|cottonseed|flax|chia|hemp|acorn|chestnut puree|jar|crumbs? pie|graham|coating|allergy/;
const FAT_ROAST = /\b(butter|ghee|lard|duck fat|goose fat|schmaltz|bacon fat|bacon grease|bacon dripping|pork fat|beef suet|suet|tallow|margarine|shortening|pancetta|bacon|garlic butter|clarified butter|herb butter|compound butter)\b/;
const FAT_ROAST_NOT = /bean|almond|peanut|cocoa|coconut butter|nut butter|flavor|buttermilk|butterscotch|butternut|cookie|cake|apple butter|body|shea|cup/;
const RICH_SALAD = /\b(avocado|bacon|mayonnaise|tahini|yogurt|sour cream|olives?|feta|goat cheese|blue cheese|egg|ricotta|burrata|mozzarella|parmesan|walnut|pecan|almonds?|cashews?|pine nuts?|mascarpone|crème fraîche|creme fraiche|sesame seeds?|pancetta|prosciutto)\b/;
const CHEESE = /\b(cheese|cheddar|mozzarella|feta|parmesan|ricotta|gruyere|gruyère|gouda|brie|jack|provolone|goat cheese|chevre|manchego|cotija|queso|halloumi|paneer|pecorino|asiago|fontina|gorgonzola|mascarpone|stilton|camembert|emmental|swiss|burrata|havarti|colby|romano|comte|taleggio)\b/;
const CHEESE_NOT = /cream cheese|cake|spread|sauce|soup|cheesecake|ball|puff|whiz|velveeta|dip|process|american|macaroni|string cheese|cottage/;
const PICKLE = /\b(pickles?|pickled|kimchi|sauerkraut|gherkins?|capers?|olives?|giardiniera|pepperoncini|cornichons?|banana peppers?|pickled ginger|gari|chutney|relish|preserved lemon|curtido|tsukemono|umeboshi)\b/;
const PICKLE_NOT = /juice|cake|pie|loaf|relish tray|cheese|oil|soup|pie filling/;
const FRESH_TOPPING = /\b(lettuce|romaine|cabbage|radish(es)?|cucumber|tomato(e)?s?|cilantro|onion|red onion|scallions?|green onions?|avocado|jicama|pico de gallo|sprouts?|corn|mango|pineapple|cress|shredded lettuce|iceberg|pickled onion|salsa fresca)\b/;
const FRESH_NOT = /juice|sauce|paste|puree|canned|soup|pickle|ketchup|dried|powder|sun-dried|cream-style|flake|fried|soup|salsa|roasted|bean|pie|cake|gum|popcorn|syrup|cream|sugar|starch|meal|flour|oil|chip|tortilla|seasoning|cob$/;
const STARCHY_SOUP = /\b(rice|noodles?|pasta|orzo|barley|couscous|quinoa|potato(es)?|sweet potato|gnocchi|vermicelli|macaroni|tortellini|ravioli|farro|bulgur|dumplings?|udon|ramen|soba|elbow|ditalini|egg noodle|bread|croutons?)\b/;
const STARCHY_NOT = /flour|krispie|crisp|cereal|flake|vinegar|wine|milk|paper|pudding|cake|cracker|wrapper|syrup|sauce|chip|mix\b|chowder|bran|soup|fries|hash|mashed|salad/;

const AROMATIC_NOT = /candied|crystal+iz|crystalized|fried|flake|juice|cocktail|caramelized|salt|powder|pickle|horseradish|paste|soup|dried|garlic ?(smashed|pressed)|pressed|smashed|ginger ?(freshly|ale|snap|bread)|freshly ginger|thin|slivered|top$|^onion (flake|top)|buds|instant/;
const AROMATIC_NAME = /^(onion|garlic|scallion|green onion|spring onion|ginger|gingerroot|root ginger|shallot|leek|chive|chives|red onion|yellow onion|white onion|sweet onion|purple onion|vidalia onion|spanish onion|brown onion|pearl onion|green garlic|garlic clove|ginger root|fresh ginger)$/;
const AROMATIC_ASIAN = /^(lemongrass|galangal|kaffir lime|makrut lime leaf)$/;
const BASE_AROMATIC_NAME = /^(onion|garlic|shallot|leek|celery|carrot|fennel|celeriac|parsnip|red onion|yellow onion|white onion|sweet onion|brown onion|purple onion|spanish onion|vidalia onion|pearl onion)$/;
const CHILI_NOT = /sauce|powder|pickled|paste|oil|flake|chili powder|seasoning|salt/;
const SOFT_NOT = /sauce|soup|juice/;

/**
 * name × category tests. Each takes (name, category) with `name` lower-cased
 * and `category` possibly undefined (a typed, unknown ingredient).
 */
export const KINDS = {
  protein: (n, c) => (c === 'protein' && !PROTEIN_NOISE.test(n)) || LEGUME.test(n),
  mushroom: (n) => MUSHROOM.test(n) && !/soup|sauce|powder|stock|cream of/.test(n),
  heartyVeg: (n) => HEARTY_VEG.test(n),
  vegetable: (n, c) => c === 'vegetable' && !BEAN_NOT_VEG.test(n) && !MUSHROOM.test(n) && !NOISE.test(n) && !/juice|sauce|paste|puree|canned|ketchup|pickle|relish/.test(n),
  stirVegetable: (n, c) => c === 'vegetable' && !BEAN_NOT_VEG.test(n) && !NOISE.test(n) && !STIR_VEG_OUT.test(n),
  saladBase: (n, c) => SALAD_LEAF.test(n) && !SALAD_NOT.test(n) && !NOISE.test(n) && (!c || c === 'vegetable' || c === 'herb'),
  aromatic: (n, c) => AROMATIC_NAME.test(n) || (c === 'aromatic' && !AROMATIC_NOT.test(n) && !AROMATIC_ASIAN.test(n) && !/lemongrass|galangal|horseradish/.test(n)),
  aromaticAsian: (n) => AROMATIC_ASIAN.test(n),
  aromaticBase: (n) => BASE_AROMATIC_NAME.test(n),
  stirSauce: (n, c) => STIR_SAUCE.test(n) && !NOISE.test(n) && (!c || ['condiment', 'umami', 'liquid', 'seasoning', 'other'].includes(c)),
  dressing: (n, c) => DRESSING.test(n) && !NOISE.test(n) && (!c || ['condiment', 'dairy', 'umami', 'nut', 'other', 'liquid', 'seasoning'].includes(c)) && !/salad$|egg|cake|(lemon|vanilla|fruit|strawberry|peach|blueberry|raspberry|banana) yogurt/.test(n),
  salsa: (n, c) => SALSA.test(n) && !NOISE.test(n) && (!c || ['condiment', 'dairy', 'chili', 'vegetable', 'umami', 'other', 'fruit'].includes(c)),
  riceNoodle: (n, c) => RICE_NOODLE.test(n) && !RICE_NOODLE_NOT.test(n) && !NOISE.test(n) && (!c || c === 'grain'),
  grain: (n, c) => GRAIN_BOWL.test(n) && !GRAIN_NOT.test(n) && !NOISE.test(n) && (!c || c === 'grain'),
  starchy: (n, c) => STARCHY_SOUP.test(n) && !STARCHY_NOT.test(n) && !NOISE.test(n) && (!c || ['grain', 'vegetable', 'baked'].includes(c)),
  pasta: (n, c) => PASTA.test(n) && !PASTA_NOT.test(n) && !NOISE.test(n) && (!c || c === 'grain' || c === 'protein'),
  tortilla: (n, c) => TORTILLA.test(n) && !TORTILLA_NOT.test(n) && !NOISE.test(n) && (!c || c === 'grain' || c === 'baked'),
  tomatoBase: (n, c) => TOMATO_BASE.test(n) && !TOMATO_NOT.test(n) && (!c || ['vegetable', 'condiment', 'liquid'].includes(c)),
  creamBase: (n, c) => CREAM_BASE.test(n) && (!c || ['dairy', 'condiment'].includes(c)),
  stock: (n, c) => STOCK.test(n) && !STOCK_NOT.test(n) && (!c || ['liquid', 'umami', 'dairy', 'nut', 'condiment'].includes(c)),
  braiseLiquid: (n, c) => BRAISE_LIQUID.test(n) && !BRAISE_LIQUID_NOT.test(n) && (!c || ['liquid', 'umami', 'vegetable', 'condiment', 'dairy', 'nut', 'spirit'].includes(c)),
  herb: (n, c) => HERB.test(n) && !HERB_NOT.test(n) && !NOISE.test(n) && (!c || c === 'herb' || c === 'aromatic' || c === 'vegetable'),
  spice: (n, c) => (SPICE_OK.test(n) || c === 'spice') && !NOISE.test(n) && !/blend|seasoning|rub|salt|vanilla|cocoa|cacao|chocolate|sugar|mint/.test(n),
  acid: (n, c) => ACID.test(n) && !ACID_NOT.test(n) && !/\bcake\b|^orange (peel|zest)$/.test(n) && (!c || ['acid', 'citrus', 'fruit', 'condiment', 'liquid'].includes(c)),
  crunch: (n, c) => CRUNCH.test(n) && !CRUNCH_NOT.test(n) && !NOISE.test(n) && (!c || ['nut', 'baked', 'vegetable', 'grain', 'condiment'].includes(c)),
  roastFat: (n, c) => FAT_ROAST.test(n) && !FAT_ROAST_NOT.test(n) && !NOISE.test(n) && (!c || ['fat', 'protein', 'dairy'].includes(c)),
  saladRich: (n, c) => RICH_SALAD.test(n) && !NOISE.test(n) && !/cake|sauce|soup|cream cheese|dressing|powder|butter ?milk|peanut butter|nut butter|butternut|olive oil/.test(n) && (!c || ['fruit', 'protein', 'dairy', 'condiment', 'nut', 'fat', 'umami'].includes(c)),
  cheese: (n, c) => CHEESE.test(n) && !CHEESE_NOT.test(n) && !NOISE.test(n) && (!c || ['dairy', 'umami'].includes(c)),
  pickle: (n, c) => PICKLE.test(n) && !PICKLE_NOT.test(n) && !NOISE.test(n) && (!c || ['condiment', 'vegetable', 'fruit', 'acid'].includes(c)),
  chili: (n, c) => (c === 'chili' && !CHILI_NOT.test(n)) || /^(chili flakes|red pepper flakes|crushed red pepper|chili oil crisp|jalapeno|jalapeño|serrano|habanero|chipotle|sambal oelek)$/.test(n),
  freshTopping: (n, c) => FRESH_TOPPING.test(n) && !FRESH_NOT.test(n) && !NOISE.test(n) && (!c || ['vegetable', 'herb', 'fruit', 'citrus', 'aromatic'].includes(c)),
};

/** Main: proteins and legumes (recipeRoles), eggs, tofu, mushrooms, substantial vegetables. */
export function isMainKey(key, nodes = null) {
  const n = lower(key);
  if (!n || PROTEIN_NOISE.test(n)) return false;
  if (KINDS.mushroom(n) || HEARTY_VEG.test(n) || /^eggs?$/.test(n)) return true;
  return recipeRoles([n], { nodes }).main;
}

// --------------------------------------------------------------- slots
// kinds: names from KINDS, plus 'main'. A slot accepts a key when any kind
// matches, the `not` test (if any) does not, and the key is not salt/oil/water.
const S = (id, label, required, kinds, extra = {}) => ({ id, label, required, kinds, ...extra });

const MAIN = (label = 'main') => S('main', label, true, ['main']);

/**
 * The 8 dish types. `dishType` is the matching key in dishType.js DISH_TYPES
 * (what DishArt draws). `method` is plain how-it-comes-together prose.
 */
export const DISH_SKELETONS = {
  'stir-fry': {
    id: 'stir-fry', label: 'Stir-fry', noun: 'Stir-Fry', dishType: 'wok',
    blurb: 'fast, hot pan, sauce at the end',
    method: 'Cut everything small and even, and get the pan very hot. Cook the main first and set it aside, then the vegetables, then the aromatics for a few seconds. Return the main, add the sauce, toss until glossy and serve over the starch.',
    slots: [
      MAIN(),
      S('vegetable', 'vegetable', true, ['stirVegetable'], { not: STIR_VEG_OUT }),
      S('aromatic', 'aromatic', true, ['aromatic', 'aromaticAsian']),
      S('sauce', 'sauce', true, ['stirSauce']),
      S('starch', 'rice or noodles', true, ['riceNoodle']),
      S('chili', 'chili', false, ['chili']),
      S('herb', 'herb', false, ['herb']),
      S('crunch', 'crunch', false, ['crunch']),
    ],
  },
  'braise-stew': {
    id: 'braise-stew', label: 'Braise / stew', noun: 'Braise', dishType: 'stew',
    blurb: 'low and slow, one pot, deep flavor',
    method: 'Brown the main well in a heavy pot and set it aside. Soften the aromatic base in the same pot, add the liquid and scrape up the browned bits, then return the main. Cover and simmer gently, or bake, until it is tender, and finish with the herb and a splash of acid.',
    slots: [
      MAIN(),
      S('aromatic', 'aromatic base', true, ['aromaticBase']),
      S('liquid', 'liquid', true, ['braiseLiquid']),
      S('flavoring', 'herb or spice', true, ['herb', 'spice']),
      S('vegetable', 'vegetable', false, ['vegetable']),
      S('acid', 'acid', false, ['acid']),
    ],
  },
  soup: {
    id: 'soup', label: 'Soup', noun: 'Soup', dishType: 'soup',
    blurb: 'simmered in a broth, one bowl',
    method: 'Soften the aromatic base in a little fat. Add the vegetables and the main, pour in the liquid and simmer until everything is tender. Add the starch near the end so it does not go soft, then season and finish with the herb or a squeeze of acid.',
    slots: [
      S('liquid', 'broth or liquid', true, ['stock']),
      S('aromatic', 'aromatic base', true, ['aromaticBase']),
      MAIN(),
      S('vegetable', 'vegetable', true, ['vegetable']),
      S('starch', 'starch', false, ['starchy']),
      S('herb', 'herb', false, ['herb']),
      S('acid', 'acid', false, ['acid']),
    ],
  },
  salad: {
    id: 'salad', label: 'Salad', noun: 'Salad', dishType: 'salad',
    blurb: 'raw and crisp, dressed just before eating',
    method: 'Wash and dry the greens well and tear them into pieces. Whisk the acid with the fat for the dressing, and add the other ingredients. Dress the greens only at the last minute, toss gently, and top with the crunch.',
    slots: [
      S('greens', 'greens or base vegetable', true, ['saladBase']),
      S('acid', 'acid', true, ['acid']),
      S('fat', 'something rich', true, ['saladRich']),
      S('crunch', 'crunch', false, ['crunch']),
      S('cheese', 'cheese', false, ['cheese']),
      S('protein', 'protein', false, ['protein']),
      S('herb', 'herb', false, ['herb']),
    ],
  },
  pasta: {
    id: 'pasta', label: 'Pasta', noun: 'Pasta', dishType: 'pasta',
    blurb: 'a sauce that clings to a good shape',
    method: 'Boil the pasta in well-salted water until just short of done and keep a cup of the water. Build the sauce in a wide pan from the aromatic and the sauce base, then toss the pasta in with a splash of the water until it clings. Finish with the cheese and herb.',
    slots: [
      S('pasta', 'pasta', true, ['pasta']),
      S('sauce', 'sauce base', true, ['tomatoBase', 'creamBase']),
      S('aromatic', 'aromatic', true, ['aromatic']),
      S('main', 'main', false, ['main']),
      S('cheese', 'cheese', false, ['cheese']),
      S('herb', 'herb', false, ['herb']),
    ],
    rule: 'pasta',
  },
  roast: {
    id: 'roast', label: 'Roast', noun: 'Roast', dishType: 'grill',
    blurb: 'oven heat, crisp outside, tender inside',
    method: 'Heat the oven hot and pat the main dry. Rub it with the fat and the aromatic or herb, and season well. Roast, with any vegetables alongside, until it is cooked through and well browned, then rest it before carving and finish with a squeeze of acid.',
    slots: [
      MAIN(),
      S('fat', 'fat', true, ['roastFat'], { keepBasics: ['butter'] }),
      S('aromatic', 'aromatic or herb', true, ['aromatic', 'herb']),
      S('vegetable', 'vegetable', false, ['vegetable']),
      S('acid', 'acid', false, ['acid']),
    ],
  },
  tacos: {
    id: 'tacos', label: 'Tacos', noun: 'Tacos', dishType: 'taco',
    blurb: 'warm tortillas, a savory filling, bright toppings',
    method: 'Cook the main with a little seasoning until browned and well flavored. Warm the tortillas in a dry pan until pliable. Fill with the main, spoon over the salsa or sauce, and finish with the fresh topping and a squeeze of lime.',
    slots: [
      S('tortilla', 'tortilla', true, ['tortilla']),
      MAIN(),
      S('sauce', 'salsa or sauce', true, ['salsa']),
      S('topping', 'fresh topping', true, ['freshTopping']),
      S('acid', 'acid', false, ['acid']),
      S('cheese', 'cheese', false, ['cheese']),
      S('chili', 'chili', false, ['chili']),
    ],
  },
  'grain-bowl': {
    id: 'grain-bowl', label: 'Grain bowl', noun: 'Bowl', dishType: 'rice',
    blurb: 'grains, a main and a vegetable under a sauce',
    method: 'Cook the grain and keep it warm. Roast or sauté the main and the vegetable until browned. Pile everything over the grain in sections, spoon the sauce over, and top with the crunch, pickle and herb.',
    slots: [
      S('grain', 'grain', true, ['grain']),
      MAIN(),
      S('vegetable', 'vegetable', true, ['vegetable']),
      S('sauce', 'sauce or dressing', true, ['dressing']),
      S('crunch', 'crunch', false, ['crunch']),
      S('pickle', 'pickle', false, ['pickle']),
      S('herb', 'herb', false, ['herb']),
    ],
  },
};

export const DISH_SKELETON_ORDER = ['stir-fry', 'braise-stew', 'soup', 'salad', 'pasta', 'roast', 'tacos', 'grain-bowl'];

/** Is `key` a pasta shape (for the one-pasta rule)? */
const isPastaKey = (k) => KINDS.pasta(lower(k), undefined);

/**
 * Does the slot take this ingredient? `slot` is a skeleton slot (kinds, not).
 * Salt, oil and water are never accepted. `nodes` supplies the graph category.
 */
export function slotAccepts(slot, key, nodes = null) {
  const n = lower(key);
  if (!n || SALT_OIL_WATER.test(n)) return false;
  if (slot.not && slot.not.test(n)) return false;
  const cat = nodes?.get?.(n)?.category;
  return slot.kinds.some((k) => (k === 'main' ? isMainKey(n, nodes) : KINDS[k]?.(n, cat)));
}

/**
 * An inventBuild skeleton for a dish type: slots with accepts(key), plus the
 * rules that are true of the dish (a pasta dish has one pasta shape). → null
 * for an unknown type.
 */
export function dishSkeleton(typeId, { nodes = null } = {}) {
  const def = DISH_SKELETONS[typeId];
  if (!def) return null;
  const rules = [];
  if (def.rule === 'pasta') rules.push(oneOf(isPastaKey, 'a pasta dish has one pasta shape'));
  return {
    id: def.id, label: def.label, noun: def.noun, blurb: def.blurb, dishType: def.dishType, method: def.method,
    slots: def.slots.map((s) => ({ ...s, accepts: (key) => slotAccepts(s, key, nodes) })),
    rules,
  };
}

// ------------------------------------------------------------- ranking
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
/** Model scores are probabilities; anything outside [0,1] is read as a logit. */
const modelProb = (s) => (typeof s !== 'number' || Number.isNaN(s) ? 0 : (s >= 0 && s <= 1 ? s : sigmoid(s)));

function cuisineHit(node, cuisine) {
  if (!cuisine) return false;
  const want = lower(cuisine);
  return (node?.cuisines || []).some((c) => lower(c).replace(/ cuisine$/, '') === want);
}

function common(key, node, degree) {
  if (degree && degree.size > 0) return (degree.get(key) || 0) >= DISH_MIN_DEGREE;
  if (typeof node?.pairingCount === 'number') return node.pairingCount >= DISH_MIN_DEGREE;
  return true;
}

/**
 * Ordered candidates for one slot, given the rest of the build. With `slot`
 * null ("goes with the list") the whole ordinary pool is ranked against
 * currentKeys instead, kitchen first, basics never offered, nothing of the same kind
 * as a line already in the list, and one candidate per kind (black pepper or white, not both).
 * @returns {{ key: string, have: boolean, score: number }[]} kitchen items
 *   first, then by score (pair strength with currentKeys + MODEL_WEIGHT × the
 *   model's score + the cuisine bonus), name as the final tie-break.
 */
export function rankDishSlot({
  slot, currentKeys = [], kitchen = [], cuisine = null, nodes = null, pairingIndex = null, modelScores = null,
} = {}) {
  if (!nodes || typeof nodes.keys !== 'function') return [];
  const kitchenSet = new Set((kitchen || []).map(lower));
  const taken = new Set((currentKeys || []).map(lower));
  const partners = [...taken].filter((k) => !isBasicLike(k));
  const degree = pairingIndex?.degree;
  const out = [];
  for (const key of nodes.keys()) {
    const n = lower(key);
    if (taken.has(n) || ((isBasicLike(n) || isBasic(n)) && !slot?.keepBasics?.includes(n))) continue;
    if (slot && !slotAccepts(slot, n, nodes)) continue;
    if (!slot && [...taken].some((t) => sameKind(n, t))) continue;
    const node = nodes.get(key);
    const have = haveIngredient(n, kitchenSet, { assumeBasics: false }).covered;
    if (!have && !common(n, node, degree)) continue;
    const pair = partners.length ? partners.reduce((s, p) => s + pairStrength(pairingIndex, n, p), 0) / partners.length : 0;
    const model = modelScores instanceof Map && modelScores.has(n) ? clamp01(modelProb(modelScores.get(n))) : 0;
    const score = pair + MODEL_WEIGHT * model + (cuisineHit(node, cuisine) ? CUISINE_BONUS : 0);
    out.push({ key: n, have, score });
  }
  const sorted = out.sort((a, b) => (b.have - a.have) || (b.score - a.score) || (a.key < b.key ? -1 : 1));
  if (slot) return sorted;
  const kept = [];
  for (const c of sorted) if (!kept.some((k) => sameKind(k.key, c.key))) kept.push(c);
  return kept;
}

/**
 * The dish type whose skeleton places the most of `names` in distinct slots.
 * Ties go to the type with more REQUIRED slots filled, then to
 * DISH_SKELETON_ORDER. An empty list (or nothing that fits) gives the first type.
 */
export function dishTypeForIngredients(names, { nodes = null } = {}) {
  const keys = [...new Set((names || []).map(lower).filter(Boolean))];
  const skeletons = DISH_SKELETON_ORDER.map((id) => ({ id, skeleton: dishSkeleton(id, { nodes }) }));
  return rankCategories(keys, skeletons, { order: DISH_SKELETON_ORDER })[0].id;
}
