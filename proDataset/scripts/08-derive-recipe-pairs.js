/**
 * 08-derive-recipe-pairs.js
 *
 * Derives a slim browser-shippable `recipe_pairs.json` from the 39 MB
 * `processed/recipenlg-cooccurrence.json`. For each ingredient, keeps
 * the top-K partners by raw recipe co-occurrence count plus the
 * ingredient's global recipe count for the familiarity floor.
 *
 * Output schema:
 *   {
 *     "_meta": { "topK": 50, "totalRecipes": 2231142, "ingredients": N },
 *     "globalCount": { "<name>": <count>, ... },
 *     "pairs":       { "<name>": { "<partner>": <count>, ... } }
 *   }
 *
 * Drives the Recipe Lab suggestion engine (Approach A — weighted
 * recipe-level co-occurrence + familiarity floor).
 */

import fs from 'fs';
import path from 'path';
import { PROCESSED_DIR } from '../config.js';
import { ensureDir, log } from '../utils.js';

const TOP_K = 50;
const INPUT  = path.join(PROCESSED_DIR, 'recipenlg-cooccurrence.json');
const OUTPUT = path.join(process.cwd(), '..', 'public', 'proDataset', 'recipe_pairs.json');

async function run() {
  log('Step 8: Derive slim recipe_pairs.json (top-K partners + globalCount)');

  if (!fs.existsSync(INPUT)) {
    throw new Error(`Missing ${INPUT}. Run step 1 (parse-recipenlg) first.`);
  }

  log(`  Reading ${INPUT} (~39 MB)...`);
  const raw = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  const { pairs, ingredients, totalRecipes } = raw;

  if (!pairs || !ingredients) {
    throw new Error('recipenlg-cooccurrence.json missing required keys (pairs, ingredients)');
  }

  // Bucket every pair count under both endpoints so we can pick top-K per ingredient.
  log('  Bucketing pairs per ingredient...');
  const partnersByIng = new Map();   // name → Array<[partner, count]>
  let pairCount = 0;
  for (const [key, info] of Object.entries(pairs)) {
    const sep = key.indexOf('|');
    if (sep < 0) continue;
    const a = key.slice(0, sep);
    const b = key.slice(sep + 1);
    const c = info?.count | 0;
    if (!c) continue;
    if (!partnersByIng.has(a)) partnersByIng.set(a, []);
    if (!partnersByIng.has(b)) partnersByIng.set(b, []);
    partnersByIng.get(a).push([b, c]);
    partnersByIng.get(b).push([a, c]);
    pairCount++;
  }
  log(`  Bucketed ${pairCount} pairs across ${partnersByIng.size} ingredients`);

  // Truncate each ingredient's partner list to top-K by count.
  log(`  Truncating to top-${TOP_K} partners per ingredient...`);
  const slimPairs = {};
  let totalKeptEdges = 0;
  for (const [name, arr] of partnersByIng) {
    arr.sort((x, y) => y[1] - x[1]);
    const top = arr.slice(0, TOP_K);
    const obj = {};
    for (const [partner, count] of top) obj[partner] = count;
    slimPairs[name] = obj;
    totalKeptEdges += top.length;
  }

  // globalCount comes straight from `ingredients` (raw recipe count per ingredient).
  // This drives the familiarity floor — common ingredients (onion, garlic) score
  // higher; obscure ones get demoted.
  const globalCount = {};
  for (const [name, n] of Object.entries(ingredients)) {
    if (typeof n === 'number') globalCount[name] = n;
  }

  const output = {
    _meta: {
      topK: TOP_K,
      totalRecipes,
      ingredients: Object.keys(globalCount).length,
      generatedAt: new Date().toISOString(),
    },
    globalCount,
    pairs: slimPairs,
  };

  ensureDir(path.dirname(OUTPUT));
  fs.writeFileSync(OUTPUT, JSON.stringify(output));
  const sizeKB = Math.round(fs.statSync(OUTPUT).size / 1024);
  log(`  Wrote ${OUTPUT}`);
  log(`    ${Object.keys(slimPairs).length} ingredients, ${totalKeptEdges} edges, ${sizeKB} KB`);
}

run().catch(err => { console.error(err); process.exit(1); });
