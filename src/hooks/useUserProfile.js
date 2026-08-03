import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const STORAGE_KEY = 'flavor-user-profile-v2';

const DEFAULT_PROFILE = {
  cuisines: [],
  ingredients: [],
  recipes: [],
  cocktails: [],
  sauces: [],
  pairings: [], // { a, b } where a < b alphabetically (canonical key)
  quizAnswers: null,
};

/**
 * Canonicalize a pairing so { a:'butter', b:'sage' } and
 * { a:'sage', b:'butter' } collapse to one entry. Lowercased + sorted.
 */
function canonicalPairing(a, b) {
  const lo = String(a || '').toLowerCase().trim();
  const hi = String(b || '').toLowerCase().trim();
  if (!lo || !hi || lo === hi) return null;
  return lo < hi ? { a: lo, b: hi } : { a: hi, b: lo };
}

function pairingKey(p) {
  return p ? `${p.a}${p.b}` : '';
}

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

/** Collapse recipes sharing a name (case-insensitive), keeping the last. */
function dedupeRecipes(recipes) {
  const byName = new Map();
  for (const r of recipes) {
    byName.set(String(r?.name || '').trim().toLowerCase(), r);
  }
  return [...byName.values()];
}

function loadLocalProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return {
      cuisines: Array.isArray(parsed.cuisines) ? parsed.cuisines : [],
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      // Collapse duplicates already written by the pre-COOKBOOK-2 append.
      // Last wins: the most recent save is the one the user meant to keep.
      recipes: Array.isArray(parsed.recipes) ? dedupeRecipes(parsed.recipes.map(normalizeRecipe)) : [],
      cocktails: Array.isArray(parsed.cocktails) ? parsed.cocktails : [],
      sauces: Array.isArray(parsed.sauces) ? parsed.sauces : [],
      pairings: Array.isArray(parsed.pairings)
        ? parsed.pairings.map((p) => canonicalPairing(p?.a, p?.b)).filter(Boolean)
        : [],
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
  const mergeCocktails = (a, b) => {
    const seen = new Set(a.map((c) => c.id));
    const merged = [...a];
    for (const c of b) {
      if (!seen.has(c.id)) {
        merged.push(c);
        seen.add(c.id);
      }
    }
    return merged;
  };
  const mergeSauces = (a, b) => {
    const seen = new Set(a.map((s) => s.id));
    const merged = [...a];
    for (const s of b) {
      if (!seen.has(s.id)) {
        merged.push(s);
        seen.add(s.id);
      }
    }
    return merged;
  };
  return {
    cuisines: mergeArrays(local.cuisines, cloud.cuisines),
    ingredients: mergeArrays(local.ingredients, cloud.ingredients),
    recipes: mergeRecipes(local.recipes, cloud.recipes),
    cocktails: mergeCocktails(local.cocktails || [], cloud.cocktails || []),
    sauces: mergeSauces(local.sauces || [], cloud.sauces || []),
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
            cocktails: Array.isArray(cloudData.cocktails) ? cloudData.cocktails : [],
            sauces: Array.isArray(cloudData.sauces) ? cloudData.sauces : [],
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
  // COOKBOOK-2: saving the same recipe twice REPLACES it rather than
  // appending. Tapping Save twice (or re-saving after an edit) had been
  // stacking duplicates — one profile here accumulated the same dish four
  // times. Name is the identity, matched case-insensitively after trimming,
  // which is the same rule mergeProfiles already uses to reconcile local
  // against cloud. Replacing rather than rejecting means an edited recipe
  // still saves; it just does not multiply.
  const addRecipe = useCallback((name, ingredients) => {
    const recipe = {
      name: name.trim(),
      ingredients: ingredients.map(normalizeIngredient),
    };
    const key = recipe.name.toLowerCase();
    update((prev) => {
      const idx = prev.recipes.findIndex((r) => String(r?.name || '').trim().toLowerCase() === key);
      if (idx === -1) return { ...prev, recipes: [...prev.recipes, recipe] };
      const recipes = [...prev.recipes];
      recipes[idx] = recipe;
      return { ...prev, recipes };
    });
  }, [update]);

  const removeRecipe = useCallback((index) => {
    update((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((_, i) => i !== index),
    }));
  }, [update]);

  // --- Cocktails ---
  const addCocktail = useCallback((cocktail) => {
    const entry = {
      id: cocktail.id || `cocktail_${Date.now()}`,
      name: cocktail.name || 'Untitled',
      ingredients: Array.isArray(cocktail.ingredients) ? cocktail.ingredients : [],
      instructions: cocktail.instructions || '',
      template: cocktail.template || null,
      createdAt: cocktail.createdAt || new Date().toISOString(),
    };
    update((prev) => ({
      ...prev,
      cocktails: [...(prev.cocktails || []), entry],
    }));
    return entry.id;
  }, [update]);

  const removeCocktail = useCallback((id) => {
    update((prev) => ({
      ...prev,
      cocktails: (prev.cocktails || []).filter((c) => c.id !== id),
    }));
  }, [update]);

  const updateCocktail = useCallback((id, changes) => {
    update((prev) => ({
      ...prev,
      cocktails: (prev.cocktails || []).map((c) =>
        c.id === id ? { ...c, ...changes } : c
      ),
    }));
  }, [update]);

  // --- Sauces ---
  const addSauce = useCallback((sauce) => {
    const entry = {
      id: sauce.id || `sauce_${Date.now()}`,
      name: sauce.name || 'Untitled',
      ingredients: Array.isArray(sauce.ingredients) ? sauce.ingredients : [],
      instructions: sauce.instructions || '',
      template: sauce.template || null,
      motherSauce: sauce.motherSauce || '',
      createdAt: sauce.createdAt || Date.now(),
    };
    update((prev) => ({
      ...prev,
      sauces: [...(prev.sauces || []), entry],
    }));
    return entry.id;
  }, [update]);

  const removeSauce = useCallback((id) => {
    update((prev) => ({
      ...prev,
      sauces: (prev.sauces || []).filter((s) => s.id !== id),
    }));
  }, [update]);

  const updateSauce = useCallback((id, changes) => {
    update((prev) => ({
      ...prev,
      sauces: (prev.sauces || []).map((s) =>
        s.id === id ? { ...s, ...changes } : s
      ),
    }));
  }, [update]);

  // --- Favorite Pairings ---
  const addPairing = useCallback((a, b) => {
    const p = canonicalPairing(a, b);
    if (!p) return;
    update((prev) => {
      const list = Array.isArray(prev.pairings) ? prev.pairings : [];
      const key = pairingKey(p);
      if (list.some((x) => pairingKey(x) === key)) return prev;
      return { ...prev, pairings: [...list, p] };
    });
  }, [update]);

  const removePairing = useCallback((a, b) => {
    const p = canonicalPairing(a, b);
    if (!p) return;
    update((prev) => {
      const list = Array.isArray(prev.pairings) ? prev.pairings : [];
      const key = pairingKey(p);
      return { ...prev, pairings: list.filter((x) => pairingKey(x) !== key) };
    });
  }, [update]);

  const togglePairing = useCallback((a, b) => {
    const p = canonicalPairing(a, b);
    if (!p) return;
    update((prev) => {
      const list = Array.isArray(prev.pairings) ? prev.pairings : [];
      const key = pairingKey(p);
      if (list.some((x) => pairingKey(x) === key)) {
        return { ...prev, pairings: list.filter((x) => pairingKey(x) !== key) };
      }
      return { ...prev, pairings: [...list, p] };
    });
  }, [update]);

  const hasPairing = useCallback((a, b) => {
    const p = canonicalPairing(a, b);
    if (!p) return false;
    const list = Array.isArray(profile.pairings) ? profile.pairings : [];
    const key = pairingKey(p);
    return list.some((x) => pairingKey(x) === key);
  }, [profile.pairings]);

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
        cocktails: Array.isArray(parsed.cocktails)
          ? parsed.cocktails
          : [],
        sauces: Array.isArray(parsed.sauces)
          ? parsed.sauces
          : [],
        pairings: Array.isArray(parsed.pairings)
          ? parsed.pairings.map((p) => canonicalPairing(p?.a, p?.b)).filter(Boolean)
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

  const stats = useMemo(() => {
    const pairingCount = (profile.pairings || []).length;
    return {
      cuisineCount: profile.cuisines.length,
      ingredientCount: profile.ingredients.length,
      recipeCount: profile.recipes.length,
      cocktailCount: (profile.cocktails || []).length,
      sauceCount: (profile.sauces || []).length,
      pairingCount,
      totalItems:
        profile.cuisines.length
        + profile.ingredients.length
        + profile.recipes.length
        + (profile.cocktails || []).length
        + (profile.sauces || []).length
        + pairingCount,
    };
  }, [profile]);

  return {
    profile,
    addCuisine,
    removeCuisine,
    addIngredient,
    removeIngredient,
    toggleIngredient,
    addRecipe,
    removeRecipe,
    addCocktail,
    removeCocktail,
    updateCocktail,
    addSauce,
    removeSauce,
    updateSauce,
    addPairing,
    removePairing,
    togglePairing,
    hasPairing,
    clearProfile,
    exportProfile,
    importProfile,
    hasIngredient,
    hasCuisine,
    saveQuizAnswers,
    stats,
  };
}
