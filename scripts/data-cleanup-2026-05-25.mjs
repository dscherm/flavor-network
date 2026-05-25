// Data cleanup pass — user-driven 2026-05-25 chef audit.
// Removes duplicate / brand-specific / parsing-artifact ingredients from
// the ProData corpus + cluster assignments + pairings + v3 positions.
// Also reassigns 28 alcohol items out of cluster 17 (Baking & Nuts)
// into cluster 1 (Whole Spices & Spirits).
//
// Usage: node scripts/data-cleanup-2026-05-25.mjs
//
// Outputs (in place, with .pre-cleanup-20260525.bak siblings):
//   public/proDataset/ingredients.json
//   public/proDataset/pairings.json
//   public/proDataset/cluster_labels_v3.json
//   public/proDataset/flavor_positions_v3.json

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const DATASET = 'public/proDataset';
const BAK_SUFFIX = '.pre-cleanup-20260525.bak';

const FILES = {
  ingredients: `${DATASET}/ingredients.json`,
  pairings:    `${DATASET}/pairings.json`,
  clusters:    `${DATASET}/cluster_labels_v3.json`,
  positions:   `${DATASET}/flavor_positions_v3.json`,
};

// Deletions — remove from ALL files.
const HARD_DELETE = [
  // Possessive parsing artifacts
  "'s cheese", "'s sauce", "'s milk", "'s sugar",
  // Brand-specific
  'philadelphia cream cheese', 'progresso italian bread crumb',
  // Generic / duplicate labels
  'herb', 'walnut halve',
  'italian style breadcrumb', 'italian seasoned dry bread crumb',
  // Mushroom soup cluster-15 variants only (cream of mushroom soup + dairy variants survive)
  'mushroom soup', 'condensed mushroom soup', 'condensed golden mushroom soup',
  'golden mushroom soup', 'golden brown mushroom soup', 'beefy mushroom soup',
  // Pesto consolidation (basil pesto + tomato pesto survive)
  'pesto sauce',
];

// Soft delete — remove from network rendering (cluster assignment +
// positions) but KEEP in ingredients.json + pairings.json so Recipe Lab
// still recognizes it.
const NETWORK_HIDE = [
  'corn starch',
];

// Alcohol items currently mis-clustered in 17 (Baking & Nuts) → 1 (Whole Spices & Spirits).
const ALCOHOL_REASSIGN_17_TO_1 = [
  'whiskey', 'liqueur', 'grand marnier', 'kahlua', 'triple sec',
  'orange liqueur', 'coffee liqueur', 'sweet vermouth', 'orange-flavored liqueur',
  'raspberry liqueur', 'amaretto', 'maraschino liqueur', 'chocolate liqueur',
  'orange curacao', 'irish cream liqueur', 'cream liqueur', 'ginger liqueur',
  'campari', 'melon liqueur', 'cherry liqueur', 'cointreau', 'coconut liqueur',
  'dry vermouth', 'sambuca', 'blue curacao', 'black sambuca',
  'godiva liqueur', 'kiwi liqueur',
];

function backup(path) {
  const bak = path + BAK_SUFFIX;
  if (!existsSync(bak)) {
    copyFileSync(path, bak);
    console.log(`  backed up -> ${bak}`);
  } else {
    console.log(`  backup exists -> ${bak}`);
  }
}

function loadJSON(path) { return JSON.parse(readFileSync(path, 'utf-8')); }
function writeJSON(path, data) {
  // Compact JSON with newlines after top-level keys for readability.
  writeFileSync(path, JSON.stringify(data, null, 0));
}

console.log('=== data cleanup 2026-05-25 ===');
console.log('backing up source files...');
for (const f of Object.values(FILES)) backup(f);

const ingredients = loadJSON(FILES.ingredients);
const pairings    = loadJSON(FILES.pairings);
const clusterDoc  = loadJSON(FILES.clusters);
const positions   = loadJSON(FILES.positions);

const before = {
  ingredients: Object.keys(ingredients).length,
  pairings: pairings.length,
  clusterAssign: Object.keys(clusterDoc.ingredients).length,
  positions: Object.keys(positions).filter((k) => !k.startsWith('_')).length,
};
console.log('\nBEFORE:');
console.log(`  ingredients.json keys:    ${before.ingredients}`);
console.log(`  pairings.json edges:      ${before.pairings}`);
console.log(`  cluster_labels assigns:   ${before.clusterAssign}`);
console.log(`  flavor_positions_v3 keys: ${before.positions}`);

// 1) Hard delete — from all 4 files.
const deleteSet = new Set(HARD_DELETE);
let edgesDropped = 0;
let ingredientsDropped = 0;
let positionsDropped = 0;
let clusterAssignDropped = 0;

for (const name of deleteSet) {
  if (ingredients[name]) { delete ingredients[name]; ingredientsDropped++; }
  if (clusterDoc.ingredients[name] !== undefined) { delete clusterDoc.ingredients[name]; clusterAssignDropped++; }
  if (positions[name] !== undefined) { delete positions[name]; positionsDropped++; }
}

// 2) Soft delete (corn starch) — drop from cluster + positions only.
const networkHideSet = new Set(NETWORK_HIDE);
for (const name of networkHideSet) {
  if (clusterDoc.ingredients[name] !== undefined) { delete clusterDoc.ingredients[name]; clusterAssignDropped++; }
  if (positions[name] !== undefined) { delete positions[name]; positionsDropped++; }
}

// 3) Prune pairings — drop any edge whose A or B is in deleteSet.
//    (corn starch edges are PRESERVED so Recipe Lab still finds them.)
const survivingPairings = [];
for (const edge of pairings) {
  if (deleteSet.has(edge.ingredientA) || deleteSet.has(edge.ingredientB)) {
    edgesDropped++;
    continue;
  }
  survivingPairings.push(edge);
}

// 4) Alcohol reassignment 17 → 1, with per-cluster size accounting.
let reassigned = 0;
let reassignMissing = 0;
for (const name of ALCOHOL_REASSIGN_17_TO_1) {
  const cur = clusterDoc.ingredients[name];
  if (cur === 17) {
    clusterDoc.ingredients[name] = 1;
    reassigned++;
  } else if (cur === undefined) {
    reassignMissing++;
  } else {
    // Already in some other cluster — leave it.
    console.log(`  ! "${name}" is in cluster ${cur}, not 17 — leaving alone`);
  }
}

// 5) Recount cluster sizes from the assignments and write back.
const sizeByCluster = new Map();
for (const cid of Object.values(clusterDoc.ingredients)) {
  sizeByCluster.set(cid, (sizeByCluster.get(cid) || 0) + 1);
}
for (const c of clusterDoc.clusters) {
  const newSize = sizeByCluster.get(c.id) || 0;
  if (newSize !== c.size) {
    console.log(`  cluster ${c.id} (${c.label}): size ${c.size} -> ${newSize}`);
    c.size = newSize;
  }
}

// 6) Mark the cleanup in cluster_labels meta.
clusterDoc._meta = clusterDoc._meta || {};
clusterDoc._meta.cleanups = clusterDoc._meta.cleanups || [];
clusterDoc._meta.cleanups.push({
  date: '2026-05-25',
  type: 'chef-audit',
  deletions: HARD_DELETE.length,
  network_hide: NETWORK_HIDE.length,
  alcohol_reassigned_17_to_1: reassigned,
});

writeJSON(FILES.ingredients, ingredients);
writeJSON(FILES.pairings, survivingPairings);
writeJSON(FILES.clusters, clusterDoc);
writeJSON(FILES.positions, positions);

console.log('\nAFTER:');
console.log(`  ingredients.json keys:    ${Object.keys(ingredients).length}  (removed ${ingredientsDropped})`);
console.log(`  pairings.json edges:      ${survivingPairings.length}  (removed ${edgesDropped})`);
console.log(`  cluster_labels assigns:   ${Object.keys(clusterDoc.ingredients).length}  (removed ${clusterAssignDropped})`);
console.log(`  flavor_positions_v3 keys: ${Object.keys(positions).filter((k) => !k.startsWith('_')).length}  (removed ${positionsDropped})`);
console.log(`\n  alcohol reassigned 17 → 1: ${reassigned}  (${reassignMissing} were not in the corpus)`);
console.log('\ndone.');
