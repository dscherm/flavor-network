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

      // Canonicalize + dedupe per recipe
      const cleaned = [...new Set(
        ner.map(n => canonicalizeIngredient(n))
           .filter(n => n && !SKIP_SET.has(n))
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
