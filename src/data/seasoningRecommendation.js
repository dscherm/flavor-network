/**
 * seasoningRecommendation.js — bowl-aware seasoning ranker for the
 * "Suggested seasonings" chip row (RL-SEASONING-SUGGEST,
 * RECIPE-LAB-SPEC §15.3).
 *
 * Approach: derive the seasoning subset at runtime from the existing
 * `nodes` Map (every node has a `category` field — see useProData). No
 * separate seasonings dataset is required; the subset is everything
 * tagged `spice` / `herb` / `aromatic` / `seasoning` (RL-SEASONINGS-DATA
 * was retired in favor of this derivation 2026-05-29).
 *
 * Ranking re-uses the §13 NPMI math via rankSuggestions(), restricted to
 * the seasoning subset via the candidates allow-list. Recipe-type gate
 * applies §15.3 tone filter:
 *   Main / Side / Appetizer → all savory categories (default)
 *   Dessert                 → sweet-finishing-only allowlist
 *   Drink                   → cocktail-bitters/aromatic-only allowlist
 *   Sauce                   → all categories enabled
 */

import { rankSuggestions } from './recipeSuggestionEngine.js';

export const SEASONING_CATEGORIES = new Set([
  'spice', 'herb', 'aromatic', 'seasoning',
]);

// §15.3 dessert tone: sweet-friendly finishing spices. Hardcoded
// because the category field doesn't distinguish "warm baking spice"
// from savory spice. Names match ingredients.json keys verbatim.
const SWEET_FRIENDLY = new Set([
  'cinnamon', 'cardamom', 'anise', 'star anise', 'nutmeg', 'cloves',
  'vanilla', 'mace', 'allspice', 'ginger', 'mint', 'lavender',
  'rose', 'orange blossom', 'fennel seed',
]);

// §15.3 drink tone: cocktail-bitters / aromatic finishers.
const DRINK_FRIENDLY = new Set([
  'mint', 'basil', 'rosemary', 'thyme', 'bitters', 'angostura bitters',
  'orange bitters', 'cardamom', 'cinnamon', 'ginger', 'star anise',
  'lemon zest', 'orange zest', 'grapefruit zest', 'sage', 'lavender',
]);

export function isSeasoning(node) {
  if (!node) return false;
  const cat = String(node.category || '').toLowerCase();
  return SEASONING_CATEGORIES.has(cat);
}

/**
 * Build the seasoning name list from a nodes Map (or Object). Returns
 * lower-cased names that satisfy isSeasoning(). Cached at the call site
 * via useMemo; this function recomputes every call.
 */
export function deriveSeasoningPool(nodes) {
  if (!nodes) return [];
  const out = [];
  if (typeof nodes.forEach === 'function') {
    nodes.forEach((v, k) => { if (isSeasoning(v)) out.push(k); });
  } else {
    for (const k of Object.keys(nodes)) {
      if (isSeasoning(nodes[k])) out.push(k);
    }
  }
  return out;
}

function gateByRecipeType(names, recipeType) {
  if (!recipeType) return names;
  const t = String(recipeType).toLowerCase();
  if (t === 'main' || t === 'side' || t === 'appetizer') return names;
  if (t === 'sauce') return names;
  if (t === 'dessert') return names.filter((n) => SWEET_FRIENDLY.has(n));
  if (t === 'drink') return names.filter((n) => DRINK_FRIENDLY.has(n));
  return names;
}

/**
 * rankSeasonings(bowl, focalKey, ctx, K=5)
 *
 *   bowl       — BowlEntry[] from RecipeLabMobile
 *   focalKey   — string | null (the §13.3 focal flag)
 *   ctx        — { recipePairs, globalCount, nodes, recipeType }
 *   K          — top-K chips to return (default 5 per spec §15.1)
 *
 * Returns [{ name, strength }] sorted by strength desc, restricted to
 * the seasoning subset, filtered by recipe-type gate, with bowl
 * members already excluded by rankSuggestions.
 */
export function rankSeasonings(bowl, focalKey, ctx = {}, K = 5) {
  const { recipePairs, globalCount, nodes, recipeType } = ctx;
  if (!recipePairs || !globalCount || !nodes) return [];
  if (!Array.isArray(bowl) || bowl.length === 0) return [];

  const pool = deriveSeasoningPool(nodes);
  if (pool.length === 0) return [];
  const allowedNames = gateByRecipeType(pool, recipeType);
  if (allowedNames.length === 0) return [];

  return rankSuggestions(bowl, focalKey, allowedNames, {
    recipePairs,
    globalCount,
    K,
  });
}
