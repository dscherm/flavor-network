/**
 * 19-augment-pairings-for-gnn.js
 *
 * The 32 cuisine-defining ingredients added in c563f38 / b2df911 have
 * no edges in public/proDataset/pairings.json (07-blend-v2 ran before
 * the merge; it derives pairings from raw RecipeNLG co-occurrence and
 * never sees the manual additions). Their pair data lives only in
 * cuisine_pairings.json + the manual-bootstrap edges from 17-.
 *
 * For the GNN pipeline (Node2Vec → UMAP → k-means) to position +
 * cluster them properly, those edges need to live in pairings.json.
 * This script synthesizes a chemistry-style edge for every cuisine
 * pair where either endpoint is currently missing from pairings.json.
 *
 * Strength derivation:
 *   strength = min(0.6, cuisineBoost(record) * 0.8)
 * The 0.8 multiplier + 0.6 cap keeps cuisine-only edges from
 * dominating chemistry-strong edges in the Node2Vec walk weighting.
 *
 * Idempotent: a pair that already exists in pairings.json is left
 * untouched (chemistry strength wins).
 *
 * Writes to public/proDataset/pairings.json directly (backed up as
 * pairings.json.pregnn for rollback).
 */
import fs from 'fs';
import path from 'path';
import { OUTPUT_DIR } from '../config.js';
import { log } from '../utils.js';

const PUBLIC_DIR = path.resolve(OUTPUT_DIR, '..', '..', 'public', 'proDataset');
const PAIRINGS_PATH = path.join(PUBLIC_DIR, 'pairings.json');
const CUISINE_PAIRS_PATH = path.join(PUBLIC_DIR, 'cuisine_pairings.json');
const INGREDIENTS_PATH = path.join(PUBLIC_DIR, 'ingredients.json');
const BACKUP_PATH = path.join(PUBLIC_DIR, 'pairings.json.pregnn');

function pairKey(a, b) {
  const la = String(a).toLowerCase().trim();
  const lb = String(b).toLowerCase().trim();
  return la < lb ? `${la}|${lb}` : `${lb}|${la}`;
}

// Mirror of cuisinePairings.cuisineBoost() from src/data/cuisinePairings.js
// so the augmentation strength matches the runtime weighting.
function cuisineBoost(record) {
  if (!record) return 0;
  const ev = record.evidence;
  if (!Array.isArray(ev) || ev.length === 0) return 0;
  const primary = ev[0];
  if (primary.count < 5) return 0;
  if (ev.length > 1 && primary.recipePct < 1.5 * ev[1].recipePct) return 0;
  const credibility = Math.min(1, primary.recipePct * 4);
  const evidence = Math.min(1, Math.log10(primary.count + 1) / 3);
  const novelty = record.novelty ?? 1.0;
  return credibility * 0.5 + evidence * 0.3 + novelty * 0.2;
}

function main() {
  log('=== 19: augment pairings.json with cuisine edges for GNN ===');

  const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf8'));
  const cuisinePairs = JSON.parse(fs.readFileSync(CUISINE_PAIRS_PATH, 'utf8'));
  const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf8'));
  const knownIngredients = new Set(Object.keys(ingredients).filter(k => !k.startsWith('_')));

  log(`Initial chemistry pairings: ${pairings.length}`);
  log(`Cuisine pairs available: ${Object.keys(cuisinePairs.pairs || {}).length}`);

  // Index existing pairings.
  const existing = new Set();
  for (const p of pairings) {
    existing.add(pairKey(p.ingredientA, p.ingredientB));
  }

  // Backup before mutating.
  fs.copyFileSync(PAIRINGS_PATH, BACKUP_PATH);
  log(`Backed up original to ${BACKUP_PATH}`);

  let added = 0;
  let skippedExisting = 0;
  let skippedLowStrength = 0;
  let skippedUnknown = 0;

  for (const [key, record] of Object.entries(cuisinePairs.pairs || {})) {
    const [a, b] = key.split('|');
    if (!knownIngredients.has(a) || !knownIngredients.has(b)) {
      skippedUnknown++;
      continue;
    }
    if (existing.has(pairKey(a, b))) {
      skippedExisting++;
      continue;
    }
    const boost = cuisineBoost(record);
    if (boost === 0) {
      skippedLowStrength++;
      continue;
    }
    const strength = Math.min(0.6, boost * 0.8);
    pairings.push({
      ingredientA: a,
      ingredientB: b,
      strength: +strength.toFixed(4),
      source: 'cuisine-augment',
    });
    existing.add(pairKey(a, b));
    added++;
  }

  log(`Added cuisine-derived edges: ${added}`);
  log(`Skipped (already chemistry): ${skippedExisting}`);
  log(`Skipped (low boost): ${skippedLowStrength}`);
  log(`Skipped (endpoint unknown): ${skippedUnknown}`);
  log(`Final pairings count: ${pairings.length}`);

  fs.writeFileSync(PAIRINGS_PATH, JSON.stringify(pairings));
  log(`Wrote ${PAIRINGS_PATH}`);
}

main();
