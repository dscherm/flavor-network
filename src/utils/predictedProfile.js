/**
 * predictedProfile — for a given ingredient, return the set of tasks
 * (tastes + odors) where the GNN's calibrated probability exceeds the
 * per-task threshold.
 *
 * Inputs:
 *   - name: ingredient name (canonical key in gnn_entropy.json)
 *   - gnnEntropy: contents of public/proDataset/gnn_entropy.json
 *                 — shape { [name]: { probs: { task: p, ... }, entropy, ... }, _meta: ... }
 *   - odorThresholds: contents of public/proDataset/odor_thresholds.json
 *                     — shape { per_task: [{ task, calibrated_threshold, calibrated_f1, ... }], ... }
 *
 * Returns an array of { task, prob, threshold, confidence } sorted by
 * (prob - threshold) descending — most confident tags first. Returns an
 * empty array when data is missing or no task clears its threshold.
 *
 * Tasks with calibrated F1 below MIN_F1 are filtered out — we don't
 * publish predictions we don't trust. Currently only odor_spicy and
 * (optionally) salty sit below the cutoff.
 */

const MIN_F1 = 0.4;
const MIN_CONFIDENCE = 0.05; // require probability ≥ threshold + this margin

export function getPredictedProfile(name, gnnEntropy, odorThresholds) {
  if (!name || !gnnEntropy || !odorThresholds) return [];
  const entry = gnnEntropy[name];
  if (!entry || !entry.probs) return [];

  const thresholdMap = new Map();
  for (const row of odorThresholds.per_task || []) {
    if (row.calibrated_f1 >= MIN_F1) {
      thresholdMap.set(row.task, row.calibrated_threshold);
    }
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
      threshold: Number(threshold.toFixed(2)),
      confidence: Number(margin.toFixed(3)),
    });
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
