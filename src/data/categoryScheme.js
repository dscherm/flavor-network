/**
 * categoryScheme.js (DATA-4). The ingredient category scheme, written down once: every category an
 * ingredient may have, what it means, and three examples. docs/data-quality.md is generated from this
 * list (scripts/auditData.mjs), and src/data/__tests__/categoryScheme.test.js checks the curated data
 * against it: no ingredient has a category outside the list, every example really is in its category,
 * and every category has a glyph, a unit dimension and a fallback taste colour.
 *
 * Decisions that are not obvious from the names:
 *   - citrus juices (lemon, lime, orange, grapefruit, yuzu) stay in `citrus`, not `juice`: the cocktail
 *     sour slot and the sauce acid slot read that category and must keep finding lemon and lime juice.
 *   - vermouth stays in `liqueur`: the bar and the cocktail slots treat it as a liqueur-shelf modifier.
 *   - every flour is `grain` (cornstarch, arrowroot starch and gelatin stay `thickener`).
 *   - every cheese is `dairy`; ginger beer and root beer are `mixer`; apple cider is a `juice`.
 */
export const CATEGORY_SCHEME = [
  { category: 'protein', definition: 'meat, poultry, fish and shellfish, eggs, tofu and other protein foods', examples: ['egg', 'chicken', 'beef'] },
  { category: 'vegetable', definition: 'vegetables, mushrooms and legumes eaten as the body of a dish', examples: ['tomato', 'carrot', 'potato'] },
  { category: 'fruit', definition: 'fruit other than citrus, fresh or dried', examples: ['apple', 'banana', 'peach'] },
  { category: 'citrus', definition: 'citrus fruit, its zest and its juice (the sour of a drink or a sauce)', examples: ['lemon', 'lime juice', 'orange juice'] },
  { category: 'dairy', definition: 'milk, cream, butter-fat dairy, yogurt and every cheese', examples: ['milk', 'cream cheese', 'parmesan'] },
  { category: 'grain', definition: 'grains, rice, pasta, bread crumb and every flour', examples: ['rice', 'flour', 'bread'] },
  { category: 'baked', definition: 'finished bakery goods and crackers', examples: ['cake', 'graham cracker', 'vanilla wafer'] },
  { category: 'confection', definition: 'chocolate, candy, puddings and ice cream', examples: ['chocolate', 'vanilla ice cream', 'butterscotch chip'] },
  { category: 'sweetener', definition: 'sugars, syrups and honey', examples: ['sugar', 'honey', 'maple syrup'] },
  { category: 'fat', definition: 'cooking oils and fats', examples: ['butter', 'olive oil', 'sesame oil'] },
  { category: 'nut', definition: 'nuts, seeds and nut butters', examples: ['pecan', 'walnut', 'almond'] },
  { category: 'herb', definition: 'leafy herbs, fresh or dried', examples: ['parsley', 'basil', 'thyme'] },
  { category: 'spice', definition: 'dried spices and spice blends', examples: ['cinnamon', 'cumin', 'paprika'] },
  { category: 'seasoning', definition: 'salts and salt-and-spice seasonings', examples: ['garlic salt', 'lemon pepper', 'celery salt'] },
  { category: 'aromatic', definition: 'onions, garlic, ginger and their kin, the flavor base of a dish', examples: ['onion', 'garlic', 'ginger'] },
  { category: 'chili', definition: 'fresh and dried chili peppers', examples: ['cayenne pepper', 'jalapeño', 'chili'] },
  { category: 'condiment', definition: 'prepared sauces, pastes, pickles and spreads', examples: ['mustard', 'mayonnaise', 'soy sauce'] },
  { category: 'savory seasoning', definition: 'concentrated umami seasonings: fish sauce, worcestershire, bouillon, miso, anchovy (the old "umami" category)', examples: ['fish sauce', 'worcestershire sauce', 'chicken bouillon'] },
  { category: 'acid', definition: 'vinegars and other cooking sours', examples: ['vinegar', 'balsamic vinegar', 'rice vinegar'] },
  { category: 'thickener', definition: 'starches and setting agents (not flour)', examples: ['cornstarch', 'gelatin', 'cornflour'] },
  { category: 'liquid', definition: 'stocks, soups, plant milks and other cooking liquids that are not a juice, wine or beer', examples: ['chicken stock', 'coconut milk', 'tomato soup'] },
  { category: 'juice', definition: 'fruit and vegetable juices and nectars (citrus juices are in citrus)', examples: ['pineapple juice', 'tomato juice', 'apple cider'] },
  { category: 'wine', definition: 'still, sparkling and fortified wine, sake, mirin and cooking wine (vermouth is in liqueur)', examples: ['white wine', 'sake', 'port wine'] },
  { category: 'beer', definition: 'beer, ale, stout, lager and hard cider', examples: ['beer', 'stout beer', 'lager beer'] },
  { category: 'spirit', definition: 'distilled spirits', examples: ['rum', 'bourbon', 'tequila'] },
  { category: 'liqueur', definition: 'liqueurs, cordials and vermouth', examples: ['triple sec', 'kahlua', 'sweet vermouth'] },
  { category: 'mixer', definition: 'sodas and other non-alcoholic bar mixers', examples: ['ginger ale', 'tonic water', 'ginger beer'] },
  { category: 'bitters', definition: 'cocktail bitters', examples: ['angostura bitters', 'orange bitters', 'gentian'] },
  { category: 'other', definition: 'anything that fits nowhere else (yeast, powders, non-food leftovers)', examples: ['yeast', 'protein powder', 'corn husk'] },
];

export const SCHEME_CATEGORIES = new Set(CATEGORY_SCHEME.map((c) => c.category));
