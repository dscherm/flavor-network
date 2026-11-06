/**
 * seedRecipes.js — Phase 4 (pipeline 2026-05-16).
 *
 * 49 hand-curated seed recipes (15 original + 34 added 2026-11-05) covering 7 cuisines and the 8 GNN
 * aroma clusters. Each entry carries a `position3D` placed on a
 * cuisine-anchored sphere so the 3D scene has stable, reproducible
 * geometry (Architect rejected t-SNE at N=15 — perplexity must be < N).
 *
 * Positions are committed JSON-style: each is one of 6 cuisine
 * quadrants on a unit sphere of radius 12. The cuisine quadrant
 * convention:
 *   Italian  → +x, +y           (north-east upper)
 *   French   → +x, -y           (south-east upper)
 *   Asian    → -x, +y           (north-west upper)
 *   Indian   → -x, -y           (south-west upper)
 *   Mexican  → +x,  0           (east equator)
 *   ME/Med   → -x,  0           (west equator)
 *   Plus small in-quadrant offsets to disambiguate same-cuisine recipes.
 */

export const SEED_RECIPES = [
  // Italian (north-east)
  {
    id: 'margherita-pizza',
    name: 'Margherita Pizza',
    cuisine: 'Italian',
    cluster: 'baking',
    description: 'Wood-fired flatbread with tomato, mozzarella, and basil.',
    ingredients: ['flour', 'tomato', 'mozzarella', 'basil', 'olive oil', 'salt', 'yeast'],
    position3D: [8, 8, 2],
  },
  {
    id: 'beef-bolognese',
    name: 'Beef Bolognese',
    cuisine: 'Italian',
    cluster: 'savory',
    description: 'Slow-braised meat ragu over pasta.',
    ingredients: ['beef', 'tomato', 'onion', 'carrot', 'celery', 'garlic', 'red wine', 'pasta'],
    position3D: [9, 6, -2],
  },
  {
    id: 'risotto-saffron',
    name: 'Saffron Risotto',
    cuisine: 'Italian',
    cluster: 'savory',
    description: 'Stirred arborio rice with saffron and parmesan.',
    ingredients: ['rice', 'saffron', 'onion', 'parmesan', 'butter', 'white wine', 'vegetable broth'],
    position3D: [7, 9, 4],
  },

  // French (south-east)
  {
    id: 'beef-bourguignon',
    name: 'Beef Bourguignon',
    cuisine: 'French',
    cluster: 'savory',
    description: 'Red wine-braised beef with pearl onions and mushrooms.',
    ingredients: ['beef', 'red wine', 'onion', 'carrot', 'mushroom', 'thyme', 'bacon', 'butter'],
    position3D: [9, -7, 1],
  },
  {
    id: 'croissant',
    name: 'Butter Croissant',
    cuisine: 'French',
    cluster: 'baking',
    description: 'Laminated buttery pastry — flaky, golden.',
    ingredients: ['flour', 'butter', 'yeast', 'milk', 'sugar', 'salt', 'egg'],
    position3D: [8, -9, 3],
  },
  {
    id: 'ratatouille',
    name: 'Ratatouille',
    cuisine: 'French',
    cluster: 'vegetable',
    description: 'Provençal vegetable stew with eggplant, zucchini, tomato.',
    ingredients: ['eggplant', 'zucchini', 'tomato', 'sweet pepper', 'onion', 'garlic', 'thyme', 'olive oil'],
    position3D: [7, -8, -3],
  },

  // East Asian (north-west)
  {
    id: 'sushi-roll',
    name: 'Salmon Avocado Roll',
    cuisine: 'East Asian',
    cluster: 'seafood',
    description: 'Vinegared rice, salmon, and avocado wrapped in nori.',
    ingredients: ['rice', 'salmon', 'avocado', 'nori', 'rice vinegar', 'soy sauce'],
    position3D: [-8, 8, 2],
  },
  {
    id: 'miso-soup',
    name: 'Miso Soup',
    cuisine: 'East Asian',
    cluster: 'savory',
    description: 'Fermented soybean broth with tofu and scallion.',
    ingredients: ['miso', 'tofu', 'scallion', 'dashi', 'wakame'],
    position3D: [-9, 7, -2],
  },

  // South-East Asian (north-west lower)
  {
    id: 'pad-thai',
    name: 'Pad Thai',
    cuisine: 'SE Asian',
    cluster: 'savory',
    description: 'Stir-fried rice noodles with tamarind, peanut, and lime.',
    ingredients: ['rice noodle', 'shrimp', 'tamarind', 'peanut', 'lime', 'fish sauce', 'egg', 'bean sprout'],
    position3D: [-7, 9, 4],
  },
  {
    id: 'pho',
    name: 'Beef Pho',
    cuisine: 'SE Asian',
    cluster: 'savory',
    description: 'Vietnamese aromatic beef noodle soup.',
    ingredients: ['beef', 'rice noodle', 'star anise', 'cinnamon', 'ginger', 'onion', 'cilantro', 'lime'],
    position3D: [-8, 9, -3],
  },

  // South Asian (south-west)
  {
    id: 'chicken-tikka',
    name: 'Chicken Tikka Masala',
    cuisine: 'South Asian',
    cluster: 'savory',
    description: 'Spiced yogurt-marinated chicken in tomato-cream sauce.',
    ingredients: ['chicken', 'tomato', 'yogurt', 'garam masala', 'ginger', 'garlic', 'cream', 'cilantro'],
    position3D: [-9, -7, 2],
  },
  {
    id: 'biryani',
    name: 'Lamb Biryani',
    cuisine: 'South Asian',
    cluster: 'savory',
    description: 'Layered rice with spiced lamb and caramelized onion.',
    ingredients: ['lamb', 'rice', 'onion', 'yogurt', 'saffron', 'cardamom', 'cinnamon', 'mint'],
    position3D: [-8, -8, -2],
  },

  // Mexican (east equator)
  {
    id: 'tacos-al-pastor',
    name: 'Tacos al Pastor',
    cuisine: 'Mexican',
    cluster: 'savory',
    description: 'Adobo-marinated pork with pineapple, cilantro, onion.',
    ingredients: ['pork', 'pineapple', 'cilantro', 'onion', 'lime', 'corn tortilla', 'chipotle'],
    position3D: [11, 1, 3],
  },
  {
    id: 'mole-poblano',
    name: 'Mole Poblano',
    cuisine: 'Mexican',
    cluster: 'savory',
    description: 'Complex sauce of chiles, chocolate, and warming spices.',
    ingredients: ['chocolate', 'ancho chili', 'cinnamon', 'almond', 'tomato', 'onion', 'sesame seed'],
    position3D: [11, -1, -3],
  },

  // Middle Eastern (west equator)
  {
    id: 'hummus',
    name: 'Hummus',
    cuisine: 'Middle Eastern',
    cluster: 'vegetable',
    description: 'Smooth chickpea puree with tahini, lemon, garlic.',
    ingredients: ['chickpea', 'tahini', 'lemon juice', 'garlic', 'olive oil', 'cumin'],
    position3D: [-11, 0, 4],
  },

  // ── Expanded set (2026-11-05): 34 more dishes across the same cuisines ──
  // Ingredient names use the ProData spellings (ingredients.json) so every
  // recipe scores on the flavor radars and hands off cleanly to the Recipe Lab.

  // Italian
  {
    id: 'spaghetti-carbonara',
    name: 'Spaghetti Carbonara',
    cuisine: 'Italian',
    cluster: 'savory',
    description: 'Roman pasta glossed with egg yolk, pecorino, cured pork, and black pepper.',
    ingredients: ['pasta', 'egg yolk', 'pecorino', 'bacon', 'black pepper', 'salt'],
    position3D: [10, 7, 0],
  },
  {
    id: 'linguine-vongole',
    name: 'Linguine alle Vongole',
    cuisine: 'Italian',
    cluster: 'seafood',
    description: 'Clams steamed open in white wine and garlic, tossed with linguine and parsley.',
    ingredients: ['linguine pasta', 'clam', 'white wine', 'garlic', 'olive oil', 'parsley', 'red pepper'],
    position3D: [6, 10, -1],
  },
  {
    id: 'pesto-genovese',
    name: 'Pasta al Pesto',
    cuisine: 'Italian',
    cluster: 'vegetable',
    description: 'Pounded basil, pine nut, and parmesan sauce over pasta.',
    ingredients: ['pasta', 'basil', 'pine nut', 'parmesan', 'garlic', 'olive oil', 'salt'],
    position3D: [8, 10, 1],
  },
  {
    id: 'caprese-salad',
    name: 'Caprese Salad',
    cuisine: 'Italian',
    cluster: 'vegetable',
    description: 'Ripe tomato, fresh mozzarella, and basil with olive oil and balsamic.',
    ingredients: ['tomato', 'mozzarella', 'basil', 'olive oil', 'balsamic vinegar', 'salt', 'black pepper'],
    position3D: [10, 9, 3],
  },
  {
    id: 'tiramisu',
    name: 'Tiramisu',
    cuisine: 'Italian',
    cluster: 'baking',
    description: 'Espresso-soaked ladyfingers layered with mascarpone cream and cocoa.',
    ingredients: ['ladyfinger cookie', 'mascarpone', 'espresso', 'egg', 'sugar', 'cocoa'],
    position3D: [7, 7, 5],
  },

  // French
  {
    id: 'coq-au-vin',
    name: 'Coq au Vin',
    cuisine: 'French',
    cluster: 'savory',
    description: 'Chicken braised in red wine with mushrooms, bacon, and pearl onions.',
    ingredients: ['chicken', 'red wine', 'mushroom', 'bacon', 'pearl onion', 'garlic', 'thyme', 'butter'],
    position3D: [10, -6, -1],
  },
  {
    id: 'french-onion-soup',
    name: 'French Onion Soup',
    cuisine: 'French',
    cluster: 'savory',
    description: 'Deeply caramelized onions in beef broth under a raft of bread and melted gruyère.',
    ingredients: ['onion', 'butter', 'beef stock', 'white wine', 'thyme', 'gruyere', 'bread baguette'],
    position3D: [9, -9, -2],
  },
  {
    id: 'moules-marinieres',
    name: 'Moules Marinières',
    cuisine: 'French',
    cluster: 'seafood',
    description: 'Mussels steamed with white wine, shallot, garlic, and a splash of cream.',
    ingredients: ['mussel', 'white wine', 'shallot', 'garlic', 'parsley', 'butter', 'cream'],
    position3D: [7, -10, 0],
  },
  {
    id: 'quiche-lorraine',
    name: 'Quiche Lorraine',
    cuisine: 'French',
    cluster: 'baking',
    description: 'Buttery tart shell filled with egg custard, bacon, and gruyère.',
    ingredients: ['pie crust', 'egg', 'cream', 'bacon', 'gruyere', 'nutmeg', 'black pepper'],
    position3D: [10, -8, 3],
  },
  {
    id: 'creme-brulee',
    name: 'Crème Brûlée',
    cuisine: 'French',
    cluster: 'baking',
    description: 'Vanilla custard under a crackling burnt-sugar crust.',
    ingredients: ['cream', 'egg yolk', 'sugar', 'vanilla'],
    position3D: [6, -8, 4],
  },

  // East Asian
  {
    id: 'mapo-tofu',
    name: 'Mapo Tofu',
    cuisine: 'East Asian',
    cluster: 'savory',
    description: 'Silken tofu in a numbing, chili-bright Sichuan sauce with pork.',
    ingredients: ['tofu', 'pork', 'doubanjiang', 'sichuan peppercorn', 'garlic', 'ginger', 'scallion', 'chili oil'],
    position3D: [-10, 7, 0],
  },
  {
    id: 'bibimbap',
    name: 'Bibimbap',
    cuisine: 'East Asian',
    cluster: 'vegetable',
    description: 'Rice bowl topped with seasoned vegetables, a fried egg, and gochujang.',
    ingredients: ['rice', 'spinach', 'carrot', 'bean sprout', 'mushroom', 'egg', 'gochujang', 'sesame oil'],
    position3D: [-7, 7, 4],
  },
  {
    id: 'teriyaki-salmon',
    name: 'Teriyaki Salmon',
    cuisine: 'East Asian',
    cluster: 'seafood',
    description: 'Salmon glazed in a sweet soy, mirin, and sake reduction.',
    ingredients: ['salmon', 'soy sauce', 'mirin', 'sake', 'brown sugar', 'ginger', 'sesame seed'],
    position3D: [-9, 9, 1],
  },
  {
    id: 'pork-gyoza',
    name: 'Pork Gyoza',
    cuisine: 'East Asian',
    cluster: 'savory',
    description: 'Pan-fried dumplings of pork, cabbage, ginger, and garlic.',
    ingredients: ['pork', 'chinese cabbage', 'ginger', 'garlic', 'scallion', 'soy sauce', 'sesame oil'],
    position3D: [-10, 9, -1],
  },
  {
    id: 'garlic-bok-choy',
    name: 'Garlic Bok Choy',
    cuisine: 'East Asian',
    cluster: 'vegetable',
    description: 'Bok choy flash-fried with garlic and oyster sauce.',
    ingredients: ['pak choy', 'garlic', 'oyster sauce', 'soy sauce', 'sesame oil', 'ginger'],
    position3D: [-8, 10, -4],
  },

  // SE Asian
  {
    id: 'thai-green-curry',
    name: 'Thai Green Curry',
    cuisine: 'SE Asian',
    cluster: 'savory',
    description: 'Chicken simmered in coconut milk with green curry paste and Thai basil.',
    ingredients: ['chicken', 'coconut milk', 'curry paste', 'eggplant', 'thai basil', 'fish sauce', 'lime', 'palm sugar'],
    position3D: [-6, 10, 2],
  },
  {
    id: 'tom-yum',
    name: 'Tom Yum Goong',
    cuisine: 'SE Asian',
    cluster: 'seafood',
    description: 'Hot-and-sour shrimp soup scented with lemongrass and galangal.',
    ingredients: ['shrimp', 'lemongrass', 'galangal', 'lime', 'fish sauce', 'mushroom', 'cilantro', 'green chili pepper'],
    position3D: [-6, 8, -4],
  },
  {
    id: 'chicken-satay',
    name: 'Chicken Satay',
    cuisine: 'SE Asian',
    cluster: 'savory',
    description: 'Turmeric-marinated grilled chicken skewers with peanut sauce.',
    ingredients: ['chicken', 'turmeric', 'coriander', 'lemongrass', 'coconut milk', 'peanut butter', 'soy sauce', 'brown sugar'],
    position3D: [-5, 9, 0],
  },
  {
    id: 'som-tam',
    name: 'Som Tam',
    cuisine: 'SE Asian',
    cluster: 'vegetable',
    description: 'Pounded green papaya salad — sour, salty, sweet, and fiery.',
    ingredients: ['papaya', 'tomato', 'green bean', 'peanut', 'lime', 'fish sauce', 'palm sugar', 'garlic'],
    position3D: [-7, 11, 0],
  },

  // South Asian
  {
    id: 'chana-masala',
    name: 'Chana Masala',
    cuisine: 'South Asian',
    cluster: 'vegetable',
    description: 'Chickpeas stewed in a tangy onion-tomato gravy with warm spices.',
    ingredients: ['chickpea', 'onion', 'tomato', 'ginger', 'garlic', 'garam masala', 'cumin', 'cilantro'],
    position3D: [-10, -6, 0],
  },
  {
    id: 'palak-paneer',
    name: 'Palak Paneer',
    cuisine: 'South Asian',
    cluster: 'vegetable',
    description: 'Fresh cheese cubes in a silky spiced spinach purée.',
    ingredients: ['paneer', 'spinach', 'onion', 'garlic', 'ginger', 'cumin', 'garam masala', 'cream'],
    position3D: [-7, -9, 1],
  },
  {
    id: 'dal-tadka',
    name: 'Dal Tadka',
    cuisine: 'South Asian',
    cluster: 'vegetable',
    description: 'Yellow lentils finished with sizzling ghee, cumin, and chili.',
    ingredients: ['lentil', 'ghee', 'cumin', 'turmeric', 'garlic', 'tomato', 'onion', 'green chili pepper'],
    position3D: [-9, -9, -1],
  },
  {
    id: 'goan-fish-curry',
    name: 'Goan Fish Curry',
    cuisine: 'South Asian',
    cluster: 'seafood',
    description: 'White fish in a coconut curry soured with tamarind.',
    ingredients: ['white fish', 'coconut milk', 'tamarind', 'turmeric', 'coriander', 'curry leaf', 'garlic', 'onion'],
    position3D: [-10, -8, 3],
  },
  {
    id: 'garlic-naan',
    name: 'Garlic Naan',
    cuisine: 'South Asian',
    cluster: 'baking',
    description: 'Pillowy yogurt flatbread brushed with garlic butter.',
    ingredients: ['flour', 'yogurt', 'yeast', 'milk', 'sugar', 'garlic', 'ghee', 'cilantro'],
    position3D: [-8, -6, 4],
  },

  // Mexican
  {
    id: 'guacamole',
    name: 'Guacamole',
    cuisine: 'Mexican',
    cluster: 'vegetable',
    description: 'Mashed avocado with lime, onion, chile, and cilantro.',
    ingredients: ['avocado', 'lime juice', 'purple onion', 'serrano pepper', 'cilantro', 'tomato', 'salt'],
    position3D: [12, 2, 0],
  },
  {
    id: 'shrimp-ceviche',
    name: 'Shrimp Ceviche',
    cuisine: 'Mexican',
    cluster: 'seafood',
    description: 'Shrimp cured in lime juice with tomato, onion, cucumber, and chile.',
    ingredients: ['shrimp', 'lime juice', 'tomato', 'purple onion', 'cucumber', 'cilantro', 'jalapeno chile', 'avocado'],
    position3D: [12, 0, 2],
  },
  {
    id: 'chicken-enchiladas',
    name: 'Chicken Enchiladas',
    cuisine: 'Mexican',
    cluster: 'savory',
    description: 'Tortillas rolled around chicken, smothered in red chile sauce and cheese.',
    ingredients: ['corn tortilla', 'chicken', 'chili powder', 'tomato sauce', 'onion', 'garlic', 'cheddar', 'sour cream'],
    position3D: [10, 2, -1],
  },
  {
    id: 'pozole-rojo',
    name: 'Pozole Rojo',
    cuisine: 'Mexican',
    cluster: 'savory',
    description: 'Pork and hominy stew in a dried-chile broth, topped with radish and cabbage.',
    ingredients: ['pork', 'hominy', 'guajillo chili', 'garlic', 'onion', 'oregano', 'radish', 'cabbage'],
    position3D: [12, -2, -1],
  },
  {
    id: 'churros',
    name: 'Churros',
    cuisine: 'Mexican',
    cluster: 'baking',
    description: 'Fried choux-style dough rolled in cinnamon sugar, served with chocolate.',
    ingredients: ['flour', 'butter', 'egg', 'sugar', 'cinnamon', 'salt', 'chocolate'],
    position3D: [10, 0, 4],
  },

  // Middle Eastern
  {
    id: 'falafel',
    name: 'Falafel',
    cuisine: 'Middle Eastern',
    cluster: 'vegetable',
    description: 'Crisp herbed chickpea fritters with tahini sauce in pita.',
    ingredients: ['chickpea', 'parsley', 'cilantro', 'onion', 'garlic', 'cumin', 'coriander', 'tahini', 'pita bread'],
    position3D: [-12, 1, 1],
  },
  {
    id: 'shakshuka',
    name: 'Shakshuka',
    cuisine: 'Middle Eastern',
    cluster: 'vegetable',
    description: 'Eggs poached in a spiced tomato and pepper sauce.',
    ingredients: ['egg', 'tomato', 'red pepper', 'onion', 'garlic', 'cumin', 'paprika', 'feta'],
    position3D: [-11, -1, -2],
  },
  {
    id: 'chicken-shawarma',
    name: 'Chicken Shawarma',
    cuisine: 'Middle Eastern',
    cluster: 'savory',
    description: 'Spice-rubbed roast chicken with garlic yogurt sauce.',
    ingredients: ['chicken', 'yogurt', 'garlic', 'lemon juice', 'cumin', 'paprika', 'allspice', 'pita bread'],
    position3D: [-12, -1, 3],
  },
  {
    id: 'tabbouleh',
    name: 'Tabbouleh',
    cuisine: 'Middle Eastern',
    cluster: 'vegetable',
    description: 'Parsley-forward bulgur salad with tomato, mint, and lemon.',
    ingredients: ['parsley', 'bulgur', 'tomato', 'mint', 'lemon juice', 'olive oil', 'scallion'],
    position3D: [-10, 1, -3],
  },
  {
    id: 'baklava',
    name: 'Baklava',
    cuisine: 'Middle Eastern',
    cluster: 'baking',
    description: 'Layers of phyllo and chopped nuts soaked in honey syrup.',
    ingredients: ['phyllo dough', 'walnut', 'pistachio', 'butter', 'honey', 'sugar', 'cinnamon'],
    position3D: [-11, 2, 4],
  },
];

/**
 * Cuisine → display color (used by node fill + filter pills).
 * Anchored to the existing BRISCIONE / CATEGORICAL_AXES cuisine palette
 * so the colors match the Network tab's filter pills.
 */
export const CUISINE_COLOR = {
  Italian:          '#3b82f6',
  French:           '#3b82f6',  // both European
  'East Asian':     '#f59e0b',
  'SE Asian':       '#22c55e',
  'South Asian':    '#a855f7',
  Mexican:          '#ef4444',
  'Middle Eastern': '#ec4899',
  // B-version (2026-06-03): user-saved recipes use chalk-cream so they
  // visually read as "yours" against the cuisine-colored seed set.
  Personal:         '#f5efde',
};

/**
 * Normalize a user-saved recipe (profile.recipes shape:
 * `{ name, ingredients }`) into a SEED_RECIPES-shaped object so it can
 * be merged into the cookbook scene. Position is placed on a fresh
 * "Personal" quadrant — a vertical stack at +y radius 12.
 */
export function userRecipeToSeed(recipe, idx) {
  const name = String(recipe?.name || '').trim() || `Saved recipe ${idx + 1}`;
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map((it) => (typeof it === 'string' ? it : it?.name)).filter(Boolean)
    : [];
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `user-${idx}`;
  return {
    id: `user-${slug}`,
    name,
    cuisine: 'Personal',
    cluster: 'personal',
    description: `Saved recipe (${ingredients.length} ingredient${ingredients.length === 1 ? '' : 's'}).`,
    ingredients,
    // Stack vertically above origin so user recipes form a coherent
    // "shelf" distinct from the cuisine quadrants.
    position3D: [0, 12 + idx * 0.6, idx * 1.3 - 6],
    _userSaved: true,
  };
}

/**
 * Build a NetworkScene-compatible data object from the seed recipes.
 * Returns { nodes: Map<id, node>, positions: { id → [x,y,z] } }.
 * Node shape matches what NetworkScene expects: { name, color,
 * cluster, position3D }.
 */
export function buildRecipesNetworkData() {
  const nodes = new Map();
  const positions = {};
  for (const r of SEED_RECIPES) {
    nodes.set(r.id, {
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      cluster: r.cluster,
      color: CUISINE_COLOR[r.cuisine] || '#94a3b8',
      ingredients: r.ingredients,
      description: r.description,
    });
    positions[r.id] = r.position3D;
  }
  return { nodes, positions };
}

/**
 * Cuisine → cluster id. One cluster per cuisine — gives the 3D scene
 * a coherent grouping (each cuisine is its own color-coded family).
 */
const CUISINE_ORDER = [
  'Italian', 'French', 'East Asian', 'SE Asian',
  'South Asian', 'Mexican', 'Middle Eastern',
  'Personal',
];

/**
 * Build a full NetworkScene contract for the 3D CookbookLab view.
 * Returns the same shape Cocktail/Sauce labs feed to NetworkScene:
 *   { graph: { nodes, edges, ingredientList },
 *     positions: { positions: {name→[x,y,z]} },
 *     codex: { clusters: [{id, name, color}] } }
 *
 * Node-keying: NetworkScene expects nodes keyed by `name` because
 * selection state, fly-to targets, and labels all use the name
 * string. We therefore key by recipe.name (display name) rather
 * than recipe.id.
 */
export function buildRecipesScene(extraRecipes = []) {
  const nodes = new Map();
  const positions = {};
  const shapeAssignments = new Map();
  // Merge seed + extras (user-saved). Extras must already be in
  // SEED_RECIPES shape — use `userRecipeToSeed(...)` on profile data.
  const allRecipes = [...SEED_RECIPES, ...(Array.isArray(extraRecipes) ? extraRecipes : [])];
  for (const r of allRecipes) {
    const cuisineIdx = CUISINE_ORDER.indexOf(r.cuisine);
    const cuisineColor = CUISINE_COLOR[r.cuisine] || '#94a3b8';
    nodes.set(r.name, {
      name: r.name,
      id: r.id,
      cuisine: r.cuisine,
      cluster: r.cluster,
      family_id: cuisineIdx >= 0 ? cuisineIdx : 0,
      // NodeMesh short-circuits color when clusterColor is set, so
      // cuisine becomes the visual key for each book.
      clusterColor: cuisineColor,
      color: cuisineColor,
      ingredients: r.ingredients,
      description: r.description,
      taste: '',
      pairingCount: 1,
      cuisines: [r.cuisine.toLowerCase()],
      // 3.5× scale — cookbook geometry is flatter than a sphere so
      // we go a touch larger to maintain visual weight.
      scaleBoost: 3.5,
    });
    positions[r.name] = r.position3D;
    shapeAssignments.set(r.name, 'cookbook');
  }
  const clusters = CUISINE_ORDER.map((cuisine, idx) => ({
    id: idx,
    name: cuisine,
    label: cuisine,
    color: CUISINE_COLOR[cuisine] || '#94a3b8',
  }));
  return {
    graph: {
      nodes,
      edges: [],
      ingredientList: [],
    },
    positions: { positions },
    codex: { clusters },
    shapeAssignments,
  };
}
