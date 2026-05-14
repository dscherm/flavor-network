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
const OUT_PATH = path.join(PROCESSED_DIR, 'flavordb-overlap.json');
const COMPOUNDS_OUT_PATH = path.join(PROCESSED_DIR, 'flavordb-compounds.json');
const DELAY = RATE_LIMITS.flavordb;

// FlavorDB2 deprecated the /entities listing endpoint. Entities are now
// addressed by integer id [0, ~999] via /entities_json?id=N. We enumerate
// the range and stop when we hit a 404 run longer than EARLY_STOP_404S.
const ID_RANGE_START = 0;
const ID_RANGE_MAX = 1200;
const EARLY_STOP_404S = 40;

async function fetchEntityJson(id) {
  const cachePath = path.join(CACHE_DIR, `entity_${id}.json`);
  const cached = readJson(cachePath);
  if (cached) return cached;

  const url = `${FLAVORDB_BASE}/entities_json?id=${id}`;
  try {
    const res = await throttledFetch(url, DELAY);
    if (res.status === 404) return { _notFound: true };
    if (!res.ok) {
      log(`  WARNING: HTTP ${res.status} for id=${id}`);
      return null;
    }
    const data = await res.json();
    writeJson(cachePath, data);
    return data;
  } catch (err) {
    log(`  WARNING: Failed to fetch id=${id}: ${err.message}`);
    return null;
  }
}

async function run() {
  log('Step 2: Fetch FlavorDB2 entity data (entities_json?id=N)');
  ensureDir(CACHE_DIR);

  // canonical ingredient name -> Set<pubchem_id as string>
  const ingredientMolecules = new Map();
  // canonical ingredient name -> Map<compoundName, { pubchem_id, class }>
  const ingredientCompounds = new Map();
  let fetched = 0;
  let consecutive404s = 0;
  let stoppedEarly = false;

  for (let id = ID_RANGE_START; id <= ID_RANGE_MAX; id++) {
    const details = await fetchEntityJson(id);
    fetched++;
    if (fetched % 50 === 0) log(`  ...probed ${fetched} ids, ingredients=${ingredientMolecules.size}`);

    if (!details) continue;
    if (details._notFound) {
      consecutive404s++;
      if (consecutive404s >= EARLY_STOP_404S) {
        log(`  Early stop: ${consecutive404s} consecutive 404s at id=${id}`);
        stoppedEarly = true;
        break;
      }
      continue;
    }
    consecutive404s = 0;

    const rawName = details.entity_alias_readable
      || details.entity_alias
      || details.category_readable
      || details.category
      || '';
    const name = canonicalizeIngredient(rawName);
    if (!name) continue;

    const molecules = new Set();
    const molList = details.molecules || details.natural_molecules || [];
    // Per-compound rich dict consumed by 06-compute-features.js
    const compoundMap = ingredientCompounds.get(name) || new Map();
    for (const mol of molList) {
      const molId = mol.pubchem_id || mol.molecule_id || mol.id;
      if (molId) molecules.add(String(molId));
      const compoundName = mol.common_name || mol.iupac_name;
      if (!compoundName) continue;
      const cls = (mol.fema_flavor_profile || mol.odor || '')
        .toString()
        .split(/[,;]/)[0]
        .trim()
        .toLowerCase() || null;
      // Last-write-wins on duplicate compound names across entities
      compoundMap.set(compoundName, {
        pubchem_id: molId ? String(molId) : null,
        class: cls,
        smiles: mol.smile || null,
      });
    }
    if (molecules.size === 0) continue;
    ingredientCompounds.set(name, compoundMap);

    if (ingredientMolecules.has(name)) {
      const existing = ingredientMolecules.get(name);
      for (const m of molecules) existing.add(m);
    } else {
      ingredientMolecules.set(name, molecules);
    }
  }

  log(`Probed ${fetched} ids${stoppedEarly ? ' (early stop)' : ''}; ingredients with molecule data: ${ingredientMolecules.size}`);

  // Compute pairwise Szymkiewicz–Simpson overlap (same as original script)
  const names = [...ingredientMolecules.keys()];
  const pairs = {};
  let pairCountTotal = 0;

  for (let i = 0; i < names.length; i++) {
    const setA = ingredientMolecules.get(names[i]);
    for (let j = i + 1; j < names.length; j++) {
      const setB = ingredientMolecules.get(names[j]);

      let intersection = 0;
      const smaller = setA.size <= setB.size ? setA : setB;
      const larger  = setA.size <= setB.size ? setB : setA;
      for (const m of smaller) {
        if (larger.has(m)) intersection++;
      }
      if (intersection === 0) continue;

      const minSize = Math.min(setA.size, setB.size);
      const overlap = intersection / minSize;

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

  const ingredients = {};
  for (const [name, molSet] of ingredientMolecules) {
    ingredients[name] = molSet.size;
  }

  ensureDir(PROCESSED_DIR);
  writeJson(OUT_PATH, {
    pairs,
    ingredients,
    _meta: {
      source: 'flavordb2',
      base: FLAVORDB_BASE,
      probedIds: fetched,
      stoppedEarly,
      generatedAt: new Date().toISOString(),
    },
  });
  log(`Wrote ${OUT_PATH}`);

  // Per-ingredient compound dict in the same shape as foodb-compounds.json
  // so 06-compute-features.js can merge it transparently.
  const compoundsOut = {
    _meta: {
      source: 'flavordb2',
      base: FLAVORDB_BASE,
      generatedAt: new Date().toISOString(),
    },
  };
  for (const [name, cmap] of ingredientCompounds) {
    if (cmap.size === 0) continue;
    const compounds = {};
    for (const [cName, info] of cmap) {
      compounds[cName] = {
        concentration_mg: 0,
        class: info.class,
        pubchem_id: info.pubchem_id,
        smiles: info.smiles,
      };
    }
    compoundsOut[name] = { compounds };
  }
  writeJson(COMPOUNDS_OUT_PATH, compoundsOut);
  log(`Wrote ${COMPOUNDS_OUT_PATH} (${Object.keys(compoundsOut).length - 1} ingredients)`);
  log('Step 2 complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
