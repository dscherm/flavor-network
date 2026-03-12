/**
 * Data integrity test — verifies that cuisine-ingredient associations
 * in the app match the raw source data (flavor_bible_full.csv).
 *
 * Run: node tests/data-integrity.test.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.log(`  FAIL: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Parse the raw source CSV
// ---------------------------------------------------------------------------

function parseFlavorBibleCSV() {
  const text = fs.readFileSync(path.join(dataDir, 'flavor_bible_full.csv'), 'utf-8');
  const rows = [];
  let first = true;
  for (const line of text.split('\n')) {
    if (first) { first = false; continue; } // skip header
    const trimmed = line.trim();
    if (!trimmed) continue;

    let col1, col2;
    if (trimmed.startsWith('"')) {
      const closingQuote = trimmed.indexOf('"', 1);
      if (closingQuote === -1) continue;
      col1 = trimmed.slice(1, closingQuote);
      col2 = trimmed.slice(closingQuote + 2).replace(/^"|"$/g, '').trim();
    } else {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) continue;
      col1 = trimmed.slice(0, commaIdx);
      col2 = trimmed.slice(commaIdx + 1).replace(/^"|"$/g, '').trim();
    }
    rows.push([col1, col2]);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 2. Parse cuisines.csv (the intermediate file the app uses)
// ---------------------------------------------------------------------------

function parseCuisinesCSV() {
  const text = fs.readFileSync(path.join(dataDir, 'cuisines.csv'), 'utf-8');
  const rows = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let col1, col2;
    if (trimmed.startsWith('"')) {
      const closingQuote = trimmed.indexOf('"', 1);
      if (closingQuote === -1) continue;
      col1 = trimmed.slice(1, closingQuote);
      col2 = trimmed.slice(closingQuote + 2).replace(/^"|"$/g, '').trim();
    } else {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) continue;
      col1 = trimmed.slice(0, commaIdx);
      col2 = trimmed.slice(commaIdx + 1).replace(/^"|"$/g, '').trim();
    }
    rows.push([col1.toLowerCase(), col2.toLowerCase()]);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 3. Parse ingredients.csv to get known ingredient names
// ---------------------------------------------------------------------------

function parseIngredientsCSV() {
  const text = fs.readFileSync(path.join(dataDir, 'ingredients.csv'), 'utf-8');
  const ingredients = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let col1, col2;
    if (trimmed.startsWith('"')) {
      const closingQuote = trimmed.indexOf('"', 1);
      if (closingQuote === -1) continue;
      col1 = trimmed.slice(1, closingQuote);
      col2 = trimmed.slice(closingQuote + 2).replace(/^"|"$/g, '').trim();
    } else {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) continue;
      col1 = trimmed.slice(0, commaIdx);
      col2 = trimmed.slice(commaIdx + 1).replace(/^"|"$/g, '').trim();
    }
    ingredients.add(col1.toLowerCase().trim());
    ingredients.add(col2.toLowerCase().trim());
  }
  return ingredients;
}

// ---------------------------------------------------------------------------
// 4. Replicate the app's loadCuisines + buildIngredientCuisineMap logic
// ---------------------------------------------------------------------------

function buildCuisineMap(cuisineRows) {
  const cuisines = new Map();
  for (const [col1, col2] of cuisineRows) {
    let cuisine, ingredient;
    if (col1.includes('cuisine')) {
      cuisine = col1;
      ingredient = col2;
    } else if (col2.includes('cuisine')) {
      cuisine = col2;
      ingredient = col1;
    } else {
      cuisine = col1;
      ingredient = col2;
    }
    if (!cuisines.has(cuisine)) cuisines.set(cuisine, new Set());
    cuisines.get(cuisine).add(ingredient);
  }
  return cuisines;
}

function buildIngredientCuisineMap(cuisineMap, knownIngredients) {
  const nameIndex = new Map();
  for (const name of knownIngredients) {
    nameIndex.set(name, name);
    const commaIdx = name.indexOf(',');
    if (commaIdx > 0) {
      const base = name.slice(0, commaIdx).trim();
      if (!nameIndex.has(base)) nameIndex.set(base, name);
    }
  }
  // Common spelling variants
  const variants = [['crawfish', 'crayfish']];
  for (const [a, b] of variants) {
    if (!nameIndex.has(a) && nameIndex.has(b)) nameIndex.set(a, nameIndex.get(b));
    if (!nameIndex.has(b) && nameIndex.has(a)) nameIndex.set(b, nameIndex.get(a));
  }

  function resolveName(ing) {
    if (nameIndex.has(ing)) return [nameIndex.get(ing)];
    if (ing.includes(':')) {
      const parts = ing.split(':');
      const base = parts[0].trim();
      const values = parts[1].split(',').map(s => s.trim());
      const resolved = [];
      for (const val of values) {
        const combined = `${base}, ${val}`;
        if (nameIndex.has(combined)) resolved.push(nameIndex.get(combined));
        else if (nameIndex.has(val)) resolved.push(nameIndex.get(val));
      }
      return resolved.length > 0 ? resolved : null;
    }
    return null;
  }

  const map = new Map();
  for (const [cuisine, ingredients] of cuisineMap) {
    for (const ing of ingredients) {
      const resolved = resolveName(ing);
      if (!resolved) continue;
      for (const name of resolved) {
        if (!map.has(name)) map.set(name, []);
        if (!map.get(name).includes(cuisine)) map.get(name).push(cuisine);
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// 5. Extract ground truth from raw CSV
// ---------------------------------------------------------------------------

function getExpectedCuisineIngredients(rawRows) {
  // TRIM_STRING_FLAGS from parsing script
  const trimFlags = ['see also', 'e.g.', 'i.e.', 'esp.', '(say some)', '(key indgredient)'];
  function stripExtra(str, flag) {
    const idx = str.indexOf(flag);
    let result = str.slice(0, idx - 1);
    for (const c of ':, *') {
      while (result.startsWith(c) || result.endsWith(c)) {
        result = result.replace(new RegExp(`^[${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]|[${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]$`, 'g'), '');
      }
    }
    return result.trim();
  }

  const cuisineIngredients = new Map(); // cuisine → Set<ingredient>
  const metadata = ['season:', 'taste:', 'botanical relatives:', 'function:', 'weight:', 'volume:', 'tips:', 'techniques:'];
  const seasons = ['summer', 'winter', 'autumn', 'spring'];

  for (let [main, pairing] of rawRows) {
    main = main.toLowerCase();
    pairing = pairing.toLowerCase();

    // Strip extra info
    for (const flag of trimFlags) {
      if (main.includes(flag)) main = stripExtra(main, flag);
      if (pairing.includes(flag)) pairing = stripExtra(pairing, flag);
    }

    // Skip seasons
    if (seasons.includes(main)) continue;

    // Only process cuisine rows
    if (main.includes('cuisine') || pairing.includes('cuisine')) {
      // Skip metadata, flavor affinities, and affinity combos
      if (metadata.some(m => pairing.includes(m))) continue;
      if (pairing === 'flavor affinities') continue;
      if (pairing.includes('+')) continue;

      let cuisine, ingredient;
      if (main.includes('cuisine')) {
        cuisine = main;
        ingredient = pairing;
      } else {
        cuisine = pairing;
        ingredient = main;
      }

      if (!cuisineIngredients.has(cuisine)) cuisineIngredients.set(cuisine, new Set());
      cuisineIngredients.get(cuisine).add(ingredient);
    }
  }

  return cuisineIngredients;
}

// ---------------------------------------------------------------------------
// Run tests
// ---------------------------------------------------------------------------

console.log('\n=== Data Integrity Tests ===\n');

const rawRows = parseFlavorBibleCSV();
const cuisineRows = parseCuisinesCSV();
const knownIngredients = parseIngredientsCSV();
const expectedCuisines = getExpectedCuisineIngredients(rawRows);
const appCuisineMap = buildCuisineMap(cuisineRows);
const ingredientCuisineMap = buildIngredientCuisineMap(appCuisineMap, knownIngredients);

// Test 1: loadCuisines correctly identifies cuisine vs ingredient in both directions
console.log('--- Test: Reverse-direction cuisine rows ---');
{
  // These ingredients appear as "INGREDIENT","Xyzzy cuisine" in the raw CSV
  // The app's loadCuisines must handle them correctly
  const reverseDirectionTests = [
    { ingredient: 'garlic', cuisine: 'creole cuisine' },
    { ingredient: 'crayfish', cuisine: 'creole cuisine' },
    { ingredient: 'shrimp', cuisine: 'creole cuisine' },
    { ingredient: 'okra', cuisine: 'creole cuisine' },
    { ingredient: 'oysters', cuisine: 'creole cuisine' },
  ];

  for (const { ingredient, cuisine } of reverseDirectionTests) {
    const cuisineSet = appCuisineMap.get(cuisine);
    const has = cuisineSet && cuisineSet.has(ingredient);
    assert(has, `"${cuisine}" should include "${ingredient}" (reverse-direction row)`);
  }
}

// Test 2: Name resolution — multi-value and variant names
console.log('\n--- Test: Name resolution (multi-value and variants) ---');
{
  const resolvedCuisines = ingredientCuisineMap.get('crayfish');
  assert(
    resolvedCuisines && resolvedCuisines.includes('creole cuisine'),
    '"crayfish" should be associated with "creole cuisine" (variant of "crawfish")'
  );

  const pepperBlack = ingredientCuisineMap.get('pepper, black');
  assert(
    pepperBlack && pepperBlack.includes('creole cuisine'),
    '"pepper, black" should be associated with "creole cuisine" (from "pepper: black, white")'
  );

  const pepperWhite = ingredientCuisineMap.get('pepper, white');
  assert(
    pepperWhite && pepperWhite.includes('creole cuisine'),
    '"pepper, white" should be associated with "creole cuisine" (from "pepper: black, white")'
  );

  const cayenneGround = ingredientCuisineMap.get('cayenne, ground');
  assert(
    cayenneGround && cayenneGround.includes('creole cuisine'),
    '"cayenne, ground" should be associated with "creole cuisine" (base name match "cayenne")'
  );
}

// Test 3: Comprehensive cuisine-ingredient counts
console.log('\n--- Test: Cuisine ingredient counts match raw CSV ---');
{
  // For each cuisine in the raw data, count how many of its ingredients
  // actually resolve to graph nodes
  const testCuisines = ['creole cuisine', 'cuban cuisine', 'english cuisine', 'french cuisine', 'italian cuisine', 'japanese cuisine', 'indian cuisine', 'chinese cuisine', 'mexican cuisine', 'thai cuisine'];

  for (const cuisineName of testCuisines) {
    const expected = expectedCuisines.get(cuisineName);
    if (!expected) continue;

    const appIngredients = appCuisineMap.get(cuisineName);
    if (!appIngredients) {
      assert(false, `"${cuisineName}" should exist in app cuisine map`);
      continue;
    }

    // Count how many expected ingredients are captured (either exact or resolved)
    const expectedList = [...expected];
    const appList = [...appIngredients];

    // All raw CSV ingredients should appear in cuisines.csv (parsing correctness)
    let missingFromCuisinesCsv = 0;
    for (const ing of expectedList) {
      if (!appList.includes(ing)) {
        missingFromCuisinesCsv++;
        console.log(`    WARNING: "${cuisineName}" raw ingredient "${ing}" missing from cuisines.csv`);
      }
    }

    assert(
      appList.length >= expectedList.length,
      `"${cuisineName}": app has ${appList.length} ingredients, raw CSV has ${expectedList.length}`
    );

    // Count how many resolve to actual graph nodes
    let resolvedCount = 0;
    const unresolvedIngredients = [];
    for (const ing of appList) {
      // Check if this ingredient directly or via resolution exists as a node
      if (knownIngredients.has(ing)) {
        resolvedCount++;
      } else {
        // Check name resolution
        const commaIdx = ing.indexOf(',');
        const base = commaIdx > 0 ? ing.slice(0, commaIdx).trim() : null;
        const hasBase = base && [...knownIngredients].some(n => n.startsWith(base));
        if (hasBase) {
          resolvedCount++;
        } else if (ing.includes(':')) {
          resolvedCount++; // multi-value, will be resolved
        } else {
          unresolvedIngredients.push(ing);
        }
      }
    }

    if (unresolvedIngredients.length > 0) {
      console.log(`    INFO: "${cuisineName}" — ${unresolvedIngredients.length} ingredients don't exist as graph nodes: ${unresolvedIngredients.join(', ')}`);
    }
  }
}

// Test 4: Spot-check specific ingredients' cuisine associations
console.log('\n--- Test: Specific ingredient cuisine associations ---');
{
  const spotChecks = [
    { ingredient: 'garlic', shouldInclude: ['creole cuisine'] },
    { ingredient: 'okra', shouldInclude: ['creole cuisine'] },
    { ingredient: 'onions', shouldInclude: ['creole cuisine'] },
    { ingredient: 'paprika', shouldInclude: ['creole cuisine'] },
    { ingredient: 'seafood', shouldInclude: ['creole cuisine'] },
  ];

  for (const { ingredient, shouldInclude } of spotChecks) {
    const cuisines = ingredientCuisineMap.get(ingredient);
    for (const cuisine of shouldInclude) {
      assert(
        cuisines && cuisines.includes(cuisine),
        `"${ingredient}" should be associated with "${cuisine}"`
      );
    }
  }
}

// Test 5: No cuisine names should appear as graph nodes
console.log('\n--- Test: Cuisines are not graph nodes ---');
{
  for (const cuisineName of expectedCuisines.keys()) {
    assert(
      !knownIngredients.has(cuisineName),
      `"${cuisineName}" should NOT be a graph node (it's a cuisine, not an ingredient)`
    );
  }
}

// Test 6: English cuisine (user's first check)
console.log('\n--- Test: English cuisine ingredients ---');
{
  const expected = expectedCuisines.get('english cuisine');
  if (expected) {
    console.log(`  Raw CSV has ${expected.size} English cuisine ingredients: ${[...expected].join(', ')}`);
    const appSet = appCuisineMap.get('english cuisine');
    assert(
      appSet && appSet.size === expected.size,
      `English cuisine: app should have ${expected.size} ingredients, has ${appSet ? appSet.size : 0}`
    );
  }
}

// Test 7: Cuban cuisine (user's second check)
console.log('\n--- Test: Cuban cuisine ingredients ---');
{
  const expected = expectedCuisines.get('cuban cuisine');
  if (expected) {
    console.log(`  Raw CSV has ${expected.size} Cuban cuisine ingredients: ${[...expected].join(', ')}`);
    const appSet = appCuisineMap.get('cuban cuisine');
    assert(
      appSet && appSet.size === expected.size,
      `Cuban cuisine: app should have ${expected.size} ingredients, has ${appSet ? appSet.size : 0}`
    );
  }
}

// Test 8: Creole cuisine (the discrepancy the user found)
console.log('\n--- Test: Creole cuisine ingredients ---');
{
  const expected = expectedCuisines.get('creole cuisine');
  if (expected) {
    console.log(`  Raw CSV has ${expected.size} Creole cuisine ingredients: ${[...expected].join(', ')}`);
    const appSet = appCuisineMap.get('creole cuisine');
    console.log(`  App cuisines.csv has ${appSet ? appSet.size : 0} Creole cuisine ingredients: ${appSet ? [...appSet].join(', ') : 'none'}`);

    // Count resolved to nodes
    let resolvedCount = 0;
    const resolved = [];
    const unresolved = [];
    if (appSet) {
      for (const ing of appSet) {
        const cuisines = ingredientCuisineMap.get(ing);
        if (cuisines && cuisines.includes('creole cuisine')) {
          resolvedCount++;
          resolved.push(ing);
        } else {
          // Check if it resolves through name normalization
          let found = false;
          for (const [name, cuises] of ingredientCuisineMap) {
            if (cuises.includes('creole cuisine')) {
              // Already counted
            }
          }
          if (!found) unresolved.push(ing);
        }
      }
    }

    // Also count ingredients that got resolved TO from other names
    const allCreoleIngredients = [];
    for (const [name, cuisines] of ingredientCuisineMap) {
      if (cuisines.includes('creole cuisine')) {
        allCreoleIngredients.push(name);
      }
    }
    console.log(`  App resolves ${allCreoleIngredients.length} Creole ingredients to graph nodes: ${allCreoleIngredients.join(', ')}`);

    assert(
      appSet && appSet.size >= expected.size,
      `Creole cuisine: app should have >= ${expected.size} raw ingredients, has ${appSet ? appSet.size : 0}`
    );
  }
}

// ---------------------------------------------------------------------------
// TASTE TESTS
// ---------------------------------------------------------------------------

// Parse ingredient_metadata.csv for taste values
function parseMetadataCSV() {
  const text = fs.readFileSync(path.join(dataDir, 'ingredient_metadata.csv'), 'utf-8');
  const metadata = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let col1, col2;
    if (trimmed.startsWith('"')) {
      const closingQuote = trimmed.indexOf('"', 1);
      if (closingQuote === -1) continue;
      col1 = trimmed.slice(1, closingQuote);
      col2 = trimmed.slice(closingQuote + 2).replace(/^"|"$/g, '').trim();
    } else {
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx === -1) continue;
      col1 = trimmed.slice(0, commaIdx);
      col2 = trimmed.slice(commaIdx + 1).replace(/^"|"$/g, '').trim();
    }

    const name = col1.toLowerCase().trim();
    const lower = col2.toLowerCase();
    if (lower.startsWith('taste:')) {
      metadata.set(name, col2.slice(6).trim().toLowerCase());
    }
  }
  return metadata;
}

// Extract tastes from raw CSV
function getRawTastes() {
  const tastes = new Map();
  const trimFlags = ['see also', 'e.g.', 'i.e.', 'esp.', '(say some)', '(key indgredient)'];
  function stripExtra(str, flag) {
    const idx = str.indexOf(flag);
    let result = str.slice(0, idx - 1);
    for (const c of ':, *') {
      while (result.startsWith(c) || result.endsWith(c)) {
        result = result.replace(new RegExp(`^[${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]|[${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]$`, 'g'), '');
      }
    }
    return result.trim();
  }

  for (let [main, pairing] of rawRows) {
    main = main.toLowerCase();
    pairing = pairing.toLowerCase();
    for (const flag of trimFlags) {
      if (main.includes(flag)) main = stripExtra(main, flag);
      if (pairing.includes(flag)) pairing = stripExtra(pairing, flag);
    }
    if (pairing.startsWith('taste:')) {
      tastes.set(main, pairing.slice(6).trim());
    }
  }
  return tastes;
}

const metadataTastes = parseMetadataCSV();
const rawTastes = getRawTastes();

// Taste aliases (matching the app's TASTE_ALIASES)
function tasteMatches(nodeTaste, filterKey) {
  if (!nodeTaste || !filterKey) return false;
  const tasteLower = nodeTaste.toLowerCase();
  const aliases = { spicy: ['spicy', 'hot'], hot: ['spicy', 'hot'] };
  const keys = aliases[filterKey.toLowerCase()];
  if (keys) return keys.some(k => tasteLower.includes(k));
  return tasteLower.includes(filterKey.toLowerCase());
}

// Test 9: Every Legend filter category matches at least 1 ingredient
console.log('\n--- Test: Legend taste categories each match ingredients ---');
{
  const legendCategories = ['sweet', 'sour', 'bitter', 'salty', 'spicy', 'pungent'];

  for (const cat of legendCategories) {
    let count = 0;
    for (const [name, taste] of metadataTastes) {
      if (tasteMatches(taste, cat)) count++;
    }
    assert(count > 0, `Legend category "${cat}" should match at least 1 ingredient (matches ${count})`);
    console.log(`    "${cat}" matches ${count} ingredients`);
  }
}

// Test 10: "Spicy / Hot" filter matches both "spicy" and "hot" ingredients
console.log('\n--- Test: Spicy filter matches hot ingredients ---');
{
  let hotCount = 0;
  let spicyCount = 0;
  let combinedCount = 0;
  for (const [name, taste] of metadataTastes) {
    if (taste.includes('hot')) hotCount++;
    if (taste.includes('spicy')) spicyCount++;
    if (tasteMatches(taste, 'spicy')) combinedCount++;
  }
  console.log(`    "hot" only: ${hotCount}, "spicy" only: ${spicyCount}, combined with alias: ${combinedCount}`);
  assert(combinedCount >= hotCount, `"spicy" filter should match all ${hotCount} "hot" ingredients`);
  assert(combinedCount >= spicyCount, `"spicy" filter should match all ${spicyCount} "spicy" ingredients`);
}

// Test 11: Raw CSV tastes match ingredient_metadata.csv tastes
console.log('\n--- Test: Raw CSV tastes present in metadata ---');
{
  let matched = 0;
  let missing = 0;
  const missingIngredients = [];

  for (const [name, rawTaste] of rawTastes) {
    if (metadataTastes.has(name)) {
      matched++;
    } else {
      // Check if it's a name normalization issue (see also suffix)
      const baseName = name.replace(/\s*\(.*\)$/, '').trim();
      if (metadataTastes.has(baseName)) {
        matched++;
      } else if (knownIngredients.has(name) || knownIngredients.has(baseName)) {
        missing++;
        missingIngredients.push(name);
      }
      // If ingredient doesn't exist as a node, skip — it's expected
    }
  }
  console.log(`    ${matched} ingredients matched, ${missing} graph-node ingredients missing taste`);
  if (missingIngredients.length > 0) {
    console.log(`    Missing: ${missingIngredients.join(', ')}`);
  }
  assert(missing <= 5, `At most 5 graph-node ingredients should be missing tastes (found ${missing})`);
}

// Test 12: No taste category has zero representation in the data
console.log('\n--- Test: All NodeMesh taste color keys match ingredients ---');
{
  const nodeMeshKeys = ['pungent', 'astringent', 'salty', 'sour', 'bitter', 'hot', 'spicy', 'sweet'];
  for (const key of nodeMeshKeys) {
    let count = 0;
    for (const [, taste] of metadataTastes) {
      if (taste.includes(key)) count++;
    }
    assert(count > 0, `NodeMesh taste "${key}" should match at least 1 ingredient (matches ${count})`);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n=== Results ===');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
