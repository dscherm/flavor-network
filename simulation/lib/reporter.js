/**
 * Structured JSON report writer for persona agents.
 * Each persona produces a report file consumed by the master agent.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

/**
 * @typedef {Object} PersonaReport
 * @property {string} persona - Persona name
 * @property {string} device - Device name
 * @property {string} network - Network profile
 * @property {string} timestamp - ISO timestamp
 * @property {object} loadMetrics - TTI, FCP, LCP, CLS
 * @property {object} fetchMetrics - JSON parse durations per file
 * @property {object} fps - FPS measurements during different phases
 * @property {object} memory - JS heap measurements
 * @property {object} tapTargets - Tap target audit results
 * @property {object} interactions - Per-action timing measurements
 * @property {object} webgl - Three.js renderer stats
 * @property {object} painPoints - Detected pain points with severity
 */

/**
 * Write a persona report to the output directory.
 * @param {string} persona - Persona slug (e.g., 'chef', 'home-cook')
 * @param {PersonaReport} report
 */
export function writeReport(persona, report) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const filepath = join(OUTPUT_DIR, `${persona}-report.json`);

  const enriched = {
    ...report,
    persona,
    timestamp: new Date().toISOString(),
    simulationVersion: '1.0.0',
    runtime: 'playwright-chromium-swiftshader',
  };

  writeFileSync(filepath, JSON.stringify(enriched, null, 2));
  return filepath;
}

/**
 * Score a metric value against thresholds.
 * @param {number} value
 * @param {number[]} thresholds - [A, B, C, D] boundaries (ascending = worse)
 * @returns {{ grade: string, color: string }}
 */
export function gradeMetric(value, thresholds) {
  const [a, b, c, d] = thresholds;
  if (value <= a) return { grade: 'A', color: 'green' };
  if (value <= b) return { grade: 'B', color: 'lime' };
  if (value <= c) return { grade: 'C', color: 'yellow' };
  if (value <= d) return { grade: 'D', color: 'orange' };
  return { grade: 'F', color: 'red' };
}

/**
 * Grading thresholds for key metrics.
 * Based on Web Vitals standards + iOS UX guidelines.
 */
export const thresholds = {
  tti:          [2000, 4000, 8000, 15000],     // ms — Google "good" < 3.8s
  fcp:          [1800, 3000, 5000, 10000],     // ms — Web Vitals
  lcp:          [2500, 4000, 6000, 12000],     // ms — Web Vitals
  cls:          [0.1, 0.25, 0.5, 1.0],         // score — Web Vitals
  fps:          [55, 45, 30, 20],              // inverted — higher is better
  jsonParseMs:  [50, 150, 500, 1000],          // ms blocking main thread
  memoryMB:     [100, 200, 350, 500],          // MB JS heap
  tapViolations:[0, 3, 8, 15],                 // count of undersized targets
};

/**
 * Grade FPS (inverted scale — higher is better).
 */
export function gradeFPS(fps) {
  if (fps >= 55) return { grade: 'A', color: 'green' };
  if (fps >= 45) return { grade: 'B', color: 'lime' };
  if (fps >= 30) return { grade: 'C', color: 'yellow' };
  if (fps >= 20) return { grade: 'D', color: 'orange' };
  return { grade: 'F', color: 'red' };
}
