/**
 * task6_prune_orphans.cjs
 * Removes ingredients from ingredients.json that have zero pairings in pairings.json.
 */

const fs = require('fs');
const path = require('path');

const DATASET_DIR = path.join(__dirname, '..', '..', 'public', 'proDataset');
const INGREDIENTS_PATH = path.join(DATASET_DIR, 'ingredients.json');
const PAIRINGS_PATH = path.join(DATASET_DIR, 'pairings.json');

// -- Load data --
const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf-8'));
const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf-8'));

const totalBefore = Object.keys(ingredients).length;
console.log(`Ingredients before: ${totalBefore}`);
console.log(`Pairings: ${pairings.length}`);

// -- Build set of ingredient names that appear in at least one pairing --
const paired = new Set();
for (const p of pairings) {
  paired.add(p.ingredientA);
  paired.add(p.ingredientB);
}

console.log(`Unique ingredients in pairings: ${paired.size}`);

// -- Identify orphans --
const orphans = [];
for (const name of Object.keys(ingredients)) {
  if (!paired.has(name)) {
    orphans.push(name);
  }
}

console.log(`\nOrphans found (zero pairings): ${orphans.length}`);

// -- Source breakdown --
const sourceCounts = {};
for (const name of orphans) {
  const entry = ingredients[name];
  const sources = entry.sources || [];
  for (const src of sources) {
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
}

console.log('\nOrphans by source:');
for (const [src, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${src}: ${count}`);
}

// -- Print first 30 orphan names --
const sample = orphans.slice(0, 30);
console.log(`\nFirst ${sample.length} orphan names:`);
for (const name of sample) {
  console.log(`  - ${name}`);
}

// -- Remove orphans --
for (const name of orphans) {
  delete ingredients[name];
}

const totalAfter = Object.keys(ingredients).length;
console.log(`\nRemoved: ${orphans.length}`);
console.log(`Ingredients after: ${totalAfter}`);

// -- Write updated ingredients.json --
fs.writeFileSync(INGREDIENTS_PATH, JSON.stringify(ingredients, null, 2), 'utf-8');
console.log('Wrote updated ingredients.json');
