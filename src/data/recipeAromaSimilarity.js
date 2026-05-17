// Six GNN aroma axes calibrated above F1=0.50. Source-of-record:
// .claude/.chemdataset-status.md — odor_fruity (0.722), odor_fatty (0.617),
// odor_green (0.606), odor_woody (0.541), odor_floral (0.515), odor_spicy
// (0.329 — included even though below F1=0.50 because it's a recognizable
// axis for users; weight is implicit via the cosine math).
export const AROMA_KEYS = ['odor_fruity', 'odor_floral', 'odor_green',
                            'odor_woody', 'odor_spicy', 'odor_fatty'];

// Returns 6-dim aroma vector (mean of GNN probabilities across ingredients
// that have GNN data). Returns null when zero ingredients have aroma data.
export function computeRecipeAroma(ingredientNames, ingredientsData) {
  const vectors = (ingredientNames || [])
    .map(name => ingredientsData?.[name]?.gnnProbs)
    .filter(p => p && AROMA_KEYS.some(k => typeof p[k] === 'number'));
  if (vectors.length === 0) return null;
  const sum = new Array(AROMA_KEYS.length).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < AROMA_KEYS.length; i++) {
      sum[i] += (typeof v[AROMA_KEYS[i]] === 'number') ? v[AROMA_KEYS[i]] : 0;
    }
  }
  return sum.map(x => x / vectors.length);
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
// cocktail_augment.json / sauce_augment.json schema). `ingredientsData` is
// the same lookup used by computeRecipeAroma. Returns an array of
// AromaMatchResult sorted by similarity descending, top-N=8.
export function rankByAromaSimilarity(recipeVector, items, ingredientsData, topN = 8) {
  if (!recipeVector) return [];
  return (items || [])
    .map(item => {
      const itemVec = computeRecipeAroma(item?.ingredients || [], ingredientsData);
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
