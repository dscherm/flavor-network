import path from 'path';
import {
  PROCESSED_DIR, OUTPUT_DIR, DATA_DIR,
} from '../config.js';
import {
  ensureDir, readJson, writeJson, log,
} from '../utils.js';

// ─────────── Constants ───────────

const MIN_BLENDED_STRENGTH = 0.10;
const MAX_PAIRS = 40000;
const MIN_PAIRS_PER_INGREDIENT = 15;

const FEATURES_FILE = path.join(PROCESSED_DIR, 'pair-features.json');
const WEIGHTS_FILE = path.join(DATA_DIR, 'trained_weights.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');

const SOURCE_FILES = {
  recipenlg:  path.join(PROCESSED_DIR, 'recipenlg-cooccurrence.json'),
  flavordb:   path.join(PROCESSED_DIR, 'flavordb-overlap.json'),
  mealdb:     path.join(PROCESSED_DIR, 'mealdb-cooccurrence.json'),
  cocktaildb: path.join(PROCESSED_DIR, 'cocktaildb-cooccurrence.json'),
};

// ─────────── Default perceptron weights (fallback) ───────────

const DEFAULT_WEIGHTS = {
  weights: [2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2],
  bias: -3.0,
};

// ─────────── Perceptron ───────────

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function perceptronScore(features, weights, bias) {
  const z = features.reduce((sum, x, i) => sum + x * weights[i], bias);
  return sigmoid(z);
}

// ─────────── Multi-dimensional sub-scores ───────────

function computeSubScores(f) {
  // tradition: recipe co-occurrence + frequency + cuisine overlap
  const tradition = f.x1_npmi * 0.4 + f.x2_freq * 0.3 + f.x6_cuisine * 0.3;
  // chemistry: chemical overlap + compound diversity
  const chemistry = f.x3_chemical * 0.6 + f.x8_compound_diversity * 0.4;
  // novelty: inverse of tradition
  const novelty = 1 - tradition;
  // balance: taste compatibility (direct passthrough)
  const balance = f.x4_taste;
  // bridging: category bridge score
  const bridging = f.x5_bridge;

  return {
    tradition: round6(tradition),
    chemistry: round6(chemistry),
    novelty:   round6(novelty),
    balance:   round6(balance),
    bridging:  round6(bridging),
  };
}

// ─────────── Explanation generation ───────────

function generateExplanation(a, b, f, sharedCompounds, tasteA, tasteB) {
  const parts = [];

  if (sharedCompounds && sharedCompounds.length > 0) {
    parts.push(`Both contain ${sharedCompounds.slice(0, 3).join(', ')}`);
  }

  if (f.x4_taste > 0.7) {
    parts.push(`Strong taste complementarity (${tasteA || '?'} + ${tasteB || '?'})`);
  } else if (f.x4_taste < 0.3) {
    parts.push(`Similar taste profiles may compete`);
  }

  if (f.x6_cuisine > 0.5) {
    parts.push(`Traditional pairing`);
  }

  if (f.x5_bridge > 0.5 && f.x6_cuisine < 0.3) {
    parts.push(`Novel cross-category pairing with chemical support`);
  }

  if (f.x1_npmi > 0.6) {
    parts.push(`Frequently paired in recipes`);
  }

  if (f.x7_hub_asymmetry > 0.3) {
    parts.push(`Hub ingredient enhancing a specialty ingredient`);
  }

  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

// ─────────── Category / taste inference (copied from 05-blend.js) ───────────

const CATEGORY_KEYWORDS = [
  { pattern: /\b(rum|gin|vodka|whiskey|bourbon|tequila|brandy|cognac|mezcal|sake|scotch|pisco|cachaca|aquavit|schnapps)\b/, category: 'spirit', taste: 'bitter pungent' },
  { pattern: /\b(liqueur|amaretto|kahlua|cointreau|chartreuse|campari|aperol|triple sec|curacao|sambuca|limoncello|midori|baileys|frangelico|grand marnier|drambuie|benedictine)\b/, category: 'liqueur', taste: 'sweet bitter' },
  { pattern: /\b(vermouth|bitters|angostura)\b/, category: 'bitters', taste: 'bitter pungent' },
  { pattern: /\b(butter|oil|lard|ghee|margarine|shortening|dripping|tallow|schmaltz)\b/, category: 'fat', taste: 'sweet' },
  { pattern: /\b(cream|milk|yogurt|cheese|ricotta|mascarpone|mozzarella|cheddar|parmesan|gruyere|brie|camembert|feta|gouda|provolone|monterey|colby|swiss|cottage|sour cream|buttermilk|whey|kefir|creme fraiche)\b/, category: 'dairy', taste: 'sweet sour' },
  { pattern: /\b(chicken|beef|pork|lamb|veal|turkey|duck|goose|rabbit|venison|bison|bacon|ham|sausage|salami|prosciutto|pancetta|chorizo|pepperoni|steak|roast|meatball|ground meat|mince)\b/, category: 'protein', taste: 'salty pungent' },
  { pattern: /\b(salmon|tuna|cod|halibut|tilapia|trout|bass|snapper|swordfish|mahi|catfish|sardine|anchov|shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|squid|octopus|calamari|fish)\b/, category: 'protein', taste: 'salty pungent' },
  { pattern: /\b(soy sauce|fish sauce|oyster sauce|miso|worcestershire|tamari|hoisin|teriyaki|ponzu|dashi|bonito|kombu|anchov|parmesan|umami)\b/, category: 'umami', taste: 'salty bitter' },
  { pattern: /\b(lemon|lime|orange|grapefruit|tangerine|mandarin|clementine|yuzu|citrus|bergamot|kumquat|pomelo)\b/, category: 'citrus', taste: 'sour sweet' },
  { pattern: /\b(vinegar|tamarind|verjus|amchur|sumac)\b/, category: 'acid', taste: 'sour' },
  { pattern: /\b(chili|chile|pepper|jalapeno|habanero|serrano|chipotle|ancho|guajillo|pasilla|cayenne|tabasco|sriracha|gochujang|gochugaru|harissa|sambal|hot sauce|chilli)\b/, category: 'chili', taste: 'spicy pungent' },
  { pattern: /\b(basil|parsley|cilantro|mint|thyme|rosemary|oregano|sage|dill|tarragon|chervil|chive|bay leaf|marjoram|lavender|lemongrass|epazote|shiso|sorrel)\b/, category: 'herb', taste: 'astringent bitter' },
  { pattern: /\b(cumin|coriander|turmeric|paprika|cinnamon|nutmeg|clove|cardamom|allspice|fenugreek|saffron|star anise|fennel seed|caraway|juniper|szechuan|mustard seed|celery seed|poppy seed|annatto|sumac|za'atar|ras el hanout|garam masala|curry powder|five spice)\b/, category: 'spice', taste: 'pungent bitter' },
  { pattern: /\b(garlic|onion|shallot|ginger|galangal|scallion|leek|celery|carrot|fennel bulb)\b/, category: 'aromatic', taste: 'pungent sweet' },
  { pattern: /\b(sugar|honey|syrup|molasses|agave|stevia|jaggery|treacle|caramel|confectioner|sweetener)\b/, category: 'sweetener', taste: 'sweet' },
  { pattern: /\b(almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|pine nut|peanut|chestnut|coconut|sesame|tahini|praline)\b/, category: 'nut', taste: 'bitter sweet' },
  { pattern: /\b(flour|cornstarch|arrowroot|tapioca|breadcrumb|cornmeal|semolina)\b/, category: 'thickener', taste: 'sweet' },
  { pattern: /\b(rice|pasta|noodle|bread|oat|wheat|barley|quinoa|couscous|bulgur|polenta|tortilla|cracker|cereal|granola|farro|millet)\b/, category: 'grain', taste: 'sweet' },
  { pattern: /\b(stock|broth|wine|beer|water|juice|coconut milk|tea|coffee|espresso|cola|soda|tonic|prosecco|champagne|cider)\b/, category: 'liquid', taste: 'sour salty' },
  { pattern: /\b(tomato|potato|sweet potato|mushroom|spinach|kale|broccoli|cauliflower|cabbage|corn|pea|bean|squash|zucchini|eggplant|asparagus|artichoke|beet|turnip|radish|cucumber|lettuce|arugula|watercress|chard|bok choy|sprout|okra|plantain|yam|taro)\b/, category: 'vegetable', taste: 'astringent sweet' },
  { pattern: /\b(apple|pear|peach|plum|cherry|grape|berry|strawberry|blueberry|raspberry|blackberry|cranberry|fig|date|raisin|prune|apricot|mango|pineapple|banana|papaya|melon|watermelon|cantaloupe|kiwi|passion fruit|guava|lychee|pomegranate|persimmon|quince)\b/, category: 'fruit', taste: 'sweet sour' },
  { pattern: /\b(egg)\b/, category: 'protein', taste: 'salty' },
  { pattern: /\b(salt|pepper|seasoning)\b/, category: 'seasoning', taste: 'pungent salty' },
];

const CATEGORY_TASTES = {
  spirit: 'bitter pungent', liqueur: 'sweet bitter', bitters: 'bitter pungent',
  fat: 'sweet', dairy: 'sweet sour', protein: 'salty pungent', umami: 'salty bitter',
  citrus: 'sour sweet', acid: 'sour', chili: 'spicy pungent', herb: 'astringent bitter',
  spice: 'pungent bitter', aromatic: 'pungent sweet', sweetener: 'sweet',
  nut: 'bitter sweet', thickener: 'sweet', grain: 'sweet', liquid: 'sour salty',
  mixer: 'sour sweet', vegetable: 'astringent sweet', fruit: 'sweet sour',
  seasoning: 'pungent salty', condiment: 'sour sweet pungent', baked: 'sweet',
  confection: 'sweet', other: 'pungent',
};

function inferCategory(name, categories) {
  const exact = categories[name];
  if (exact && !exact._comment) return exact;
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.pattern.test(name)) {
      return { category: rule.category, taste: CATEGORY_TASTES[rule.category] || rule.taste };
    }
  }
  // Extended heuristics
  if (/sauce|dressing|gravy|marinade|glaze|rub|ketchup|mayo|aioli|pesto|salsa|chutney|relish|mustard|condiment/.test(name)) {
    return { category: 'condiment', taste: CATEGORY_TASTES.condiment };
  }
  if (/cake|cookie|brownie|muffin|biscuit|scone|pastry|pie|tart|bread|roll|wafer|cracker|crust|dough|batter/.test(name)) {
    return { category: 'baked', taste: CATEGORY_TASTES.baked };
  }
  if (/candy|fudge|caramel|toffee|marshmallow|sprinkle|frosting|icing|fondant|ganache/.test(name)) {
    return { category: 'confection', taste: CATEGORY_TASTES.confection };
  }
  if (/chocolate|cocoa|carob/.test(name)) {
    return { category: 'sweetener', taste: 'bitter sweet' };
  }
  if (/vanilla|extract|flavor/.test(name)) {
    return { category: 'spice', taste: 'sweet pungent' };
  }
  if (/pudding|custard|mousse|gelatin|jello/.test(name)) {
    return { category: 'dairy', taste: CATEGORY_TASTES.dairy };
  }
  if (/soup|stew|chili con|broth/.test(name)) {
    return { category: 'liquid', taste: 'salty pungent' };
  }
  if (/olive|pickle|caper|cornichon/.test(name)) {
    return { category: 'vegetable', taste: 'sour bitter' };
  }
  if (/jam|jelly|preserve|marmalade|compote|syrup|molas/.test(name)) {
    return { category: 'sweetener', taste: CATEGORY_TASTES.sweetener };
  }
  if (/seed|flax|chia|hemp|sunflower|pumpkin seed|poppy/.test(name)) {
    return { category: 'nut', taste: CATEGORY_TASTES.nut };
  }
  if (/yeast|baking powder|baking soda|cream of tartar/.test(name)) {
    return { category: 'thickener', taste: 'bitter' };
  }
  if (/lemonade|limeade|juice|cider|punch|smoothie|shake/.test(name)) {
    return { category: 'liquid', taste: 'sweet sour' };
  }
  if (/hamburger|meatball|meatloaf|hamburg|ground/.test(name)) {
    return { category: 'protein', taste: CATEGORY_TASTES.protein };
  }
  if (/potatoe?s?$|potato/.test(name)) {
    return { category: 'vegetable', taste: 'sweet' };
  }
  if (/tomatoe?s?$/.test(name)) {
    return { category: 'vegetable', taste: 'sour sweet pungent' };
  }
  if (/peache?s?$|plum|berr|apricot|nectarine|melon|pear/.test(name)) {
    return { category: 'fruit', taste: CATEGORY_TASTES.fruit };
  }
  if (/spray|wrap|foil|parchment|wax paper/.test(name)) {
    return { category: 'other', taste: null };
  }
  return { category: 'other', taste: CATEGORY_TASTES.other };
}

// ─────────── Helpers ───────────

function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

// ─────────── Main ───────────

async function run() {
  log('Step 7: Perceptron-based blend (v2)');

  // Load perceptron weights
  let perceptronConfig = readJson(WEIGHTS_FILE);
  if (perceptronConfig) {
    log(`  Loaded trained weights from ${WEIGHTS_FILE}`);
    log(`  Training status: ${perceptronConfig.training_status || 'unknown'}`);
  } else {
    log(`  Trained weights not found -- using default initial weights`);
    perceptronConfig = DEFAULT_WEIGHTS;
  }
  const { weights, bias } = perceptronConfig;

  // Load 8-dimensional feature vectors
  const featuresData = readJson(FEATURES_FILE);
  if (!featuresData || !featuresData.pairs) {
    throw new Error(`Cannot load pair features from ${FEATURES_FILE}. Run step 06 first.`);
  }
  const featurePairs = featuresData.pairs;
  const totalFeaturePairs = Object.keys(featurePairs).length;
  log(`  Loaded features for ${totalFeaturePairs} pairs (source: ${featuresData.compoundSource || 'unknown'})`);

  // Load all co-occurrence sources (for building master ingredient list)
  const sources = {};
  for (const [name, filePath] of Object.entries(SOURCE_FILES)) {
    const data = readJson(filePath);
    if (data) {
      const pairCount = Object.keys(data.pairs || {}).length;
      const ingCount = Object.keys(data.ingredients || {}).length;
      log(`  Loaded ${name}: ${pairCount} pairs, ${ingCount} ingredients`);
      sources[name] = data;
    } else {
      log(`  WARNING: ${name} not found at ${filePath} -- skipping`);
      sources[name] = { pairs: {}, ingredients: {} };
    }
  }

  // Load categories
  const categories = readJson(CATEGORIES_FILE) || {};

  // Build master ingredient set (same logic as 05-blend.js)
  const masterIngredients = new Map();
  for (const [sourceName, data] of Object.entries(sources)) {
    if (!data.ingredients) continue;
    for (const [name, count] of Object.entries(data.ingredients)) {
      if (!masterIngredients.has(name)) {
        const catInfo = inferCategory(name, categories);
        masterIngredients.set(name, {
          sources: [],
          category: catInfo.category || 'other',
          taste: catInfo.taste || null,
          totalCount: 0,
        });
      }
      const entry = masterIngredients.get(name);
      entry.sources.push(sourceName);
      entry.totalCount += (typeof count === 'number' ? count : 0);
    }
  }

  log(`  Master ingredient list: ${masterIngredients.size}`);

  // Helper: get taste for an ingredient
  function getTaste(name) {
    const info = masterIngredients.get(name);
    return info ? info.taste : null;
  }

  // ─────────── Perceptron forward pass for all pairs ───────────

  const blendedPairs = [];
  let processed = 0;
  let belowThreshold = 0;

  for (const [key, f] of Object.entries(featurePairs)) {
    const featureVector = [
      f.x1_npmi,
      f.x2_freq,
      f.x3_chemical,
      f.x4_taste,
      f.x5_bridge,
      f.x6_cuisine,
      f.x7_hub_asymmetry,
      f.x8_compound_diversity,
    ];

    const overall = perceptronScore(featureVector, weights, bias);

    if (overall < MIN_BLENDED_STRENGTH) {
      belowThreshold++;
      processed++;
      continue;
    }

    const [a, b] = key.split('|');
    const subScores = computeSubScores(f);
    const tasteA = getTaste(a);
    const tasteB = getTaste(b);
    const explanation = generateExplanation(a, b, f, f.sharedCompounds || [], tasteA, tasteB);

    blendedPairs.push({
      key,
      ingredientA: a,
      ingredientB: b,
      strength: round6(overall),
      tradition: subScores.tradition,
      chemistry: subScores.chemistry,
      novelty: subScores.novelty,
      balance: subScores.balance,
      bridging: subScores.bridging,
      sharedCompounds: f.sharedCompounds || [],
      explanation,
      breakdown: {
        x1: f.x1_npmi,
        x2: f.x2_freq,
        x3: f.x3_chemical,
        x4: f.x4_taste,
        x5: f.x5_bridge,
        x6: f.x6_cuisine,
        x7: f.x7_hub_asymmetry,
        x8: f.x8_compound_diversity,
      },
    });

    processed++;
    if (processed % 50000 === 0) {
      log(`  Progress: ${processed} / ${totalFeaturePairs} pairs (${Math.round(100 * processed / totalFeaturePairs)}%)`);
    }
  }

  log(`  Processed ${processed} pairs total`);
  log(`  Passed threshold (>= ${MIN_BLENDED_STRENGTH}): ${blendedPairs.length}`);
  log(`  Below threshold: ${belowThreshold}`);

  // Sort by strength descending
  blendedPairs.sort((a, b) => b.strength - a.strength);

  // ─────────── Smart cap ───────────

  const kept = new Set();

  // Phase 1: guarantee minimum pairings per ingredient
  const byIngredient = new Map();
  for (let i = 0; i < blendedPairs.length; i++) {
    const p = blendedPairs[i];
    for (const name of [p.ingredientA, p.ingredientB]) {
      if (!byIngredient.has(name)) byIngredient.set(name, []);
      byIngredient.get(name).push(i);
    }
  }
  for (const [, indices] of byIngredient) {
    // Already sorted by strength, take top MIN_PAIRS_PER_INGREDIENT
    for (let j = 0; j < Math.min(MIN_PAIRS_PER_INGREDIENT, indices.length); j++) {
      kept.add(indices[j]);
    }
  }
  log(`  Smart cap phase 1: ${kept.size} pairs guaranteed for ${byIngredient.size} ingredients (min ${MIN_PAIRS_PER_INGREDIENT} each)`);

  // Phase 2: fill remaining slots from top-strength pairs
  for (let i = 0; i < blendedPairs.length && kept.size < MAX_PAIRS; i++) {
    kept.add(i);
  }

  const finalPairs = [...kept].sort((a, b) => a - b).map(i => blendedPairs[i]);
  finalPairs.sort((a, b) => b.strength - a.strength);

  log(`  Smart cap final: ${finalPairs.length} pairs (max ${MAX_PAIRS})`);

  // ─────────── Log example pairings ───────────

  log('');
  log('  === Example pairings (top 10 by overall score) ===');
  for (let i = 0; i < Math.min(10, finalPairs.length); i++) {
    const p = finalPairs[i];
    log(`  ${i + 1}. ${p.ingredientA} + ${p.ingredientB}`);
    log(`     strength=${p.strength}  tradition=${p.tradition}  chemistry=${p.chemistry}  novelty=${p.novelty}  balance=${p.balance}  bridging=${p.bridging}`);
    if (p.explanation) log(`     "${p.explanation}"`);
  }

  log('');
  log('  === Example pairings (high novelty, low tradition) ===');
  const novelPairs = finalPairs
    .filter(p => p.novelty > 0.6 && p.chemistry > 0.4 && p.strength > 0.3)
    .slice(0, 5);
  for (const p of novelPairs) {
    log(`  * ${p.ingredientA} + ${p.ingredientB}`);
    log(`    strength=${p.strength}  tradition=${p.tradition}  chemistry=${p.chemistry}  novelty=${p.novelty}`);
    if (p.explanation) log(`    "${p.explanation}"`);
  }

  // ─────────── Build output structures ───────────

  const ingredientsOut = {};
  for (const [name, info] of masterIngredients) {
    ingredientsOut[name] = {
      category: info.category,
      taste: info.taste,
      sources: info.sources,
      totalCount: info.totalCount,
    };
  }

  const pairingsOut = finalPairs.map(p => ({
    ingredientA: p.ingredientA,
    ingredientB: p.ingredientB,
    strength: p.strength,
    tradition: p.tradition,
    chemistry: p.chemistry,
    novelty: p.novelty,
    balance: p.balance,
    bridging: p.bridging,
    sharedCompounds: p.sharedCompounds,
    explanation: p.explanation,
    breakdown: p.breakdown,
  }));

  const metadata = {
    generatedAt: new Date().toISOString(),
    pipeline: 'blend-v2 (perceptron)',
    perceptron: {
      weights,
      bias,
      featureNames: perceptronConfig.feature_names || DEFAULT_WEIGHTS.feature_names,
      trainingStatus: perceptronConfig.training_status || 'untrained',
    },
    thresholds: {
      MIN_BLENDED_STRENGTH,
      MAX_PAIRS,
      MIN_PAIRS_PER_INGREDIENT,
    },
    featureSource: {
      file: 'processed/pair-features.json',
      compoundSource: featuresData.compoundSource || 'unknown',
      fallbacksUsed: featuresData.fallbacksUsed || {},
    },
    totalIngredients: masterIngredients.size,
    totalPairings: pairingsOut.length,
    totalFeaturePairsEvaluated: totalFeaturePairs,
    pairsBelowThreshold: belowThreshold,
    sources: {},
  };

  for (const [name, data] of Object.entries(sources)) {
    metadata.sources[name] = {
      pairs: Object.keys(data.pairs || {}).length,
      ingredients: Object.keys(data.ingredients || {}).length,
      totalRecipes: data.totalRecipes ?? null,
    };
  }

  // ─────────── Write output ───────────

  ensureDir(OUTPUT_DIR);
  writeJson(path.join(OUTPUT_DIR, 'ingredients.json'), ingredientsOut);
  writeJson(path.join(OUTPUT_DIR, 'pairings.json'), pairingsOut);
  writeJson(path.join(OUTPUT_DIR, 'metadata.json'), metadata);

  log(`Wrote output/ingredients.json (${masterIngredients.size} ingredients)`);
  log(`Wrote output/pairings.json (${pairingsOut.length} pairings)`);
  log(`Wrote output/metadata.json`);

  // ─────────── Summary statistics ───────────

  const strengths = pairingsOut.map(p => p.strength);
  const avgStrength = strengths.reduce((s, v) => s + v, 0) / strengths.length;
  const medianStrength = strengths.sort((a, b) => a - b)[Math.floor(strengths.length / 2)];
  const minStrength = strengths[0];
  const maxStrength = strengths[strengths.length - 1];

  log('');
  log('  === Score distribution ===');
  log(`  min=${minStrength}  median=${round6(medianStrength)}  mean=${round6(avgStrength)}  max=${maxStrength}`);

  // Histogram buckets
  const buckets = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const counts = new Array(buckets.length - 1).fill(0);
  for (const s of pairingsOut.map(p => p.strength)) {
    for (let i = 0; i < buckets.length - 1; i++) {
      if (s >= buckets[i] && s < buckets[i + 1]) {
        counts[i]++;
        break;
      }
      if (i === buckets.length - 2 && s >= buckets[i + 1]) {
        counts[i]++;
      }
    }
  }
  for (let i = 0; i < counts.length; i++) {
    log(`  [${buckets[i].toFixed(1)}-${buckets[i + 1].toFixed(1)}): ${counts[i]} pairs`);
  }

  log('');
  log('Step 7 (blend-v2) complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
