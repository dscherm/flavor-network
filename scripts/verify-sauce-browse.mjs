// Headless verify: land → Sauce tile → Browse (2D) → screenshots.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173/';
const SHOT_DIR = '.playwright-shots';
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });

await page.waitForSelector('[data-mode="sauce"]', { timeout: 5000 });
await page.click('[data-mode="sauce"]');

await page.waitForSelector('button:has-text("Browse (2D)")', { timeout: 20000 });
await page.click('button:has-text("Browse (2D)")');
await page.waitForSelector('[data-sauce-browse-root]', { timeout: 5000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOT_DIR}/sauce-lab-browse-default.png` });

// Click "Italian" cuisine chip
const italian = await page.$('button:has-text("Italian")');
if (italian) {
  await italian.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT_DIR}/sauce-lab-browse-italian.png` });
}

// Click first sauce row → detail panel
const firstRow = await page.$('[data-sauce-browse-root] ul li button');
if (firstRow) {
  await firstRow.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/sauce-lab-browse-detail.png` });
}

await browser.close();
console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach(e => console.log(`  - ${e}`));
console.log('Screenshots in', SHOT_DIR);
process.exit(consoleErrors.length === 0 ? 0 : 1);
