#!/usr/bin/env node
/*
 * impute_hub_profiles — fill gnn_entropy.json predictions for hub
 * ingredients (egg, butter, flour, mayonnaise, ...) that never went
 * through the M3 multi-task GNN because their exact SMILES wasn't in
 * the compounds.parquet training set.
 *
 * Algorithm: k-nearest-neighbor imputation in pairing-co-occurrence
 * space. For each hub, take its top-K strongest paired ingredients
 * that DO have predictions, and compute a strength-weighted average
 * of their probability vectors. Each imputed entry is marked
 * `imputed: true` and carries `imputed_from_n` + `imputed_confidence`
 * so the UI can render it differently (or hide it) if desired.
 *
 * Output: public/proDataset/gnn_entropy_imputed.json — a drop-in
 * extension; the UI loads the imputed file when present, falling back
 * to the real-prediction-only one otherwise.
 *
 * Usage:
 *   node scripts/impute_hub_profiles.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROD = path.join(ROOT, 'public', 'proDataset');

const gePath = path.join(PROD, 'gnn_entropy.json');
const ingPath = path.join(PROD, 'ingredients.json');
const pairsPath = path.join(PROD, 'pairings.json');
const outPath = path.join(PROD, 'gnn_entropy_imputed.json');

const K = 20;
const MIN_NEIGHBORS = 5;
const MIN_TOTAL_STRENGTH = 2.0; // K=20 * 0.1 avg strength = 2.0

// Blending mix between mean-pool and max-pool: 0 = pure mean, 1 = pure max.
// Pure mean dilutes distinctive signals (mayonnaise averaged across herbs
// + cheese + spices loses its 'fatty' extremity). Pure max overconfides on
// any single strong neighbor. 0.6 max / 0.4 mean preserves distinctive
// per-task peaks while still smoothing outliers.
const MAX_MIX = 0.6;

const ge = JSON.parse(fs.readFileSync(gePath, 'utf8'));
const ing = JSON.parse(fs.readFileSync(ingPath, 'utf8'));
const pairs = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));

const TASKS = ge._meta.tasks;
const predicted = new Set(Object.keys(ge).filter(k => k !== '_meta'));
const allNames = Object.keys(ing);
const hubs = allNames.filter(n => !predicted.has(n));

console.log(`[impute] ${predicted.size} predicted, ${hubs.length} hubs missing, ${TASKS.length} tasks`);

// Build per-hub neighbor list, only counting edges to predicted ingredients.
const adj = new Map();
for (const h of hubs) adj.set(h, []);
for (const e of pairs) {
  const a = e.ingredientA, b = e.ingredientB, s = e.strength || 0;
  if (s <= 0) continue;
  if (adj.has(a) && predicted.has(b)) adj.get(a).push({ n: b, s });
  if (adj.has(b) && predicted.has(a)) adj.get(b).push({ n: a, s });
}

const imputed = {};
let ok = 0, skipped = 0;
const skippedExamples = [];

for (const h of hubs) {
  const neighbors = adj.get(h);
  if (!neighbors || neighbors.length < MIN_NEIGHBORS) {
    skipped++;
    if (skippedExamples.length < 5) skippedExamples.push(`${h} (n=${neighbors?.length || 0})`);
    continue;
  }
  // Top-K by strength
  neighbors.sort((a, b) => b.s - a.s);
  const top = neighbors.slice(0, K);
  const totalStrength = top.reduce((sum, x) => sum + x.s, 0);
  if (totalStrength < MIN_TOTAL_STRENGTH) {
    skipped++;
    continue;
  }
  // Per-task weighted mean + weighted max across top-K neighbors.
  const weightedSum = {};
  const weightedMax = {};
  for (const task of TASKS) { weightedSum[task] = 0; weightedMax[task] = 0; }
  for (const { n, s } of top) {
    const entry = ge[n];
    if (!entry || !entry.probs) continue;
    for (const task of TASKS) {
      const p = entry.probs[task] || 0;
      weightedSum[task] += p * s;
      // Strength-weighted "how strong does a paired ingredient express
      // this task" — use the neighbor's p scaled by its relative strength
      // rank, not raw strength (otherwise max would always ~= top neighbor).
      const scaled = p * Math.sqrt(s);
      if (scaled > weightedMax[task]) weightedMax[task] = scaled;
    }
  }
  const probs = {};
  for (const task of TASKS) {
    const mean = weightedSum[task] / totalStrength;
    const max = weightedMax[task];
    const blended = MAX_MIX * max + (1 - MAX_MIX) * mean;
    probs[task] = Number(blended.toFixed(4));
  }

  // Simple entropy for completeness (same formula as the real entries).
  const probVals = TASKS.map(t => probs[t]);
  const entropy = probVals.reduce((acc, p) => {
    if (p <= 0 || p >= 1) return acc;
    return acc - (p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  }, 0);

  imputed[h] = {
    probs,
    entropy: Number(entropy.toFixed(4)),
    entropy_norm: Number((entropy / TASKS.length).toFixed(4)),
    imputed: true,
    imputed_from_n: top.length,
    imputed_confidence: Number(Math.min(1, totalStrength / K).toFixed(3)),
  };
  ok++;
}

// Merge: start from real entries, add imputed ones alongside.
const merged = { _meta: { ...ge._meta, imputed_count: ok, imputed_algorithm: 'knn-pairing-strength-blended', k: K, min_neighbors: MIN_NEIGHBORS, max_mix: MAX_MIX } };
for (const name of Object.keys(ge)) {
  if (name === '_meta') continue;
  merged[name] = ge[name];
}
for (const name of Object.keys(imputed)) {
  merged[name] = imputed[name];
}

fs.writeFileSync(outPath, JSON.stringify(merged, null, 0));
console.log(`[impute] imputed ${ok} hubs, skipped ${skipped} (examples: ${skippedExamples.join(', ')})`);
console.log(`[impute] wrote ${outPath}`);

// Spot-check: print predicted profile for a few well-known hubs.
const SPOT = ['egg', 'butter', 'bacon', 'mayonnaise', 'flour', 'nut', 'bay leaf', 'baking powder', 'cheddar', 'parmesan', 'vegetable oil'];
console.log('\n[impute] spot-check (tasks with prob >= 0.5):');
for (const name of SPOT) {
  const entry = merged[name];
  if (!entry) { console.log(`  ${name.padEnd(18)} not imputed`); continue; }
  const hits = Object.entries(entry.probs).filter(([,v]) => v >= 0.5).map(([k,v]) => `${k}=${v.toFixed(2)}`);
  const src = entry.imputed ? `imputed(n=${entry.imputed_from_n}, conf=${entry.imputed_confidence})` : 'real';
  console.log(`  ${name.padEnd(18)} ${src}  ${hits.join('  ')}`);
}
