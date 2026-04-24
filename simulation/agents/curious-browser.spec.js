/**
 * Curious Browser Persona Agent — Worst-Case Scenario
 * Device: iPhone SE 2nd gen (375x667, DPR 2)
 * Network: Slow 4G (1.5 Mbps, 300ms latency)
 *
 * Journey: Cold load (27MB/1.5Mbps = ~144s) -> tour walkthrough -> tap node
 *          -> bounce detection if TTI > 15s
 *
 * Measures: Total page weight, TTI, FCP, LCP, CLS, JSON parse blocking,
 *           bounce risk score, tour completion rate, FPS on weaker GPU
 */

import { test, expect } from '@playwright/test';
import { applyThrottle } from '../lib/throttle.js';
import { personas, humanDelay } from '../lib/timing.js';
import {
  startFPSSampler, collectFPS,
  measureLoadMetrics, installFetchInterceptor, collectFetchMetrics,
  measureMemory, auditTapTargets, bypassStartPage,
} from '../lib/metrics.js';
import { writeReport } from '../lib/reporter.js';

const timing = personas.curiousBrowser;

// Bounce thresholds (seconds)
const BOUNCE_THRESHOLD_LIKELY = 15_000;
const BOUNCE_THRESHOLD_CERTAIN = 30_000;

test('Curious Browser worst-case journey', async ({ page }) => {
  const report = {
    device: 'iPhone SE 2nd gen',
    network: 'Slow 4G',
    loadMetrics: {},
    fetchMetrics: {},
    fps: {},
    memory: {},
    tapTargets: {},
    interactions: {},
    webgl: {},
    painPoints: [],
    bounceAnalysis: {},
  };

  // --- Setup ---
  await installFetchInterceptor(page);
  await bypassStartPage(page);
  const { cdp } = await applyThrottle(page, 'slow4g');

  // --- Track page weight via CDP ---
  let totalBytesTransferred = 0;
  await cdp.send('Network.enable');
  cdp.on('Network.loadingFinished', (params) => {
    totalBytesTransferred += params.encodedDataLength || 0;
  });

  // --- Navigate + measure load (this is the long one) ---
  const navStart = Date.now();
  await page.goto('/', { waitUntil: 'commit' });

  // Check for FCP while waiting
  const fcpPromise = page.waitForSelector('.text-neural-text, canvas, [class*="SearchBar"]', {
    timeout: 240_000,
  }).catch(() => null);

  report.loadMetrics = await measureLoadMetrics(page, 240_000);
  report.fetchMetrics = await collectFetchMetrics(page);
  const totalLoadTime = Date.now() - navStart;

  // --- Bounce risk analysis ---
  report.bounceAnalysis = {
    totalLoadTimeMs: totalLoadTime,
    ttiMs: report.loadMetrics.tti,
    bounceRisk: totalLoadTime < BOUNCE_THRESHOLD_LIKELY ? 'low'
      : totalLoadTime < BOUNCE_THRESHOLD_CERTAIN ? 'high'
      : 'critical',
    pageWeightBytes: totalBytesTransferred,
    pageWeightMB: Math.round(totalBytesTransferred / 1024 / 1024 * 10) / 10,
  };

  if (report.bounceAnalysis.bounceRisk !== 'low') {
    report.painPoints.push({
      id: 'bounce-risk',
      severity: 'critical',
      metric: 'TTI',
      value: totalLoadTime,
      description: `${report.bounceAnalysis.bounceRisk} bounce risk: ${Math.round(totalLoadTime / 1000)}s load on Slow 4G. Page weight: ${report.bounceAnalysis.pageWeightMB}MB`,
    });
  }

  // Track pairings.json specifically
  const pairingsMetric = report.fetchMetrics['pairings.json'];
  if (pairingsMetric) {
    report.painPoints.push({
      id: 'pairings-fetch-slow4g',
      severity: 'critical',
      metric: 'network',
      value: pairingsMetric.totalMs,
      description: `pairings.json: ${Math.round(pairingsMetric.totalMs / 1000)}s total (${pairingsMetric.networkMs}ms network + ${pairingsMetric.parseMs}ms parse) on Slow 4G`,
    });
  }

  // If we didn't bounce, continue the journey
  if (report.bounceAnalysis.bounceRisk === 'critical') {
    report.interactions.journeyCompleted = false;
    const filepath = writeReport('curious-browser', report);
    console.log(`Curious Browser report written to: ${filepath}`);
    return; // "User bounced"
  }

  // --- Start FPS sampling ---
  await startFPSSampler(page);

  // --- Tour walkthrough ---
  report.interactions.tour = { stepsCompleted: 0, totalSteps: 7 };

  // Check if tour is showing (Walkthrough component shows on first visit)
  const tourModal = page.locator('text=Welcome to the Flavor Network, text=Welcome').first();
  const tourVisible = await tourModal.isVisible({ timeout: 5000 }).catch(() => false);

  if (tourVisible) {
    // Step through tour
    for (let step = 0; step < 7; step++) {
      await humanDelay(timing.readingPause.mean, timing.readingPause.std);

      const nextBtn = page.locator('button:has-text("Next"), button:has-text("Start Exploring")').first();
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtn.click();
        report.interactions.tour.stepsCompleted++;
      } else {
        break;
      }
    }
  }
  report.interactions.tour.completed = report.interactions.tour.stepsCompleted >= 6;

  // --- Tap on network canvas ---
  await humanDelay(timing.tapPause.mean, timing.tapPause.std);

  const canvas = page.locator('canvas').first();
  const canvasBox = await canvas.boundingBox().catch(() => null);

  if (canvasBox) {
    // Tap near center
    await page.touchscreen.tap(
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2
    );
    await humanDelay(timing.readingPause.mean);
  }

  // --- Collect final metrics ---
  report.fps.afterTour = await collectFPS(page);

  if (report.fps.afterTour.fps < 25) {
    report.painPoints.push({
      id: 'low-fps-se',
      severity: 'high',
      metric: 'FPS',
      value: report.fps.afterTour.fps,
      description: `iPhone SE FPS: ${report.fps.afterTour.fps} (DPR 2 + SwiftShader). Real device may be similar with weaker GPU.`,
    });
  }

  report.memory = await measureMemory(page);
  report.tapTargets = await auditTapTargets(page);

  if (report.tapTargets.violations.length > 0) {
    report.painPoints.push({
      id: 'tap-targets-se',
      severity: 'high',
      metric: 'tap-targets',
      value: report.tapTargets.violations.length,
      description: `${report.tapTargets.violations.length} tap targets below 44px on iPhone SE's smaller 375px screen`,
    });
  }

  report.interactions.journeyCompleted = true;

  // --- Write report ---
  const filepath = writeReport('curious-browser', report);
  console.log(`Curious Browser report written to: ${filepath}`);
});
