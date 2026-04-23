#!/usr/bin/env node
/*
 * Rename cluster labels in cluster_labels.json based on actual member
 * content analysis. Old names included the unhelpful "Chili (cumin)" /
 * "Chili (ginger)" disambiguators from the anchor-ingredient fallback.
 *
 * New names derived from examining top_ingredients + full member lists
 * (see r11 session notes for reasoning).
 */
const fs = require('fs');
const path = require('path');

const RENAMES = {
  0: 'Fruit & Nut Desserts',
  1: 'Savory American',
  2: 'Italian',
  3: 'Mexican & Latin',
  4: 'East Asian',
  5: 'Cocktails & Drinks',
  6: 'French & Herbs',
  7: 'Whole Grain',
  8: 'Chocolate & Vanilla',
  9: 'Kitchen Staples',
};

const file = path.join(__dirname, '..', '..', 'public', 'proDataset', 'cluster_labels.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const c of data.clusters) {
  if (RENAMES[c.id]) {
    const prev = c.label;
    c.label = RENAMES[c.id];
    console.log('  ' + String(c.id).padStart(2) + '  ' + prev.padEnd(25) + ' → ' + c.label);
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('\nRewrote', file);
