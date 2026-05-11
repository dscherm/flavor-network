// Quick diagnostic: read the same data the app reads, run the
// categorical bucketers, dump bucket counts so we can size the wheel
// sub-discs correctly.

import { readFileSync } from 'node:fs';

const ingredientsByName = JSON.parse(readFileSync('public/proDataset/ingredients.json', 'utf-8'));
const cuisineMap = JSON.parse(readFileSync('public/data/cuisine_map.json', 'utf-8'));
const seasonMap = JSON.parse(readFileSync('public/data/season_region.json', 'utf-8'));
const gnnEntropy = JSON.parse(readFileSync('public/proDataset/gnn_entropy.json', 'utf-8'));

const ingNames = Object.keys(ingredientsByName);
console.log('Total ingredient nodes:', ingNames.length);
console.log('First node sample fields:', Object.keys(ingredientsByName[ingNames[0]]));
console.log('First node:', JSON.stringify(ingredientsByName[ingNames[0]]).slice(0, 240));
console.log();

// Build a map<name, node> like the app does — each value gets its
// `name` field set so the bucketers can read node.name.
const nodes = new Map();
for (const name of ingNames) {
  nodes.set(name, { ...ingredientsByName[name], name });
}
const ingredients = ingNames;

const ctx = { gnnEntropy, cuisineMap, seasonMap };

const { CATEGORICAL_AXES, bucketAllNodes } = await import('../src/data/categoricalAxes.js');

for (const axisKey of ['aromas', 'cuisine', 'season', 'family']) {
  const { byBucket } = bucketAllNodes(axisKey, nodes, ctx);
  const axis = CATEGORICAL_AXES[axisKey];
  let total = 0;
  console.log(`\n=== ${axisKey} ===`);
  for (const label of axis.labels) {
    const count = (byBucket.get(label) || []).length;
    total += count;
    console.log(`  ${label.padEnd(16)} ${count}`);
  }
  console.log(`  TOTAL bucketed: ${total}`);
  console.log(`  Unbucketed:     ${ingredients.length - total}`);
}
