/**
 * kitchenRecipes.js — "What's in my kitchen?" on the Make screen (KITCHEN-2).
 *
 * Pure helpers behind KitchenPanel: the add-box autocomplete, quick-add
 * chips, and the two result lists —
 *   • Cookbook recipes the kitchen covers (or nearly covers), via
 *     myKitchen.whatCanICook;
 *   • real RecipeNLG recipes (the 40k directions index) that use what the
 *     cook has, each with what they have and what they are missing.
 *
 * The kitchen list itself, its storage and the coverage rules (basics
 * assumed, lemon ≈ lemon juice, …) live in myKitchen.js and are shared
 * with the Sauce Lab.
 */
import { whatCanICook, coverIngredients, isBasic } from './myKitchen.js';
import { normalizeText } from './ingredientSearch.js';
import { retrieveDirections } from '../ml/directionsRuntime.js';
import { normalizeTitle } from '../ml/directionsQuality.js';
import { mainsOf } from './recipeMains.js';
import { resolveIngredientName } from './recipePairingMatch.js';

/**
 * The ingredients the Cookbook uses most, basics excluded — the quick-add
 * chips. Adding them is what unlocks the most Cookbook recipes.
 */
export function commonKitchenIngredients(recipes, n = 18) {
  const count = new Map();
  for (const r of recipes || []) {
    for (const raw of new Set(r?.ingredients || [])) {
      const name = String(raw || '').toLowerCase().trim();
      if (!name || isBasic(name)) continue;
      count.set(name, (count.get(name) || 0) + 1);
    }
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name]) => name);
}

/** Ingredient names worth offering in the add box (≤ 3 words), sorted. */
export function kitchenVocab(names, { maxWords = 3 } = {}) {
  const out = new Set();
  for (const raw of names || []) {
    const name = String(raw || '').toLowerCase().trim();
    if (!name || name.split(/\s+/).length > maxWords) continue;
    out.add(name);
  }
  return [...out].sort();
}

/**
 * Autocomplete for the add box: names starting with the text first, then
 * names with a word starting with it, then names containing it; shorter
 * names first within each tier. Items already in the kitchen are skipped.
 */
export function kitchenSuggestions(text, vocab, kitchen = [], n = 6) {
  const q = normalizeText(text);
  if (!q) return [];
  const have = new Set(kitchen);
  const tiers = [[], [], []];
  for (const name of vocab || []) {
    if (have.has(name)) continue;
    const norm = normalizeText(name);
    if (norm.startsWith(q)) tiers[0].push(name);
    else if (norm.split(' ').some((w) => w.startsWith(q))) tiers[1].push(name);
    else if (q.length >= 3 && norm.includes(q)) tiers[2].push(name);
  }
  const byLength = (a, b) => a.length - b.length || a.localeCompare(b);
  return tiers.flatMap((t) => t.sort(byLength)).slice(0, n);
}

/** "missing basil" · "missing basil and lime" · "missing basil, lime and 2 more". */
export function missingText(missing, max = 2) {
  const list = (missing || []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return `missing ${list[0]}`;
  if (list.length === 2 && max >= 2) return `missing ${list[0]} and ${list[1]}`;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return rest > 0
    ? `missing ${shown.join(', ')} and ${rest} more`
    : `missing ${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

/**
 * Cookbook recipes the kitchen covers (WEAK-3). `make`: every MAIN is
 * covered, directly or by an everyday swap (kitchenSwaps.js; `withSwap`
 * marks those); missing supporting items ride along as `better` ("even
 * better with: thyme"). `nearly`: one or two mains away. An empty kitchen
 * makes nothing (a recipe of only basics would otherwise count as
 * "covered").
 *
 * `categoryOf(name)` → ingredient-graph category (recipeMains.categoryLookup
 * over the graph nodes); without it mains are guessed from the name.
 */
export function cookbookForKitchen(recipes, kitchen, {
  assumeBasics = true, spiceRack = false, names = null, maxMissing = 2, categoryOf = null,
} = {}) {
  if (!kitchen || kitchen.length === 0) return { make: [], nearly: [] };
  const resolve = names ? (n) => resolveIngredientName(n, names) : null;
  const mainOfItem = (r) => mainsOf(r, { categoryOf: categoryOf || (() => null), resolve });
  return whatCanICook(recipes, kitchen, { maxMissing, assumeBasics, spiceRack, names, mainOfItem, swaps: true });
}

// Vocab words that, in a title, name the dish rather than an ingredient.
const DISH_WORDS = new Set(['soup', 'stew', 'cake', 'cookie', 'bread', 'pie', 'tart', 'chili', 'casserole', 'dip', 'salad', 'sandwich', 'pizza', 'muffin', 'biscuit', 'pudding', 'punch', 'candy', 'fudge', 'brownie', 'bar', 'loaf']);

function singularIn(word, vocabSet) {
  if (vocabSet.has(word)) return word;
  if (word.endsWith('ies') && vocabSet.has(`${word.slice(0, -3)}y`)) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && vocabSet.has(word.slice(0, -2))) return word.slice(0, -2);
  if (word.endsWith('s') && vocabSet.has(word.slice(0, -1))) return word.slice(0, -1);
  return null;
}

/**
 * Ingredients a recipe title names ("Cajun 15 Bean Soup" → bean). The
 * directions index keeps only the ingredients that mapped to the model
 * vocab, so a recipe's list can silently lack its headline ingredient;
 * the title is the cheapest second witness. Two-word names win over one.
 */
export function titleIngredients(title, vocabSet) {
  const words = normalizeText(title).split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const two = i + 1 < words.length ? singularIn(`${words[i]} ${words[i + 1]}`, vocabSet) : null;
    if (two) { out.push(two); i += 1; continue; }
    const one = singularIn(words[i], vocabSet);
    if (one && !DISH_WORDS.has(one)) out.push(one);
  }
  return [...new Set(out)];
}

/**
 * Real recipes (RecipeNLG directions index) that use what is in the
 * kitchen, ranked for "can I cook this": many of its ingredients on hand,
 * few missing. Jaccard retrieval gathers a pool; coverage re-ranks it.
 *
 * @returns {Array<{ title, steps, ingredients, have, missing, total, covered, jaccard }>}
 */
export function realRecipesForKitchen(kitchen, index, vocab, {
  assumeBasics = true, k = 8, pool = 80, maxMissing = 4, names = null, spiceRack = false,
} = {}) {
  if (!kitchen || kitchen.length === 0 || !index || !Array.isArray(vocab)) return [];
  const query = [...new Set(kitchen.map((x) => String(x).toLowerCase()))];
  const minOverlap = Math.min(2, query.length);
  const found = retrieveDirections(query, index, vocab, { k: pool, minOverlap });
  const kitchenSet = new Set(query);
  const vocabSet = new Set(vocab.map((v) => String(v).toLowerCase()));
  const seenTitles = new Set();
  const out = [];
  for (const rec of found) {
    const title = String(rec.title || '').trim();
    // One result per normalised title (WEAK-2 safety net): "Mom's Chili"
    // and "Moms Chili!" are the same card to the cook.
    const titleKey = normalizeTitle(title) || title.toLowerCase();
    if (!title || seenTitles.has(titleKey)) continue;
    const listed = rec.ingredients || rec.matchedNames || [];
    const named = titleIngredients(title, vocabSet);
    const ingredients = [...new Set([...listed, ...named])];
    const c = coverIngredients(ingredients, kitchenSet, { assumeBasics, spiceRack, names });
    if (c.covered < Math.min(2, c.total) || c.missing.length > maxMissing) continue;
    seenTitles.add(titleKey);
    out.push({
      title,
      steps: Array.isArray(rec.steps) ? rec.steps : [],
      ingredients,
      have: c.have,
      missing: c.missing,
      total: c.total,
      covered: c.covered,
      jaccard: rec.jaccard,
      // A title naming none of its ingredients may be about something the
      // index dropped ("Barbecue Wieners"), so it ranks a little lower.
      rank: c.covered - 1.5 * c.missing.length - (named.length ? 0 : 0.5),
    });
  }
  out.sort((a, b) => b.rank - a.rank || b.jaccard - a.jaccard);
  return out.slice(0, k);
}

/**
 * The closest real recipe to a set of ingredients (an invented dish):
 * the best Jaccard match whose title names at least one of the dish's
 * ingredients and none outside it. "Cajun 15 Bean Soup" is not close to a
 * bean-less dish, and a title naming nothing ("Barbecue Wieners") may be
 * about something the index never kept, so it is not offered either —
 * no line beats a misleading one.
 */
export function closestRealRecipe(names, index, vocab, { pool = 60 } = {}) {
  if (!Array.isArray(names) || names.length === 0 || !index || !Array.isArray(vocab)) return null;
  const vocabSet = new Set(vocab.map((v) => String(v).toLowerCase()));
  const have = new Set(names.map((n) => String(n).toLowerCase()));
  const found = retrieveDirections([...have], index, vocab, { k: pool, minOverlap: Math.min(2, have.size) });
  return found.find((rec) => {
    const named = titleIngredients(rec.title, vocabSet);
    return named.length > 0 && named.every((t) => have.has(t));
  }) || null;
}

/**
 * The recipeHandoff for a real recipe: the ingredients the cook has
 * (plus assumed basics the recipe uses), the title, and its steps.
 */
export function realRecipeHandoff(match, { assumeBasics = true } = {}) {
  const basics = assumeBasics ? (match.ingredients || []).filter((n) => isBasic(n)) : [];
  return {
    source: 'make-kitchen',
    mode: 'recipe',
    ingredients: [...new Set([...(match.have || []), ...basics])],
    title: match.title || '',
    steps: Array.isArray(match.steps) ? match.steps : [],
    stepsFrom: match.title || '',
    missing: match.missing || [],
    recipeType: null,
    image: null,
    ts: Date.now(),
  };
}
