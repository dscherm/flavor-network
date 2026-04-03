/**
 * Master Aggregation Agent
 *
 * Reads all 4 persona report JSONs, runs static heuristic analysis,
 * builds the pain point scorecard, and produces:
 *   - output/scorecard.json
 *   - output/recommendations.md
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runHeuristics } from './heuristics.js';
import { buildScorecard, renderMarkdown } from './scorecard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

function main() {
  console.log('=== Master Aggregation Agent ===\n');

  // --- 1. Load persona reports ---
  const reportFiles = readdirSync(OUTPUT_DIR).filter(f => f.endsWith('-report.json'));
  console.log(`Found ${reportFiles.length} persona reports:`);

  const reports = [];
  for (const file of reportFiles) {
    const data = JSON.parse(readFileSync(join(OUTPUT_DIR, file), 'utf-8'));
    reports.push(data);
    console.log(`  - ${data.persona} (${data.device} / ${data.network})`);
  }

  if (reports.length === 0) {
    console.error('No persona reports found. Run the simulation first.');
    process.exit(1);
  }

  // --- 2. Run static heuristics ---
  console.log('\nRunning static heuristic analysis...');
  const heuristics = runHeuristics();
  console.log(`  Heuristic score: ${heuristics.score}/100`);
  console.log(`  Pass: ${heuristics.summary.pass} | Warn: ${heuristics.summary.warn} | Fail: ${heuristics.summary.fail}`);

  // --- 3. Build scorecard ---
  console.log('\nBuilding pain point scorecard...');
  const scorecard = buildScorecard(reports);

  // --- 4. Aggregate all pain points ---
  const allPainPoints = [];

  // From persona agents
  for (const report of reports) {
    for (const pp of (report.painPoints || [])) {
      allPainPoints.push({
        ...pp,
        source: `${report.persona} agent`,
        device: report.device,
        network: report.network,
      });
    }
  }

  // From heuristics
  for (const check of heuristics.checks) {
    if (check.status === 'fail') {
      allPainPoints.push({
        id: check.id,
        severity: 'high',
        metric: check.name,
        description: check.detail,
        source: 'heuristic analysis',
      });
    } else if (check.status === 'warn') {
      allPainPoints.push({
        id: check.id,
        severity: 'medium',
        metric: check.name,
        description: check.detail,
        source: 'heuristic analysis',
      });
    }
  }

  // Deduplicate by id (keep highest severity)
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const dedupMap = new Map();
  for (const pp of allPainPoints) {
    const existing = dedupMap.get(pp.id);
    if (!existing || (severityOrder[pp.severity] || 0) > (severityOrder[existing.severity] || 0)) {
      dedupMap.set(pp.id, pp);
    }
  }

  const rankedPainPoints = [...dedupMap.values()]
    .sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));

  // --- 5. Write outputs ---
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Scorecard JSON
  const scorecardOutput = {
    timestamp: new Date().toISOString(),
    personaCount: reports.length,
    heuristicScore: heuristics.score,
    scorecard,
    painPoints: rankedPainPoints,
    heuristics: heuristics.checks,
  };

  writeFileSync(
    join(OUTPUT_DIR, 'scorecard.json'),
    JSON.stringify(scorecardOutput, null, 2)
  );
  console.log(`\nWrote: output/scorecard.json`);

  // Recommendations markdown
  const md = generateRecommendations(scorecard, rankedPainPoints, heuristics);
  writeFileSync(join(OUTPUT_DIR, 'recommendations.md'), md);
  console.log(`Wrote: output/recommendations.md`);

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total pain points: ${rankedPainPoints.length}`);
  console.log(`  Critical: ${rankedPainPoints.filter(p => p.severity === 'critical').length}`);
  console.log(`  High:     ${rankedPainPoints.filter(p => p.severity === 'high').length}`);
  console.log(`  Medium:   ${rankedPainPoints.filter(p => p.severity === 'medium').length}`);
  console.log(`  Low:      ${rankedPainPoints.filter(p => p.severity === 'low').length}`);
  console.log(`\nHeuristic score: ${heuristics.score}/100`);
  console.log(`Worst metric: ${Object.entries(scorecard.worstByMetric)
    .filter(([, v]) => v.grade === 'F')
    .map(([k]) => k)
    .join(', ') || 'none at F grade'}`);
}

function generateRecommendations(scorecard, painPoints, heuristics) {
  const lines = [
    '# iOS UX Pain Point Recommendations',
    '',
    `> Generated: ${new Date().toISOString()}`,
    `> Heuristic score: ${heuristics.score}/100`,
    '',
    renderMarkdown(scorecard),
    '',
    '## Priority-Ranked Pain Points',
    '',
  ];

  let rank = 1;
  for (const pp of painPoints) {
    const icon = pp.severity === 'critical' ? '!!!' : pp.severity === 'high' ? '!!' : '!';
    lines.push(`### ${rank}. [${pp.severity.toUpperCase()}] ${pp.id}`);
    lines.push('');
    lines.push(`**Source:** ${pp.source || 'unknown'}`);
    if (pp.device) lines.push(`**Device:** ${pp.device} / ${pp.network}`);
    if (pp.value != null) lines.push(`**Measured value:** ${pp.value}`);
    lines.push(`**Description:** ${pp.description}`);
    lines.push('');
    rank++;
  }

  // Heuristic checks section
  lines.push('## Static Code Analysis');
  lines.push('');

  for (const check of heuristics.checks) {
    const icon = check.status === 'pass' ? 'PASS' : check.status === 'fail' ? 'FAIL' : 'WARN';
    lines.push(`- **[${icon}]** ${check.name}: ${check.detail}`);
  }

  lines.push('');
  lines.push('## Suggested Fixes (by effort)');
  lines.push('');
  lines.push('### Quick Wins (< 2 hours)');
  lines.push('1. Add `vite-plugin-compression` for gzip/brotli — reduces 27MB to ~3-5MB');
  lines.push('2. Add `touchstart` to SearchBar click-outside handler');
  lines.push('3. Increase BottomSheet drag handle to 44px height');
  lines.push('4. Cap `devicePixelRatio` to `Math.min(2, window.devicePixelRatio)` on mobile');
  lines.push('5. Add `React.memo()` to SearchBar, Legend, Controls');
  lines.push('');
  lines.push('### Medium Effort (4-8 hours)');
  lines.push('6. Move JSON parsing to Web Worker');
  lines.push('7. Add loading progress bar (% based on fetch progress)');
  lines.push('8. Reduce sphere geometry detail on mobile (16x16 -> 8x8)');
  lines.push('9. Reduce particle count on mobile');
  lines.push('10. Add `lowp` precision hints to EdgeMesh shader');
  lines.push('');
  lines.push('### High Impact (1-2 weeks)');
  lines.push('11. Split pairings.json by category — lazy-load on demand');
  lines.push('12. Toggle bloom post-processing off on older devices');
  lines.push('13. Implement PWA offline caching for data files');
  lines.push('14. Add adaptive quality (FPS monitor -> reduce detail if dropping)');
  lines.push('');
  lines.push('---');
  lines.push('*Generated by Flavor Network iOS Simulation System v1.0.0*');
  lines.push('*Runtime: Playwright + Chromium (SwiftShader) — FPS values are baselines, not real-device measurements*');

  return lines.join('\n');
}

main();
