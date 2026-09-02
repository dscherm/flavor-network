/**
 * task4_fill_taste.cjs
 * Fill missing taste values for ingredients in ingredients.json.
 * Uses a curated mapping first, then falls back to category-based inference.
 */

const fs = require('fs');
const path = require('path');

const INGREDIENTS_PATH = path.join(__dirname, '..', '..', 'public', 'proDataset', 'ingredients.json');

// Curated taste mapping (alphabetically ordered multi-taste values)
const CURATED_TASTE = {
  'egg': 'umami',
  'flour': 'sweet',
  'olive oil': 'bitter pungent',
  'vegetable oil': 'sweet',
  'parsley': 'bitter',
  'potato': 'sweet',
  'basil': 'pungent sweet',
  'thyme': 'pungent',
  'rice': 'sweet',
  'cilantro': 'pungent sour',
  'cornstarch': 'sweet',
  'corn starch': 'sweet',
  'egg yolk': 'umami',
  'egg white': 'astringent',
  'peanut butter': 'salty sweet',
  'dill': 'bitter pungent',
  'mint': 'pungent sweet',
  'coriander': 'pungent sweet',
  'peanut': 'sweet',
  'sesame': 'bitter sweet',
  'vodka': 'bitter',
  'cooking spray': 'sweet',
  'canola oil': 'sweet',
  'shortening': 'sweet',
  'lard': 'sweet umami',
  'margarine': 'salty sweet',
  'oil': 'sweet',
  'bread': 'sweet',
  'pasta': 'sweet',
  'noodle': 'sweet',
};

// Skip these — not taste-bearing
const SKIP = new Set(['water', 'ice']);

// Category-based fallback (alphabetically ordered multi-taste values)
const CATEGORY_TASTE = {
  'herb': 'pungent',
  'spice': 'pungent',
  'fruit': 'sour sweet',
  'sweetener': 'sweet',
  'spirit': 'bitter',
  'liqueur': 'bitter sweet',
  'dairy': 'sweet',
  'nut': 'sweet',
  'protein': 'umami',
  'grain': 'sweet',
  'fat': 'sweet',
  'vegetable': 'sweet',
  'acid': 'sour',
  'citrus': 'sour sweet',
};

function main() {
  const raw = fs.readFileSync(INGREDIENTS_PATH, 'utf-8');
  const data = JSON.parse(raw);

  let filledCurated = 0;
  let filledCategory = 0;
  const stillEmpty = [];

  for (const [name, entry] of Object.entries(data)) {
    // Check if taste is empty/missing
    if (entry.taste && entry.taste.trim() !== '') continue;

    // Skip non-taste-bearing ingredients
    if (SKIP.has(name)) continue;

    // Try curated mapping first
    if (CURATED_TASTE[name]) {
      entry.taste = CURATED_TASTE[name];
      filledCurated++;
      continue;
    }

    // Try category-based fallback
    const cat = (entry.category || '').toLowerCase();
    if (CATEGORY_TASTE[cat]) {
      entry.taste = CATEGORY_TASTE[cat];
      filledCategory++;
      continue;
    }

    // Still empty
    stillEmpty.push({ name, category: entry.category });
  }

  // Write updated file
  fs.writeFileSync(INGREDIENTS_PATH, JSON.stringify(data, null, 2), 'utf-8');

  const totalFilled = filledCurated + filledCategory;
  console.log(`Tastes filled: ${totalFilled} (${filledCurated} from curated mapping, ${filledCategory} from category fallback)`);
  console.log(`Still empty: ${stillEmpty.length}`);
  if (stillEmpty.length > 0) {
    console.log('Still-empty ingredients:');
    stillEmpty.forEach(({ name, category }) => {
      console.log(`  "${name}" (category: ${category})`);
    });
  }
}

main();
