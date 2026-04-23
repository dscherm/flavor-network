#!/usr/bin/env node
/*
 * Cluster label anchor precompute (v3 — real centroids).
 *
 * v1/v2 issues:
 *   - v1: labels at raw cluster.centroid_3d huddled near origin.
 *   - v2: labels placed on a radius-38 sphere along centroid direction
 *     — no overlap, but labels disconnected from where cluster members
 *     actually live (members' own centroids are at distance 4-10, not 38).
 *
 * v3 approach: use the TRUE spatial centroid of each cluster's members
 * in gnn_positions (3D) / pca_positions (2D), then lift Y by +8 for
 * readability. Apply mild repulsion (min 12u separation) only when two
 * labels collide — never push them off their cluster.
 *
 * Cross-references ingredients.json ← cluster_explanations.json to
 * discover which ingredients belong to each cluster.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROD = path.join(ROOT, 'public', 'proDataset');

const MIN_SEPARATION = 12;
const Y_LIFT = 8;
const REPULSION_ITERATIONS = 30;

const cluster = JSON.parse(fs.readFileSync(path.join(PROD, 'cluster_labels.json'), 'utf8'));
const gp = JSON.parse(fs.readFileSync(path.join(PROD, 'gnn_positions.json'), 'utf8'));
const pca = JSON.parse(fs.readFileSync(path.join(PROD, 'pca_positions.json'), 'utf8'));
const ce = JSON.parse(fs.readFileSync(path.join(PROD, 'cluster_explanations.json'), 'utf8'));

const clusters = cluster.clusters;
const ic = ce.ingredient_clusters || {};

// Build { cluster_id → [ingredient names] } from ingredient_clusters.
const membersByCluster = new Map();
for (const [name, info] of Object.entries(ic)) {
  const cid = info.cluster_id;
  if (!membersByCluster.has(cid)) membersByCluster.set(cid, []);
  membersByCluster.get(cid).push(name);
}

function centroidOfNames(names, positions, dim) {
  let s = new Array(dim).fill(0);
  let n = 0;
  for (const name of names) {
    const p = positions[name];
    if (!p || p.length < dim) continue;
    for (let i = 0; i < dim; i++) s[i] += p[i];
    n++;
  }
  if (n === 0) return null;
  return s.map(x => x / n);
}

// Step 1: compute real member centroids per cluster.
for (const c of clusters) {
  const members = membersByCluster.get(c.id) || c.top_ingredients || [];
  const c3 = centroidOfNames(members, gp, 3) || c.centroid_3d || [0, 0, 0];
  const c2 = centroidOfNames(members, pca, 2) || c.centroid_2d || [0, 0];
  c._pos3 = [c3[0], c3[1] + Y_LIFT, c3[2]];
  c._pos2 = [c2[0], c2[1]];
  c._memberCount = members.length;
}

// Step 2: gentle repulsion only when labels collide. No projection to
// sphere — labels must stay AT their cluster.
function repel(dim) {
  const key = dim === 3 ? '_pos3' : '_pos2';
  for (let iter = 0; iter < REPULSION_ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < clusters.length; i++) {
      const a = clusters[i][key];
      let fx = 0, fy = 0, fz = 0;
      for (let j = 0; j < clusters.length; j++) {
        if (i === j) continue;
        const b = clusters[j][key];
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        const dz = dim === 3 ? a[2] - b[2] : 0;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < MIN_SEPARATION && d > 0.001) {
          const push = (MIN_SEPARATION - d) / d * 0.25;
          fx += dx * push;
          fy += dy * push;
          if (dim === 3) fz += dz * push;
          moved = true;
        }
      }
      a[0] += fx;
      a[1] += fy;
      if (dim === 3) a[2] += fz;
    }
    if (!moved) break;
  }
}

repel(3);
repel(2);

function pickAnchorIngredient(c) {
  const labelLow = (c.label || '').toLowerCase().replace(/\s*\(.+\)/g, '');
  for (const name of c.top_ingredients || []) {
    if (name.toLowerCase().includes(labelLow)) return name;
  }
  for (const name of c.top_ingredients || []) {
    if (gp[name]) return name;
  }
  return null;
}

for (const c of clusters) {
  c.anchor_ingredient = pickAnchorIngredient(c);
  c.label_anchor_3d = c._pos3.map(x => +x.toFixed(3));
  c.label_anchor_2d = c._pos2.map(x => +x.toFixed(3));
  delete c._pos3;
  delete c._pos2;
  delete c._memberCount;
}

fs.writeFileSync(path.join(PROD, 'cluster_labels.json'), JSON.stringify(cluster, null, 2));

console.log('Cluster label anchors (real member centroids, Y-lifted by ' + Y_LIFT + ', repelled at min ' + MIN_SEPARATION + '):');
for (const c of clusters) {
  const [x, y, z] = c.label_anchor_3d;
  const r = Math.sqrt(x * x + y * y + z * z);
  const members = (membersByCluster.get(c.id) || []).length;
  console.log('  ' + c.label.padEnd(22) + ' r=' + r.toFixed(1) + ' anchor=[' + c.label_anchor_3d.map(v => v.toFixed(1)).join(',') + '] (' + members + ' members)');
}
