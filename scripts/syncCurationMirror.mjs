// Writes the pipeline-side mirror of the curation tables (proDataset/data/curation.json and the alias
// entries in proDataset/data/synonyms.json). Does NOT run the pipeline.
//   node scripts/syncCurationMirror.mjs           write
//   node scripts/syncCurationMirror.mjs --check   exit 1 when the mirror has drifted (writes nothing)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCurationTables } from './lib/curationTables.mjs';
import { buildCurationMirror, mirrorSynonyms, mirrorDrift, synonymRewrites } from './lib/curationMirror.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SYN = resolve(ROOT, 'proDataset/data/synonyms.json');
const CUR = resolve(ROOT, 'proDataset/data/curation.json');

const tables = loadCurationTables();
const syn = JSON.parse(readFileSync(SYN, 'utf8'));
let cur = null;
try { cur = JSON.parse(readFileSync(CUR, 'utf8')); } catch { /* absent */ }

if (process.argv.includes('--check')) {
  const problems = mirrorDrift(tables, cur, syn);
  if (problems.length) { console.error(`pipeline mirror has drifted (${problems.length}):\n  ${problems.slice(0, 20).join('\n  ')}\nrun: node scripts/syncCurationMirror.mjs`); process.exit(1); }
  console.log('pipeline mirror in sync');
} else {
  const nextSyn = mirrorSynonyms(syn, tables);
  const rewrites = synonymRewrites(syn, nextSyn);
  writeFileSync(SYN, JSON.stringify(nextSyn, null, 2));
  writeFileSync(CUR, JSON.stringify(buildCurationMirror(tables), null, 2) + '\n');
  console.log(`synonyms.json: ${Object.keys(syn).length - 1} -> ${Object.keys(nextSyn).length - 1} entries, ${rewrites.length} existing entries re-pointed`);
  for (const r of rewrites) console.log(`  ${r.key}: ${r.was} -> ${r.now}`);
  console.log('curation.json written');
}
