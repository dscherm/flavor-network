const fs = require('fs');
const path = require('path');

const INGREDIENTS_PATH = path.join(__dirname, '..', '..', 'public', 'proDataset', 'ingredients.json');
const PAIRINGS_PATH = path.join(__dirname, '..', '..', 'public', 'proDataset', 'pairings.json');

// Load data
const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf-8'));
const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf-8'));

console.log(`Before: ${Object.keys(ingredients).length} ingredients, ${pairings.length} pairings`);

// Non-food exact names to remove
const NON_FOOD_EXACT = new Set([
  'aluminum foil', 'foil', 'baking dish', 'baking pan', 'cake pan',
  'roasting pan', 'grill pan',
  'nonstick vegetable cooking spray', 'vegetable cooking spray',
  'nonstick spray coating', 'baking spray', 'baking spray with',
  'vegetable spray',
]);

// Doubled modifier exact names
const DOUBLED_EXACT = new Set([
  'extra virgin extra virgin olive oil',
  'extra-virgin extra virgin olive oil',
]);

function shouldRemove(name) {
  // Pattern: starts with - or .
  if (name.startsWith('-') || name.startsWith('.')) return true;
  // Pattern: starts with 's
  if (name.startsWith("'s")) return true;
  // Pattern: ends with +
  if (name.endsWith('+')) return true;
  // Pattern: contains specific substrings
  if (name.includes('vanilla fat-') || name.includes('vanilla low-') || name.includes('apple -')) return true;
  // Exact non-food
  if (NON_FOOD_EXACT.has(name)) return true;
  // Doubled modifier
  if (DOUBLED_EXACT.has(name)) return true;
  return false;
}

// Identify and remove from ingredients
const removed = [];
for (const name of Object.keys(ingredients)) {
  if (shouldRemove(name)) {
    removed.push(name);
    delete ingredients[name];
  }
}

const removedSet = new Set(removed);

// Remove pairings referencing removed ingredients
const cleanedPairings = pairings.filter(p => {
  return !removedSet.has(p.ingredientA) && !removedSet.has(p.ingredientB);
});

const pairingsRemoved = pairings.length - cleanedPairings.length;

// Write cleaned files
fs.writeFileSync(INGREDIENTS_PATH, JSON.stringify(ingredients, null, 2), 'utf-8');
fs.writeFileSync(PAIRINGS_PATH, JSON.stringify(cleanedPairings, null, 2), 'utf-8');

console.log(`\nRemoved ${removed.length} ingredients:`);
removed.sort().forEach(n => console.log(`  - "${n}"`));
console.log(`\nRemoved ${pairingsRemoved} pairings referencing those ingredients.`);
console.log(`After: ${Object.keys(ingredients).length} ingredients, ${cleanedPairings.length} pairings`);
