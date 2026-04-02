/**
 * tasteScoring.js — Aggregate taste scoring for recipes.
 * Wraps scoreIngredient() from tastePositioning.js to compute
 * per-axis taste totals across a recipe's ingredient list.
 */

import { scoreIngredient } from './tastePositioning.js';

const TASTE_AXES_LIST = ['sweet', 'salty', 'sour', 'bitter', 'umami', 'spicy', 'pungent', 'astringent'];

/**
 * Compute aggregate taste profile for a set of recipe ingredients.
 *
 * @param {string[]} ingredients - Ingredient names in the recipe
 * @param {Map<string, Object>} nodes - Graph nodes map (name → node)
 * @returns {{ totals: Object, normalized: Object, max: number }}
 *   - totals: raw sum of each taste channel across all ingredients
 *   - normalized: each channel divided by max (0–1 range, max channel = 1.0)
 *   - max: the highest raw total across all channels
 */
export function aggregateRecipeTastes(ingredients, nodes) {
  const totals = {};
  for (const axis of TASTE_AXES_LIST) totals[axis] = 0;

  for (const name of ingredients) {
    const node = nodes.get(name);
    if (!node) continue;
    const { channels } = scoreIngredient(name, node);
    for (const axis of TASTE_AXES_LIST) {
      totals[axis] += channels[axis];
    }
  }

  const max = Math.max(...Object.values(totals), 0.01);
  const normalized = {};
  for (const axis of TASTE_AXES_LIST) {
    normalized[axis] = totals[axis] / max;
  }

  return { totals, normalized, max };
}

/**
 * Find the weakest (least represented) taste axis in a normalized profile.
 *
 * @param {Object} normalized - Normalized taste scores (0–1 per axis)
 * @returns {[string, number]} - [axisName, value] of the weakest axis
 */
export function findWeakestAxis(normalized) {
  let weakest = null;
  let weakestVal = Infinity;
  for (const [axis, val] of Object.entries(normalized)) {
    if (val < weakestVal) {
      weakestVal = val;
      weakest = axis;
    }
  }
  return [weakest, weakestVal];
}

/**
 * Find which ingredients contribute to a specific taste axis.
 *
 * @param {string} axis - Taste axis name (e.g. 'umami')
 * @param {string[]} ingredients - Ingredient names
 * @param {Map<string, Object>} nodes - Graph nodes
 * @returns {Array<{name: string, score: number}>} - Contributors sorted by score desc
 */
export function getAxisContributors(axis, ingredients, nodes) {
  const contributors = [];
  for (const name of ingredients) {
    const node = nodes.get(name);
    if (!node) continue;
    const { channels } = scoreIngredient(name, node);
    if (channels[axis] > 0) {
      contributors.push({ name, score: channels[axis] });
    }
  }
  return contributors.sort((a, b) => b.score - a.score);
}
