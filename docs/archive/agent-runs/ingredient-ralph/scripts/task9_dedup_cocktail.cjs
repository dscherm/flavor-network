/**
 * Task 9: Deduplicate cocktail_augment.json
 * - Deduplicate pairings (order-independent key, keep higher strength)
 * - Add 'salt' and 'black pepper' to ingredients
 * - Add 'salt' and 'black pepper' to cocktailIngredientNames if it exists
 */

const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../public/data/cocktail_augment.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// 1. Add 'salt' if not already present
if (!data.ingredients.some(i => i.name === 'salt')) {
  data.ingredients.push({
    name: 'salt',
    category: 'seasoning',
    taste: 'salty',
    weight: 'light',
    codexRole: 'seasoning'
  });
  console.log('Added ingredient: "salt"');
} else {
  console.log('"salt" already exists in ingredients, skipping add.');
}

// 2. Add 'black pepper' if not already present
if (!data.ingredients.some(i => i.name === 'black pepper')) {
  data.ingredients.push({
    name: 'black pepper',
    category: 'spice',
    taste: 'pungent spicy',
    weight: 'light',
    codexRole: 'spice'
  });
  console.log('Added ingredient: "black pepper"');
} else {
  console.log('"black pepper" already exists in ingredients, skipping add.');
}

// 3. Add to cocktailIngredientNames if it exists
if (Array.isArray(data.cocktailIngredientNames)) {
  if (!data.cocktailIngredientNames.includes('salt')) {
    data.cocktailIngredientNames.push('salt');
    console.log('Added "salt" to cocktailIngredientNames');
  }
  if (!data.cocktailIngredientNames.includes('black pepper')) {
    data.cocktailIngredientNames.push('black pepper');
    console.log('Added "black pepper" to cocktailIngredientNames');
  }
}

// 4. Deduplicate pairings (order-independent)
let duplicatesRemoved = 0;
const pairingMap = new Map();

for (const p of data.pairings) {
  const key = [p.source, p.target].sort().join('|||');
  if (pairingMap.has(key)) {
    duplicatesRemoved++;
    const existing = pairingMap.get(key);
    if (p.strength > existing.strength) {
      pairingMap.set(key, p);
    }
  } else {
    pairingMap.set(key, p);
  }
}

data.pairings = Array.from(pairingMap.values());

console.log(`Duplicate pairings removed: ${duplicatesRemoved}`);
console.log(`Final ingredient count: ${data.ingredients.length}`);
console.log(`Final pairing count: ${data.pairings.length}`);

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log('Wrote cleaned cocktail_augment.json');
