// FooDB bulk ingest.
// Downloads foodb_2020_04_07_csv.tar.gz, extracts Food/Compound/Content CSVs,
// joins them into processed/foodb.json:
//   { foods:     { <food_name>: { id, scientific_name, compounds: [<cid>, ...] } },
//     compounds: { <cid>:       { name, smiles } } }

import { promises as fs } from 'node:fs';
import { createWriteStream, createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { parse } from 'csv-parse';
import { RAW, PROCESSED, ensureDir, writeJson } from './common.js';

const URL = 'https://foodb.ca/public/system/downloads/foodb_2020_4_7_csv.tar.gz';
const DIR = path.join(RAW, 'foodb');
const TARBALL = path.join(DIR, 'foodb.tar.gz');

async function exists(p) { try { await fs.stat(p); return true; } catch { return false; } }

async function findCsv(dir, leafName) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { const r = await findCsv(full, leafName); if (r) return r; }
    else if (e.name.toLowerCase() === leafName.toLowerCase()) return full;
  }
  return null;
}

async function download(url, dest) {
  console.log(`[foodb] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching FooDB`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const { size } = await fs.stat(dest);
  console.log(`[foodb] saved ${size} bytes to ${dest}`);
}

async function extract(tarball, into) {
  console.log(`[foodb] extracting ${tarball}`);
  await new Promise((resolve, reject) => {
    const p = spawn('C:/Windows/System32/tar.exe', ['-xf', tarball, '-C', into], { stdio: 'inherit' });
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`tar exit ${code}`)));
  });
}

async function parseCsv(file) {
  const rows = [];
  const parser = createReadStream(file).pipe(parse({ columns: true, relax_quotes: true, skip_records_with_error: true }));
  for await (const r of parser) rows.push(r);
  return rows;
}

async function main() {
  await ensureDir(DIR);
  if (!(await exists(TARBALL))) await download(URL, TARBALL);
  if (!(await findCsv(DIR, 'Food.csv'))) await extract(TARBALL, DIR);

  const foodCsv = await findCsv(DIR, 'Food.csv');
  const compoundCsv = await findCsv(DIR, 'Compound.csv');
  const contentCsv = await findCsv(DIR, 'Content.csv');
  if (!foodCsv || !compoundCsv || !contentCsv) {
    throw new Error(`missing CSVs under ${DIR} — Food.csv=${foodCsv} Compound.csv=${compoundCsv} Content.csv=${contentCsv}`);
  }
  console.log(`[foodb] parsing ${foodCsv}`);
  const foodRows = await parseCsv(foodCsv);
  console.log(`[foodb] parsing ${compoundCsv}`);
  const compoundRows = await parseCsv(compoundCsv);
  const foodById = new Map();
  for (const r of foodRows) {
    const id = r.id || r.food_id;
    if (!id) continue;
    foodById.set(String(id), {
      name: (r.name || '').toLowerCase().trim(),
      scientific_name: r.name_scientific || r.scientific_name || null,
      compounds: new Set(),
    });
  }

  const compounds = {};
  for (const r of compoundRows) {
    const id = r.id || r.compound_id;
    if (!id) continue;
    compounds[id] = {
      name: r.name || null,
      smiles: r.moldb_smiles || r.smiles || null,
      inchikey: r.moldb_inchikey || null,
      cas: r.cas_number || null,
    };
  }

  console.log(`[foodb] streaming ${contentCsv}`);
  let rowCount = 0;
  const parser = createReadStream(contentCsv).pipe(parse({
    columns: true, relax_quotes: true, skip_records_with_error: true,
  }));
  for await (const r of parser) {
    rowCount++;
    if (rowCount % 100000 === 0) console.log(`[foodb] content rows: ${rowCount}`);
    if (r.source_type !== 'Compound') continue;
    const food = foodById.get(String(r.food_id));
    if (food && r.source_id) food.compounds.add(String(r.source_id));
  }
  console.log(`[foodb] processed ${rowCount} content rows`);

  const foods = {};
  for (const { name, scientific_name, compounds: cs } of foodById.values()) {
    if (!name || cs.size === 0) continue;
    foods[name] = { scientific_name, compounds: [...cs] };
  }

  await writeJson(path.join(PROCESSED, 'foodb.json'), { foods, compounds });
  console.log(`[foodb] ${Object.keys(foods).length} foods, ${Object.keys(compounds).length} compounds -> processed/foodb.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
