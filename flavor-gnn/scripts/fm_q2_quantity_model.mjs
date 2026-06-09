/**
 * FM-Q2 — per-ingredient quantity model + held-out eval vs a global baseline.
 *
 * Reads flavor-gnn/data/ingredient_quantities.jsonl (FM-Q1: {r,v,q,u}) and the
 * app's UNIT_DENSITY (src/data/portionParser.js) to learn, per vocab ingredient:
 *   - modal unit  = most frequent unit for that ingredient
 *   - median grams = median of (qty * UNIT_DENSITY[unit]) over its train triples
 * The artifact stores a human-usable {unit, qty} where qty = median_grams /
 * density(modal_unit), plus grams + sample count.
 *
 * Eval (deterministic 10% holdout by recipe id r % 10 == 0):
 *   - unit top-1 accuracy: predicted modal unit == held-out unit
 *   - qty error in GRAMS (unit-invariant): MdAPE = median |pred_g - actual_g|/actual_g
 *   compared against a GLOBAL baseline (global modal unit + global median grams).
 * Per-ingredient must beat the global baseline on qty error (primary gate).
 *
 * Node (reuses UNIT_DENSITY directly). Writes flavor-gnn/data/quantity_model.json
 * and flavor-gnn/data/fm_q2_eval.json.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { UNIT_DENSITY } from '../../src/data/portionParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'flavor-gnn', 'data');
const QTY_PATH = path.join(DATA, 'ingredient_quantities.jsonl');
const MODEL_PATH = path.join(DATA, 'quantity_model.json');
const EVAL_PATH = path.join(DATA, 'fm_q2_eval.json');
const MIN_SAMPLES = 5; // below this, predict with the global baseline

function log(...a) { console.log('[fm-q2]', ...a); }
function median(arr) {
  if (!arr.length) return null;
  const a = Float64Array.from(arr).sort();
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

async function run() {
  if (!fs.existsSync(QTY_PATH)) { console.error(`missing ${QTY_PATH} — run FM-Q1 first`); process.exit(1); }

  // Train accumulators (r % 10 != 0); test rows held aside in arrays.
  const unitCounts = new Map();   // v -> Map(unit -> count)
  const gramsByV = new Map();     // v -> number[] grams (train)
  const globalGrams = [];         // all train grams
  const globalUnitCounts = new Map();
  const testRows = [];            // {v, q, u}
  let seen = 0, badUnit = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(QTY_PATH, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const dens = UNIT_DENSITY[o.u];
    if (dens == null) { badUnit++; continue; }
    seen++;
    if (o.r % 10 === 0) { testRows.push(o); continue; } // holdout
    const grams = o.q * dens;
    if (!Number.isFinite(grams) || grams <= 0) continue;
    // per-ingredient unit counts
    let uc = unitCounts.get(o.v); if (!uc) { uc = new Map(); unitCounts.set(o.v, uc); }
    uc.set(o.u, (uc.get(o.u) || 0) + 1);
    // per-ingredient grams
    let g = gramsByV.get(o.v); if (!g) { g = []; gramsByV.set(o.v, g); }
    g.push(grams);
    // global
    globalGrams.push(grams);
    globalUnitCounts.set(o.u, (globalUnitCounts.get(o.u) || 0) + 1);
  }
  log(`read ${seen} usable triples (${testRows.length} held out, ${badUnit} unknown-unit skipped)`);

  const modalOf = (m) => { let best = null, n = -1; for (const [u, c] of m) if (c > n) { n = c; best = u; } return best; };
  const globalModalUnit = modalOf(globalUnitCounts);
  const globalMedianGrams = median(globalGrams);
  log(`global baseline: unit=${globalModalUnit}, median=${globalMedianGrams.toFixed(1)}g`);

  // Build per-ingredient model.
  const model = {};
  for (const [v, g] of gramsByV) {
    const mu = modalOf(unitCounts.get(v));
    const mg = median(g);
    model[v] = {
      unit: mu,
      qty: Math.round((mg / UNIT_DENSITY[mu]) * 100) / 100,
      grams: Math.round(mg * 10) / 10,
      n: g.length,
    };
  }
  fs.writeFileSync(MODEL_PATH, JSON.stringify({
    _meta: { task: 'FM-Q2', minSamples: MIN_SAMPLES, ingredients: Object.keys(model).length,
             global: { unit: globalModalUnit,
                       qty: Math.round((globalMedianGrams / UNIT_DENSITY[globalModalUnit]) * 100) / 100,
                       grams: Math.round(globalMedianGrams * 10) / 10 } },
    model,
  }));
  log(`wrote quantity_model.json (${Object.keys(model).length} ingredients)`);

  // Eval on holdout.
  let nUnit = 0, hitUnitModel = 0, hitUnitGlobal = 0;
  const apeModel = [], apeGlobal = [];
  for (const o of testRows) {
    const actualG = o.q * UNIT_DENSITY[o.u];
    if (!Number.isFinite(actualG) || actualG <= 0) continue;
    const m = model[o.v];
    const useModel = m && m.n >= MIN_SAMPLES;
    const predUnit = useModel ? m.unit : globalModalUnit;
    const predG = useModel ? m.grams : globalMedianGrams;
    nUnit++;
    if (predUnit === o.u) hitUnitModel++;
    if (globalModalUnit === o.u) hitUnitGlobal++;
    apeModel.push(Math.abs(predG - actualG) / actualG);
    apeGlobal.push(Math.abs(globalMedianGrams - actualG) / actualG);
  }
  const results = {
    n_eval: nUnit,
    unit_top1_accuracy: { model: +(hitUnitModel / nUnit).toFixed(4), global: +(hitUnitGlobal / nUnit).toFixed(4) },
    qty_grams_MdAPE: { model: +median(apeModel).toFixed(4), global: +median(apeGlobal).toFixed(4) },
  };
  const beatsQty = results.qty_grams_MdAPE.model < results.qty_grams_MdAPE.global;
  fs.writeFileSync(EVAL_PATH, JSON.stringify({ task: 'FM-Q2', ...results, beats_baseline_on_qty: beatsQty }, null, 2));

  log(`unit acc  model=${results.unit_top1_accuracy.model}  global=${results.unit_top1_accuracy.global}`);
  log(`qty MdAPE model=${results.qty_grams_MdAPE.model}  global=${results.qty_grams_MdAPE.global}  ` +
      `(${beatsQty ? 'PASS' : 'FAIL'} primary gate)`);
  log('wrote fm_q2_eval.json');
}

run().catch((e) => { console.error(e); process.exit(1); });
