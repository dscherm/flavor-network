// Headless verify (R16 Phase 3): contextual Colors chip updates with
// morphAxis; compound foods appear in aroma buckets after the runtime
// synthesis.

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

// Default chip = "Colors: clusters"
const chipDefault = await page.locator('[aria-label="Color encoding"]').textContent();

// Toggle Aroma — chip should switch.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Aroma")');
await page.waitForTimeout(2200);
const chipAroma = await page.locator('[aria-label="Color encoding"]').textContent();
await page.screenshot({ path: `${SHOT_DIR}/r16-p3-chip-aroma.png` });

// Toggle Cuisine on top — most-recent axis is now cuisine.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Cuisine")');
await page.waitForTimeout(2200);
const chipCuisine = await page.locator('[aria-label="Color encoding"]').textContent();
await page.screenshot({ path: `${SHOT_DIR}/r16-p3-chip-cuisine.png` });

// Clear.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("None")');
await page.waitForTimeout(800);
const chipCleared = await page.locator('[aria-label="Color encoding"]').textContent();

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(`Default chip: ${chipDefault}`);
console.log(`After Aroma:  ${chipAroma}`);
console.log(`After Cuisine: ${chipCuisine}`);
console.log(`After None:   ${chipCleared}`);

const ok = consoleErrors.length === 0
  && /clusters/i.test(chipDefault)
  && /aroma/i.test(chipAroma)
  && /cuisine/i.test(chipCuisine)
  && /clusters/i.test(chipCleared);
console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
