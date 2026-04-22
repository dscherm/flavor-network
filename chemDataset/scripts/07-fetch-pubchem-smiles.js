// PubChem CAS → SMILES batch fetcher.
//
// Reads every processed/*.json file that has compounds keyed by CAS but no
// SMILES (FlavorNet being the primary example, but the script tolerates other
// CAS-only sources in the future). Queries PubChem REST:
//
//   https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/<CAS>/property/CanonicalSMILES,InChIKey/JSON
//
// PubChem recommends <=5 req/sec per IP and supports CAS lookup via the `name`
// path (CAS RNs are registered aliases). Cache every response to
// raw/pubchem/cas_<CAS>.json so re-runs are idempotent.
//
// Output: processed/pubchem_smiles.json with shape:
//   { cas: { <cas>: {smiles, inchikey, cid} }, _fetched_at }
//
// The build_compounds.py join step reads this map and enriches FlavorNet rows.
//
// Run: node scripts/07-fetch-pubchem-smiles.js   (or  npm run pubchem-smiles )

import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  RAW, PROCESSED, ensureDir, writeJson, readJson, sleep,
} from './common.js';

const RAW_DIR = path.join(RAW, 'pubchem');
const RATE_MS = 220; // ~4.5 req/sec
const SOURCES_WITH_CAS_ONLY = ['flavornet']; // extend as new CAS-only sources land

async function readSource(name) {
  const p = path.join(PROCESSED, `${name}.json`);
  try {
    return await readJson(p);
  } catch {
    return null;
  }
}

async function fetchOne(cas) {
  const cachePath = path.join(RAW_DIR, `cas_${encodeURIComponent(cas)}.json`);
  try {
    return { cached: true, data: await readJson(cachePath) };
  } catch { /* fall through */ }

  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cas)}/property/CanonicalSMILES,InChIKey/JSON`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    return { cached: false, data: { _error: String(err.message) } };
  }
  if (res.status === 404) {
    const missing = { _missing: true, cas };
    await writeJson(cachePath, missing);
    return { cached: false, data: missing };
  }
  if (!res.ok) {
    return { cached: false, data: { _error: `HTTP ${res.status}` } };
  }
  let json;
  try {
    json = await res.json();
  } catch (err) {
    return { cached: false, data: { _error: `parse: ${err.message}` } };
  }
  const props = json?.PropertyTable?.Properties?.[0] || null;
  const row = props ? {
    cas,
    cid: props.CID || null,
    smiles: props.CanonicalSMILES || null,
    inchikey: props.InChIKey || null,
  } : { _missing: true, cas };
  await writeJson(cachePath, row);
  return { cached: false, data: row };
}

async function main() {
  await ensureDir(RAW_DIR);
  const casSet = new Set();
  for (const src of SOURCES_WITH_CAS_ONLY) {
    const data = await readSource(src);
    if (!data) {
      console.warn(`[pubchem] source ${src}.json not found — run that scraper first`);
      continue;
    }
    const compounds = data.compounds || {};
    for (const key of Object.keys(compounds)) {
      const entry = compounds[key];
      const cas = entry.cas || (/^\d+-\d+-\d+$/.test(key) ? key : null);
      if (cas) casSet.add(cas);
    }
  }
  const casList = [...casSet];
  console.log(`[pubchem] resolving ${casList.length} CAS numbers`);

  const out = {};
  let networkCount = 0;
  for (let i = 0; i < casList.length; i++) {
    const cas = casList[i];
    const { cached, data } = await fetchOne(cas);
    if (!data._missing && !data._error) {
      out[cas] = data;
    }
    if (!cached) {
      networkCount++;
      await sleep(RATE_MS);
    }
    if ((i + 1) % 50 === 0) {
      console.log(`[pubchem] ${i + 1}/${casList.length} (${networkCount} network, ${out ? Object.keys(out).length : 0} resolved so far)`);
    }
  }

  const outPath = path.join(PROCESSED, 'pubchem_smiles.json');
  await writeJson(outPath, {
    cas: out,
    _fetched_at: new Date().toISOString(),
    _source_count: Object.keys(out).length,
    _input_count: casList.length,
  });
  console.log(`[pubchem] wrote ${outPath} with ${Object.keys(out).length}/${casList.length} resolved`);
}

main().catch((err) => {
  console.error('[pubchem] ERROR', err);
  process.exit(1);
});
