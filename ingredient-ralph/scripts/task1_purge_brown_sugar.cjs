const fs = require('fs');
const path = require('path');

const pairingsPath = path.resolve(__dirname, '../../public/proDataset/pairings.json');

const raw = fs.readFileSync(pairingsPath, 'utf-8');
const pairings = JSON.parse(raw);
const totalBefore = pairings.length;

const filtered = pairings.filter(p => p.known !== false);
const removed = totalBefore - filtered.length;

const brownSugarRemaining = filtered.filter(
  p => p.ingredientA === 'brown sugar' || p.ingredientB === 'brown sugar'
).length;

fs.writeFileSync(pairingsPath, JSON.stringify(filtered, null, 2), 'utf-8');

console.log(`Total pairings before: ${totalBefore}`);
console.log(`Removed (known===false): ${removed}`);
console.log(`Total pairings after: ${filtered.length}`);
console.log(`Brown sugar pairings remaining: ${brownSugarRemaining}`);
