#!/usr/bin/env node
/**
 * evalAromaTags.mjs — does an aroma-tag vector per ingredient predict good
 * pairings? Pre-registered on 2026-11-07 BEFORE the tags were generated.
 *
 *   node scripts/evalAromaTags.mjs <tags.json>
 *
 * tags.json: { ingredient: { tag: intensity 1..3 } } over a fixed 32-tag
 * vocabulary (model-written; see the experiment notes in plan.md AROMA-1).
 *
 * Answer key: Flavor Bible pairs matched to our names
 * (public/proDataset/flavor_bible_matched.json) — evaluation only.
 *
 * Test A — added value over co-occurrence. Pairs that co-occur in recipes
 *   (observed pairings) between answer-key ingredients; label = listed in
 *   the Flavor Bible. Baseline: `tradition` AUROC. Then tradition + w·aroma,
 *   w fitted on one random half of the pairs and scored on the other
 *   (and vice versa); report the mean held-out AUROC.
 * Test B — aroma alone vs the molecular model. ALL pairs between
 *   answer-key ingredients; label = listed. Compare AUROC of aroma-tag
 *   cosine vs the GNN probability-vector cosine (gnn_entropy.json).
 *
 * PASS (decided before running): Test B aroma >= GNN + 0.05 AND
 * Test A combined >= tradition + 0.02. Otherwise the tags do not ship as a
 * pairing signal (they may still be useful as descriptive labels).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
const tagsPath = process.argv[2];
if (!tagsPath) { console.error('usage: node scripts/evalAromaTags.mjs <tags.json>'); process.exit(1); }
const tags = JSON.parse(readFileSync(tagsPath, 'utf8'));

export const VOCAB = ['citrus', 'berry', 'stone-fruit', 'tropical-fruit', 'apple-pear', 'dried-fruit', 'floral', 'green-grassy', 'herbal', 'mint', 'anise', 'earthy', 'mushroom', 'woody', 'smoky', 'roasted', 'nutty', 'caramel', 'chocolate', 'coffee', 'vanilla', 'warm-spice', 'peppery', 'pungent-allium', 'sulfurous-brassica', 'buttery-creamy', 'cheesy', 'meaty', 'briny-marine', 'fermented-funky', 'sour-tangy', 'sweet'];

const fbPairs = read('public/proDataset/flavor_bible_matched.json').pairs;
const names = [...new Set(fbPairs.flat())].sort();
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const listed = new Set(fbPairs.map(([a, b]) => key(a, b)));

// Tag vectors, with a coverage + vocabulary check.
const unknownTags = new Set();
const vec = new Map();
for (const n of names) {
  const t = tags[n];
  if (!t) continue;
  vec.set(n, VOCAB.map((v) => Number(t[v] || 0)));
  for (const k of Object.keys(t)) if (!VOCAB.includes(k)) unknownTags.add(k);
}
console.log(`tags: ${vec.size}/${names.length} answer-key ingredients covered${unknownTags.size ? `; off-vocabulary tags ignored: ${[...unknownTags].join(', ')}` : ''}`);

const cos = (a, b) => {
  let d = 0; let x = 0; let y = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? d / Math.sqrt(x * y) : 0;
};
function auroc(rows) { // rows: [score, label]
  const r = rows.slice().sort((p, q) => p[0] - q[0]);
  const ranks = new Array(r.length);
  for (let i = 0; i < r.length;) { let j = i; while (j + 1 < r.length && r[j + 1][0] === r[i][0]) j++; const avg = (i + j + 2) / 2; for (let k = i; k <= j; k++) ranks[k] = avg; i = j + 1; }
  let pos = 0; let sum = 0;
  for (let k = 0; k < r.length; k++) if (r[k][1]) { pos++; sum += ranks[k]; }
  const neg = r.length - pos;
  return (sum - pos * (pos + 1) / 2) / (pos * neg);
}
const aroma = (a, b) => (vec.has(a) && vec.has(b) ? cos(vec.get(a), vec.get(b)) : 0);

// GNN baseline vectors.
const ent = read('public/proDataset/gnn_entropy.json');
const gnn = (n) => { const p = ent[n]?.probs; return p ? Object.keys(p).sort().map((k) => p[k]) : null; };
const gnnCos = (a, b) => { const x = gnn(a); const y = gnn(b); return x && y ? cos(x, y) : 0; };

// ── Test B ──────────────────────────────────────────────────────────
const nameSet = new Set(names);
const allRows = [];
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const a = names[i]; const b = names[j];
  allRows.push({ a, b, y: listed.has(key(a, b)) ? 1 : 0 });
}
const bAroma = auroc(allRows.map((r) => [aroma(r.a, r.b), r.y]));
const bGnn = auroc(allRows.map((r) => [gnnCos(r.a, r.b), r.y]));
console.log(`\nTest B — all ${allRows.length} pairs among answer-key ingredients (${allRows.filter((r) => r.y).length} listed)`);
console.log(`  aroma-tag cosine AUROC ${bAroma.toFixed(3)}   molecular GNN cosine AUROC ${bGnn.toFixed(3)}   (need aroma >= GNN + 0.05)`);

// ── Test A ──────────────────────────────────────────────────────────
const pairings = read('public/proDataset/pairings.json');
const obs = pairings.filter((p) => p.known && nameSet.has(p.ingredientA) && nameSet.has(p.ingredientB))
  .map((p) => ({ t: p.tradition, s: aroma(p.ingredientA, p.ingredientB), y: listed.has(key(p.ingredientA, p.ingredientB)) ? 1 : 0 }));
const z = (xs) => { const m = xs.reduce((s, v) => s + v, 0) / xs.length; const sd = Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length) || 1; return (v) => (v - m) / sd; };
const zt = z(obs.map((r) => r.t)); const zs = z(obs.map((r) => r.s));
const aTrad = auroc(obs.map((r) => [r.t, r.y]));
const aAroma = auroc(obs.map((r) => [r.s, r.y]));
let seed = 11; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
const half = obs.map(() => rnd() < 0.5);
const W = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2];
const fit = (rows) => W.reduce((best, w) => { const s = auroc(rows.map((r) => [zt(r.t) + w * zs(r.s), r.y])); return s > best.s ? { w, s } : best; }, { w: 0, s: -1 });
const A = obs.filter((_, i) => half[i]); const B = obs.filter((_, i) => !half[i]);
const wA = fit(A).w; const wB = fit(B).w;
const heldOut = (auroc(B.map((r) => [zt(r.t) + wA * zs(r.s), r.y])) + auroc(A.map((r) => [zt(r.t) + wB * zs(r.s), r.y]))) / 2;
const tradHalves = (auroc(B.map((r) => [r.t, r.y])) + auroc(A.map((r) => [r.t, r.y]))) / 2;
console.log(`\nTest A — ${obs.length} observed pairings among answer-key ingredients (${obs.filter((r) => r.y).length} listed)`);
console.log(`  tradition AUROC ${aTrad.toFixed(3)}   aroma alone ${aAroma.toFixed(3)}`);
console.log(`  tradition + w·aroma, held-out halves: ${heldOut.toFixed(3)} (tradition on same halves ${tradHalves.toFixed(3)}; weights chosen ${wA}, ${wB})   (need >= tradition + 0.02)`);

const pass = bAroma >= bGnn + 0.05 && heldOut >= tradHalves + 0.02;
console.log(`\nVERDICT: ${pass ? 'PASS — aroma tags add a pairing signal' : 'FAIL — tags do not ship as a pairing signal'}`);
