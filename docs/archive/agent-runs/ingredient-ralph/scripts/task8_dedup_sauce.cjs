/**
 * Task 8: Deduplicate sauce_augment.json
 * - Remove duplicate 'tomato puree' from ingredients (keep first)
 * - Deduplicate pairings (order-independent key, keep higher strength)
 * - Add 'caraway' ingredient
 */

const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../public/data/sauce_augment.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// 1. Remove duplicate 'tomato puree' — keep first occurrence
const seenIngredientNames = new Set();
const dedupedIngredients = [];
for (const ing of data.ingredients) {
  if (seenIngredientNames.has(ing.name)) {
    console.log(`Removed duplicate ingredient: "${ing.name}"`);
    continue;
  }
  seenIngredientNames.add(ing.name);
  dedupedIngredients.push(ing);
}
data.ingredients = dedupedIngredients;

// 2. Add 'caraway' if not already present
if (!data.ingredients.some(i => i.name === 'caraway')) {
  data.ingredients.push({
    name: 'caraway',
    category: 'spice',
    taste: 'pungent',
    weight: 'light',
    codexRole: 'spice'
  });
  console.log('Added ingredient: "caraway"');
} else {
  console.log('"caraway" already exists in ingredients, skipping add.');
}

// 3. Deduplicate pairings (order-independent)
let duplicatesRemoved = 0;
let conflictsResolved = 0;
const pairingMap = new Map();

for (const p of data.pairings) {
  const key = [p.source, p.target].sort().join('|||');
  if (pairingMap.has(key)) {
    duplicatesRemoved++;
    const existing = pairingMap.get(key);
    if (existing.strength !== p.strength) {
      conflictsResolved++;
      if (p.strength > existing.strength) {
        pairingMap.set(key, p);
      }
    }
  } else {
    pairingMap.set(key, p);
  }
}

data.pairings = Array.from(pairingMap.values());

console.log(`Duplicate pairings removed: ${duplicatesRemoved}`);
console.log(`Conflicting-strength duplicates resolved: ${conflictsResolved}`);
console.log(`Final ingredient count: ${data.ingredients.length}`);
console.log(`Final pairing count: ${data.pairings.length}`);

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log('Wrote cleaned sauce_augment.json');
