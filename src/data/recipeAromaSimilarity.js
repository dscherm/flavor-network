import { aromaProfile } from './flavorAroma.js';
// The six aroma axes the recipe chart draws, in a fixed order (FLAVOR-5: the hand-tuned aroma table,
// src/data/flavorAromas.js, not the model's per-ingredient values).
export const AROMA_KEYS = ['odor_fruity', 'odor_floral', 'odor_green',
                            'odor_woody', 'odor_spicy', 'odor_fatty'];

// Returns the 6-dim aroma vector of a list of ingredient names: the same aroma profile the recipe chart
// draws (equal weights, no amounts). Returns null when no ingredient has an aroma of its own.
// Switched from the model's mean per-ingredient values in FLAVOR-6: those gave the same two cocktails for
// every recipe and ties at 100% for most sauces.
export function computeRecipeAroma(ingredientNames) {
  const p = aromaProfile((ingredientNames || []).filter((n) => typeof n === 'string' && n).map((key) => ({ key })));
  if (!p.counted.length || !p.charted) return null;
  return AROMA_KEYS.map((k) => p.scores[k] || 0);
}

// Cosine similarity over two equal-length non-negative vectors. Returns
// 0 when either vector has zero magnitude.
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Returns top-2 aroma keys where both vectors have above-mean signal
// (the "shared" aromas that drive the similarity).
export function topAromaOverlap(recipeVec, itemVec, k = 2) {
  if (!recipeVec || !itemVec) return [];
  const products = AROMA_KEYS.map((key, i) => ({
    key, product: (recipeVec[i] || 0) * (itemVec[i] || 0)
  }));
  return products
    .sort((a, b) => b.product - a.product)
    .slice(0, k)
    .filter(p => p.product > 0)
    .map(p => p.key);
}

// Ranker. `items` is an array of objects with `.ingredients` arrays (the
// cocktail_augment.json / sauce_augment.json schema). Returns an array of
// AromaMatchResult sorted by similarity descending, top-N=8.
export function rankByAromaSimilarity(recipeVector, items, topN = 8) {
  if (!recipeVector) return [];
  return (items || [])
    .map(item => {
      const itemVec = computeRecipeAroma(item?.ingredients || []);
      if (!itemVec) return null;
      return {
        item,
        similarity: cosineSim(recipeVector, itemVec),
        matchedAromas: topAromaOverlap(recipeVector, itemVec, 2),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

// Formats a similarity score into a user-facing badge string. Cosine over
// non-negative aroma probs is in [0, 1] so a straight multiplication works.
export function formatSimilarityBadge(similarity) {
  const pct = Math.round((similarity || 0) * 100);
  return `${pct}% match`;
}
