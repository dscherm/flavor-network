/**
 * pairingModel.js — FM-P1-1: v0 embedding-cosine pairing scorer (no training).
 *
 * Ranks candidate pairings for a focal ingredient by cosine similarity over
 * the 16-D GAT embeddings in flavor_graph_data_v3.json (node.embedding), then
 * blends that prior with the existing co-occurrence ranking.
 *
 * WHY BLEND, NOT REPLACE (empirical, 2026-06-08):
 *   Raw cosine over these embeddings is compressed into a narrow positive band
 *   (~0.79–0.98) and does NOT match flavor intuition on its own — e.g.
 *   cos(basil, chocolate)=0.953 > cos(basil, tomato)=0.865. Used raw it is a
 *   weaker pairing signal than the co-occurrence heuristic. So v0 treats cosine
 *   as a re-ranking PRIOR blended with the co-occurrence strength, never as the
 *   sole signal. The trained link-predictor (FM-P1-2) is where embeddings +
 *   pairing factors are expected to beat the baseline outright.
 *
 * This module is gated behind FN_PAIRING_MODEL (default OFF). Nothing imports
 * it into the live suggestion path yet — UI wiring + A/B is FM-P1-4. With the
 * flag OFF, the app's existing rankSuggestions behavior is unchanged.
 *
 * All ranker outputs use the project-standard `[{ name, strength }]` shape with
 * strength ∈ [0, 1], so they are drop-in compatible with the suggestion UI.
 */

/**
 * Read the FN_PAIRING_MODEL feature flag. Default OFF.
 * Mirrors the FN_FLAVOR_V3 idiom in src/hooks/useProData.js:
 *   - Runtime:    localStorage.setItem('FN_PAIRING_MODEL', 'true')
 *   - Build-time: VITE_FN_PAIRING_MODEL=true npm run build
 * Safe in non-browser (test/SSR) contexts — returns false when no localStorage.
 * @returns {boolean}
 */
export function isPairingModelEnabled() {
  try {
    if (typeof localStorage !== 'undefined') {
      const ls = localStorage.getItem('FN_PAIRING_MODEL');
      if (ls === 'true') return true;
      if (ls === 'false') return false;
    }
  } catch {
    // localStorage can throw in sandboxed iframes — fall through to default.
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FN_PAIRING_MODEL === 'true') {
    return true;
  }
  return false;
}

/**
 * Cosine similarity of two equal-length numeric vectors. Returns 0 when either
 * vector is missing, empty, mismatched in length, or has zero magnitude.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} cosine ∈ [-1, 1]
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Build a name → embedding[] index from flavor_graph_data_v3.json nodes.
 * @param {Array<{name:string, embedding:number[]}>} nodes
 * @returns {Map<string, number[]>}
 */
export function buildEmbeddingIndex(nodes) {
  const index = new Map();
  if (!Array.isArray(nodes)) return index;
  for (const n of nodes) {
    if (n && typeof n.name === 'string' && Array.isArray(n.embedding) && n.embedding.length > 0) {
      index.set(n.name, n.embedding);
    }
  }
  return index;
}

// Map cosine ∈ [-1, 1] → strength ∈ [0, 1] for the {name, strength} contract.
function cosToStrength(cos) {
  return (cos + 1) / 2;
}

/**
 * Rank candidates by embedding cosine to a focal ingredient.
 * Candidates with no embedding, the focal itself, and unknown names are dropped.
 *
 * @param {string} focalName
 * @param {string[]|null} candidates  Names to rank; null = rank the whole index.
 * @param {Map<string, number[]>} embIndex
 * @param {{ topK?: number }} [opts]
 * @returns {Array<{name:string, strength:number}>} sorted by strength desc
 */
export function rankByEmbedding(focalName, candidates, embIndex, opts = {}) {
  const { topK = 100 } = opts;
  if (!(embIndex instanceof Map)) return [];
  const focalVec = embIndex.get(focalName);
  if (!focalVec) return [];

  const names = candidates || Array.from(embIndex.keys());
  const ranked = [];
  for (const name of names) {
    if (name === focalName) continue;
    const vec = embIndex.get(name);
    if (!vec) continue;
    ranked.push({ name, strength: cosToStrength(cosineSimilarity(focalVec, vec)) });
  }
  ranked.sort((x, y) => y.strength - x.strength);
  if (ranked.length > topK) ranked.length = topK;
  return ranked;
}

/**
 * Blend an existing co-occurrence ranking with the embedding-cosine prior.
 * The embedding term re-ranks the co-occurrence candidates; it never introduces
 * candidates the co-occurrence pass did not already surface (so the familiarity
 * gating upstream is preserved).
 *
 *   blended(c) = (1 - alpha) * coocc.strength(c) + alpha * cos01(focal, c)
 *
 * @param {Array<{name:string, strength:number}>} cooccRanked  output of rankSuggestions
 * @param {string} focalName
 * @param {Map<string, number[]>} embIndex
 * @param {{ alpha?: number, topK?: number }} [opts]
 * @returns {Array<{name:string, strength:number}>} re-ranked, same shape
 */
export function blendPairingScores(cooccRanked, focalName, embIndex, opts = {}) {
  const { alpha = 0.5, topK = 100 } = opts;
  if (!Array.isArray(cooccRanked) || cooccRanked.length === 0) return [];
  const a = Math.min(1, Math.max(0, alpha));
  const focalVec = embIndex instanceof Map ? embIndex.get(focalName) : null;

  const blended = cooccRanked.map(({ name, strength }) => {
    const vec = focalVec ? embIndex.get(name) : null;
    // No embedding for focal or candidate → fall back to the co-occurrence
    // score unchanged (embedding term contributes nothing).
    const cos01 = focalVec && vec ? cosToStrength(cosineSimilarity(focalVec, vec)) : strength;
    return { name, strength: (1 - a) * strength + a * cos01 };
  });

  blended.sort((x, y) => y.strength - x.strength);
  if (blended.length > topK) blended.length = topK;
  return blended;
}
