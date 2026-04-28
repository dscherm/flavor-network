/**
 * Sanity-check the α-mode affinities against shipped data.
 * Loads pairings + bridge compounds + GNN compounds, builds the
 * affinity context the same way useProData does, then prints the
 * top 30 affinities for a handful of focal ingredients so we can
 * eyeball whether they're right.
 *
 * Run: node scripts/check-affinities.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { tierFor, topAffinities } from '../src/data/affinityTiers.js';
import { computeAffinityThresholds } from '../src/data/affinityThresholds.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const PRO = path.join(ROOT, 'public', 'proDataset');

console.log('Loading datasets…');
const pairs = JSON.parse(fs.readFileSync(path.join(PRO, 'pairings.json'), 'utf8'));
const bridges = JSON.parse(fs.readFileSync(path.join(PRO, 'bridge_compounds.json'), 'utf8'));
const gnnCompounds = JSON.parse(fs.readFileSync(path.join(PRO, 'gnn_compounds.json'), 'utf8'));

console.log(`pairs: ${pairs.length}  bridges: ${Object.keys(bridges).length - 1}  gnnCompounds keys: ${Object.keys(gnnCompounds).length}`);

const edges = pairs.map(p => ({
  source: p.ingredientA ?? p.source,
  target: p.ingredientB ?? p.target,
  strength: p.strength,
}));

const pairingStrength = new Map();
for (const e of edges) {
  pairingStrength.set(`${e.source}|${e.target}`, e.strength);
  pairingStrength.set(`${e.target}|${e.source}`, e.strength);
}

const top5 = new Map();
for (const [name, payload] of Object.entries(gnnCompounds)) {
  if (name === '_meta') continue;
  const tc = payload?.top_compounds;
  if (Array.isArray(tc) && tc.length > 0) {
    top5.set(name, tc.slice(0, 5).map(c => c.name));
  }
}

const bridgeCompoundIndex = new Map();
for (const [k, v] of Object.entries(bridges)) {
  if (k === '_meta') continue;
  bridgeCompoundIndex.set(k, v);
}

const affinityThresholds = computeAffinityThresholds(edges);
console.log(`thresholds — star3=${affinityThresholds.star3.toFixed(3)}  star2=${affinityThresholds.star2.toFixed(3)}  star1=${affinityThresholds.star1.toFixed(3)}`);

const ctx = {
  pairingStrength,
  top5,
  bridgeCompoundIndex,
  affinityThresholds,
  graph: { edges },
};

const FOCALS = ['tomato', 'basil', 'garlic', 'lemon', 'butter', 'chocolate', 'coffee', 'tea', 'mushroom', 'salmon'];

for (const focal of FOCALS) {
  const aff = topAffinities(focal, ctx);
  if (aff.length === 0) {
    console.log(`\n=== ${focal} === (no neighbors found)`);
    continue;
  }
  const r3 = aff.filter(a => a.ringIdx === 3);
  const r2 = aff.filter(a => a.ringIdx === 2);
  const r1 = aff.filter(a => a.ringIdx === 1);
  console.log(`\n=== ${focal} ===  total=${aff.length}  ring3=${r3.length} ring2=${r2.length} ring1=${r1.length}`);
  console.log(`  ★★★ ring (top 5 by strength):`);
  for (const a of r3) {
    const tierTxt = a.tier === 3 ? '★★★' : a.tier === 2 ? '★★' : '★';
    const bridgeTxt = a.bridge ? `bridge=${a.bridge}` : 'no-bridge';
    console.log(`    ${a.name.padEnd(28)} s=${a.strength.toFixed(3)} tier=${tierTxt} ${bridgeTxt}`);
  }
  console.log(`  ★★ ring (next 10):`);
  for (const a of r2.slice(0, 5)) {
    const tierTxt = a.tier === 3 ? '★★★' : a.tier === 2 ? '★★' : '★';
    console.log(`    ${a.name.padEnd(28)} s=${a.strength.toFixed(3)} tier=${tierTxt}`);
  }
  if (r2.length > 5) console.log(`    … (+${r2.length - 5} more)`);
  console.log(`  ★ ring (next 15):`);
  for (const a of r1.slice(0, 5)) {
    const tierTxt = a.tier === 3 ? '★★★' : a.tier === 2 ? '★★' : '★';
    console.log(`    ${a.name.padEnd(28)} s=${a.strength.toFixed(3)} tier=${tierTxt}`);
  }
  if (r1.length > 5) console.log(`    … (+${r1.length - 5} more)`);
}
