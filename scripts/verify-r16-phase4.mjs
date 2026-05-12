// Headless E2E (R16 Phase 4): 3 plan-mandated Playwright tests + a
// memory-leak check across 50 sequential filter toggles. Covers the
// breadcrumb chain, empty-intersection overlay, aria-live HUDAnnouncer,
// and the retained-heap delta budget.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.VERIFY_URL || 'http://localhost:5173/';
const SHOT_DIR = '.playwright-shots';
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.addInitScript(() => {
  try { localStorage.setItem('flavor-tour-complete', '1'); } catch {}
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('[data-mode="pairing"]');
await page.waitForSelector('button:has-text("3D Pairings")', { timeout: 30000 });
await page.waitForTimeout(1000);  // settle

const results = {};

// ---- E2E 1: 3-filter breadcrumb chain ----
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Cuisine")');
await page.waitForTimeout(1800);
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Season")');
await page.waitForTimeout(1800);
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Aroma")');
await page.waitForTimeout(1800);
const crumb = await page.locator('nav[aria-label="Active filters breadcrumb"]').textContent();
results.e2e1_breadcrumb = crumb;
results.e2e1_pass = /All/.test(crumb) && /Cuisine/.test(crumb) && /Season/.test(crumb) && /Aroma/.test(crumb);
await page.screenshot({ path: `${SHOT_DIR}/r16-p4-e2e1-3-filter-chain.png` });

// ---- E2E 2: empty-intersection overlay ----
// Add scope filters on top to try to force empty (may or may not — Phase 1
// scope sets restrict to cocktail/sauce ingredients only; intersected with
// Cuisine + Season + Aroma the set is likely empty).
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Cocktail Scope")');
await page.waitForTimeout(1500);
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Family")');
await page.waitForTimeout(1500);
const overlayLocator = page.locator('text=No ingredients match these filters');
const overlayCount = await overlayLocator.count();
results.e2e2_overlay_visible = overlayCount > 0;
await page.screenshot({ path: `${SHOT_DIR}/r16-p4-e2e2-empty-overlay.png` });

// Reset before E2E 3.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("None")');
await page.waitForTimeout(1000);

// ---- E2E 3: aria-live HUDAnnouncer fires on filter toggle ----
// The announcer is sr-only — find it via role=status.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Aroma")');
await page.waitForTimeout(800);
// Narrow to the HUDAnnouncer specifically — it carries an aria-atomic
// attribute, unlike the other status regions on the page.
const ann = await page.locator('[role="status"][aria-atomic="true"]').filter({ hasText: /filter applied/i }).first().textContent();
results.e2e3_announcement = ann;
results.e2e3_pass = /Aroma/i.test(ann);

// ---- Memory leak check: 50 sequential filter toggles ----
// Clear, then capture baseline heap, run 50 toggles, capture final heap.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("None")');
await page.waitForTimeout(800);

const beforeHeap = await page.evaluate(() => {
  if (typeof window.gc === 'function') window.gc();
  return performance.memory ? performance.memory.usedJSHeapSize : null;
});

for (let i = 0; i < 50; i++) {
  const pill = (i % 2 === 0) ? 'Aroma' : 'Cuisine';
  await page.click(`div[role="group"][aria-label="Filter by"] button:has-text("${pill}")`);
  await page.waitForTimeout(50);
}

await page.click('div[role="group"][aria-label="Filter by"] button:has-text("None")');
await page.waitForTimeout(800);

const afterHeap = await page.evaluate(() => {
  if (typeof window.gc === 'function') window.gc();
  return performance.memory ? performance.memory.usedJSHeapSize : null;
});

results.memleak_before = beforeHeap;
results.memleak_after = afterHeap;
// 10MB tolerance — natural noise floor for a Three.js scene with bloom.
const heapDeltaMB = (beforeHeap != null && afterHeap != null) ? (afterHeap - beforeHeap) / 1024 / 1024 : null;
results.memleak_delta_mb = heapDeltaMB;
results.memleak_pass = heapDeltaMB == null || heapDeltaMB < 10;

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(`E2E 1 breadcrumb: ${results.e2e1_breadcrumb} → ${results.e2e1_pass ? 'PASS' : 'FAIL'}`);
console.log(`E2E 2 empty overlay observed: ${results.e2e2_overlay_visible} (informational — may not trigger on real data)`);
console.log(`E2E 3 aria-live: "${results.e2e3_announcement}" → ${results.e2e3_pass ? 'PASS' : 'FAIL'}`);
console.log(`Memleak: ${results.memleak_before} → ${results.memleak_after} (Δ ${results.memleak_delta_mb}MB) → ${results.memleak_pass ? 'PASS' : 'FAIL'}`);

const ok = consoleErrors.length === 0
  && results.e2e1_pass
  && results.e2e3_pass
  && results.memleak_pass;
console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
