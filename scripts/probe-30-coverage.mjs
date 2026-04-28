/**
 * Probe how many focal ingredients fully fill all 30 affinity slots.
 * Quick coverage check after the polish round.
 */
import fs from 'node:fs';
import { topAffinities } from '../src/data/affinityTiers.js';
import { computeAffinityThresholds } from '../src/data/affinityThresholds.js';

const PRO = './public/proDataset/';
const pairs = JSON.parse(fs.readFileSync(PRO + 'pairings.json', 'utf8'));
const bridges = JSON.parse(fs.readFileSync(PRO + 'bridge_compounds.json', 'utf8'));
const gnnC = JSON.parse(fs.readFileSync(PRO + 'gnn_compounds.json', 'utf8'));

const edges = pairs.map(p => ({ source: p.ingredientA, target: p.ingredientB, strength: p.strength }));
const pairingStrength = new Map();
for (const e of edges) {
  pairingStrength.set(`${e.source}|${e.target}`, e.strength);
  pairingStrength.set(`${e.target}|${e.source}`, e.strength);
}
const top5 = new Map();
for (const [n, p] of Object.entries(gnnC)) {
  if (n === '_meta') continue;
  const tc = p?.top_compounds;
  if (Array.isArray(tc) && tc.length) top5.set(n, tc.slice(0, 5).map(c => c.name));
}
const bridgeCompoundIndex = new Map();
for (const [k, v] of Object.entries(bridges)) {
  if (k === '_meta') continue;
  bridgeCompoundIndex.set(k, v);
}
const affinityThresholds = computeAffinityThresholds(edges);
const ctx = { pairingStrength, top5, bridgeCompoundIndex, affinityThresholds, graph: { edges } };

const allNames = new Set();
for (const e of edges) { allNames.add(e.source); allNames.add(e.target); }

let total30 = 0, partial = 0, totalCount = 0;
const partialList = [];
for (const f of allNames) {
  const a = topAffinities(f, ctx);
  totalCount++;
  if (a.length === 30) total30++;
  else { partial++; partialList.push({ name: f, n: a.length }); }
}

partialList.sort((a, b) => b.n - a.n);

console.log(`Total ingredients in graph: ${totalCount}`);
console.log(`  with all 30 affinity slots filled: ${total30} (${(100 * total30 / totalCount).toFixed(1)}%)`);
console.log(`  with fewer (data-limited):          ${partial}`);
console.log('\nDistribution of partial coverage (count → ingredients):');
const buckets = {};
for (const p of partialList) {
  const b = p.n;
  buckets[b] = (buckets[b] || 0) + 1;
}
for (const [b, c] of Object.entries(buckets).sort((a, b) => b[0] - a[0]).slice(0, 15)) {
  console.log(`  ${b.toString().padStart(2)} affinities: ${c} ingredients`);
}

console.log('\nHot ingredients spot check:');
const HOT = ['tomato','onion','garlic','butter','sugar','egg','flour','olive oil','salt','pepper','basil','parmesan','chicken','milk','lemon','beef','potato','rice','pasta','cheese','salmon','coffee','tea','mushroom','chocolate'];
for (const f of HOT) {
  const a = topAffinities(f, ctx);
  console.log(`  ${f.padEnd(14)} → ${a.length} affinities`);
}
