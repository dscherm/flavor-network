/**
 * Quantile-based strength thresholds for the Flavor Affinity Mode tier
 * scoring. Replaces the spec's literal `0.7 / 0.4 / 0.2` constants with
 * data-driven cuts at the top 1% / top 10% / top 50% of the actual
 * pairing-strength distribution (User Decision U1, see
 * `.omc/plans/ralplan-flavor-affinity-mode.md` § User Decisions).
 *
 * Why quantiles: the deployed `pairings.json` has ~48k edges with a
 * median strength of ~0.71 — the spec's literal 0.7 threshold admits
 * 51% of pairs and provides no discrimination. Quantiles let the same
 * code generalize across future dataset versions without a
 * spec-amendment round-trip.
 */

const FALLBACK = { star3: 0.99, star2: 0.95, star1: 0.85 };

/**
 * @param {Array<{strength: number}>} edges  pairings.json entries
 * @returns {{star3: number, star2: number, star1: number}}
 */
export function computeAffinityThresholds(edges) {
  if (!Array.isArray(edges) || edges.length === 0) return { ...FALLBACK };

  const strengths = [];
  for (const e of edges) {
    const s = e?.strength;
    if (typeof s === 'number' && Number.isFinite(s)) strengths.push(s);
  }
  if (strengths.length === 0) return { ...FALLBACK };

  // Sort descending so index 0 = strongest.
  strengths.sort((a, b) => b - a);

  // Below ~100 edges the quantile is too noisy — fall back to fixed
  // near-1.0 values so we don't crown random outliers as ★★★.
  if (strengths.length < 100) return { ...FALLBACK };

  const star3 = strengths[Math.floor(strengths.length * 0.01)];
  const star2 = strengths[Math.floor(strengths.length * 0.10)];
  const star1 = strengths[Math.floor(strengths.length * 0.50)];

  // Guarantee strict descending order even if quantiles collapse onto
  // identical values (degenerate distributions).
  return {
    star3,
    star2: Math.min(star2, star3 - 1e-9),
    star1: Math.min(star1, Math.min(star2, star3 - 1e-9) - 1e-9),
  };
}
