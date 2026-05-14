import path from 'path';
import {
  PROCESSED_DIR, DATA_DIR,
  FEATURE_FALLBACKS, COMPOUND_CLASSES,
} from '../config.js';
import {
  readJson, writeJson, log,
} from '../utils.js';

// ─────────── Source file paths ───────────

const SOURCE_FILES = {
  recipenlg:  path.join(PROCESSED_DIR, 'recipenlg-cooccurrence.json'),
  mealdb:     path.join(PROCESSED_DIR, 'mealdb-cooccurrence.json'),
  cocktaildb: path.join(PROCESSED_DIR, 'cocktaildb-cooccurrence.json'),
};

const FOODB_FILE       = path.join(PROCESSED_DIR, 'foodb-compounds.json');
const FLAVORDB_COMPOUNDS_FILE = path.join(PROCESSED_DIR, 'flavordb-compounds.json');
const GNN_COMPOUNDS_FILE = path.join(PROCESSED_DIR, '..', '..', 'public', 'proDataset', 'gnn_compounds.json');
const BUILTIN_DB_FILE  = path.join(DATA_DIR, 'compound_database.json');
const TASTE_COMPAT_FILE = path.join(DATA_DIR, 'taste_compatibility.json');
const CAT_DIST_FILE    = path.join(DATA_DIR, 'category_distances.json');
const CATEGORIES_FILE  = path.join(DATA_DIR, 'categories.json');
const OUTPUT_FILE      = path.join(PROCESSED_DIR, 'pair-features.json');

// ─────────── Hardcoded taste compatibility (fallback) ───────────

const TASTE_SYNERGIES = {
  'sweet|sour': 0.85,
  'sour|umami': 0.85,
  'salty|umami': 0.85,
  'sweet|salty': 0.85,
  'bitter|bitter': 0.2,
  'astringent|astringent': 0.2,
};

function lookupTasteCompat(tasteA, tasteB, tasteMatrix) {
  if (tasteMatrix) {
    // External matrix: keys are "tasteA|tasteB" (alphabetically sorted)
    const key = tasteA < tasteB ? `${tasteA}|${tasteB}` : `${tasteB}|${tasteA}`;
    if (tasteMatrix[key] !== undefined) return tasteMatrix[key];
  }
  // Hardcoded fallback
  if (tasteA === tasteB) return 0.4;
  const key = tasteA < tasteB ? `${tasteA}|${tasteB}` : `${tasteB}|${tasteA}`;
  return TASTE_SYNERGIES[key] ?? 0.6;
}

// ─────────── Category adjacency (fallback) ───────────

const ADJACENT_CATEGORIES = new Set([
  'aromatic|herb', 'aromatic|spice', 'herb|spice',
  'citrus|fruit', 'dairy|fat', 'protein|umami',
  'acid|citrus', 'chili|spice', 'sweetener|fruit',
  'grain|thickener', 'condiment|acid', 'nut|grain',
  'liquid|dairy', 'seasoning|spice',
]);

function lookupCategoryDistance(catA, catB, catDistMatrix) {
  if (catDistMatrix) {
    const key = catA < catB ? `${catA}|${catB}` : `${catB}|${catA}`;
    if (catDistMatrix[key] !== undefined) return catDistMatrix[key];
  }
  // Hardcoded fallback
  if (catA === catB) return 0.0;
  const key = catA < catB ? `${catA}|${catB}` : `${catB}|${catA}`;
  return ADJACENT_CATEGORIES.has(key) ? 0.5 : 1.0;
}

// ─────────── NPMI computation (pure, no log-count blend) ───────────

function computeNPMI(pairCount, countA, countB, total) {
  if (!pairCount || !countA || !countB || !total) return 0;
  const pAB = pairCount / total;
  const pA = countA / total;
  const pB = countB / total;
  const pmi = Math.log2(pAB / (pA * pB));
  if (pmi <= 0) return 0;
  const npmi = pmi / (-Math.log2(pAB));
  return Math.max(0, Math.min(1, npmi));
}

// ─────────── Main ───────────

async function run() {
  log('Step 6: Compute 8-dimensional feature vectors for ingredient pairs');

  // Load co-occurrence sources
  const sources = {};
  for (const [name, filePath] of Object.entries(SOURCE_FILES)) {
    const data = readJson(filePath);
    if (data) {
      const pairCount = Object.keys(data.pairs || {}).length;
      log(`  Loaded ${name}: ${pairCount} pairs`);
      sources[name] = data;
    } else {
      log(`  WARNING: ${name} not found at ${filePath} -- skipping`);
      sources[name] = { pairs: {}, ingredients: {}, totalRecipes: 0 };
    }
  }

  // Load compound data: try FooDB processed output first, then built-in DB fallback
  let foodbCompounds = readJson(FOODB_FILE);
  let compoundSource = null;
  let useJaccard = false;

  if (foodbCompounds && Object.keys(foodbCompounds).length > 1) {
    // Check if it came from built-in DB (no concentration data) or full FooDB
    const meta = foodbCompounds._meta;
    compoundSource = meta?.source || 'foodb';
    useJaccard = compoundSource === 'builtin';
    const countKeys = Object.keys(foodbCompounds).filter(k => k !== '_meta').length;
    log(`  Loaded compound data from processed file: ${countKeys} ingredients (source: ${compoundSource})`);
    if (useJaccard) {
      log(`  Built-in DB has no concentration data -- using Jaccard similarity for x3`);
    }
  } else {
    // Try built-in compound database directly
    const builtinDB = readJson(BUILTIN_DB_FILE);
    if (builtinDB && builtinDB.ingredients) {
      foodbCompounds = {};
      for (const [name, data] of Object.entries(builtinDB.ingredients)) {
        foodbCompounds[name] = { compounds: {} };
        for (const comp of data.compounds) {
          foodbCompounds[name].compounds[comp.name] = {
            concentration_mg: 0,
            class: comp.class,
          };
        }
      }
      compoundSource = 'builtin';
      useJaccard = true;
      log(`  Loaded built-in compound database: ${Object.keys(foodbCompounds).length} ingredients`);
      log(`  Built-in DB has no concentration data -- using Jaccard similarity for x3`);
    } else {
      foodbCompounds = null;
      log(`  No compound data available -- using fallbacks for x3, x8`);
    }
  }

  // Augment with FlavorDB2 per-ingredient compound dicts (~1,000 ingredients,
  // 60+ compounds each). Highest-density source after FooDB.
  const flavordbCompounds = readJson(FLAVORDB_COMPOUNDS_FILE);
  if (flavordbCompounds) {
    if (!foodbCompounds) foodbCompounds = {};
    const before = Object.keys(foodbCompounds).filter(k => k !== '_meta').length;
    let added = 0;
    for (const [name, entry] of Object.entries(flavordbCompounds)) {
      if (name === '_meta') continue;
      if (foodbCompounds[name]) continue; // foodb (concentration data) wins
      const compounds = entry?.compounds;
      if (!compounds || Object.keys(compounds).length === 0) continue;
      foodbCompounds[name] = { compounds, _source: 'flavordb2' };
      added++;
    }
    const after = Object.keys(foodbCompounds).filter(k => k !== '_meta').length;
    log(`  Augmented from flavordb-compounds.json: ${before} -> ${after} ingredients (+${added})`);
    compoundSource = compoundSource ? `${compoundSource}+flavordb2` : 'flavordb2';
  } else {
    log(`  WARNING: flavordb-compounds.json not found at ${FLAVORDB_COMPOUNDS_FILE}`);
  }

  // Augment with chemDataset GNN compound predictions (3,319 ingredients).
  // Sparse (3-5 top compounds each) but covers ingredients beyond FlavorDB.
  // FooDB (concentration data) and FlavorDB (full molecule lists) win over GNN.
  const gnnCompounds = readJson(GNN_COMPOUNDS_FILE);
  if (gnnCompounds) {
    if (!foodbCompounds) foodbCompounds = {};
    const before = Object.keys(foodbCompounds).filter(k => k !== '_meta').length;
    let added = 0;
    for (const [name, entry] of Object.entries(gnnCompounds)) {
      if (foodbCompounds[name]) continue; // foodb (concentration data) wins
      const topCompounds = entry?.top_compounds || [];
      if (topCompounds.length === 0) continue;
      const compounds = {};
      for (const c of topCompounds) {
        if (!c?.name) continue;
        compounds[c.name] = {
          concentration_mg: 0,
          class: Array.isArray(c.tags) && c.tags.length > 0 ? c.tags[0] : null,
        };
      }
      if (Object.keys(compounds).length === 0) continue;
      foodbCompounds[name] = { compounds, _source: 'gnn' };
      added++;
    }
    const after = Object.keys(foodbCompounds).filter(k => k !== '_meta').length;
    log(`  Augmented from gnn_compounds.json: ${before} -> ${after} ingredients (+${added})`);
    // With most entries lacking concentration data, fall back to simple Jaccard.
    useJaccard = true;
    compoundSource = compoundSource ? `${compoundSource}+gnn` : 'gnn';
  } else {
    log(`  WARNING: gnn_compounds.json not found at ${GNN_COMPOUNDS_FILE}`);
  }

  const tasteMatrix = readJson(TASTE_COMPAT_FILE);
  if (tasteMatrix) {
    log(`  Loaded taste compatibility matrix`);
  } else {
    log(`  Taste compatibility matrix not available -- using hardcoded fallback`);
  }

  const catDistMatrix = readJson(CAT_DIST_FILE);
  if (catDistMatrix) {
    log(`  Loaded category distance matrix`);
  } else {
    log(`  Category distance matrix not available -- using hardcoded fallback`);
  }

  const categories = readJson(CATEGORIES_FILE) || {};
  log(`  Loaded categories: ${Object.keys(categories).length} entries`);

  // Load blended ingredient metadata for taste/category/cuisine info
  const ingredientsMeta = readJson(path.join(PROCESSED_DIR, '..', 'output', 'ingredients.json')) || {};

  // ─────────── Pre-compute ingredient-level data ───────────

  // Collect all unique pair keys and combined pair counts across all sources
  const allPairKeys = new Set();
  const combinedPairCounts = new Map(); // key -> total count across sources

  for (const data of Object.values(sources)) {
    if (!data.pairs) continue;
    for (const [key, info] of Object.entries(data.pairs)) {
      allPairKeys.add(key);
      combinedPairCounts.set(key, (combinedPairCounts.get(key) || 0) + (info.count || 0));
    }
  }

  log(`  Total unique pair keys across all sources: ${allPairKeys.size}`);

  // Compute degree (number of pairings) per ingredient across all sources
  const degree = new Map();
  for (const key of allPairKeys) {
    const [a, b] = key.split('|');
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  }

  let maxDegree = 0;
  for (const d of degree.values()) {
    if (d > maxDegree) maxDegree = d;
  }
  log(`  Max ingredient degree: ${maxDegree}`);

  // Find max combined pair count for x2_freq normalization
  let maxPairCount = 0;
  for (const c of combinedPairCounts.values()) {
    if (c > maxPairCount) maxPairCount = c;
  }
  log(`  Max combined pair count: ${maxPairCount}`);

  // Helper: get taste string for an ingredient
  function getTaste(name) {
    // Check output ingredients.json first (has inferred tastes from blend step)
    const meta = ingredientsMeta[name];
    if (meta && meta.taste) return meta.taste;
    // Check categories.json
    const cat = categories[name];
    if (cat && !cat._comment && cat.taste) return cat.taste;
    return null;
  }

  // Helper: get category for an ingredient
  function getCategory(name) {
    const meta = ingredientsMeta[name];
    if (meta && meta.category) return meta.category;
    const cat = categories[name];
    if (cat && !cat._comment && cat.category) return cat.category;
    return 'other';
  }

  // Helper: get cuisines array for an ingredient
  function getCuisines(name) {
    const meta = ingredientsMeta[name];
    if (meta && meta.cuisines && meta.cuisines.length > 0) return meta.cuisines;
    return null;
  }

  // ─────────── Compute x4_taste helper ───────────

  function computeTasteCompat(nameA, nameB) {
    const tasteA = getTaste(nameA);
    const tasteB = getTaste(nameB);
    if (!tasteA || !tasteB) return FEATURE_FALLBACKS.x4_taste;

    const tastesA = tasteA.split(/\s+/);
    const tastesB = tasteB.split(/\s+/);

    // Average all pairwise lookups
    let sum = 0;
    let count = 0;
    for (const tA of tastesA) {
      for (const tB of tastesB) {
        sum += lookupTasteCompat(tA, tB, tasteMatrix);
        count++;
      }
    }
    return count > 0 ? sum / count : FEATURE_FALLBACKS.x4_taste;
  }

  // ─────────── Compute x3_chemical helper ───────────

  function computeChemicalOverlap(nameA, nameB) {
    if (!foodbCompounds) return { score: FEATURE_FALLBACKS.x3_chemical, sharedCompounds: [] };

    const compA = foodbCompounds[nameA];
    const compB = foodbCompounds[nameB];
    if (!compA || !compB) return { score: FEATURE_FALLBACKS.x3_chemical, sharedCompounds: [] };

    const compoundsA = compA.compounds || {};
    const compoundsB = compB.compounds || {};

    const keysA = Object.keys(compoundsA);
    const keysB = Object.keys(compoundsB);
    if (keysA.length === 0 || keysB.length === 0) {
      return { score: FEATURE_FALLBACKS.x3_chemical, sharedCompounds: [] };
    }

    // When using built-in DB (no concentration data), use standard Jaccard
    if (useJaccard) {
      const setA = new Set(keysA);
      const setB = new Set(keysB);
      const shared = [];
      let intersection = 0;
      for (const c of setA) {
        if (setB.has(c)) {
          intersection++;
          shared.push(c);
        }
      }
      const union = new Set([...keysA, ...keysB]).size;
      const score = union > 0 ? intersection / union : FEATURE_FALLBACKS.x3_chemical;
      return { score: Math.max(0, Math.min(1, score)), sharedCompounds: shared.slice(0, 5) };
    }

    // Weighted Jaccard using concentration data (FooDB)
    const allCompounds = new Set([...keysA, ...keysB]);

    let numerator = 0;   // sum of min weights in intersection
    let denominator = 0;  // sum of max weights in union
    const shared = [];

    for (const c of allCompounds) {
      const wA = compoundsA[c] ? Math.log2(1 + (compoundsA[c].concentration_mg || 0)) : 0;
      const wB = compoundsB[c] ? Math.log2(1 + (compoundsB[c].concentration_mg || 0)) : 0;
      numerator += Math.min(wA, wB);
      denominator += Math.max(wA, wB);
      if (wA > 0 && wB > 0) {
        shared.push({ name: c, weight: Math.min(wA, wB) });
      }
    }

    const score = denominator > 0 ? numerator / denominator : FEATURE_FALLBACKS.x3_chemical;

    // Top 5 shared compounds by weight
    shared.sort((a, b) => b.weight - a.weight);
    const topShared = shared.slice(0, 5).map(s => s.name);

    return { score: Math.max(0, Math.min(1, score)), sharedCompounds: topShared };
  }

  // ─────────── Compute x8_compound_diversity helper ───────────

  function computeCompoundDiversity(sharedCompounds) {
    if (!foodbCompounds || sharedCompounds.length === 0) {
      return FEATURE_FALLBACKS.x8_compound_diversity;
    }

    // Count how many compound classes are represented
    const classesPresent = new Set();
    for (const compoundName of sharedCompounds) {
      // Check all ingredients' compounds for class info
      for (const ingData of Object.values(foodbCompounds)) {
        if (ingData._meta) continue; // skip metadata key
        const comp = (ingData.compounds || {})[compoundName];
        if (comp && comp.class) {
          const cls = comp.class.toLowerCase();
          for (const knownClass of COMPOUND_CLASSES) {
            if (cls === knownClass || cls.includes(knownClass)) {
              classesPresent.add(knownClass);
            }
          }
        }
      }
    }

    return Math.min(1, classesPresent.size / COMPOUND_CLASSES.length);
  }

  // ─────────── Compute x1_npmi: recompute pure NPMI from raw counts ───────────

  function computeX1(key) {
    // Prefer RecipeNLG as the primary source
    const sourceOrder = ['recipenlg', 'mealdb', 'cocktaildb'];

    for (const sourceName of sourceOrder) {
      const data = sources[sourceName];
      const pair = data.pairs?.[key];
      if (!pair || !pair.count) continue;

      const [a, b] = key.split('|');
      const countA = data.ingredients?.[a];
      const countB = data.ingredients?.[b];
      const total = data.totalRecipes;
      if (!countA || !countB || !total) continue;

      return computeNPMI(pair.count, countA, countB, total);
    }

    return 0;
  }

  // ─────────── Compute features for all pairs ───────────

  const features = {};
  let processed = 0;
  const totalPairs = allPairKeys.size;

  for (const key of allPairKeys) {
    const [a, b] = key.split('|');

    // x1: Pure NPMI
    const x1_npmi = computeX1(key);

    // x2: Normalized frequency
    const combinedCount = combinedPairCounts.get(key) || 0;
    const x2_freq = maxPairCount > 0
      ? Math.log2(combinedCount + 1) / Math.log2(maxPairCount + 1)
      : 0;

    // x3: Chemical compound overlap
    const { score: x3_chemical, sharedCompounds } = computeChemicalOverlap(a, b);

    // x4: Taste compatibility
    const x4_taste = computeTasteCompat(a, b);

    // x5: Category bridge score
    const catA = getCategory(a);
    const catB = getCategory(b);
    const catDist = lookupCategoryDistance(catA, catB, catDistMatrix);
    // Multiply by x1 (NPMI) to only reward validated bridges; if x1 is 0 use x3
    const bridgeMultiplier = x1_npmi > 0 ? x1_npmi : x3_chemical;
    const x5_bridge = catDist * bridgeMultiplier;

    // x6: Cuisine Jaccard overlap
    const cuisinesA = getCuisines(a);
    const cuisinesB = getCuisines(b);
    let x6_cuisine;
    if (cuisinesA && cuisinesB) {
      const setA = new Set(cuisinesA);
      const setB = new Set(cuisinesB);
      const intersection = [...setA].filter(c => setB.has(c)).length;
      const union = new Set([...setA, ...setB]).size;
      x6_cuisine = union > 0 ? intersection / union : FEATURE_FALLBACKS.x6_cuisine;
    } else {
      x6_cuisine = FEATURE_FALLBACKS.x6_cuisine;
    }

    // x7: Hub asymmetry
    const degA = degree.get(a) || 0;
    const degB = degree.get(b) || 0;
    const logMaxDeg = Math.log2(maxDegree + 1);
    const hubA = logMaxDeg > 0 ? Math.log2(degA + 1) / logMaxDeg : 0;
    const hubB = logMaxDeg > 0 ? Math.log2(degB + 1) / logMaxDeg : 0;
    const x7_hub_asymmetry = Math.abs(hubA - hubB);

    // x8: Compound diversity
    const x8_compound_diversity = computeCompoundDiversity(sharedCompounds);

    // Build feature entry
    const entry = {
      x1_npmi:              round6(x1_npmi),
      x2_freq:              round6(x2_freq),
      x3_chemical:          round6(x3_chemical),
      x4_taste:             round6(x4_taste),
      x5_bridge:            round6(x5_bridge),
      x6_cuisine:           round6(x6_cuisine),
      x7_hub_asymmetry:     round6(x7_hub_asymmetry),
      x8_compound_diversity: round6(x8_compound_diversity),
    };

    // Include shared compound names if any exist
    if (sharedCompounds.length > 0) {
      entry.sharedCompounds = sharedCompounds;
    }

    features[key] = entry;

    processed++;
    if (processed % 10000 === 0) {
      log(`  Progress: ${processed} / ${totalPairs} pairs (${Math.round(100 * processed / totalPairs)}%)`);
    }
  }

  log(`  Computed features for ${processed} pairs`);

  // Write output
  const output = {
    generatedAt: new Date().toISOString(),
    totalPairs: processed,
    featureDimensions: 8,
    compoundSource: compoundSource || 'none',
    fallbacksUsed: {
      x3_chemical: !foodbCompounds,
      x3_jaccard: useJaccard,
      x4_taste: !tasteMatrix,
      x6_cuisine: true, // no cuisine arrays currently in data
      x8_compound_diversity: !foodbCompounds,
    },
    pairs: features,
  };

  writeJson(OUTPUT_FILE, output);
  log(`Wrote ${OUTPUT_FILE} (${processed} pairs)`);
  log('Step 6 complete.');
}

function round6(v) {
  return Math.round(v * 1e6) / 1e6;
}

run().catch(err => { console.error(err); process.exit(1); });
