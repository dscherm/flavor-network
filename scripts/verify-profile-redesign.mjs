// Headless verify: land → Network tile → Profile → confirm the
// Profile tab list is now [Recipes, Favorite Pairings] (not the old
// Ingredients/Cuisines/Insights set).

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

await page.addInitScript(() => {
  try { localStorage.setItem('flavor-tour-complete', '1'); } catch {}
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('[data-mode="pairing"]');
await page.waitForSelector('button:has-text("Profile")', { timeout: 15000 });
await page.click('button:has-text("Profile")');

// Profile dialog mounted: assert exactly 2 tabs, named correctly.
await page.waitForSelector('[role="dialog"], [aria-modal="true"], h2:has-text("My Profile")', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(300);

// The tabs sit just below "My Profile" header. Inspect by text.
const tabTexts = await page.$$eval(
  'button',
  (btns) => btns
    .map((b) => b.textContent?.trim() || '')
    .filter((t) => /^(Ingredients|Cuisines|Recipes|Insights|Favorite Pairings)/.test(t))
);

await page.screenshot({ path: `${SHOT_DIR}/profile-recipes-tab.png` });

// Click Favorite Pairings tab
const fav = await page.$('button:has-text("Favorite Pairings")');
if (fav) {
  await fav.click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT_DIR}/profile-pairings-empty.png` });
}

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log(`Profile tabs found: [${tabTexts.join(' | ')}]`);
const ok =
  consoleErrors.length === 0 &&
  tabTexts.some((t) => t.startsWith('Recipes')) &&
  tabTexts.some((t) => t.startsWith('Favorite Pairings')) &&
  !tabTexts.some((t) => t.startsWith('Ingredients')) &&
  !tabTexts.some((t) => t.startsWith('Cuisines')) &&
  !tabTexts.some((t) => t.startsWith('Insights'));
console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
