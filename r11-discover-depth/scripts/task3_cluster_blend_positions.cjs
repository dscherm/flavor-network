#!/usr/bin/env node
/*
 * Blend UMAP-projected gnn_positions toward each ingredient's cluster
 * centroid so cluster colors form visible blobs in the 3D Network view.
 *
 * Why: clustering happens in the 128-d GNN embedding space (where
 * clusters are well-separated). UMAP's 3D projection compresses
 * distinctions — measured separation ratio on the raw positions was
 * 0.27 (badly overlapped; >2 is healthy).
 *
 * Approach: p_new = (1 - ALPHA) * p_umap + ALPHA * cluster_centroid.
 * ALPHA = 0.40 pulls members 40% of the way toward their cluster
 * centroid while still preserving the original "cooks together → near"
 * relationship.
 *
 * Also writes the old positions to gnn_positions_raw.json for easy
 * rollback.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROD = path.join(ROOT, 'public', 'proDataset');

const ALPHA = 0.70;
// Project each cluster centroid onto this radius sphere (direction
// preserved) so clusters are forced apart before blending. Without this,
// true centroids sit within ~10u of origin — blending shrinks intra-
// spread but can't widen inter-cluster distance.
const CENTROID_RADIUS = 22;
// Iterative repulsion target: minimum centroid separation.
const MIN_CENTROID_SEPARATION = 22;
const REPULSION_ITERS = 60;

// Always read from raw on repeat runs — avoids compounding the blend.
const rawOnDisk = path.join(PROD, 'gnn_positions_raw.json');
const srcPath = fs.existsSync(rawOnDisk) ? rawOnDisk : path.join(PROD, 'gnn_positions.json');
const gp = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const ce = JSON.parse(fs.readFileSync(path.join(PROD, 'cluster_explanations.json'), 'utf8'));
const ic = ce.ingredient_clusters || {};

// Compute per-cluster centroid from the raw UMAP positions.
const centroids = new Map();
const counts = new Map();
for (const [name, info] of Object.entries(ic)) {
  const p = gp[name];
  if (!p || p.length < 3) continue;
  const cid = info.cluster_id;
  if (!centroids.has(cid)) { centroids.set(cid, [0, 0, 0]); counts.set(cid, 0); }
  const c = centroids.get(cid);
  c[0] += p[0]; c[1] += p[1]; c[2] += p[2];
  counts.set(cid, counts.get(cid) + 1);
}
for (const [cid, c] of centroids) {
  const n = counts.get(cid) || 1;
  c[0] /= n; c[1] /= n; c[2] /= n;
}

// Project each centroid to radius CENTROID_RADIUS (direction preserved).
// Then repel to enforce minimum separation.
for (const [cid, c] of centroids) {
  const m = Math.sqrt(c[0] ** 2 + c[1] ** 2 + c[2] ** 2) || 1;
  const s = CENTROID_RADIUS / m;
  c[0] *= s; c[1] *= s; c[2] *= s;
}
const cidList = [...centroids.keys()];
for (let iter = 0; iter < REPULSION_ITERS; iter++) {
  let moved = false;
  for (let i = 0; i < cidList.length; i++) {
    const a = centroids.get(cidList[i]);
    let fx = 0, fy = 0, fz = 0;
    for (let j = 0; j < cidList.length; j++) {
      if (i === j) continue;
      const b = centroids.get(cidList[j]);
      const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < MIN_CENTROID_SEPARATION && d > 0.001) {
        const push = (MIN_CENTROID_SEPARATION - d) / d * 0.25;
        fx += dx * push; fy += dy * push; fz += dz * push;
        moved = true;
      }
    }
    a[0] += fx; a[1] += fy; a[2] += fz;
    // Reproject to sphere.
    const m = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
    if (m > 0) {
      const s = CENTROID_RADIUS / m;
      a[0] *= s; a[1] *= s; a[2] *= s;
    }
  }
  if (!moved) break;
}

// Preserve raw copy for rollback.
const rawPath = path.join(PROD, 'gnn_positions_raw.json');
if (!fs.existsSync(rawPath)) fs.writeFileSync(rawPath, JSON.stringify(gp));

// Apply blend.
let nBlended = 0;
for (const name of Object.keys(gp)) {
  if (name === '_meta') continue;
  const info = ic[name];
  if (!info) continue;
  const c = centroids.get(info.cluster_id);
  if (!c) continue;
  const p = gp[name];
  if (!p || p.length < 3) continue;
  gp[name] = [
    +(p[0] * (1 - ALPHA) + c[0] * ALPHA).toFixed(3),
    +(p[1] * (1 - ALPHA) + c[1] * ALPHA).toFixed(3),
    +(p[2] * (1 - ALPHA) + c[2] * ALPHA).toFixed(3),
  ];
  nBlended++;
}

gp._meta = Object.assign(gp._meta || {}, {
  cluster_blend_alpha: ALPHA,
  cluster_blend_applied_at: new Date().toISOString(),
});

fs.writeFileSync(path.join(PROD, 'gnn_positions.json'), JSON.stringify(gp));

// Report new separation.
const postCentroids = new Map();
const postCounts = new Map();
for (const [name, info] of Object.entries(ic)) {
  const p = gp[name];
  if (!p || p.length < 3) continue;
  const cid = info.cluster_id;
  if (!postCentroids.has(cid)) { postCentroids.set(cid, [0, 0, 0]); postCounts.set(cid, 0); }
  const c = postCentroids.get(cid);
  c[0] += p[0]; c[1] += p[1]; c[2] += p[2];
  postCounts.set(cid, postCounts.get(cid) + 1);
}
for (const [cid, c] of postCentroids) {
  const n = postCounts.get(cid) || 1;
  c[0] /= n; c[1] /= n; c[2] /= n;
}
let sumIntra = 0, nClusters = 0;
for (const [cid, c] of postCentroids) {
  let sumD = 0, n = 0;
  for (const [name, info] of Object.entries(ic)) {
    if (info.cluster_id !== cid) continue;
    const p = gp[name];
    if (!p || p.length < 3) continue;
    sumD += Math.sqrt((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2);
    n++;
  }
  sumIntra += sumD / n;
  nClusters++;
}
const meanIntra = sumIntra / nClusters;
const ids = [...postCentroids.keys()];
let sumInter = 0, pairs = 0;
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const a = postCentroids.get(ids[i]), b = postCentroids.get(ids[j]);
  sumInter += Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  pairs++;
}
const meanInter = sumInter / pairs;

console.log(`[blend] alpha=${ALPHA}, nudged ${nBlended} positions.`);
console.log(`[blend] post-blend intra-cluster spread: ${meanIntra.toFixed(2)}`);
console.log(`[blend] post-blend inter-cluster centroid dist: ${meanInter.toFixed(2)}`);
console.log(`[blend] new separation ratio: ${(meanInter / meanIntra).toFixed(2)} (before 0.27, ≥2 is healthy)`);
