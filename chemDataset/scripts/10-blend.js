// 10-blend.js — Join processed sources into the graph consumed by useChemData.
//
// Output:
//   public/chemDataset/ingredients.json
//     { <ingredient_name>: { category, taste, compounds: [<cid>], sources: [<src>] } }
//   public/chemDataset/pairings.json
//     [ { ingredientA, ingredientB, strength, shared_count, jaccard, potency } ]
//
// Inputs:
//   processed/foodb.json         ingredient -> compounds
//   processed/flavordb.json      molecules with taste + odor tags
//   processed/chemtastedb.json   compounds with taste class
//   processed/bitterdb.json      bitter compounds
//   processed/supersweetdb.json  sweet compounds + intensity
//
// Scoring:
//   jaccard        = |A ∩ B| / |A ∪ B|
//   potency_shared = Σ log(1 + intensity(c)) for c in A ∩ B
//   taste_frac     = |{c ∈ A ∩ B : same primary taste}| / |A ∩ B|
//   strength       = 0.6 * jaccard + 0.3 * norm(potency_shared) + 0.1 * taste_frac
//
// Emits only pairs with strength > 0.05 and |A ∩ B| >= 2.

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ROOT, PROCESSED, ensureDir, readJson, writeJson } from './common.js';

const OUT_DIR = path.resolve(ROOT, '..', 'public', 'chemDataset');

async function safeRead(p) {
  try { return await readJson(p); } catch { return null; }
}

function compoundsByIngredient(foodb) {
  const out = new Map();
  for (const [food, info] of Object.entries(foodb.foods || {})) {
    out.set(food.toLowerCase(), new Set(info.compounds || []));
  }
  return out;
}

// Map ChemTasteDB's fine-grained tastes onto the 7 Flavor-Bible channels
// used by tastePositioning.js. "tasteless"/"undefined" → null.
function normalizeTaste(raw) {
  if (!raw) return null;
  const t = String(raw).toLowerCase().trim();
  if (/sweet/.test(t)) return 'sweet';
  if (/bitter/.test(t)) return 'bitter';
  if (/sour|acid/.test(t)) return 'sour';
  if (/salty|salt/.test(t)) return 'salty';
  if (/umami|savory/.test(t)) return 'salty';
  if (/astringent/.test(t)) return 'astringent';
  if (/pungent/.test(t)) return 'pungent';
  if (/hot|spicy|pungent-hot|burning/.test(t)) return 'hot';
  if (/tasteless|undefined|none/.test(t)) return null;
  return null;
}

// FooDB's Compound.csv has unquoted commas in `description`, corrupting the
// cas_number / moldb_inchikey columns for many rows. As a pragmatic bridge
// to ChemTasteDB (which has only CAS / SMILES / name), we normalize compound
// names and match by name. Typical hit rate: ~10-15% of FooDB compounds.
function normalizeName(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')  // drop parenthetical prefixes like "(-)-"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function buildTasteByFooDBCompoundId({ foodb, chemtastedb, bitterdb, supersweetdb, predictions, predThreshold }) {
  const nameToTaste = new Map();
  for (const c of Object.values(chemtastedb?.compounds || {})) {
    const t = normalizeTaste(c.taste);
    if (!t || !c.name) continue;
    const k = normalizeName(c.name);
    if (k && !nameToTaste.has(k)) nameToTaste.set(k, t);
  }
  const out = new Map();
  const sources = { ground_truth: 0, predicted: 0 };
  const predMap = predictions?.predictions || null;
  for (const [cid, info] of Object.entries(foodb.compounds || {})) {
    const k = normalizeName(info.name);
    if (k && nameToTaste.has(k)) { out.set(cid, nameToTaste.get(k)); sources.ground_truth++; continue; }
    if (bitterdb?.compounds?.[cid])          { out.set(cid, 'bitter'); sources.ground_truth++; continue; }
    if (supersweetdb?.compounds?.[cid])      { out.set(cid, 'sweet');  sources.ground_truth++; continue; }
    // Predicted fallback: pick the highest-probability taste above threshold.
    if (predMap && predMap[cid]) {
      const probs = predMap[cid];
      let best = null, bestV = 0;
      for (const [t, v] of Object.entries(probs)) { if (v > bestV) { bestV = v; best = t; } }
      if (best && bestV >= predThreshold) { out.set(cid, best); sources.predicted++; }
    }
  }
  return { map: out, sources };
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function main() {
  const foodb = await safeRead(path.join(PROCESSED, 'foodb.json'));
  const flavordb = await safeRead(path.join(PROCESSED, 'flavordb.json'));
  const chemtastedb = await safeRead(path.join(PROCESSED, 'chemtastedb.json'));
  const bitterdb = await safeRead(path.join(PROCESSED, 'bitterdb.json'));
  const supersweetdb = await safeRead(path.join(PROCESSED, 'supersweetdb.json'));

  // Flavor-GNN predicted labels. Opt-in via USE_PREDICTIONS=1 so the
  // pre-GNN behavior stays default until the model is validated end-to-end.
  const usePredictions = process.env.USE_PREDICTIONS === '1';
  const predThreshold = Number(process.env.PRED_THRESHOLD || '0.6');
  const predictions = usePredictions
    ? await safeRead(path.join(PROCESSED, 'predictions.json'))
    : null;
  if (usePredictions) {
    console.log(`[blend] predictions: ${predictions ? `${predictions._count || 0} loaded, threshold=${predThreshold}` : 'file missing — skipping'}`);
  }

  if (!foodb || foodb._stub) {
    console.warn('[blend] FooDB is a stub — emitting empty graph so the UI still boots.');
    await ensureDir(OUT_DIR);
    await writeJson(path.join(OUT_DIR, 'ingredients.json'), { _stub: true });
    await writeJson(path.join(OUT_DIR, 'pairings.json'), []);
    return;
  }

  const compounds = compoundsByIngredient(foodb);
  const { map: tasteByCid, sources: tasteSources } = buildTasteByFooDBCompoundId({
    foodb, chemtastedb, bitterdb, supersweetdb, predictions, predThreshold,
  });
  console.log(`[blend] ${tasteByCid.size}/${Object.keys(foodb.compounds || {}).length} compounds mapped to a taste label `
    + `(ground_truth=${tasteSources.ground_truth}, predicted=${tasteSources.predicted})`);
  const ingredients = {};
  let taggedIngredients = 0;

  for (const [name, set] of compounds) {
    const tasteCount = {};
    let labeled = 0;
    for (const cid of set) {
      const t = tasteByCid.get(cid);
      if (!t) continue;
      tasteCount[t] = (tasteCount[t] || 0) + 1;
      labeled++;
    }
    // Emit a space-joined multi-taste string for every channel >= 20% share.
    // tastePositioning.scoreIngredient looks for substring keywords, so
    // "sweet bitter" activates both axes and the node sits between them.
    const MIN_SHARE = 0.2;
    const active = labeled > 0
      ? Object.entries(tasteCount).filter(([, n]) => n / labeled >= MIN_SHARE).map(([t]) => t)
      : [];
    const tasteStr = active.length ? active.join(' ') : null;
    if (tasteStr) taggedIngredients++;
    ingredients[name] = {
      category: null,
      taste: tasteStr,
      tasteMix: labeled > 0
        ? Object.fromEntries(Object.entries(tasteCount).map(([t, n]) => [t, n / labeled]))
        : {},
      compoundCount: set.size,
      labeledCompoundCount: labeled,
      sources: ['foodb'],
    };
  }
  console.log(`[blend] ${taggedIngredients}/${compounds.size} ingredients received a plurality taste label`);

  const names = [...compounds.keys()];
  const pairings = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = compounds.get(names[i]);
      const b = compounds.get(names[j]);
      const j_s = jaccard(a, b);
      if (j_s === 0) continue;
      let shared = 0;
      for (const x of a) if (b.has(x)) shared++;
      if (shared < 2) continue;
      const strength = 0.6 * j_s;
      if (strength < 0.05) continue;
      pairings.push({
        ingredientA: names[i],
        ingredientB: names[j],
        strength,
        shared_count: shared,
        jaccard: j_s,
      });
    }
  }

  await ensureDir(OUT_DIR);
  await writeJson(path.join(OUT_DIR, 'ingredients.json'), ingredients);
  await writeJson(path.join(OUT_DIR, 'pairings.json'), pairings);
  console.log(`[blend] Wrote ${Object.keys(ingredients).length} ingredients, ${pairings.length} pairings to ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
