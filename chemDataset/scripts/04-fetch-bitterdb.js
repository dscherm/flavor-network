// BitterDB — bitterdb.agri.huji.ac.il
//
// Uses the bulk 2019 CSV downloads linked from dbbitter.php rather than
// scraping per-compound pages:
//   BitterCompoundsPropA_2019.csv — SMILES, pubChemID, InChiKey, CAS, MW, etc.
//   compoundsnamesA_2019.csv      — cID -> [names] (multiple per compound)
//
// Output: processed/bitterdb.json
//   { compounds: { <cid>: { name, names: [<str>], smiles, isomeric_smiles,
//                           pubchem_id, inchi_key, cas, mw, is_natural } },
//     _fetched_at, _source_count }

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { RAW, PROCESSED, ensureDir, writeJson, sleep } from './common.js';

const BASE = 'https://bitterdb.agri.huji.ac.il/downloads/2019/';
const FILES = {
  props: 'BitterCompoundsPropA_2019.csv',
  names: 'compoundsnamesA_2019.csv',
};
const RAW_DIR = path.join(RAW, 'bitterdb');
const RATE_MS = 1000;

async function download(file) {
  const dest = path.join(RAW_DIR, file);
  try {
    await fs.access(dest);
    console.log(`[bitterdb] cached: ${file}`);
    return dest;
  } catch { /* fetch */ }

  const url = `${BASE}?file=${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  console.log(`[bitterdb] fetched: ${file} (${buf.length} bytes)`);
  await sleep(RATE_MS);
  return dest;
}

function readCsv(p) {
  return fs.readFile(p, 'utf8').then(text =>
    parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true }),
  );
}

async function main() {
  await ensureDir(RAW_DIR);
  await ensureDir(PROCESSED);

  const propsPath = await download(FILES.props);
  const namesPath = await download(FILES.names);

  const propsRows = await readCsv(propsPath);
  const namesRows = await readCsv(namesPath);

  const namesByCid = {};
  for (const r of namesRows) {
    const cid = r.cID || r.cid;
    const nm = (r.cName || '').trim();
    if (!cid || !nm) continue;
    (namesByCid[cid] ||= []).push(nm);
  }

  const compounds = {};
  for (const r of propsRows) {
    const cid = r.cid || r.cID;
    if (!cid) continue;
    const names = namesByCid[cid] || [];
    compounds[cid] = {
      name: names[0] || null,
      names,
      smiles: r.canonical_smiles || null,
      isomeric_smiles: r.Isomeric_smiles || null,
      pubchem_id: r.pubChemID ? Number(r.pubChemID) || r.pubChemID : null,
      inchi_key: r.InChiKey || null,
      cas: r.Cas_Number_Final || null,
      mw: r.MW ? Number(r.MW) : null,
      is_natural: r.isNatural === '1' ? 1 : r.isNatural === '0' ? 0 : null,
    };
  }

  const out = {
    compounds,
    _fetched_at: new Date().toISOString(),
    _source_count: { compounds: Object.keys(compounds).length },
  };
  await writeJson(path.join(PROCESSED, 'bitterdb.json'), out);
  console.log(`[bitterdb] done: ${Object.keys(compounds).length} compounds`);
}

main().catch(err => { console.error(err); process.exit(1); });
