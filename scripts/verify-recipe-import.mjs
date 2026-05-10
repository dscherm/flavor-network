// Headless verify: land → Network → Profile → Recipes tab → expand
// the Import recipe panel → screenshot. Doesn't actually upload to
// Gemini (no key in CI); just verifies the UI mounts.

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

// Pre-dismiss the first-run Walkthrough so its overlay doesn't
// intercept the Profile button click.
await page.addInitScript(() => {
  try { localStorage.setItem('flavor-tour-complete', '1'); } catch {}
});

await page.goto(URL, { waitUntil: 'networkidle' });
// Pick the Network tile to land in the main app
await page.click('[data-mode="pairing"]');
// Wait for the desktop Profile button to appear
await page.waitForSelector('button:has-text("Profile")', { timeout: 15000 });
await page.click('button:has-text("Profile")');

// Switch to Recipes tab inside ProfilePanel
await page.waitForSelector('button:has-text("Recipes")', { timeout: 5000 });
await page.click('button:has-text("Recipes")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOT_DIR}/profile-recipes-collapsed.png` });

// Expand the import panel
await page.click('button:has-text("Import recipe")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOT_DIR}/profile-recipes-import-open.png` });

await browser.close();
console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach(e => console.log(`  - ${e}`));
process.exit(consoleErrors.length === 0 ? 0 : 1);
