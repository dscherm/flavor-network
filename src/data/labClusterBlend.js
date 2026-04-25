/**
 * labClusterBlend.js — shared cluster-blend positioning + centroid math
 * for the Cocktail Lab and Sauce Lab. Mirrors what the main "Cooks With"
 * 3D view does: pull each ingredient's position toward the centroid of
 * its cluster so members of the same cluster (cocktail-codex family or
 * mother-sauce family) form a visible cloud.
 */

/**
 * Compute per-cluster centroid from a position map and a cluster
 * membership map.
 *
 * @param {Object<string, [number, number, number]>} positions
 * @param {Object<string, { cluster_id: number }>} ingredientClusters
 * @returns {Map<number, [number, number, number]>}
 */
export function computeClusterCentroids(positions, ingredientClusters) {
  const sum = new Map();
  const count = new Map();
  for (const name in positions) {
    const cl = ingredientClusters[name];
    if (!cl) continue;
    const cid = cl.cluster_id;
    const p = positions[name];
    if (!p) continue;
    if (!sum.has(cid)) { sum.set(cid, [0, 0, 0]); count.set(cid, 0); }
    const s = sum.get(cid);
    s[0] += p[0]; s[1] += p[1]; s[2] += p[2];
    count.set(cid, count.get(cid) + 1);
  }
  const centroids = new Map();
  for (const [cid, s] of sum) {
    const n = count.get(cid) || 1;
    centroids.set(cid, [s[0] / n, s[1] / n, s[2] / n]);
  }
  return centroids;
}

/**
 * Blend each position toward its cluster centroid by `alpha` (0..1).
 * alpha=0 → no change, alpha=1 → snap to centroid.
 *
 * Mutates `positions` in place AND returns it for convenience.
 */
export function applyClusterBlend(positions, ingredientClusters, centroids, alpha = 0.6) {
  for (const name in positions) {
    const cl = ingredientClusters[name];
    if (!cl) continue;
    const c = centroids.get(cl.cluster_id);
    if (!c) continue;
    const p = positions[name];
    p[0] = p[0] * (1 - alpha) + c[0] * alpha;
    p[1] = p[1] * (1 - alpha) + c[1] * alpha;
    p[2] = p[2] * (1 - alpha) + c[2] * alpha;
  }
  return positions;
}

/**
 * Spread cluster centroids on a circle around the origin so clusters
 * don't overlap when blend alpha is high. Useful when the underlying
 * positions don't already separate clusters spatially (e.g. cocktail
 * positions derived from the chemistry GNN — many cocktail-codex
 * families share base spirits and would otherwise pile on each other).
 *
 * Returns a new centroid map; does NOT mutate the input.
 */
export function spreadCentroidsOnCircle(centroids, clusters, radius = 35) {
  const ordered = clusters.map(c => c.id).filter(id => centroids.has(id));
  const out = new Map();
  for (let i = 0; i < ordered.length; i++) {
    const angle = (i / ordered.length) * Math.PI * 2 - Math.PI / 2;
    const cid = ordered[i];
    const original = centroids.get(cid);
    out.set(cid, [
      Math.cos(angle) * radius,
      original[1] * 0.4,
      Math.sin(angle) * radius,
    ]);
  }
  return out;
}
