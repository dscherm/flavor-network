/**
 * Home Cook Persona Agent
 * Device: iPhone 12 (390x844, DPR 3)
 * Network: LTE (12 Mbps, 70ms latency)
 *
 * Journey: Browse network -> tap node on 3D canvas -> read IngredientPanel
 *          in BottomSheet -> scroll pairings -> attempt pinch/zoom
 *
 * Measures: TTI, FCP, LCP, CLS, touch-to-panel latency, scroll FPS,
 *           BottomSheet drag responsiveness, pinch/zoom failure detection
 */

import { test, expect } from '@playwright/test';
import { applyThrottle } from '../lib/throttle.js';
import { personas, humanDelay, touchDrag } from '../lib/timing.js';
import {
  startFPSSampler, collectFPS,
  measureLoadMetrics, installFetchInterceptor, collectFetchMetrics,
  measureMemory, auditTapTargets, testPinchZoom,
} from '../lib/metrics.js';
import { writeReport } from '../lib/reporter.js';

const timing = personas.homeCook;

test('Home Cook browsing journey', async ({ page }) => {
  const report = {
    device: 'iPhone 12',
    network: 'LTE',
    loadMetrics: {},
    fetchMetrics: {},
    fps: {},
    memory: {},
    tapTargets: {},
    interactions: {},
    webgl: {},
    painPoints: [],
  };

  // --- Setup ---
  await installFetchInterceptor(page);
  const { cdp } = await applyThrottle(page, 'lte');

  // --- Navigate + measure load ---
  await page.goto('/');
  report.loadMetrics = await measureLoadMetrics(page);
  report.fetchMetrics = await collectFetchMetrics(page);

  if (report.loadMetrics.tti > 8000) {
    report.painPoints.push({
      id: 'slow-tti-lte',
      severity: 'high',
      metric: 'TTI',
      value: report.loadMetrics.tti,
      description: `TTI ${report.loadMetrics.tti}ms on LTE exceeds 8s threshold`,
    });
  }

  // Check pairings.json parse time specifically
  const pairingsMetric = report.fetchMetrics['pairings.json'];
  if (pairingsMetric && pairingsMetric.parseMs > 200) {
    report.painPoints.push({
      id: 'json-parse-blocking',
      severity: 'high',
      metric: 'JSON parse',
      value: pairingsMetric.parseMs,
      description: `pairings.json parse blocked main thread for ${pairingsMetric.parseMs}ms`,
    });
  }

  // --- Start FPS sampling ---
  await startFPSSampler(page);

  // --- Wait for 3D scene to render ---
  await page.waitForSelector('canvas', { timeout: 15_000 });
  await humanDelay(timing.readingPause.mean, timing.readingPause.std);

  // --- Tap on 3D canvas (attempt node selection) ---
  const canvas = page.locator('canvas').first();
  const canvasBox = await canvas.boundingBox();

  if (canvasBox) {
    const tapStart = Date.now();

    // Tap center of canvas where nodes are likely clustered
    const tapX = canvasBox.x + canvasBox.width / 2;
    const tapY = canvasBox.y + canvasBox.height / 2;
    await page.touchscreen.tap(tapX, tapY);

    // Check if BottomSheet / IngredientPanel appeared
    const panelAppeared = await page.waitForSelector(
      '[class*="fixed"][class*="bottom-0"][class*="z-[65]"], [class*="IngredientPanel"]',
      { state: 'visible', timeout: 5000 }
    ).catch(() => null);

    report.interactions.tapToPanel = {
      durationMs: Date.now() - tapStart,
      panelOpened: !!panelAppeared,
    };

    if (!panelAppeared) {
      report.painPoints.push({
        id: 'canvas-tap-miss',
        severity: 'medium',
        metric: 'tap-accuracy',
        value: 0,
        description: 'Tap on 3D canvas center did not select a node — touch targets may be too small',
      });
    }

    // --- Scroll pairings in BottomSheet ---
    if (panelAppeared) {
      await humanDelay(timing.readingPause.mean);

      // Try to drag bottom sheet up (expand it)
      const sheetHandle = page.locator('[class*="cursor-grab"]').first();
      const handleBox = await sheetHandle.boundingBox().catch(() => null);

      if (handleBox) {
        report.interactions.dragHandleSize = {
          width: Math.round(handleBox.width),
          height: Math.round(handleBox.height),
        };

        if (handleBox.height < 44) {
          report.painPoints.push({
            id: 'drag-handle-too-small',
            severity: 'high',
            metric: 'tap-target',
            value: handleBox.height,
            description: `BottomSheet drag handle is ${handleBox.height}px tall (iOS minimum: 44px)`,
          });
        }

        // Drag upward to expand
        const dragStart = Date.now();
        await touchDrag(
          page,
          { x: handleBox.x + handleBox.width / 2, y: handleBox.y },
          { x: handleBox.x + handleBox.width / 2, y: handleBox.y - 300 },
          timing.swipeDuration
        );
        report.interactions.dragExpandMs = Date.now() - dragStart;
      }
    }

    // --- Test pinch/zoom on 3D canvas ---
    report.interactions.pinchZoom = await testPinchZoom(page, {
      x: tapX,
      y: tapY,
    });

    if (!report.interactions.pinchZoom.scaleChanged) {
      report.painPoints.push({
        id: 'no-pinch-zoom',
        severity: 'critical',
        metric: '3D-interaction',
        value: 0,
        description: '3D scene does not respond to pinch-to-zoom gesture — mobile users cannot navigate the network',
      });
    }
  }

  // --- Collect measurements ---
  report.fps.duringInteraction = await collectFPS(page);

  if (report.fps.duringInteraction.fps < 30) {
    report.painPoints.push({
      id: 'low-fps',
      severity: 'high',
      metric: 'FPS',
      value: report.fps.duringInteraction.fps,
      description: `Average FPS ${report.fps.duringInteraction.fps} during interaction (below 30fps threshold)`,
    });
  }

  report.memory = await measureMemory(page);
  report.tapTargets = await auditTapTargets(page);

  // --- Write report ---
  const filepath = writeReport('home-cook', report);
  console.log(`Home Cook report written to: ${filepath}`);
});
