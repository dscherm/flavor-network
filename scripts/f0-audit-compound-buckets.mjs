// F0 audit (2026-05-16) — sample compound foods + show how the
// name-tilt override changes their aroma bucket vs the prior
// argmax-only behavior. Read-only.
import { readFileSync } from 'node:fs';
import { COMPOUND_FOODS, applyCompoundSynthesis } from '../src/data/compoundFoods.js';
import { CATEGORICAL_AXES } from '../src/data/categoricalAxes.js';

const ingObj = JSON.parse(readFileSync('./public/proDataset/ingredients.json', 'utf8'));
const gnnEntropy = JSON.parse(readFileSync('./public/proDataset/gnn_entropy.json', 'utf8'));

const nodes = new Map();
for (const [name, v] of Object.entries(ingObj)) {
  nodes.set(name, { name, ...v, gnnProbs: gnnEntropy[name]?.probs || null });
}
applyCompoundSynthesis(nodes);

const AROMA_KEYS = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const AROMA_LABELS = ['Fruity', 'Floral', 'Green', 'Woody', 'Spicy', 'Fatty'];
const sums = new Array(6).fill(0);
let n = 0;
for (const nm of Object.keys(gnnEntropy)) {
  const p = gnnEntropy[nm]?.probs;
  if (!p) continue;
  let any = false;
  for (let i = 0; i < 6; i++) {
    const v = p[AROMA_KEYS[i]];
    if (typeof v === 'number') { sums[i] += v; any = true; }
  }
  if (any) n++;
}
const means = sums.map((s) => s / n);

function argmaxBucket(probs) {
  let bestI = -1;
  let bestD = -Infinity;
  for (let i = 0; i < 6; i++) {
    const v = probs[AROMA_KEYS[i]];
    if (typeof v !== 'number') continue;
    const d = v - means[i];
    if (d > bestD) { bestD = d; bestI = i; }
  }
  return bestI >= 0 && bestD > 0 ? AROMA_LABELS[bestI] : null;
}

const ctx = { gnnEntropy };
// Audit ALL ingredients with GNN profiles (not just COMPOUND_FOODS) —
// the tilt could affect any name carrying a cue word, e.g. "raspberry
// sherbet" if it lives in the catalog.
let flips = 0;
const flippedExamples = [];
let totalProbed = 0;
for (const [name, node] of nodes) {
  if (!node?.gnnProbs) continue;
  totalProbed++;
  const oldBucket = argmaxBucket(node.gnnProbs);
  const newBucket = CATEGORICAL_AXES.aromas.bucketOf(node, ctx);
  if (oldBucket !== newBucket && newBucket !== null) {
    flips++;
    flippedExamples.push({ name, oldBucket, newBucket });
  }
}
console.log('Ingredients with GNN profiles:', totalProbed);
console.log('Bucket flips (name-tilt fix applied):', flips);
console.log('Flip rate:', (flips / totalProbed * 100).toFixed(2) + '%');
console.log('\nDistribution by new bucket:');
const dist = {};
for (const f of flippedExamples) {
  dist[f.newBucket] = (dist[f.newBucket] || 0) + 1;
}
for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + k.padEnd(8) + ' ' + v);
}
console.log('\nAll flips:');
for (const f of flippedExamples) {
  console.log('  ' + f.name.padEnd(30) + ': ' + (f.oldBucket || '—').padEnd(8) + ' → ' + f.newBucket);
}
