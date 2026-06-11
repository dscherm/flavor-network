/**
 * FM-DIR1 — build directions retrieval index
 *
 * Reads recipe_sets.jsonl + recipenlg.csv, keeps recipes with 3–10 mapped
 * ingredients, dedupes by sorted-id-set, caps at 40 000, then streams the CSV
 * once to extract directions for every kept recipe.
 *
 * Output: public/models/directions_index.json
 *   {
 *     "_meta": { recipes, builtFrom, cap, sizeBytes },
 *     "vocab_ref": "recipe_vocab.json",
 *     "recipes": [{ "v":[ids], "t": title, "d": [step,...] }],
 *     "inv": { "<vocab_id>": [recipeArrayIndex,...] }
 *   }
 *
 * Selection rule for the 40k cap:
 *   Stream recipe_sets.jsonl in file order (which is already CSV-order with
 *   duplicates removed). Accept each recipe that passes the nm ∈ [3,10] gate
 *   and whose sorted-id key has not been seen before (redundant safety; the
 *   file is already deduped). Stop accepting once we have 40 000 entries.
 *   "First 40 000 deduped recipes in corpus order" is deterministic and gives
 *   good diversity because RecipeNLG mixes many sources and categories.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from '../../proDataset/node_modules/csv-parser/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const SETS_PATH  = path.join(ROOT, 'flavor-gnn', 'data', 'recipe_sets.jsonl');
const CSV_PATH   = path.join(ROOT, 'proDataset', 'raw', 'recipenlg.csv');
const OUT_PATH   = path.join(ROOT, 'public', 'models', 'directions_index.json');

const CAP        = 40_000;
const NM_MIN     = 3;
const NM_MAX     = 10;
const SIZE_LIMIT = 25 * 1024 * 1024; // 25 MB uncompressed hard stop

function log(...a) { console.log('[fm-dir1]', ...a); }

// ── Phase 1: stream recipe_sets.jsonl, collect candidate set ─────────────────
async function collectCandidates() {
  log('Phase 1: collecting candidates from recipe_sets.jsonl …');
  // Map: csvRowIndex → { v:[ids], t:title }
  const candidates = new Map();
  const seenKeys   = new Set();
  let lineNo = 0;

  await new Promise((resolve, reject) => {
    const rl = fs.createReadStream(SETS_PATH, 'utf-8');
    let buf = '';

    rl.on('data', chunk => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        lineNo++;

        if (candidates.size >= CAP) continue; // fast-skip once capped

        let rec;
        try { rec = JSON.parse(line); } catch { continue; }

        const { r, v, nm, t } = rec;
        if (typeof nm !== 'number' || nm < NM_MIN || nm > NM_MAX) continue;
        if (!Array.isArray(v) || v.length < NM_MIN) continue;

        const key = [...v].sort((a, b) => a - b).join(',');
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        candidates.set(r, { v: [...v].sort((a, b) => a - b), t: (t || '').slice(0, 120) });
      }
    });
    rl.on('end', () => {
      // flush remaining buffer
      if (buf.trim()) {
        try {
          const rec = JSON.parse(buf.trim());
          if (candidates.size < CAP) {
            const { r, v, nm, t } = rec;
            if (typeof nm === 'number' && nm >= NM_MIN && nm <= NM_MAX && Array.isArray(v)) {
              const key = [...v].sort((a, b) => a - b).join(',');
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                candidates.set(r, { v: [...v].sort((a, b) => a - b), t: (t || '').slice(0, 120) });
              }
            }
          }
        } catch { /* ignore */ }
      }
      resolve();
    });
    rl.on('error', reject);
  });

  log(`  collected ${candidates.size} candidates (cap=${CAP}), scanned ${lineNo} lines`);
  return candidates;
}

// ── Phase 2: stream CSV once, extract directions for kept rows ────────────────
async function extractDirections(candidates) {
  log('Phase 2: streaming CSV to extract directions …');
  // recipes array in CSV-row order (we'll sort by r at the end to be deterministic)
  const kept = []; // [{ r, v, t, d:[...] }]
  let row = 0;
  let dropped = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH, 'utf-8')
      .pipe(csvParser())
      .on('data', (csvRow) => {
        const r = row++;
        if (!candidates.has(r)) return;

        const { v, t } = candidates.get(r);

        let dirs;
        try { dirs = JSON.parse(csvRow.directions || '[]'); } catch { dirs = null; }
        if (!Array.isArray(dirs) || dirs.length === 0) { dropped++; return; }

        // Clean steps: trim, filter empty strings.
        const steps = dirs.map(s => String(s).trim()).filter(Boolean);
        if (steps.length === 0) { dropped++; return; }

        kept.push({ r, v, t, d: steps });
        if (kept.length % 5000 === 0) log(`  …${kept.length} kept so far (row ${r})`);
      })
      .on('end', resolve)
      .on('error', reject);
  });

  log(`  directions extracted: ${kept.length}, dropped (empty/bad dirs): ${dropped}`);
  return kept;
}

// ── Phase 3: build output structure + inverted index ─────────────────────────
function buildOutput(kept, vocabLength) {
  log('Phase 3: building output structure …');

  // Sort by original CSV row for determinism.
  kept.sort((a, b) => a.r - b.r);

  const recipes = kept.map(({ v, t, d }) => ({ v, t, d }));

  // Inverted index: vocab_id → [recipeArrayIndex, ...]
  const inv = {};
  for (let i = 0; i < recipes.length; i++) {
    for (const id of recipes[i].v) {
      const key = String(id);
      if (!inv[key]) inv[key] = [];
      inv[key].push(i);
    }
  }

  return {
    _meta: {
      recipes: recipes.length,
      builtFrom: 'recipe_sets.jsonl + recipenlg.csv',
      cap: CAP,
      nmRange: [NM_MIN, NM_MAX],
      selectionRule: 'First 40000 deduped recipes in recipe_sets.jsonl corpus order with nm in [3,10]',
      sizeBytes: 0, // filled after serialise
    },
    vocab_ref: 'recipe_vocab.json',
    recipes,
    inv,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  if (!fs.existsSync(SETS_PATH)) { console.error('Missing:', SETS_PATH); process.exit(1); }
  if (!fs.existsSync(CSV_PATH))  { console.error('Missing:', CSV_PATH);  process.exit(1); }

  const candidates = await collectCandidates();
  const kept       = await extractDirections(candidates);
  const out        = buildOutput(kept, 3891);

  log('Serialising …');
  const json      = JSON.stringify(out);
  const bytes     = Buffer.byteLength(json, 'utf-8');
  out._meta.sizeBytes = bytes;

  if (bytes > SIZE_LIMIT) {
    log(`WARNING: uncompressed size ${(bytes / 1e6).toFixed(1)} MB exceeds 25 MB limit.`);
    log('Reduce CAP and rebuild. Aborting output write.');
    process.exit(1);
  }

  // Re-serialise with updated sizeBytes.
  const jsonFinal = JSON.stringify(out);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, jsonFinal, 'utf-8');

  log(`Written: ${OUT_PATH}`);
  log(`  recipes in index : ${out.recipes.length}`);
  log(`  inv index keys   : ${Object.keys(out.inv).length}`);
  log(`  uncompressed size: ${(bytes / 1e6).toFixed(2)} MB`);
  log('Done.');
}

run().catch(e => { console.error(e); process.exit(1); });
