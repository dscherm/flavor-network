// FlavorDB scraper for cosylab.iiitd.edu.in/flavordb2.
//
// Endpoint: GET /flavordb2/entities_json?id=<entity_id>
//   200 → full entity JSON with nested `molecules` array (pubchem_id, smile,
//         flavor_profile, taste, odor, functional_groups, cas_id, ...).
//   404 → entity id does not exist (holes in the 1..~980 range — skip).
//
// Strategy: linear scan ids 1..MAX_ID with aggressive skip on 404. Cache each
// raw response to raw/flavordb/entity_<id>.json so re-runs are idempotent and
// can resume after interruption. After scan, aggregate into
// processed/flavordb.json with the schema:
//   { entities:  { <entity_alias>: {id, category, molecules: [<pubchem_id>]} },
//     molecules: { <pubchem_id>:   {name, smiles, flavor_profile: [<tag>], taste,
//                                    odor, functional_groups: [<group>], cas_id} },
//     _fetched_at, _source_count }
//
// Rate limit: 1 req/sec. Only hit the network when the raw cache is absent.

import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  RAW, PROCESSED, ensureDir, writeJson, readJson, sleep, fetchText,
} from './common.js';

const MAX_ID = 1000;
const RATE_MS = 1000;
const RAW_DIR = path.join(RAW, 'flavordb');

async function fetchEntity(id) {
  const cachePath = path.join(RAW_DIR, `entity_${id}.json`);
  try {
    return { cached: true, data: await readJson(cachePath) };
  } catch { /* fall through to network */ }

  let text;
  try {
    text = await fetchText(
      `https://cosylab.iiitd.edu.in/flavordb2/entities_json?id=${id}`,
      { retries: 3, delayMs: 1500 },
    );
  } catch (err) {
    if (String(err.message).includes('HTTP 404')) {
      await writeJson(cachePath, { _missing: true, id });
      return { cached: false, data: { _missing: true, id } };
    }
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    await writeJson(cachePath, { _missing: true, id, _parse_error: true });
    return { cached: false, data: { _missing: true, id } };
  }

  await writeJson(cachePath, data);
  return { cached: false, data };
}

function splitGroups(s) {
  if (!s || typeof s !== 'string') return [];
  return s.split('@').map(x => x.trim()).filter(Boolean);
}

function splitFlavor(s) {
  if (!s || typeof s !== 'string') return [];
  return s.split(/[,@]/).map(x => x.trim().toLowerCase()).filter(Boolean);
}

async function main() {
  await ensureDir(RAW_DIR);
  await ensureDir(PROCESSED);

  const entities = {};
  const molecules = {};
  let hits = 0, misses = 0, networkCalls = 0;

  for (let id = 1; id <= MAX_ID; id++) {
    const before = networkCalls;
    const { cached, data } = await fetchEntity(id);
    if (!cached) networkCalls++;

    if (data._missing) {
      misses++;
    } else {
      hits++;
      const key = data.entity_alias || `entity_${id}`;
      const molIds = [];
      for (const m of data.molecules || []) {
        const pid = m.pubchem_id;
        if (pid == null) continue;
        molIds.push(pid);
        if (!molecules[pid]) {
          molecules[pid] = {
            name: m.common_name || m.iupac_name || null,
            smiles: m.smile || null,
            flavor_profile: splitFlavor(m.flavor_profile || m.fooddb_flavor_profile),
            taste: m.taste || null,
            odor: m.odor || null,
            functional_groups: splitGroups(m.functional_groups),
            cas_id: m.cas_id || null,
          };
        }
      }
      entities[key] = {
        id: data.entity_id,
        category: data.category_readable || data.category || null,
        natural_source: data.natural_source_name || null,
        molecules: molIds,
      };
    }

    if (id % 25 === 0) {
      console.log(`[flavordb] id=${id}  hits=${hits} misses=${misses} molecules=${Object.keys(molecules).length}`);
    }
    if (networkCalls !== before) await sleep(RATE_MS);
  }

  const out = {
    entities,
    molecules,
    _fetched_at: new Date().toISOString(),
    _source_count: { entities: Object.keys(entities).length, molecules: Object.keys(molecules).length },
  };
  await writeJson(path.join(PROCESSED, 'flavordb.json'), out);
  console.log(`[flavordb] done: ${hits} entities, ${Object.keys(molecules).length} molecules, ${misses} missing ids`);
}

main().catch(err => { console.error(err); process.exit(1); });
