/**
 * myKitchen.js — what the cook has on hand, for "What's in my kitchen?"
 * (recipes, in Make) and the Sauce Lab pantry. One list, shared by both.
 * The food counterpart of myBar.js.
 *
 * Kept on this device only (localStorage). Items are stored as graph
 * ingredient names where they resolve ("2 cloves garlic" → "garlic"),
 * otherwise as the cleaned text.
 *
 * Basics (salt, pepper, oil, butter, …) are assumed by default, so a
 * recipe is not "one away" because nobody typed salt. The cook can turn
 * that off.
 */
import { resolveIngredientName, isTrivialIngredient } from './recipePairingMatch.js';
import { normalizeIngredient } from './normalizeIngredient.js';
import { findSwap } from './kitchenSwaps.js';

export const MY_KITCHEN_KEY = 'fn-my-kitchen';
export const ASSUME_BASICS_KEY = 'fn-my-kitchen-basics';
export const SPICE_RACK_KEY = 'fn-my-kitchen-spices';

/**
 * The "Spice rack" switch (WEAK-3, default off): common dried spices count
 * as on hand, the way basics do. Spellings a recipe uses for the same jar
 * are listed too (ground cumin, chili flakes / red pepper flakes, bay leaves).
 */
export const SPICE_RACK = [
  'cumin', 'paprika', 'cinnamon', 'chili flakes', 'oregano', 'thyme', 'black pepper',
  'nutmeg', 'bay leaf', 'coriander', 'turmeric', 'garam masala', 'curry powder',
  'cayenne', 'garlic powder', 'onion powder',
];
const SPICE_RACK_SET = new Set([
  ...SPICE_RACK,
  'ground cumin', 'cumin seed', 'cumin seeds', 'smoked paprika', 'sweet paprika',
  'ground cinnamon', 'cinnamon stick', 'red pepper flakes', 'crushed red pepper', 'dried oregano',
  'dried thyme', 'peppercorn', 'peppercorns', 'ground nutmeg', 'bay leaves', 'ground coriander',
  'coriander seed', 'coriander seeds', 'ground turmeric', 'cayenne pepper',
]);
export function isSpiceRackItem(name) {
  return SPICE_RACK_SET.has(String(name || '').toLowerCase().trim());
}

// What the cook types → the name a recipe uses, where the graph's own
// resolution would pick the wrong node ("bell pepper" is not "pepper",
// "vegetable oil" is not "vegetable").
const KITCHEN_ALIAS = {
  'bell pepper': 'sweet pepper', 'bell peppers': 'sweet pepper', 'red bell pepper': 'sweet pepper',
  'green bell pepper': 'sweet pepper', 'yellow bell pepper': 'sweet pepper', capsicum: 'sweet pepper',
};

/** Assumed to be in any kitchen unless the cook says otherwise. */
export const PANTRY_BASICS = [
  'salt', 'black pepper', 'pepper', 'water', 'olive oil', 'vegetable oil', 'oil',
  'butter', 'sugar', 'flour', 'all purpose flour',
];
const BASICS = new Set(PANTRY_BASICS);

// Same thing, different words on the shelf vs in a recipe.
const EQUIVALENT = {
  'lemon juice': ['lemon'], lemon: ['lemon juice'],
  'lime juice': ['lime'], lime: ['lime juice'],
  'vegetable oil': ['canola oil', 'sunflower oil', 'olive oil'],
  'canola oil': ['vegetable oil', 'sunflower oil'],
  'chicken stock': ['chicken broth'], 'chicken broth': ['chicken stock'],
  'beef stock': ['beef broth'], 'beef broth': ['beef stock'],
  'vegetable stock': ['vegetable broth'], 'vegetable broth': ['vegetable stock'],
  scallion: ['green onion', 'spring onion'], 'green onion': ['scallion', 'spring onion'],
  cilantro: ['coriander'], coriander: ['cilantro'],
  'heavy cream': ['cream', 'double cream', 'whipping cream'], cream: ['heavy cream', 'double cream'],
  // A tortilla is a tortilla; a bell pepper on the shelf is a sweet pepper.
  'corn tortilla': ['tortilla', 'corn tortillas'], 'flour tortilla': ['tortilla', 'flour tortillas'],
  'sweet pepper': ['bell pepper', 'red bell pepper', 'green bell pepper'],
  egg: ['eggs'], eggs: ['egg'],
  // A whole egg on the shelf covers a recipe's yolks (and a pantry of
  // "lemons" covers zest as well as juice).
  'egg yolk': ['egg', 'eggs', 'egg yolks'], 'egg yolks': ['egg yolk', 'egg', 'eggs'],
  'lemon zest': ['lemon'], 'lime zest': ['lime'],
  'dry white wine': ['white wine'], 'white wine': ['dry white wine'],
  'creme fraiche': ['crème fraîche'], 'crème fraîche': ['creme fraiche'],
  // Butter you clarify, chill or salt yourself is still butter.
  'clarified butter': ['butter'], 'cold butter': ['butter'], 'unsalted butter': ['butter'], 'salted butter': ['butter'],
};

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Read the kitchen. Missing / unreadable / malformed storage → []. */
export function loadKitchen(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(MY_KITCHEN_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === 'string' && x.trim()))] : [];
  } catch {
    return [];
  }
}

/** Write the kitchen. Returns false when storage is unavailable. */
export function saveKitchen(items, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(MY_KITCHEN_KEY, JSON.stringify(items || []));
    return true;
  } catch {
    return false;
  }
}

/** Whether basics are assumed (default true). */
export function loadAssumeBasics(storage = defaultStorage()) {
  try { return storage?.getItem(ASSUME_BASICS_KEY) !== '0'; } catch { return true; }
}
export function saveAssumeBasics(on, storage = defaultStorage()) {
  try { storage?.setItem(ASSUME_BASICS_KEY, on ? '1' : '0'); return true; } catch { return false; }
}

/** Whether the spice rack is assumed (default false). */
export function loadSpiceRack(storage = defaultStorage()) {
  try { return storage?.getItem(SPICE_RACK_KEY) === '1'; } catch { return false; }
}
export function saveSpiceRack(on, storage = defaultStorage()) {
  try { storage?.setItem(SPICE_RACK_KEY, on ? '1' : '0'); return true; } catch { return false; }
}

/** The stored form of what the cook typed: graph name if it resolves. */
export function kitchenKey(raw, names = new Set()) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  if (KITCHEN_ALIAS[lower]) return KITCHEN_ALIAS[lower];
  // Basics as typed: "vegetable oil" must not resolve to "vegetable".
  if (BASICS.has(lower)) return lower;
  const resolved = names.size ? resolveIngredientName(text, names) : null;
  return resolved || normalizeIngredient(text) || text.toLowerCase();
}

export function addToKitchen(kitchen, raw, names) {
  const key = kitchenKey(raw, names);
  return key && !kitchen.includes(key) ? [...kitchen, key] : kitchen;
}

export function removeFromKitchen(kitchen, key) {
  return kitchen.filter((k) => k !== key);
}

/** Is a basic (assumed when assumeBasics is on)? */
export function isBasic(name) {
  const n = String(name || '').toLowerCase().trim();
  return BASICS.has(n) || isTrivialIngredient(n);
}

/**
 * Does the kitchen cover one recipe ingredient? (No swaps here: those are
 * coverIngredients' `swaps` option.)
 * @returns {{ covered: boolean, via?: string, basic?: boolean, spice?: boolean }}
 *   `spice`: assumed because the spice rack is on (also `basic`).
 */
export function haveIngredient(name, kitchenSet, { assumeBasics = true, spiceRack = false, names = null } = {}) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return { covered: true, basic: true };
  if (kitchenSet.has(n)) return { covered: true, via: n };
  if (spiceRack && isSpiceRackItem(n)) return { covered: true, basic: true, spice: true };
  for (const eq of EQUIVALENT[n] || []) if (kitchenSet.has(eq)) return { covered: true, via: eq };
  // Clarified butter when butter is an assumed basic.
  if (assumeBasics && (EQUIVALENT[n] || []).some(isBasic)) return { covered: true, basic: true };
  if (names) {
    const r = resolveIngredientName(n, names);
    if (r && kitchenSet.has(r)) return { covered: true, via: r };
    if (r && spiceRack && isSpiceRackItem(r)) return { covered: true, basic: true, spice: true };
    // "cold butter" resolves to butter, an assumed basic.
    if (r && assumeBasics && isBasic(r)) return { covered: true, basic: true };
  }
  if (assumeBasics && isBasic(n)) return { covered: true, basic: true };
  return { covered: false };
}

/**
 * Coverage of one ingredient list by the kitchen.
 *
 * Options (besides haveIngredient's):
 *   mainOf(name) → boolean — split mode (WEAK-3, Cookbook recipes): only
 *     mains count; a missing supporting item (a spice, herb, condiment…)
 *     goes to `better` ("even better with") instead of `missing`.
 *   swaps — try the everyday swap table (kitchenSwaps.js) for an item the
 *     kitchen lacks: "use your onion for the scallion". A swapped item
 *     counts as covered and is listed in `swaps`.
 *
 * @returns {{ total: number, covered: number, missing: string[], have: string[],
 *   better: string[], swaps: { for: string, use: string, plus: string[], main: boolean }[] }}
 *   `total` excludes assumed basics, so "4 of 5" counts real ingredients;
 *   in split mode it counts mains only (`have` still lists every covered item).
 */
const FINISHING_MEASURE = /\b(pinch|dash|to taste|garnish|optional)\b/i;

export function coverIngredients(ingredients, kitchen, opts = {}) {
  const { mainOf = null, swaps: useSwaps = false } = opts;
  const kitchenSet = kitchen instanceof Set ? kitchen : new Set(kitchen || []);
  const missing = [];
  const have = [];
  const better = [];
  const swaps = [];
  const nameOf = (raw) => (typeof raw === 'string' ? raw : raw?.name);
  const inRecipe = new Set((ingredients || []).map((r) => String(nameOf(r) || '').toLowerCase().trim()).filter(Boolean));
  const has = (x) => haveIngredient(x, kitchenSet, opts).covered;
  let total = 0;
  for (const raw of ingredients || []) {
    const name = nameOf(raw);
    if (!name) continue;
    let c = haveIngredient(name, kitchenSet, opts);
    if (c.basic) continue;
    const main = mainOf ? !!mainOf(name) : true;
    if (!c.covered && useSwaps) {
      const swap = findSwap(name, has, { main: mainOf ? main : false, inRecipe });
      if (swap) { swaps.push({ for: name, use: swap.use, plus: swap.plus, main }); c = { covered: true, swap: true }; }
    }
    // A pinch of nutmeg or a dash of cayenne is a finish, not a reason the
    // dish can't be made: like basics, it neither counts nor goes missing.
    if (!c.covered && typeof raw === 'object' && FINISHING_MEASURE.test(String(raw?.measure || ''))) continue;
    if (!main) {
      if (c.covered) have.push(name); else better.push(name);
      continue;
    }
    total += 1;
    if (c.covered) have.push(name); else missing.push(name);
  }
  return { total, covered: total - missing.length, missing, have, better, swaps };
}

/**
 * Rank items (recipes or sauces: anything with `ingredients`) by what the
 * kitchen covers. `make`: nothing missing. `nearly`: 1..maxMissing missing,
 * fewest first, then most covered.
 *
 * `mainOfItem(item)` → mainOf for that item turns on split mode (see
 * coverIngredients): an item is `make` when every MAIN is covered. With
 * `swaps`, entries carry `withSwap` when a swap covers one of its mains.
 */
export function whatCanICook(items, kitchen, { maxMissing = 2, mainOfItem = null, ...opts } = {}) {
  const make = [];
  const nearly = [];
  for (const item of items || []) {
    // Prefer the detailed list ({name, measure}) when there is one, so a
    // "pinch" can be recognised as a finish (sauces carry both).
    const list = item.ingredientsDetailed?.length ? item.ingredientsDetailed : item.ingredients;
    const mainOf = mainOfItem ? mainOfItem(item) : null;
    const c = coverIngredients(list, kitchen, { ...opts, mainOf });
    if (c.total === 0) continue;
    const entry = { item, ...c, withSwap: c.swaps.some((s) => s.main) };
    if (c.missing.length === 0) make.push(entry);
    else if (c.missing.length <= maxMissing && c.covered >= 1) nearly.push(entry);
  }
  make.sort((a, b) => (a.withSwap ? 1 : 0) - (b.withSwap ? 1 : 0)
    || a.better.length - b.better.length
    || b.total - a.total);
  nearly.sort((a, b) => a.missing.length - b.missing.length || b.covered - a.covered);
  return { make, nearly };
}
