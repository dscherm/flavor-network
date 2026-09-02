/**
 * task11_remove_recipes.cjs
 *
 * Removes recipe-like, brand-specific, and nonsensical ingredient names
 * from ingredients.json, then cleans pairings.json of any references
 * to the removed ingredients.
 *
 * Safety: ingredients with totalCount > 5000 are protected from pattern/brand
 * removal (only exact-list entries bypass this threshold).
 */

const fs = require('fs');
const path = require('path');

const DATASET_DIR = path.resolve(__dirname, '../../public/proDataset');
const INGREDIENTS_PATH = path.join(DATASET_DIR, 'ingredients.json');
const PAIRINGS_PATH = path.join(DATASET_DIR, 'pairings.json');

const TOTAL_COUNT_SAFETY = 5000;

// ── Exact removal list (bypass safety threshold) ──────────────────────────
const EXACT_REMOVALS = new Set([
  'cream of mushroom soup or cream of chicken soup',
  'your favorite barbecue sauce',
  'corn arepa filled with mozarella cheese',
  'pork loin chops with bone',
  'scallions including green top',
  'tightly baby spinach leave',
  'drizzle of olive oil',
  'rubbing alcohol',
  'pink food colouring',
]);

// ── Brand substrings (case-insensitive contains check) ────────────────────
const BRAND_SUBSTRINGS = [
  'kraft ',
  "campbell's ",
  'philadelphia ',
  'bisquick ',
  'polly-o ',
];

// ── Brand exact match ─────────────────────────────────────────────────────
const BRAND_EXACT = new Set([
  'jim beam',
]);

function shouldRemove(name, totalCount) {
  // 1. Exact removal list — always remove regardless of totalCount
  if (EXACT_REMOVALS.has(name)) {
    return 'exact-list';
  }

  // 2-4. Pattern and brand checks respect the safety threshold
  if (totalCount > TOTAL_COUNT_SAFETY) {
    return null;
  }

  // 2. Contains " or " (recipe alternatives)
  if (name.includes(' or ')) {
    return 'pattern: contains " or "';
  }

  // 3. Starts with "your "
  if (name.startsWith('your ')) {
    return 'pattern: starts with "your "';
  }

  // 4a. Brand substring match
  const lowerName = name.toLowerCase();
  for (const brand of BRAND_SUBSTRINGS) {
    if (lowerName.includes(brand)) {
      return `brand: ${brand.trim()}`;
    }
  }

  // 4b. Brand exact match
  if (BRAND_EXACT.has(lowerName)) {
    return `brand: ${lowerName}`;
  }

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  console.log('Reading ingredients.json...');
  const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf-8'));

  const removedNames = new Set();
  const removedDetails = [];

  for (const [name, data] of Object.entries(ingredients)) {
    const reason = shouldRemove(name, data.totalCount || 0);
    if (reason) {
      removedNames.add(name);
      removedDetails.push({ name, totalCount: data.totalCount || 0, reason });
    }
  }

  // Remove from ingredients object
  for (const name of removedNames) {
    delete ingredients[name];
  }

  console.log('\nReading pairings.json...');
  const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf-8'));
  const originalPairingsCount = pairings.length;

  const cleanedPairings = pairings.filter(p => {
    return !removedNames.has(p.ingredientA) && !removedNames.has(p.ingredientB);
  });

  const pairingsRemoved = originalPairingsCount - cleanedPairings.length;

  // Write files
  console.log('\nWriting ingredients.json...');
  fs.writeFileSync(INGREDIENTS_PATH, JSON.stringify(ingredients, null, 2), 'utf-8');

  console.log('Writing pairings.json...');
  fs.writeFileSync(PAIRINGS_PATH, JSON.stringify(cleanedPairings, null, 2), 'utf-8');

  // Print report
  console.log('\n════════════════════════════════════════════════');
  console.log('  REMOVED INGREDIENTS');
  console.log('════════════════════════════════════════════════');

  // Sort by reason then name for readability
  removedDetails.sort((a, b) => a.reason.localeCompare(b.reason) || a.name.localeCompare(b.name));

  for (const { name, totalCount, reason } of removedDetails) {
    console.log(`  ${name}  (totalCount: ${totalCount})  [${reason}]`);
  }

  console.log('\n────────────────────────────────────────────────');
  console.log(`  Total ingredients removed: ${removedNames.size}`);
  console.log(`  Total pairings removed:    ${pairingsRemoved}`);
  console.log(`  Ingredients remaining:     ${Object.keys(ingredients).length}`);
  console.log(`  Pairings remaining:        ${cleanedPairings.length}`);
  console.log('────────────────────────────────────────────────');
}

main();
