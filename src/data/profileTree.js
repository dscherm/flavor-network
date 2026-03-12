/**
 * profileTree.js — Personal flavor tree from user's profile.
 *
 * Your Cuisines → Your Ingredients per cuisine → Your Recipes per ingredient
 * Shows the user's flavor world as a navigable hierarchy.
 */

/**
 * Build a personal flavor tree from the user's profile and graph data.
 *
 * @param {Object} profile - { cuisines, ingredients, recipes }
 * @param {Map<string, Object>} nodes - Graph nodes
 * @returns {Object[]} Tree structure:
 *   [{ id, name, type, children, ingredientCount }]
 */
export function buildProfileTree(profile, nodes) {
  if (!profile || !nodes) return [];

  const userIngredients = new Set(profile.ingredients || []);
  const userCuisines = new Set(profile.cuisines || []);
  const userRecipes = profile.recipes || [];

  // Build recipe lookup: ingredient name → recipe names
  const ingredientRecipes = new Map();
  for (const recipe of userRecipes) {
    for (const ing of (recipe.ingredients || [])) {
      const name = (typeof ing === 'string' ? ing : ing.name || '').toLowerCase();
      if (!name) continue;
      if (!ingredientRecipes.has(name)) ingredientRecipes.set(name, []);
      ingredientRecipes.get(name).push(recipe.name);
    }
  }

  const tree = [];

  // Section 1: By Cuisine
  if (userCuisines.size > 0) {
    const cuisineChildren = [];

    for (const cuisine of userCuisines) {
      // Find user ingredients that belong to this cuisine
      const cuisineIngs = [];
      for (const ingName of userIngredients) {
        const node = nodes.get(ingName);
        if (node && node.cuisines && node.cuisines.some(c => c.toLowerCase().includes(cuisine))) {
          cuisineIngs.push(ingName);
        }
      }

      // Also find recipe ingredients in this cuisine
      for (const [ingName] of ingredientRecipes) {
        if (userIngredients.has(ingName)) continue; // already counted
        const node = nodes.get(ingName);
        if (node && node.cuisines && node.cuisines.some(c => c.toLowerCase().includes(cuisine))) {
          cuisineIngs.push(ingName);
        }
      }

      const uniqueIngs = [...new Set(cuisineIngs)].sort();

      const ingChildren = uniqueIngs.map(ingName => {
        const recipes = ingredientRecipes.get(ingName) || [];
        return {
          id: `cuisine-${cuisine}-${ingName}`,
          name: ingName,
          type: 'ingredient',
          recipes,
          ingredientCount: 1,
          recipeCount: recipes.length,
        };
      });

      cuisineChildren.push({
        id: `cuisine-${cuisine}`,
        name: cuisine.replace(/ cuisines?$/i, '').replace(/\b\w/g, c => c.toUpperCase()),
        type: 'cuisine',
        children: ingChildren,
        ingredientCount: uniqueIngs.length,
      });
    }

    cuisineChildren.sort((a, b) => b.ingredientCount - a.ingredientCount);

    tree.push({
      id: 'my-cuisines',
      name: 'My Cuisines',
      type: 'section',
      children: cuisineChildren,
      ingredientCount: userCuisines.size,
    });
  }

  // Section 2: Uncategorized ingredients (not in any user cuisine)
  const categorized = new Set();
  if (userCuisines.size > 0) {
    for (const ingName of userIngredients) {
      const node = nodes.get(ingName);
      if (node && node.cuisines) {
        for (const c of node.cuisines) {
          if ([...userCuisines].some(uc => c.toLowerCase().includes(uc))) {
            categorized.add(ingName);
            break;
          }
        }
      }
    }
  }
  const uncategorized = [...userIngredients].filter(i => !categorized.has(i)).sort();
  if (uncategorized.length > 0) {
    tree.push({
      id: 'my-ingredients',
      name: 'My Ingredients',
      type: 'section',
      children: uncategorized.map(name => ({
        id: `ing-${name}`,
        name,
        type: 'ingredient',
        recipes: ingredientRecipes.get(name) || [],
        ingredientCount: 1,
        recipeCount: (ingredientRecipes.get(name) || []).length,
      })),
      ingredientCount: uncategorized.length,
    });
  }

  // Section 3: Recipes
  if (userRecipes.length > 0) {
    tree.push({
      id: 'my-recipes',
      name: 'My Recipes',
      type: 'section',
      children: userRecipes.map((recipe, i) => ({
        id: `recipe-${i}`,
        name: recipe.name,
        type: 'recipe',
        children: (recipe.ingredients || []).map(ing => {
          const name = (typeof ing === 'string' ? ing : ing.name || '').toLowerCase();
          return {
            id: `recipe-${i}-${name}`,
            name,
            type: 'ingredient',
            ingredientCount: 1,
          };
        }),
        ingredientCount: (recipe.ingredients || []).length,
      })),
      ingredientCount: userRecipes.length,
    });
  }

  return tree;
}

/**
 * Find gaps in the user's profile relative to their cuisines.
 * Returns ingredients the user's cuisines feature heavily but they haven't added.
 *
 * @param {Object} profile
 * @param {Map<string, Object>} nodes
 * @returns {Array<{ name: string, cuisines: string[] }>} Suggested ingredients
 */
export function findProfileGaps(profile, nodes) {
  if (!profile || !nodes) return [];

  const userIngredients = new Set(profile.ingredients || []);
  const userCuisines = new Set(profile.cuisines || []);
  if (userCuisines.size === 0) return [];

  // Find ingredients in user cuisines they haven't added
  const candidates = new Map();
  for (const [name, node] of nodes) {
    if (userIngredients.has(name)) continue;
    if (!node.cuisines) continue;

    const matchingCuisines = node.cuisines.filter(c =>
      [...userCuisines].some(uc => c.toLowerCase().includes(uc))
    );

    if (matchingCuisines.length > 0) {
      candidates.set(name, matchingCuisines);
    }
  }

  // Sort by number of matching cuisines (more = stronger suggestion)
  return [...candidates.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)
    .map(([name, cuisines]) => ({ name, cuisines }));
}
