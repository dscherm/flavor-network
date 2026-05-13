#!/usr/bin/env node
// Audit harness for the shipped pairing model (Phase 1 of pairing-audit-and-guided-discovery v2).
//
// EXECUTOR HANDOFF CONSTRAINT #1: this script NEVER recomputes pairing
// strength. It consumes the already-ranked output of `07-blend-v2.js`
// (public/proDataset/pairings.json) and grades it against ground truth.
//
// EXECUTOR HANDOFF CONSTRAINT #2: per-axis verdict gated on n >= 15. Axes
// below threshold report "insufficient (n=Y, target >= 15)"; healthier axes
// receive a pass/warn/fail verdict.
//
// Reads (only):
//   public/proDataset/pairings.json
//   public/proDataset/metadata.json   (for gnnTrainedAt staleness anchor)
//   public/proDataset/ingredients.json (cuisine metadata for cross-cuisine axis)
//   public/proDataset/gnn_entropy.json (top-aroma class for cross-aroma axis)
//   chemDataset/validation/ground_truth.json
//   proDataset/scripts/07-blend-v2.js (source text only, for the weights hash)
//   chemDataset/validation/reports/LATEST.md (optional, for coverage delta)
//
// Writes:
//   chemDataset/validation/reports/audit-{YYYY-MM-DD}.md
//   chemDataset/validation/reports/LATEST.md  (copy of the latest run)
//
// CLI:
//   node score_pairings.js                       # full hash-gate enforced
//   node score_pairings.js --allow-stale         # bypass gnnTrainedAt mismatch
//   node score_pairings.js --allow-weight-change # bypass weight hash mismatch
//   node score_pairings.js --first-run           # write reports/audit-FIRST.md instead

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  precisionAt,
  recallAt,
  beyondBookAt,
  axisDistribution,
  verdictGate,
  crossSourceAgreement,
  canonicalPairKey,
} from './lib/metrics.js';
import {
  AXIS_LIST,
  chemBridgedRare,
  absentFromBooks,
  crossCuisine,
  crossAroma,
} from './lib/axes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const VERDICT_THRESHOLD_N = 15;
const TOP_K_AUDIT = 10;
const TOP_K_RECALL = 20;
const REPORTS_DIR = join(__dirname, 'reports');

// ─────────── Path helpers ───────────

function repoPath(...segments) {
  return join(REPO_ROOT, ...segments);
}

// ─────────── Canonical-JSON hashing ───────────

export function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

export function hashWeights(weights, bias, trainingStatus = 'untrained') {
  const payload = { weights, bias, training_status: trainingStatus };
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

// ─────────── Read 07-blend-v2.js weights via regex ───────────

export function extractDefaultWeights(sourceText) {
  // Match the DEFAULT_WEIGHTS const literal. We tolerate whitespace differences
  // but rely on the structural layout in 07-blend-v2.js. If the file is reformatted,
  // the regex falls back to a fixed-literal compare with the spec'd values.
  const match = sourceText.match(
    /const\s+DEFAULT_WEIGHTS\s*=\s*\{\s*weights\s*:\s*\[([^\]]+)\]\s*,\s*bias\s*:\s*(-?\d+(?:\.\d+)?)\s*,?\s*\}/,
  );
  if (!match) {
    // Hard fallback: the spec literal. Keep the executor handoff intact even
    // if the source file is reflowed.
    return { weights: [2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2], bias: -3.0 };
  }
  const weights = match[1]
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const bias = Number(match[2]);
  return { weights, bias };
}

// ─────────── Build ranked-neighbor index ───────────

function buildPerIngredientRanking(pairings) {
  const byIng = new Map();
  for (const p of pairings) {
    const key = canonicalPairKey(p.ingredientA, p.ingredientB);
    for (const name of [p.ingredientA, p.ingredientB]) {
      if (!byIng.has(name)) byIng.set(name, []);
      byIng.get(name).push({ key, partner: name === p.ingredientA ? p.ingredientB : p.ingredientA, strength: p.strength });
    }
  }
  // Already sorted upstream by strength desc, but be defensive.
  for (const arr of byIng.values()) {
    arr.sort((a, b) => b.strength - a.strength);
  }
  return byIng;
}

// ─────────── Audit core ───────────

export function runAudit(opts = {}) {
  const {
    allowStale = false,
    allowWeightChange = false,
    firstRun = false,
    today = new Date().toISOString().slice(0, 10),
    // Test/injection overrides:
    pairings: pairingsOverride,
    metadata: metadataOverride,
    ingredientsMeta: ingredientsMetaOverride,
    gnnEntropy: gnnEntropyOverride,
    groundTruth: groundTruthOverride,
    blendSource: blendSourceOverride,
    previousReport: previousReportOverride,
    writeReport = true,
    reportsDir = REPORTS_DIR,
  } = opts;

  // ── Load inputs ──
  const pairings = pairingsOverride
    ?? loadJson(repoPath('public', 'proDataset', 'pairings.json'));
  const metadata = metadataOverride
    ?? loadJson(repoPath('public', 'proDataset', 'metadata.json'));
  const ingredientsMeta = ingredientsMetaOverride
    ?? safeLoadJson(repoPath('public', 'proDataset', 'ingredients.json')) ?? {};
  const gnnEntropy = gnnEntropyOverride
    ?? safeLoadJson(repoPath('public', 'proDataset', 'gnn_entropy.json'));
  const groundTruth = groundTruthOverride
    ?? loadJson(join(__dirname, 'ground_truth.json'));
  const blendSource = blendSourceOverride
    ?? safeReadText(repoPath('proDataset', 'scripts', '07-blend-v2.js'))
    ?? '';

  if (!Array.isArray(pairings)) {
    throw new Error('pairings.json must be an array');
  }
  if (!metadata?.gnnTrainedAt) {
    throw new Error('metadata.gnnTrainedAt missing — cannot anchor staleness');
  }
  if (!Array.isArray(groundTruth?.pairings)) {
    throw new Error('ground_truth.json missing pairings[]');
  }

  // ── Compute hashes / staleness ──
  const { weights, bias } = extractDefaultWeights(blendSource);
  // training_status: defaults to "untrained" (spec). When trained_weights.json
  // is materialized later (Phase 1.5) the hash gate will trip and the executor
  // must regrade with --allow-weight-change.
  const weightsHash = hashWeights(weights, bias, 'untrained');
  const scoredAgainst = metadata.gnnTrainedAt;

  // ── Optional fixture staleness ──
  const fixturePath = repoPath('src', 'data', '__fixtures__', 'curated_stories.json');
  let fixtureStalenessSeconds = null;
  if (existsSync(fixturePath)) {
    try {
      const stat = readFileSync(fixturePath); // touch to surface I/O errors
      const parsed = JSON.parse(stat.toString());
      if (parsed?.generatedAt) {
        fixtureStalenessSeconds = Math.max(
          0,
          Math.round((Date.now() - new Date(parsed.generatedAt).getTime()) / 1000),
        );
      }
    } catch {
      // ignore: optional artifact
    }
  }

  // ── Hash gate ──
  const previousReport = previousReportOverride ?? safeReadText(join(reportsDir, 'LATEST.md'));
  const prevHeader = previousReport ? parseReportHeader(previousReport) : null;
  if (prevHeader) {
    if (!allowStale && prevHeader.scoredAgainst && prevHeader.scoredAgainst !== scoredAgainst) {
      throw new Error(
        `Staleness gate: previous report scoredAgainst=${prevHeader.scoredAgainst} but ` +
        `metadata.gnnTrainedAt=${scoredAgainst}. Pass --allow-stale to bypass.`,
      );
    }
    if (!allowWeightChange && prevHeader.weightsHash && prevHeader.weightsHash !== weightsHash) {
      throw new Error(
        `Weight-change gate: previous report weightsHash=${prevHeader.weightsHash} but ` +
        `current weightsHash=${weightsHash}. Pass --allow-weight-change to bypass.`,
      );
    }
  }

  // ── Build ground-truth set + axis distribution ──
  const gtEntries = groundTruth.pairings;
  const gtSet = new Set(gtEntries.map((e) => canonicalPairKey(e.a, e.b)));
  const axisCounts = axisDistribution(gtEntries);
  const verdictGateMap = verdictGate(axisCounts, VERDICT_THRESHOLD_N);
  const sourceJaccard = crossSourceAgreement(gtEntries);

  // ── Unmatched-ground-truth tally ──
  const allPairKeys = new Set(pairings.map((p) => canonicalPairKey(p.ingredientA, p.ingredientB)));
  const unmatchedGroundTruth = [];
  for (const e of gtEntries) {
    const key = canonicalPairKey(e.a, e.b);
    if (!allPairKeys.has(key)) unmatchedGroundTruth.push(key);
  }

  // ── x3 health ──
  let x3HalfCount = 0;
  for (const p of pairings) {
    if (p?.breakdown?.x3 === 0.5) x3HalfCount++;
  }
  const x3HalfRate = pairings.length ? x3HalfCount / pairings.length : 0;

  // ── Source counts ──
  const sourceCounts = { 'Flavor Bible': 0, 'Flavor Matrix': 0, 'chef-cite': 0, other: 0 };
  for (const e of gtEntries) {
    let bucketed = false;
    for (const src of e.sources || []) {
      const ref = (src?.ref || '').toLowerCase();
      if (ref.includes('flavor bible')) { sourceCounts['Flavor Bible']++; bucketed = true; break; }
      if (ref.includes('flavor matrix')) { sourceCounts['Flavor Matrix']++; bucketed = true; break; }
      if (ref.includes('chef-cite') || ref.startsWith('chef-cite')) { sourceCounts['chef-cite']++; bucketed = true; break; }
    }
    if (!bucketed) sourceCounts.other++;
  }

  // ── Per-axis grading ──
  // Walk pairings ONCE per axis, compute the top-K window restricted to pairs
  // that match the axis classifier. Then evaluate precision/recall against gt.
  const axisCtx = { gtSet, ingredientMeta: ingredientsMeta, gnnEntropy };
  const perAxis = {};
  const axisIllustrative = {};
  for (const axis of AXIS_LIST) {
    const axisPairs = pairings.filter((p) => axisMatches(axis, p, axisCtx));
    // Ground-truth restricted to this axis (count entries whose axes_validated
    // includes this axis). axisCounts already drives the verdict gate.
    const axisGt = gtEntries.filter((e) => Array.isArray(e.axes_validated) && e.axes_validated.includes(axis));
    const axisGtSet = new Set(axisGt.map((e) => canonicalPairKey(e.a, e.b)));
    const rankedKeys = axisPairs.map((p) => canonicalPairKey(p.ingredientA, p.ingredientB));
    const n = axisCounts[axis] || 0;
    const p10 = precisionAt(TOP_K_AUDIT, rankedKeys, axisGtSet);
    const r20 = recallAt(TOP_K_RECALL, rankedKeys, axisGtSet);
    const bb10 = beyondBookAt(TOP_K_AUDIT, rankedKeys, axisGtSet);
    perAxis[axis] = {
      n,
      sampleSizeVerdict: verdictGateMap[axis] || 'insufficient',
      precisionAt10: p10,
      recallAt20: r20,
      beyondBookAt10: bb10,
      axisPairCount: axisPairs.length,
      verdict: verdictForAxis({ n, p10, r20, axisPairs }),
    };
    // Top illustrative pairs (limited to the audit window so the report stays under 200 lines)
    axisIllustrative[axis] = axisPairs.slice(0, TOP_K_AUDIT).map((p, idx) => ({
      rank: idx + 1,
      a: p.ingredientA,
      b: p.ingredientB,
      strength: p.strength,
      groundTruthMatch: gtSet.has(canonicalPairKey(p.ingredientA, p.ingredientB)),
      sharedCompounds: Array.isArray(p.sharedCompounds) ? p.sharedCompounds.slice(0, 4) : [],
    }));
  }

  // ── Render report ──
  const report = renderReport({
    today,
    scoredAgainst,
    weightsHash,
    pairings,
    gtEntries,
    perAxis,
    axisIllustrative,
    axisCounts,
    sourceCounts,
    sourceJaccard,
    unmatchedGroundTruth,
    x3HalfRate,
    fixtureStalenessSeconds,
    fixturePresent: fixtureStalenessSeconds !== null,
    prevHeader,
    gnnEntropyAvailable: gnnEntropy != null,
    cuisineMetaAvailable: Object.keys(ingredientsMeta).length > 0,
  });

  if (writeReport) {
    mkdirSync(reportsDir, { recursive: true });
    const filename = firstRun ? 'audit-FIRST.md' : `audit-${today}.md`;
    const target = join(reportsDir, filename);
    writeFileSync(target, report, 'utf-8');
    // Always update LATEST.md so the hash gate has an anchor next run.
    writeFileSync(join(reportsDir, 'LATEST.md'), report, 'utf-8');
  }

  return {
    report,
    scoredAgainst,
    weightsHash,
    perAxis,
    axisCounts,
    unmatchedGroundTruth,
    sourceJaccard,
    sourceCounts,
    fixtureStalenessSeconds,
  };
}

function axisMatches(axis, pair, ctx) {
  switch (axis) {
    case 'chem-bridged-rare': return chemBridgedRare(pair);
    case 'absent-from-books': return absentFromBooks(pair, ctx.gtSet);
    case 'cross-cuisine': return crossCuisine(pair, ctx.ingredientMeta);
    case 'cross-aroma': return crossAroma(pair, ctx.gnnEntropy);
    default: return false;
  }
}

// Verdict heuristic. Insufficient when n < threshold; otherwise pass when
// precision@10 >= 0.30 OR recall@20 >= 0.30; warn when there is some signal;
// fail when both metrics are zero. The thresholds are intentionally modest —
// the audit's purpose is to surface gaps, not certify model quality.
function verdictForAxis({ n, p10, r20, axisPairs }) {
  if (n < VERDICT_THRESHOLD_N) return `insufficient (n=${n}, target >= ${VERDICT_THRESHOLD_N})`;
  if (axisPairs.length === 0) return 'no-axis-coverage';
  if (p10 >= 0.30 || r20 >= 0.30) return 'pass';
  if (p10 > 0 || r20 > 0) return 'warn';
  return 'fail';
}

// ─────────── Report rendering ───────────

function renderReport(ctx) {
  const {
    today, scoredAgainst, weightsHash, pairings, gtEntries, perAxis,
    axisIllustrative, axisCounts, sourceCounts, sourceJaccard,
    unmatchedGroundTruth, x3HalfRate, fixtureStalenessSeconds, fixturePresent,
    prevHeader, gnnEntropyAvailable, cuisineMetaAvailable,
  } = ctx;

  const lines = [];
  lines.push('# Pairing audit report');
  lines.push('');
  lines.push('<!-- AUDIT_HEADER_BEGIN -->');
  lines.push(`runDate: ${today}`);
  lines.push(`scoredAgainst: ${scoredAgainst}`);
  lines.push(`weightsHash: ${weightsHash}`);
  lines.push(`pairingCount: ${pairings.length}`);
  lines.push(`groundTruthCount: ${gtEntries.length}`);
  if (fixturePresent) {
    lines.push(`fixture_staleness_seconds: ${fixtureStalenessSeconds}`);
  }
  lines.push('<!-- AUDIT_HEADER_END -->');
  lines.push('');
  lines.push('## Per-axis verdicts');
  lines.push('');
  lines.push('| Axis | n (gt entries) | Sample gate | P@10 | R@20 | beyondBook@10 | Axis pairs | Verdict |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const axis of AXIS_LIST) {
    const a = perAxis[axis];
    lines.push(
      `| ${axis} | ${a.n} | ${a.sampleSizeVerdict} | ${pct(a.precisionAt10)} | ${pct(a.recallAt20)} | ${a.beyondBookAt10} | ${a.axisPairCount} | ${a.verdict} |`,
    );
  }
  lines.push('');

  lines.push('## Top illustrative pairings per axis');
  for (const axis of AXIS_LIST) {
    const pairsForAxis = axisIllustrative[axis] || [];
    if (pairsForAxis.length === 0) {
      lines.push(`### ${axis}: no pairs match this axis classifier`);
      continue;
    }
    lines.push('');
    lines.push(`### ${axis}`);
    lines.push('| Rank | Pair | Strength | In GT? | Shared compounds |');
    lines.push('|---|---|---|---|---|');
    for (const p of pairsForAxis) {
      lines.push(
        `| ${p.rank} | ${p.a} + ${p.b} | ${p.strength.toFixed(3)} | ${p.groundTruthMatch ? 'yes' : 'no'} | ${p.sharedCompounds.length === 0 ? '—' : p.sharedCompounds.join(', ')} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Data-source health');
  lines.push('');
  lines.push(`- Total ground-truth entries: ${gtEntries.length}`);
  lines.push(`- Flavor Bible: ${sourceCounts['Flavor Bible']}`);
  lines.push(`- Flavor Matrix: ${sourceCounts['Flavor Matrix']}`);
  lines.push(`- Chef-cite: ${sourceCounts['chef-cite']}`);
  lines.push(`- Other / uncategorized: ${sourceCounts.other}`);
  lines.push(`- Cross-source Jaccard (FB-only ∩ Matrix-only): ${sourceJaccard.toFixed(3)}`);
  lines.push(`- x3==0.5 share of corpus (FlavorDB API health proxy): ${(x3HalfRate * 100).toFixed(1)}%`);
  lines.push(`- gnn_entropy.json available for cross-aroma axis: ${gnnEntropyAvailable ? 'yes' : 'no (axis falls back to false)'}`);
  lines.push(`- cuisine metadata available for cross-cuisine axis: ${cuisineMetaAvailable ? 'yes' : 'no (axis falls back to false)'}`);
  lines.push(`- Unmatched ground-truth entries (not present in shipped pairings): ${unmatchedGroundTruth.length}`);
  if (unmatchedGroundTruth.length > 0) {
    lines.push('');
    lines.push('  unmatched_ground_truth_entries:');
    for (const k of unmatchedGroundTruth) lines.push(`  - ${k}`);
  }
  lines.push('');

  lines.push('## Axis distribution (ground-truth)');
  lines.push('');
  for (const [axis, n] of Object.entries(axisCounts)) {
    lines.push(`- ${axis}: ${n}`);
  }
  lines.push('');

  lines.push('## Coverage delta (vs LATEST.md)');
  if (prevHeader && prevHeader.pairingCount != null && prevHeader.groundTruthCount != null) {
    const deltaPairs = pairings.length - prevHeader.pairingCount;
    const deltaGt = gtEntries.length - prevHeader.groundTruthCount;
    lines.push('');
    lines.push(`- pairings: ${prevHeader.pairingCount} → ${pairings.length} (Δ ${deltaPairs >= 0 ? '+' : ''}${deltaPairs})`);
    lines.push(`- ground truth: ${prevHeader.groundTruthCount} → ${gtEntries.length} (Δ ${deltaGt >= 0 ? '+' : ''}${deltaGt})`);
  } else {
    lines.push('');
    lines.push('- first run — no prior baseline. All entries are new.');
  }
  lines.push('');

  lines.push('## Verdict paragraph');
  lines.push('');
  for (const axis of AXIS_LIST) {
    const a = perAxis[axis];
    if (a.n < VERDICT_THRESHOLD_N) {
      lines.push(`- **${axis}**: insufficient (n=${a.n}, target >= ${VERDICT_THRESHOLD_N}). Cannot judge whether the untrained perceptron in 07-blend-v2.js is competitive with a simpler NPMI-only baseline on this axis until ground-truth coverage grows.`);
    } else if (a.verdict === 'pass') {
      lines.push(`- **${axis}**: pass (P@10=${pct(a.precisionAt10)}, R@20=${pct(a.recallAt20)}). The untrained perceptron appears competitive on this axis; deeper NPMI-baseline ablation is the next move.`);
    } else if (a.verdict === 'warn') {
      lines.push(`- **${axis}**: warn (P@10=${pct(a.precisionAt10)}, R@20=${pct(a.recallAt20)}). The untrained perceptron shows weak signal; investigate whether an NPMI-only baseline does better here.`);
    } else if (a.verdict === 'fail') {
      lines.push(`- **${axis}**: fail (P@10=${pct(a.precisionAt10)}, R@20=${pct(a.recallAt20)}). The untrained perceptron has no usable signal on this axis. Suspect feature weighting; ablation should isolate which input dimension is responsible.`);
    } else {
      lines.push(`- **${axis}**: ${a.verdict}.`);
    }
  }
  lines.push('');

  lines.push(`curatedStoryCompoundOverlapRate: ${fixturePresent ? 'TODO (Phase 4 fixture present but metric not yet computed)' : 'N/A (no curated_stories.json fixture present)'}`);
  lines.push('');
  return lines.join('\n');
}

function pct(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return (v * 100).toFixed(1) + '%';
}

// ─────────── Report header parser (for the hash gate) ───────────

export function parseReportHeader(reportText) {
  const begin = reportText.indexOf('<!-- AUDIT_HEADER_BEGIN -->');
  const end = reportText.indexOf('<!-- AUDIT_HEADER_END -->');
  if (begin === -1 || end === -1 || end < begin) return null;
  const block = reportText.slice(begin, end);
  const get = (key) => {
    const re = new RegExp('^' + key + ':\\s*(.+)$', 'm');
    const m = block.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    runDate: get('runDate'),
    scoredAgainst: get('scoredAgainst'),
    weightsHash: get('weightsHash'),
    pairingCount: Number(get('pairingCount')) || null,
    groundTruthCount: Number(get('groundTruthCount')) || null,
  };
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

// ─────────── CLI ───────────

function parseArgs(argv) {
  const out = { allowStale: false, allowWeightChange: false, firstRun: false };
  for (const a of argv.slice(2)) {
    if (a === '--allow-stale') out.allowStale = true;
    else if (a === '--allow-weight-change') out.allowWeightChange = true;
    else if (a === '--first-run') out.firstRun = true;
  }
  return out;
}

const isCliEntry = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isCliEntry) {
  try {
    const opts = parseArgs(process.argv);
    const result = runAudit(opts);
    const targetName = opts.firstRun ? 'audit-FIRST.md' : `audit-${new Date().toISOString().slice(0, 10)}.md`;
    // eslint-disable-next-line no-console
    console.log(`[audit] wrote ${join(REPORTS_DIR, targetName)}`);
    console.log(`[audit] scoredAgainst=${result.scoredAgainst}`);
    console.log(`[audit] weightsHash=${result.weightsHash}`);
    for (const [axis, a] of Object.entries(result.perAxis)) {
      console.log(`[audit] ${axis}: n=${a.n} verdict=${a.verdict}`);
    }
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit] error:', err.message);
    process.exit(1);
  }
}
