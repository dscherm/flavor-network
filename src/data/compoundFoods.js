/**
 * compoundFoods.js — synthesize aroma profiles for compound foods that
 * the GNN has no direct prediction for, using weighted aggregation of
 * their constituent ingredients' GNN predictions.
 *
 * The motivation: ingredients like mayonnaise, garam masala, ranch
 * dressing aren't single molecules — they're recipes-of-other-
 * ingredients. The GNN trained on FooDB compound chemistry has no
 * prediction for them and never will. But the user still expects an
 * aroma profile when they tap "mayonnaise" in the catalog.
 *
 * Approach: declare each compound food's constituent breakdown by
 * weight (totaling ~1.0). At runtime, look up each constituent's GNN
 * prediction, drop missing constituents, renormalize, and weighted-sum
 * the remaining probability vectors. Tag the resulting profile with
 * `gnnProbsSource = 'compound'` so the UI can badge it as
 * "Predicted from components" rather than letting users assume it's a
 * direct molecular prediction.
 *
 * Coverage gate: a compound food only synthesizes if the available
 * constituents represent ≥50% of the declared weight. Otherwise we
 * leave the profile null and the UI shows the standard "no aroma data"
 * empty state.
 */

// Substitute table — when a constituent isn't in the GNN data, fall back
// to a flavor-similar ingredient that IS. Verified against the current
// gnn_entropy.json. Substitutions are applied BEFORE the coverage gate
// so a compound food with an obvious alternative still synthesizes.
const SUBSTITUTES = {
  'vegetable oil': 'sunflower oil',   // both neutral, fat-dominant
  'egg': 'egg yolk',                   // yolk carries the flavor signal
  'black pepper': 'peppercorn',        // same ingredient, different name
  'whole milk': 'milk',
  'heavy cream': 'cream',
  // R14 Phase 3 additions — constituents we use in spice blends and
  // sauces below that don't themselves have GNN predictions. Each
  // alias picks the closest GNN-having neighbor in flavor space.
  'cilantro': 'coriander',             // same plant, leaf vs. seed
  'cloves': 'allspice',                // both warm pungent baking spices
  'clove': 'allspice',
  'paprika': 'red chili pepper',       // dried mild chile
  'smoked paprika': 'red chili pepper',
  'mirin': 'sake',                     // both rice wines
  'galangal': 'ginger',                // botanical cousin
  'chipotle': 'red chili pepper',      // smoked jalapeño
  'molasses': 'brown sugar',           // brown sugar is sugar + molasses
  'sumac': 'lemon juice',              // sour/citrusy stand-in
  'bay leaf': 'allspice',              // warm aromatic — closest available
  'caraway': 'caraway seed',
  // CulinaryDB import — constituents used in the Indian/Mexican spice
  // blends added below. Each falls back to the closest GNN-having
  // ingredient by aroma family.
  'cayenne': 'red chili pepper',       // ground cayenne ≈ generic dried chile
  'mace': 'nutmeg',                    // mace is the aril around nutmeg
  'bay laurel': 'allspice',            // same plant family as bay leaf
  'corriander': 'coriander',           // CulinaryDB typo
  'pepper black': 'peppercorn',        // word order
  'pepper white': 'peppercorn',
  'white pepper': 'peppercorn',
  'bayleaf': 'allspice',               // CulinaryDB spelling
  'lavendar': 'lavender',              // CulinaryDB spelling
  'asafoetida': 'fennel seed',         // sulfurous-savory; fennel is closest
  'pigeon pea': 'lentil',              // both pulses
  'curry leaf': 'lemon zest',          // citrus-leafy aroma
  'fenugreek': 'cumin',                // earthy-bitter
  'cassia': 'cinnamon',                // cassia IS the most common 'cinnamon'
  'nigella seed': 'caraway seed',      // earthy seed
  'sichuan peppercorn': 'peppercorn',
  'star anise': 'fennel seed',         // both have anethole
  'black salt': 'salt',
  'baking powder': 'baking soda',
  'tomato paste': 'tomato',
  'tomato puree': 'tomato',
  'cheese cream': 'cream cheese',
  'soybean': 'soy sauce',              // closest GNN entry
  'pork': 'bacon',                     // bacon carries the pork signal
  'ham': 'bacon',
  'eggs': 'egg yolk',
  'capsicum': 'red bell pepper',
  'shortening': 'butter',
  'wheat': 'flour',
  'beer': 'beer',                      // ensure stays mapped
  'hops beer': 'beer',
};

export const COMPOUND_FOODS = {
  // ---- Emulsions ----
  mayonnaise: {
    constituents: { 'egg yolk': 0.5, 'vegetable oil': 0.4, 'vinegar': 0.05, 'mustard': 0.05 },
    description: 'egg yolk emulsified in oil',
  },
  mayo: { aliasOf: 'mayonnaise' },

  // ---- Dressings ----
  'italian dressing': {
    constituents: { 'olive oil': 0.55, 'vinegar': 0.25, 'oregano': 0.07, 'garlic': 0.05, 'basil': 0.05, 'parsley': 0.03 },
    description: 'oil + vinegar + Italian herbs',
  },
  'ranch dressing': {
    constituents: { 'mayonnaise': 0.5, 'buttermilk': 0.35, 'parsley': 0.05, 'garlic': 0.05, 'dill': 0.05 },
    description: 'mayo–buttermilk base with herbs',
  },
  'caesar dressing': {
    constituents: { 'olive oil': 0.45, 'egg yolk': 0.2, 'parmesan': 0.15, 'anchovy': 0.1, 'lemon juice': 0.05, 'garlic': 0.05 },
    description: 'oil-egg emulsion with anchovy + parmesan',
  },

  // ---- Spice blends ----
  'garam masala': {
    constituents: {
      'cumin': 0.2, 'coriander': 0.2, 'cardamom': 0.15, 'cinnamon': 0.15,
      'nutmeg': 0.1, 'black pepper': 0.1, 'bay leaf': 0.05, 'ginger': 0.05,
    },
    description: 'warm Indian spice blend',
  },

  // ---- Single ingredients hidden behind FooDB name misses ----
  // These are technically NOT compound foods, but the same synthesis
  // mechanism gets us a reasonable profile while we wait for proper
  // alias-expansion in the embed_ingredients matcher (separate work
  // item per .claude/.chemdataset-status.md).
  tahini: {
    constituents: { 'sesame oil': 0.7, 'sesame seed': 0.3 },
    description: 'sesame seed paste',
  },

  // ─────────────────────────────────────────────────────────────
  // R14 Phase 3 — extended coverage. All target ingredients verified
  // present in the catalog and confirmed to lack a direct GNN
  // prediction (`gnn_entropy.json`). Constituents picked from the
  // 64-name pool that DOES have GNN predictions, with substitutions
  // declared above for cilantro/cloves/paprika/etc.
  // ─────────────────────────────────────────────────────────────

  // ---- More dressings ----
  'french dressing': {
    constituents: {
      'olive oil': 0.4, 'apple cider vinegar': 0.2, 'tomato': 0.1,
      'sugar': 0.1, 'paprika': 0.1, 'mustard': 0.05, 'garlic': 0.05,
    },
    description: 'sweet-tangy oil + vinegar with paprika',
  },

  // ---- Spice blends ----
  'cajun spice': {
    constituents: {
      'paprika': 0.25, 'red chili pepper': 0.15, 'peppercorn': 0.15,
      'thyme': 0.15, 'oregano': 0.1, 'onion': 0.1, 'garlic': 0.1,
    },
    description: 'paprika, cayenne, garlic, thyme — Louisiana style',
  },
  'cajun spice mix': { aliasOf: 'cajun spice' },

  'chinese five-spice': {
    constituents: {
      'star anise': 0.25, 'cloves': 0.2, 'cinnamon': 0.2,
      'sichuan peppercorn': 0.2, 'fennel seed': 0.15,
    },
    description: 'star anise, cloves, cinnamon, Sichuan peppercorn, fennel',
  },
  'chinese five spice powder': { aliasOf: 'chinese five-spice' },
  'five-spice powder': { aliasOf: 'chinese five-spice' },

  'jerk spice': {
    constituents: {
      'allspice': 0.25, 'thyme': 0.15, 'red chili pepper': 0.15,
      'peppercorn': 0.1, 'cinnamon': 0.1, 'nutmeg': 0.1,
      'ginger': 0.1, 'garlic': 0.05,
    },
    description: 'Jamaican allspice, thyme, scotch bonnet, warm spice',
  },

  "za'atar spice mix": {
    constituents: {
      'thyme': 0.3, 'sesame seed': 0.25, 'oregano': 0.15,
      'marjoram': 0.1, 'sumac': 0.1, 'olive oil': 0.1,
    },
    description: 'thyme, sesame, sumac, oregano — Levantine',
  },

  // ---- Curry pastes ----
  'curry paste': {
    constituents: {
      'cumin': 0.2, 'coriander': 0.2, 'red chili pepper': 0.15,
      'turmeric': 0.1, 'ginger': 0.1, 'garlic': 0.1,
      'cardamom': 0.1, 'cinnamon': 0.05,
    },
    description: 'cumin, coriander, chili, turmeric, ginger',
  },
  'thai green curry paste': {
    constituents: {
      'red chili pepper': 0.25, 'lemongrass': 0.2, 'cilantro': 0.1,
      'kaffir lime': 0.1, 'fish sauce': 0.1, 'garlic': 0.1,
      'shallot': 0.1, 'lime juice': 0.05,
    },
    description: 'green chile, lemongrass, kaffir lime, cilantro, fish sauce',
  },
  'thai red curry paste': {
    constituents: {
      'red chili pepper': 0.35, 'lemongrass': 0.15, 'kaffir lime': 0.1,
      'fish sauce': 0.1, 'cumin': 0.1, 'coriander': 0.1,
      'garlic': 0.05, 'shallot': 0.05,
    },
    description: 'red chile, lemongrass, kaffir lime, fish sauce',
  },

  // ---- Salsas + chili pastes ----
  'green chile salsa': {
    constituents: {
      'red chili pepper': 0.5, 'onion': 0.2,
      'cilantro': 0.1, 'lime juice': 0.1, 'garlic': 0.1,
    },
    description: 'green chile, onion, cilantro, lime',
  },
  'harissa paste': {
    constituents: {
      'red chili pepper': 0.45, 'cumin': 0.15, 'coriander': 0.1,
      'caraway': 0.1, 'garlic': 0.1, 'olive oil': 0.05,
      'lemon juice': 0.05,
    },
    description: 'North African chili paste with cumin + coriander + caraway',
  },
  'harissa spice': { aliasOf: 'harissa paste' },

  'gochujang': {
    constituents: {
      'red chili pepper': 0.4, 'miso': 0.3, 'sugar': 0.15, 'rice vinegar': 0.15,
    },
    description: 'fermented Korean chili paste',
  },
  'hoisin': {
    constituents: {
      'soybean': 0.35, 'sugar': 0.2, 'sesame oil': 0.15,
      'rice vinegar': 0.1, 'garlic': 0.1, 'red chili pepper': 0.1,
    },
    description: 'sweet-savory soybean paste with sesame',
  },

  // ─────────────────────────────────────────────────────────────
  // CulinaryDB ingest (commit 15c5f8a follow-up) — curated subset of
  // 103 compound ingredients from CulinaryDB's
  // 03_Compound_Ingredients.csv. Filtered out: animal-species
  // aggregations (bear, whale, tuna — these need an alias mechanism,
  // not compound synthesis), self-referential entries (ketchup
  // contains 'ketchup'), and trivially-redundant items (tomato paste
  // is mostly tomato). Constituent typos and word-order variants
  // ('pepper black' → 'peppercorn', 'corriander' → 'coriander') are
  // mapped via SUBSTITUTES above. Weights equal-distributed within
  // each entry per CulinaryDB's source.
  // ─────────────────────────────────────────────────────────────

  // ---- Indian spice blends ----
  'ginger garlic paste': {
    constituents: { 'ginger': 0.5, 'garlic': 0.5 },
    description: 'aromatic Indian aromatic base',
  },
  'chaat masala': {
    constituents: {
      'asafoetida': 0.08, 'mango': 0.08, 'black salt': 0.08, 'cayenne': 0.08,
      'garlic': 0.08, 'ginger': 0.08, 'sesame seed': 0.08, 'turmeric': 0.08,
      'coriander': 0.08, 'bay laurel': 0.08, 'anise': 0.08, 'fennel': 0.08,
    },
    description: 'tangy Indian chaat spice — mango, cumin, black salt',
  },
  'sambar powder': {
    constituents: {
      'pigeon pea': 0.11, 'coriander': 0.11, 'cumin': 0.11, 'black pepper': 0.11,
      'cayenne': 0.11, 'ginger': 0.11, 'fenugreek': 0.11, 'turmeric': 0.11,
    },
    description: 'South Indian sambar blend',
  },
  'rasam powder': {
    constituents: {
      'cayenne': 0.17, 'pigeon pea': 0.17, 'cumin': 0.17,
      'coriander': 0.17, 'black pepper': 0.17, 'curry leaf': 0.17,
    },
    description: 'tamarind-soup spice base',
  },
  'tandoori masala': {
    constituents: {
      'garlic': 0.1, 'ginger': 0.1, 'clove': 0.1, 'nutmeg': 0.1, 'mace': 0.1,
      'cumin': 0.1, 'coriander': 0.1, 'fenugreek': 0.1, 'cinnamon': 0.1, 'cardamom': 0.1,
    },
    description: 'tandoori-grill spice blend',
  },
  'curry powder': {
    constituents: {
      'cardamom': 0.07, 'cayenne': 0.07, 'cinnamon': 0.07, 'clove': 0.07,
      'coriander': 0.07, 'cumin': 0.07, 'fennel': 0.07, 'fenugreek': 0.07,
      'mace': 0.07, 'nutmeg': 0.07, 'black pepper': 0.07,
      'saffron': 0.07, 'tamarind': 0.07, 'turmeric': 0.07,
    },
    description: 'British-style curry blend',
  },
  'panch phoron': {
    constituents: {
      'fenugreek': 0.25, 'nigella seed': 0.25, 'cumin': 0.25, 'fennel seed': 0.25,
    },
    description: 'Bengali five-seed blend',
  },
  'panch pharon seed': { aliasOf: 'panch phoron' },
  'goda masala': {
    constituents: {
      'cardamom': 0.1, 'cinnamon': 0.1, 'clove': 0.1, 'bay laurel': 0.1,
      'sesame seed': 0.1, 'coriander': 0.1, 'coconut': 0.1, 'cassia': 0.1,
      'white pepper': 0.1, 'black pepper': 0.1,
    },
    description: 'Maharashtrian sweet-warm spice blend',
  },
  'pulao masala': {
    constituents: {
      'black pepper': 0.14, 'white pepper': 0.14, 'clove': 0.14, 'cumin': 0.14,
      'cinnamon': 0.14, 'cardamom': 0.14, 'coriander': 0.14,
    },
    description: 'rice-pilaf spice blend',
  },
  'dabeli masala': {
    constituents: {
      'cayenne': 0.2, 'coriander': 0.2, 'cinnamon': 0.2, 'clove': 0.2, 'cumin': 0.2,
    },
    description: 'Gujarati street-snack spice',
  },
  'green chutney': {
    constituents: { 'coriander': 0.4, 'cumin': 0.2, 'lemon juice': 0.2, 'cayenne': 0.2 },
    description: 'cilantro-mint Indian chutney',
  },

  // ---- Western spice mixes ----
  'italian seasoning': {
    constituents: { 'basil': 0.25, 'oregano': 0.25, 'rosemary': 0.25, 'thyme': 0.25 },
    description: 'Italian dried herb blend',
  },
  'creole seasoning': {
    constituents: {
      'onion': 0.1, 'peppercorn': 0.1, 'garlic': 0.1, 'pepper white': 0.1,
      'oregano': 0.1, 'cayenne': 0.1, 'basil': 0.1, 'capsicum': 0.1,
      'thyme': 0.1, 'salt': 0.1,
    },
    description: 'Louisiana Creole spice blend',
  },
  'old bay seasoning': {
    constituents: {
      'bay laurel': 0.07, 'celery': 0.07, 'salt': 0.07, 'mustard': 0.07,
      'peppercorn': 0.07, 'ginger': 0.07, 'capsicum': 0.07, 'pepper white': 0.07,
      'nutmeg': 0.07, 'clove': 0.07, 'allspice': 0.07, 'cayenne': 0.07,
      'mace': 0.07, 'cardamom': 0.07, 'cinnamon': 0.07,
    },
    description: 'Maryland seafood spice blend',
  },
  'poultry seasoning': {
    constituents: {
      'sage': 0.17, 'thyme': 0.17, 'marjoram': 0.17,
      'rosemary': 0.17, 'nutmeg': 0.17, 'peppercorn': 0.17,
    },
    description: 'sage-thyme poultry rub',
  },
  'herbes de provence': {
    constituents: {
      'rosemary': 0.1, 'lavendar': 0.1, 'fennel': 0.1, 'parsley': 0.1,
      'savory winter': 0.1, 'oregano': 0.1, 'thyme': 0.1, 'tarragon': 0.1,
      'basil': 0.1, 'marjoram': 0.05, 'bay laurel': 0.05,
    },
    description: 'Provençal dried herb blend',
  },
  'herbe de provence': { aliasOf: 'herbes de provence' },

  // ---- Sauces and prepared ----
  'tandoori paste': {
    constituents: {
      'garlic': 0.08, 'ginger': 0.08, 'clove': 0.08, 'nutmeg': 0.08,
      'mace': 0.08, 'cumin': 0.08, 'coriander': 0.08, 'fenugreek': 0.08,
      'cinnamon': 0.08, 'cardamom': 0.08, 'black pepper': 0.08,
      'yogurt': 0.04, 'lime juice': 0.04,
    },
    description: 'tandoori spice paste with yogurt + lime',
  },
  'worcestershire sauce': {
    constituents: {
      'cider vinegar': 0.2, 'soy sauce': 0.15, 'sugar': 0.15, 'ginger': 0.1,
      'mustard': 0.1, 'onion': 0.1, 'garlic': 0.05, 'cinnamon': 0.05,
      'peppercorn': 0.1,
    },
    description: 'fermented umami sauce',
  },
  'barbeque sauce': {
    constituents: {
      'vinegar': 0.15, 'tomato': 0.25, 'tomato paste': 0.1, 'mayonnaise': 0.1,
      'liquid smoke': 0.05, 'onion': 0.1, 'mustard': 0.1, 'peppercorn': 0.05,
      'sugar': 0.1,
    },
    description: 'tomato-vinegar BBQ sauce',
  },
  'bbq sauce': { aliasOf: 'barbeque sauce' },
  'hot sauce': {
    constituents: { 'cayenne': 0.6, 'salt': 0.2, 'vinegar': 0.2 },
    description: 'fermented chile-vinegar',
  },
  'adobo sauce': {
    constituents: {
      'cayenne': 0.25, 'garlic': 0.2, 'cider vinegar': 0.2,
      'salt': 0.1, 'sugar': 0.1, 'cumin': 0.15,
    },
    description: 'Mexican adobo chile sauce',
  },
  'apple sauce': {
    constituents: { 'apple': 0.75, 'lemon juice': 0.15, 'sugar': 0.1 },
    description: 'cooked apple purée',
  },
  'applesauce': { aliasOf: 'apple sauce' },
  'hoisin sauce': { aliasOf: 'hoisin' },

  // ---- Stocks / broths ----
  'vegetable broth': {
    constituents: {
      'onion': 0.2, 'carrot': 0.2, 'celery': 0.15, 'shallot': 0.15,
      'sage': 0.15, 'mushroom': 0.15,
    },
    description: 'aromatic vegetable broth',
  },
  'vegetable stock': {
    constituents: {
      'onion': 0.15, 'carrot': 0.15, 'celery': 0.15, 'thyme': 0.1,
      'bay laurel': 0.1, 'peppercorn': 0.05, 'tomato': 0.15, 'garlic': 0.15,
    },
    description: 'savory vegetable stock',
  },

  // ---- Dishes / dairy / breads ----
  'half and half': {
    constituents: { 'milk': 0.5, 'cream': 0.5 },
    description: 'half cream + half milk',
  },
  'half half': { aliasOf: 'half and half' },
  'mascarpone': {
    constituents: { 'cream': 0.85, 'lemon juice': 0.1, 'vinegar': 0.05 },
    description: 'soft Italian cream cheese',
  },
  'coleslaw': {
    constituents: {
      'cabbage': 0.45, 'vinegar': 0.1, 'oil': 0.1, 'salt': 0.05,
      'mayonnaise': 0.25, 'egg': 0.05,
    },
    description: 'cabbage-mayo slaw',
  },
  'fettuccine': {
    constituents: { 'flour': 0.7, 'eggs': 0.3 },
    description: 'fresh egg pasta',
  },
  'vermicelli': {
    constituents: { 'flour': 0.85, 'salt': 0.05, 'water': 0.1 },
    description: 'thin wheat noodles',
  },
  'sponge cake': {
    constituents: {
      'flour': 0.3, 'butter': 0.2, 'sugar': 0.2, 'egg': 0.25, 'baking powder': 0.05,
    },
    description: 'butter-egg-sugar cake',
  },
  'croissant': {
    constituents: { 'flour': 0.5, 'butter': 0.4, 'yeast': 0.1 },
    description: 'laminated butter pastry',
  },
  'puff pastry': {
    constituents: { 'flour': 0.6, 'butter': 0.4 },
    description: 'laminated butter pastry',
  },
  'self rising flour': {
    constituents: { 'flour': 0.92, 'salt': 0.03, 'baking powder': 0.05 },
    description: 'flour + leaveners pre-mixed',
  },
  'pancetta': {
    constituents: { 'pork': 0.9, 'peppercorn': 0.05, 'salt': 0.05 },
    description: 'cured Italian pork belly',
  },
  'prosciutto': {
    constituents: { 'ham': 1 },
    description: 'dry-cured ham',
  },
  'pita bread': {
    constituents: { 'flour': 0.85, 'salt': 0.05, 'yeast': 0.1 },
    description: 'flatbread',
  },
  'cornbread': {
    constituents: { 'corn': 0.4, 'flour': 0.3, 'butter': 0.15, 'egg': 0.15 },
    description: 'corn-flour quickbread',
  },
  'oat bread': {
    constituents: { 'oat': 0.5, 'flour': 0.4, 'yeast': 0.1 },
    description: 'oat bread',
  },
  'multigrain bread': {
    constituents: { 'flour': 0.4, 'oat': 0.3, 'flax seed': 0.2, 'yeast': 0.1 },
    description: 'mixed-grain bread',
  },
  'raisin bread': {
    constituents: { 'flour': 0.6, 'raisin': 0.3, 'yeast': 0.1 },
    description: 'sweet raisin loaf',
  },

  // ---- Dried fruit mixes ----
  'dried mixed fruit': {
    constituents: { 'raisin': 0.3, 'apricot': 0.2, 'date': 0.2, 'currant': 0.15, 'fig': 0.15 },
    description: 'mixed dried fruit',
  },
  'candied mixed fruit': {
    constituents: { 'raisin': 0.25, 'apricot': 0.2, 'date': 0.2, 'currant': 0.1, 'fig': 0.1, 'sugar': 0.15 },
    description: 'sugar-glazed dried fruit',
  },
  'gulkand': {
    constituents: { 'rose': 0.6, 'sugar': 0.4 },
    description: 'rose-petal preserve',
  },

  // ---- Hibiscus tea / drinks ----
  'hibiscus tea': {
    constituents: { 'tea': 0.85, 'sugar': 0.15 },
    description: 'tart floral tea',
  },
};

/**
 * Synthesize an aroma profile for a compound food from its constituents.
 *
 * @param {string} name — compound food name (e.g. "mayonnaise")
 * @param {Map<string, {gnnProbs?: Record<string, number>}>} nodes — graph nodes
 * @returns {null | { probs: Record<string, number>, source: 'compound', constituents: string[], description: string, coverage: number }}
 */
export function synthesizeCompoundProfile(name, nodes) {
  const def = COMPOUND_FOODS[name];
  if (!def) return null;
  if (def.aliasOf) return synthesizeCompoundProfile(def.aliasOf, nodes);

  const consts = def.constituents;
  let availableWeight = 0;
  let totalWeight = 0;
  const sumProbs = {};

  for (const [cName, weight] of Object.entries(consts)) {
    totalWeight += weight;
    const lookup = SUBSTITUTES[cName] || cName;
    const cNode = nodes.get(lookup);
    const probs = cNode?.gnnProbs;
    if (!probs) continue;
    availableWeight += weight;
    for (const [task, p] of Object.entries(probs)) {
      sumProbs[task] = (sumProbs[task] || 0) + p * weight;
    }
  }

  // Gate: need ≥50% constituent coverage to publish a profile.
  if (availableWeight / totalWeight < 0.5) return null;

  // Renormalize by ACTUAL available weight (drops missing constituents).
  const out = {};
  for (const [task, p] of Object.entries(sumProbs)) {
    out[task] = p / availableWeight;
  }

  return {
    probs: out,
    source: 'compound',
    constituents: Object.keys(consts),
    description: def.description,
    coverage: availableWeight / totalWeight,
  };
}

/**
 * Apply compound-food synthesis to the entire graph after gnn_entropy
 * has been loaded. Mutates each compound-food node in place — adds
 * `gnnProbs` (the synthesized vector) plus metadata fields the UI
 * uses to badge the profile.
 *
 * Skips compound foods that already have a direct GNN prediction
 * (defer to the model) and ones not in the catalog.
 *
 * @returns {string[]} names of compound foods that successfully synthesized
 */
export function applyCompoundSynthesis(nodes) {
  const synthesized = [];
  for (const name of Object.keys(COMPOUND_FOODS)) {
    const def = COMPOUND_FOODS[name];
    if (def.aliasOf) {
      // Resolve alias → if the canonical synthesized, mirror it onto the alias node.
      const aliasNode = nodes.get(name);
      const canonNode = nodes.get(def.aliasOf);
      if (aliasNode && !aliasNode.gnnProbs && canonNode?.gnnProbs && canonNode.gnnProbsSource === 'compound') {
        aliasNode.gnnProbs = canonNode.gnnProbs;
        aliasNode.gnnProbsSource = 'compound';
        aliasNode.gnnConstituents = canonNode.gnnConstituents;
        aliasNode.gnnConstituentsDescription = canonNode.gnnConstituentsDescription;
        synthesized.push(name);
      }
      continue;
    }
    const node = nodes.get(name);
    if (!node || node.gnnProbs) continue;
    const synth = synthesizeCompoundProfile(name, nodes);
    if (!synth) continue;
    node.gnnProbs = synth.probs;
    node.gnnProbsSource = 'compound';
    node.gnnConstituents = synth.constituents;
    node.gnnConstituentsDescription = synth.description;
    synthesized.push(name);
  }
  return synthesized;
}
