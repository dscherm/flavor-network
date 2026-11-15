// For every alias (and every addition that an alias points at), report the name-keyed data files where
// the VARIANT has a row and the CANONICAL does not: the merge leaves the canonical without that data.
// Reusable by any task that adds aliases (DATA-3, DATA-4, DATA-5).
//
//   node scripts/checkAliasCoverage.mjs            summary + the list of losses
//   node scripts/checkAliasCoverage.mjs --json     the same as JSON
//
// Reads repo files only. Exit code is always 0 (it reports, it does not gate).
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCurationTables } from './lib/curationTables.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRO = resolve(ROOT, 'public/proDataset');
export const NAME_KEYED_FILES = [
  'gnn_entropy.json', 'gnn_entropy_imputed.json', 'gnn_compounds.json',
  'flavor_positions.json', 'flavor_positions_v3.json', 'flavor_positions_2d.json', 'flavor_positions_2d_v3.json',
  'gnn_positions.json', 'gnn_positions_raw.json', 'pca_positions.json',
];

export function coverageLosses(aliases, files) {
  const losses = [];
  for (const [variant, { to }] of Object.entries(aliases)) {
    const missing = Object.entries(files).filter(([, rows]) => rows[variant] !== undefined && rows[to] === undefined).map(([f]) => f);
    if (missing.length) losses.push({ variant, to, files: missing });
  }
  return losses;
}

function main() {
  const { aliases } = loadCurationTables();
  const files = {};
  for (const f of NAME_KEYED_FILES) {
    const p = resolve(PRO, f);
    if (existsSync(p)) files[f] = JSON.parse(readFileSync(p, 'utf8'));
  }
  const losses = coverageLosses(aliases, files);
  const usable = [...new Set(Object.keys(files))];
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ aliases: Object.keys(aliases).length, files: usable, losses }, null, 2)); return; }
  const perFile = Object.fromEntries(usable.map((f) => [f, losses.filter((l) => l.files.includes(f)).length]));
  const totalMissingRows = losses.reduce((n, l) => n + l.files.length, 0);
  console.log(`${Object.keys(aliases).length} aliases checked against ${usable.length} name-keyed files`);
  console.log(`${losses.length} aliases leave the canonical without a row the variant has (${totalMissingRows} missing rows in all)`);
  for (const [f, n] of Object.entries(perFile)) console.log(`  ${f}: ${n}`);
  console.log('\nvariant -> canonical : files where only the variant has a row');
  for (const l of losses) console.log(`${l.variant} -> ${l.to} : ${l.files.join(', ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
