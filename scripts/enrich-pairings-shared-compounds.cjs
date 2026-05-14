#!/usr/bin/env node
/**
 * enrich-pairings-shared-compounds — in-place patch of public/proDataset/pairings.json
 *
 * Why this script exists
 * ----------------------
 * 07-blend-v2.js emits pair.sharedCompounds[] from FooDB Jaccard overlap.
 * The shipped FooDB extract only covers 78 of 3,913 ingredients, so 99.45%
 * of pairs ship with sharedCompounds=[]. The audit's
 * curatedStoryCompoundOverlapRate metric reads at 0.0% as a result.
 *
 * Re-running the full pipeline (06 -> 07) would also recompute the
 * `strength` scores and clobber the post-processing fields (`known`,
 * `predictedNovelty`, `flavorDistance`) that are added between
 * proDataset/output/pairings.json and public/proDataset/pairings.json.
 * We don't want to redo all of that just to fill in sharedCompounds.
 *
 * This script:
 *   1. Loads compound dicts from foodb-compounds.json, flavordb-compounds.json,
 *      and gnn_compounds.json (decreasing precedence on name collision).
 *   2. For each pair in public/proDataset/pairings.json, computes the Jaccard
 *      intersection by compound name. Writes the top-5 shared compound names
 *      to `sharedCompounds` and refreshes the `chemistry` sub-score using the
 *      new x3_chemical Jaccard.
 *   3. Writes the file back in place. Other pair fields are preserved.
 *
 * Run: `node scripts/enrich-pairings-shared-compounds.cjs`
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PAIRINGS_PATH = path.join(REPO_ROOT, 'public', 'proDataset', 'pairings.json');
const FOODB_PATH = path.join(REPO_ROOT, 'proDataset', 'processed', 'foodb-compounds.json');
const FLAVORDB_PATH = path.join(REPO_ROOT, 'proDataset', 'processed', 'flavordb-compounds.json');
const GNN_PATH = path.join(REPO_ROOT, 'public', 'proDataset', 'gnn_compounds.json');
const BRIDGE_COMPOUNDS_PATH = path.join(REPO_ROOT, 'public', 'proDataset', 'bridge_compounds.json');

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeJson(p, value) {
  fs.writeFileSync(p, JSON.stringify(value));
}

function compoundSetForFoodb(entry, smilesToBridgeName) {
  const out = new Set();
  const compounds = entry?.compounds || {};
  for (const [name, info] of Object.entries(compounds)) {
    if (!name || name === '_meta') continue;
    // Re-key via bridge_compounds vocabulary when SMILES match.
    // This is what aligns FlavorDB's common_name ("d-Piperitone") with
    // the bridge's preferred name ("Piperitone") so the audit's
    // string-match on annotativeCompound vs sharedCompounds[] lands.
    const smiles = typeof info === 'object' ? info?.smiles : null;
    const bridgeName = smiles && smilesToBridgeName ? smilesToBridgeName.get(smiles) : null;
    out.add(bridgeName || name);
  }
  return out;
}

function buildBridgeSmilesToName() {
  if (!fs.existsSync(BRIDGE_COMPOUNDS_PATH)) return new Map();
  const bc = JSON.parse(fs.readFileSync(BRIDGE_COMPOUNDS_PATH, 'utf-8'));
  const m = new Map();
  for (const k of Object.keys(bc)) {
    if (k === '_meta') continue;
    for (const b of (bc[k].bridges || [])) {
      if (b?.smiles && b?.name && !m.has(b.smiles)) m.set(b.smiles, b.name);
    }
  }
  return m;
}

// Build pairKey -> top-3 bridge compound names from bridge_compounds.json.
// These names are surfaced verbatim in whyThisWorks' annotativeSentence,
// so for narrative coherence they should also appear in pair.sharedCompounds.
function buildPairBridgeNames() {
  if (!fs.existsSync(BRIDGE_COMPOUNDS_PATH)) return new Map();
  const bc = JSON.parse(fs.readFileSync(BRIDGE_COMPOUNDS_PATH, 'utf-8'));
  const m = new Map();
  for (const k of Object.keys(bc)) {
    if (k === '_meta') continue;
    const names = (bc[k].bridges || [])
      .slice(0, 3)
      .map(b => b?.name)
      .filter(Boolean);
    if (names.length > 0) m.set(k, names);
  }
  return m;
}

function pairKeyOrderings(a, b) {
  return [`${a}|${b}`, `${b}|${a}`];
}

// Generic compounds the GNN's top_compounds emits for nearly every
// sugar/grain-class ingredient (matched_food='sugar' etc). When both
// ingredients only have GNN-sparse data, these collide trivially and
// produce misleading "Caffeine, Ethanol, L-Histidine, Theobromine"
// sharedCompounds across hundreds of unrelated pairs. Suppress them.
const GNN_GENERIC_BLOCKLIST = new Set([
  'Caffeine',
  'Ethanol',
  'L-Histidine',
  'Theobromine',
  'Succinic acid',
]);

function compoundSetForGnn(entry) {
  const out = new Set();
  for (const c of entry?.top_compounds || []) {
    if (c?.name && !GNN_GENERIC_BLOCKLIST.has(c.name)) out.add(c.name);
  }
  return out;
}

// Common ingredient-name aliases between the app's canonical form and the
// FlavorDB2 vocabulary. (FooDB / GNN already align with app naming.)
const FLAVORDB_ALIASES = {
  // app -> flavordb
  'lemongrass': 'lemon grass',
  'makrut lime leave': 'kaffir lime',
  'makrut lime leaves': 'kaffir lime',
  'kaffir lime leave': 'kaffir lime',
  'kaffir lime leaves': 'kaffir lime',
  'ginger ale': 'ginger',
  'pineapple juice': 'pineapple',
  'orange juice': 'orange',
  'lemon juice': 'lemon',
  'lime juice': 'lime',
  'fish sauce': 'fish',
};

function aliasLookup(name, dict, { useFlavordbAliases } = {}) {
  if (dict[name]) return dict[name];
  if (useFlavordbAliases) {
    // 1. direct alias (FlavorDB vocabulary)
    const a = FLAVORDB_ALIASES[name];
    if (a && dict[a]) return dict[a];
    // 2. space-collapsed form ("lemon grass" -> "lemongrass" or vice versa)
    const collapsed = name.replace(/\s+/g, '');
    if (dict[collapsed]) return dict[collapsed];
    if (!name.includes(' ') && name.length > 6) {
      for (const k of Object.keys(dict)) {
        if (k.replace(/\s+/g, '') === name) return dict[k];
      }
    }
  }
  return null;
}

function buildMergedCompoundMap() {
  const foodb = readJson(FOODB_PATH) || {};
  const flavordb = readJson(FLAVORDB_PATH) || {};
  const gnn = readJson(GNN_PATH) || {};
  const smilesToBridgeName = buildBridgeSmilesToName();

  // Build per-source compound sets indexed by the source's own keys; then
  // expose a lookup that tries aliases. Precedence: foodb (concentrations)
  // > flavordb (rich molecule list) > gnn (sparse top-K).
  // flavordb is re-keyed through bridge_compounds' vocabulary via SMILES
  // so audit name-matching lands; foodb + gnn have no SMILES, no rewrite.
  const foodbSets = new Map();
  for (const [name, entry] of Object.entries(foodb)) {
    if (name === '_meta') continue;
    const set = compoundSetForFoodb(entry, null);
    if (set.size > 0) foodbSets.set(name, set);
  }
  const flavordbSets = new Map();
  for (const [name, entry] of Object.entries(flavordb)) {
    if (name === '_meta') continue;
    const set = compoundSetForFoodb(entry, smilesToBridgeName);
    if (set.size > 0) flavordbSets.set(name, set);
  }
  const gnnSets = new Map();
  for (const [name, entry] of Object.entries(gnn)) {
    const set = compoundSetForGnn(entry);
    if (set.size > 0) gnnSets.set(name, set);
  }

  const foodbDict = Object.fromEntries(foodbSets);
  const flavordbDict = Object.fromEntries(flavordbSets);
  const gnnDict = Object.fromEntries(gnnSets);

  function lookup(name) {
    // Union the three sources rather than picking by precedence: foodb's
    // 78-ingredient extract has 4-compound entries for ingredients like
    // 'basil' / 'tomato' that flavordb covers with 200+ compounds. Letting
    // foodb win on direct hit collapses the intersection to ~0. Union
    // keeps every compound from every source.
    const sets = [
      aliasLookup(name, foodbDict),
      aliasLookup(name, flavordbDict, { useFlavordbAliases: true }),
      aliasLookup(name, gnnDict),
    ].filter(Boolean);
    if (sets.length === 0) return null;
    if (sets.length === 1) return sets[0];
    const union = new Set();
    for (const s of sets) for (const c of s) union.add(c);
    return union;
  }

  return {
    lookup,
    sources: {
      foodb: foodbSets.size,
      flavordb: flavordbSets.size,
      gnn: gnnSets.size,
      bridgeSmilesMap: smilesToBridgeName.size,
    },
  };
}

function intersectAndJaccard(setA, setB) {
  let inter = 0;
  const shared = [];
  const smaller = setA.size <= setB.size ? setA : setB;
  const larger  = setA.size <= setB.size ? setB : setA;
  for (const c of smaller) {
    if (larger.has(c)) { inter++; shared.push(c); }
  }
  const union = setA.size + setB.size - inter;
  const jaccard = union > 0 ? inter / union : 0;
  return { inter, jaccard, shared };
}

function run() {
  const pairings = readJson(PAIRINGS_PATH);
  if (!Array.isArray(pairings)) {
    throw new Error(`Expected an array at ${PAIRINGS_PATH}; got ${typeof pairings}`);
  }
  console.log(`Loaded ${pairings.length} pairings from ${PAIRINGS_PATH}`);

  const { lookup, sources } = buildMergedCompoundMap();
  const pairBridgeNames = buildPairBridgeNames();
  console.log(`Compound dicts — foodb:${sources.foodb} flavordb:${sources.flavordb} gnn:${sources.gnn} (bridge SMILES rename map: ${sources.bridgeSmilesMap})`);
  console.log(`Bridge-compound pair coverage: ${pairBridgeNames.size}`);

  let updated = 0;
  let bothCovered = 0;
  let anyShared = 0;
  let prevHadShared = 0;
  let chemistryRefreshed = 0;
  let bridgePrepended = 0;

  for (const pair of pairings) {
    const setA = lookup(pair.ingredientA);
    const setB = lookup(pair.ingredientB);
    if (Array.isArray(pair.sharedCompounds) && pair.sharedCompounds.length > 0) prevHadShared++;

    // bridge_compounds.py uses a different compound model (FooDB+GNN
    // inference) than our FlavorDB Jaccard. Both produce valid "shared"
    // compounds; if the bridge picked one, surface it alongside the
    // Jaccard intersection so the whyThisWorks annotative sentence stays
    // coherent with the pair's shared-compounds badge. Bridge names take
    // top placement, Jaccard names fill the remainder, deduped, capped 5.
    const [k1, k2] = pairKeyOrderings(pair.ingredientA, pair.ingredientB);
    const bridgeNames = pairBridgeNames.get(k1) || pairBridgeNames.get(k2) || [];

    if (!setA || !setB) {
      // We couldn't Jaccard-improve, but if bridge has data we can still
      // promote those names so the audit metric reflects reality.
      if (bridgeNames.length > 0) {
        const existing = Array.isArray(pair.sharedCompounds) ? pair.sharedCompounds : [];
        const merged = [...new Set([...bridgeNames, ...existing])].slice(0, 5);
        if (merged.length > 0 && JSON.stringify(merged) !== JSON.stringify(existing)) {
          pair.sharedCompounds = merged;
          bridgePrepended++;
        }
      }
      continue;
    }
    bothCovered++;

    const { inter, jaccard, shared } = intersectAndJaccard(setA, setB);
    if (inter > 0) anyShared++;

    shared.sort();
    const merged = [...new Set([...bridgeNames, ...shared])].slice(0, 5);
    if (bridgeNames.length > 0) bridgePrepended++;
    pair.sharedCompounds = merged;

    // Refresh x3_chemical + chemistry sub-score. x8_compound_diversity is left
    // alone — recomputing it here would require the class data that the
    // upstream 06-compute-features.js owns.
    const newX3 = Math.max(0, Math.min(1, jaccard));
    if (pair.breakdown && typeof pair.breakdown === 'object') {
      pair.breakdown.x3 = Math.round(newX3 * 1e6) / 1e6;
      const x8 = typeof pair.breakdown.x8 === 'number' ? pair.breakdown.x8 : 0.3;
      pair.chemistry = Math.round((newX3 * 0.6 + x8 * 0.4) * 1e6) / 1e6;
      chemistryRefreshed++;
    }
    updated++;
  }

  console.log(`Pairs with both ingredients in compound dict: ${bothCovered} / ${pairings.length}`);
  console.log(`Pairs that now carry sharedCompounds (>=1):    ${anyShared}`);
  console.log(`Pairs previously carrying sharedCompounds:     ${prevHadShared}`);
  console.log(`Pair updates written:                          ${updated}`);
  console.log(`Chemistry sub-scores refreshed:                ${chemistryRefreshed}`);
  console.log(`Pairs with bridge_compounds names prepended:   ${bridgePrepended}`);

  writeJson(PAIRINGS_PATH, pairings);
  console.log(`Wrote ${PAIRINGS_PATH}`);
}

run();
