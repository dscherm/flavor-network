// FartDB ingest from the FART project (NPJ Science of Food 2025).
// Source CSV: github.com/fart-lab/fart/blob/main/dataset/fart_curated.csv
// 15,025 compounds with single canonical taste labels — sweet, bitter, sour,
// umami. Salty is excluded by FART's design (mechanism is pH/concentration-
// dependent, structurally hard to predict from SMILES alone).
//
// Headline lift: ~1,513 sour positives vs ChemTastesDB v2.1's 49.
//
// Many FART rows are re-sourced from chemtastes_db / bittersweet / bitterdb /
// supersweetdb; the `Source` column tracks provenance so we can audit
// net-new contribution. Final dedup against our other sources happens in
// flavor-gnn's build_compounds.py via RDKit canonicalization (FART and
// ChemTastesDB sometimes emit slightly different canonical SMILES strings
// for the same molecule due to RDKit version differences).
//
// Emits processed/fartdb.json:
//   { compounds: { <smiles>: { smiles, standardized_smiles, taste,
//                              class_taste, original_labels, sources,
//                              is_multiclass } } }

import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { RAW, PROCESSED, ensureDir, writeJson } from './common.js';

const URL = 'https://raw.githubusercontent.com/fart-lab/fart/main/dataset/fart_curated.csv';
const DIR = path.join(RAW, 'fartdb');
const CSV = path.join(DIR, 'fart_curated.csv');

async function exists(p) { try { await fs.stat(p); return true; } catch { return false; } }

async function download(url, dest) {
  console.log(`[fartdb] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function main() {
  await ensureDir(DIR);
  if (!(await exists(CSV))) await download(URL, CSV);

  const text = await fs.readFile(CSV, 'utf8');
  const rows = parse(text, { columns: true, skip_empty_lines: true });
  console.log(`[fartdb] parsed ${rows.length} rows; columns: ${Object.keys(rows[0] || {}).join(', ')}`);

  const compounds = {};
  let totalRows = 0, mergedRows = 0, skippedNoSmiles = 0;
  const tasteCounts = {}, sourceCounts = {};
  for (const row of rows) {
    const smiles = (row['Canonicalized SMILES'] || '').trim();
    if (!smiles) { skippedNoSmiles++; continue; }
    const taste = (row['Canonicalized Taste'] || '').toLowerCase().trim();
    const original = (row['Original Labels'] || '').trim();
    const source = (row['Source'] || '').trim();
    const isMulti = String(row['is_multiclass'] ?? '').trim() === '1';
    totalRows++;
    if (taste) tasteCounts[taste] = (tasteCounts[taste] || 0) + 1;
    if (source) sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    if (compounds[smiles]) {
      mergedRows++;
      const c = compounds[smiles];
      if (taste && (!c.taste || !c.taste.split('; ').includes(taste))) {
        c.taste = c.taste ? `${c.taste}; ${taste}` : taste;
        c.class_taste = c.taste;
      }
      if (source && !c.sources.includes(source)) c.sources.push(source);
      if (isMulti) c.is_multiclass = true;
      if (original && !c.original_labels.includes(original)) {
        c.original_labels = c.original_labels
          ? `${c.original_labels} | ${original}`
          : original;
      }
    } else {
      compounds[smiles] = {
        smiles,
        standardized_smiles: row['Standardized SMILES'] || null,
        taste: taste || null,
        class_taste: taste || null,
        original_labels: original || null,
        sources: source ? [source] : [],
        is_multiclass: isMulti,
      };
    }
  }

  // Per-class compound count (counts unique compounds, not rows)
  const compoundClassCounts = {};
  for (const c of Object.values(compounds)) {
    if (!c.class_taste) continue;
    for (const t of c.class_taste.split('; ')) {
      compoundClassCounts[t] = (compoundClassCounts[t] || 0) + 1;
    }
  }

  await writeJson(path.join(PROCESSED, 'fartdb.json'), { compounds });
  console.log(`[fartdb] ${Object.keys(compounds).length} unique-SMILES compounds`
    + ` (from ${totalRows} rows; ${mergedRows} merged; ${skippedNoSmiles} skipped no-smiles)`
    + ` -> processed/fartdb.json`);
  console.log(`[fartdb] row-level taste counts:`, tasteCounts);
  console.log(`[fartdb] compound-level class counts:`, compoundClassCounts);
  console.log(`[fartdb] source provenance:`, sourceCounts);
}

main().catch(err => { console.error(err); process.exit(1); });
