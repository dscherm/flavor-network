/**
 * Cocktail Builder Persona Agent
 * Device: iPhone 13 (390x844, DPR 3)
 * Network: WiFi (30 Mbps)
 *
 * Journey: Load app -> switch to Cocktail Lab -> wait for graph build
 *          -> search "gin" -> add ingredients -> interact with CocktailPanel
 *
 * Measures: TTI, FCP, LCP, CLS, Cocktail Lab mount time, search latencies,
 *           builder interaction timing, FPS
 */

import { test, expect } from '@playwright/test';
import { applyThrottle } from '../lib/throttle.js';
import { personas, humanType, humanDelay } from '../lib/timing.js';
import {
  startFPSSampler, collectFPS,
  measureLoadMetrics, installFetchInterceptor, collectFetchMetrics,
  measureMemory, auditTapTargets, measureWebGLStats, bypassStartPage,
} from '../lib/metrics.js';
import { writeReport } from '../lib/reporter.js';

const timing = personas.cocktailBuilder;
const COCKTAIL_INGREDIENTS = ['gin', 'lime juice', 'simple syrup', 'tonic water'];

test('Cocktail Builder journey', async ({ page }) => {
  const report = {
    device: 'iPhone 13',
    network: 'WiFi',
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
  await bypassStartPage(page);
  const { cdp } = await applyThrottle(page, 'wifi');

  // --- Navigate + measure load ---
  await page.goto('/');
  report.loadMetrics = await measureLoadMetrics(page);
  report.fetchMetrics = await collectFetchMetrics(page);

  // Dismiss Walkthrough tour if it appears (blocks all interactions with z-[100] overlay)
  const skipTour = page.locator('button:has-text("Skip")').first();
  if (await skipTour.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipTour.click();
    await humanDelay(500);
  }

  // --- Switch to Cocktail Lab ---
  const labSwitchStart = Date.now();

  // Mobile: tap Labs in MobileTabBar
  const labsTab = page.locator('text=Labs').first();
  if (await labsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await labsTab.click();
    await humanDelay(300);

    const cocktailOption = page.locator('text=Cocktail Lab').first();
    if (await cocktailOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cocktailOption.click();
    }
  }

  // Wait for Cocktail Lab to render (it lazy-mounts + builds cocktail graph)
  await page.waitForSelector('canvas', { timeout: 15_000 }).catch(() => {});

  // Additional wait for cocktail graph to finish building
  // The lab shows its own loading spinner during buildCocktailGraph
  await page.waitForSelector('text=Initializing', { state: 'hidden', timeout: 15_000 })
    .catch(() => {});

  report.interactions.cocktailLabMountMs = Date.now() - labSwitchStart;

  if (report.interactions.cocktailLabMountMs > 3000) {
    report.painPoints.push({
      id: 'slow-cocktail-mount',
      severity: 'medium',
      metric: 'lab-mount',
      value: report.interactions.cocktailLabMountMs,
      description: `Cocktail Lab took ${report.interactions.cocktailLabMountMs}ms to mount and build graph`,
    });
  }

  // --- Start FPS sampling in Cocktail Lab ---
  await startFPSSampler(page);
  await humanDelay(timing.readingPause.mean);

  // --- Search and add cocktail ingredients ---
  report.interactions.searches = [];

  for (const ingredient of COCKTAIL_INGREDIENTS) {
    const searchStart = Date.now();

    const searchInput = page.locator('input[type="text"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill('');
      for (const char of ingredient) {
        await page.keyboard.type(char);
        await humanDelay(timing.typingDelay.mean, timing.typingDelay.std);
      }

      // Select first result via keyboard — avoids z-index overlap with Clear Selection bar
      await page.waitForSelector('[role="option"]', { timeout: 5000 }).catch(() => {});
      await page.keyboard.press('ArrowDown');
      await humanDelay(100);
      await page.keyboard.press('Enter');
    }

    const searchDuration = Date.now() - searchStart;
    report.interactions.searches.push({ ingredient, durationMs: searchDuration });

    await humanDelay(timing.tapPause.mean, timing.tapPause.std);
  }

  // --- Interact with CocktailPanel (if visible) ---
  const cocktailPanelBtn = page.locator('button[class*="cocktail"], [aria-label*="cocktail"]').first();
  if (await cocktailPanelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const panelOpenStart = Date.now();
    await cocktailPanelBtn.click();

    // Wait for panel content
    await page.waitForSelector('[class*="CocktailPanel"], [class*="cocktail-panel"]', {
      timeout: 5000,
    }).catch(() => {});

    report.interactions.cocktailPanelOpenMs = Date.now() - panelOpenStart;

    await humanDelay(timing.readingPause.mean);
  }

  // --- Check for the legend panel (cocktail-specific) ---
  const legendTab = page.locator('[class*="vertical"][class*="cursor-pointer"]').first();
  if (await legendTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await legendTab.click();
    await humanDelay(timing.readingPause.mean);

    // Check if legend overflows viewport
    const legendPanel = page.locator('[class*="legend"], [class*="slide"]').first();
    const legendBox = await legendPanel.boundingBox().catch(() => null);
    const viewport = page.viewportSize();

    if (legendBox && viewport && legendBox.width > viewport.width * 0.8) {
      report.painPoints.push({
        id: 'legend-overflow',
        severity: 'medium',
        metric: 'layout',
        value: legendBox.width,
        description: `Legend panel ${legendBox.width}px wide — takes ${Math.round(legendBox.width / viewport.width * 100)}% of ${viewport.width}px viewport`,
      });
    }
  }

  // --- Collect final metrics ---
  report.fps.cocktailLab = await collectFPS(page);

  if (report.fps.cocktailLab.fps < 30) {
    report.painPoints.push({
      id: 'low-fps-cocktail',
      severity: 'high',
      metric: 'FPS',
      value: report.fps.cocktailLab.fps,
      description: `Cocktail Lab FPS: ${report.fps.cocktailLab.fps} — 3D scene with post-processing may be too heavy`,
    });
  }

  report.memory = await measureMemory(page);
  report.tapTargets = await auditTapTargets(page);
  report.webgl = await measureWebGLStats(page);

  // Check memory growth from initial load
  if (report.memory.usedJSHeapMB > 200) {
    report.painPoints.push({
      id: 'high-memory-cocktail',
      severity: 'high',
      metric: 'memory',
      value: report.memory.usedJSHeapMB,
      description: `JS heap at ${report.memory.usedJSHeapMB}MB after Cocktail Lab interactions`,
    });
  }

  // --- Write report ---
  const filepath = writeReport('cocktail-builder', report);
  console.log(`Cocktail Builder report written to: ${filepath}`);
});
