/**
 * Cosine similarity — find similar ingredients based on learned embeddings.
 */

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find the top-k most similar ingredients to a query ingredient.
 * @param {string} query - Ingredient name
 * @param {Object} embeddingsData - { embeddings: { name: number[] } }
 * @param {number} k - Number of results to return
 * @returns {Array<{ name: string, similarity: number }>}
 */
export function findSimilar(query, embeddingsData, k = 10) {
  const queryVec = embeddingsData.embeddings[query];
  if (!queryVec) return [];

  const results = [];
  for (const [name, vec] of Object.entries(embeddingsData.embeddings)) {
    if (name === query) continue;
    results.push({ name, similarity: cosineSimilarity(queryVec, vec) });
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}

/**
 * Compute similarity between two specific ingredients.
 */
export function ingredientSimilarity(ing1, ing2, embeddingsData) {
  const v1 = embeddingsData.embeddings[ing1];
  const v2 = embeddingsData.embeddings[ing2];
  if (!v1 || !v2) return null;
  return cosineSimilarity(v1, v2);
}

/**
 * Build a similarity index for fast batch lookups.
 * Pre-computes norms for efficiency.
 */
export function buildSimilarityIndex(embeddingsData) {
  const names = Object.keys(embeddingsData.embeddings);
  const vectors = names.map(n => embeddingsData.embeddings[n]);
  const norms = vectors.map(v => Math.sqrt(v.reduce((s, x) => s + x * x, 0)));

  return {
    names,
    vectors,
    norms,

    /**
     * Find top-k similar to a given ingredient name.
     */
    query(name, k = 10) {
      const idx = names.indexOf(name);
      if (idx === -1) return [];

      const qVec = vectors[idx];
      const qNorm = norms[idx];
      if (qNorm === 0) return [];

      const scores = [];
      for (let i = 0; i < names.length; i++) {
        if (i === idx) continue;
        let dot = 0;
        for (let d = 0; d < qVec.length; d++) {
          dot += qVec[d] * vectors[i][d];
        }
        const sim = norms[i] === 0 ? 0 : dot / (qNorm * norms[i]);
        scores.push({ name: names[i], similarity: sim });
      }

      scores.sort((a, b) => b.similarity - a.similarity);
      return scores.slice(0, k);
    },
  };
}
