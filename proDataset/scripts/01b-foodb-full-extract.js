/**
 * 01b-foodb-full-extract.js — replace the 78-ingredient foodb-compounds.json
 * with a ~1000-ingredient extract derived from the full FooDB 2020-04-07 dump.
 *
 * Source layout (gitignored, must be present locally):
 *   chemDataset/raw/foodb/foodb_2020_04_07_csv/
 *     Food.csv             1,343 rows
 *     Compound.csv         85,594 rows
 *     Flavor.csv           ~250 rows
 *     CompoundsFlavor.csv  flavor-descriptor joins
 *     Content.csv          5,145,532 rows of food-compound-concentration
 *
 * Output:
 *   proDataset/processed/foodb-compounds.json  (same schema as before)
 *     { _meta: {...},
 *       ingredient_name: {
 *         compounds: {
 *           compoundName: { concentration_mg: number, class: string|null }
 *         }
 *       }
 *     }
 *   proDataset/processed/foodb-flavors.json    (new sibling)
 *     { compoundName: [flavor descriptors] }
 *
 * Coverage target: foodb-compounds.json grows from 78 -> ~987 ingredients,
 * each averaging ~5,000 compound rows in the raw data (Jaccard-meaningful).
 * Replaces the legacy extract that was the root cause of 99.45% of pairs
 * having x3_chemical at the fallback constant.
 *
 * Run: node proDataset/scripts/01b-foodb-full-extract.js
 */
import { createReadStream } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { PROCESSED_DIR, ROOT } from '../config.js';
import { canonicalizeIngredient, log } from '../utils.js';

const FOODB_DIR = path.resolve(ROOT, '..', 'chemDataset', 'raw', 'foodb', 'foodb_2020_04_07_csv');
const OUT_COMPOUNDS_PATH = path.join(PROCESSED_DIR, 'foodb-compounds.json');
const OUT_FLAVORS_PATH = path.join(PROCESSED_DIR, 'foodb-flavors.json');

// FooDB uses scientific/long-form names; the app uses culinary short
// names from RecipeNLG. Pre-canonicalize via this alias map so the
// extract lands under the same keys downstream pipelines expect.
// Multiple FooDB entries can fold into one app name (cherry tomato +
// garden tomato -> tomato); we keep MAX concentration per compound
// across the merged set.
const FOODB_TO_APP_ALIASES = new Map([
  ['garden tomato', 'tomato'],
  ['cherry tomato', 'tomato'],
  ['garden onion', 'onion'],
  ['welsh onion', 'onion'],
  ['spring onion', 'onion'],
  ['shallot', 'shallot'],
  ['common bean', 'bean'],
  ['domestic pig', 'pork'],
  ['domestic cattle', 'beef'],
  ['cattle', 'beef'],
  ['chicken', 'chicken'],
  ['lemon grass', 'lemongrass'],
  ['lime', 'lime'],
  ['common thyme', 'thyme'],
  ['common sage', 'sage'],
  ['common cabbage', 'cabbage'],
  ['savoy cabbage', 'cabbage'],
  ['chinese cabbage', 'cabbage'],
  ['ginger root', 'ginger'],
  ['arabica coffee', 'coffee'],
  ['robusta coffee', 'coffee'],
  ['black tea', 'tea'],
  ['green tea', 'tea'],
  ['oolong tea', 'tea'],
  ['cow milk', 'milk'],
  ['goat milk', 'milk'],
  ['sheep milk', 'milk'],
  ['black mustard', 'mustard'],
  ['white mustard', 'mustard'],
  ['domestic apple', 'apple'],
  ['european pear', 'pear'],
  ['asian pear', 'pear'],
  ['common grape', 'grape'],
  ['european plum', 'plum'],
  ['japanese plum', 'plum'],
  ['white potato', 'potato'],
  ['sweet potato', 'sweet potato'],
  ['white bread', 'bread'],
  ['wholewheat bread', 'bread'],
  ['rye bread', 'bread'],
  ['common pea', 'pea'],
  ['green bell pepper', 'bell pepper'],
  ['red bell pepper', 'bell pepper'],
  ['yellow bell pepper', 'bell pepper'],
  ['common pumpkin', 'pumpkin'],
  ['common buckwheat', 'buckwheat'],
  ['common walnut', 'walnut'],
  ['black walnut', 'walnut'],
  ['hazelnut', 'hazelnut'],
  ['common cucumber', 'cucumber'],
  ['common chickpea', 'chickpea'],
  ['common oregano', 'oregano'],
  ['common bean', 'bean'],
  ['common turnip', 'turnip'],
  ['celery stalks', 'celery'],
  ['carrot', 'carrot'],
  ['common verbena', 'verbena'],
  ['common cherimoya', 'cherimoya'],
  ['allium', 'onion'],
  ['asparagu', 'asparagus'],  // canonicalize singularizes incorrectly
]);

function applyAlias(name) {
  return FOODB_TO_APP_ALIASES.get(name) || name;
}

// ─────────── Streaming CSV parser (RFC 4180–ish) ───────────
//
// FooDB CSVs include multi-line quoted descriptions, so readline alone
// would split rows mid-record. This is a tiny character-level state
// machine that respects double-quote escaping and quoted newlines.
async function* parseCsv(filePath) {
  const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 256 * 1024 });
  let field = '';
  let row = [];
  let inQuotes = false;
  let header = null;

  function emitRow() {
    if (!header) {
      header = row;
    } else if (row.length === header.length) {
      const obj = {};
      for (let j = 0; j < header.length; j++) obj[header[j]] = row[j];
      yieldRow = obj;
    } else {
      // length mismatch — likely embedded quote glitch in source data; skip
      yieldRow = null;
    }
    row = [];
  }

  let yieldRow = null;

  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQuotes) {
        if (c === '"') {
          if (chunk[i + 1] === '"') { field += '"'; i++; continue; }
          inQuotes = false;
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push(field);
          field = '';
        } else if (c === '\n') {
          row.push(field); field = '';
          emitRow();
          if (yieldRow) { yield yieldRow; yieldRow = null; }
        } else if (c === '\r') {
          /* skip */
        } else {
          field += c;
        }
      }
    }
  }
  // final field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    emitRow();
    if (yieldRow) yield yieldRow;
  }
}

// ─────────── Main ───────────

async function run() {
  log('Step 1b: Full FooDB CSV → foodb-compounds.json');

  if (!fs.existsSync(FOODB_DIR)) {
    throw new Error(`FooDB dump not found at ${FOODB_DIR}. Extract foodb_2020_04_07_csv.tar.gz first.`);
  }

  // ─── Load Food.csv (1343 rows) ───
  log('  Reading Food.csv...');
  const foodById = new Map();
  for await (const row of parseCsv(path.join(FOODB_DIR, 'Food.csv'))) {
    const id = row.id;
    if (!id) continue;
    const rawName = row.name || '';
    const canonical = applyAlias(canonicalizeIngredient(rawName));
    if (!canonical) continue;
    foodById.set(id, {
      name: canonical,
      raw_name: rawName,
      food_group: row.food_group || null,
      food_subgroup: row.food_subgroup || null,
      category: row.category || null,
    });
  }
  log(`  Indexed ${foodById.size} foods`);

  // ─── Load Compound.csv (85k rows) ───
  log('  Reading Compound.csv...');
  const compoundById = new Map();
  for await (const row of parseCsv(path.join(FOODB_DIR, 'Compound.csv'))) {
    if (!row.id || !row.name) continue;
    compoundById.set(row.id, {
      name: row.name,
      moldb_smiles: row.moldb_smiles || null,
      moldb_inchikey: row.moldb_inchikey || null,
    });
  }
  log(`  Indexed ${compoundById.size} compounds`);

  // ─── Load Flavor.csv (small) ───
  log('  Reading Flavor.csv...');
  const flavorById = new Map();
  for await (const row of parseCsv(path.join(FOODB_DIR, 'Flavor.csv'))) {
    if (!row.id) continue;
    flavorById.set(row.id, row.name || '');
  }
  log(`  Indexed ${flavorById.size} flavor descriptors`);

  // ─── Load CompoundsFlavor.csv → compound → [flavor names] ───
  log('  Reading CompoundsFlavor.csv...');
  const compoundFlavors = new Map();
  for await (const row of parseCsv(path.join(FOODB_DIR, 'CompoundsFlavor.csv'))) {
    if (!row.compound_id || !row.flavor_id) continue;
    const flavorName = flavorById.get(row.flavor_id);
    if (!flavorName) continue;
    if (!compoundFlavors.has(row.compound_id)) compoundFlavors.set(row.compound_id, new Set());
    compoundFlavors.get(row.compound_id).add(flavorName);
  }
  log(`  Indexed flavors for ${compoundFlavors.size} compounds`);

  // ─── Stream Content.csv (5.1M rows) → build per-food compound map ───
  log('  Streaming Content.csv (this is the big one — ~5.1M rows)...');
  // ingredient_name → { compoundName → { concentration_mg, class } }
  const out = {};
  let contentRows = 0;
  let kept = 0;
  let droppedNonCompound = 0;
  let droppedUnknownFood = 0;
  let droppedUnknownCompound = 0;
  let droppedEmptyContent = 0;

  for await (const row of parseCsv(path.join(FOODB_DIR, 'Content.csv'))) {
    contentRows++;
    if (contentRows % 500000 === 0) log(`    ...${contentRows} rows processed, ${kept} kept`);
    if (row.source_type !== 'Compound') { droppedNonCompound++; continue; }
    const food = foodById.get(row.food_id);
    if (!food) { droppedUnknownFood++; continue; }
    const compound = compoundById.get(row.source_id);
    if (!compound) { droppedUnknownCompound++; continue; }
    const stdContent = parseFloat(row.standard_content);
    if (!isFinite(stdContent) || stdContent <= 0) { droppedEmptyContent++; continue; }

    const ingName = food.name;
    if (!out[ingName]) out[ingName] = { compounds: {} };
    const existing = out[ingName].compounds[compound.name];
    // Take MAX concentration across multiple source-rows for same (food, compound)
    if (!existing || stdContent > existing.concentration_mg) {
      const flavors = compoundFlavors.get(row.source_id);
      const klass = flavors && flavors.size > 0 ? [...flavors][0] : null;
      out[ingName].compounds[compound.name] = {
        concentration_mg: stdContent,
        class: klass,
        smiles: compound.moldb_smiles || null,
      };
    }
    kept++;
  }
  log(`  Content.csv processed: ${contentRows} rows, ${kept} kept`);
  log(`    dropped: non-Compound=${droppedNonCompound}, unknown-food=${droppedUnknownFood}, unknown-compound=${droppedUnknownCompound}, empty-content=${droppedEmptyContent}`);

  const ingredientCount = Object.keys(out).length;
  const totalCompoundRows = Object.values(out).reduce((s, v) => s + Object.keys(v.compounds).length, 0);
  const avgCompoundsPerIngredient = ingredientCount > 0 ? Math.round(totalCompoundRows / ingredientCount) : 0;
  log(`  Built compound dict: ${ingredientCount} ingredients, avg ${avgCompoundsPerIngredient} compounds each`);

  // ─── Write foodb-compounds.json ───
  out._meta = {
    source: 'foodb-full-2020-04-07',
    generatedAt: new Date().toISOString(),
    ingredientCount,
    totalCompoundRows,
    avgCompoundsPerIngredient,
    note: 'Replaces the legacy 78-ingredient extract. concentration_mg is MAX over multiple Content rows per (food,compound). class is the first flavor descriptor from CompoundsFlavor.csv when available.',
  };
  fs.writeFileSync(OUT_COMPOUNDS_PATH, JSON.stringify(out));
  log(`  Wrote ${OUT_COMPOUNDS_PATH}`);

  // ─── Write foodb-flavors.json (compound → flavors) ───
  const flavorsOut = { _meta: { source: 'foodb-full-2020-04-07', generatedAt: new Date().toISOString() } };
  for (const [compId, flavors] of compoundFlavors) {
    const compound = compoundById.get(compId);
    if (!compound) continue;
    flavorsOut[compound.name] = [...flavors];
  }
  fs.writeFileSync(OUT_FLAVORS_PATH, JSON.stringify(flavorsOut));
  log(`  Wrote ${OUT_FLAVORS_PATH} (${Object.keys(flavorsOut).length - 1} compounds with flavor descriptors)`);

  log('Step 1b complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
