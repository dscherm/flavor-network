import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import {
  RAW_DIR, PROCESSED_DIR,
  MIN_RECIPE_COUNT, MIN_INGREDIENT_RECIPES,
} from '../config.js';
import {
  canonicalizeIngredient, pairKey, computePMI, normalizeMap,
  ensureDir, writeJson, log,
} from '../utils.js';

const CSV_PATH = path.join(RAW_DIR, 'recipenlg.csv');
const OUT_PATH = path.join(PROCESSED_DIR, 'recipenlg-cooccurrence.json');

// Ingredients too generic to form meaningful pairs
const SKIP_SET = new Set(['salt', 'pepper', 'water', 'oil', 'black pepper']);

// Known food-related words. An ingredient must contain at least one of these
// (or be in the synonyms/categories tables) to pass the filter.
import { readFileSync } from 'fs';
const _synonyms = JSON.parse(readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'data', 'synonyms.json'), 'utf8'));
const _categories = JSON.parse(readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'data', 'categories.json'), 'utf8'));
const KNOWN_FOODS = new Set([
  ...Object.keys(_synonyms).map(s => s.toLowerCase()),
  ...Object.values(_synonyms).map(s => s.toLowerCase()),
  ...Object.keys(_categories).filter(k => !k.startsWith('_')).map(s => s.toLowerCase()),
]);

// Food indicator words — if an ingredient contains one of these substrings, it's likely food
const FOOD_INDICATORS = [
  'sauce', 'juice', 'oil', 'flour', 'sugar', 'cream', 'milk', 'butter', 'cheese',
  'chicken', 'beef', 'pork', 'lamb', 'fish', 'shrimp', 'egg', 'rice', 'bean',
  'pepper', 'onion', 'garlic', 'tomato', 'potato', 'lemon', 'lime', 'orange',
  'herb', 'spice', 'vinegar', 'stock', 'broth', 'wine', 'beer', 'syrup',
  'honey', 'salt', 'mustard', 'ketchup', 'mayo', 'dressing', 'paste',
  'powder', 'seed', 'nut', 'berry', 'fruit', 'vegetable', 'leaf', 'root',
  'chili', 'chile', 'curry', 'ginger', 'cinnamon', 'vanilla', 'cocoa', 'chocolate',
  'bread', 'noodle', 'pasta', 'cake', 'cookie', 'pie', 'jam', 'jelly',
  'yogurt', 'sour cream', 'whip', 'baking', 'yeast', 'gelatin', 'cornstarch',
  'mushroom', 'celery', 'carrot', 'lettuce', 'spinach', 'basil', 'parsley',
  'thyme', 'oregano', 'cilantro', 'mint', 'dill', 'rosemary', 'sage',
  'cumin', 'paprika', 'turmeric', 'nutmeg', 'clove', 'allspice', 'cardamom',
  'soy', 'miso', 'sesame', 'coconut', 'almond', 'walnut', 'pecan', 'peanut',
  'olive', 'caper', 'anchov', 'bacon', 'ham', 'sausage', 'turkey', 'duck',
  'salmon', 'tuna', 'cod', 'crab', 'lobster', 'scallop', 'clam', 'mussel',
  'rum', 'gin', 'vodka', 'whiskey', 'bourbon', 'tequila', 'brandy', 'liqueur',
  'vermouth', 'bitters', 'campari', 'aperol', 'prosecco', 'champagne',
  'extract', 'zest', 'peel', 'rind', 'puree', 'reduction', 'glaze',
  'marinade', 'rub', 'brine', 'cure', 'smoke', 'roast', 'grill', 'fry',
  'broccoli', 'cauliflower', 'cabbage', 'corn', 'pea', 'squash', 'zucchini',
  'avocado', 'mango', 'pineapple', 'banana', 'apple', 'pear', 'peach',
  'plum', 'cherry', 'grape', 'strawberry', 'blueberry', 'raspberry',
  'cranberry', 'fig', 'date', 'raisin', 'prune', 'apricot', 'melon',
  'oat', 'wheat', 'barley', 'quinoa', 'couscous', 'bulgur', 'polenta',
  'tofu', 'tempeh', 'seitan', 'lentil', 'chickpea', 'edamame',
];

/**
 * Check if an ingredient name is likely a real food item.
 */
function looksLikeFood(name) {
  if (!name || name.length < 2 || name.length > 50) return false;
  if (/^\d+$/.test(name)) return false;
  if (!/[a-z]/.test(name)) return false;

  // Known food? Pass immediately.
  if (KNOWN_FOODS.has(name)) return true;

  // Contains a food indicator word? Pass.
  for (const indicator of FOOD_INDICATORS) {
    if (name.includes(indicator)) return true;
  }

  // Check if any word in the name is a known food
  for (const word of name.split(/\s+/)) {
    if (KNOWN_FOODS.has(word)) return true;
    // Check singular form
    if (word.endsWith('s') && KNOWN_FOODS.has(word.slice(0, -1))) return true;
    if (word.endsWith('es') && KNOWN_FOODS.has(word.slice(0, -2))) return true;
  }

  return false;
}

async function run() {
  log('Step 1: Parse RecipeNLG CSV');
  log('TIP: run with  node --max-old-space-size=4096  for large files');

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n  RecipeNLG CSV not found at:\n    ${CSV_PATH}\n`);
    console.error('  Download from Kaggle:');
    console.error('    https://www.kaggle.com/datasets/paultimothymooney/recipenlg');
    console.error('  Place the CSV as raw/recipenlg.csv and re-run.\n');
    process.exit(1);
  }

  const ingredientFreq = new Map();   // ingredient → recipe count
  const pairCount = new Map();        // pairKey → co-occurrence count
  let totalRecipes = 0;

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(CSV_PATH, 'utf-8')
      .pipe(csvParser());

    stream.on('data', (row) => {
      totalRecipes++;
      if (totalRecipes % 100000 === 0) log(`  ...processed ${totalRecipes} recipes`);

      let ner;
      try {
        ner = JSON.parse(row.NER || '[]');
      } catch {
        return; // skip malformed rows
      }
      if (!Array.isArray(ner) || ner.length === 0) return;

      // Canonicalize + dedupe per recipe + filter non-food
      const cleaned = [...new Set(
        ner.map(n => canonicalizeIngredient(n))
           .filter(n => n && !SKIP_SET.has(n) && looksLikeFood(n))
      )];

      // Count ingredient frequency
      for (const ing of cleaned) {
        ingredientFreq.set(ing, (ingredientFreq.get(ing) || 0) + 1);
      }

      // Count pairs
      for (let i = 0; i < cleaned.length; i++) {
        for (let j = i + 1; j < cleaned.length; j++) {
          const key = pairKey(cleaned[i], cleaned[j]);
          pairCount.set(key, (pairCount.get(key) || 0) + 1);
        }
      }
    });

    stream.on('end', resolve);
    stream.on('error', reject);
  });

  log(`Total recipes parsed: ${totalRecipes}`);
  log(`Unique ingredients (raw): ${ingredientFreq.size}`);

  // Filter ingredients with < MIN_INGREDIENT_RECIPES appearances
  const validIngredients = new Set();
  for (const [name, count] of ingredientFreq) {
    if (count >= MIN_INGREDIENT_RECIPES) validIngredients.add(name);
  }
  log(`Ingredients after frequency filter (>=${MIN_INGREDIENT_RECIPES}): ${validIngredients.size}`);

  // Compute PMI for each pair, filter by MIN_RECIPE_COUNT
  const pmiMap = new Map();
  let kept = 0;
  let dropped = 0;

  for (const [key, count] of pairCount) {
    if (count < MIN_RECIPE_COUNT) { dropped++; continue; }
    const [a, b] = key.split('|');
    if (!validIngredients.has(a) || !validIngredients.has(b)) { dropped++; continue; }

    const pmi = computePMI(count, ingredientFreq.get(a), ingredientFreq.get(b), totalRecipes);
    pmiMap.set(key, pmi);
    kept++;
  }

  log(`Pairs kept: ${kept}, dropped: ${dropped}`);

  // Normalize PMI to [0,1]
  const normalizedPMI = normalizeMap(pmiMap);

  // Build output
  const pairs = {};
  for (const [key, pmi] of pmiMap) {
    pairs[key] = {
      count: pairCount.get(key),
      pmi: Math.round(pmi * 1e6) / 1e6,
      strength: Math.round(normalizedPMI.get(key) * 1e6) / 1e6,
    };
  }

  const ingredients = {};
  for (const name of validIngredients) {
    ingredients[name] = ingredientFreq.get(name);
  }

  ensureDir(PROCESSED_DIR);
  writeJson(OUT_PATH, { pairs, ingredients, totalRecipes });
  log(`Wrote ${OUT_PATH}`);
  log('Step 1 complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
