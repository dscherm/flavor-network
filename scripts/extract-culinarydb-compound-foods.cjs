#!/usr/bin/env node
/**
 * extract-culinarydb-compound-foods — generate a constituent map for
 * compound foods from CulinaryDB's 03_Compound_Ingredients.csv, ready
 * to merge into src/data/compoundFoods.js.
 *
 * CulinaryDB provides 103 hand-curated compound foods (garam masala,
 * vermicelli, mayonnaise, etc.) with constituent ingredient lists.
 * Constituent weights are not provided, so we equal-weight.
 *
 * Output: proDataset/processed/culinarydb-compound-foods.json
 *   { ingredient: { constituents: { name: weight }, description, category } }
 *
 * Notes:
 *   - Constituent names are normalized (lowercased, '=' -> ' ', etc).
 *   - Names use the CulinaryDB vocabulary; compoundFoods.js's existing
 *     SUBSTITUTES map handles cases where a constituent isn't in our
 *     GNN data. Adding new ones requires extending that map.
 *   - The output file is informational; the actual merge into
 *     src/data/compoundFoods.js is a separate manual review step.
 *
 * Run: node scripts/extract-culinarydb-compound-foods.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CULINARYDB_DIR = 'C:/Users/scher/Downloads/CulinaryDB';
const OUT_PATH = path.resolve(__dirname, '..', 'proDataset', 'processed', 'culinarydb-compound-foods.json');

// Minimal sync CSV parser: 03_Compound_Ingredients.csv is only 103 rows
// and the fields are unquoted CSV with quoted-comma constituent lists.
function parseCsv(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseCsvLine(lines[i]);
    if (fields.length !== header.length) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = fields[j];
    out.push(obj);
  }
  return out;
}

function parseCsvLine(line) {
  const out = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; continue; }
        inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(field); field = ''; }
      else field += c;
    }
  }
  out.push(field);
  return out;
}

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/=/g, ' ')        // CulinaryDB uses 'self=rising' style
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  const csv = fs.readFileSync(path.join(CULINARYDB_DIR, '03_Compound_Ingredients.csv'), 'utf-8');
  const rows = parseCsv(csv);

  const out = { _meta: { source: 'culinarydb-03-compound-ingredients', generatedAt: new Date().toISOString(), count: 0 } };
  for (const row of rows) {
    const name = normalize(row['Compound Ingredient Name']);
    if (!name) continue;
    const constituentsRaw = row['Contituent Ingredients'] || '';
    const list = constituentsRaw
      .split(',')
      .map(s => normalize(s))
      .filter(Boolean);
    if (list.length === 0) continue;
    const w = Math.round((1 / list.length) * 1e4) / 1e4;
    const constituents = {};
    for (const c of list) {
      if (constituents[c]) continue;
      constituents[c] = w;
    }
    out[name] = {
      constituents,
      description: row['Category'] ? `${row['Category'].toLowerCase()} from CulinaryDB` : 'compound food',
      category: row['Category'] || 'compound',
    };
  }
  out._meta.count = Object.keys(out).length - 1;
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT_PATH} (${out._meta.count} compound foods)`);
  // Print first 5 for verification
  const names = Object.keys(out).filter(k => k !== '_meta').slice(0, 5);
  for (const n of names) console.log(`  ${n}: ${JSON.stringify(out[n].constituents)}`);
}

main();
