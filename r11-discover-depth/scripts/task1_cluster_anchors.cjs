#!/usr/bin/env node
/*
 * Cluster label anchor precompute (v2 — rev for R13 Phase 2 followup).
 *
 * Problem history:
 *   v1 (R11 Task 1) — labels at raw centroid_3d huddled near origin
 *     because Node2Vec embeddings are directional on a hypersphere, so
 *     cluster centroids average toward zero.
 *   v1 fix — use top_ingredients[0]'s actual position as anchor. Pushed
 *     labels into cluster space but two new problems emerged:
 *       (a) top_ingredients is ordered by global centrality, not by
 *           "representative of this cluster" — so Protein anchored on
 *           sugar, Fruit on onion, etc. Semantically wrong.
 *       (b) multiple clusters' top hubs happen to share Node2Vec
 *           positions (5 clusters within 6 units of [9,3,5]), so labels
 *           still stack visually.
 *
 * This version places each label on a sphere of radius LABEL_RADIUS along
 * the cluster centroid's DIRECTION (not its magnitude), then runs
 * iterative repulsion to guarantee minimum pairwise separation. Keeps
 * anchor_ingredient for tooltip/debug but the label position is
 * direction-derived, not ingredient-derived. No more "Protein huddled
 * over sugar."
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROD = path.join(ROOT, 'public', 'proDataset');

const LABEL_RADIUS = 38;   // outside p90 node radius (~48) would be off-screen;
                           // inside p50 (~17) would overlap nodes. 38 is the
                           // sweet spot: clearly outside the main cloud.
const MIN_SEPARATION = 18; // minimum world-space gap between two labels.
const REPULSION_ITERATIONS = 80;

const clusterFile = path.join(PROD, 'cluster_labels.json');
const gpFile = path.join(PROD, 'gnn_positions.json');
const pcaFile = path.join(PROD, 'pca_positions.json');

const cluster = JSON.parse(fs.readFileSync(clusterFile, 'utf8'));
const gp = JSON.parse(fs.readFileSync(gpFile, 'utf8'));
const pca = JSON.parse(fs.readFileSync(pcaFile, 'utf8'));

const clusters = cluster.clusters;

function normalize3(v) {
  const m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

function normalize2(v) {
  const m = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1;
  return [v[0] / m, v[1] / m];
}

// Step 1: initial placement along centroid direction at LABEL_RADIUS.
for (const c of clusters) {
  const dir = normalize3(c.centroid_3d || [1, 0, 0]);
  c._pos3 = [dir[0] * LABEL_RADIUS, dir[1] * LABEL_RADIUS, dir[2] * LABEL_RADIUS];

  if (c.centroid_2d) {
    const dir2 = normalize2(c.centroid_2d);
    c._pos2 = [dir2[0] * LABEL_RADIUS, dir2[1] * LABEL_RADIUS];
  } else {
    c._pos2 = [0, 0];
  }
}

// Step 2: iterative repulsion to enforce minimum separation.
function repelOnSphere(dim) {
  const posKey = dim === 3 ? '_pos3' : '_pos2';
  const R = LABEL_RADIUS;
  for (let iter = 0; iter < REPULSION_ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < clusters.length; i++) {
      const a = clusters[i][posKey];
      let fx = 0, fy = 0, fz = 0;
      for (let j = 0; j < clusters.length; j++) {
        if (i === j) continue;
        const b = clusters[j][posKey];
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        const dz = dim === 3 ? a[2] - b[2] : 0;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < MIN_SEPARATION && d > 0.001) {
          const push = (MIN_SEPARATION - d) / d * 0.5;
          fx += dx * push;
          fy += dy * push;
          fz += dz * push;
          moved = true;
        }
      }
      a[0] += fx;
      a[1] += fy;
      if (dim === 3) a[2] += fz;
      // Re-project to sphere of radius R (so labels stay at visible depth).
      const m = Math.sqrt(a[0] * a[0] + a[1] * a[1] + (dim === 3 ? a[2] * a[2] : 0));
      if (m > 0) {
        const scale = R / m;
        a[0] *= scale;
        a[1] *= scale;
        if (dim === 3) a[2] *= scale;
      }
    }
    if (!moved) break;
  }
}

repelOnSphere(3);
repelOnSphere(2);

// Step 3: pick anchor_ingredient for tooltip/debug — prefer a top_ingredient
// whose name matches the cluster label, fall back to top_ingredients[0].
function pickAnchorIngredient(c) {
  const labelLow = (c.label || '').toLowerCase();
  for (const name of c.top_ingredients || []) {
    if (name.toLowerCase().includes(labelLow.replace(/\s*\(.+\)/g, ''))) return name;
  }
  for (const name of c.top_ingredients || []) {
    if (gp[name]) return name;
  }
  return null;
}

for (const c of clusters) {
  c.anchor_ingredient = pickAnchorIngredient(c);
  c.label_anchor_3d = c._pos3.map((x) => +x.toFixed(3));
  c.label_anchor_2d = c._pos2.map((x) => +x.toFixed(3));
  delete c._pos3;
  delete c._pos2;
}

fs.writeFileSync(clusterFile, JSON.stringify(cluster, null, 2));

// Verification summary.
console.log('Updated', clusters.length, 'clusters at radius', LABEL_RADIUS);
console.log('Pairwise distances (all should be >= ' + MIN_SEPARATION + '):');
const dists = [];
for (let i = 0; i < clusters.length; i++) {
  for (let j = i + 1; j < clusters.length; j++) {
    const a = clusters[i].label_anchor_3d;
    const b = clusters[j].label_anchor_3d;
    const d = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    dists.push(d);
    if (d < MIN_SEPARATION) {
      console.log('  !! close: ' + clusters[i].label + ' <-> ' + clusters[j].label + ' = ' + d.toFixed(2));
    }
  }
}
console.log('  min pair dist:', Math.min(...dists).toFixed(2));
console.log('  mean pair dist:', (dists.reduce((s, x) => s + x, 0) / dists.length).toFixed(2));
console.log('\nFinal cluster anchors:');
for (const c of clusters) {
  const [x, y, z] = c.label_anchor_3d;
  const r = Math.sqrt(x * x + y * y + z * z);
  console.log('  ' + c.label.padEnd(22) + ' r=' + r.toFixed(1) + '  [' + c.label_anchor_3d.map(v => v.toFixed(1)).join(',') + ']  anchor=' + c.anchor_ingredient);
}
