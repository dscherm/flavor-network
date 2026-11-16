/**
 * kitchenSwaps.js — everyday substitutions for "What's in my kitchen?" and
 * "What do I need?" (WEAK-3): "use your onion for the scallion".
 *
 * One hand-written table. The rule is the Sauce Lab stand-in rule (see
 * saucePantry.js): a swap stays within one ROLE and one KIND, never across.
 * Onion for scallion (both alliums), cilantro for parsley (both soft
 * herbs), stock for white wine (both the cooking liquid of a pan), never
 * garlic for onion or flour for egg.
 *
 * Each entry: `for` the recipe's item, `use` the kitchen item that stands
 * in for it, `plus` any helpers the swap needs (milk + butter for cream),
 * `role` the ingredient-graph category both sides share, `kind` the finer
 * group, and:
 *   - `supportingOnly`: the swap holds only when the item is a supporting
 *     one in that recipe (butter ↔ oil for sautéing, not in a pastry);
 *   - `sauce: false`: the swap does not hold in a sauce (milk will not
 *     reduce like cream; sour cream splits). The Sauce Lab's pantry stays
 *     strict, and a test checks this flag never contradicts its stand-in
 *     rule (saucePantry.sameRoleAndKind).
 *
 * FOUR KINDS of answer (STANDIN-1). An entry carries an optional `type`:
 *   'swap' (the default, and what every entry above is): another ingredient, shallot for onion;
 *   'form': the same thing in another form (dried thyme for fresh, garlic powder for a clove);
 *   'make': made from things (simple syrup from sugar and water): `use` is the first part, `plus` the rest;
 *   'none': nothing replaces it (`reason` says why; no `use`).
 * Any kind may carry `ratio` (one numeric factor, applied to a row's single number), `amountNote` (a conversion that
 * is not one factor: "1 tsp dried for 1 tbsp fresh") and `note`.
 *
 * WHO MAY USE WHICH. The recipe side (findSwap, swapsFor, SWAPS: "what do I need", "what can I cook", the invent
 * panels, the Sauce Lab) reads ONLY swap-kind entries, exactly as before: a recipe is never counted as makeable
 * through a dried herb for a fresh one, or a syrup made from sugar. The shopping sheet reads every kind through
 * standInsFor / STAND_INS. A swap-kind entry may keep its `plus` helpers (cream: milk and butter); those are
 * untyped on purpose, so the recipe side and the sheet treat them as they always did.
 *
 * Checked against the blended everyday-pairs index (scripts/
 * measureKitchenMakeable.mjs): the two sides of each swap share partners.
 */
import { isSuggestable } from './curation/suggestable.js';

const S = (forName, use, role, kind, extra = {}) => ({ for: forName, use, role, kind, plus: [], ...extra });
/** A two-way swap: a for b and b for a. */
const both = (a, b, role, kind, extra = {}) => [S(a, b, role, kind, extra), S(b, a, role, kind, extra)];
/** The same thing in another form: dried thyme for fresh thyme. */
export const FORM = (forName, use, role, kind, extra = {}) => S(forName, use, role, kind, { type: 'form', ...extra });
/** Made from parts: parts[0] is `use`, the rest are `plus`. */
export const MAKE = (forName, parts, role, kind, extra = {}) => S(forName, parts[0], role, kind, { type: 'make', plus: parts.slice(1), ...extra });
/** Nothing replaces it; `reason` is one line saying why. */
export const NONE = (forName, reason, role = null, kind = null, extra = {}) => ({ for: forName, use: null, role, kind, plus: [], type: 'none', reason, ...extra });

const TABLE = [
  // Alliums. Never garlic: it is not an onion.
  S('scallion', 'onion', 'aromatic', 'onion'),
  S('shallot', 'onion', 'aromatic', 'onion'),
  S('leek', 'onion', 'aromatic', 'onion'),
  ...both('onion', 'purple onion', 'aromatic', 'onion'),
  S('pearl onion', 'onion', 'aromatic', 'onion'),
  S('onion', 'shallot', 'aromatic', 'onion'),
  S('scallion', 'leek', 'aromatic', 'onion'),
  // Soft herbs.
  ...both('parsley', 'cilantro', 'herb', 'soft herb'),
  // Citrus.
  ...both('lime', 'lemon', 'citrus', 'citrus'),
  ...both('lime juice', 'lemon juice', 'citrus', 'citrus'),
  // Cooking liquid. Wine → stock in a pan or braise; not in a sauce (the
  // Sauce Lab treats wine and stock as different kinds).
  S('white wine', 'chicken stock', 'liquid', 'cooking liquid', { sauce: false }),
  S('white wine', 'vegetable broth', 'liquid', 'cooking liquid', { sauce: false }),
  S('white wine', 'stock', 'liquid', 'cooking liquid', { sauce: false }),
  S('white wine', 'broth', 'liquid', 'cooking liquid', { sauce: false }),
  ...both('beef stock', 'chicken stock', 'liquid', 'stock'),
  ...both('vegetable broth', 'chicken stock', 'liquid', 'stock'),
  S('beef stock', 'stock', 'liquid', 'stock'),
  S('vegetable broth', 'stock', 'liquid', 'stock'),
  S('beef stock', 'broth', 'liquid', 'stock'),
  S('vegetable broth', 'broth', 'liquid', 'stock'),
  // Cultured and rich dairy.
  ...both('yogurt', 'sour cream', 'dairy', 'cultured dairy'),
  S('creme fraiche', 'sour cream', 'dairy', 'cultured dairy', { sauce: false }),
  S('creme fraiche', 'cream', 'dairy', 'cream'),
  S('cream', 'milk', 'dairy', 'cream', { plus: ['butter'], sauce: false }),
  S('buttermilk', 'milk', 'dairy', 'cultured dairy', { plus: ['lemon'], sauce: false }),
  S('buttermilk', 'yogurt', 'dairy', 'cultured dairy'),
  // Cheeses of one kind.
  ...both('parmesan', 'pecorino', 'umami', 'hard cheese'),
  ...both('cheddar', 'monterey jack cheese', 'dairy', 'melting cheese'),
  ...both('feta', 'cotija cheese', 'dairy', 'crumbly cheese'),
  // Fat for the pan (not for a pastry or a cake).
  ...both('butter', 'olive oil', 'fat', 'cooking fat', { supportingOnly: true, sauce: false, supportingNote: 'fine for frying' }),
  S('butter', 'vegetable oil', 'fat', 'cooking fat', { supportingOnly: true, sauce: false, supportingNote: 'fine for frying' }),
  S('ghee', 'butter', 'fat', 'butter'),
  // Sweeteners.
  ...both('honey', 'sugar', 'sweetener', 'sweet'),
  ...both('honey', 'maple syrup', 'sweetener', 'sweet'),
  S('brown sugar', 'sugar', 'sweetener', 'sweet'),
  S('palm sugar', 'brown sugar', 'sweetener', 'sweet'),
  S('palm sugar', 'sugar', 'sweetener', 'sweet'),
  // Vinegars.
  S('rice vinegar', 'apple cider vinegar', 'acid', 'vinegar'),
  S('sherry vinegar', 'red wine vinegar', 'acid', 'vinegar'),
  ...both('apple cider vinegar', 'white wine vinegar', 'acid', 'vinegar'),
  // Fresh chilies.
  ...both('jalapeno chile', 'serrano pepper', 'chili', 'fresh chili'),
  S('green chili pepper', 'jalapeno chile', 'chili', 'fresh chili'),
  S('green chili pepper', 'serrano pepper', 'chili', 'fresh chili'),
  // Bread, pasta and tortillas of one shape.
  S('bread baguette', 'bread', 'grain', 'bread'),
  S('linguine pasta', 'pasta', 'grain', 'long pasta'),
  S('linguine pasta', 'spaghetti', 'grain', 'long pasta'),
  S('pasta', 'spaghetti', 'grain', 'pasta'),
  S('macaroni', 'pasta', 'grain', 'short pasta'),
  S('corn tortilla', 'tortilla', 'grain', 'tortilla'),
  S('corn tortilla', 'flour tortilla', 'grain', 'tortilla'),
  // The other three kinds. STANDIN-1 writes ONE real entry, an honest 'none' (egg); STANDIN-2 and STANDIN-3 write
  // the forms and the makes (the tests build theirs with FORM / MAKE / NONE). Written from common cooking
  // knowledge (the assistant's judgement).
  NONE('egg', 'an egg sets and binds a custard, a quiche or a hollandaise; nothing else does both', 'protein', 'egg'),
  // ---- STANDIN-2: food. Every line is the assistant's judgement from common cooking knowledge, not a tested
  // recipe, and is listed in docs/stand-ins.md for the owner to read and correct. Names are the ones the list stores.

  // Garlic and ginger: forms with amounts. Shallot is not a stand-in for garlic.
  FORM('garlic', 'jarred garlic', 'aromatic', 'garlic', { amountNote: '1/2 tsp jarred minced garlic for each fresh clove', note: 'a little flatter than fresh' }),
  FORM('garlic', 'garlic powder', 'aromatic', 'garlic', { amountNote: '1/8 tsp garlic powder for each fresh clove', note: 'fine in a rub, a sauce or a soup; it will not brown or sizzle like fresh' }),
  FORM('ginger', 'ground ginger', 'aromatic', 'ginger', { amountNote: '1/4 tsp ground ginger for each 1 tbsp fresh grated', note: 'warmer and duller; fine in baking, a rub or a spiced sauce, a poor fit for a stir-fry' }),
  FORM('ginger', 'jarred ginger', 'aromatic', 'ginger', { amountNote: '1 tsp jarred ginger paste for each 1 tbsp fresh grated' }),
  S('galangal', 'ginger', 'aromatic', 'root', { note: 'milder and less piney; fine in a Thai soup or paste' }),

  // Herbs, fresh and dried both ways. Never a different herb because it is also green.
  FORM('thyme', 'dried thyme', 'herb', 'thyme', { amountNote: '1 tsp dried for 1 tbsp fresh' }),
  FORM('thyme', 'fresh thyme', 'herb', 'thyme', { amountNote: '1 tbsp fresh for 1 tsp dried' }),
  FORM('oregano', 'dried oregano', 'herb', 'oregano', { amountNote: '1 tsp dried for each 1 tbsp fresh' }),
  FORM('oregano', 'fresh oregano', 'herb', 'oregano', { amountNote: '1 tbsp fresh for each 1 tsp dried' }),
  FORM('basil', 'dried basil', 'herb', 'basil', { amountNote: '1 tsp dried for each 1 tbsp fresh; stir it in early', note: 'no good for pesto, caprese or a garnish' }),
  FORM('rosemary', 'dried rosemary', 'herb', 'rosemary', { amountNote: '1 tsp dried for each 1 tbsp fresh needles', note: 'crumble it so the needles are not sharp' }),
  FORM('dill', 'dried dill', 'herb', 'dill', { amountNote: '1 tsp dried for each 1 tbsp fresh', note: 'much weaker; fine in a cooked sauce or a dip, poor as a garnish' }),
  FORM('mint', 'dried mint', 'herb', 'mint', { amountNote: '1 tsp dried for each 1 tbsp fresh', note: 'fine in a cooked dish or a yogurt sauce, no good as a garnish' }),
  S('rosemary', 'thyme', 'herb', 'woody herb', { note: 'milder than rosemary: use a little more' }),
  S('thyme', 'rosemary', 'herb', 'woody herb', { amountNote: 'about half as much rosemary as thyme', note: 'a stronger flavor than thyme' }),
  S('thai basil', 'basil', 'herb', 'basil', { note: 'sweeter, without the anise note' }),
  S('basil', 'thai basil', 'herb', 'basil', { note: 'with an anise note; best in a stir-fry or a curry' }),
  ...both('oregano', 'marjoram', 'herb', 'oregano', { note: 'marjoram is sweeter and milder' }),
  NONE('bay leaf', 'it adds a quiet background note that no other herb copies; leaving it out loses little, and thyme is a different flavor', 'herb', 'bay'),
  NONE('tarragon', 'its sweet anise note is the point of a bearnaise or a chicken dish; no common herb matches it', 'herb', 'tarragon'),

  // Tomatoes.
  FORM('tomato', 'canned tomatoes', 'vegetable', 'tomato', { amountNote: 'one 14 oz (400 g) can for about 4 medium fresh tomatoes', note: 'for a cooked dish or a sauce, not for a salad or a sandwich' }),
  FORM('tomato', 'tomato paste', 'vegetable', 'tomato', { amountNote: '1 tbsp paste stirred into 1/4 cup water for each medium tomato', note: 'for a cooked dish only' }),
  FORM('tomato paste', 'tomato sauce', 'condiment', 'tomato', { amountNote: '3 tbsp tomato sauce, cooked down, for each 1 tbsp paste' }),
  MAKE('tomato sauce', ['tomato paste', 'water'], 'condiment', 'tomato', { amountNote: '1 part tomato paste to 3 parts water, and a pinch of salt and sugar' }),
  MAKE('ketchup', ['tomato paste', 'sugar', 'vinegar'], 'condiment', 'tomato', { amountNote: '2 tbsp tomato paste, 1 tbsp sugar, 1 tbsp vinegar and 2 tbsp water, with a pinch of salt, for about 1/4 cup' }),

  // Salt and pepper.
  FORM('salt', 'kosher salt', 'seasoning', 'salt', { amountNote: 'about 1 1/2 times as much kosher salt by volume as table salt', note: 'the grains are coarser, so a spoon holds less salt' }),
  FORM('salt', 'table salt', 'seasoning', 'salt', { amountNote: 'about two thirds as much table salt by volume as kosher salt' }),
  FORM('salt', 'sea salt', 'seasoning', 'salt', { amountNote: 'fine sea salt measures like table salt; flaky sea salt, use about twice as much by volume' }),
  S('black pepper', 'white pepper', 'spice', 'pepper', { note: 'hotter and earthier, with no black specks' }),
  S('white pepper', 'black pepper', 'spice', 'pepper', { note: 'the black specks will show in a pale sauce' }),

  // Fats and oils. Sesame oil is a flavoring, not a fat.
  S('ghee', 'clarified butter', 'fat', 'butter', { note: 'the same thing under another name' }),
  S('clarified butter', 'ghee', 'fat', 'butter', { note: 'the same thing under another name' }),
  ...both('lard', 'shortening', 'fat', 'solid fat', { note: 'shortening has no pork flavor' }),
  NONE('sesame oil', 'toasted sesame oil is a flavoring, not a cooking fat: another oil gives none of its taste', 'fat', 'flavoring oil'),
  NONE('sesame seed', 'its toasty, nutty taste is the point of the garnish; other seeds add crunch but taste different', 'nut', 'seed'),

  // Stocks, soy and other savory seasonings.
  S('veal stock', 'beef stock', 'liquid', 'stock', { note: 'less gelatin, so a sauce will be thinner: reduce it a little more' }),
  S('veal stock', 'chicken stock', 'liquid', 'stock', { note: 'lighter and less gelatin: reduce it a little more' }),
  FORM('chicken stock', 'chicken bouillon', 'liquid', 'stock', { amountNote: '1 cube or 1 tsp bouillon in 1 cup hot water for each cup of stock', note: 'saltier: go easy on the salt' }),
  S('soy sauce', 'tamari', 'condiment', 'soy sauce', { note: 'rounder and usually wheat-free; coconut aminos are sweeter and much less salty' }),
  S('tamari', 'soy sauce', 'condiment', 'soy sauce', { note: 'a little sharper, and it contains wheat' }),
  NONE('fish sauce', 'its salty, fermented-fish depth is the whole point; soy sauce is sweeter and has none of that funk', 'savory seasoning', 'fish sauce'),
  MAKE('oyster sauce', ['soy sauce', 'sugar', 'cornstarch'], 'condiment', 'oyster sauce', { amountNote: '1 tbsp soy sauce, 1/2 tsp sugar and a pinch of cornstarch for each 1 tbsp oyster sauce', note: 'no oyster flavor' }),
  MAKE('worcestershire sauce', ['soy sauce', 'vinegar', 'sugar'], 'savory seasoning', 'worcestershire', { amountNote: '1 tbsp soy sauce, 1 tsp vinegar and a pinch of sugar for each 1 tbsp' }),
  MAKE('mirin', ['white wine', 'sugar'], 'wine', 'mirin', { amountNote: '1 tbsp white wine and 1/2 tsp sugar for each 1 tbsp mirin' }),
  MAKE('dashi', ['kombu', 'bonito flakes'], 'savory seasoning', 'dashi', { amountNote: 'steep a 4 inch (10 cm) piece of kombu and a handful of bonito flakes in 4 cups hot water for 10 minutes, then strain' }),
  NONE('gochujang', 'a fermented chili, rice and soybean paste: miso with chili is only a rough cousin', 'condiment', 'chili paste'),
  NONE('doubanjiang', 'a fermented broad bean and chili paste: nothing common has its saltiness and depth', 'condiment', 'chili paste'),
  NONE('curry paste', 'a Thai paste is fresh lemongrass, galangal and chilies pounded together; curry powder is a different dish', 'condiment', 'curry paste'),
  MAKE('tamarind', ['lime juice', 'brown sugar'], 'acid', 'tamarind', { amountNote: '1 tbsp lime juice and 1 tsp brown sugar for each 1 tbsp tamarind paste' }),

  // Vinegars and mustards.
  ...both('red wine vinegar', 'white wine vinegar', 'acid', 'vinegar'),
  S('white wine vinegar', 'rice vinegar', 'acid', 'vinegar', { note: 'milder and a little sweeter' }),
  S('vinegar', 'white wine vinegar', 'acid', 'vinegar'),
  S('vinegar', 'apple cider vinegar', 'acid', 'vinegar'),
  FORM('mustard', 'mustard powder', 'condiment', 'mustard', { amountNote: '1 tsp mustard powder mixed with 2 tsp water for each 1 tbsp prepared mustard' }),
  FORM('mustard', 'dijon mustard', 'condiment', 'mustard', { note: 'sharper than yellow mustard; use a little less' }),

  // Chilies and heat.
  S('red chili', 'serrano pepper', 'chili', 'fresh chili', { note: 'green and grassier, about the same heat' }),
  S('red chili', 'jalapeno chile', 'chili', 'fresh chili', { note: 'milder' }),
  S('chili', 'jalapeno chile', 'chili', 'fresh chili', { note: 'milder' }),
  S('chili', 'serrano pepper', 'chili', 'fresh chili', { note: 'hotter' }),
  FORM('red chili', 'chili flake', 'chili', 'fresh chili', { amountNote: '1/4 tsp chili flakes for each small fresh chili', note: 'gives heat but not the fresh flavor' }),
  FORM('chili', 'chili flake', 'chili', 'fresh chili', { amountNote: '1/4 tsp chili flakes for each small fresh chili', note: 'gives heat but not the fresh flavor' }),
  S('cayenne pepper', 'chili flake', 'chili', 'dried chili', { amountNote: '1/2 tsp chili flakes for each 1/4 tsp cayenne', note: 'coarser, so it will not disappear into a smooth sauce' }),
  S('chili flake', 'cayenne pepper', 'chili', 'dried chili', { amountNote: '1/4 tsp cayenne for each 1/2 tsp chili flakes', note: 'hotter and finer' }),
  ...both('ancho chili', 'guajillo chili', 'chili', 'dried chili'),
  MAKE('chili powder', ['paprika', 'cumin', 'cayenne pepper', 'oregano'], 'spice', 'chili powder', { amountNote: 'for 1 tbsp: 2 tsp paprika, 1 tsp cumin, 1/2 tsp cayenne and 1/2 tsp oregano, plus a pinch of garlic powder' }),
  S('paprika', 'smoked paprika', 'spice', 'paprika', { amountNote: 'about half as much smoked paprika as paprika', note: 'smoky' }),
  S('smoked paprika', 'paprika', 'spice', 'paprika', { note: 'no smoke' }),

  // Spices, ground and whole, and blends made from spices.
  FORM('cumin', 'ground cumin', 'spice', 'cumin', { amountNote: '1 tsp ground for each 1 tsp whole seeds', note: 'toast whole seeds first to wake them up' }),
  FORM('coriander', 'ground coriander', 'spice', 'coriander', { amountNote: '1 tsp ground for each 1 tsp whole seeds' }),
  S('coriander', 'coriander seed', 'spice', 'coriander', { note: 'crush the seeds first' }),
  FORM('cinnamon', 'ground cinnamon', 'spice', 'cinnamon', { amountNote: 'about 1/2 tsp ground for each 3 inch stick' }),
  FORM('cinnamon', 'cinnamon stick', 'spice', 'cinnamon', { amountNote: 'one 3 inch stick for about 1/2 tsp ground', note: 'simmer it in a liquid, then take it out' }),
  FORM('nutmeg', 'ground nutmeg', 'spice', 'nutmeg', { amountNote: '1/4 tsp ground for each 1/2 whole nutmeg' }),
  ...both('nutmeg', 'mace', 'spice', 'nutmeg', { note: 'mace is a little more delicate' }),
  FORM('cardamom', 'ground cardamom', 'spice', 'cardamom', { amountNote: 'about 1/8 tsp ground for each pod' }),
  MAKE('allspice', ['cinnamon', 'nutmeg', 'clove'], 'spice', 'allspice', { amountNote: 'for 1 tsp: 1/2 tsp cinnamon, 1/4 tsp nutmeg and 1/4 tsp ground cloves' }),
  MAKE('garam masala', ['cumin', 'coriander', 'cinnamon', 'cardamom'], 'spice', 'spice blend', { amountNote: 'for 1 tsp: 1/2 tsp cumin, 1/4 tsp coriander and 1/8 tsp each of cinnamon and cardamom, with a pinch of black pepper' }),
  MAKE('curry powder', ['turmeric', 'cumin', 'coriander', 'cayenne pepper'], 'spice', 'spice blend', { amountNote: 'for 1 tbsp: 1 tsp each of turmeric, cumin and coriander, and 1/4 tsp cayenne' }),
  NONE('saffron', 'nothing matches its flavor; turmeric gives only the yellow color', 'spice', 'saffron'),
  NONE('turmeric', 'its earthy color and flavor are the job; paprika gives red, not the same taste', 'spice', 'turmeric'),
  NONE('fenugreek', 'its bitter, maple-like note has no common stand-in', 'spice', 'fenugreek'),
  NONE('sichuan peppercorn', 'its numbing tingle is not heat, and black pepper does not do it', 'spice', 'sichuan'),
  FORM('vanilla', 'vanilla extract', 'spice', 'vanilla', { amountNote: '1 tbsp vanilla extract for each vanilla bean' }),

  // Thickeners, baking and the egg family.
  ...both('cornstarch', 'arrowroot', 'thickener', 'starch', { note: 'stir it in at the end: arrowroot goes thin if it boils long or is reheated' }),
  ...both('cornstarch', 'potato starch', 'thickener', 'starch', { note: 'add it off the boil so it does not clump' }),
  NONE('flour', 'flour thickens a roux and gives structure to a dough or batter; no one ingredient does both, and cornstarch only thickens', 'grain', 'flour'),
  MAKE('baking powder', ['baking soda', 'cream of tartar'], 'leavener', 'baking powder', { amountNote: '1/4 tsp baking soda and 1/2 tsp cream of tartar for each 1 tsp baking powder' }),
  NONE('yeast', 'it is what makes bread dough rise and ferment; baking powder cannot do that', 'other', 'yeast'),
  NONE('egg yolk', 'a yolk emulsifies and thickens at once, in a hollandaise or a custard; nothing else does both', 'protein', 'egg'),

  // Rice, noodles and pasta.
  FORM('rice', 'basmati rice', 'grain', 'rice', { note: 'long grain: for a pilaf, a curry or fried rice, not for a risotto or sushi' }),
  FORM('rice', 'jasmine rice', 'grain', 'rice', { note: 'long grain, a little sticky: for a stir-fry or a curry, not for a risotto or sushi' }),
  FORM('rice', 'arborio rice', 'grain', 'rice', { note: 'short grain and creamy: right for a risotto, too soft for a pilaf' }),
  ...both('rice noodle', 'rice vermicelli', 'grain', 'rice noodle', { note: 'thinner: soak it for less time' }),

  // Meat, fish and eggs. A cut or a kind is swapped only for another that cooks the same way.
  FORM('chicken', 'chicken thigh', 'protein', 'chicken', { note: 'juicier than breast: give it a few more minutes' }),
  FORM('chicken', 'chicken breast', 'protein', 'chicken', { note: 'leaner: cook it a little less so it stays moist' }),
  FORM('pork', 'pork shoulder', 'protein', 'pork', { note: 'for a stew, a braise or pulled pork: it needs slow cooking' }),
  FORM('pork', 'pork loin', 'protein', 'pork', { note: 'for a quick roast or a chop: leaner, so it dries out if braised' }),
  FORM('beef', 'beef chuck', 'protein', 'beef', { note: 'for a stew or a braise: it needs slow cooking' }),
  FORM('beef', 'ground beef', 'protein', 'beef', { note: 'for a sauce, a patty or a filling' }),
  ...both('shrimp', 'prawn', 'protein', 'shrimp'),
  ...both('salmon', 'trout', 'protein', 'oily fish', { note: 'trout is milder and a little leaner' }),
  S('white fish', 'cod', 'protein', 'white fish', { note: 'firm and mild' }),
  FORM('bacon', 'pancetta', 'protein', 'bacon', { note: 'cured but not smoked; add a pinch of smoked paprika for the smoke' }),
  NONE('lamb', 'its flavor is the point of a lamb dish; beef or pork would change the dish rather than stand in', 'protein', 'lamb'),
  ...both('chickpea', 'cannellini bean', 'protein', 'bean', { note: 'fine in a stew or a salad; not in falafel or hummus' }),

  // Milk, cream and cheese.
  MAKE('milk', ['evaporated milk', 'water'], 'dairy', 'milk', { amountNote: '1/2 cup evaporated milk and 1/2 cup water for each cup of milk' }),
  S('coconut milk', 'coconut cream', 'liquid', 'coconut', { amountNote: 'thin it with an equal amount of water', note: 'richer' }),
  ...both('gruyere', 'swiss cheese', 'dairy', 'swiss-style cheese', { note: 'milder and less nutty' }),
  S('ricotta', 'cottage cheese', 'dairy', 'fresh cheese', { note: 'drain it, and blend it smooth for a baked dish' }),

  // Nuts, seeds and the rest of the produce.
  S('peanut', 'cashew', 'nut', 'nut', { note: 'milder and creamier, less roasty' }),
  S('peanut', 'almond', 'nut', 'nut', { note: 'milder, less roasty' }),
  ...both('walnut', 'pecan', 'nut', 'nut', { note: 'pecan is sweeter' }),
  S('pine nut', 'walnut', 'nut', 'nut', { note: 'more bitter: toast it lightly' }),
  S('pine nut', 'almond', 'nut', 'nut', { note: 'blanched almonds are the milder choice' }),
  ...both('almond', 'cashew', 'nut', 'nut', { note: 'softer and creamier' }),
  ...both('carrot', 'parsnip', 'vegetable', 'root', { note: 'parsnip is sweeter and nuttier' }),
  FORM('celery', 'celery seed', 'vegetable', 'celery', { amountNote: '1/4 tsp celery seed for each stalk', note: 'gives the flavor but not the crunch' }),
  S('spinach', 'chard', 'vegetable', 'leafy green', { note: 'sturdier: cook it a little longer' }),
  S('chard', 'spinach', 'vegetable', 'leafy green', { note: 'more tender: it needs less time' }),
  S('spinach', 'kale', 'vegetable', 'leafy green', { note: 'tougher: strip the stems and cook it longer' }),
  S('eggplant', 'zucchini', 'vegetable', 'squash', { note: 'less creamy and quicker to cook' }),
  ...both('sweet pepper', 'green pepper', 'vegetable', 'bell pepper', { note: 'green is more bitter' }),
  ...both('apple', 'pear', 'fruit', 'pome', { note: 'pear is softer and cooks faster' }),
  NONE('cucumber', 'its cool, watery crunch is the job, and nothing common matches it', 'vegetable', 'cucumber'),
  NONE('avocado', 'its creamy, mild fat is the point; nothing else mashes or slices like it', 'vegetable', 'avocado'),
  NONE('bean sprout', 'a crisp, watery crunch: cabbage or carrot gives crunch but not the same', 'vegetable', 'sprout'),

  // Sweeteners and chocolate; wine in cooking.
  S('sugar', 'brown sugar', 'sweetener', 'sweet', { note: 'a little molasses flavor, and moister' }),
  MAKE('brown sugar', ['sugar', 'molasses'], 'sweetener', 'sweet', { amountNote: '1 tbsp molasses for each 1 cup of sugar' }),
  MAKE('chocolate', ['cocoa', 'butter'], 'confection', 'chocolate', { amountNote: '3 tbsp cocoa and 1 tbsp butter for each 1 oz unsweetened chocolate; add 1 tbsp sugar for semisweet' }),
  MAKE('white wine', ['chicken stock', 'white wine vinegar'], 'wine', 'wine', { amountNote: '1/2 cup stock and 1 tsp white wine vinegar for each 1/2 cup wine', note: 'in a pan sauce or a risotto; not in a drink' }),
  MAKE('red wine', ['grape juice', 'red wine vinegar'], 'wine', 'wine', { amountNote: '1 cup red grape juice and 1 tbsp red wine vinegar for each cup of wine', note: 'sweeter and with no tannin: fine for a quick pan sauce, thin in a long braise' }),
];

const kindOf = (s) => s.type || 'swap';
/** Every entry of every kind (the shopping sheet reads this). */
export const STAND_INS = TABLE;
/** The swap-kind entries only: the recipe side's table, and what the strictness tests check. */
export const SWAPS = TABLE.filter((s) => kindOf(s) === 'swap');

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const group = (list) => {
  const by = new Map();
  for (const s of list) {
    const k = norm(s.for);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(s);
  }
  return by;
};
const BY_FOR = group(SWAPS);
const ALL_BY_FOR = group(STAND_INS);

/** Every SWAP for one recipe item (table order). The recipe side's lookup: never a form, a make or a none. */
export function swapsFor(name) {
  return BY_FOR.get(norm(name)) || [];
}

/** Every stand-in of every kind for one item (table order). The shopping sheet's lookup. */
export function standInsFor(name) {
  return ALL_BY_FOR.get(norm(name)) || [];
}

/** 'swap' | 'form' | 'make' | 'none' */
export const standInKind = kindOf;

/**
 * The first swap from the table the kitchen can make for one missing item.
 *
 * @param {string} name — the recipe's item
 * @param {(item: string) => boolean} has — does the kitchen cover an item
 *   (directly, by an equivalent, or as an assumed basic)? No swaps inside.
 * @param {{ main?: boolean, inRecipe?: Set<string>, sauce?: boolean }} opts
 *   main — the item is a main of this recipe (drops `supportingOnly` swaps);
 *   inRecipe — items the recipe already uses (they cannot double up);
 *   sauce — only swaps that hold in a sauce.
 * @returns {{ for: string, use: string, plus: string[], role: string, kind: string } | null}
 */
export function findSwap(name, has, { main = false, inRecipe = new Set(), sauce = false } = {}) {
  for (const s of swapsFor(name)) {
    if (main && s.supportingOnly) continue;
    if (sauce && s.sauce === false) continue;
    if (inRecipe.has(norm(s.use)) || !isSuggestable(s.use)) continue;
    if (!has(s.use) || !s.plus.every(has)) continue;
    return { for: name, use: s.use, plus: [...s.plus], role: s.role, kind: s.kind };
  }
  return null;
}

/** "your onion" · "your milk and butter" */
export function swapUseText(swap) {
  if (!swap) return '';
  const items = [swap.use, ...(swap.plus || [])];
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
