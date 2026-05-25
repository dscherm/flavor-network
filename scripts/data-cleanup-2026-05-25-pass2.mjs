// Pass-2 data cleanup — same deletion list as 2026-05-25 pass 1
// (b02dc54), extended to the 15 derivative data files pass-1 missed.
// After pass-1 the deleted ingredients still appeared in gnn_entropy /
// gnn_positions / recipe_pairs / cluster_explanations / etc., so the
// network was still rendering them as unclustered points.
//
// Idempotent: skips deletions whose target keys are already absent.
//
// Usage: node scripts/data-cleanup-2026-05-25-pass2.mjs

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const DATA = 'public/proDataset';
const BAK_SUFFIX = '.pre-cleanup-pass2-20260525.bak';

const HARD_DELETE = new Set([
  // Possessive parsing artifacts
  "'s cheese", "'s sauce", "'s milk", "'s sugar",
  // Brand-specific
  'philadelphia cream cheese', 'progresso italian bread crumb',
  // Generic / duplicate labels
  'herb', 'walnut halve',
  'italian style breadcrumb', 'italian seasoned dry bread crumb',
  // Cluster-15 mushroom soup variants only
  'mushroom soup', 'condensed mushroom soup', 'condensed golden mushroom soup',
  'golden mushroom soup', 'golden brown mushroom soup', 'beefy mushroom soup',
  // Pesto consolidation
  'pesto sauce',
]);

// Corn starch: also remove from network-rendering files. Pass-1 already
// removed it from cluster_labels_v3 + flavor_positions_v3. Recipe Lab
// keeps it via ingredients.json + pairings.json + recipe_pairs.json +
// bridge_compounds.json (none of which corn-starch-touch files exist
// in our list).
const NETWORK_HIDE = new Set(['corn starch']);

// Files where ingredient name → data (just delete the keys).
const DICT_KEYED_FILES = [
  'gnn_entropy.json',
  'gnn_entropy_imputed.json',
  'gnn_positions.json',
  'gnn_positions_raw.json',
  'gnn_compounds.json',
  'pca_positions.json',
  'flavor_positions.json',
  'flavor_positions_2d.json',
  'flavor_positions_2d_v3.json',
];

const log = (msg) => console.log(`[pass2] ${msg}`);

function backup(path) {
  const bak = path + BAK_SUFFIX;
  if (!existsSync(bak)) copyFileSync(path, bak);
}

const INDENTED_FILES = new Set([
  'ingredients.json',
  'cluster_explanations.json',
  'flavor_cluster_labels.json',
]);
function loadJSON(path) { return JSON.parse(readFileSync(path, 'utf-8')); }
function writeJSON(path, data, indent) { writeFileSync(path, JSON.stringify(data, null, indent ?? 0)); }

function isDeleted(name) {
  return HARD_DELETE.has(name) || NETWORK_HIDE.has(name);
}

let totalDeletions = 0;
const summary = [];

function scrubDictKeyed(file) {
  const path = `${DATA}/${file}`;
  backup(path);
  const d = loadJSON(path);
  let n = 0;
  for (const name of [...HARD_DELETE, ...NETWORK_HIDE]) {
    if (d[name] !== undefined) { delete d[name]; n++; }
  }
  writeJSON(path, d);
  summary.push({ file, removed: n });
  totalDeletions += n;
  log(`${file}: removed ${n} keys`);
}

function scrubClusterExplanations() {
  const path = `${DATA}/cluster_explanations.json`;
  backup(path);
  const d = loadJSON(path);
  let n = 0;
  const ic = d.ingredient_clusters || {};
  for (const name of [...HARD_DELETE, ...NETWORK_HIDE]) {
    if (ic[name] !== undefined) { delete ic[name]; n++; }
  }
  if (d._meta) d._meta.n_ingredients = Object.keys(ic).length;
  writeJSON(path, d, 2);
  summary.push({ file: 'cluster_explanations.json', removed: n });
  totalDeletions += n;
  log(`cluster_explanations.json: removed ${n} ingredient_clusters entries`);
}

function scrubFlavorClusterLabels() {
  const path = `${DATA}/flavor_cluster_labels.json`;
  backup(path);
  const d = loadJSON(path);
  let n = 0;
  const ic = d.ingredient_clusters || {};
  for (const name of [...HARD_DELETE, ...NETWORK_HIDE]) {
    if (ic[name] !== undefined) { delete ic[name]; n++; }
  }
  // Also scrub top_ingredients[] inside each cluster.
  let topScrubbed = 0;
  if (Array.isArray(d.clusters)) {
    for (const c of d.clusters) {
      if (Array.isArray(c.top_ingredients)) {
        const before = c.top_ingredients.length;
        c.top_ingredients = c.top_ingredients.filter((x) => !isDeleted(x));
        topScrubbed += (before - c.top_ingredients.length);
      }
    }
  }
  if (d._meta) d._meta.n_ingredients = Object.keys(ic).length;
  writeJSON(path, d, 2);
  summary.push({ file: 'flavor_cluster_labels.json', removed: n, topIngredientsScrubbed: topScrubbed });
  totalDeletions += n;
  log(`flavor_cluster_labels.json: removed ${n} ingredient_clusters + ${topScrubbed} top_ingredients entries`);
}

function scrubFlavorGraphData(file) {
  const path = `${DATA}/${file}`;
  backup(path);
  const d = loadJSON(path);
  let nodesDropped = 0;
  let edgesDropped = 0;
  if (Array.isArray(d.nodes)) {
    const before = d.nodes.length;
    d.nodes = d.nodes.filter((n) => !isDeleted(n.name));
    nodesDropped = before - d.nodes.length;
  }
  if (Array.isArray(d.edges)) {
    const before = d.edges.length;
    d.edges = d.edges.filter((e) => {
      const a = e.source ?? e.ingredientA ?? e.a;
      const b = e.target ?? e.ingredientB ?? e.b;
      return !isDeleted(a) && !isDeleted(b);
    });
    edgesDropped = before - d.edges.length;
  }
  writeJSON(path, d);
  summary.push({ file, nodesDropped, edgesDropped });
  totalDeletions += nodesDropped;
  log(`${file}: dropped ${nodesDropped} nodes + ${edgesDropped} edges`);
}

function scrubBridgeCompounds() {
  const path = `${DATA}/bridge_compounds.json`;
  backup(path);
  const d = loadJSON(path);
  let n = 0;
  for (const key of Object.keys(d)) {
    if (!key.includes('|')) continue;
    const [a, b] = key.split('|', 2);
    // Don't soft-delete corn starch from bridge_compounds — Recipe Lab tier resolution wants it.
    if (HARD_DELETE.has(a) || HARD_DELETE.has(b)) {
      delete d[key];
      n++;
    }
  }
  writeJSON(path, d);
  summary.push({ file: 'bridge_compounds.json', removed: n });
  totalDeletions += n;
  log(`bridge_compounds.json: removed ${n} pair keys`);
}

function scrubRecipePairs() {
  const path = `${DATA}/recipe_pairs.json`;
  backup(path);
  const d = loadJSON(path);
  let outerDropped = 0;
  let innerDropped = 0;
  const targets = new Set(HARD_DELETE); // corn starch stays — Recipe Lab needs it
  if (d.globalCount) {
    for (const name of targets) {
      if (d.globalCount[name] !== undefined) { delete d.globalCount[name]; }
    }
  }
  if (d.pairs) {
    for (const name of targets) {
      if (d.pairs[name] !== undefined) { delete d.pairs[name]; outerDropped++; }
    }
    for (const k of Object.keys(d.pairs)) {
      const inner = d.pairs[k];
      for (const t of targets) {
        if (inner[t] !== undefined) { delete inner[t]; innerDropped++; }
      }
    }
  }
  if (d._meta) d._meta.ingredients = Object.keys(d.pairs || {}).length;
  writeJSON(path, d);
  summary.push({ file: 'recipe_pairs.json', outerKeysDropped: outerDropped, innerEntriesDropped: innerDropped });
  totalDeletions += outerDropped;
  log(`recipe_pairs.json: ${outerDropped} top-level + ${innerDropped} inner partner entries`);
}

log('=== expanded cleanup pass 2 ===');
log(`HARD_DELETE: ${HARD_DELETE.size} items`);
log(`NETWORK_HIDE (corn starch): ${NETWORK_HIDE.size} item — network files only`);

for (const f of DICT_KEYED_FILES) scrubDictKeyed(f);
scrubClusterExplanations();
scrubFlavorClusterLabels();
scrubFlavorGraphData('flavor_graph_data.json');
scrubFlavorGraphData('flavor_graph_data_v3.json');
scrubBridgeCompounds();
scrubRecipePairs();

log(`\nTotal: ${totalDeletions} deletions across ${summary.length} files`);
console.log('\nSummary table:');
for (const s of summary) console.log(' ', s);
