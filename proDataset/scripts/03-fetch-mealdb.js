import path from 'path';
import {
  RAW_DIR, PROCESSED_DIR, MEALDB_BASE, RATE_LIMITS,
  MIN_RECIPE_COUNT,
} from '../config.js';
import {
  canonicalizeIngredient, pairKey, computePMI, computeHybridScore, normalizeMap,
  throttledFetch, ensureDir, readJson, writeJson, log,
} from '../utils.js';

const CACHE_DIR = path.join(RAW_DIR, 'mealdb');
const OUT_PATH = path.join(PROCESSED_DIR, 'mealdb-cooccurrence.json');
const DELAY = RATE_LIMITS.mealdb;

const SKIP_SET = new Set(['salt', 'pepper', 'water', 'oil', 'black pepper']);
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

async function fetchAllMeals() {
  ensureDir(CACHE_DIR);
  const allMeals = [];

  for (const letter of LETTERS) {
    const cachePath = path.join(CACHE_DIR, `meals_${letter}.json`);
    let data = readJson(cachePath);

    if (!data) {
      try {
        const res = await throttledFetch(`${MEALDB_BASE}/search.php?f=${letter}`, DELAY);
        if (!res.ok) {
          log(`  WARNING: HTTP ${res.status} for letter ${letter}`);
          continue;
        }
        data = await res.json();
        writeJson(cachePath, data);
      } catch (err) {
        log(`  WARNING: Failed to fetch letter ${letter}: ${err.message}`);
        continue;
      }
    }

    const meals = data?.meals || [];
    allMeals.push(...meals);
    if (meals.length > 0) {
      log(`  Letter '${letter}': ${meals.length} meals`);
    }
  }

  return allMeals;
}

function extractIngredients(meal) {
  const result = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    if (!ing || !ing.trim()) continue;
    const canonical = canonicalizeIngredient(ing);
    if (canonical && !SKIP_SET.has(canonical)) {
      result.push(canonical);
    }
  }
  return [...new Set(result)];
}

async function run() {
  log('Step 3: Fetch TheMealDB data');

  const meals = await fetchAllMeals();
  log(`Total meals fetched: ${meals.length}`);

  if (meals.length === 0) {
    log('WARNING: No meals fetched. Writing empty output.');
    ensureDir(PROCESSED_DIR);
    writeJson(OUT_PATH, { pairs: {}, ingredients: {}, totalRecipes: 0 });
    return;
  }

  const ingredientFreq = new Map();
  const pairCounts = new Map();
  let totalRecipes = 0;

  for (const meal of meals) {
    const ingredients = extractIngredients(meal);
    if (ingredients.length < 2) continue;
    totalRecipes++;

    for (const ing of ingredients) {
      ingredientFreq.set(ing, (ingredientFreq.get(ing) || 0) + 1);
    }

    for (let i = 0; i < ingredients.length; i++) {
      for (let j = i + 1; j < ingredients.length; j++) {
        const key = pairKey(ingredients[i], ingredients[j]);
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  log(`Unique ingredients: ${ingredientFreq.size}`);
  log(`Unique pairs (raw): ${pairCounts.size}`);

  // Compute hybrid score (NPMI + log-count)
  const pmiMap = new Map();
  const scoreMap = new Map();
  for (const [key, count] of pairCounts) {
    if (count < MIN_RECIPE_COUNT) continue;
    const [a, b] = key.split('|');
    const pmi = computePMI(count, ingredientFreq.get(a), ingredientFreq.get(b), totalRecipes);
    const hybrid = computeHybridScore(count, ingredientFreq.get(a), ingredientFreq.get(b), totalRecipes);
    pmiMap.set(key, pmi);
    scoreMap.set(key, hybrid);
  }

  const normalizedScores = normalizeMap(scoreMap);

  const pairs = {};
  for (const [key, pmi] of pmiMap) {
    pairs[key] = {
      count: pairCounts.get(key),
      pmi: Math.round(pmi * 1e6) / 1e6,
      strength: Math.round(normalizedScores.get(key) * 1e6) / 1e6,
    };
  }

  const ingredients = {};
  for (const [name, count] of ingredientFreq) {
    ingredients[name] = count;
  }

  ensureDir(PROCESSED_DIR);
  writeJson(OUT_PATH, { pairs, ingredients, totalRecipes });
  log(`Wrote ${OUT_PATH}`);
  log('Step 3 complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
