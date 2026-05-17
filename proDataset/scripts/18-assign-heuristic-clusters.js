/**
 * 18-assign-heuristic-clusters.js
 *
 * Heuristic cluster assignment for ingredients with no GNN embedding.
 * Runs a neighbor-vote on chemistry + cuisine pairings, tallies the
 * dominant cluster, and writes provisional cluster_id assignments back
 * into cluster_explanations.json.ingredient_clusters.
 *
 * This is option A from the cluster-gap analysis (the user picked
 * "C: A now, B later"). The proper fix is a GNN re-run + k-means re-fit
 * (which can also surface a Caribbean cluster — currently scattered
 * across all 10 clusters with no dominant home). This script unblocks
 * the UI immediately so the 32 manually-added cuisine ingredients
 * plus ~1,200 other unclustered nodes get a sensible cluster pill.
 *
 * Provenance is preserved: each assignment is tagged
 *   cluster_source: 'heuristic-neighbor-vote'
 * so a future GNN re-run can detect + overwrite them.
 *
 * Hand-overrides for known mis-votes:
 *   panko → c4 (Soy & Ginger). The corpus-pair signal pushed it to c6
 *   (Olive & Wine Herbs) because panko sits next to Mediterranean
 *   ingredients in mixed-cuisine recipes; culinarily it's Japanese
 *   and belongs with dashi/kombu/nori/udon in c4.
 *
 * Usage:
 *   node proDataset/scripts/18-assign-heuristic-clusters.js              (dry-run)
 *   node proDataset/scripts/18-assign-heuristic-clusters.js --apply      (writes)
 */
import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config.js';
import { writeJson, log } from '../utils.js';

const INGREDIENTS_PATH = path.join(OUTPUT_DIR, 'ingredients.json');
const PAIRINGS_PATH = path.join(OUTPUT_DIR, 'pairings.json');
const CUISINE_PAIRS_PATH = path.join(OUTPUT_DIR, 'cuisine_pairings.json');
const PUBLIC_DIR = path.resolve(OUTPUT_DIR, '..', '..', 'public', 'proDataset');
const CLUSTER_EXPL_PATH = path.join(PUBLIC_DIR, 'cluster_explanations.json');

// Minimum vote-confidence to commit an assignment. confidence =
// top_cluster_weight / (top + second). Below this, the neighborhood
// is too ambiguous to assign — leave unclustered until the GNN re-run.
const MIN_CONFIDENCE = 0.40;
// Cuisine-edge weight relative to chemistry strength.
const CUISINE_WEIGHT = 0.3;

const HAND_OVERRIDES = {
  // panko's vote was c6 (Olive & Wine Herbs) due to sparse corpus
  // signal — culinarily it lives in Japan (c4 Soy & Ginger).
  'panko': 4,
};

function main() {
  const isApply = process.argv.includes('--apply');
  log(`=== 18: heuristic cluster assignment (${isApply ? 'APPLY' : 'DRY-RUN'}) ===`);

  const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf8'));
  const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf8'));
  const cuisinePairs = JSON.parse(fs.readFileSync(CUISINE_PAIRS_PATH, 'utf8'));
  const explanations = JSON.parse(fs.readFileSync(CLUSTER_EXPL_PATH, 'utf8'));

  const ingClusters = explanations.ingredient_clusters || {};
  const clusters = explanations.clusters || {};

  // Existing ingredient → cluster_id map.
  const cidByName = new Map();
  for (const [name, info] of Object.entries(ingClusters)) {
    cidByName.set(name, info.cluster_id);
  }

  // Build neighbor index from chemistry + cuisine pairs.
  // name → Map<neighborName, weight>
  const nbrs = new Map();
  function add(a, b, w) {
    if (!nbrs.has(a)) nbrs.set(a, new Map());
    const m = nbrs.get(a);
    m.set(b, (m.get(b) || 0) + w);
  }
  for (const p of pairings) {
    add(p.ingredientA, p.ingredientB, p.strength);
    add(p.ingredientB, p.ingredientA, p.strength);
  }
  for (const [key, _rec] of Object.entries(cuisinePairs.pairs || {})) {
    const [a, b] = key.split('|');
    add(a, b, CUISINE_WEIGHT);
    add(b, a, CUISINE_WEIGHT);
  }

  // Walk each unclustered ingredient.
  const unclustered = Object.keys(ingredients).filter(
    (k) => !k.startsWith('_') && !cidByName.has(k)
  );
  log(`Total ingredients: ${Object.keys(ingredients).filter(k => !k.startsWith('_')).length}`);
  log(`Currently clustered: ${cidByName.size}`);
  log(`Unclustered candidates: ${unclustered.length}`);
  log();

  let assigned = 0;
  let assignedOverride = 0;
  let lowConfidence = 0;
  let noNeighbors = 0;
  const assignments = {};       // name → {cluster_id, confidence, source, voters}
  const summaryByCluster = new Map();

  for (const name of unclustered) {
    if (HAND_OVERRIDES[name] !== undefined) {
      const cid = HAND_OVERRIDES[name];
      assignments[name] = {
        cluster_id: cid,
        cluster_label: clusters[cid]?.label || `c${cid}`,
        confidence: 1.0,
        source: 'hand-override',
        voters: 0,
      };
      assigned++;
      assignedOverride++;
      summaryByCluster.set(cid, (summaryByCluster.get(cid) || 0) + 1);
      continue;
    }

    const m = nbrs.get(name);
    if (!m || m.size === 0) {
      noNeighbors++;
      continue;
    }
    // Tally cluster votes weighted by edge strength.
    const tally = new Map();
    let voters = 0;
    for (const [neighbor, w] of m) {
      const cid = cidByName.get(neighbor);
      if (cid == null) continue;
      tally.set(cid, (tally.get(cid) || 0) + w);
      voters++;
    }
    if (tally.size === 0) {
      noNeighbors++;
      continue;
    }
    const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const second = sorted[1];
    const confidence = second ? top[1] / (top[1] + second[1]) : 1.0;
    if (confidence < MIN_CONFIDENCE) {
      lowConfidence++;
      continue;
    }
    const cid = top[0];
    assignments[name] = {
      cluster_id: cid,
      cluster_label: clusters[cid]?.label || `c${cid}`,
      confidence: +confidence.toFixed(3),
      source: 'heuristic-neighbor-vote',
      voters,
    };
    assigned++;
    summaryByCluster.set(cid, (summaryByCluster.get(cid) || 0) + 1);
  }

  log(`Assigned: ${assigned}  (${assignedOverride} hand-override, ${assigned - assignedOverride} neighbor-vote)`);
  log(`Skipped — low confidence (<${MIN_CONFIDENCE}): ${lowConfidence}`);
  log(`Skipped — no clustered neighbors: ${noNeighbors}`);
  log();
  log('Per-cluster lift (additions):');
  const sortedClusters = [...summaryByCluster.entries()].sort((a, b) => a[0] - b[0]);
  for (const [cid, count] of sortedClusters) {
    log(`  c${cid} ${(clusters[cid]?.label || '').padEnd(28)} +${count}`);
  }
  log();

  // Sample 12 high-interest assignments — the curated additions.
  const sample = [
    'berbere', 'harissa', 'paneer', 'dashi', 'nori', 'panko',
    'sumac', 'sambal', 'recaito', 'sofrito', 'doenjang', 'sriracha',
  ];
  log('Sample assignments from this iteration:');
  for (const s of sample) {
    if (assignments[s]) {
      const a = assignments[s];
      log(`  ${s.padEnd(20)} → c${a.cluster_id} ${a.cluster_label.padEnd(24)} conf=${a.confidence} (${a.source})`);
    } else {
      log(`  ${s.padEnd(20)} — not assigned (no signal or below threshold)`);
    }
  }

  if (!isApply) {
    log();
    log('(dry-run — pass --apply to write changes)');
    return;
  }

  // Merge assignments into ingredient_clusters.
  for (const [name, a] of Object.entries(assignments)) {
    ingClusters[name] = {
      cluster_id: a.cluster_id,
      cluster_label: a.cluster_label,
      cluster_source: a.source,
      cluster_confidence: a.confidence,
    };
  }
  explanations.ingredient_clusters = ingClusters;
  explanations._meta = explanations._meta || {};
  explanations._meta.heuristic_assignments_applied = new Date().toISOString();
  explanations._meta.heuristic_assignments_count = Object.keys(assignments).length;

  writeJson(CLUSTER_EXPL_PATH, explanations);
  log(`Wrote ${CLUSTER_EXPL_PATH}`);
}

main();
