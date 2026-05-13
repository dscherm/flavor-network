// PURE: set/rank arithmetic only. No perceptron inference, no weight reads beyond the hash-gate header.
//
// All helpers are deterministic, dependency-free, side-effect free.
// They operate on:
//   - rankedNeighbors: array of pair-keys (strings) sorted by rank ascending (best first)
//   - groundTruthSet: Set<string> of pair-keys to match against
//   - groundTruthEntries: array of objects from ground_truth.json
//
// Pair keys are canonical "a|b" strings where a < b lexicographically.

/**
 * precisionAt — fraction of the top-k ranked neighbors that appear in ground truth.
 * P@k = |top_k ∩ GT| / k
 * Returns 0 when k <= 0 or when rankedNeighbors is empty.
 */
export function precisionAt(k, rankedNeighbors, groundTruthSet) {
  if (!k || k <= 0) return 0;
  if (!rankedNeighbors || rankedNeighbors.length === 0) return 0;
  const top = rankedNeighbors.slice(0, k);
  if (top.length === 0) return 0;
  let hits = 0;
  for (const key of top) {
    if (groundTruthSet.has(key)) hits++;
  }
  return hits / k;
}

/**
 * recallAt — fraction of ground truth captured in the top-k.
 * R@k = |top_k ∩ GT| / |GT|
 * Returns 0 when GT is empty.
 */
export function recallAt(k, rankedNeighbors, groundTruthSet) {
  if (!groundTruthSet || groundTruthSet.size === 0) return 0;
  if (!k || k <= 0) return 0;
  if (!rankedNeighbors || rankedNeighbors.length === 0) return 0;
  const top = rankedNeighbors.slice(0, k);
  let hits = 0;
  for (const key of top) {
    if (groundTruthSet.has(key)) hits++;
  }
  return hits / groundTruthSet.size;
}

/**
 * beyondBookAt — number of pairings in the top-k NOT in ground truth.
 * Returns an integer count (not a fraction).
 * beyondBook@k = k - |top_k ∩ GT|
 * Note: precision@k + (beyondBook@k / k) === 1 for the truncated top-k.
 */
export function beyondBookAt(k, rankedNeighbors, groundTruthSet) {
  if (!k || k <= 0) return 0;
  if (!rankedNeighbors || rankedNeighbors.length === 0) return 0;
  const top = rankedNeighbors.slice(0, k);
  let hits = 0;
  for (const key of top) {
    if (groundTruthSet.has(key)) hits++;
  }
  return top.length - hits;
}

/**
 * axisDistribution — count ground-truth entries by axis label.
 * Walks `axes_validated` arrays and tallies occurrences.
 */
export function axisDistribution(groundTruthEntries) {
  const counts = {};
  if (!Array.isArray(groundTruthEntries)) return counts;
  for (const entry of groundTruthEntries) {
    const axes = Array.isArray(entry?.axes_validated) ? entry.axes_validated : [];
    for (const axis of axes) {
      counts[axis] = (counts[axis] || 0) + 1;
    }
  }
  return counts;
}

/**
 * verdictGate — per-axis "insufficient" vs "ready" verdict based on sample size.
 * Returns map: axis -> "insufficient" | "ready"
 * threshold default 15 per Executor Handoff Constraint #2.
 */
export function verdictGate(perAxisCounts, threshold = 15) {
  const out = {};
  if (!perAxisCounts || typeof perAxisCounts !== 'object') return out;
  for (const [axis, n] of Object.entries(perAxisCounts)) {
    out[axis] = (typeof n === 'number' && n >= threshold) ? 'ready' : 'insufficient';
  }
  return out;
}

/**
 * crossSourceAgreement — Jaccard similarity between FB-only and Matrix-only
 * ground-truth entries. Indicates whether the two human sources agree.
 *
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 * Where A = set of pair-keys whose only `sources[].ref` references "Flavor Bible"
 *       B = set of pair-keys whose only `sources[].ref` references "Flavor Matrix"
 * Returns 0 when either set is empty.
 */
export function crossSourceAgreement(groundTruthEntries) {
  if (!Array.isArray(groundTruthEntries)) return 0;
  const fb = new Set();
  const matrix = new Set();
  for (const entry of groundTruthEntries) {
    if (!entry || !entry.a || !entry.b) continue;
    const key = canonicalPairKey(entry.a, entry.b);
    const refs = (entry.sources || []).map((s) => (s?.ref || '').toLowerCase());
    const isFb = refs.some((r) => r.includes('flavor bible'));
    const isMatrix = refs.some((r) => r.includes('flavor matrix'));
    // "Only" semantics: at least one ref of the type, and no ref of the other type.
    if (isFb && !isMatrix) fb.add(key);
    if (isMatrix && !isFb) matrix.add(key);
  }
  if (fb.size === 0 || matrix.size === 0) return 0;
  let inter = 0;
  for (const k of fb) if (matrix.has(k)) inter++;
  const union = fb.size + matrix.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * canonicalPairKey — order-independent "a|b" key where a < b lexicographically.
 * Both `score_pairings.js` and the metrics module use this so that ground-truth
 * entries and shipped pairings produce identical keys.
 */
export function canonicalPairKey(a, b) {
  const x = String(a).toLowerCase().trim();
  const y = String(b).toLowerCase().trim();
  return x <= y ? `${x}|${y}` : `${y}|${x}`;
}
