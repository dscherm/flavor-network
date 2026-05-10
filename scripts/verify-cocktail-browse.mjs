// Headless verification: land → Cocktail Lab tile → wait for lab →
// click "Browse (2D)" toggle → capture screenshots + check console.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173/';
const SHOT_DIR = '.playwright-shots';

mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });

// 1. Land on the landing screen and click the Cocktail Lab tile.
await page.waitForSelector('[data-mode="cocktail"]', { timeout: 5000 });
await page.click('[data-mode="cocktail"]');

// 2. Wait for the lab to mount (the Explore/Browse toggle indicates
//    CocktailLabV2 has finished loading the codex graph).
await page.waitForSelector('button:has-text("Browse (2D)")', { timeout: 15000 });
await page.screenshot({ path: `${SHOT_DIR}/cocktail-lab-explore.png` });

// 3. Click the Browse (2D) toggle.
await page.click('button:has-text("Browse (2D)")');
await page.waitForSelector('[data-browse-root]', { timeout: 5000 });
// Give the SVG mini-map a tick to layout.
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOT_DIR}/cocktail-lab-browse-default.png` });

// 4. Click a family bubble (Sour Family — biggest count, easy target)
//    to verify filtering works.
const bubbles = await page.$$('[data-browse-root] svg g[style*="cursor"]');
if (bubbles.length >= 3) {
  // Bubble index 2 is Sour Family (149) per the FAMILY_GRID layout.
  await bubbles[2].click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT_DIR}/cocktail-lab-browse-sour.png` });
}

// 5. Click a spirit chip (Whiskey).
const whiskeyChip = await page.$('button:has-text("Whiskey")');
if (whiskeyChip) {
  await whiskeyChip.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT_DIR}/cocktail-lab-browse-sour-whiskey.png` });
}

// 6. Click a cocktail row to open the detail panel.
const firstCocktailRow = await page.$('[data-browse-root] ul li button');
if (firstCocktailRow) {
  await firstCocktailRow.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/cocktail-lab-browse-detail.png` });
}

// 7. Mobile pass.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOT_DIR}/cocktail-lab-browse-mobile.png` });

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log('Screenshots written to', SHOT_DIR);
process.exit(consoleErrors.length === 0 ? 0 : 1);
