/**
 * FM-DIR1 / WEAK-2 — build the directions retrieval index
 *
 *   node flavor-gnn/scripts/fm_dir1_build_index.mjs
 *
 * Reads recipe_sets.jsonl (one line per de-duplicated RecipeNLG ingredient
 * set; `r` = the CSV's index column) + proDataset/raw/recipenlg.csv and
 * writes public/models/directions_index.json:
 *   {
 *     "_meta": { recipes, builtFrom, cap, seed, filters, sources, sizeBytes, … },
 *     "vocab_ref": "recipe_vocab.json",
 *     "recipes": [{ "v":[ids], "t": title, "d": [step,...] }],
 *     "inv": { "<vocab_id>": [recipeArrayIndex,...] }
 *   }
 *
 * WEAK-2 (2026-11-07). The v1 index took the first 40 000 sets in file
 * order — all from RecipeNLG's scraped "Gathered" (cookbooks.com) rows —
 * and trusted them. Measured on it: 15.5% of entries' steps mention none
 * of their ingredients, 41% repeat a title, 6.5% have a title naming a
 * food the list lacks. The CSV join itself was NOT the cause: the parsed
 * row counter equals the CSV index column on all 2,231,142 rows, and every
 * corpus title matches its CSV row. The mismatches are in the source data
 * (CSV row 38762 "Barbecue Wieners" really carries turkey steps). So:
 *
 *   Pass 1 (CSV): for every candidate set (3–10 mapped ingredients), join on
 *     the CSV index column (csv-parser names the blank header ''), confirm
 *     the title, and drop the recipe when
 *       • its steps mention < 1/3 of its raw (NER) ingredients, or none of
 *         its mapped (vocab) ingredients;
 *       • its title names a headline food (MAIN_FOODS) missing from the
 *         mapped list — or, for a food the vocab cannot represent
 *         (wieners/franks), from the raw list;
 *       • its steps cook a meat that neither the list nor the title has;
 *       • its steps are empty or longer than MAX_STEP_CHARS (1000 chars — a
 *         phone-card method, and what keeps 40 000 entries near 20 MB).
 *     Survivors are kept as light records grouped by normalised title.
 *   Select: per title keep the most complete variant (most mapped
 *     ingredients, then steps, then alignment) plus at most one more whose
 *     mapped set overlaps it by ≤ 25% Jaccard (a genuinely different dish
 *     under the same name). Titles are taken in seeded-hash order — a
 *     uniform, reproducible random sample over distinct titles — until
 *     40 000 entries (or an estimated 23.5 MB, whichever comes first).
 *   Pass 2 (CSV): fetch the steps of the chosen rows.
 *
 * Pure checks live in src/ml/directionsQuality.js (unit-tested);
 * fm_dir1_measure.mjs reports the quality numbers on any index.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from '../../proDataset/node_modules/csv-parser/index.js';
import {
  normalizeTitle, stepMentions, missingTitleFoods, foreignMeats, representableFoods,
  pickTitleVariants, seededHash, MAIN_FOODS,
} from '../../src/ml/directionsQuality.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// The two inputs are gitignored; a worktree can point at the main checkout
// with FM_DATA_ROOT=D:/Projects/flavor-network.
const DATA_ROOT  = process.env.FM_DATA_ROOT || ROOT;
const SETS_PATH  = path.join(DATA_ROOT, 'flavor-gnn', 'data', 'recipe_sets.jsonl');
const CSV_PATH   = path.join(DATA_ROOT, 'proDataset', 'raw', 'recipenlg.csv');
const VOCAB_PATH = path.join(ROOT, 'public', 'models', 'recipe_vocab.json');
const OUT_PATH   = path.join(ROOT, 'public', 'models', 'directions_index.json');

const CAP            = 40_000;
const NM_MIN         = 3;
const NM_MAX         = 10;
const SEED           = 20261107;
const MIN_ALIGN      = 1 / 3;
const MAX_VARIANTS   = 2;
const VARIANT_JACC   = 0.25;
const MAX_STEP_CHARS = 1000;          // a phone-card method; also keeps the file in budget
const BYTE_BUDGET    = 23_500_000;       // selection stops before this (estimated bytes)
const SIZE_LIMIT     = 25_000_000;       // 25 MB uncompressed hard stop

function log(...a) { console.log('[fm-dir1]', ...a); }

const clip = (t) => String(t || '').slice(0, 80).replace(/[\r\n]/g, ' ');
const cleanSteps = (dirs) => dirs.map((s) => String(s).replace(/\s+/g, ' ').trim()).filter(Boolean);

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// ── Phase 1: candidate sets from recipe_sets.jsonl ───────────────────────────
async function collectCandidates() {
  log('Phase 1: collecting candidates from recipe_sets.jsonl …');
  const candidates = new Map(); // csv index → { v, t }
  let lines = 0, bad = 0;
  await new Promise((resolve, reject) => {
    let buf = '';
    const take = (line) => {
      if (!line.trim()) return;
      lines++;
      let rec;
      try { rec = JSON.parse(line); } catch { bad++; return; }
      const { r, v, nm, t } = rec;
      if (typeof nm !== 'number' || nm < NM_MIN || nm > NM_MAX) return;
      if (!Array.isArray(v) || v.length < NM_MIN) return;
      candidates.set(r, { v: [...v].sort((a, b) => a - b), t });
    };
    fs.createReadStream(SETS_PATH, 'utf-8')
      .on('data', (chunk) => {
        buf += chunk;
        let idx;
        while ((idx = buf.indexOf('\n')) !== -1) { take(buf.slice(0, idx)); buf = buf.slice(idx + 1); }
      })
      .on('end', () => { take(buf); resolve(); })
      .on('error', reject);
  });
  log(`  ${candidates.size} candidates with ${NM_MIN}–${NM_MAX} mapped ingredients (${lines} lines, ${bad} unparseable)`);
  return candidates;
}

function streamCsv(onRow) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH, 'utf-8').pipe(csvParser())
      .on('data', onRow).on('end', resolve).on('error', reject);
  });
}

// ── Pass 1: quality-check every candidate, group survivors by title ──────────
async function screen(candidates, vocab, representable) {
  log('Pass 1: screening candidates against the CSV …');
  const groups = new Map(); // normalised title → [{ r, v, nSteps, align, src }]
  const stats = {
    rows: 0, candidates: 0, counterDrift: 0, titleMismatch: 0, emptySteps: 0, tooLong: 0,
    misaligned: 0, noMappedMention: 0, titleFoodMissing: 0, foreignMeat: 0, passed: 0,
  };
  let counter = 0;
  await streamCsv((row) => {
    const r = Number(row['']);
    if (r !== counter++) stats.counterDrift++;
    stats.rows++;
    if (stats.rows % 250000 === 0) log(`  …${stats.rows} rows, ${stats.passed} passed`);
    const cand = candidates.get(r);
    if (!cand) return;
    stats.candidates++;
    if (normalizeTitle(clip(row.title)) !== normalizeTitle(cand.t)) { stats.titleMismatch++; return; }

    let dirs, ner;
    try { dirs = JSON.parse(row.directions || '[]'); } catch { dirs = null; }
    try { ner = JSON.parse(row.NER || '[]'); } catch { ner = []; }
    const steps = Array.isArray(dirs) ? cleanSteps(dirs) : [];
    if (steps.length === 0) { stats.emptySteps++; return; }
    if (steps.join(' ').length > MAX_STEP_CHARS) { stats.tooLong++; return; }
    const raw = (Array.isArray(ner) ? ner : []).map((n) => String(n).toLowerCase().trim()).filter(Boolean);
    const mapped = cand.v.map((id) => vocab[id]);

    const rawM = stepMentions(steps, raw.length ? raw : mapped);
    if (rawM.mentioned < 1 || rawM.frac < MIN_ALIGN) { stats.misaligned++; return; }
    if (stepMentions(steps, mapped).mentioned < 1) { stats.noMappedMention++; return; }
    const title = String(row.title || '').trim();
    if (missingTitleFoods(title, { mapped, raw, representable }).length) { stats.titleFoodMissing++; return; }
    if (foreignMeats(steps, title, raw.length ? raw : mapped).length) { stats.foreignMeat++; return; }

    stats.passed++;
    const key = normalizeTitle(title);
    if (!key) return;
    let g = groups.get(key);
    if (!g) { g = []; groups.set(key, g); }
    // Estimated serialised bytes: steps + title + ids, and the ids' inv postings.
    const bytes = JSON.stringify(steps).length + title.length + 7 * cand.v.length + 24;
    g.push({ r, v: cand.v, nSteps: steps.length, align: rawM.frac, src: row.source || '', bytes });
  });
  log(`  ${JSON.stringify(stats)}`);
  log(`  ${groups.size} distinct normalised titles among survivors`);
  return { groups, stats };
}

// ── Select: variants per title, seeded sample of titles ──────────────────────
function select(groups) {
  log('Selecting …');
  const titles = [...groups.keys()].sort((a, b) =>
    (seededHash(hashString(a), SEED) - seededHash(hashString(b), SEED)) || (a < b ? -1 : 1));
  const chosen = new Map(); // r → { v, key }
  let titlesTaken = 0, secondVariants = 0, bytes = 0;
  for (const key of titles) {
    if (chosen.size >= CAP || bytes >= BYTE_BUDGET) break;
    const picks = pickTitleVariants(groups.get(key), { maxVariants: MAX_VARIANTS, maxJaccard: VARIANT_JACC, seed: SEED });
    titlesTaken++;
    for (let i = 0; i < picks.length && chosen.size < CAP; i++) {
      chosen.set(picks[i].r, { v: picks[i].v, src: picks[i].src });
      bytes += picks[i].bytes;
      if (i > 0) secondVariants++;
    }
  }
  const sources = {};
  for (const { src } of chosen.values()) sources[src] = (sources[src] || 0) + 1;
  log(`  ${chosen.size} entries from ${titlesTaken} titles (${secondVariants} second variants, ~${(bytes / 1e6).toFixed(1)} MB est.); sources ${JSON.stringify(sources)}`);
  return { chosen, titlesTaken, secondVariants, sources };
}

// ── Pass 2: fetch the chosen rows' steps ─────────────────────────────────────
async function fetchSteps(chosen) {
  log('Pass 2: fetching steps for chosen rows …');
  const kept = [];
  await streamCsv((row) => {
    const r = Number(row['']);
    const c = chosen.get(r);
    if (!c) return;
    let dirs;
    try { dirs = JSON.parse(row.directions || '[]'); } catch { dirs = []; }
    kept.push({ r, v: c.v, t: String(row.title || '').trim().slice(0, 120), d: cleanSteps(dirs) });
  });
  log(`  fetched ${kept.length}`);
  return kept;
}

function buildOutput(kept, meta) {
  kept.sort((a, b) => a.r - b.r);
  const recipes = kept.map(({ v, t, d }) => ({ v, t, d }));
  const inv = {};
  for (let i = 0; i < recipes.length; i++) {
    for (const id of recipes[i].v) (inv[String(id)] ||= []).push(i);
  }
  return {
    _meta: {
      recipes: recipes.length,
      builtFrom: 'recipe_sets.jsonl + recipenlg.csv (joined on the CSV index column)',
      cap: CAP,
      nmRange: [NM_MIN, NM_MAX],
      seed: SEED,
      selectionRule: 'WEAK-2: quality-filtered (steps mention >=1/3 of ingredients, title foods present, no foreign meats); per normalised title the most complete variant + <=1 more with Jaccard <= 0.25; titles sampled in seeded-hash order',
      ...meta,
      sizeBytes: 0,
    },
    vocab_ref: 'recipe_vocab.json',
    recipes,
    inv,
  };
}

async function run() {
  for (const p of [SETS_PATH, CSV_PATH, VOCAB_PATH]) {
    if (!fs.existsSync(p)) { console.error('Missing:', p); process.exit(1); }
  }
  const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8')).vocab;
  const representable = representableFoods(vocab);
  log(`vocab ${vocab.length}; title foods the vocab cannot represent: ${Object.keys(MAIN_FOODS).filter((k) => !representable.has(k)).join(', ')}`);

  const candidates = await collectCandidates();
  const { groups, stats } = await screen(candidates, vocab, representable);
  if (stats.counterDrift || stats.titleMismatch) log(`  NOTE: counter drift ${stats.counterDrift}, title mismatches ${stats.titleMismatch}`);
  const { chosen, titlesTaken, secondVariants, sources } = select(groups);
  const kept = await fetchSteps(chosen);
  const out = buildOutput(kept, { screen: stats, distinctTitles: groups.size, titlesTaken, secondVariants, sources });

  const bytes = Buffer.byteLength(JSON.stringify(out), 'utf-8');
  if (bytes > SIZE_LIMIT) {
    log(`ABORT: ${(bytes / 1e6).toFixed(1)} MB exceeds the 25 MB limit — lower CAP or MAX_STEP_CHARS.`);
    process.exit(1);
  }
  out._meta.sizeBytes = bytes;
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out), 'utf-8');
  log(`Written ${OUT_PATH}: ${out.recipes.length} recipes, ${Object.keys(out.inv).length} inv keys, ${(bytes / 1e6).toFixed(2)} MB`);
}

run().catch((e) => { console.error(e); process.exit(1); });
