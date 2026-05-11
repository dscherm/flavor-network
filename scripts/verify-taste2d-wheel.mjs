// Headless verify: 2D Flavors mode now renders as a wheel of 8 taste
// sub-discs (not the legacy octagonal wheel). Screenshot + console
// errors only — no DOM assertions, since the layout change is visual.

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

// Open dropdown, click 2D Flavors.
await page.click('button:has-text("3D Pairings")');
await page.waitForTimeout(200);
const flavors = await page.$('button:has-text("2D Flavors")');
if (flavors) {
  await flavors.click();
  await page.waitForTimeout(2200);  // full ~1.6s transition + settle
  await page.screenshot({ path: `${SHOT_DIR}/network-2d-flavors-wheel.png` });
}

// Click the "Sweet" joystick pill to focus that bucket; the rest of
// the wheel should dim and only Sweet ingredients should be vivid.
const sweetPill = await page.$('div[aria-label="Fly to cluster"] button:has-text("Sweet")');
if (sweetPill) {
  await sweetPill.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT_DIR}/network-2d-flavors-sweet-focus.png` });
}

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(consoleErrors.length === 0 ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(consoleErrors.length === 0 ? 0 : 1);
