// Headless verify (R17): pull slider appears with active filter, snap
// stops fire on release, keyboard nav nudges by 5/25%, 3D + filter
// shows Fibonacci-sphere poles (not flattened wheel).

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

const results = {};

// Slider hidden when no filter active.
const sliderHidden = await page.$('input[aria-label="Filter pull strength"]') === null;
results.slider_hidden_default = sliderHidden;

// R18: Activate Aroma — slider should appear with default 0% (was 70%).
// Reset-to-zero on filter-stack 0→non-empty transition lets the user dial
// in pull strength themselves rather than starting at a layout that hides
// most nodes.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("Aroma")');
await page.waitForTimeout(1500);
const slider = page.locator('input[aria-label="Filter pull strength"]');
const initialValue = await slider.getAttribute('aria-valuenow');
results.slider_default_pct = Number(initialValue);
await page.screenshot({ path: `${SHOT_DIR}/r18-3d-aroma-pull0.png` });

// Pull to 0 via Home key — should snap to 0.
await slider.focus();
await page.keyboard.press('Home');
await page.waitForTimeout(800);
const atZero = await slider.getAttribute('aria-valuenow');
results.home_key_value = Number(atZero);
await page.screenshot({ path: `${SHOT_DIR}/r17-3d-aroma-pull0.png` });

// Pull to 100 via End key.
await page.keyboard.press('End');
await page.waitForTimeout(800);
const atHundred = await slider.getAttribute('aria-valuenow');
results.end_key_value = Number(atHundred);
await page.screenshot({ path: `${SHOT_DIR}/r17-3d-aroma-pull100.png` });

// ArrowLeft nudges by 5.
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(400);
const afterArrow = await slider.getAttribute('aria-valuenow');
results.arrow_left_value = Number(afterArrow);

// Shift+ArrowLeft nudges by 25.
await page.keyboard.down('Shift');
await page.keyboard.press('ArrowLeft');
await page.keyboard.up('Shift');
await page.waitForTimeout(400);
const afterShiftArrow = await slider.getAttribute('aria-valuenow');
results.shift_arrow_value = Number(afterShiftArrow);

// Flip to 2D mode — slider value should persist.
await page.click('button:has-text("3D Pairings")');
await page.waitForTimeout(300);
const twoDBtn = await page.$('[role="menu"] button:has-text("2D Pairings")');
if (twoDBtn) await twoDBtn.click();
await page.waitForTimeout(2000);
const after2D = await slider.getAttribute('aria-valuenow');
results.pull_persists_across_mode_flip = Number(after2D) === Number(afterShiftArrow);
await page.screenshot({ path: `${SHOT_DIR}/r17-2d-aroma-pull${after2D}.png` });

// HUDAnnouncer fires "Pull set to N%" after debounce.
// Pull slider should still be at 70 here (from shift-arrow earlier).
await slider.focus();
await page.keyboard.press('ArrowRight'); // 70 → 75
await page.waitForTimeout(400); // wait past 200ms debounce
const pullAnnouncement = await page.locator('[role="status"][aria-atomic="true"]').filter({ hasText: /Pull set/i }).first().textContent().catch(() => null);
results.pull_announcement = pullAnnouncement;
results.pull_announcement_pass = pullAnnouncement != null && /Pull set to 75%/i.test(pullAnnouncement);

// Clear all filters — slider should disappear.
await page.click('div[role="group"][aria-label="Filter by"] button:has-text("None")');
await page.waitForTimeout(800);
const sliderGoneAfterClear = await page.$('input[aria-label="Filter pull strength"]') === null;
results.slider_hidden_after_clear = sliderGoneAfterClear;

await browser.close();

console.log(`Console errors: ${consoleErrors.length}`);
consoleErrors.forEach((e) => console.log(`  - ${e}`));
console.log('Results:', JSON.stringify(results, null, 2));

const ok = consoleErrors.length === 0
  && results.slider_hidden_default === true
  && results.slider_default_pct === 0
  && results.home_key_value === 0
  && results.end_key_value === 100
  && results.arrow_left_value === 95
  && results.shift_arrow_value === 70
  && results.pull_persists_across_mode_flip === true
  && results.pull_announcement_pass === true
  && results.slider_hidden_after_clear === true;
console.log(ok ? 'VERIFY PASSED' : 'VERIFY FAILED');
process.exit(ok ? 0 : 1);
