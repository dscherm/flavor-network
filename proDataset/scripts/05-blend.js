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

  // Load categories (exact lookup table)
  const categories = readJson(path.join(DATA_DIR, 'categories.json')) || {};

  // Keyword-based category inference for ingredients not in the lookup table
  const CATEGORY_KEYWORDS = [
    // Order matters — more specific patterns first
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

  // Multi-taste profiles for categories
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

  function inferCategory(name) {
    // Exact lookup first
    const exact = categories[name];
    if (exact && !exact._comment) return exact;
    // Keyword matching
    for (const rule of CATEGORY_KEYWORDS) {
      if (rule.pattern.test(name)) {
        return { category: rule.category, taste: CATEGORY_TASTES[rule.category] || rule.taste };
      }
    }
    // Extended heuristic for remaining "other" items
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
      return { category: 'other', taste: null }; // non-food, but rare
    }
    // Default: try to assign based on common co-occurrence patterns
    return { category: 'other', taste: CATEGORY_TASTES.other };
  }

  // Build master ingredient set
  const masterIngredients = new Map(); // name → { sources: [], category, taste, totalCount }
  for (const [sourceName, data] of Object.entries(sources)) {
    if (!data.ingredients) continue;
    for (const [name, count] of Object.entries(data.ingredients)) {
      if (!masterIngredients.has(name)) {
        const catInfo = inferCategory(name);
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
