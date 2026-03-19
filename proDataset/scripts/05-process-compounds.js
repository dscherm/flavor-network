import fs from 'fs';
import path from 'path';
import {
  RAW_DIR, PROCESSED_DIR, DATA_DIR, FLAVORDB_BASE, RATE_LIMITS,
} from '../config.js';
import {
  canonicalizeIngredient, pairKey, throttledFetch,
  ensureDir, readJson, writeJson, log,
} from '../utils.js';

const FOODB_DIR = path.join(RAW_DIR, 'foodb');
const FOODB_OUT = path.join(PROCESSED_DIR, 'foodb-compounds.json');
const BUILTIN_DB = path.join(DATA_DIR, 'compound_database.json');

const FLAVORDB2_BASE = 'https://cosylab.iiitd.edu.in/flavordb2';
const FLAVORDB_CACHE_DIR = path.join(RAW_DIR, 'flavordb');
const DELAY = RATE_LIMITS.flavordb;

// ─────────── Source 1: FooDB CSV files ───────────

function tryFooDB() {
  // Look for manually downloaded FooDB CSV files in raw/foodb/
  // Expected files: Content.csv (food_id, source_id, source_type, orig_food_common_name, ...)
  //                 Compound.csv (id, public_id, name, ...)
  //                 CompoundsFlavor.csv or similar linking files

  if (!fs.existsSync(FOODB_DIR)) {
    log('  FooDB directory not found at raw/foodb/ -- skipping FooDB');
    return null;
  }

  const files = fs.readdirSync(FOODB_DIR).filter(f => f.endsWith('.csv'));
  if (files.length === 0) {
    log('  FooDB directory exists but contains no CSV files -- skipping FooDB');
    return null;
  }

  log(`  Found FooDB CSV files: ${files.join(', ')}`);

  // Look for the Content.csv which maps foods to compounds with concentrations
  const contentFile = files.find(f => /content/i.test(f));
  const compoundFile = files.find(f => /compound/i.test(f) && !/content/i.test(f));
  const foodFile = files.find(f => /food/i.test(f));

  if (!contentFile) {
    log('  WARNING: No Content.csv found in FooDB directory -- cannot process');
    log('  Expected files: Content.csv, Compound.csv, Food.csv');
    return null;
  }

  log(`  Processing FooDB Content file: ${contentFile}`);

  // Parse Content.csv line by line (can be large)
  const contentPath = path.join(FOODB_DIR, contentFile);
  const raw = fs.readFileSync(contentPath, 'utf-8');
  const lines = raw.split('\n');

  if (lines.length < 2) {
    log('  WARNING: Content.csv appears empty');
    return null;
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  const foodNameIdx = header.findIndex(h => /orig_food_common_name|food_name|name/i.test(h));
  const compoundNameIdx = header.findIndex(h => /orig_content_name|compound_name|source_name/i.test(h));
  const concentrationIdx = header.findIndex(h => /orig_content|concentration|amount/i.test(h));
  const classIdx = header.findIndex(h => /class|category|group/i.test(h));

  if (foodNameIdx === -1 || compoundNameIdx === -1) {
    log(`  WARNING: Cannot identify food/compound columns in header: ${header.slice(0, 10).join(', ')}`);
    return null;
  }

  log(`  Columns: food=${header[foodNameIdx]}, compound=${header[compoundNameIdx]}, concentration=${concentrationIdx >= 0 ? header[concentrationIdx] : 'N/A'}`);

  const result = {};
  let processed = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const foodName = canonicalizeIngredient(fields[foodNameIdx] || '');
    const compoundName = (fields[compoundNameIdx] || '').trim().toLowerCase();
    if (!foodName || !compoundName) continue;

    const concentration = concentrationIdx >= 0 ? parseFloat(fields[concentrationIdx]) || 0 : 0;
    const compClass = classIdx >= 0 ? (fields[classIdx] || '').trim().toLowerCase() : '';

    if (!result[foodName]) {
      result[foodName] = { compounds: {} };
    }

    // If compound already exists for this food, take max concentration
    const existing = result[foodName].compounds[compoundName];
    if (!existing || concentration > (existing.concentration_mg || 0)) {
      result[foodName].compounds[compoundName] = {
        concentration_mg: concentration,
        class: mapCompoundClass(compClass),
      };
    }

    processed++;
    if (processed % 50000 === 0) log(`  ...processed ${processed} FooDB rows`);
  }

  const ingredientCount = Object.keys(result).length;
  log(`  FooDB: ${ingredientCount} ingredients, ${processed} compound entries`);

  return ingredientCount > 0 ? result : null;
}

// ─────────── Source 2: FlavorDB2 API ───────────

async function tryFlavorDB2() {
  log('  Trying FlavorDB2 API...');

  const endpoints = [
    `${FLAVORDB2_BASE}/entities`,
    `${FLAVORDB2_BASE}/api/entities`,
    `${FLAVORDB_BASE}/entities`,
    `${FLAVORDB_BASE}/api/entities`,
  ];

  let entities = null;
  let workingBase = null;

  // Check cache first
  const cachedEntities = readJson(path.join(FLAVORDB_CACHE_DIR, 'entities.json'));
  if (cachedEntities && cachedEntities.length > 0) {
    log(`  Using cached FlavorDB entity list (${cachedEntities.length} entities)`);
    entities = cachedEntities;
    // We still need to determine the working base for detail fetches
    workingBase = FLAVORDB2_BASE;
  }

  if (!entities) {
    for (const url of endpoints) {
      try {
        log(`  Testing: ${url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          log(`    HTTP ${res.status} -- skipping`);
          continue;
        }

        const text = await res.text();
        log(`    Response: ${text.substring(0, 200)}`);

        try {
          const data = JSON.parse(text);
          entities = Array.isArray(data) ? data : (data.entities || data.data || []);
          if (entities.length > 0) {
            workingBase = url.replace(/\/(api\/)?entities$/, '');
            log(`    Found ${entities.length} entities from ${url}`);
            ensureDir(FLAVORDB_CACHE_DIR);
            writeJson(path.join(FLAVORDB_CACHE_DIR, 'entities.json'), entities);
            break;
          }
        } catch {
          log(`    Response is not valid JSON -- skipping`);
        }
      } catch (err) {
        log(`    Error: ${err.message}`);
      }
    }
  }

  if (!entities || entities.length === 0) {
    log('  FlavorDB/FlavorDB2 API unavailable');
    return null;
  }

  // Fetch entity details and extract compound data
  const result = {};
  let fetched = 0;
  let withCompounds = 0;

  const detailEndpoints = [
    id => `${workingBase}/entity_details?id=${id}`,
    id => `${workingBase}/api/entity_details?id=${id}`,
    id => `${workingBase}/entity/${id}`,
  ];

  for (const entity of entities) {
    const id = entity.entity_id || entity.id;
    if (!id) continue;

    // Check cache
    const cachePath = path.join(FLAVORDB_CACHE_DIR, `entity_${id}.json`);
    let details = readJson(cachePath);

    if (!details) {
      for (const makeUrl of detailEndpoints) {
        try {
          const url = makeUrl(id);
          const res = await throttledFetch(url, DELAY);
          if (res.ok) {
            details = await res.json();
            ensureDir(FLAVORDB_CACHE_DIR);
            writeJson(cachePath, details);
            break;
          }
        } catch {
          // try next endpoint pattern
        }
      }
    }

    fetched++;
    if (fetched % 50 === 0) log(`  ...fetched ${fetched}/${entities.length} entities`);

    if (!details) continue;

    const name = canonicalizeIngredient(
      details.entity_alias_readable || details.entity_alias || details.name || ''
    );
    if (!name) continue;

    const molecules = details.molecules || details.natural_molecules || [];
    if (molecules.length === 0) continue;

    if (!result[name]) {
      result[name] = { compounds: {} };
    }

    for (const mol of molecules) {
      const molName = (mol.common_name || mol.name || mol.iupac_name || '').toLowerCase();
      if (!molName) continue;

      const cls = mapCompoundClass(mol.super_class || mol.class || mol.category || '');

      // FlavorDB does not provide concentration, so use a default
      if (!result[name].compounds[molName]) {
        result[name].compounds[molName] = {
          concentration_mg: 0,
          class: cls,
        };
      }
    }

    withCompounds++;
  }

  log(`  FlavorDB: ${withCompounds} ingredients with compounds from ${fetched} entities`);
  return withCompounds > 0 ? result : null;
}

// ─────────── Source 3: Built-in compound database (Ahn et al. fallback) ───────────

function tryBuiltinDB() {
  log('  Loading built-in compound database (Ahn et al. 2011 + food science literature)...');

  const db = readJson(BUILTIN_DB);
  if (!db || !db.ingredients) {
    log('  WARNING: Built-in compound database not found or invalid');
    return null;
  }

  // Convert from built-in format to foodb-compounds format
  // Built-in has: { ingredients: { name: { compounds: [{ name, class }] } } }
  // foodb-compounds expects: { name: { compounds: { compoundName: { concentration_mg, class } } } }
  const result = {};

  for (const [name, data] of Object.entries(db.ingredients)) {
    result[name] = { compounds: {} };
    for (const comp of data.compounds) {
      result[name].compounds[comp.name] = {
        concentration_mg: 0,  // no concentration data in built-in DB
        class: comp.class,
      };
    }
  }

  const ingredientCount = Object.keys(result).length;
  log(`  Built-in DB: ${ingredientCount} ingredients`);
  return ingredientCount > 0 ? result : null;
}

// ─────────── Class mapping ───────────

const CLASS_MAP = {
  terpene: 'terpene', terpenoid: 'terpene', monoterpene: 'terpene',
  sesquiterpene: 'terpene', monoterpenoid: 'terpene',
  aldehyde: 'aldehyde', ketone: 'aldehyde',
  ester: 'ester',
  pyrazine: 'pyrazine',
  sulfur: 'sulfur', thiol: 'sulfur', sulfide: 'sulfur',
  isothiocyanate: 'sulfur', amine: 'sulfur',
  lactone: 'lactone', phthalide: 'lactone',
  furanone: 'furanone', furan: 'furanone', pyrrole: 'furanone',
  phenol: 'phenol', phenylpropanoid: 'phenol', capsaicinoid: 'phenol',
  organic_acid: 'organic_acid', acid: 'organic_acid',
  alcohol: 'alcohol',
};

function mapCompoundClass(rawClass) {
  if (!rawClass) return '';
  const lower = rawClass.toLowerCase().trim();

  // Direct match
  if (CLASS_MAP[lower]) return CLASS_MAP[lower];

  // Substring match
  for (const [key, val] of Object.entries(CLASS_MAP)) {
    if (lower.includes(key)) return val;
  }

  return lower; // keep original if no mapping found
}

// ─────────── CSV parsing helper ───────────

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ─────────── Main ───────────

async function run() {
  log('Step 5b: Process compound data (FooDB / FlavorDB2 / built-in fallback)');
  ensureDir(PROCESSED_DIR);

  let compounds = null;
  let source = null;

  // Priority 1: FooDB CSV (manually downloaded)
  compounds = tryFooDB();
  if (compounds) {
    source = 'foodb';
    log(`  Using FooDB as compound source`);
  }

  // Priority 2: FlavorDB2 / FlavorDB API
  if (!compounds) {
    try {
      compounds = await tryFlavorDB2();
      if (compounds) {
        source = 'flavordb';
        log(`  Using FlavorDB as compound source`);
      }
    } catch (err) {
      log(`  FlavorDB fetch failed: ${err.message}`);
    }
  }

  // Priority 3: Built-in compound database (Ahn et al.)
  if (!compounds) {
    compounds = tryBuiltinDB();
    if (compounds) {
      source = 'builtin';
      log(`  Using built-in compound database as fallback`);
    }
  }

  // No data at all
  if (!compounds) {
    log('  WARNING: No compound data available from any source');
    log('  To add compound data:');
    log('    1. Download FooDB CSV files to proDataset/raw/foodb/');
    log('    2. Or wait for FlavorDB API to become available');
    writeJson(FOODB_OUT, {});
    log(`  Wrote empty ${FOODB_OUT}`);
    return;
  }

  // Add metadata
  const output = { ...compounds };
  output._meta = {
    source,
    generatedAt: new Date().toISOString(),
    ingredientCount: Object.keys(compounds).length - (compounds._meta ? 1 : 0),
  };

  writeJson(FOODB_OUT, output);
  log(`Wrote ${FOODB_OUT} (${output._meta.ingredientCount} ingredients, source: ${source})`);
  log('Step 5b complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
