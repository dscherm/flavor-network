/**
 * 12-fetch-culinarydb.js — ingest CulinaryDB cuisine tags per ingredient.
 *
 * Source: C:/Users/scher/Downloads/CulinaryDB/  (user-downloaded CSV bundle
 * from https://cosylab.iiitd.edu.in/culinarydb/)
 *   01_Recipe_Details.csv          45,772 rows  (recipe_id, title, source, cuisine)
 *   02_Ingredients.csv             930 rows     (aliased name, synonyms, entity id, category)
 *   04_Recipe-Ingredients_Aliases  456,279 rows (recipe_id, original name, aliased name, entity id)
 *
 * Output:
 *   proDataset/processed/culinarydb-cuisines.json
 *     { _meta: {...},
 *       ingredient_name: { cuisines: string[], recipeCount: number, byRegion: { region: count } }
 *     }
 *
 * Why: the shipped public/proDataset/ingredients.json has cuisines:[] empty
 * for all 3,913 ingredients. chemDataset/validation/lib/axes.js crossCuisine
 * classifier returns 0 axis pairs because there's no cuisine signal. This
 * script supplies the cuisine signal from 45k recipes already tagged at
 * "Indian Subcontinent" / "Italian" / "Mexican" granularity.
 *
 * The merge step writes a sidecar file. The app already reads from
 * public/proDataset/ingredients.json; a follow-up merge step will fold
 * the cuisines back in.
 *
 * Run: node proDataset/scripts/12-fetch-culinarydb.js
 */
import { createReadStream } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { PROCESSED_DIR } from '../config.js';
import { canonicalizeIngredient, log } from '../utils.js';

const CULINARYDB_DIR = 'C:/Users/scher/Downloads/CulinaryDB';
const OUT_PATH = path.join(PROCESSED_DIR, 'culinarydb-cuisines.json');

// Reuse the same RFC4180-aware streaming CSV parser as 01b.
async function* parseCsv(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 256 * 1024 });
  let field = '';
  let row = [];
  let inQuotes = false;
  let header = null;
  let yieldRow = null;
  function emitRow() {
    if (!header) { header = row; }
    else if (row.length === header.length) {
      const obj = {};
      for (let j = 0; j < header.length; j++) obj[header[j]] = row[j];
      yieldRow = obj;
    } else { yieldRow = null; }
    row = [];
  }
  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQuotes) {
        if (c === '"') {
          if (chunk[i + 1] === '"') { field += '"'; i++; continue; }
          inQuotes = false;
        } else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); field = ''; emitRow(); if (yieldRow) { yield yieldRow; yieldRow = null; } }
        else if (c === '\r') { /* skip */ }
        else { field += c; }
      }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); emitRow(); if (yieldRow) yield yieldRow; }
}

async function run() {
  log('Step 12: Ingest CulinaryDB cuisine tags');

  if (!fs.existsSync(CULINARYDB_DIR)) {
    throw new Error(`CulinaryDB CSV bundle not found at ${CULINARYDB_DIR}.`);
  }

  // ─── 01_Recipe_Details.csv → recipe_id -> cuisine ───
  log('  Reading 01_Recipe_Details.csv...');
  const recipeToCuisine = new Map();
  for await (const row of parseCsv(path.join(CULINARYDB_DIR, '01_Recipe_Details.csv'))) {
    if (!row['Recipe ID']) continue;
    const cuisine = (row['Cuisine'] || '').trim();
    if (!cuisine) continue;
    recipeToCuisine.set(row['Recipe ID'], cuisine);
  }
  log(`  Indexed ${recipeToCuisine.size} recipes with cuisine tags`);

  // ─── 02_Ingredients.csv → entity_id -> aliased name ───
  log('  Reading 02_Ingredients.csv...');
  const entityToName = new Map();
  for await (const row of parseCsv(path.join(CULINARYDB_DIR, '02_Ingredients.csv'))) {
    const eid = row['Entity ID'];
    const name = row['Aliased Ingredient Name'];
    if (!eid || !name) continue;
    entityToName.set(eid, canonicalizeIngredient(name));
  }
  log(`  Indexed ${entityToName.size} CulinaryDB ingredient entities`);

  // ─── 04_Recipe-Ingredients_Aliases.csv → for each (recipe_id, entity_id)
  //     accumulate the recipe's cuisine into the ingredient's cuisine set ───
  log('  Streaming 04_Recipe-Ingredients_Aliases.csv (456k rows)...');
  // canonical ingredient name -> { cuisines: Set, recipeCount, byRegion: Map }
  const out = new Map();
  let rows = 0;
  let kept = 0;
  for await (const row of parseCsv(path.join(CULINARYDB_DIR, '04_Recipe-Ingredients_Aliases.csv'))) {
    rows++;
    if (rows % 100000 === 0) log(`    ...${rows} rows processed`);
    const rid = row['Recipe ID'];
    const eid = row['Entity ID'];
    if (!rid || !eid) continue;
    const cuisine = recipeToCuisine.get(rid);
    const name = entityToName.get(eid);
    if (!cuisine || !name) continue;

    if (!out.has(name)) out.set(name, { cuisines: new Set(), recipeCount: 0, byRegion: new Map() });
    const e = out.get(name);
    e.cuisines.add(cuisine);
    e.recipeCount++;
    e.byRegion.set(cuisine, (e.byRegion.get(cuisine) || 0) + 1);
    kept++;
  }
  log(`  Processed ${rows} rows, kept ${kept}, accumulated ${out.size} ingredients`);

  // ─── Convert + write ───
  const outJson = {
    _meta: {
      source: 'culinarydb-2018',
      generatedAt: new Date().toISOString(),
      recipeCount: recipeToCuisine.size,
      ingredientCount: out.size,
    },
  };
  for (const [name, e] of out) {
    // sort cuisines by frequency descending, drop singletons (likely noise)
    const sorted = [...e.byRegion.entries()].sort((a, b) => b[1] - a[1]);
    const minPasses = sorted[0]?.[1] >= 5 ? 2 : 1;  // require 2+ recipes if the top has 5+, else accept all
    const filtered = sorted.filter(([, n]) => n >= minPasses).map(([c]) => c);
    outJson[name] = {
      cuisines: filtered,
      recipeCount: e.recipeCount,
      byRegion: Object.fromEntries(sorted),
    };
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(outJson));
  log(`  Wrote ${OUT_PATH} (${Object.keys(outJson).length - 1} ingredients with cuisines)`);
  log('Step 12 complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
