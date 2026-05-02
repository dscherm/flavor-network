/**
 * addModeBucketing.js — wraps the pure recipe-cooccurrence ranker with
 * per-taste partitioning for the SuggestionDrawer's ADD mode.
 *
 * The engine module (`recipeSuggestionEngine.js`) is intentionally
 * UNAWARE of taste channels — it ranks by recipe-level co-occurrence
 * only. This module is the single place that knows about both the
 * ranking and the taste-positioning side of the data.
 *
 * Output shape: ordered array of { taste, candidates: [{name, strength,
 * dominantTaste, tasteLabels, inRecipe, matchPct}] } in `TASTE_COLUMNS`
 * order. Empty buckets are preserved (not collapsed) so the UI keeps its
 * 8-column rhythm.
 */

import { rankByRecipeCooccurrence } from './recipeSuggestionEngine.js';
import { scoreIngredient } from './tastePositioning.js';

// Order matches the existing `AXES` constant in SuggestionDrawer.jsx:27
// — sweet/salty/sour/bitter/umami/spicy/pungent/astringent. The spec
// originally proposed sour-before-bitter, but reusing AXES keeps every
// drawer surface (radar, filter pills, columns) in lockstep.
export const TASTE_COLUMNS = ['sweet', 'salty', 'sour', 'bitter', 'umami', 'spicy', 'pungent', 'astringent'];

/**
 * EMPTY_ADD_COLUMNS — frozen sentinel returned by addColumns useMemo when
 * mode !== 'ADD'. Avoids allocating a fresh array every render.
 */
export const EMPTY_ADD_COLUMNS = Object.freeze(
  TASTE_COLUMNS.map(t => Object.freeze({ taste: t, candidates: [] }))
);

/**
 * getTasteLabels — up to 2 taste channels with probability > 0.2,
 * sorted descending. Used for chip color badges.
 *
 * @param {string} name
 * @param {Object | undefined} node
 * @returns {string[]}
 */
function getTasteLabels(name, node) {
  if (!node) return [];
  const { channels } = scoreIngredient(name, node);
  return Object.entries(channels)
    .filter(([, v]) => v > 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([ch]) => ch);
}

/**
 * computeDominantTaste — pick the channel with max value from
 * scoreIngredient. Ties resolved alphabetically by channel name so the
 * partition is deterministic across reloads (R1 in plan).
 *
 * @param {string} name
 * @param {Object | undefined} node
 * @returns {string | null} taste channel name or null when all-zero / no node
 */
export function computeDominantTaste(name, node) {
  if (!node) return null;
  const { channels } = scoreIngredient(name, node);
  let best = null;
  let bestVal = 0;
  // Sort entries deterministically: value desc, then channel name asc.
  const entries = Object.entries(channels).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length > 0 && entries[0][1] > 0) {
    [best, bestVal] = entries[0];
  }
  return bestVal > 0 ? best : null;
}

/**
 * rankAddByTaste — rank by recipe co-occurrence, then partition the
 * top-K ranked candidates into the 8 taste columns, enriched with all
 * fields ChipButton expects (chip-ready shape).
 *
 * The `bowl` array is assumed unique (the call site dedupes via
 * `[...new Set(...)]`). We do NOT redupe internally.
 *
 * @param {string[]} bowl unique ingredient names making up the recipe
 * @param {Object} recipePairs from useProData
 * @param {Object} globalCount from useProData
 * @param {Map<string, Object>} nodes graph node lookup
 * @param {Set<string> | null} scopeFilter optional lc-name allowlist (cocktail/sauce scope)
 * @param {{topK?: number, candidatePoolSize?: number}} opts
 * @param {string[]} recipeIngredients full recipe list (for inRecipe flag)
 * @returns {Array<{taste: string, candidates: Array<{name, strength, dominantTaste, tasteLabels, inRecipe, matchPct}>}>}
 */
export function rankAddByTaste(bowl, recipePairs, globalCount, nodes, scopeFilter = null, opts = {}, recipeIngredients = []) {
  const { topK = 12, candidatePoolSize = 200 } = opts;
  const ranked = rankByRecipeCooccurrence(bowl, recipePairs, globalCount, candidatePoolSize);
  const recipeSet = new Set(recipeIngredients);
  const buckets = Object.fromEntries(TASTE_COLUMNS.map(t => [t, []]));
  for (const cand of ranked) {
    if (scopeFilter && !scopeFilter.has(cand.name.toLowerCase())) continue;
    const node = nodes?.get(cand.name);
    const dom = computeDominantTaste(cand.name, node);
    if (!dom || !buckets[dom]) continue;
    if (buckets[dom].length < topK) {
      buckets[dom].push({
        name: cand.name,
        strength: cand.strength,
        dominantTaste: dom,
        taste: dom,
        tasteLabels: getTasteLabels(cand.name, node),
        inRecipe: recipeSet.has(cand.name),
        matchPct: Math.round(cand.strength * 100),
      });
    }
  }
  return TASTE_COLUMNS.map(t => ({ taste: t, candidates: buckets[t] }));
}
