// Headless verification: load LandingScreen, capture console errors,
// confirm AnimatedLogo and the 3 tiles render. Saves a screenshot for
// visual review. Exits non-zero on console error or missing element.
//
// Usage: node scripts/verify-landing.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173/';
const SHOT_DIR = '.playwright-shots';

mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });

// LandingScreen renders the dialog with id="fn-landing-title" sr-only,
// AnimatedLogo with role="img", and 3 tiles with data-mode attrs.
await page.waitForSelector('[role="dialog"][aria-labelledby="fn-landing-title"]', { timeout: 5000 });
const logo = await page.$('svg[aria-label="Neural Flavor"]');
const tiles = await page.$$('[data-mode]');
const tileModes = await Promise.all(tiles.map((t) => t.getAttribute('data-mode')));

await page.screenshot({ path: `${SHOT_DIR}/landing-desktop.png`, fullPage: false });

// Mobile viewport pass
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOT_DIR}/landing-mobile.png`, fullPage: false });

await browser.close();

console.log(`Console errors:    ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(`AnimatedLogo SVG:  ${logo ? 'present' : 'MISSING'}`);
console.log(`Landing tiles:     [${tileModes.join(', ')}]`);
console.log(`Screenshots:       ${SHOT_DIR}/landing-desktop.png, ${SHOT_DIR}/landing-mobile.png`);

const ok =
  consoleErrors.length === 0 &&
  logo &&
  tileModes.length === 3 &&
  ['pairing', 'cocktail', 'sauce'].every((m) => tileModes.includes(m));

if (!ok) {
  console.error('VERIFY FAILED');
  process.exit(1);
}
console.log('VERIFY PASSED');
