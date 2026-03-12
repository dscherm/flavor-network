import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const STORAGE_KEY = 'flavor-user-profile-v2';

const DEFAULT_PROFILE = {
  cuisines: [],
  ingredients: [],
  recipes: [],
  quizAnswers: null,
};

/**
 * Normalize a recipe ingredient to structured form.
 * Handles both old format (string) and new format ({ name, quantity, unit, raw }).
 * @param {string|Object} ing
 * @returns {{ name: string, quantity: number|null, unit: string|null, raw: string }}
 */
function normalizeIngredient(ing) {
  if (typeof ing === 'string') {
    return { name: ing.toLowerCase(), quantity: null, unit: null, raw: ing };
  }
  return {
    name: String(ing.name || '').toLowerCase(),
    quantity: typeof ing.quantity === 'number' ? ing.quantity : null,
    unit: ing.unit ? String(ing.unit) : null,
    raw: String(ing.raw || ing.name || ''),
  };
}

/**
 * Normalize a recipe's ingredients array to structured format.
 */
function normalizeRecipe(recipe) {
  return {
    name: String(recipe.name || ''),
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map(normalizeIngredient)
      : [],
  };
}

function loadLocalProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return {
      cuisines: Array.isArray(parsed.cuisines) ? parsed.cuisines : [],
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes.map(normalizeRecipe) : [],
      quizAnswers: parsed.quizAnswers || null,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveLocalProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

function mergeProfiles(local, cloud) {
  const mergeArrays = (a, b) => [...new Set([...a, ...b])];
  const mergeRecipes = (a, b) => {
    const seen = new Set(a.map((r) => r.name.toLowerCase()));
    const merged = [...a];
    for (const r of b) {
      if (!seen.has(r.name.toLowerCase())) {
        merged.push(r);
        seen.add(r.name.toLowerCase());
      }
    }
    return merged;
  };
  return {
    cuisines: mergeArrays(local.cuisines, cloud.cuisines),
    ingredients: mergeArrays(local.ingredients, cloud.ingredients),
    recipes: mergeRecipes(local.recipes, cloud.recipes),
    quizAnswers: cloud.quizAnswers || local.quizAnswers || null,
  };
}

export default function useUserProfile(user) {
  const [profile, setProfile] = useState(loadLocalProfile);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const skipNextSync = useRef(false);

  // Load from Firestore on login, merge with local
  useEffect(() => {
    if (!user) {
      setCloudLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, 'profiles', user.uid);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const cloudData = snap.data();
          const cloud = {
            cuisines: Array.isArray(cloudData.cuisines) ? cloudData.cuisines : [],
            ingredients: Array.isArray(cloudData.ingredients) ? cloudData.ingredients : [],
            recipes: Array.isArray(cloudData.recipes) ? cloudData.recipes.map(normalizeRecipe) : [],
            quizAnswers: cloudData.quizAnswers || null,
          };
          const local = loadLocalProfile();
          const merged = mergeProfiles(local, cloud);
          skipNextSync.current = true;
          setProfile(merged);
          saveLocalProfile(merged);
        }
      } catch (err) {
        console.error('Failed to load cloud profile:', err);
      }
      if (!cancelled) setCloudLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Sync to Firestore whenever profile changes (if logged in)
  useEffect(() => {
    if (!user || !cloudLoaded) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const ref = doc(db, 'profiles', user.uid);
    setDoc(ref, profile).catch((err) => console.error('Failed to save cloud profile:', err));
  }, [profile, user, cloudLoaded]);

  const update = useCallback((updater) => {
    setProfile((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocalProfile(next);
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
      ingredients: ingredients.map(normalizeIngredient),
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
          ? parsed.recipes.map(normalizeRecipe)
          : [],
        quizAnswers: parsed.quizAnswers || null,
      };
      update(validated);
      return true;
    } catch {
      return false;
    }
  }, [update]);

  const saveQuizAnswers = useCallback((answers) => {
    update((prev) => ({ ...prev, quizAnswers: answers }));
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
    saveQuizAnswers,
    stats,
  };
}
