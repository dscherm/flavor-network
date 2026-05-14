#!/usr/bin/env node
/**
 * rescue-classic-pairings — inject missing high-strength + ground-truth
 * pairs into public/proDataset/pairings.json.
 *
 * Why this script exists
 * ----------------------
 * 07-blend-v2.js has MAX_PAIRS=40000 and smart-caps after Phase 1's
 * min-15-per-ingredient guarantee. The cap drops every pair below
 * strength ~0.62. Classic cross-aroma pairs land below that line
 * (basil|tomato=0.46, chili|chocolate=0.60, balsamic|strawberry=0.48,
 * goat cheese|honey=0.57, apple|pork=0.31), so they're missing from
 * the shipped network entirely. The audit's cross-aroma axis verdict
 * is FAIL primarily because only 4/30 GT pairs even exist in the
 * dataset.
 *
 * Rather than re-running the full pipeline (06 -> 07 -> train_gnn.py
 * with Python + scikit-learn deps), this script does a surgical
 * additive rescue:
 *
 *   1. Every ground-truth entry that has features in pair-features.json
 *      but is missing from public/proDataset/pairings.json gets injected
 *      with its perceptron-scored strength.
 *   2. Every other pair in pair-features.json with strength >= RESCUE_FLOOR
 *      that is missing from public/proDataset/pairings.json gets injected.
 *      This bypasses 07-blend-v2's smart cap so the network gets the
 *      ~10k-20k mid-strength pairs that should ship.
 *
 * Each injected pair gets the same schema as the trained ones:
 * { ingredientA, ingredientB, strength, tradition, chemistry, novelty,
 *   balance, bridging, sharedCompounds:[], explanation:'', breakdown,
 *   known:true, predictedNovelty:0.5, flavorDistance:0.0 }.
 *
 * Run after `node scripts/enrich-pairings-shared-compounds.cjs` so the
 * Jaccard enrichment also fills in sharedCompounds for the rescued
 * pairs on the next pass.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PAIRINGS_PATH = path.join(REPO_ROOT, 'public', 'proDataset', 'pairings.json');
const FEATURES_PATH = path.join(REPO_ROOT, 'proDataset', 'processed', 'pair-features.json');
const WEIGHTS_PATH = path.join(REPO_ROOT, 'proDataset', 'data', 'trained_weights.json');
const GROUND_TRUTH_PATH = path.join(REPO_ROOT, 'chemDataset', 'validation', 'ground_truth.json');

// Pairs at or above this perceptron strength get rescued (non-GT path).
// 07-blend-v2's smart-cap effectively dropped everything below ~0.62.
// Floor of 0.65 picks up only the strongest orphans that just barely
// got cut, keeping network growth modest. GT-axis pairs (e.g.
// basil|tomato at strength 0.46) always rescue regardless of floor —
// they're cookbook-validated.
const RESCUE_FLOOR = 0.65;

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function perceptronScore(features, weights, bias) {
  let z = bias;
  for (let i = 0; i < weights.length; i++) z += features[i] * weights[i];
  return sigmoid(z);
}

function round6(x) {
  return Math.round(x * 1e6) / 1e6;
}

function computeSubScores(f) {
  const tradition  = f.x1_npmi * 0.4 + f.x2_freq * 0.3 + f.x6_cuisine * 0.3;
  const chemistry  = f.x3_chemical * 0.6 + f.x8_compound_diversity * 0.4;
  const novelty    = 1 - tradition;
  const balance    = f.x4_taste;
  const bridging   = f.x5_bridge;
  return {
    tradition: round6(tradition),
    chemistry: round6(chemistry),
    novelty:   round6(novelty),
    balance:   round6(balance),
    bridging:  round6(bridging),
  };
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeJson(p, value) {
  fs.writeFileSync(p, JSON.stringify(value));
}

function run() {
  const pairings = readJson(PAIRINGS_PATH);
  if (!Array.isArray(pairings)) {
    throw new Error(`Expected an array at ${PAIRINGS_PATH}`);
  }
  console.log(`Loaded ${pairings.length} pairings`);

  const features = readJson(FEATURES_PATH);
  const featurePairs = features?.pairs || {};
  console.log(`Loaded ${Object.keys(featurePairs).length} feature vectors`);

  const trained = readJson(WEIGHTS_PATH);
  const weights = trained.weights;
  const bias = trained.bias;

  // Build existing pair-key index from public/proDataset/pairings.json
  const present = new Set();
  for (const p of pairings) {
    present.add(pairKey(p.ingredientA, p.ingredientB));
  }

  // Ground-truth pair-keys (priority rescue)
  const gtPairs = new Set();
  const gt = readJson(GROUND_TRUTH_PATH);
  for (const e of (gt.pairings || [])) {
    gtPairs.add(pairKey((e.a || '').toLowerCase(), (e.b || '').toLowerCase()));
  }

  let injectedGT = 0;
  let injectedHighStrength = 0;
  let injectedTotal = 0;
  const missing = []; // GT pairs that aren't even in pair-features

  for (const [key, f] of Object.entries(featurePairs)) {
    if (present.has(key)) continue;
    const [a, b] = key.split('|');

    const featureVector = [
      f.x1_npmi, f.x2_freq, f.x3_chemical, f.x4_taste,
      f.x5_bridge, f.x6_cuisine, f.x7_hub_asymmetry, f.x8_compound_diversity,
    ];
    const strength = perceptronScore(featureVector, weights, bias);

    const isGT = gtPairs.has(key);
    if (!isGT && strength < RESCUE_FLOOR) continue;

    const sub = computeSubScores(f);
    const pair = {
      ingredientA: a,
      ingredientB: b,
      strength: round6(strength),
      tradition: sub.tradition,
      chemistry: sub.chemistry,
      novelty:   sub.novelty,
      balance:   sub.balance,
      bridging:  sub.bridging,
      sharedCompounds: Array.isArray(f.sharedCompounds) ? f.sharedCompounds : [],
      explanation: '',
      breakdown: {
        x1: f.x1_npmi, x2: f.x2_freq, x3: f.x3_chemical, x4: f.x4_taste,
        x5: f.x5_bridge, x6: f.x6_cuisine, x7: f.x7_hub_asymmetry, x8: f.x8_compound_diversity,
      },
      // train_gnn.py's default values for un-modeled rescue pairs
      known: true,
      predictedNovelty: 0.5,
      flavorDistance: 0.0,
    };
    pairings.push(pair);
    present.add(key);
    injectedTotal++;
    if (isGT) injectedGT++;
    else injectedHighStrength++;
  }

  // Report ground-truth pairs we couldn't rescue (no feature vector at all)
  for (const k of gtPairs) {
    if (!present.has(k)) missing.push(k);
  }

  // Re-sort by strength descending (keeps the network-rendering order sane)
  pairings.sort((a, b) => (b.strength || 0) - (a.strength || 0));

  writeJson(PAIRINGS_PATH, pairings);

  console.log(`Rescue done. Injected ${injectedTotal} pairs:`);
  console.log(`  - ground-truth rescues: ${injectedGT}`);
  console.log(`  - high-strength rescues (>= ${RESCUE_FLOOR}): ${injectedHighStrength}`);
  console.log(`Final pair count: ${pairings.length}`);
  if (missing.length > 0) {
    console.log(`Ground-truth pairs still missing (no feature vector): ${missing.length}`);
    for (const k of missing) console.log(`  - ${k}`);
  }
}

run();
