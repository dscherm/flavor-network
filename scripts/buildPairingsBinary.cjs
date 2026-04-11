#!/usr/bin/env node
/**
 * buildPairingsBinary.cjs — pack proDataset/pairings.json into a
 * minimal binary file.
 *
 * Only three fields are actually read by the app:
 *   ingredientA (string)
 *   ingredientB (string)
 *   strength    (number)
 *
 * Every other field (tradition, chemistry, novelty, balance, bridging,
 * sharedCompounds, explanation, breakdown.x1..x8, known,
 * predictedNovelty, flavorDistance) is dead weight and gets dropped.
 *
 * Binary layout (little-endian):
 *   magic         : 4 bytes  — 'FNPR'
 *   version       : u32      — 1
 *   count         : u32      — number of pairing records
 *   records[count]:
 *     idxA        : u16      — index into ingredients.json key order
 *     idxB        : u16      — index into ingredients.json key order
 *     strength    : f32      — normalized strength value
 *
 * Any pairing whose ingredient is missing from ingredients.json is
 * skipped (the old JS reader skipped these anyway via `nodes.has()`).
 * Indices are capped at 65535 — script aborts if the ingredient count
 * exceeds this.
 */

const fs = require('fs');
const path = require('path');

const PRODATASET = path.join(__dirname, '..', 'public', 'proDataset');
const INGREDIENTS_PATH = path.join(PRODATASET, 'ingredients.json');
const PAIRINGS_JSON = path.join(PRODATASET, 'pairings.json');
const OUT_BIN = path.join(PRODATASET, 'pairings.bin');

function main() {
  console.log('[build-bin] reading', INGREDIENTS_PATH);
  const ingredientsRaw = fs.readFileSync(INGREDIENTS_PATH, 'utf-8');
  const ingredients = JSON.parse(ingredientsRaw);

  // Build name -> index map using insertion order, skipping meta keys.
  const nameToIdx = new Map();
  let idx = 0;
  for (const key of Object.keys(ingredients)) {
    if (key.startsWith('_')) continue;
    nameToIdx.set(key, idx++);
  }
  if (nameToIdx.size > 0xffff) {
    throw new Error(
      `ingredient count ${nameToIdx.size} exceeds u16 cap (65535) — ` +
      `widen idx fields to u32 in the binary format`
    );
  }
  console.log(`[build-bin] indexed ${nameToIdx.size} ingredients`);

  console.log('[build-bin] reading', PAIRINGS_JSON);
  const pairingsRaw = fs.readFileSync(PAIRINGS_JSON, 'utf-8');
  const pairings = JSON.parse(pairingsRaw);
  console.log(`[build-bin] ${pairings.length} pairings in source JSON`);

  // First pass: count valid records so we can allocate the buffer
  // exactly. A pairing is valid only if both ingredients are known.
  let valid = 0;
  for (const p of pairings) {
    if (nameToIdx.has(p.ingredientA) && nameToIdx.has(p.ingredientB)) {
      valid += 1;
    }
  }
  console.log(`[build-bin] ${valid} pairings have both ingredients in the index`);

  const HEADER_BYTES = 12;
  const RECORD_BYTES = 8;
  const totalBytes = HEADER_BYTES + valid * RECORD_BYTES;
  const buf = Buffer.alloc(totalBytes);

  // Header
  buf.write('FNPR', 0, 'ascii');
  buf.writeUInt32LE(1, 4);
  buf.writeUInt32LE(valid, 8);

  // Records
  let offset = HEADER_BYTES;
  for (const p of pairings) {
    const a = nameToIdx.get(p.ingredientA);
    const b = nameToIdx.get(p.ingredientB);
    if (a === undefined || b === undefined) continue;
    buf.writeUInt16LE(a, offset);
    buf.writeUInt16LE(b, offset + 2);
    buf.writeFloatLE(Number(p.strength) || 0, offset + 4);
    offset += RECORD_BYTES;
  }

  fs.writeFileSync(OUT_BIN, buf);

  const jsonStat = fs.statSync(PAIRINGS_JSON);
  console.log('');
  console.log('[build-bin] done');
  console.log(`  source JSON : ${(jsonStat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  packed bin  : ${(totalBytes / 1024).toFixed(1)} KB`);
  console.log(`  ratio       : ${(totalBytes / jsonStat.size * 100).toFixed(2)}%`);
  console.log(`  output      : ${OUT_BIN}`);
}

main();
