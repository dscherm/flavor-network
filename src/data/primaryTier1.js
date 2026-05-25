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
 */
export function gnnPrimaryTier1(probs, tier1Thresholds) {
  if (!probs) return null;
  const above = [];
  for (const aroma of AROMA_AXES) {
    const p = probs[`odor_${aroma}`];
    const t = tier1Thresholds?.[aroma];
    if (typeof p === 'number' && typeof t === 'number' && p >= t) {
      above.push({ aroma, p });
    }
  }
  if (above.length === 0) return null;
  above.sort((a, b) => {
    if (Math.abs(a.p - b.p) <= 0.01) {
      return AROMA_AXES.indexOf(a.aroma) - AROMA_AXES.indexOf(b.aroma);
    }
    return b.p - a.p;
  });
  return above[0].aroma;
}
