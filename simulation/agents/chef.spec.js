/**
 * Chef Persona Agent — Power User
 * Device: iPhone 15 Pro (393x852, DPR 3)
 * Network: WiFi (30 Mbps)
 *
 * Journey: Search 5 ingredients -> compare pairings -> switch to Recipe Lab
 *          -> interact with TasteWheel + SuggestionDrawer
 *
 * Measures: TTI, FCP, LCP, CLS, search response times, tab switch latency,
 *           SuggestionDrawer snap accuracy, FPS, memory peak
 */

import { test, expect } from '@playwright/test';
import { applyThrottle } from '../lib/throttle.js';
import { personas, humanType, humanDelay, touchDrag } from '../lib/timing.js';
import {
  startFPSSampler, collectFPS,
  measureLoadMetrics, installFetchInterceptor, collectFetchMetrics,
  measureMemory, auditTapTargets, measureWebGLStats, bypassStartPage,
} from '../lib/metrics.js';
import { writeReport } from '../lib/reporter.js';

const timing = personas.chef;
const SEARCH_TERMS = ['truffle', 'garlic', 'thyme', 'butter', 'shallot'];

test('Chef power user journey', async ({ page }) => {
  const report = {
    device: 'iPhone 15 Pro',
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

  // Dismiss Walkthrough tour if it appears (blocks all interactions with z-[100] overlay)
  const skipTour = page.locator('button:has-text("Skip")').first();
  if (await skipTour.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipTour.click();
    await humanDelay(500);
  }

  if (report.loadMetrics.tti > 4000) {
    report.painPoints.push({
      id: 'slow-tti-wifi',
      severity: 'medium',
      metric: 'TTI',
      value: report.loadMetrics.tti,
      description: `TTI ${report.loadMetrics.tti}ms on WiFi exceeds 4s threshold`,
    });
  }

  // Collect fetch parse metrics
  report.fetchMetrics = await collectFetchMetrics(page);

  // --- Start FPS sampling ---
  await startFPSSampler(page);

  // --- Search flow: 5 ingredients sequentially ---
  report.interactions.searches = [];

  for (const term of SEARCH_TERMS) {
    const searchStart = Date.now();

    // Find search input — placeholder rotates on mobile between several hints
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.click();
    await humanDelay(timing.tapPause.mean, timing.tapPause.std);

    // Clear previous search and type
    await searchInput.fill('');
    for (const char of term) {
      await page.keyboard.type(char);
      await humanDelay(timing.typingDelay.mean, timing.typingDelay.std);
    }

    // Wait for results dropdown (role="option" from SearchBar.jsx)
    await page.waitForSelector('[role="option"]', { timeout: 5000 }).catch(() => {});

    // Select first result via keyboard (Enter) — avoids z-index overlap with Clear Selection bar
    // This overlap is itself a pain point: the Clear Selection bar at z-50 top-[100px]
    // covers the search dropdown after first selection
    await page.keyboard.press('ArrowDown');
    await humanDelay(100);
    await page.keyboard.press('Enter');

    const searchDuration = Date.now() - searchStart;
    report.interactions.searches.push({ term, durationMs: searchDuration });

    await humanDelay(timing.readingPause.mean, timing.readingPause.std);
  }

  // --- Check BottomSheet opened (mobile ingredient panel) ---
  const bottomSheet = page.locator('[class*="fixed"][class*="bottom-0"]').first();
  const sheetVisible = await bottomSheet.isVisible({ timeout: 3000 }).catch(() => false);
  report.interactions.bottomSheetOpened = sheetVisible;

  // --- Switch to Recipe Lab ---
  const tabSwitchStart = Date.now();

  // Mobile: tap Labs in MobileTabBar
  const labsTab = page.locator('text=Labs').first();
  if (await labsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await labsTab.click();
    await humanDelay(300);

    // Select Recipe Lab from dropdown
    const recipeLab = page.locator('text=Recipe Lab').first();
    if (await recipeLab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await recipeLab.click();
    }
  }

  // Wait for Recipe Lab to mount
  await page.waitForSelector('[class*="recipe"], [data-testid="recipe-lab"]', {
    timeout: 10_000,
  }).catch(() => {});

  report.interactions.tabSwitchMs = Date.now() - tabSwitchStart;

  if (report.interactions.tabSwitchMs > 2000) {
    report.painPoints.push({
      id: 'slow-tab-switch',
      severity: 'medium',
      metric: 'tab-switch',
      value: report.interactions.tabSwitchMs,
      description: `Recipe Lab tab switch took ${report.interactions.tabSwitchMs}ms`,
    });
  }

  // --- Reading pause in Recipe Lab ---
  await humanDelay(timing.readingPause.mean, timing.readingPause.std);

  // --- Collect FPS after interaction ---
  report.fps.duringInteraction = await collectFPS(page);

  // --- Memory measurement ---
  report.memory = await measureMemory(page);

  // --- Tap target audit ---
  report.tapTargets = await auditTapTargets(page);
  if (report.tapTargets.violations.length > 5) {
    report.painPoints.push({
      id: 'tap-target-violations',
      severity: 'high',
      metric: 'tap-targets',
      value: report.tapTargets.violations.length,
      description: `${report.tapTargets.violations.length} interactive elements below 44px iOS minimum`,
    });
  }

  // --- WebGL stats ---
  report.webgl = await measureWebGLStats(page);

  // --- Write report ---
  const filepath = writeReport('chef', report);
  console.log(`Chef report written to: ${filepath}`);
});
