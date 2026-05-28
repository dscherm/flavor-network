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
// GNN-pickable subset of the 13-category chef vocab. These 5 keys map
// 1:1 to the model's odor heads; the other 8 chef-vocab categories
// (citrus / marine / aged / caramel / earthy / roasted / herbal /
// pungent) have no GNN prediction and surface only via chef-curated
// flavor_graph tier1 — see categoricalAxes.js aromaBucket.
//
// 2026-05-27 (batch 6): renamed display key 'fatty' → 'creamy' to
// match chef vocab. The GNN feature column stays `odor_fatty` (data
// file unchanged); GNN_KEY_FOR translates display key → GNN column.
// `spicy` stays excluded (mol-F1 0.329 < 0.4 production gate).
export const AROMA_AXES = ['fruity', 'floral', 'green', 'woody', 'creamy'];

// Display-key → GNN feature-column lookup. Only `creamy` diverges from
// the `odor_<key>` convention (its GNN column is the legacy
// `odor_fatty`); the other 4 keys map by simple prefix.
const GNN_KEY_FOR = {
  fruity: 'odor_fruity',
  floral: 'odor_floral',
  green:  'odor_green',
  woody:  'odor_woody',
  creamy: 'odor_fatty',
};

/**
 * Build a tier1 threshold map from the raw ingredient_profile_thresholds.json
 * structure: { per_task: [{task: 'odor_fruity', ingredient_threshold: 0.269}, ...] }.
 * Filters to the 5 canonical aroma heads.
 *
 * Returns keys in the display-vocab namespace (creamy, not fatty) so
 * the rest of the codebase can stay in chef-vocab terms even though
 * the source JSON uses the legacy odor_fatty column.
 */
export function buildTier1Thresholds(ingredientThresholds) {
  const out = {};
  const tasks = ingredientThresholds?.per_task;
  if (!Array.isArray(tasks)) return out;
  // Build the inverse: GNN column → display key
  const DISPLAY_FOR = Object.fromEntries(
    Object.entries(GNN_KEY_FOR).map(([disp, gnn]) => [gnn, disp]),
  );
  for (const entry of tasks) {
    if (!entry?.task?.startsWith('odor_')) continue;
    const displayKey = DISPLAY_FOR[entry.task];
    if (displayKey && AROMA_AXES.includes(displayKey)) {
      out[displayKey] = entry.ingredient_threshold;
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
    // GNN_KEY_FOR translates display key → GNN column name; only
    // creamy diverges (column = odor_fatty), the others map by prefix.
    const p = probs[GNN_KEY_FOR[aroma]];
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
