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
    if (['citrus', 'acid', 'dairy', 'umami', 'fat', 'nut'].includes(c) || ACID.test(n)) roles.acidRich = true;
    if (['herb', 'spice', 'chili', 'seasoning'].includes(c)) roles.herbSpice = true;
  }
  return roles;
}

/** The recipeHandoff for an invention (amounts from quantityRuntime, if any). */
export function inventionHandoff(inv, { amounts = null, closest = null } = {}) {
  return {
    source: 'make-invent',
    mode: 'recipe',
    ingredients: inv.ingredients.map((i) => ({ ingredient: i.name, amount: amounts?.get?.(i.name) || null })),
    title: inv.name,
    steps: closest?.steps || [],
    stepsFrom: closest?.title || '',
    recipeType: null,
    image: null,
    ts: Date.now(),
  };
}
