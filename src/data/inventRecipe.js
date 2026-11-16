/**
 * inventRecipe.js — helpers for "Invent a recipe" in the Recipe Lab.
 *
 * The panel (InventRecipe.jsx) asks for a dish type, then a main, then lets
 * the cook build the dish slot by slot (dishSkeletons.js, inventBuild.js).
 * This module holds what that flow shares with the rest of the app:
 *   - cuisine chips: cuisineOptions, kitchenCuisines (the cuisines a kitchen leans toward)
 *   - pairStrength: the strength of a pair in a pairing index
 *   - recipeRoles: which balance roles (main, vegetable, starch, aromatic,
 *     acid or richness, herb or spice) a set of ingredients fills
 *   - isBasicLike: oils, salt, pepper and the like, assumed to be in the kitchen
 *   - inventionHandoff: the recipeHandoff that writes a built dish to the Notebook
 *
 * The finished-idea generator that used to live here (inventRecipes, Shuffle
 * and its scoring terms) was retired on 2026-11-14.
 */
import { isBasic } from './myKitchen.js';

export const INVENT_ALPHA = 0;     // no popularity discount: it promotes rare oddities here

// Oils, fats and seasonings read as "basics" even when the name is longer.
// Pepper only as the spice: "red pepper" / "bell pepper" are vegetables.
const BASIC_LIKE = /\boil\b|\bsalt\b|^((ground |cracked )?(black|white) |ground )?pepper(corns?)?$|^water$|^sugar$|^flour$|\bshortening\b|\bmargarine\b|\bcooking spray\b/;

const lower = (s) => String(s || '').toLowerCase().trim();

/** Cuisine chips: the model's title-case cuisines, first spelling only, no "Global". */
export function cuisineOptions(cuisineVocab) {
  const seen = new Set();
  const out = [];
  for (const c of cuisineVocab || []) {
    if (typeof c !== 'string' || !/^[A-Z]/.test(c) || c === 'Global') continue;
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/**
 * The cuisines a kitchen leans toward: each item's node cuisines, weighted
 * by position (its first-listed cuisine counts most), resolved against the
 * model's vocab. Most-leaned first.
 */
export function kitchenCuisines(kitchen, nodes, cuisineVocab, n = 3) {
  if (!Array.isArray(kitchen) || !nodes || typeof nodes.get !== 'function') return [];
  const canon = new Map();
  for (const c of cuisineOptions(cuisineVocab)) canon.set(c.toLowerCase(), c);
  const tally = new Map();
  for (const item of kitchen) {
    const cs = nodes.get(item)?.cuisines;
    if (!Array.isArray(cs)) continue;
    cs.forEach((raw, i) => {
      const hit = canon.get(lower(raw).replace(/ cuisine$/, '').trim());
      if (hit) tally.set(hit, (tally.get(hit) || 0) + 1 / (i + 1));
    });
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c);
}

export function pairStrength(index, a, b) {
  return index?.strength?.get(`${a}|${b}`) || 0;
}

/** Basics, plus longer names for the same thing ("extra-virgin olive oil"). */
export function isBasicLike(name) {
  const n = String(name || '').toLowerCase().trim();
  return isBasic(n) || BASIC_LIKE.test(n);
}

const AROMATIC = /^(garlic|onion|shallot|red onion|yellow onion|white onion)$/;
const LEGUME = /\b(beans?|lentils?|chickpeas?|garbanzos?|tofu|tempeh|edamame|split peas?)\b/;
const STARCHY = /\b(potato(es)?|yams?|cassava|plantains?|gnocchi|tortillas?|bread|noodles?|pasta|rice|couscous|quinoa|polenta)\b/;
const ACID = /vinegar|\bwine\b|lemon|lime|yogurt|sour cream/;

/** Which balance roles a set of ingredients fills. */
export function recipeRoles(names, { nodes = null, main = null } = {}) {
  const cat = (n) => nodes?.get?.(n)?.category;
  const roles = { main: false, vegetable: false, starch: false, aromatic: false, acidRich: false, herbSpice: false };
  for (const n of names) {
    const c = cat(n);
    if (n === main || c === 'protein' || LEGUME.test(n)) roles.main = true;
    if (c === 'grain' || (STARCHY.test(n) && c !== 'protein')) roles.starch = true;
    else if (c === 'vegetable') roles.vegetable = true;
    if (c === 'aromatic' || AROMATIC.test(n)) roles.aromatic = true;
    if (['citrus', 'acid', 'dairy', 'savory seasoning', 'fat', 'nut'].includes(c) || ACID.test(n)) roles.acidRich = true;
    if (['herb', 'spice', 'chili', 'seasoning'].includes(c)) roles.herbSpice = true;
  }
  return roles;
}

/**
 * The recipeHandoff for an invention (amounts from quantityRuntime, if any).
 * `inv.type` (a dishSkeletons id) and `inv.cuisine` ride along so the builder reopens on the same dish.
 */
export function inventionHandoff(inv, { amounts = null, closest = null } = {}) {
  return {
    source: 'make-invent',
    mode: 'recipe',
    ingredients: inv.ingredients.map((i) => ({ ingredient: i.name, amount: amounts?.get?.(i.name) || null })),
    title: inv.name,
    steps: closest?.steps || [],
    stepsFrom: closest?.title || '',
    recipeType: null,
    type: inv.type || null,
    cuisine: inv.cuisine || null,
    image: null,
    ts: Date.now(),
  };
}

const amountText = (a) => (typeof a === 'string' ? a.trim() : (a && typeof a.raw === 'string' ? a.raw.trim() : ''));

/**
 * A recipeHandoff (or a profile recipe) as the seed the chalkboard builder opens on.
 * Ingredients may be names, BowlEntry { ingredient, amount } or { name, raw }; they are the cook's own lines (source 'user',
 * so none is labelled "from your search"). A handoff that
 * already carries a `seed` (a search or a shared page's "Make it your own") passes it through.
 * Carries the title, method steps, photo, dish type (`type`, applied only when given) and cuisine.
 * `editId` reopens a saved invention under its own id; `replaces` is the name of a recipe the old
 * Notebook saved (names only, no id) so that saving replaces it instead of adding a second.
 */
export function seedFromHandoff(h) {
  if (!h || typeof h !== 'object') return null;
  if (h.seed && typeof h.seed === 'object') return h.seed;
  const seen = new Set();
  const pinned = [];
  for (const it of Array.isArray(h.ingredients) ? h.ingredients : []) {
    const key = lower(typeof it === 'string' ? it : (it?.ingredient ?? it?.name));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const amount = typeof it === 'string' ? '' : amountText(it.amount);
    pinned.push({ key, source: 'user', ...(amount ? { amount } : {}) });
  }
  return {
    pinned,
    ...(typeof h.title === 'string' && h.title.trim() ? { title: h.title.trim() } : {}),
    ...(Array.isArray(h.steps) && h.steps.length ? { steps: h.steps.map(String), stepsFrom: h.stepsFrom || '' } : {}),
    ...(h.image ? { image: h.image } : {}),
    ...(h.type ? { type: h.type, fromName: true } : {}),
    ...(h.cuisine ? { cuisine: h.cuisine } : {}),
    ...(h.editId ? { editId: h.editId } : {}),
    ...(h.replaces ? { replaces: h.replaces } : {}),
  };
}

/**
 * A recipe from the profile (the Cookbook and Profile list these) as a handoff for the builder.
 * Amounts come from `raw` ("2 cups rice") when it ends with the ingredient's name; a recipe saved
 * by the old Notebook has only names, so it opens with no amounts.
 */
export function handoffFromProfileRecipe(recipe) {
  const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((i) => {
    if (typeof i === 'string') return i;
    const name = lower(i?.name);
    const raw = String(i?.raw || '').trim();
    const rest = raw && lower(raw).endsWith(name) ? raw.slice(0, raw.length - name.length).trim() : '';
    return { ingredient: name, amount: rest ? { raw: rest } : null };
  }).filter((i) => (typeof i === 'string' ? i : i.ingredient));
  const own = typeof recipe?.id === 'string' && recipe.id && recipe.source === 'invent';
  return {
    source: 'profile',
    mode: 'recipe',
    ingredients,
    title: recipe?.name || '',
    cuisine: recipe?.cuisine || null,
    ...(own ? { editId: recipe.id } : { replaces: recipe?.name || '' }),
    ts: Date.now(),
  };
}
