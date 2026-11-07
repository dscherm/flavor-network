/**
 * WEAK-4 — rebuild the FM-Q2 amount model with kitchen-sensible units.
 *
 * Why: FM-Q1 (fm_p0_2_build_corpus.mjs parseLeadingAmount) only recognised a
 * unit when the lowercased token was literally a UNIT_DENSITY key. Plurals
 * ("cups", "lbs", "ounces", "tablespoons", "teaspoons"), packages
 * ("1 (16 oz.) pkg."), "garlic cloves" and "T." all fell through to 'each'
 * (100 g), so 'each' became the modal unit for chicken / pasta / olive oil and
 * qty = median_grams / 100 ("pasta: each 4.54" = 454 g = 1 lb).
 *
 * Stages (one command):
 *   1. parse — stream RecipeNLG once with src/ml/ingredientLineParser.js
 *      (same NER↔ingredient index alignment and vocab mapping as FM-Q1) →
 *      <data>/ingredient_quantities_v2.jsonl  {r, v, u, d, b}
 *      (skipped when the file exists; pass --reparse to force)
 *   2. build — per ingredient: pick the dimension (volume / weight / count) by
 *      vote, category default (ingredients.json) as tie-break; typical amount
 *      = median base amount in that dimension; express it in the kitchen unit
 *      for the category and round to kitchen fractions (src/ml/kitchenUnits.js).
 *   3. eval — (i) the original FM-Q2 metric on the ORIGINAL triples, old vs new
 *      artifact; (ii) a dimension-aware metric on the re-parsed holdout.
 *      Holdout = recipe id r % 10 == 0, as in FM-Q2.
 *
 * Usage:
 *   node flavor-gnn/scripts/weak4_quantity_model.mjs [--data-root D:/Projects/flavor-network] [--reparse]
 * --data-root is where proDataset/raw/ and flavor-gnn/data/ live (the big
 * gitignored files); defaults to this checkout.
 * Writes public/models/quantity_model.json, flavor-gnn/data/quantity_model.json
 * and flavor-gnn/data/weak4_eval.json (in this checkout).
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath, pathToFileURL } from 'url';
import { canonicalizeIngredient } from '../../proDataset/utils.js';
import { UNIT_DENSITY } from '../../src/data/portionParser.js';
import { parseIngredientLine, isPlausible } from '../../src/ml/ingredientLineParser.js';
import { CATEGORY_DEFAULT_DIMENSION, kitchenAmount, normalizeUnit, unitDimension, toBase } from '../../src/ml/kitchenUnits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const argVal = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const DATA_ROOT = path.resolve(argVal('--data-root') || ROOT);
const REPARSE = argv.includes('--reparse');

const DATA = path.join(DATA_ROOT, 'flavor-gnn', 'data');
const OLD_QTY = path.join(DATA, 'ingredient_quantities.jsonl');
const V2_QTY = path.join(ROOT, 'flavor-gnn', 'data', 'ingredient_quantities_v2.jsonl');
const CSV_CANDIDATES = ['recipenlg.csv', 'RecipeNLG_dataset.csv'].map((f) => path.join(DATA_ROOT, 'proDataset', 'raw', f));
const VOCAB_SRC = path.join(ROOT, 'public', 'proDataset', 'ingredients.json');
const OUT_PUBLIC = path.join(ROOT, 'public', 'models', 'quantity_model.json');
const OUT_DATA = path.join(ROOT, 'flavor-gnn', 'data', 'quantity_model.json');
const EVAL_PATH = path.join(ROOT, 'flavor-gnn', 'data', 'weak4_eval.json');

const MIN_SAMPLES = 5;
const TIE_RATIO = 0.8; // runner-up dimension within 80% of the leader → category default decides
const DIMS = ['volume', 'weight', 'count'];

function log(...a) { console.log('[weak-4]', ...a); }
function median(arr) {
  if (!arr.length) return null;
  const a = Float64Array.from(arr).sort();
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const ingredients = JSON.parse(fs.readFileSync(VOCAB_SRC, 'utf-8'));
const vocabNames = Object.keys(ingredients).map((k) => k.toLowerCase()).sort();
const vocabIndex = new Map(vocabNames.map((n, i) => [n, i]));
const categoryOf = new Map();
for (const [k, v] of Object.entries(ingredients)) categoryOf.set(k.toLowerCase(), v?.category || 'other');

function resolveVocabId(token) {
  const t = String(token).toLowerCase().trim();
  if (vocabIndex.has(t)) return vocabIndex.get(t);
  const canon = canonicalizeIngredient(t);
  if (canon) { const c = canon.toLowerCase(); if (vocabIndex.has(c)) return vocabIndex.get(c); }
  return null;
}

// ── Stage 1: parse ──────────────────────────────────────────────────────────
async function loadCsvParser() {
  const cands = [path.join(ROOT, 'proDataset', 'node_modules', 'csv-parser', 'index.js'),
    path.join(DATA_ROOT, 'proDataset', 'node_modules', 'csv-parser', 'index.js')];
  for (const c of cands) if (fs.existsSync(c)) return (await import(pathToFileURL(c).href)).default;
  throw new Error('csv-parser not found (npm install in proDataset/)');
}

async function parseStage() {
  const csvPath = CSV_CANDIDATES.find((p) => fs.existsSync(p));
  if (!csvPath) throw new Error(`RecipeNLG CSV not found in ${CSV_CANDIDATES.join(' | ')}`);
  const csvParser = await loadCsvParser();
  const out = fs.createWriteStream(V2_QTY, 'utf-8');
  let total = 0, lines = 0, parsed = 0, implausible = 0, written = 0;
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath, 'utf-8').pipe(csvParser())
      .on('data', (row) => {
        const rid = total++;
        if (total % 250000 === 0) log(`  ...${total} recipes, ${written} triples`);
        let ner, ings;
        try { ner = JSON.parse(row.NER || '[]'); ings = JSON.parse(row.ingredients || '[]'); } catch { return; }
        if (!Array.isArray(ner) || !Array.isArray(ings) || ings.length !== ner.length) return;
        for (let i = 0; i < ner.length; i++) {
          const id = resolveVocabId(ner[i]);
          if (id == null) continue;
          lines++;
          const a = parseIngredientLine(ings[i], ner[i]);
          if (!a) continue;
          parsed++;
          if (!isPlausible(a)) { implausible++; continue; }
          written++;
          out.write(`{"r":${rid},"v":${id},"u":"${a.unit}","d":"${a.dimension[0]}","b":${+a.base.toFixed(3)}}\n`);
        }
      })
      .on('end', resolve).on('error', reject);
  });
  await new Promise((r) => out.end(r));
  log(`parsed ${parsed}/${lines} mapped lines; ${implausible} implausible dropped; ${written} triples → ${V2_QTY}`);
  return { recipes: total, mapped_lines: lines, parsed, implausible_dropped: implausible, triples: written };
}

// ── Stage 2: build ──────────────────────────────────────────────────────────
const DIM_OF = { v: 'volume', w: 'weight', c: 'count' };

async function* readJsonl(p) {
  const rl = readline.createInterface({ input: fs.createReadStream(p, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) { if (!line) continue; try { yield JSON.parse(line); } catch { /* skip */ } }
}

/** Choose the measuring dimension for one ingredient. Exported logic mirrored in tests via kitchenUnits. */
function chooseDimension(votes, category) {
  const ranked = DIMS.filter((d) => votes[d] > 0).sort((a, b) => votes[b] - votes[a]);
  if (!ranked.length) return null;
  const def = CATEGORY_DEFAULT_DIMENSION[category];
  const top = ranked[0];
  if (def && def !== top && votes[def] >= TIE_RATIO * votes[top]) return def;
  return top;
}

async function buildStage() {
  const acc = new Map(); // v -> { votes:{}, base:{volume:[],weight:[],count:Map(unit->[])} }
  const test = [];
  const gVotes = { volume: 0, weight: 0, count: 0 };
  const gBase = { volume: [], weight: [], count: [] };
  for await (const o of readJsonl(V2_QTY)) {
    const dim = DIM_OF[o.d];
    if (o.r % 10 === 0) { test.push(o); continue; }
    let a = acc.get(o.v);
    if (!a) { a = { votes: { volume: 0, weight: 0, count: 0 }, volume: [], weight: [], count: new Map() }; acc.set(o.v, a); }
    a.votes[dim]++;
    gVotes[dim]++;
    if (dim === 'count') {
      const u = o.u === 'dozen' ? 'each' : o.u;
      let arr = a.count.get(u); if (!arr) { arr = []; a.count.set(u, arr); }
      arr.push(o.b);
      gBase.count.push(o.b);
    } else { a[dim].push(o.b); gBase[dim].push(o.b); }
  }
  log(`train ingredients: ${acc.size}; holdout rows: ${test.length}`);

  const model = {};
  const stats = { dims: { volume: 0, weight: 0, count: 0 }, tieBroken: 0, units: {} };
  for (const [v, a] of acc) {
    const name = vocabNames[v];
    const category = categoryOf.get(name) || 'other';
    let dim = chooseDimension(a.votes, category);
    const top = DIMS.slice().sort((x, y) => a.votes[y] - a.votes[x])[0];
    if (dim !== top) stats.tieBroken++;
    let countUnit = 'each', base;
    if (dim === 'count') {
      let best = null, bn = -1;
      for (const [u, arr] of a.count) if (arr.length > bn) { bn = arr.length; best = u; }
      countUnit = best;
      base = median(a.count.get(best));
    } else {
      base = median(a[dim]);
    }
    const k = kitchenAmount({ dimension: dim, base, category, countUnit });
    if (!k) continue;
    const n = a.votes.volume + a.votes.weight + a.votes.count;
    // grams: water-equivalent for volume, real grams for weight, UNIT_DENSITY for counts.
    const grams = dim === 'weight' ? base : dim === 'volume' ? base : k.qty * (UNIT_DENSITY[k.unit] ?? UNIT_DENSITY.each);
    model[v] = { unit: k.unit, qty: k.qty, grams: Math.round(grams * 10) / 10, n, d: dim[0] };
    stats.dims[dim]++;
    stats.units[k.unit] = (stats.units[k.unit] || 0) + 1;
  }

  const gDim = DIMS.slice().sort((x, y) => gVotes[y] - gVotes[x])[0];
  const gBaseMedian = median(gBase[gDim]);
  const gK = kitchenAmount({ dimension: gDim, base: gBaseMedian, category: 'other', countUnit: 'each' });
  const global = { unit: gK.unit, qty: gK.qty, grams: Math.round(gBaseMedian * 10) / 10, d: gDim[0] };

  const artifact = {
    _meta: {
      task: 'FM-Q2', revision: 'WEAK-4', minSamples: MIN_SAMPLES, ingredients: Object.keys(model).length,
      note: 'unit = kitchen unit (tsp/tbsp/cup/oz/lb/each/clove/…); qty rounded to kitchen fractions; d = dimension (v/w/c)',
      global,
    },
    model,
  };
  return { artifact, test, stats, gDim, gBaseMedian };
}

// ── Stage 3: eval ───────────────────────────────────────────────────────────
function evalOriginalMetric(artifact, rows) {
  // Exactly FM-Q2's metric: unit top-1 on the raw unit string, grams MdAPE
  // with UNIT_DENSITY (each = 100 g). Units compared after normalisation too.
  let n = 0, hitRaw = 0, hitNorm = 0; const ape = [];
  const g = artifact._meta.global;
  for (const o of rows) {
    const actualG = o.q * UNIT_DENSITY[o.u];
    if (!Number.isFinite(actualG) || actualG <= 0) continue;
    const m = artifact.model[o.v];
    const use = m && m.n >= MIN_SAMPLES;
    const predUnit = use ? m.unit : g.unit;
    const predG = use ? m.grams : g.grams;
    n++;
    if (predUnit === o.u) hitRaw++;
    if ((normalizeUnit(predUnit) || predUnit) === (normalizeUnit(o.u) || o.u)) hitNorm++;
    ape.push(Math.abs(predG - actualG) / actualG);
  }
  return { n, unit_top1_raw: +(hitRaw / n).toFixed(4), unit_top1_normalised: +(hitNorm / n).toFixed(4), qty_grams_MdAPE: +median(ape).toFixed(4) };
}

function oldPredDim(m) {
  const u = normalizeUnit(m.unit) || m.unit;
  const d = unitDimension(u === 'stick' ? 'stick' : u);
  return { dim: d || 'count', base: toBase(m.qty, u), unit: u };
}

// Grams-equivalent in the original FM-Q2 spirit (volume as water, counts by
// UNIT_DENSITY), but from the corrected parse instead of the each=100g artefact.
function gramsEquiv(unit, base, dim) {
  if (dim === 'count') return base * (UNIT_DENSITY[unit === 'dozen' ? 'each' : unit] ?? UNIT_DENSITY.each);
  return base; // ml ≈ g, g = g
}

function evalDimensionMetric(artifact, test, { legacy = false, globalDim, globalBase } = {}) {
  let n = 0, dimHit = 0, gDimHit = 0; const ape = [], gApe = [], gramApe = [];
  const g = artifact._meta.global;
  for (const o of test) {
    const dim = DIM_OF[o.d];
    const m = artifact.model[o.v];
    n++;
    if (globalDim === dim) gDimHit++;
    if (!m || m.n < MIN_SAMPLES) continue;
    const actualG = gramsEquiv(o.u, o.b, dim);
    let predG;
    if (legacy) predG = m.grams;
    else { const pd = DIM_OF[m.d]; predG = pd === 'count' ? m.qty * (UNIT_DENSITY[m.unit] ?? UNIT_DENSITY.each) : toBase(m.qty, m.unit); }
    if (actualG > 0) gramApe.push(Math.abs(predG - actualG) / actualG);
    let pDim, pBase;
    if (legacy) { const p = oldPredDim(m); pDim = p.dim; pBase = p.base; }
    else {
      pDim = DIM_OF[m.d];
      const u = m.unit;
      pBase = toBase(m.qty, u);
    }
    if (pDim === dim) {
      dimHit++;
      // within-dimension amount error (count compares like units only)
      if (dim !== 'count' || (legacy ? (normalizeUnit(m.unit) || m.unit) : m.unit) === (o.u === 'dozen' ? 'each' : o.u)) {
        ape.push(Math.abs(pBase - o.b) / o.b);
      }
    }
    if (globalDim === dim && dim !== 'count') gApe.push(Math.abs(globalBase - o.b) / o.b);
  }
  void g;
  return {
    n,
    dimension_top1: +(dimHit / n).toFixed(4),
    global_dimension_top1: +(gDimHit / n).toFixed(4),
    within_dimension_MdAPE: ape.length ? +median(ape).toFixed(4) : null,
    within_dimension_n: ape.length,
    global_within_dimension_MdAPE: gApe.length ? +median(gApe).toFixed(4) : null,
    grams_equiv_MdAPE_all_rows: gramApe.length ? +median(gramApe).toFixed(4) : null,
    grams_equiv_n: gramApe.length,
  };
}

async function run() {
  let parseReport = null;
  if (REPARSE || !fs.existsSync(V2_QTY)) parseReport = await parseStage();
  else log(`reusing ${V2_QTY} (pass --reparse to rebuild)`);

  const { artifact, test, stats, gDim, gBaseMedian } = await buildStage();
  const json = JSON.stringify(artifact);
  fs.writeFileSync(OUT_PUBLIC, json);
  fs.writeFileSync(OUT_DATA, json);
  log(`wrote ${OUT_PUBLIC} (${(json.length / 1024).toFixed(0)} KB, ${artifact._meta.ingredients} ingredients)`);
  log(`dimensions ${JSON.stringify(stats.dims)}; category tie-breaks ${stats.tieBroken}; units ${JSON.stringify(stats.units)}`);

  // Old artifact for comparison: git HEAD copy if present (pass --old <path>).
  const oldPath = argVal('--old');
  const oldArtifact = oldPath && fs.existsSync(oldPath) ? JSON.parse(fs.readFileSync(oldPath, 'utf-8')) : null;

  const report = { task: 'WEAK-4', parse: parseReport, model: { ...stats, global: artifact._meta.global } };
  if (fs.existsSync(OLD_QTY)) {
    const oldRows = [];
    for await (const o of readJsonl(OLD_QTY)) if (o.r % 10 === 0 && UNIT_DENSITY[o.u] != null) oldRows.push(o);
    report.original_fm_q2_metric = {
      note: 'FM-Q2 metric on the ORIGINAL FM-Q1 triples (whose units/grams carry the each=100g parse artefact)',
      new: evalOriginalMetric(artifact, oldRows),
      old: oldArtifact ? evalOriginalMetric(oldArtifact, oldRows) : null,
    };
  }
  report.reparsed_holdout_metric = {
    note: 'holdout r%10==0 of the WEAK-4 re-parse: dimension top-1 and within-dimension amount MdAPE in ml/g/count',
    new: evalDimensionMetric(artifact, test, { globalDim: gDim, globalBase: gBaseMedian }),
    old: oldArtifact ? evalDimensionMetric(oldArtifact, test, { legacy: true, globalDim: gDim, globalBase: gBaseMedian }) : null,
  };
  fs.writeFileSync(EVAL_PATH, JSON.stringify(report, null, 2));
  log(JSON.stringify(report, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
