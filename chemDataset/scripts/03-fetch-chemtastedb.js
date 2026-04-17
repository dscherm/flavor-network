// ChemTasteDB ingest from Zenodo record 5747393.
// Downloads the Zenodo files-archive ZIP, unzips to
// raw/chemtastedb/ChemTastesDB_database.xlsx, parses the first sheet,
// and writes processed/chemtastedb.json:
//   { compounds: { <id>: { name, smiles, inchikey, taste } } }

import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import XLSX from 'xlsx';
import { RAW, PROCESSED, ensureDir, writeJson } from './common.js';

const URL = 'https://zenodo.org/api/records/5747393/files-archive';
const DIR = path.join(RAW, 'chemtastedb');
const ZIP = path.join(DIR, 'chemtastedb.zip');
const WIN_TAR = 'C:/Windows/System32/tar.exe';

async function exists(p) { try { await fs.stat(p); return true; } catch { return false; } }

async function download(url, dest) {
  console.log(`[chemtastedb] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on Zenodo`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function extract(zip, into) {
  await new Promise((resolve, reject) => {
    const p = spawn(WIN_TAR, ['-xf', zip, '-C', into], { stdio: 'inherit' });
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`tar exit ${code}`)));
  });
}

async function findXlsx(dir) {
  const hits = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.isFile() && /database.*\.xlsx$/i.test(e.name)) hits.push(path.join(dir, e.name));
  }
  return hits;
}

function rowValue(row, keys) {
  for (const k of Object.keys(row)) {
    const lower = k.toLowerCase();
    if (keys.some(t => t.test(lower))) return row[k];
  }
  return null;
}

async function main() {
  await ensureDir(DIR);
  if (!(await exists(ZIP))) await download(URL, ZIP);
  if ((await findXlsx(DIR)).length === 0) await extract(ZIP, DIR);

  const xlsxFiles = await findXlsx(DIR);
  if (xlsxFiles.length === 0) throw new Error(`no database xlsx found under ${DIR}`);
  const xlsx = xlsxFiles[0];
  console.log(`[chemtastedb] parsing ${xlsx}`);

  const wb = XLSX.readFile(xlsx);
  const compounds = {};
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
    if (rows.length === 0) continue;
    console.log(`[chemtastedb] sheet "${sheetName}" — ${rows.length} rows, cols=${Object.keys(rows[0]).join(',')}`);
    for (const row of rows) {
      const smiles = rowValue(row, [/smiles/]);
      const inchikey = rowValue(row, [/inchikey/]);
      const id = rowValue(row, [/^pubchem/, /^cid$/]) || inchikey || smiles;
      if (!id) continue;
      const taste = String(rowValue(row, [/^taste$/, /taste.?class/, /^class$/]) || '').toLowerCase().trim() || null;
      compounds[id] = {
        name: rowValue(row, [/^name$/, /compound.?name/, /^title$/]),
        smiles,
        inchikey,
        cas: rowValue(row, [/^cas/, /cas.?number/]),
        taste,
      };
    }
  }

  await writeJson(path.join(PROCESSED, 'chemtastedb.json'), { compounds });
  console.log(`[chemtastedb] ${Object.keys(compounds).length} compounds -> processed/chemtastedb.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
