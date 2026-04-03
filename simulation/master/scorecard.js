/**
 * Pain Point Scorecard renderer.
 * Builds a metric x device matrix with severity grades.
 */

import { gradeMetric, gradeFPS, thresholds } from '../lib/reporter.js';

/**
 * Build the scorecard matrix from persona reports.
 * @param {Object[]} reports - Array of persona report objects
 * @returns {{ matrix: Object, summary: Object }}
 */
export function buildScorecard(reports) {
  const matrix = {};
  const personas = {};

  for (const report of reports) {
    const key = `${report.persona}/${report.network}`;
    personas[key] = {
      device: report.device,
      network: report.network,
    };

    matrix[key] = {
      tti: gradeCell('tti', report.loadMetrics?.tti),
      fcp: gradeCell('fcp', report.loadMetrics?.fcp),
      lcp: gradeCell('lcp', report.loadMetrics?.lcp),
      cls: gradeCell('cls', report.loadMetrics?.cls),
      fps: gradeFPSCell(report.fps?.duringInteraction?.fps || report.fps?.afterTour?.fps || report.fps?.cocktailLab?.fps),
      jsonParseMs: gradeCell('jsonParseMs', report.fetchMetrics?.['pairings.json']?.parseMs),
      memoryMB: gradeCell('memoryMB', report.memory?.usedJSHeapMB),
      tapViolations: gradeCell('tapViolations', report.tapTargets?.violations?.length),
      bounceRisk: report.bounceAnalysis?.bounceRisk || 'N/A',
    };
  }

  // Summary: worst grade per metric across all personas
  const metricNames = ['tti', 'fcp', 'lcp', 'cls', 'fps', 'jsonParseMs', 'memoryMB', 'tapViolations'];
  const worstByMetric = {};

  for (const metric of metricNames) {
    let worstGrade = 'A';
    let worstValue = null;
    const gradeOrder = { A: 0, B: 1, C: 2, D: 3, F: 4 };

    for (const [personaKey, cells] of Object.entries(matrix)) {
      const cell = cells[metric];
      if (cell && cell.grade && gradeOrder[cell.grade] > gradeOrder[worstGrade]) {
        worstGrade = cell.grade;
        worstValue = cell.value;
      }
    }

    worstByMetric[metric] = { grade: worstGrade, value: worstValue };
  }

  return { matrix, personas, worstByMetric };
}

function gradeCell(metric, value) {
  if (value == null) return { grade: '-', value: null, color: 'gray' };
  const result = gradeMetric(value, thresholds[metric]);
  return { ...result, value };
}

function gradeFPSCell(fps) {
  if (fps == null) return { grade: '-', value: null, color: 'gray' };
  const result = gradeFPS(fps);
  return { ...result, value: fps };
}

/**
 * Render scorecard as markdown table.
 * @param {{ matrix: Object, personas: Object, worstByMetric: Object }} scorecard
 * @returns {string}
 */
export function renderMarkdown(scorecard) {
  const keys = Object.keys(scorecard.matrix);
  if (keys.length === 0) return '# Scorecard\n\nNo data available.\n';

  const metrics = [
    { key: 'tti', label: 'TTI (ms)', unit: 'ms' },
    { key: 'fcp', label: 'FCP (ms)', unit: 'ms' },
    { key: 'lcp', label: 'LCP (ms)', unit: 'ms' },
    { key: 'cls', label: 'CLS', unit: '' },
    { key: 'fps', label: 'FPS (p50)', unit: '' },
    { key: 'jsonParseMs', label: 'JSON Parse Block', unit: 'ms' },
    { key: 'memoryMB', label: 'Memory Peak', unit: 'MB' },
    { key: 'tapViolations', label: 'Tap Target Violations', unit: '' },
    { key: 'bounceRisk', label: 'Bounce Risk', unit: '' },
  ];

  const header = `| Metric | ${keys.map(k => k).join(' | ')} | Worst |`;
  const sep = `|--------|${keys.map(() => '------').join('|')}|-------|`;

  const rows = metrics.map(m => {
    const cells = keys.map(k => {
      const cell = scorecard.matrix[k][m.key];
      if (typeof cell === 'string') return cell; // bounceRisk
      if (!cell || cell.grade === '-') return '-';
      return `${cell.grade} (${cell.value}${m.unit})`;
    });
    const worst = scorecard.worstByMetric[m.key];
    const worstStr = worst ? `**${worst.grade}**` : '-';
    return `| ${m.label} | ${cells.join(' | ')} | ${worstStr} |`;
  });

  return [
    '# Pain Point Scorecard',
    '',
    '> SwiftShader baseline — real device FPS will differ. Relative comparisons are valid.',
    '',
    header,
    sep,
    ...rows,
    '',
  ].join('\n');
}
