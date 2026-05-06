#!/usr/bin/env node
/**
 * regen-cluster-explanations.cjs — rebuild public/proDataset/cluster_explanations.json
 * so the IngredientPanel badge agrees with the 3D scene labels in
 * cluster_labels.json. Critic audit (2026-05-06) found the two files
 * were drifted: 3D shipped "Mexican" / "Italian" / "Chinese", panel
 * shipped "Spice" / "Dairy" / "Aromatic". The user complaint about
 * pita bread under "Mexican" was triggered by the 3D label.
 *
 * Strategy:
 *   - Adopt cluster_labels.json names as source of truth.
 *   - Recompute the explanation copy as a flat statement of top-5
 *     ingredients + top 3-4 cuisines (multi-cuisine clusters get
 *     listed flatly, no percentages, no flowery prose).
 *   - Preserve top_ingredients, dominant_taste, size, and the
 *     ingredient_clusters mapping unchanged.
 *
 * Output is bit-for-bit determined by inputs so re-runs are no-ops.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LABELS_PATH = path.join(ROOT, 'public/proDataset/cluster_labels.json');
const EXP_PATH = path.join(ROOT, 'public/proDataset/cluster_explanations.json');
const CUISINE_MAP_PATH = path.join(ROOT, 'public/data/cuisine_map.json');

const labelsDoc = JSON.parse(fs.readFileSync(LABELS_PATH, 'utf-8'));
const expDoc = JSON.parse(fs.readFileSync(EXP_PATH, 'utf-8'));
const cuisineMap = JSON.parse(fs.readFileSync(CUISINE_MAP_PATH, 'utf-8'));

// Build cluster_id → [ingredient names] from existing ingredient_clusters
const clusterMembers = new Map();
for (const [name, info] of Object.entries(expDoc.ingredient_clusters)) {
  const cid = typeof info === 'number' ? info : info.cluster_id;
  if (!clusterMembers.has(cid)) clusterMembers.set(cid, []);
  clusterMembers.get(cid).push(name);
}

function topCuisines(memberNames, n = 5) {
  const counts = {};
  let tagged = 0;
  for (const m of memberNames) {
    const cs = cuisineMap[m];
    if (!cs || cs.length === 0) continue;
    tagged += 1;
    for (const c of cs) {
      if (c === 'Global') continue;
      counts[c] = (counts[c] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { top: sorted.slice(0, n).map(([c]) => c), tagged };
}

function explanationFor(label, topIngs, topCs, dominantTaste) {
  const ings = topIngs.slice(0, 3).join(', ');
  const cuisinesLine = topCs.length === 0
    ? ''
    : topCs.length === 1
      ? ` Strongest in ${topCs[0]} cooking.`
      : ` Spans ${topCs.slice(0, -1).join(', ')}, and ${topCs[topCs.length - 1]} cooking.`;
  const tasteLine = dominantTaste
    ? ` Tends ${dominantTaste}.`
    : '';
  return `${label}: ingredients like ${ings} that recipes pair together.${cuisinesLine}${tasteLine}`;
}

const newClusters = {};
for (const [cidStr, info] of Object.entries(labelsDoc.clusters)) {
  const cid = Number(cidStr);
  const members = clusterMembers.get(cid) || [];
  const { top: topCs } = topCuisines(members, 5);
  newClusters[cidStr] = {
    label: info.label,
    explanation: explanationFor(info.label, info.top_ingredients, topCs, info.dominant_taste),
    top_ingredients: info.top_ingredients,
    top_cuisines: topCs,
    dominant_taste: info.dominant_taste,
    size: info.size,
  };
}

// Rewrite ingredient_clusters with new labels (cluster_id unchanged)
const newIngClusters = {};
for (const [name, info] of Object.entries(expDoc.ingredient_clusters)) {
  const cid = typeof info === 'number' ? info : info.cluster_id;
  newIngClusters[name] = {
    cluster_id: cid,
    cluster_label: labelsDoc.clusters[String(cid)]?.label || 'Unknown',
  };
}

const out = {
  _meta: {
    ...(expDoc._meta || {}),
    regeneratedAt: new Date().toISOString(),
    script: 'scripts/regen-cluster-explanations.cjs',
    note: 'Labels taken from cluster_labels.json so the IngredientPanel agrees with the 3D scene. Explanations rewritten as flat multi-cuisine statements.',
  },
  clusters: newClusters,
  pairs: expDoc.pairs || {},
  ingredient_clusters: newIngClusters,
};

fs.writeFileSync(EXP_PATH, JSON.stringify(out, null, 2));

console.log(`Wrote ${EXP_PATH}`);
console.log(`  ${Object.keys(newClusters).length} clusters relabeled from cluster_labels.json:`);
for (const [cid, c] of Object.entries(newClusters)) {
  console.log(`    ${cid} ${c.label.padEnd(22)} cuisines: ${(c.top_cuisines || []).join(', ') || '(none ≥ 1 hit)'}`);
}
