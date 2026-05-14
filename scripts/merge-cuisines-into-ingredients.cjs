#!/usr/bin/env node
/**
 * merge-cuisines-into-ingredients — fold CulinaryDB cuisine tags into
 * public/proDataset/ingredients.json's currently-empty cuisines[] field.
 *
 * Reads:
 *   proDataset/processed/culinarydb-cuisines.json  (594 ingredients × 26 cuisines)
 *   public/proDataset/ingredients.json             (3913 ingredients, cuisines:[] empty)
 *
 * Writes back to public/proDataset/ingredients.json in place. The
 * 24 cuisines from CulinaryDB are lower-cased and trimmed to match the
 * app's filter-pill bucket conventions (already-defined in
 * src/data/categoricalAxes.js).
 *
 * Name alignment between CulinaryDB and the app uses a fuzzy chain:
 *   1. direct name match
 *   2. CulinaryDB-name → app-name alias map (e.g. soybean sauce → soy sauce)
 *   3. canonicalized substring match (lemon -> lemon juice / lemon zest etc)
 *
 * The audit's chemDataset/validation/lib/axes.js crossCuisine reads
 * ingredients.json's cuisines[] directly, so once this script lands the
 * cross-cuisine axis_pairs count should jump from 0.
 *
 * Run: node scripts/merge-cuisines-into-ingredients.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ING_PATH = path.join(REPO, 'public', 'proDataset', 'ingredients.json');
const CUISINES_PATH = path.join(REPO, 'proDataset', 'processed', 'culinarydb-cuisines.json');
const TOP_N = 6;          // surface up to 6 cuisines per ingredient
const MIN_RECIPES = 3;    // require ≥3 recipes in a cuisine to count

// CulinaryDB → app-name aliases. Add as we find new ones.
const CULINARYDB_TO_APP = {
  'soybean sauce': 'soy sauce',
  'soybean': 'soy bean',
  'kiwifruit': 'kiwi',
  'bittergourd': 'bitter gourd',
  'bottlegourd': 'bottle gourd',
  'ashgourd': 'ash gourd',
  'asparagu': 'asparagus',
  'corn grit': 'cornmeal',
  'cluster bean': 'green bean',
  'wheaten bread': 'bread',
};

function main() {
  const ingredients = JSON.parse(fs.readFileSync(ING_PATH, 'utf-8'));
  const cuisines = JSON.parse(fs.readFileSync(CUISINES_PATH, 'utf-8'));

  // Build app-name → cuisine entry index, applying aliases.
  const cuisineByApp = new Map();
  for (const [cName, entry] of Object.entries(cuisines)) {
    if (cName === '_meta') continue;
    const appName = CULINARYDB_TO_APP[cName] || cName;
    if (!cuisineByApp.has(appName)) cuisineByApp.set(appName, entry);
  }

  // Substring fallback: when an app ingredient has no direct hit, look
  // for a culinarydb name whose normalized form is contained.
  function fallbackLookup(appName) {
    if (cuisineByApp.has(appName)) return cuisineByApp.get(appName);
    // Try stripping trailing common suffixes
    const stripped = appName.replace(/\s+(juice|zest|peel|leaf|leaves|powder|seed|seeds|root|paste)$/, '');
    if (stripped !== appName && cuisineByApp.has(stripped)) return cuisineByApp.get(stripped);
    return null;
  }

  let directHits = 0;
  let fallbackHits = 0;
  let totalMembershipsWritten = 0;
  let appIngredientsTouched = 0;

  for (const [appName, info] of Object.entries(ingredients)) {
    const entry = fallbackLookup(appName);
    if (!entry) continue;
    if (cuisineByApp.has(appName)) directHits++;
    else fallbackHits++;

    // Pick top-N cuisines that pass MIN_RECIPES and lowercase for the app.
    const sorted = Object.entries(entry.byRegion || {})
      .filter(([, n]) => n >= MIN_RECIPES)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([c]) => c.toLowerCase());
    if (sorted.length === 0) continue;
    info.cuisines = sorted;
    appIngredientsTouched++;
    totalMembershipsWritten += sorted.length;
  }

  fs.writeFileSync(ING_PATH, JSON.stringify(ingredients));
  console.log(`Direct CulinaryDB→app hits:           ${directHits}`);
  console.log(`Fallback substring hits:              ${fallbackHits}`);
  console.log(`App ingredients receiving cuisines:   ${appIngredientsTouched}`);
  console.log(`Total cuisine memberships written:    ${totalMembershipsWritten}`);
  console.log(`Wrote ${ING_PATH}`);
}

main();
