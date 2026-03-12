/**
 * profileWeights.js — Compute personal weight per ingredient from user profile.
 *
 * Weight formula:
 *   finalWeight = directSelection + cuisineBoost + recipeFrequencyWeight + cascadeBoost
 *
 *   directSelection:       +3  if ingredient is directly selected
 *   cuisineBoost:          +1  per cuisine the user likes that the ingredient belongs to
 *   recipeFrequencyWeight: frequency * (0.6 + 0.4 * quantityFactor) * scaleFactor
 *                          — replaces the old binary recipe boost with a signal that
 *                            rewards higher frequency across recipes and larger quantities
 *   cascadeBoost:          +0.5 per 1-hop neighbor that already has weight (pairing propagation)
 *   Normalize to 0.0–1.0
 */

import { computeFrequencyWeights } from './frequencyWeights.js';

/**
 * Compute a Map of ingredient name → personal weight (0–1).
 * @param {Object} profile - { cuisines: string[], ingredients: string[], recipes: { name, ingredients[] }[] }
 * @param {Map<string, Object>} nodes - Graph nodes from buildGraph()
 * @returns {Map<string, number>} ingredient name → normalized weight (0–1)
 */
export function computeProfileWeights(profile, nodes) {
  const weights = new Map();

  if (!profile || !nodes) return weights;

  const userCuisines = new Set(profile.cuisines);
  const userIngredients = new Set(profile.ingredients);

  // Compute frequency × quantity weights from user recipes
  const freqWeights = computeFrequencyWeights(profile.recipes || []);

  // Scale factor so recipeFrequencyWeight is comparable to the old +2-per-recipe boost
  const FREQ_SCALE = 4;

  let maxWeight = 0;

  for (const [name, node] of nodes) {
    let w = 0;

    // Direct selection: +3
    if (userIngredients.has(name)) {
      w += 3;
    }

    // Cuisine boost: +1 per matching cuisine
    for (const cuisine of node.cuisines) {
      if (userCuisines.has(cuisine)) {
        w += 1;
      }
    }

    // Recipe frequency weight: replaces old binary recipe boost.
    // Higher frequency + larger quantities = stronger signal.
    // combined = frequency * (0.6 + 0.4 * quantityFactor), already computed by frequencyWeights.
    const fwEntry = freqWeights.get(name);
    if (fwEntry) {
      w += fwEntry.combined * FREQ_SCALE;
    }

    weights.set(name, w);
    if (w > maxWeight) maxWeight = w;
  }

  // Cascade boost: propagate weight through 1-hop pairing neighbors.
  // Ingredients paired with already-weighted ingredients get a small boost.
  const CASCADE_BOOST = 0.5;
  for (const [name, node] of nodes) {
    if (!node.pairings) continue;
    let cascadeSum = 0;
    for (const partner of node.pairings) {
      const partnerName = typeof partner === 'string' ? partner : partner.name || partner.target;
      if (partnerName && weights.has(partnerName) && weights.get(partnerName) > 0) {
        cascadeSum += CASCADE_BOOST;
      }
    }
    if (cascadeSum > 0) {
      const updated = (weights.get(name) || 0) + cascadeSum;
      weights.set(name, updated);
      if (updated > maxWeight) maxWeight = updated;
    }
  }

  // Normalize to 0–1
  if (maxWeight > 0) {
    for (const [name, w] of weights) {
      weights.set(name, w / maxWeight);
    }
  }

  return weights;
}

/**
 * Get the top N ingredients by personal weight.
 * @param {Map<string, number>} weights - Output from computeProfileWeights()
 * @param {number} n - How many to return
 * @returns {Array<{ name: string, weight: number }>}
 */
export function getTopIngredients(weights, n = 10) {
  return [...weights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, weight]) => ({ name, weight }));
}

/**
 * Get suggestions: high-weight neighbors the user hasn't explicitly added.
 * Finds ingredients with weight > 0 (from cuisine/recipe boosts) that aren't directly selected.
 * @param {Map<string, number>} weights - Output from computeProfileWeights()
 * @param {Set<string>|string[]} userIngredients - Directly selected ingredients
 * @param {number} n - How many to return
 * @returns {Array<{ name: string, weight: number }>}
 */
export function getSuggestions(weights, userIngredients, n = 10) {
  const directSet = userIngredients instanceof Set
    ? userIngredients
    : new Set(userIngredients);

  return [...weights.entries()]
    .filter(([name, w]) => w > 0 && !directSet.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, weight]) => ({ name, weight }));
}

/**
 * Compute taste signature breakdown from weighted ingredients.
 * Returns the relative proportion of each taste category.
 * @param {Map<string, number>} weights - Output from computeProfileWeights()
 * @param {Map<string, Object>} nodes - Graph nodes
 * @returns {Object} e.g. { sweet: 0.3, sour: 0.2, bitter: 0.1, salty: 0.15, umami: 0.25 }
 */
export function getTasteSignature(weights, nodes) {
  const tasteTotals = {};
  let sum = 0;

  for (const [name, w] of weights) {
    if (w <= 0) continue;
    const node = nodes.get(name);
    if (!node || !node.taste) continue;

    const taste = node.taste.toLowerCase();
    tasteTotals[taste] = (tasteTotals[taste] || 0) + w;
    sum += w;
  }

  // Normalize to proportions
  if (sum > 0) {
    for (const taste in tasteTotals) {
      tasteTotals[taste] = tasteTotals[taste] / sum;
    }
  }

  return tasteTotals;
}

/**
 * Compute cuisine affinity — which cuisines the user's profile aligns with most.
 * @param {Map<string, number>} weights - Output from computeProfileWeights()
 * @param {Map<string, Object>} nodes - Graph nodes
 * @returns {Array<{ cuisine: string, score: number }>} sorted by score descending, normalized 0–1
 */
export function getCuisineAffinity(weights, nodes) {
  const cuisineScores = {};
  let maxScore = 0;

  for (const [name, w] of weights) {
    if (w <= 0) continue;
    const node = nodes.get(name);
    if (!node) continue;

    for (const cuisine of node.cuisines) {
      cuisineScores[cuisine] = (cuisineScores[cuisine] || 0) + w;
      if (cuisineScores[cuisine] > maxScore) {
        maxScore = cuisineScores[cuisine];
      }
    }
  }

  // Normalize and sort
  const result = Object.entries(cuisineScores).map(([cuisine, score]) => ({
    cuisine,
    score: maxScore > 0 ? score / maxScore : 0,
  }));

  return result.sort((a, b) => b.score - a.score);
}
