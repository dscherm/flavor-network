const fs = require('fs');
const path = require('path');

const PAIRINGS_PATH = path.join(__dirname, '..', '..', 'public', 'proDataset', 'pairings.json');

// --- Helpers ---

function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: +(sum / sorted.length).toFixed(6),
    median: +percentile(sorted, 50).toFixed(6),
    p25: +percentile(sorted, 25).toFixed(6),
    p75: +percentile(sorted, 75).toFixed(6),
  };
}

function printStats(label, s) {
  console.log(`  ${label}:`);
  console.log(`    min=${s.min}  max=${s.max}  mean=${s.mean}  median=${s.median}  p25=${s.p25}  p75=${s.p75}`);
}

// --- Main ---

console.log('Reading pairings.json ...');
const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf-8'));
console.log(`  ${pairings.length} pairings loaded.`);

// Collect old strengths
const oldStrengths = pairings.map(p => p.strength);
const oldStats = stats(oldStrengths);

// Record top-10 by old strength (for verification)
const top10Old = [...pairings]
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 10)
  .map(p => `${p.ingredientA} + ${p.ingredientB}`);

// Build rank map: sort strengths, assign percentile rank
// For ties, use the average rank position
const indexed = oldStrengths.map((v, i) => ({ v, i }));
indexed.sort((a, b) => a.v - b.v);

const totalCount = indexed.length;
const newStrengthByIndex = new Array(totalCount);

let pos = 0;
while (pos < totalCount) {
  // Find run of equal values
  let end = pos + 1;
  while (end < totalCount && indexed[end].v === indexed[pos].v) end++;
  // Average rank for the group (0-based positions pos..end-1)
  const avgRank = (pos + end - 1) / 2;
  const pctRank = avgRank / (totalCount - 1); // 0 to 1
  const rescaled = Math.sqrt(pctRank);         // sqrt curve
  const rounded = +rescaled.toFixed(4);
  for (let k = pos; k < end; k++) {
    newStrengthByIndex[indexed[k].i] = rounded;
  }
  pos = end;
}

// Apply new strengths
for (let i = 0; i < pairings.length; i++) {
  pairings[i].strength = newStrengthByIndex[i];
}

const newStrengths = pairings.map(p => p.strength);
const newStats = stats(newStrengths);

// Verify top-10
const top10New = [...pairings]
  .sort((a, b) => b.strength - a.strength)
  .slice(0, 10)
  .map(p => `${p.ingredientA} + ${p.ingredientB}`);

// Print report
console.log('\n--- Before/After Stats ---');
printStats('Old', oldStats);
printStats('New', newStats);

console.log('\n--- Top 10 Strongest Pairings ---');
let allMatch = true;
for (let i = 0; i < 10; i++) {
  const match = top10Old[i] === top10New[i] ? 'OK' : 'CHANGED';
  if (match === 'CHANGED') allMatch = false;
  console.log(`  #${i + 1}  ${top10Old[i]}  ->  ${top10New[i]}  [${match}]`);
}
console.log(allMatch
  ? '\n  All top-10 pairings preserved.'
  : '\n  WARNING: Some top-10 pairings changed order (ties may cause reordering).');

// Write output
console.log('\nWriting updated pairings.json ...');
fs.writeFileSync(PAIRINGS_PATH, JSON.stringify(pairings, null, 2) + '\n', 'utf-8');
console.log('Done.');
