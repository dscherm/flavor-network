// AROMA-2. Second-opinion check: the aroma table (src/data/flavorAromas.js) against the second source of aroma labels
// (public/proDataset/flavor_profiles_distilled.json), names resolved through the curation layer's aliases.
//
//   node scripts/checkAromaAgreement.mjs                  summary + unreviewed disagreements; writes data/review/aroma-disagreements.tsv
//   node scripts/checkAromaAgreement.mjs --axes six       judge against the old six-aroma set (eleven is the default since AROMA-3)
//   node scripts/checkAromaAgreement.mjs --all            list every disagreement, reviewed or not
//   node scripts/checkAromaAgreement.mjs --check          exit 1 when a disagreement is unreviewed or the accepted file is stale
//   node scripts/checkAromaAgreement.mjs --json
// The second source is a second opinion (mostly AI-written), not ground truth.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AROMAS } from '../src/data/flavorAromas.js';
import { aliasEntries } from '../src/data/curation/resolveIngredient.js';
import { compareAromaTable, unreviewedDisagreements, validateAccepted, disagreementTsv, disagreements, AXIS_SETS } from '../src/data/aromaAgreement.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));

export function runAgreement({ axes = 'eleven' } = {}) {
  const distilled = readJson('public/proDataset/flavor_profiles_distilled.json');
  const accepted = existsSync(resolve(ROOT, 'data/review/aroma-accepted.json')) ? readJson('data/review/aroma-accepted.json') : {};
  const { rows, summary } = compareAromaTable(AROMAS, distilled, { aliases: new Map(aliasEntries()), axes: AXIS_SETS[axes] });
  const unreviewed = unreviewedDisagreements(rows, accepted);
  return { rows, summary, accepted, unreviewed, problems: validateAccepted(accepted, rows), axes };
}

function main() {
  const args = process.argv.slice(2);
  const axes = args.includes('--axes') ? args[args.indexOf('--axes') + 1] : 'eleven';
  if (!AXIS_SETS[axes]) { console.error(`unknown axis set ${axes}`); process.exit(2); }
  const r = runAgreement({ axes });
  const s = r.summary;
  if (args.includes('--json')) { console.log(JSON.stringify({ summary: s, unreviewed: r.unreviewed.map((x) => x.name), problems: r.problems }, null, 2)); return; }
  console.log(`Aroma table vs the second source (axes: ${axes})`);
  console.log(`  table lines ${s.lines} (${s.aromaless} with no aroma of their own, not compared); lines with aroma ${s.withAroma}`);
  console.log(`  no counterpart in the second source: ${s.noCounterpart}`);
  console.log(`  second source has no aroma that fits these axes: ${s.noExpressible}; compared: ${s.compared}`);
  console.log(`  strongest aroma agrees: ${s.agree}/${s.compared} (${s.agreePct}%); chef-sourced ${s.agreeChef}/${s.comparedChef} (${s.agreeChefPct}%)`);
  console.log(`  one of the top two agrees: ${s.top2}/${s.compared} (${s.top2Pct}%)`);
  console.log(`  disagreements: ${s.disagree} (${s.withHomelessWords} of the compared lines have second-source aromas with no axis here)`);
  const show = args.includes('--all') ? disagreements(r.rows) : r.unreviewed;
  for (const x of show) {
    const dec = r.accepted[x.name];
    console.log(`  ${x.name.padEnd(26)} table ${x.tableTop.join('/').padEnd(8)} | second [${x.secondWords.join(', ')}]${x.chef ? ' (chef)' : ''}${dec ? `  -> ${dec.kind}` : ''}`);
  }
  if (!args.includes('--check')) writeFileSync(resolve(ROOT, 'data/review/aroma-disagreements.tsv'), disagreementTsv(r.unreviewed));
  console.log(`unreviewed: ${r.unreviewed.length}${r.problems.length ? `; accepted-file problems: ${r.problems.length}` : ''}`);
  for (const p of r.problems) console.log(`  problem: ${p}`);
  if (args.includes('--check') && (r.unreviewed.length || r.problems.length)) { console.error('CHECK FAILED: aroma disagreements unreviewed'); process.exit(1); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
