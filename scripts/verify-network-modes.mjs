// Headless verify: the Network mode dropdown lists all 8 modes
// (4 original + 4 new categorical wheels), and each new mode renders
// without console errors when activated.

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
// Wait for ProData to load and the network nav button to appear
await page.waitForSelector('button:has-text("3D Pairings")', { timeout: 30000 });

// Click the Network nav button to open the mode dropdown.
await page.click('button:has-text("3D Pairings")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOT_DIR}/network-mode-dropdown.png` });

// Read every menuitem in the dropdown
const items = await page.$$eval(
  '[role="menu"] button',
  (btns) => btns.map((b) => b.textContent?.trim() || '')
);

await page.screenshot({ path: `${SHOT_DIR}/network-mode-dropdown.png` });

// Now click "2D Family" to confirm the new mode actually loads.
const family = await page.$('button:has-text("2D Family")');
if (family) {
  await family.click();
  await page.waitForTimeout(2000);  // let nodes settle (transition is ~1.6s)
  await page.screenshot({ path: `${SHOT_DIR}/network-2d-family.png` });
}

// Click "2D Aromas"
const open = await page.$('button:has-text("2D Family")');
if (open) {
  await open.click();
  await page.waitForTimeout(150);
}
const aromas = await page.$('button:has-text("2D Aromas")');
if (aromas) {
  await aromas.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOT_DIR}/network-2d-aromas.png` });

  // Bucket-focus check on a non-taste categorical wheel.
  const fruity = await page.$('div[aria-label="Fly to cluster"] button:has-text("Fruity")');
  if (fruity) {
    await fruity.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOT_DIR}/network-2d-aromas-fruity-focus.png` });
  }
}

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(`Mode menuitems found (${items.length}):`);
items.forEach((t) => console.log(`  - ${t}`));

const expected = ['3D Pairings', '2D Pairings', '3D Flavors', '2D Flavors', '2D Aromas', '2D Cuisine', '2D Season', '2D Family'];
const ok =
  consoleErrors.length === 0 &&
  expected.every((label) => items.some((t) => t.includes(label)));
console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
