#!/usr/bin/env node
/**
 * snapshot-curated-stories — regenerates src/data/__fixtures__/curated_stories.json
 *
 * Reads public/proDataset/pairings.json + bridge_compounds.json + the
 * Phase 1 ground_truth.json, picks the top-50 pairings by strength,
 * runs whyThisWorks() against each, embeds the result + a fresh
 * generatedAt timestamp.
 *
 * Phase 1's audit (chemDataset/validation/score_pairings.js) reads the
 * fixture's generatedAt to compute fixture_staleness_seconds, plus
 * curatedStoryCompoundOverlapRate (Constraint #5a/#6).
 *
 * Run: `npm run snapshot:curated-stories`
 *
 * Honest disclosure (.claude/.chemdataset-status.md): the FlavorDB API
 * has been down, so almost every shipped pair has x3==0.5 and an
 * empty sharedCompounds[]. The first run of this snapshot will
 * produce a low overlap rate. That's the audit doing its job —
 * surfacing the chemistry data gap rather than papering over it.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PAIRINGS_PATH = path.join(REPO_ROOT, 'public', 'proDataset', 'pairings.json');
const FIXTURE_OUT = path.join(REPO_ROOT, 'src', 'data', '__fixtures__', 'curated_stories.json');
const TOP_N = 50;

function loadJson(p) {
  const txt = fs.readFileSync(p, 'utf-8');
  return JSON.parse(txt);
}

/**
 * Run whyThisWorks for each top-50 pair. We invoke the ESM module via
 * a child Node process so this CommonJS script doesn't have to import()
 * an ESM module and pull in jsdom/etc. The child writes a JSON array
 * to stdout which we parse + assemble into the final fixture.
 */
function computeStoriesViaChild(topPairs) {
  const { pathToFileURL } = require('node:url');
  const whyUrl = pathToFileURL(
    path.join(REPO_ROOT, 'src', 'data', 'whyThisWorks.js'),
  ).href;
  const metaPath = path
    .join(REPO_ROOT, 'public', 'proDataset', 'metadata.json')
    .replace(/\\/g, '/');
  const childScript = `
    import { whyThisWorks } from '${whyUrl}';
    import { readFileSync } from 'node:fs';
    const PAIRS = ${JSON.stringify(topPairs)};
    const META = JSON.parse(readFileSync('${metaPath}', 'utf-8'));
    const pairingCount = META.pairingCount || 50312;
    const out = [];
    for (const p of PAIRS) {
      const story = whyThisWorks(p, { pairingCount });
      out.push({ a: p.ingredientA, b: p.ingredientB, story });
    }
    process.stdout.write(JSON.stringify(out));
  `;
  // Write to a temp .mjs so Node treats it as ESM regardless of repo type.
  const tmpFile = path.join(__dirname, '.snapshot-child.mjs');
  fs.writeFileSync(tmpFile, childScript, 'utf-8');
  try {
    const result = spawnSync(process.execPath, [tmpFile], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 32,
    });
    if (result.status !== 0) {
      process.stderr.write(result.stderr || '(no stderr)\n');
      throw new Error(`child process exited with ${result.status}`);
    }
    return JSON.parse(result.stdout);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

function main() {
  if (!fs.existsSync(PAIRINGS_PATH)) {
    console.error(`[snapshot] pairings.json missing at ${PAIRINGS_PATH}`);
    process.exit(1);
  }

  const pairings = loadJson(PAIRINGS_PATH);
  if (!Array.isArray(pairings)) {
    console.error('[snapshot] pairings.json must be an array');
    process.exit(1);
  }

  const sorted = [...pairings].sort((a, b) => (b.strength || 0) - (a.strength || 0));
  const topPairs = sorted.slice(0, TOP_N);

  console.log(`[snapshot] computing ${topPairs.length} stories via child whyThisWorks...`);
  const stories = computeStoriesViaChild(topPairs);

  // Fixture freshness anchor — generatedAt MUST be ISO. Audit asserts
  // this value >= mtime(bridge_compounds.json) before treating the
  // fixture as authoritative. (whyThisWorks falls back to live compute
  // when stale.)
  const fixture = {
    generatedAt: new Date().toISOString(),
    sourcePairingsCount: pairings.length,
    topN: TOP_N,
    stories,
  };

  // Make sure the parent dir exists (idempotent).
  fs.mkdirSync(path.dirname(FIXTURE_OUT), { recursive: true });
  fs.writeFileSync(FIXTURE_OUT, JSON.stringify(fixture, null, 2), 'utf-8');

  // Quick honesty check: how many of the embedded stories have
  // isAnnotativeCompoundUsedByRuntime === true? Surfaces in the log so
  // operators know what the audit is going to flag.
  let usedRuntime = 0;
  let withAnnotation = 0;
  for (const s of stories) {
    if (s.story?.annotativeSentence) withAnnotation++;
    if (s.story?.isAnnotativeCompoundUsedByRuntime) usedRuntime++;
  }
  const overlapRate = withAnnotation > 0 ? usedRuntime / withAnnotation : 0;

  console.log(`[snapshot] wrote ${FIXTURE_OUT}`);
  console.log(`[snapshot] generatedAt=${fixture.generatedAt}`);
  console.log(`[snapshot] stories=${stories.length}, withAnnotation=${withAnnotation}, usedRuntime=${usedRuntime}`);
  console.log(`[snapshot] curatedStoryCompoundOverlapRate=${(overlapRate * 100).toFixed(1)}%`);
  if (overlapRate < 0.30 && withAnnotation > 0) {
    console.log('[snapshot] note: overlap rate < 30% — audit will flag this.');
    console.log('[snapshot] root cause: x3==0.5 globally (FlavorDB API down). Expected.');
  }
}

main();
