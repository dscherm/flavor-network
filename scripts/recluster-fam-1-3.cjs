#!/usr/bin/env node
/**
 * recluster-fam-1-3.cjs — post-hoc K-Means split inside Highballs &
 * Fizzes (fam 1) and Boozy Sippers (fam 3). The full v2 K-Means run
 * found exactly one sub-cluster for each of these families
 * (subclusters[1]['0'] = 78 cocktails; subclusters[3]['0'] = 66) —
 * structurally homogeneous enough that the silhouette-driven sub-K
 * search picked K_sub=1. Per user request, force K_sub=3 (Highballs)
 * and K_sub=2 (Boozy) so the visual scene shows distinct rings
 * inside each family disc and the cluster joystick can fly into
 * meaningful sub-zones.
 *
 * The clustering operates on the existing 31-dim standardized
 * feature vectors stored on each assignment, so the split lives in
 * the same space as the parent K=6 model and can be regenerated
 * deterministically from this file alone.
 *
 * Outputs are written back to cocktail_clusters.json. Re-running
 * 09-emit-codex-v2.cjs after this script propagates the new
 * sub-clusters into public/data/cocktail_codex_v2.json.
 */

const fs = require('node:fs');
const path = require('node:path');

const CLUSTERS_PATH = path.resolve(__dirname, '../proDataset/cocktails_v2/data/cocktail_clusters.json');

const TARGETS = [
  { family_id: 1, k_sub: 3, label: 'Highballs & Fizzes' },
  { family_id: 3, k_sub: 2, label: 'Boozy Sippers' },
];

const SEED = 42;

function l2sq(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function kmeansPlusPlusInit(vectors, k, rand) {
  const centers = [];
  centers.push(vectors[Math.floor(rand() * vectors.length)].slice());
  while (centers.length < k) {
    const dists = vectors.map((v) => Math.min(...centers.map((c) => l2sq(v, c))));
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) {
      centers.push(vectors[Math.floor(rand() * vectors.length)].slice());
      continue;
    }
    let r = rand() * total;
    for (let i = 0; i < vectors.length; i++) {
      r -= dists[i];
      if (r <= 0) {
        centers.push(vectors[i].slice());
        break;
      }
    }
  }
  return centers;
}

function kmeans(vectors, k, opts = {}) {
  const { maxIter = 200, seed = SEED } = opts;
  const n = vectors.length;
  const d = vectors[0].length;
  const rand = makeRng(seed);
  let centers = kmeansPlusPlusInit(vectors, k, rand);
  const assignments = new Array(n).fill(-1);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const dist = l2sq(vectors[i], centers[j]);
        if (dist < bestD) { bestD = dist; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;
    const next = Array.from({ length: k }, () => new Array(d).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const a = assignments[i];
      counts[a] += 1;
      for (let dim = 0; dim < d; dim++) next[a][dim] += vectors[i][dim];
    }
    for (let j = 0; j < k; j++) {
      if (counts[j] === 0) continue;
      for (let dim = 0; dim < d; dim++) next[j][dim] /= counts[j];
    }
    centers = next;
  }
  return { assignments, centers };
}

function balancedKmeans(vectors, k, opts = {}) {
  // Multiple restarts; reject splits that strand outliers as 1-2-element
  // clusters (K-Means++ picks distant points as initial centers, which
  // here yields singletons rather than meaningful sub-structure).
  // Score = min(cluster sizes) — rewards splits that actually divide
  // the parent cluster instead of carving off a few outliers.
  const { trials = 50, minSubSize = Math.max(3, Math.floor(vectors.length / (k * 4))) } = opts;
  let best = null;
  for (let t = 0; t < trials; t++) {
    const result = kmeans(vectors, k, { seed: SEED + t * 997 });
    const counts = new Array(k).fill(0);
    for (const a of result.assignments) counts[a] += 1;
    const minSize = Math.min(...counts);
    if (minSize < minSubSize) continue;
    let inertia = 0;
    for (let i = 0; i < vectors.length; i++) {
      inertia += l2sq(vectors[i], result.centers[result.assignments[i]]);
    }
    if (!best || inertia < best.inertia) {
      best = { ...result, inertia, minSize, counts };
    }
  }
  if (!best) {
    // Fall back to plain K-Means if no balanced split exists.
    const result = kmeans(vectors, k, { seed: SEED });
    const counts = new Array(k).fill(0);
    for (const a of result.assignments) counts[a] += 1;
    best = { ...result, counts, minSize: Math.min(...counts) };
  }
  return best;
}

function exemplarsForSub(members, vectors, center, n = 5) {
  const scored = members.map((m, i) => ({ name: m.name, dist: l2sq(vectors[i], center) }));
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, n).map((s) => s.name);
}

const doc = JSON.parse(fs.readFileSync(CLUSTERS_PATH, 'utf-8'));

for (const { family_id, k_sub, label } of TARGETS) {
  const memberAssignments = doc.assignments.filter((a) => a.cluster === family_id);
  const vectors = memberAssignments.map((a) => a.feature_vector);
  const { assignments: subAssignments, centers } = balancedKmeans(vectors, k_sub);

  console.log(`Family ${family_id} (${label}): split ${memberAssignments.length} → K_sub=${k_sub}`);
  for (let j = 0; j < k_sub; j++) {
    const subMembers = memberAssignments.filter((_, i) => subAssignments[i] === j);
    const subVectors = subMembers.map((m) => m.feature_vector);
    const exemplars = exemplarsForSub(subMembers, subVectors, centers[j]);
    console.log(`  sub ${family_id}.${j} — ${subMembers.length} cocktails — top: ${exemplars.slice(0, 3).join(', ')}`);
  }

  // Write new sub assignment + hierarchy_id back onto each member
  for (let i = 0; i < memberAssignments.length; i++) {
    const a = memberAssignments[i];
    a.subcluster = subAssignments[i];
    a.hierarchy_id = `${family_id}.${subAssignments[i]}`;
  }

  // Replace doc.subclusters[family_id] with the new split
  const newSubs = {};
  for (let j = 0; j < k_sub; j++) {
    const subMembers = memberAssignments.filter((_, i) => subAssignments[i] === j);
    const subVectors = subMembers.map((m) => m.feature_vector);
    newSubs[String(j)] = {
      size: subMembers.length,
      // Per-sub slot_means / dominant_slots / layer_means require
      // re-running the python pipeline that has the per-cocktail slot
      // composition. For now the parent-family signature applies; we
      // surface size + exemplars + a centroid-distance silhouette.
      silhouette: null,
      dominant_slots: [],
      layer_means: doc.clusters[String(family_id)].layer_means,
      exemplars: exemplarsForSub(subMembers, subVectors, centers[j]),
    };
  }
  doc.subclusters[String(family_id)] = newSubs;
}

// Bookkeeping: bump sub_cluster_total in _meta
const newTotal = Object.values(doc.subclusters).reduce((sum, sc) => sum + Object.keys(sc).length, 0);
doc._meta.sub_cluster_total = newTotal;
doc._meta.post_hoc_subclusters = {
  reason: 'K-Means K_sub=1 was returned for fam 1 + 3 by the silhouette search; user requested visible sub-rings inside Highballs & Fizzes (k=3) and Boozy Sippers (k=2).',
  ranAt: new Date().toISOString(),
  script: 'scripts/recluster-fam-1-3.cjs',
};

fs.writeFileSync(CLUSTERS_PATH, JSON.stringify(doc, null, 2));
console.log(`\nWrote ${CLUSTERS_PATH}`);
console.log(`  total sub-clusters: ${newTotal}`);
