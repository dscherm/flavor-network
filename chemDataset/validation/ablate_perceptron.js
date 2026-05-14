#!/usr/bin/env node
// Phase 1.5: Perceptron ablation CLI.
//
// READ-ONLY against shipped weights. Writes ONLY to:
//   chemDataset/validation/ablation/run-{date}.json
//   chemDataset/validation/reports/ablation-{date}.md
//
// WRITE-PROTECTION (Executor Handoff Constraint #7): safeWrite() enforces that
// ALL output paths are under chemDataset/validation/. Writing to proDataset/**
// or any other directory throws immediately.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { axisDistribution, verdictGate, canonicalPairKey } from './lib/metrics.js';
import { extractDefaultWeights, canonicalJson } from './score_pairings.js';
import { train } from './lib/sgd.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const ABLATION_DIR = join(__dirname, 'ablation');
const REPORTS_DIR = join(__dirname, 'reports');

// ─────────── Write-protection guard ───────────

/**
 * safeWrite — enforces all output is under chemDataset/validation/.
 * Throws immediately if targetPath resolves outside the allowed directory.
 */
export function safeWrite(targetPath, content) {
  const resolved = resolve(targetPath);
  const allowed = resolve(__dirname);
  if (!resolved.startsWith(allowed + '/') && !resolved.startsWith(allowed + '\\') && resolved !== allowed) {
    throw new Error(
      `Write-protection violation: attempted write to ${resolved}. ` +
      `Only paths under ${allowed} are permitted by this script.`,
    );
  }
  writeFileSync(resolved, content, 'utf-8');
}

// ─────────── I/O helpers ───────────

function loadJson(p) {
  if (!existsSync(p)) throw new Error(`required file missing: ${p}`);
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function safeLoadJson(p) {
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function safeReadText(p) {
  try {
    if (!existsSync(p)) return null;
    return readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

function repoPath(...segments) {
  return join(REPO_ROOT, ...segments);
}

// ─────────── Hashing ───────────

function hashWeightsAblation(weights, bias) {
  const payload = { weights, bias };
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

// ─────────── Feature names (matching 07-blend-v2.js x1..x8 convention) ───────────

const FEATURE_NAMES = [
  'x1_npmi',
  'x2_freq',
  'x3_chemical',
  'x4_taste',
  'x5_bridge',
  'x6_cuisine',
  'x7_hub_asymmetry',
  'x8_compound_diversity',
];

// ─────────── Core ablation logic ───────────

/**
 * runAblation — exported for testing. All file IO is injected via opts.
 *
 * @param {object} opts
 * @param {object} [opts.groundTruth]      — override ground_truth.json
 * @param {object} [opts.pairFeatures]     — override pair-features.json (null = missing)
 * @param {string} [opts.blendSource]      — override 07-blend-v2.js text
 * @param {object} [opts.metadata]         — override metadata.json
 * @param {boolean} [opts.allowStale=false]
 * @param {number}  [opts.lr=0.01]
 * @param {number}  [opts.epochs=100]
 * @param {number}  [opts.l2=0.001]
 * @param {boolean} [opts.dryRun=false]
 * @param {boolean} [opts.writeOutput=true] — set false in tests to skip disk writes
 * @param {string}  [opts.today]            — override date string (YYYY-MM-DD)
 * @returns {object} report object
 */
export function runAblation(opts = {}) {
  const {
    allowStale = false,
    lr = 0.01,
    epochs = 100,
    l2 = 0.001,
    dryRun = false,
    writeOutput = true,
    today = new Date().toISOString().slice(0, 10),
  } = opts;

  // ── Load pair-features ──
  const pairFeaturesPath = repoPath('proDataset', 'processed', 'pair-features.json');
  let pairFeatures;
  if ('pairFeatures' in opts) {
    pairFeatures = opts.pairFeatures;
  } else {
    if (!existsSync(pairFeaturesPath)) {
      const msg = `feature file not found at ${pairFeaturesPath}; ablation requires the proDataset pipeline to have run`;
      // eslint-disable-next-line no-console
      console.error(msg);
      process.exit(2);
    }
    pairFeatures = loadJson(pairFeaturesPath);
  }

  if (pairFeatures === null) {
    const msg = `feature file not found at ${pairFeaturesPath}; ablation requires the proDataset pipeline to have run`;
    // eslint-disable-next-line no-console
    console.error(msg);
    process.exit(2);
  }

  // ── Load ground truth ──
  const groundTruth = opts.groundTruth ?? loadJson(join(__dirname, 'ground_truth.json'));
  if (!Array.isArray(groundTruth?.pairings)) {
    throw new Error('ground_truth.json missing pairings[]');
  }

  // ── Load metadata ──
  const metadata = opts.metadata ?? loadJson(repoPath('public', 'proDataset', 'metadata.json'));
  if (!metadata?.gnnTrainedAt) {
    throw new Error('metadata.gnnTrainedAt missing — cannot anchor staleness');
  }

  // ── Load blend source for weights extraction ──
  const blendSource = opts.blendSource
    ?? safeReadText(repoPath('proDataset', 'scripts', '07-blend-v2.js'))
    ?? '';
  const { weights: preWeights, bias: preBias } = extractDefaultWeights(blendSource);
  const weightsHash = hashWeightsAblation(preWeights, preBias);
  const scoredAgainst = metadata.gnnTrainedAt;

  // ── HARD GATE: per-axis n >= 15 ──
  const gtEntries = groundTruth.pairings;
  const counts = axisDistribution(gtEntries);
  const gate = verdictGate(counts, 15);

  // Gate fires if ANY axis present in ground truth is insufficient,
  // OR if there are NO axes at all (empty ground truth can't train).
  const axisKeys = Object.keys(gate);
  const anyInsufficient = axisKeys.length === 0 || axisKeys.some((k) => gate[k] === 'insufficient');

  if (anyInsufficient) {
    const lines = [
      'Ablation gate: insufficient ground truth. Per-axis counts:',
    ];
    for (const axis of axisKeys) {
      lines.push(`  ${axis}: ${counts[axis] ?? 0} (${gate[axis]})`);
    }
    if (axisKeys.length === 0) {
      lines.push('  (no axes found in ground_truth.json pairings)');
    }
    lines.push('Grow ground_truth.json to n >= 15 per axis. Phase 1.5 is a no-op until then.');
    for (const line of lines) {
      // eslint-disable-next-line no-console
      console.error(line);
    }
    process.exit(2);
  }

  // ── Build feature matrix joined to ground truth ──
  // pair-features.json: { pairs: { "a|b": { x1_npmi, x2_freq, ... } }, ... }
  // Pair keys are already canonical lowercase "a|b" with a <= b.
  // Also supports legacy array form { a, b, features: [x1..x8] }.
  const featureMap = new Map();
  if (Array.isArray(pairFeatures)) {
    for (const row of pairFeatures) {
      if (!row?.a || !row?.b) continue;
      const key = canonicalPairKey(row.a, row.b);
      const vec = extractFeatureVector(row);
      if (vec) featureMap.set(key, vec);
    }
  } else if (pairFeatures && typeof pairFeatures === 'object' && pairFeatures.pairs) {
    for (const [key, row] of Object.entries(pairFeatures.pairs)) {
      const vec = extractFeatureVector(row);
      if (vec) featureMap.set(key, vec);
    }
  }

  const featureRows = [];
  const labels = [];
  const matched = [];
  const positiveKeys = new Set();
  for (const entry of gtEntries) {
    const key = canonicalPairKey(entry.a, entry.b);
    const vec = featureMap.get(key);
    if (!vec || vec.length !== 8) continue;
    featureRows.push(vec);
    labels.push(1);
    matched.push(key);
    positiveKeys.add(key);
  }

  // Negative sampling: random pair-features rows not in ground truth.
  // Without negatives, logistic regression on positives-only pushes z → +∞
  // and produces meaningless weight deltas. We sample `negativeRatio`
  // negatives per positive (default 3:1) using a deterministic seed.
  const negativeRatio = opts.negativeRatio ?? 3;
  const seed = opts.seed ?? 42;
  const negTargetCount = matched.length * negativeRatio;
  const allKeys = Array.from(featureMap.keys());
  let rng = seed;
  function nextRand() {
    // mulberry32 — deterministic pseudo-random
    rng |= 0; rng = (rng + 0x6D2B79F5) | 0;
    let t = Math.imul(rng ^ (rng >>> 15), 1 | rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const negKeysPicked = new Set();
  let attempts = 0;
  const maxAttempts = negTargetCount * 20;
  while (negKeysPicked.size < negTargetCount && attempts < maxAttempts && allKeys.length > 0) {
    attempts++;
    const k = allKeys[Math.floor(nextRand() * allKeys.length)];
    if (positiveKeys.has(k) || negKeysPicked.has(k)) continue;
    negKeysPicked.add(k);
    const vec = featureMap.get(k);
    if (vec && vec.length === 8) {
      featureRows.push(vec);
      labels.push(0);
    }
  }
  const negativeCount = negKeysPicked.size;

  // ── SGD training ──
  const { weights: postWeights, bias: postBias, lossCurve, finalLoss } = train(
    featureRows,
    labels,
    {
      learningRate: lr,
      epochs,
      l2,
      initialWeights: preWeights,
      initialBias: preBias,
    },
  );

  // ── Delta analysis ──
  const deltaWeights = postWeights.map((w, i) => w - preWeights[i]);
  const topFiveDeltaFeatures = deltaWeights
    .map((delta, index) => ({ index, name: FEATURE_NAMES[index] || `x${index + 1}`, delta }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  // ── Build recommendation text ──
  const top = topFiveDeltaFeatures[0];
  let recommendation = 'no significant weight delta detected';
  if (top && Math.abs(top.delta) > 0.01) {
    const direction = top.delta > 0 ? 'raise' : 'lower';
    const current = preWeights[top.index].toFixed(3);
    const suggested = postWeights[top.index].toFixed(3);
    recommendation = `${direction} ${top.name} weight; current ${current} -> suggested ${suggested}`;
  }

  // ── Build report object ──
  const reportObj = {
    runDate: new Date().toISOString(),
    scoredAgainst,
    weightsHash,
    groundTruthCount: gtEntries.length,
    perAxisCounts: counts,
    matchedPairCount: matched.length,
    negativeSampleCount: negativeCount,
    trainingRowCount: featureRows.length,
    preWeights,
    preBias,
    postWeights,
    postBias,
    deltaWeights,
    topFiveDeltaFeatures,
    lossCurve,
    finalLoss,
    recommendation,
  };

  // ── Emit outputs ──
  if (!dryRun && writeOutput) {
    mkdirSync(ABLATION_DIR, { recursive: true });
    mkdirSync(REPORTS_DIR, { recursive: true });

    const jsonPath = join(ABLATION_DIR, `run-${today}.json`);
    safeWrite(jsonPath, JSON.stringify(reportObj, null, 2));

    const mdPath = join(REPORTS_DIR, `ablation-${today}.md`);
    safeWrite(mdPath, renderMarkdown(reportObj, today));
    // eslint-disable-next-line no-console
    console.log(`[ablation] wrote ${jsonPath}`);
    // eslint-disable-next-line no-console
    console.log(`[ablation] wrote ${mdPath}`);
  }

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log('[ablation] --dry-run: no files written');
    // eslint-disable-next-line no-console
    console.log(`[ablation] finalLoss=${finalLoss.toFixed(4)}`);
    // eslint-disable-next-line no-console
    console.log(`[ablation] recommendation: ${recommendation}`);
  }

  return reportObj;
}

// ─────────── Feature vector extraction ───────────

function extractFeatureVector(row) {
  if (!row || typeof row !== 'object') return null;
  // Support { features: [...] } legacy array shape.
  if (Array.isArray(row.features) && row.features.length === 8) return row.features;
  // Support { breakdown: { x1, x2, ... } } legacy nested shape.
  if (row.breakdown && typeof row.breakdown === 'object') {
    const bd = row.breakdown;
    return [
      bd.x1 ?? 0, bd.x2 ?? 0, bd.x3 ?? 0, bd.x4 ?? 0,
      bd.x5 ?? 0, bd.x6 ?? 0, bd.x7 ?? 0, bd.x8 ?? 0,
    ];
  }
  // Current pair-features.json shape — named keys matching 07-blend-v2.js.
  if ('x1_npmi' in row) {
    return [
      row.x1_npmi ?? 0,
      row.x2_freq ?? 0,
      row.x3_chemical ?? 0,
      row.x4_taste ?? 0,
      row.x5_bridge ?? 0,
      row.x6_cuisine ?? 0,
      row.x7_hub_asymmetry ?? 0,
      row.x8_compound_diversity ?? 0,
    ];
  }
  return null;
}

// ─────────── Markdown report ───────────

function renderMarkdown(r, today) {
  const lines = [];
  lines.push(`# Perceptron ablation report — ${today}`);
  lines.push('');
  lines.push(`**runDate:** ${r.runDate}`);
  lines.push(`**scoredAgainst (gnnTrainedAt):** ${r.scoredAgainst}`);
  lines.push(`**weightsHash:** ${r.weightsHash}`);
  lines.push(`**groundTruthCount:** ${r.groundTruthCount}`);
  lines.push(`**matchedPairCount (joined to pair-features):** ${r.matchedPairCount}`);
  if (typeof r.negativeSampleCount === 'number') {
    lines.push(`**negativeSampleCount:** ${r.negativeSampleCount}`);
    lines.push(`**trainingRowCount:** ${r.trainingRowCount}`);
  }
  lines.push(`**finalLoss:** ${r.finalLoss.toFixed(6)}`);
  lines.push('');
  lines.push('## Per-axis counts');
  lines.push('');
  for (const [axis, n] of Object.entries(r.perAxisCounts)) {
    lines.push(`- ${axis}: ${n}`);
  }
  lines.push('');
  lines.push('## Weight delta (pre → post)');
  lines.push('');
  lines.push('| Feature | Pre | Post | Delta |');
  lines.push('|---|---|---|---|');
  for (let i = 0; i < r.preWeights.length; i++) {
    const name = FEATURE_NAMES[i] || `x${i + 1}`;
    lines.push(
      `| ${name} | ${r.preWeights[i].toFixed(4)} | ${r.postWeights[i].toFixed(4)} | ${r.deltaWeights[i].toFixed(4)} |`,
    );
  }
  lines.push('');
  lines.push('## Top 5 features by absolute delta');
  lines.push('');
  lines.push('| Rank | Feature | Delta |');
  lines.push('|---|---|---|');
  for (let i = 0; i < r.topFiveDeltaFeatures.length; i++) {
    const f = r.topFiveDeltaFeatures[i];
    lines.push(`| ${i + 1} | ${f.name} | ${f.delta.toFixed(4)} |`);
  }
  lines.push('');
  lines.push('## Recommendation');
  lines.push('');
  lines.push(`> ${r.recommendation}`);
  lines.push('');
  lines.push('## Loss curve (first 10 epochs)');
  lines.push('');
  lines.push('| Epoch | Avg Loss |');
  lines.push('|---|---|');
  for (const pt of r.lossCurve.slice(0, 10)) {
    lines.push(`| ${pt.epoch} | ${pt.loss.toFixed(6)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ─────────── CLI arg parsing ───────────

function parseArgs(argv) {
  const out = {
    allowStale: false,
    lr: 0.01,
    epochs: 100,
    l2: 0.001,
    dryRun: false,
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--allow-stale') out.allowStale = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--lr' && args[i + 1]) { out.lr = Number(args[++i]); }
    else if (a === '--epochs' && args[i + 1]) { out.epochs = Number(args[++i]); }
    else if (a === '--l2' && args[i + 1]) { out.l2 = Number(args[++i]); }
  }
  return out;
}

// ─────────── CLI entry ───────────

const isCliEntry = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isCliEntry) {
  const opts = parseArgs(process.argv);
  // runAblation calls process.exit internally on gate fail or missing file.
  runAblation(opts);
}
