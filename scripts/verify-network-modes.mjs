// Headless verify (R16 Phase 1): Network mode dropdown collapsed to
// exactly 2 entries (3D Pairings, 2D Pairings), and the FilterPillRow
// renders 8 pills (None + 7 filters).

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

// Open the Network mode dropdown.
await page.click('button:has-text("3D Pairings")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOT_DIR}/network-mode-dropdown.png` });

// Read every menuitem in the dropdown — should be exactly 2.
const items = await page.$$eval(
  '[role="menu"] button',
  (btns) => btns.map((b) => b.textContent?.trim() || '')
);

// Close dropdown by clicking elsewhere
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// FilterPillRow: should have None + 7 filter pills = 8 checkbox buttons.
const pillCount = await page.$$eval(
  'div[role="group"][aria-label="Filter by"] button[role="checkbox"]',
  (btns) => btns.length
);

await page.screenshot({ path: `${SHOT_DIR}/network-filter-pill-row.png` });

// Click the Aroma pill to confirm morph + visibility still work.
const aromaPill = await page.$('div[role="group"][aria-label="Filter by"] button:has-text("Aroma")');
if (aromaPill) {
  await aromaPill.click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${SHOT_DIR}/network-filter-aroma-active.png` });
}

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(`Mode menuitems found (${items.length}):`);
items.forEach((t) => console.log(`  - ${t}`));
console.log(`Filter pill count: ${pillCount}`);

const expectedDropdown = ['3D Pairings', '2D Pairings'];
const dropdownOk = items.length === 2 && expectedDropdown.every((label) => items.some((t) => t.includes(label)));
const pillOk = pillCount === 8;
const ok = consoleErrors.length === 0 && dropdownOk && pillOk;
console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
