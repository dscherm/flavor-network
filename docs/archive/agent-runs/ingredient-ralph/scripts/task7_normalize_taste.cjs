/**
 * Task 7: Normalize taste ordering across all ingredients.
 *
 * Splits each taste string by space, sorts tokens alphabetically,
 * and rejoins. This collapses duplicates like "sweet sour" / "sour sweet"
 * into a single canonical form ("sour sweet").
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'public', 'proDataset', 'ingredients.json');

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));

const uniqueBefore = new Set();
const uniqueAfter = new Set();
const changes = {};  // "old -> new" keyed, value = count
let reorderedCount = 0;

for (const [name, info] of Object.entries(data)) {
  if (!info.taste) continue;

  const original = info.taste;
  uniqueBefore.add(original);

  const normalized = original.split(' ').sort().join(' ');
  uniqueAfter.add(normalized);

  if (normalized !== original) {
    reorderedCount++;
    const key = `"${original}" -> "${normalized}"`;
    changes[key] = (changes[key] || 0) + 1;
    info.taste = normalized;
  }
}

// Write back
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');

// Report
console.log(`Tastes reordered: ${reorderedCount} ingredients`);
console.log(`\nUnique taste values before: ${uniqueBefore.size}`);
console.log(`Unique taste values after:  ${uniqueAfter.size}`);
console.log(`\nChanges (${Object.keys(changes).length} unique rewrites):`);
for (const [change, count] of Object.entries(changes)) {
  console.log(`  ${change}  (${count} ingredient${count > 1 ? 's' : ''})`);
}
