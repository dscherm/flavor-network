import fs from 'fs';
import path from 'path';
import {
  RAW_DIR, PROCESSED_DIR, FLAVORDB_BASE, RATE_LIMITS,
} from '../config.js';
import {
  canonicalizeIngredient, pairKey, throttledFetch,
  ensureDir, readJson, writeJson, log,
} from '../utils.js';

const CACHE_DIR = path.join(RAW_DIR, 'flavordb');
const ENTITIES_PATH = path.join(CACHE_DIR, 'entities.json');
const OUT_PATH = path.join(PROCESSED_DIR, 'flavordb-overlap.json');
const DELAY = RATE_LIMITS.flavordb;

async function fetchEntities() {
  ensureDir(CACHE_DIR);

  const cached = readJson(ENTITIES_PATH);
  if (cached) {
    log(`Using cached entity list (${cached.length} entities)`);
    return cached;
  }

  log('Fetching FlavorDB entity list...');
  try {
    const res = await throttledFetch(`${FLAVORDB_BASE}/entities`, DELAY);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entities = Array.isArray(data) ? data : (data.entities || []);
    writeJson(ENTITIES_PATH, entities);
    log(`Fetched ${entities.length} entities`);
    return entities;
  } catch (err) {
    log(`WARNING: Could not fetch entity list: ${err.message}`);
    return [];
  }
}

async function fetchEntityDetails(entity) {
  const id = entity.entity_id || entity.id;
  if (!id) return null;

  const cachePath = path.join(CACHE_DIR, `entity_${id}.json`);
  const cached = readJson(cachePath);
  if (cached) return cached;

  try {
    const res = await throttledFetch(`${FLAVORDB_BASE}/entity_details?id=${id}`, DELAY);
    if (!res.ok) {
      log(`  WARNING: HTTP ${res.status} for entity ${id}`);
      return null;
    }
    const data = await res.json();
    writeJson(cachePath, data);
    return data;
  } catch (err) {
    log(`  WARNING: Failed to fetch entity ${id}: ${err.message}`);
    return null;
  }
}

async function run() {
  log('Step 2: Fetch FlavorDB molecule data');

  let entities;
  try {
    entities = await fetchEntities();
  } catch (err) {
    log(`WARNING: FlavorDB API unavailable: ${err.message}`);
    log('Writing empty processed file.');
    ensureDir(PROCESSED_DIR);
    writeJson(OUT_PATH, { pairs: {}, ingredients: {} });
    return;
  }

  if (!entities || entities.length === 0) {
    log('WARNING: No entities available from FlavorDB. Writing empty output.');
    ensureDir(PROCESSED_DIR);
    writeJson(OUT_PATH, { pairs: {}, ingredients: {} });
    return;
  }

  // Fetch molecule details for each entity
  const ingredientMolecules = new Map(); // canonical name → Set<molecule_id>
  let fetched = 0;

  for (const entity of entities) {
    const details = await fetchEntityDetails(entity);
    fetched++;
    if (fetched % 50 === 0) log(`  ...fetched ${fetched}/${entities.length} entities`);

    if (!details) continue;

    const name = canonicalizeIngredient(
      details.entity_alias_readable || details.entity_alias || details.name || ''
    );
    if (!name) continue;

    const molecules = new Set();
    const molList = details.molecules || details.natural_molecules || [];
    for (const mol of molList) {
      const molId = mol.pubchem_id || mol.molecule_id || mol.id;
      if (molId) molecules.add(String(molId));
    }

    if (molecules.size === 0) continue;

    // Merge if ingredient already exists (multiple FlavorDB entities → same canonical)
    if (ingredientMolecules.has(name)) {
      const existing = ingredientMolecules.get(name);
      for (const m of molecules) existing.add(m);
    } else {
      ingredientMolecules.set(name, molecules);
    }
  }

  log(`Ingredients with molecule data: ${ingredientMolecules.size}`);

  // Compute pairwise Szymkiewicz–Simpson overlap
  const names = [...ingredientMolecules.keys()];
  const pairs = {};
  let pairCountTotal = 0;

  for (let i = 0; i < names.length; i++) {
    const setA = ingredientMolecules.get(names[i]);
    for (let j = i + 1; j < names.length; j++) {
      const setB = ingredientMolecules.get(names[j]);

      // Intersection count
      let intersection = 0;
      const smaller = setA.size <= setB.size ? setA : setB;
      const larger = setA.size <= setB.size ? setB : setA;
      for (const m of smaller) {
        if (larger.has(m)) intersection++;
      }

      if (intersection === 0) continue;

      const minSize = Math.min(setA.size, setB.size);
      const overlap = intersection / minSize; // naturally [0,1]

      const key = pairKey(names[i], names[j]);
      pairs[key] = {
        overlap: Math.round(overlap * 1e6) / 1e6,
        sharedCount: intersection,
        minSize,
      };
      pairCountTotal++;
    }
  }

  log(`FlavorDB pairs computed: ${pairCountTotal}`);

  // Build ingredients output
  const ingredients = {};
  for (const [name, molSet] of ingredientMolecules) {
    ingredients[name] = molSet.size;
  }

  ensureDir(PROCESSED_DIR);
  writeJson(OUT_PATH, { pairs, ingredients });
  log(`Wrote ${OUT_PATH}`);
  log('Step 2 complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
