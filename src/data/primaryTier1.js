// Primary Tier-1 aroma selector for the v3 flavor graph.
//
// Two paths consumed by useProData:
//   - CHEF: ingredient is in flavor_graph_data.json.nodes → use tier1[0].
//   - GNN:  long-tail (~3,824 ingredients). Pick the aroma head with the
//           highest gnnProbs.odor_<aroma> that's also above its calibrated
//           ingredient-level threshold; tie-break (ε=0.01) per AROMA_AXES
//           order. Honors v2 N1-ADR-3 — uses ingredient_profile_thresholds
//           (per-ingredient p85 calibration), NOT molecule-level
//           odor_thresholds.
//
// Q7 (.omc/notepad.md) freezes the Tier-1 vocabulary at 5 terms; `spicy`
// stays excluded so chili-style ingredients fall through to their existing
// cluster color via the defensive fallback path in NodeMesh.

export const AROMA_AXES = ['fruity', 'floral', 'green', 'woody', 'fatty'];

/**
 * Build a tier1 threshold map from the raw ingredient_profile_thresholds.json
 * structure: { per_task: [{task: 'odor_fruity', ingredient_threshold: 0.269}, ...] }.
 * Filters to the 5 canonical aroma heads.
 */
export function buildTier1Thresholds(ingredientThresholds) {
  const out = {};
  const tasks = ingredientThresholds?.per_task;
  if (!Array.isArray(tasks)) return out;
  for (const entry of tasks) {
    if (!entry?.task?.startsWith('odor_')) continue;
    const aroma = entry.task.slice('odor_'.length);
    if (AROMA_AXES.includes(aroma)) {
      out[aroma] = entry.ingredient_threshold;
    }
  }
  return out;
}

/**
 * Resolve primaryTier1Aroma from a node's gnnProbs object + a tier1
 * threshold map (output of buildTier1Thresholds).
 *
 * Returns null when no aroma head is above its calibrated threshold.
 *
 * Tie-break (N2-AGG-RECAL, 2026-05-26): among heads that fire, the one
 * with the highest threshold-surplus ratio (p - t) / t wins. Surplus
 * ratio is unitless ("threshold-units above gate") and balances across
 * heads whose calibrated thresholds sit at different absolute levels.
 *
 * The earlier argmax-raw-prob tie-break produced a Woody-heavy bias
 * (82% of long-tail picks → woody) because woody's raw probs run
 * systematically higher than green/floral. The surplus-ratio
 * normalization caps any single head at ~34% of picks.
 *
 * Stable order tie-break (when surpluses are equal within ε=1e-4)
 * follows AROMA_AXES so the picker is deterministic.
 */
export function gnnPrimaryTier1(probs, tier1Thresholds) {
  if (!probs) return null;
  const above = [];
  for (const aroma of AROMA_AXES) {
    const p = probs[`odor_${aroma}`];
    const t = tier1Thresholds?.[aroma];
    if (typeof p === 'number' && typeof t === 'number' && t > 0 && p >= t) {
      above.push({ aroma, p, surplus: (p - t) / t });
    }
  }
  if (above.length === 0) return null;
  above.sort((a, b) => {
    if (Math.abs(a.surplus - b.surplus) <= 1e-4) {
      return AROMA_AXES.indexOf(a.aroma) - AROMA_AXES.indexOf(b.aroma);
    }
    return b.surplus - a.surplus;
  });
  return above[0].aroma;
}
