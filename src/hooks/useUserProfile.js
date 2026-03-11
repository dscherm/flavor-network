import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'flavor-user-profile';

const DEFAULT_PROFILE = {
  cuisines: [],
  ingredients: [],
  recipes: [],
};

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return {
      cuisines: Array.isArray(parsed.cuisines) ? parsed.cuisines : [],
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export default function useUserProfile() {
  const [profile, setProfile] = useState(loadProfile);

  const update = useCallback((updater) => {
    setProfile((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveProfile(next);
      return next;
    });
  }, []);

  // --- Cuisines ---
  const addCuisine = useCallback((cuisine) => {
    const name = cuisine.toLowerCase();
    update((prev) => {
      if (prev.cuisines.includes(name)) return prev;
      return { ...prev, cuisines: [...prev.cuisines, name] };
    });
  }, [update]);

  const removeCuisine = useCallback((cuisine) => {
    const name = cuisine.toLowerCase();
    update((prev) => ({
      ...prev,
      cuisines: prev.cuisines.filter((c) => c !== name),
    }));
  }, [update]);

  // --- Ingredients ---
  const addIngredient = useCallback((ingredient) => {
    const name = ingredient.toLowerCase();
    update((prev) => {
      if (prev.ingredients.includes(name)) return prev;
      return { ...prev, ingredients: [...prev.ingredients, name] };
    });
  }, [update]);

  const removeIngredient = useCallback((ingredient) => {
    const name = ingredient.toLowerCase();
    update((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((i) => i !== name),
    }));
  }, [update]);

  const toggleIngredient = useCallback((ingredient) => {
    const name = ingredient.toLowerCase();
    update((prev) => {
      if (prev.ingredients.includes(name)) {
        return { ...prev, ingredients: prev.ingredients.filter((i) => i !== name) };
      }
      return { ...prev, ingredients: [...prev.ingredients, name] };
    });
  }, [update]);

  // --- Recipes ---
  const addRecipe = useCallback((name, ingredients) => {
    const recipe = {
      name: name.trim(),
      ingredients: ingredients.map((i) => i.toLowerCase()),
    };
    update((prev) => ({
      ...prev,
      recipes: [...prev.recipes, recipe],
    }));
  }, [update]);

  const removeRecipe = useCallback((index) => {
    update((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((_, i) => i !== index),
    }));
  }, [update]);

  // --- Bulk ---
  const clearProfile = useCallback(() => {
    update(DEFAULT_PROFILE);
  }, [update]);

  const exportProfile = useCallback(() => {
    return JSON.stringify(profile, null, 2);
  }, [profile]);

  const importProfile = useCallback((jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = {
        cuisines: Array.isArray(parsed.cuisines)
          ? parsed.cuisines.map((c) => c.toLowerCase())
          : [],
        ingredients: Array.isArray(parsed.ingredients)
          ? parsed.ingredients.map((i) => i.toLowerCase())
          : [],
        recipes: Array.isArray(parsed.recipes)
          ? parsed.recipes.map((r) => ({
              name: String(r.name || ''),
              ingredients: Array.isArray(r.ingredients)
                ? r.ingredients.map((i) => i.toLowerCase())
                : [],
            }))
          : [],
      };
      update(validated);
      return true;
    } catch {
      return false;
    }
  }, [update]);

  // --- Queries ---
  const hasIngredient = useCallback((name) => {
    return profile.ingredients.includes(name.toLowerCase());
  }, [profile.ingredients]);

  const hasCuisine = useCallback((name) => {
    return profile.cuisines.includes(name.toLowerCase());
  }, [profile.cuisines]);

  const stats = useMemo(() => ({
    cuisineCount: profile.cuisines.length,
    ingredientCount: profile.ingredients.length,
    recipeCount: profile.recipes.length,
    totalItems: profile.cuisines.length + profile.ingredients.length + profile.recipes.length,
  }), [profile]);

  return {
    profile,
    addCuisine,
    removeCuisine,
    addIngredient,
    removeIngredient,
    toggleIngredient,
    addRecipe,
    removeRecipe,
    clearProfile,
    exportProfile,
    importProfile,
    hasIngredient,
    hasCuisine,
    stats,
  };
}
