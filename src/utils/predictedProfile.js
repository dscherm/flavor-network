/**
 * predictedProfile — for a given ingredient, return tasks (tastes + odors)
 * where the GNN's probability exceeds the ingredient-level percentile
 * threshold AND the underlying molecule-level head is trustworthy
 * (F1 >= MIN_F1).
 *
 * Why two different thresholds:
 *  - `calibrated_threshold` (odor_thresholds.json) is tuned at the
 *    MOLECULE level to maximize F1 per-compound. Applied to an
 *    ingredient's mean-pooled probability (average of 20 compounds),
 *    this threshold almost never triggers because mean-pool dilutes
 *    extremes.
 *  - `ingredient_threshold` (ingredient_profile_thresholds.json) is
 *    the p85 of the ingredient-level probability distribution — i.e.,
 *    flag the top 15% of ingredients for each task. This is what
 *    actually discriminates "this ingredient leans X" at the UI level.
 *
 * Inputs:
 *   - name, gnnEntropy (per-ingredient probs + optional imputed flag)
 *   - ingredientThresholds (shape: { per_task: [{ task, ingredient_threshold, molecule_f1 }] })
 *
 * Returns an array of { task, prob, threshold, confidence, imputed }
 * sorted by confidence descending.
 */

const MIN_F1 = 0.4;
const MIN_CONFIDENCE = 0.02; // small margin above threshold

export function getPredictedProfile(name, gnnEntropy, ingredientThresholds) {
  if (!name || !gnnEntropy || !ingredientThresholds) return [];
  const entry = gnnEntropy[name];
  if (!entry || !entry.probs) return [];

  const thresholdMap = new Map();
  for (const row of ingredientThresholds.per_task || []) {
    if (row.molecule_f1 != null && row.molecule_f1 < MIN_F1) continue;
    if (typeof row.ingredient_threshold !== 'number') continue;
    thresholdMap.set(row.task, row.ingredient_threshold);
  }
  if (thresholdMap.size === 0) return [];

  const results = [];
  for (const [task, threshold] of thresholdMap) {
    const prob = entry.probs[task];
    if (typeof prob !== 'number') continue;
    const margin = prob - threshold;
    if (margin < MIN_CONFIDENCE) continue;
    results.push({
      task,
      prob: Number(prob.toFixed(3)),
      threshold: Number(threshold.toFixed(3)),
      confidence: Number(margin.toFixed(3)),
      imputed: entry.imputed === true,
    });
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
