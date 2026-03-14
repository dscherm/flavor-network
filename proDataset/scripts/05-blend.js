import path from 'path';
import {
  PROCESSED_DIR, OUTPUT_DIR, DATA_DIR,
  WEIGHTS, MIN_BLENDED_STRENGTH,
} from '../config.js';
import {
  ensureDir, readJson, writeJson, log,
} from '../utils.js';

const SOURCE_FILES = {
  recipenlg:  path.join(PROCESSED_DIR, 'recipenlg-cooccurrence.json'),
  flavordb:   path.join(PROCESSED_DIR, 'flavordb-overlap.json'),
  mealdb:     path.join(PROCESSED_DIR, 'mealdb-cooccurrence.json'),
  cocktaildb: path.join(PROCESSED_DIR, 'cocktaildb-cooccurrence.json'),
};

function getStrength(sourceData, key) {
  if (!sourceData?.pairs?.[key]) return 0;
  // FlavorDB uses 'overlap' instead of 'strength'
  return sourceData.pairs[key].strength ?? sourceData.pairs[key].overlap ?? 0;
}

async function run() {
  log('Step 5: Blend all sources into final output');

  // Load all sources
  const sources = {};
  for (const [name, filePath] of Object.entries(SOURCE_FILES)) {
    const data = readJson(filePath);
    if (data) {
      const pairCount = Object.keys(data.pairs || {}).length;
      const ingCount = Object.keys(data.ingredients || {}).length;
      log(`  Loaded ${name}: ${pairCount} pairs, ${ingCount} ingredients`);
      sources[name] = data;
    } else {
      log(`  WARNING: ${name} not found at ${filePath} — skipping (0 contribution)`);
      sources[name] = { pairs: {}, ingredients: {} };
    }
  }

  // Load categories
  const categories = readJson(path.join(DATA_DIR, 'categories.json')) || {};

  // Build master ingredient set
  const masterIngredients = new Map(); // name → { sources: [], category, taste, totalCount }
  for (const [sourceName, data] of Object.entries(sources)) {
    if (!data.ingredients) continue;
    for (const [name, count] of Object.entries(data.ingredients)) {
      if (!masterIngredients.has(name)) {
        const catInfo = categories[name] || {};
        masterIngredients.set(name, {
          sources: [],
          category: catInfo.category || 'unknown',
          taste: catInfo.taste || null,
          totalCount: 0,
        });
      }
      const entry = masterIngredients.get(name);
      entry.sources.push(sourceName);
      entry.totalCount += (typeof count === 'number' ? count : 0);
    }
  }

  log(`Master ingredient list: ${masterIngredients.size}`);

  // Collect all unique pair keys across all sources
  const allPairKeys = new Set();
  for (const data of Object.values(sources)) {
    if (!data.pairs) continue;
    for (const key of Object.keys(data.pairs)) {
      allPairKeys.add(key);
    }
  }

  log(`Unique pair keys across all sources: ${allPairKeys.size}`);

  // Blend pairs
  const blendedPairs = [];

  for (const key of allPairKeys) {
    const breakdown = {};
    let blended = 0;

    for (const [sourceName, weight] of Object.entries(WEIGHTS)) {
      const s = getStrength(sources[sourceName], key);
      breakdown[sourceName] = Math.round(s * 1e6) / 1e6;
      blended += weight * s;
    }

    blended = Math.round(blended * 1e6) / 1e6;

    if (blended < MIN_BLENDED_STRENGTH) continue;

    const [a, b] = key.split('|');
    blendedPairs.push({
      key,
      ingredientA: a,
      ingredientB: b,
      strength: blended,
      breakdown,
    });
  }

  // Sort by strength descending
  blendedPairs.sort((a, b) => b.strength - a.strength);

  log(`Blended pairs after filtering (>=${MIN_BLENDED_STRENGTH}): ${blendedPairs.length}`);

  // Build output structures
  const ingredientsOut = {};
  for (const [name, info] of masterIngredients) {
    ingredientsOut[name] = {
      category: info.category,
      taste: info.taste,
      sources: info.sources,
      totalCount: info.totalCount,
    };
  }

  const pairingsOut = blendedPairs.map(p => ({
    ingredientA: p.ingredientA,
    ingredientB: p.ingredientB,
    strength: p.strength,
    breakdown: p.breakdown,
  }));

  const metadata = {
    generatedAt: new Date().toISOString(),
    sources: {},
    weights: WEIGHTS,
    thresholds: { MIN_BLENDED_STRENGTH },
    totalIngredients: masterIngredients.size,
    totalPairings: pairingsOut.length,
  };

  for (const [name, data] of Object.entries(sources)) {
    metadata.sources[name] = {
      pairs: Object.keys(data.pairs || {}).length,
      ingredients: Object.keys(data.ingredients || {}).length,
      totalRecipes: data.totalRecipes ?? null,
    };
  }

  // Write output files
  ensureDir(OUTPUT_DIR);
  writeJson(path.join(OUTPUT_DIR, 'ingredients.json'), ingredientsOut);
  writeJson(path.join(OUTPUT_DIR, 'pairings.json'), pairingsOut);
  writeJson(path.join(OUTPUT_DIR, 'metadata.json'), metadata);

  log(`Wrote output/ingredients.json (${masterIngredients.size} ingredients)`);
  log(`Wrote output/pairings.json (${pairingsOut.length} pairings)`);
  log(`Wrote output/metadata.json`);
  log('Step 5 complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
