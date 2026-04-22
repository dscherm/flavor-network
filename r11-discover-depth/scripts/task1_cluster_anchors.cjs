#!/usr/bin/env node
/*
 * R11 Task 1 — Cluster label anchor precompute
 *
 * Problem: cluster_labels.json centroids collapse toward origin in Node2Vec
 * embedding space (hypersphere). Labels huddle at center while nodes orbit.
 * Measured: centroid dists 0.75–9.22; node radii p50=17, p90=48.
 *
 * Fix: for each cluster, use its top-ranked ingredient's actual position as
 * the label anchor. Writes `label_anchor_3d` + `label_anchor_2d` per cluster.
 * Also disambiguates duplicate "Chili" cluster labels.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROD = path.join(ROOT, 'public', 'proDataset');

const clusterFile = path.join(PROD, 'cluster_labels.json');
const gpFile = path.join(PROD, 'gnn_positions.json');
const pcaFile = path.join(PROD, 'pca_positions.json');

const cluster = JSON.parse(fs.readFileSync(clusterFile, 'utf8'));
const gp = JSON.parse(fs.readFileSync(gpFile, 'utf8'));
const pca = JSON.parse(fs.readFileSync(pcaFile, 'utf8'));

const clusters = cluster.clusters;

function findAnchorIngredient(c) {
  // Prefer the first top_ingredient that has both a 3D and a 2D position.
  for (const name of c.top_ingredients || []) {
    if (gp[name] && pca[name]) return name;
  }
  // Fallback: any top_ingredient with at least one position.
  for (const name of c.top_ingredients || []) {
    if (gp[name] || pca[name]) return name;
  }
  return null;
}

// Disambiguate duplicate labels by appending first top_ingredient.
const labelCounts = {};
for (const c of clusters) labelCounts[c.label] = (labelCounts[c.label] || 0) + 1;
const dupes = Object.keys(labelCounts).filter(k => labelCounts[k] > 1);

for (const c of clusters) {
  const anchorName = findAnchorIngredient(c);
  c.anchor_ingredient = anchorName;

  if (anchorName && gp[anchorName]) {
    c.label_anchor_3d = gp[anchorName].slice(0, 3);
  } else {
    // Fallback: push centroid outward to p50 node radius (~17 units).
    const [x, y, z] = c.centroid_3d;
    const mag = Math.sqrt(x * x + y * y + z * z) || 1;
    const scale = 17 / mag;
    c.label_anchor_3d = [x * scale, y * scale, z * scale];
  }

  if (anchorName && pca[anchorName]) {
    c.label_anchor_2d = pca[anchorName].slice(0, 2);
  } else {
    c.label_anchor_2d = c.centroid_2d;
  }

  // Disambiguate duplicate labels.
  if (dupes.includes(c.label) && anchorName) {
    c.label = `${c.label} (${anchorName})`;
  }
}

fs.writeFileSync(clusterFile, JSON.stringify(cluster, null, 2));

// Verification summary.
console.log('Updated', clusters.length, 'clusters.');
for (const c of clusters) {
  const [x, y, z] = c.label_anchor_3d;
  const dist3d = Math.sqrt(x * x + y * y + z * z).toFixed(2);
  console.log(
    `  id=${c.id} "${c.label}" anchor=${c.anchor_ingredient || 'FALLBACK'}  3d-dist=${dist3d}`
  );
}
