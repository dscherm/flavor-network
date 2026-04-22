#!/usr/bin/env node
/*
 * build_compound_tastes — produce public/proDataset/compound_tastes.json,
 * a lookup from compound-name → {taste labels, odor labels} for the
 * Molecule↔Taste visualization.
 *
 * Joins:
 *   - flavor-gnn/data/compounds.parquet → ground-truth binary labels
 *     (sweet/bitter/umami/salty/sour + 6 odor classes) per SMILES.
 *     But we read these indirectly via the already-processed predictions
 *     since parsing parquet from Node requires extra deps. Use the
 *     source JSON instead.
 *   - chemDataset/processed/foodb.json → compound.name ↔ compound.cas
 *     (SMILES lives in mislabeled `cas` field).
 *
 * We emit the join keyed by lowercased compound name so the web app's
 * gnnCompounds entries (which carry raw names) can resolve in O(1).
 *
 * Because compounds.parquet lives in Python, we run a small helper to
 * emit a SMILES→tasks JSON first, then join here. See
 * flavor-gnn/src/infer/dump_compound_labels.py.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const labelsPath = path.join(ROOT, 'flavor-gnn', 'data', 'compound_labels.json');
const foodbPath = path.join(ROOT, 'chemDataset', 'processed', 'foodb.json');
const outPath = path.join(ROOT, 'public', 'proDataset', 'compound_tastes.json');

if (!fs.existsSync(labelsPath)) {
  console.error('Run first: flavor-gnn/.venv/Scripts/python.exe -m src.infer.dump_compound_labels');
  process.exit(1);
}

const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
const bySmiles = labels.by_smiles || labels;
const byInchi = labels.by_inchi || {};
const foodb = JSON.parse(fs.readFileSync(foodbPath, 'utf8'));
const compounds = foodb.compounds || {};

const out = {};
let hitSmiles = 0, hitInchi = 0, total = 0;
for (const cid of Object.keys(compounds)) {
  const c = compounds[cid];
  const name = c.name;
  const smi = c.cas;              // real SMILES (FooDB mislabels this field)
  const ikey = c.smiles;          // FooDB stores InChI key in `smiles` (sic)
  if (!name) continue;
  total++;
  let labelVec = null;
  if (smi && bySmiles[smi]) { labelVec = bySmiles[smi]; hitSmiles++; }
  else if (ikey && byInchi[ikey]) { labelVec = byInchi[ikey]; hitInchi++; }
  if (!labelVec) continue;
  const key = name.toLowerCase().trim();
  if (!out[key]) out[key] = labelVec;
}

fs.writeFileSync(outPath, JSON.stringify({
  _meta: {
    source: 'flavor-gnn compounds.parquet + chemDataset foodb.json join',
    hits_by_smiles: hitSmiles,
    hits_by_inchi: hitInchi,
    foodb_compounds: total,
  },
  compounds: out,
}));
console.log(`Joined ${hitSmiles}+${hitInchi}/${total} FooDB compounds — ${Object.keys(out).length} unique names.`);
console.log(`Wrote ${outPath}`);
