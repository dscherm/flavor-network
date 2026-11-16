import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { saveInvention as saveInventionInto, deleteInvention as deleteInventionFrom, PROFILE_FIELD } from '../data/savedInventions.js';
import { newItemId } from '../data/inventSaved.js';
import { cleanPictureField, sharedPictureField, prepareItemPicture, dropPicture } from '../data/pictureStore.js';
import { emptyShopping, cleanShopping, mergeShopping, commitList, loadShopping, saveShopping, sameShopping } from '../data/shoppingStore.js';

const STORAGE_KEY = 'flavor-user-profile-v2';

const DEFAULT_PROFILE = {
  cuisines: [],
  ingredients: [],
  recipes: [],
  cocktails: [],
  sauces: [],
  shares: [], // { id, kind, sourceId, fingerprint, name, createdAt, picture? } of the cook's live public links
  pairings: [], // { a, b } where a < b alphabetically (canonical key)
  quizAnswers: null,
  shopping: emptyShopping(), // SHOP-2: { list, removed } (src/data/shoppingStore.js); its device copy has its own key
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
    // Recipes the cook invented keep their id / method / cuisine / source.
    ...(typeof recipe.id === 'string' && recipe.id ? { id: recipe.id } : {}),
    ...(typeof recipe.instructions === 'string' && recipe.instructions ? { instructions: recipe.instructions } : {}),
    ...(typeof recipe.cuisine === 'string' && recipe.cuisine ? { cuisine: recipe.cuisine } : {}),
    ...(recipe.source === 'invent' ? { source: 'invent' } : {}),
    ...(typeof recipe.sharedFrom === 'string' && recipe.sharedFrom ? { sharedFrom: recipe.sharedFrom } : {}),
    // PICTURE-3: the picture field must survive every load, local and cloud (a normaliser once dropped `shares`).
    ...(cleanPictureField(recipe.picture) ? { picture: cleanPictureField(recipe.picture) } : {}),
  };
}

/** Live public links (SHARE-6): only well-formed entries survive a reload. */
function cleanShares(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const id = typeof s?.id === 'string' ? s.id : '';
    if (!/^[a-z0-9]{10}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      kind: String(s.kind || ''),
      sourceId: String(s.sourceId || ''),
      fingerprint: String(s.fingerprint || ''),
      name: String(s.name || '').slice(0, 80),
      createdAt: typeof s.createdAt === 'number' ? s.createdAt : 0,
      // PICTURE-4: what the link's picture is ({ kind:'icon', icon } | { kind:'chalk' }), so its cards draw the same one later.
      ...(sharedPictureField(s.picture) ? { picture: sharedPictureField(s.picture) } : {}),
    });
  }
  return out;
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
    // The shopping list has its own device key (one versioned key, kept apart from this blob), so it loads either way.
    if (!raw) return { ...DEFAULT_PROFILE, shopping: loadShopping() };
    const parsed = JSON.parse(raw);
    return {
      cuisines: Array.isArray(parsed.cuisines) ? parsed.cuisines : [],
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      // Collapse duplicates already written by the pre-COOKBOOK-2 append.
      // Last wins: the most recent save is the one the user meant to keep.
      recipes: Array.isArray(parsed.recipes) ? dedupeRecipes(parsed.recipes.map(normalizeRecipe)) : [],
      cocktails: Array.isArray(parsed.cocktails) ? parsed.cocktails : [],
      sauces: Array.isArray(parsed.sauces) ? parsed.sauces : [],
      shares: cleanShares(parsed.shares),
      pairings: Array.isArray(parsed.pairings)
        ? parsed.pairings.map((p) => canonicalPairing(p?.a, p?.b)).filter(Boolean)
        : [],
      quizAnswers: parsed.quizAnswers || null,
      shopping: loadShopping(),
    };
  } catch {
    return { ...DEFAULT_PROFILE, shopping: loadShopping() };
  }
}

function saveLocalProfile(profile) {
  const { shopping, ...rest } = profile;
  // The shopping list goes to its own key; a refusal there (a private window) leaves the list in memory for the session.
  if (shopping) saveShopping(shopping);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
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
  const mergeShares = (a, b) => {
    const seen = new Set(a.map((x) => x.id));
    return [...a, ...b.filter((x) => !seen.has(x.id))];
  };
  return {
    cuisines: mergeArrays(local.cuisines, cloud.cuisines),
    ingredients: mergeArrays(local.ingredients, cloud.ingredients),
    recipes: mergeRecipes(local.recipes, cloud.recipes),
    cocktails: mergeCocktails(local.cocktails || [], cloud.cocktails || []),
    sauces: mergeSauces(local.sauces || [], cloud.sauces || []),
    shares: mergeShares(local.shares || [], cloud.shares || []),
    quizAnswers: cloud.quizAnswers || local.quizAnswers || null,
    shopping: mergeShopping(local.shopping, cloud.shopping),
  };
}

export default function useUserProfile(user) {
  const [profile, setProfile] = useState(loadLocalProfile);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const skipNextSync = useRef(false);
  const syncedShopping = useRef(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const update = useCallback((updater) => {
    setProfile((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveLocalProfile(next);
      return next;
    });
  }, []);

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
            shares: cleanShares(cloudData.shares),
            quizAnswers: cloudData.quizAnswers || null,
            shopping: cleanShopping(cloudData.shopping),
          };
          const local = loadLocalProfile();
          const merged = mergeProfiles(local, cloud);
          // Saved on this device before the cloud copy loaded (an invention saved
          // right after sign-in): write the merge back instead of skipping it.
          const localOnly = merged.recipes.length > cloud.recipes.length
            || merged.cocktails.length > cloud.cocktails.length
            || merged.sauces.length > cloud.sauces.length
            || merged.shares.length > cloud.shares.length
            || !sameShopping(merged.shopping, cloud.shopping);
          skipNextSync.current = !localOnly;
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
    const write = () => setDoc(ref, profile).catch((err) => console.error('Failed to save cloud profile:', err));
    // SHOP-2: a changed shopping list is merged with what the account holds right now, per item, before it is
    // written, so a tick made on another device since this one loaded is not overwritten by the whole-document save.
    const shoppingChanged = syncedShopping.current !== profile.shopping;
    syncedShopping.current = profile.shopping;
    if (!shoppingChanged) { write(); return undefined; }
    let live = true;
    (async () => {
      try {
        const snap = await getDoc(ref);
        if (!live) return;
        if (snap.exists()) {
          const remote = cleanShopping(snap.data().shopping);
          const merged = mergeShopping(profile.shopping, remote);
          if (!sameShopping(merged, profile.shopping)) {
            // Fold the other device's changes in; this effect runs again for the result and writes it.
            update((prev) => ({ ...prev, shopping: mergeShopping(prev.shopping, remote) }));
            return;
          }
        }
      } catch (err) {
        console.error('Failed to read cloud shopping list:', err);
      }
      if (live) write();
    })();
    return () => { live = false; };
  }, [profile, user, cloudLoaded, update]);

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

  // --- Invented cocktails / sauces / recipes (src/data/savedInventions.js) ---
  // Synchronous so the caller can tell the cook what happened: the result is
  // known before this returns. The local write happens first; if it throws
  // (storage full or blocked) nothing changes and the reason comes back.
  const saveInvention = useCallback((input) => {
    const res = saveInventionInto(profileRef.current, input);
    if (!res.ok) return res;
    try {
      saveLocalProfile(res.profile);
    } catch {
      return { ok: false, profile: profileRef.current, item: null, reason: 'Could not save on this device. Nothing was lost; try again.' };
    }
    profileRef.current = res.profile;
    setProfile(res.profile);
    return res;
  }, []);

  // With a picture (PICTURE-3): the chooser value rides in input.picture (undefined = leave it, null = none,
  // { kind:'icon', icon } or { kind:'chalk', blob, mime, w, h }). The chalk document is written FIRST; if that
  // fails the item is still saved, without the picture, and `pictureReason` is one plain line to show.
  // A picture document with no item (the item write failed after it) is an orphan only its owner can read; it is removed here.
  const uid = user?.uid || '';
  const saveInventionWithPicture = useCallback(async (input) => {
    const kind = input?.kind;
    const id = input?.id || newItemId();
    const list = Array.isArray(profileRef.current?.[PROFILE_FIELD[kind]]) ? profileRef.current[PROFILE_FIELD[kind]] : [];
    const prev = cleanPictureField(list.find((x) => x?.id === id)?.picture);
    const prep = await prepareItemPicture({ db, uid, itemId: id, value: input?.picture, prev });
    const res = saveInvention({ ...input, id, picture: prep.field });
    if (!res.ok && input?.picture?.kind === 'chalk' && !prep.reason && prev?.kind !== 'chalk') await dropPicture({ db, uid, itemId: id });
    if (res.ok && prep.obsolete) await dropPicture({ db, uid, itemId: id });
    return prep.reason ? { ...res, pictureReason: prep.reason } : res;
  }, [uid, saveInvention]);

  const deleteInvention = useCallback((kind, id) => {
    const list = profileRef.current?.[PROFILE_FIELD[kind]];
    const had = (Array.isArray(list) ? list : []).find((x) => x?.id === id);
    const next = deleteInventionFrom(profileRef.current, kind, id);
    try {
      saveLocalProfile(next);
    } catch {
      return false;
    }
    profileRef.current = next;
    setProfile(next);
    if (had?.picture?.kind === 'chalk' && uid) dropPicture({ db, uid, itemId: id });
    return true;
  }, [uid]);

  // --- Shared links (SHARE-6): the cook's live public copies, kept so they can be listed and taken down ---
  const addShare = useCallback((entry) => {
    const [clean] = cleanShares([entry]);
    if (!clean) return false;
    update((prev) => ({
      ...prev,
      shares: [...cleanShares(prev.shares).filter((s) => s.id !== clean.id), clean],
    }));
    return true;
  }, [update]);

  const removeShare = useCallback((id) => {
    update((prev) => ({ ...prev, shares: cleanShares(prev.shares).filter((s) => s.id !== id) }));
  }, [update]);

  // --- Shopping list (SHOP-2) ---
  // `change` takes the current list and returns the next one (the pure functions in shoppingList.js); the
  // tombstones for whatever left the list are made here, from the difference. `opts.now` is for tests.
  const updateShopping = useCallback((change, opts = {}) => {
    update((prev) => {
      const cur = prev.shopping || emptyShopping();
      const nextList = change(cur.list);
      if (nextList === cur.list) return prev;
      return { ...prev, shopping: commitList(cur, nextList, opts) };
    });
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
    // Live public links stay listed: clearing the profile does not take them down, so the cook must still see them.
    // The shopping list is not part of the profile's saved taste data and is kept too.
    update((prev) => ({ ...DEFAULT_PROFILE, shares: cleanShares(prev.shares), shopping: prev.shopping || emptyShopping() }));
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
        shares: cleanShares(parsed.shares),
        pairings: Array.isArray(parsed.pairings)
          ? parsed.pairings.map((p) => canonicalPairing(p?.a, p?.b)).filter(Boolean)
          : [],
        quizAnswers: parsed.quizAnswers || null,
      };
      update((prev) => ({ ...validated, shopping: prev.shopping || emptyShopping() }));
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
    saveInvention,
    saveInventionWithPicture,
    deleteInvention,
    addShare,
    removeShare,
    updateShopping,
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
