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

export const MY_KITCHEN_KEY = 'fn-my-kitchen';
export const ASSUME_BASICS_KEY = 'fn-my-kitchen-basics';

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

/** The stored form of what the cook typed: graph name if it resolves. */
export function kitchenKey(raw, names = new Set()) {
  const text = String(raw || '').trim();
  if (!text) return '';
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
 * Does the kitchen cover one recipe ingredient?
 * @returns {{ covered: boolean, via?: string, basic?: boolean }}
 */
export function haveIngredient(name, kitchenSet, { assumeBasics = true, names = null } = {}) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return { covered: true, basic: true };
  if (kitchenSet.has(n)) return { covered: true, via: n };
  for (const eq of EQUIVALENT[n] || []) if (kitchenSet.has(eq)) return { covered: true, via: eq };
  // Clarified butter when butter is an assumed basic.
  if (assumeBasics && (EQUIVALENT[n] || []).some(isBasic)) return { covered: true, basic: true };
  if (names) {
    const r = resolveIngredientName(n, names);
    if (r && kitchenSet.has(r)) return { covered: true, via: r };
    // "cold butter" resolves to butter, an assumed basic.
    if (r && assumeBasics && isBasic(r)) return { covered: true, basic: true };
  }
  if (assumeBasics && isBasic(n)) return { covered: true, basic: true };
  return { covered: false };
}

/**
 * Coverage of one ingredient list by the kitchen.
 * @returns {{ total: number, covered: number, missing: string[], have: string[] }}
 *   `total` excludes assumed basics, so "4 of 5" counts real ingredients.
 */
export function coverIngredients(ingredients, kitchen, opts = {}) {
  const kitchenSet = kitchen instanceof Set ? kitchen : new Set(kitchen || []);
  const missing = [];
  const have = [];
  let total = 0;
  for (const raw of ingredients || []) {
    const name = typeof raw === 'string' ? raw : raw?.name;
    if (!name) continue;
    const c = haveIngredient(name, kitchenSet, opts);
    if (c.basic) continue;
    total += 1;
    if (c.covered) have.push(name); else missing.push(name);
  }
  return { total, covered: total - missing.length, missing, have };
}

/**
 * Rank items (recipes or sauces: anything with `ingredients`) by what the
 * kitchen covers. `make`: nothing missing. `nearly`: 1..maxMissing missing,
 * fewest first, then most covered.
 */
export function whatCanICook(items, kitchen, { maxMissing = 2, ...opts } = {}) {
  const make = [];
  const nearly = [];
  for (const item of items || []) {
    const c = coverIngredients(item.ingredients, kitchen, opts);
    if (c.total === 0) continue;
    const entry = { item, ...c };
    if (c.missing.length === 0) make.push(entry);
    else if (c.missing.length <= maxMissing && c.covered >= 1) nearly.push(entry);
  }
  make.sort((a, b) => b.total - a.total);
  nearly.sort((a, b) => a.missing.length - b.missing.length || b.covered - a.covered);
  return { make, nearly };
}
