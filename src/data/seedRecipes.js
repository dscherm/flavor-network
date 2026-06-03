/**
 * seedRecipes.js — Phase 4 (pipeline 2026-05-16).
 *
 * 15 hand-curated seed recipes covering 6+ cuisines and the 8 GNN
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
    ingredients: ['ground beef', 'tomato', 'onion', 'carrot', 'celery', 'garlic', 'red wine', 'pasta'],
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
    ingredients: ['eggplant', 'zucchini', 'tomato', 'bell pepper', 'onion', 'garlic', 'thyme', 'olive oil'],
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
    ingredients: ['miso', 'tofu', 'scallion', 'dashi', 'seaweed'],
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
    ingredients: ['chocolate', 'chili pepper', 'cinnamon', 'almond', 'tomato', 'onion', 'sesame seed'],
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
