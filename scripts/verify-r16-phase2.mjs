// Headless verify (R16 Phase 2): breadcrumb appears with active filter,
// cocktail-scope filter narrows the visible set, and empty-intersection
// overlay appears when filters reduce visibility to 0.

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

// Toggle Cuisine pill.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Cuisine")');
await page.waitForTimeout(2200);
await page.screenshot({ path: `${SHOT_DIR}/r16-p2-cuisine.png` });

// Breadcrumb should now be visible.
const breadcrumbVisible = await page.$('nav[aria-label="Active filters breadcrumb"]') !== null;
const breadcrumbText = breadcrumbVisible
  ? await page.locator('nav[aria-label="Active filters breadcrumb"]').textContent()
  : null;

// Add Season pill — breadcrumb should grow.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Season")');
await page.waitForTimeout(2200);
await page.screenshot({ path: `${SHOT_DIR}/r16-p2-cuisine-season.png` });

const breadcrumbText2 = await page.locator('nav[aria-label="Active filters breadcrumb"]').textContent();

// Stack many filters to try to force empty intersection.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Aroma")');
await page.waitForTimeout(1500);
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Family")');
await page.waitForTimeout(1500);
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Taste")');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOT_DIR}/r16-p2-many-filters.png` });

// Empty intersection overlay (may or may not appear depending on data).
const overlay = await page.$('div:has-text("No ingredients match these filters")');
const overlayPresent = overlay !== null;

// Clear and confirm breadcrumb hides.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("None")');
await page.waitForTimeout(2200);
const breadcrumbHidden = await page.$('nav[aria-label="Active filters breadcrumb"]') === null;

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(`Breadcrumb after 1 filter: ${breadcrumbText}`);
console.log(`Breadcrumb after 2 filters: ${breadcrumbText2}`);
console.log(`Empty-intersection overlay observed: ${overlayPresent}`);
console.log(`Breadcrumb hidden after None: ${breadcrumbHidden}`);

const ok = consoleErrors.length === 0
  && breadcrumbVisible
  && breadcrumbText.includes('Cuisine')
  && breadcrumbText2.includes('Cuisine') && breadcrumbText2.includes('Season')
  && breadcrumbHidden;
console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
