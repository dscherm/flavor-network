/**
 * 16-merge-cuisine-additions.js
 *
 * Curated batch merge of new cuisine-defining ingredients into the
 * shipped ingredients.json + cuisine_map.json. Reads
 * `proDataset/data/cuisine_additions.json` (hand-curated from the
 * scripts/15-discover-cuisine-defining-ingredients.js output) and
 * writes the updated artifacts to BOTH proDataset/output/ and
 * public/proDataset/ (the served path).
 *
 * Operates in two modes:
 *   --dry-run (default): prints what would change without writing.
 *   --apply:             writes the merged ingredients.json + the
 *                        new cuisine_map.json entries.
 *
 * What this script does NOT do (intentional separation of concerns):
 *   - Compute embeddings / 3D positions / cluster assignments. New
 *     ingredients get embedding = null. Re-run the GNN pipeline +
 *     07-blend-v2 to fill them in.
 *   - Recompute pairings.json. New ingredients get no chemistry
 *     pairings until 07-blend-v2 reaggregates with the expanded
 *     ingredient set.
 *   - Recompute cuisine_pairings.json. Re-run 14-build-cuisine-
 *     pairings.js so the new ingredients appear in cuisine pairs.
 *
 * Suggested full sequence after running this script with --apply:
 *   1. node scripts/07-blend-v2.js      # rebuilds pairings.json
 *   2. node scripts/14-build-cuisine-pairings.js  # cuisine evidence
 *   3. cp output/*.json ../public/proDataset/     # publish
 *   4. (optional) re-train GNN to assign clusters + embeddings
 */
import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR, DATA_DIR } from '../config.js';
import { ensureDir, writeJson, log } from '../utils.js';

const ADDITIONS_PATH = path.join(DATA_DIR, 'cuisine_additions.json');
const INGREDIENTS_PATH = path.join(OUTPUT_DIR, 'ingredients.json');
const CUISINE_MAP_PATH = path.resolve(OUTPUT_DIR, '..', '..', 'public', 'data', 'cuisine_map.json');

// Map our cuisine bucket labels to the lowercase keys used in cuisine_map.json.
// useProData expands the value to "<key> cuisine" before applying.
const CUISINE_TO_MAPKEY = {
  'Africa': 'african',
  'Italy': 'italian',
  'Spain': 'spanish',
  'France': 'french',
  'Greece': 'greek',
  'British Isles': 'british',
  'DACH Countries': 'german',
  'Eastern Europe': 'eastern european',
  'Scandinavia': 'scandinavian',
  'USA': 'american',
  'Canada': 'canadian',
  'Mexico': 'mexican',
  'Caribbean': 'caribbean',
  'South America': 'south american',
  'Indian Subcontinent': 'indian',
  'China': 'chinese',
  'Japan': 'japanese',
  'Korea': 'korean',
  'Thailand': 'thai',
  'South East Asia': 'southeast asian',
  'Middle East': 'middle eastern',
  'Australia & NZ': 'australian',
};

const VALID_CATEGORIES = new Set([
  'aromatic','fat','dairy','protein','umami','citrus','acid','herb','spice',
  'seasoning','chili','sweetener','nut','grain','liquid','thickener','mixer',
  'spirit','liqueur','bitters','vegetable','fruit','other',
]);
const VALID_TASTES = new Set([
  'sweet','sour','bitter','salty','umami','spicy','pungent','astringent',
]);

function loadIngredients() {
  const data = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf8'));
  return data;
}

function loadCuisineMap() {
  if (!fs.existsSync(CUISINE_MAP_PATH)) return {};
  return JSON.parse(fs.readFileSync(CUISINE_MAP_PATH, 'utf8'));
}

function loadAdditions() {
  const raw = JSON.parse(fs.readFileSync(ADDITIONS_PATH, 'utf8'));
  return raw.additions || {};
}

function main() {
  const isApply = process.argv.includes('--apply');
  const isDry = !isApply;
  log(`=== 16: merge cuisine additions (${isApply ? 'APPLY' : 'DRY-RUN'}) ===`);

  const ingredients = loadIngredients();
  const cuisineMap = loadCuisineMap();
  const additions = loadAdditions();

  let added = 0;
  let skippedExisting = 0;
  let skippedInvalid = 0;
  const auditLines = [];

  for (const [name, entry] of Object.entries(additions)) {
    if (ingredients[name]) {
      skippedExisting++;
      auditLines.push(`  EXISTS: ${name.padEnd(28)} (skipping — already in graph)`);
      continue;
    }

    // Validate
    if (!VALID_CATEGORIES.has(entry.category)) {
      skippedInvalid++;
      auditLines.push(`  INVALID category="${entry.category}" for ${name}`);
      continue;
    }
    if (!VALID_TASTES.has(entry.taste)) {
      skippedInvalid++;
      auditLines.push(`  INVALID taste="${entry.taste}" for ${name}`);
      continue;
    }
    const mapKey = CUISINE_TO_MAPKEY[entry.cuisine];
    if (!mapKey) {
      skippedInvalid++;
      auditLines.push(`  INVALID cuisine="${entry.cuisine}" for ${name}`);
      continue;
    }

    // Build ingredient entry (embeddings/cluster left null — re-derive later).
    const totalCount = entry.evidence?.totalCount ?? 50;
    ingredients[name] = {
      category: entry.category,
      taste: entry.taste,
      sources: ['manual-cuisine-additions', '15-discover'],
      totalCount,
      embedding: null,
      embeddingFull: null,
      cluster: null,
      clusterLabel: null,
      bridgingScore: null,
      cuisines: [mapKey],
    };

    // Cuisine_map.json uses just the bare cuisine token; useProData
    // appends " cuisine" downstream. The existing entries use simple
    // lowercase tokens like "italian", "french" — match that.
    if (!cuisineMap[name]) cuisineMap[name] = [];
    if (!cuisineMap[name].includes(mapKey)) {
      cuisineMap[name].push(mapKey);
    }

    added++;
    auditLines.push(`  ADD:    ${name.padEnd(28)} ${entry.category.padEnd(10)} ${entry.taste.padEnd(8)} ${entry.cuisine}`);
  }

  log(`\nAdditions: ${added}`);
  log(`Skipped (already exists): ${skippedExisting}`);
  log(`Skipped (invalid): ${skippedInvalid}`);
  log('\nDetails:');
  for (const line of auditLines) log(line);

  if (isDry) {
    log('\n(dry-run — pass --apply to write changes)');
    log(`Would write: ${INGREDIENTS_PATH}`);
    log(`Would write: ${CUISINE_MAP_PATH}`);
    return;
  }

  ensureDir(OUTPUT_DIR);
  writeJson(INGREDIENTS_PATH, ingredients);
  log(`Wrote ${INGREDIENTS_PATH}`);

  // public/proDataset/ingredients.json is the served path; mirror.
  const publicIngredients = path.resolve(OUTPUT_DIR, '..', '..', 'public', 'proDataset', 'ingredients.json');
  fs.copyFileSync(INGREDIENTS_PATH, publicIngredients);
  log(`Mirrored to ${publicIngredients}`);

  writeJson(CUISINE_MAP_PATH, cuisineMap);
  log(`Wrote ${CUISINE_MAP_PATH}`);

  log(`\n✓ Merged ${added} additions. Next: re-run 07-blend-v2 + 14-build-cuisine-pairings to populate pairings for the new ingredients.`);
}

main();
