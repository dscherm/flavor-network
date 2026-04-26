// ChemTastesDB v2.1 ingest from Zenodo record 15051366.
// Downloads the Zenodo files-archive ZIP, unzips to
// raw/chemtastedb-v21/<database>.xlsx, parses the first sheet,
// and writes processed/chemtastedb.json:
//   { compounds: { <id>: { name, smiles, inchikey, taste } } }
//
// v1 raw cache at raw/chemtastedb/ is kept untouched for rollback.
// v2.1 expands 2,944 → 4,075 compounds (umami 170→220, sour gets some
// lift, salty stays at 16 — DB-level ceiling).

import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import XLSX from 'xlsx';
import { RAW, PROCESSED, ensureDir, writeJson } from './common.js';

const URL = 'https://zenodo.org/api/records/15051366/files-archive';
const DIR = path.join(RAW, 'chemtastedb-v21');
const ZIP = path.join(DIR, 'chemtastedb-v21.zip');
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
  // v2.1 ships up to 8 rows per molecule (each row = one source's report of a
  // taste label). Keying on PubChem CID overwrites; keying on canonical SMILES
  // lets us merge taste evidence across rows. Class taste is the clean
  // categorical signal; Taste is free-text (200+ variants) but carries
  // multi-taste detail like "salty/umami" that the categorical column hides
  // under "multitaste". Surface both.
  let totalRows = 0, mergedRows = 0;
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
    if (rows.length === 0) continue;
    console.log(`[chemtastedb] sheet "${sheetName}" — ${rows.length} rows, cols=${Object.keys(rows[0]).slice(0, 8).join(',')}…`);
    for (const row of rows) {
      const smiles = rowValue(row, [/smiles/]);
      const inchikey = rowValue(row, [/inchikey/]);
      const cid = rowValue(row, [/^pubchem/, /^cid$/]);
      const key = smiles || inchikey || (cid != null ? `cid:${cid}` : null);
      if (!key) continue;
      totalRows++;
      const tasteRaw = String(rowValue(row, [/^taste$/]) || '').toLowerCase().trim();
      const classTaste = String(rowValue(row, [/class.?taste/, /^class$/]) || '').toLowerCase().trim();
      const name = rowValue(row, [/^name$/, /compound.?name/, /^title$/]);
      const cas = rowValue(row, [/^cas/, /cas.?number/]);
      if (compounds[key]) {
        mergedRows++;
        const c = compounds[key];
        if (tasteRaw && (!c.taste || !c.taste.includes(tasteRaw))) {
          c.taste = c.taste ? `${c.taste}; ${tasteRaw}` : tasteRaw;
        }
        if (classTaste && !c.classTastes.includes(classTaste)) {
          c.classTastes.push(classTaste);
        }
        if (!c.cid && cid != null) c.cid = cid;
      } else {
        compounds[key] = {
          name,
          smiles,
          inchikey,
          cas,
          cid,
          taste: tasteRaw || null,
          classTastes: classTaste ? [classTaste] : [],
        };
      }
    }
  }

  // Compose a flag-friendly `class_taste` string from the set, mapping the v2.1
  // "-ness" suffix variants (sweetness/bitterness/umaminess/sourness/saltiness)
  // and "multitaste" onto the singular tokens that build_compounds.py greps.
  // multitaste is left as-is because the raw `taste` field already carries the
  // sub-token detail (salty/umami, sour/bitter, etc.).
  const NESS_MAP = {
    sweetness: 'sweet',
    bitterness: 'bitter',
    umaminess: 'umami',
    sourness: 'sour',
    saltiness: 'salty',
    tastelessness: 'tasteless',
    'non-sweetness': 'non-sweet',
    'non-bitterness': 'non-bitter',
  };
  const classCounts = {};
  for (const c of Object.values(compounds)) {
    const tokens = c.classTastes.map(t => NESS_MAP[t] || t);
    c.class_taste = tokens.join('; ') || null;
    delete c.classTastes;
    for (const t of tokens) classCounts[t] = (classCounts[t] || 0) + 1;
  }

  await writeJson(path.join(PROCESSED, 'chemtastedb.json'), { compounds });
  console.log(`[chemtastedb] ${Object.keys(compounds).length} compounds (from ${totalRows} rows; ${mergedRows} merged into existing keys) -> processed/chemtastedb.json`);
  console.log(`[chemtastedb] class_taste counts:`, classCounts);
}

main().catch(err => { console.error(err); process.exit(1); });
