/**
 * apply_ingredient_audit.cjs — merge the LLM ingredient-accuracy audit
 * (.ralph/audit_batches/batch_*.out.json) back into the live dataset.
 *
 *   - taste + category  -> public/proDataset/ingredients.json  (values, not keys)
 *   - cuisines          -> public/data/cuisine_map.json        (values, not keys)
 *   - junk flags        -> flavor-gnn/artifacts/ingredient_accuracy_audit.md (report only)
 *
 * NO ingredient keys are renamed or deleted, so there is zero referential-
 * integrity risk to pairings / gnn / cluster files. Junk is reported, never
 * removed. Every corrected field is validated against the canonical vocab;
 * invalid values fall back to the original.
 *
 * Usage:  node scripts/apply_ingredient_audit.cjs [--dry]
 */
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve(__dirname, '..');
const ING = path.join(ROOT, 'public/proDataset/ingredients.json');
const CM = path.join(ROOT, 'public/data/cuisine_map.json');
const BATCH_DIR = path.join(ROOT, '.ralph/audit_batches');
const REPORT = path.join(ROOT, 'flavor-gnn/artifacts/ingredient_accuracy_audit.md');

const VALID_CAT = new Set(['protein','vegetable','fruit','dairy','grain','fat','condiment','spice','herb','aromatic','citrus','chili','sweetener','liquid','nut','baked','thickener','acid','seasoning','umami','liqueur','spirit','confection','mixer','bitters','other']);
const VALID_TASTE = new Set(['sweet','sour','bitter','salty','umami','spicy','pungent','astringent']);
const CANON_CUISINE = ['Global','American','Southern US','Tex-Mex','Cajun/Creole','Mexican','Caribbean','Brazilian','Argentine','Peruvian','French','Italian','Spanish','Portuguese','Greek','British','German','Hungarian','Polish','Russian','Scandinavian','Chinese','Japanese','Korean','Thai','Vietnamese','Indonesian','Malaysian','Filipino','Indian','Pakistani','Sri Lankan','Turkish','Lebanese','Persian','Israeli','Moroccan','West African','South African','Ethiopian','Pacific Islander','Australian'];
const CUISINE_BY_LC = new Map(CANON_CUISINE.map((c) => [c.toLowerCase(), c]));
// umbrella aliases -> a sensible canonical default
const CUISINE_ALIAS = { 'african': 'West African', 'middle eastern': 'Lebanese', 'southeast asian': 'Thai' };

function normTaste(s, fallback) {
  if (typeof s !== 'string') return fallback;
  const toks = s.toLowerCase().split(/\s+/).filter((t) => VALID_TASTE.has(t));
  const seen = new Set(); const out = [];
  for (const t of toks) { if (!seen.has(t)) { seen.add(t); out.push(t); } if (out.length === 3) break; }
  return out.length ? out.join(' ') : fallback;
}
function normCat(s, fallback) {
  if (typeof s === 'string' && VALID_CAT.has(s.toLowerCase().trim())) return s.toLowerCase().trim();
  return fallback;
}
function normCuisines(arr, fallback) {
  if (!Array.isArray(arr)) return fallback;
  const seen = new Set(); const out = [];
  for (let c of arr) {
    if (typeof c !== 'string') continue;
    const lc = c.toLowerCase().trim();
    const canon = CUISINE_BY_LC.get(lc) || CUISINE_ALIAS[lc];
    if (canon && !seen.has(canon)) { seen.add(canon); out.push(canon); }
    if (out.length === 4) break;
  }
  return out.length ? out : fallback;
}

const ing = JSON.parse(fs.readFileSync(ING, 'utf8'));
const cm = JSON.parse(fs.readFileSync(CM, 'utf8'));

const outFiles = fs.readdirSync(BATCH_DIR).filter((f) => /\.out\.json$/.test(f)).sort();
let seen = 0, missingKey = 0, badRec = 0;
let chCat = 0, chTaste = 0, chCui = 0;
const junk = [];
const catShifts = []; // notable category changes
const coveredBatches = new Set();

for (const f of outFiles) {
  coveredBatches.add(f.replace('.out.json', ''));
  let recs;
  try { recs = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, f), 'utf8').replace(/^﻿/, '')); } catch (e) { console.warn('SKIP unparseable', f, '-', e.message); continue; }
  if (!Array.isArray(recs)) { console.warn('SKIP non-array', f); continue; }
  for (const r of recs) {
    if (!r || typeof r.name !== 'string' || !ing[r.name]) { missingKey++; continue; }
    seen++;
    const node = ing[r.name];
    const oldCat = node.category || null;
    const oldTaste = node.taste || null;
    const oldCui = Array.isArray(cm[r.name]) ? cm[r.name] : [];

    const newCat = normCat(r.category, oldCat);
    const newTaste = normTaste(r.taste, oldTaste);
    const newCui = normCuisines(r.cuisines, oldCui);

    if (newCat !== oldCat) { chCat++; catShifts.push(`${r.name}: ${oldCat} -> ${newCat}`); }
    if (newTaste !== oldTaste) chTaste++;
    if (JSON.stringify(newCui) !== JSON.stringify(oldCui)) chCui++;

    if (!DRY) {
      node.category = newCat;
      node.taste = newTaste;
      if (newCui.length) cm[r.name] = newCui;
    }
    if (r.isJunk) junk.push(`${r.name}${r.junkReason ? ' — ' + r.junkReason : ''}`);
  }
}

// which batches are missing an out file?
const allBatches = fs.readdirSync(BATCH_DIR).filter((f) => /^batch_\d+\.json$/.test(f)).map((f) => f.replace('.json', ''));
const missingBatches = allBatches.filter((b) => !coveredBatches.has(b));

console.log(`out files: ${outFiles.length} | records applied: ${seen} | missing-key recs: ${missingKey}`);
console.log(`changes — category: ${chCat} | taste: ${chTaste} | cuisines: ${chCui} | junk flagged: ${junk.length}`);
if (missingBatches.length) console.log(`MISSING BATCHES (kept original): ${missingBatches.join(', ')}`);

if (!DRY) {
  fs.copyFileSync(ING, ING + '.pre-accuracy-audit.bak');
  fs.copyFileSync(CM, CM + '.pre-accuracy-audit.bak');
  fs.writeFileSync(ING, JSON.stringify(ing, null, 2) + '\n');
  fs.writeFileSync(CM, JSON.stringify(cm, null, 2) + '\n');

  const report = [
    '# Ingredient Accuracy Audit — Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Records re-judged: **${seen}**`,
    `- Category changes: **${chCat}**`,
    `- Taste changes: **${chTaste}**`,
    `- Cuisine changes: **${chCui}**`,
    `- Junk entries flagged (NOT removed): **${junk.length}**`,
    missingBatches.length ? `- Batches missing output (kept original): ${missingBatches.join(', ')}` : '- All batches produced output.',
    '',
    '## Flagged junk (non-ingredient entries — candidates for a separate removal pass)',
    '',
    ...junk.map((j) => `- ${j}`),
    '',
    '## Sample category reclassifications',
    '',
    ...catShifts.slice(0, 120).map((s) => `- ${s}`),
    '',
  ].join('\n');
  fs.writeFileSync(REPORT, report);
  console.log('wrote', REPORT);
  console.log('backups: ingredients.json.pre-accuracy-audit.bak, cuisine_map.json.pre-accuracy-audit.bak');
}
