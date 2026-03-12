/**
 * frequencyWeights.js — Compute ingredient frequency and quantity-based weights
 * across all user recipes.
 *
 * Frequency score: fraction of recipes containing an ingredient (0–1).
 * Quantity factor: normalized quantity relative to other ingredients,
 *   using comprehensive unit conversions with ingredient-specific densities.
 */

import { toGrams } from './unitConversions.js';

/**
 * Convert a quantity + unit pair to a normalized base amount (grams).
 * Delegates to unitConversions.js for comprehensive conversion.
 * @param {number|null} quantity
 * @param {string|null} unit
 * @param {string|null} ingredientName — optional, for density-aware conversion
 * @returns {number|null}
 */
function toBaseAmount(quantity, unit, ingredientName = null) {
  return toGrams(quantity, unit, ingredientName);
}

/**
 * Compute ingredient frequency scores across all user recipes.
 * Frequency = (number of recipes containing ingredient) / (total recipes).
 *
 * @param {Array<{ name: string, ingredients: Array<{ name: string }> }>} recipes
 * @returns {Map<string, number>} ingredient name → frequency (0–1)
 */
export function computeFrequencyScores(recipes) {
  const freq = new Map();
  if (!recipes || recipes.length === 0) return freq;

  const total = recipes.length;

  for (const recipe of recipes) {
    // Dedupe ingredients within a single recipe
    const seen = new Set();
    for (const ing of recipe.ingredients) {
      const name = typeof ing === 'string' ? ing.toLowerCase() : ing.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      freq.set(name, (freq.get(name) || 0) + 1);
    }
  }

  // Normalize to 0–1
  for (const [name, count] of freq) {
    freq.set(name, count / total);
  }

  return freq;
}

/**
 * Compute quantity-based factors per ingredient, averaged across recipes.
 * Uses unit conversion to normalize different measurement units.
 *
 * Returns a Map of ingredient → normalized quantity factor (0–1),
 * where 1 = the ingredient with the highest average base amount.
 *
 * @param {Array<{ name: string, ingredients: Array<{ name: string, quantity: number|null, unit: string|null }> }>} recipes
 * @returns {Map<string, number>} ingredient name → quantity factor (0–1)
 */
export function computeQuantityFactors(recipes) {
  const factors = new Map();
  if (!recipes || recipes.length === 0) return factors;

  // Accumulate total base amount and count per ingredient
  const totals = new Map(); // name → { sum, count }

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const name = typeof ing === 'string' ? ing.toLowerCase() : ing.name;
      if (!name) continue;

      const quantity = typeof ing === 'string' ? null : ing.quantity;
      const unit = typeof ing === 'string' ? null : ing.unit;
      const base = toBaseAmount(quantity, unit, name);

      if (!totals.has(name)) {
        totals.set(name, { sum: 0, count: 0, hasQuantity: false });
      }
      const entry = totals.get(name);
      entry.count += 1;
      if (base != null) {
        entry.sum += base;
        entry.hasQuantity = true;
      }
    }
  }

  // Compute average base amount per ingredient
  let maxAvg = 0;
  const avgs = new Map();

  for (const [name, { sum, count, hasQuantity }] of totals) {
    // If no quantity data, use a neutral default (median-ish)
    const avg = hasQuantity ? sum / count : 15;
    avgs.set(name, avg);
    if (avg > maxAvg) maxAvg = avg;
  }

  // Normalize to 0–1
  for (const [name, avg] of avgs) {
    factors.set(name, maxAvg > 0 ? avg / maxAvg : 0);
  }

  return factors;
}

/**
 * Compute combined frequency × quantity weight per ingredient.
 *
 * Combined weight = frequency * (0.6 + 0.4 * quantityFactor)
 *
 * This gives frequency the dominant role (an ingredient in all recipes
 * is important regardless of quantity), while quantity provides a
 * secondary signal (more of an ingredient = stronger affinity).
 *
 * @param {Array<{ name: string, ingredients: Array<{ name: string, quantity: number|null, unit: string|null }> }>} recipes
 * @returns {Map<string, { frequency: number, quantityFactor: number, combined: number }>}
 */
export function computeFrequencyWeights(recipes) {
  const result = new Map();
  if (!recipes || recipes.length === 0) return result;

  const freq = computeFrequencyScores(recipes);
  const qf = computeQuantityFactors(recipes);

  for (const [name, frequency] of freq) {
    const quantityFactor = qf.get(name) || 0;
    const combined = frequency * (0.6 + 0.4 * quantityFactor);
    result.set(name, { frequency, quantityFactor, combined });
  }

  return result;
}

/**
 * Classify ingredients by frequency tier.
 * - signature: ≥ 0.7 frequency (in 70%+ of recipes)
 * - regular:   0.3–0.7 frequency
 * - occasional: < 0.3 frequency
 *
 * @param {Map<string, number>} frequencyScores - from computeFrequencyScores()
 * @returns {{ signature: string[], regular: string[], occasional: string[] }}
 */
export function classifyByFrequency(frequencyScores) {
  const signature = [];
  const regular = [];
  const occasional = [];

  for (const [name, freq] of frequencyScores) {
    if (freq >= 0.7) {
      signature.push(name);
    } else if (freq >= 0.3) {
      regular.push(name);
    } else {
      occasional.push(name);
    }
  }

  return { signature, regular, occasional };
}

/**
 * Get ingredients ranked by combined frequency+quantity weight.
 * @param {Array} recipes - User recipes
 * @param {number} n - How many to return
 * @returns {Array<{ name: string, frequency: number, quantityFactor: number, combined: number }>}
 */
export function getTopByFrequency(recipes, n = 10) {
  const weights = computeFrequencyWeights(recipes);
  return [...weights.entries()]
    .sort((a, b) => b[1].combined - a[1].combined)
    .slice(0, n)
    .map(([name, data]) => ({ name, ...data }));
}
