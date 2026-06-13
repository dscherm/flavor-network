// Wave-6 Guided Discovery polish walkthrough capture.
//
// 4 frames against the live deploy:
//   1. Screen 1 — ingredient pick (post landing → Guided tile)
//   2. Screen 2 — radar showing α-mode neighbors (focal=tomato, taste)
//   3. Network tab — Tour Step 1 popup with "Got it" button
//   4. Tour Step 5 — refreshed cluster-name examples
//
// Run: node scripts/qa-guided-polish-walkthrough.mjs

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = 'https://neuralflavor.web.app';
const OUT_DIR = '.playwright-shots/guided-polish-wave6';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[gd-polish] ${m}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

log(`load ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('button[data-mode]', { timeout: 15000 });

// 1. Tap "Guided Discovery" tile
log('click Guided Discovery tile');
await page.locator('button[data-mode="guided"]').click();
await page.waitForTimeout(800);

// Screen 1: ingredient pick
await page.screenshot({ path: `${OUT_DIR}/01-screen1-ingredient.png` });
log('captured frame 1');

// Use "Suggest one for me" then "Got it"
log('suggest ingredient + advance');
const suggestBtn = page.getByText(/Suggest one for me/i).first();
if (await suggestBtn.isVisible().catch(() => false)) {
  await suggestBtn.click();
  await page.waitForTimeout(400);
}
const gotItIng = page.getByRole('button', { name: /Got it/i }).first();
if (await gotItIng.isVisible().catch(() => false)) {
  await gotItIng.click();
  await page.waitForTimeout(600);
}

// Card 2: filter-type pick → tap Taste, then Got it
log('pick filter type taste');
const tasteBtn = page.getByRole('radio', { name: /a taste/i }).first();
if (await tasteBtn.isVisible().catch(() => false)) {
  await tasteBtn.click();
  await page.waitForTimeout(300);
}
const gotItFt = page.getByRole('button', { name: /Got it/i }).first();
if (await gotItFt.isVisible().catch(() => false)) {
  await gotItFt.click();
  await page.waitForTimeout(1500);
}

// 2. Screen 2 — radar
await page.screenshot({ path: `${OUT_DIR}/02-screen2-radar-affinity-neighbors.png` });
log('captured frame 2 (radar with α-mode neighbors)');

// Two-tap commit on the sweet axis to enter the network tour
log('two-tap sweet axis');
const sweetAxis = page.locator('[aria-label*="Highlight pairings tagged sweet"]').first();
if (await sweetAxis.isVisible().catch(() => false)) {
  await sweetAxis.click();
  await page.waitForTimeout(300);
  await sweetAxis.click();
  await page.waitForTimeout(2000);
} else {
  log('sweet axis label not visible — skipping tour entry');
}

// 3. Network tab — Tour Step 1
await page.screenshot({ path: `${OUT_DIR}/03-tour-step1-affinity-engaged.png` });
log('captured frame 3 (network + tour step 1)');

// Click Got it 4 times to walk to Step 5
log('walk to step 5 via Got it × 4');
for (let i = 1; i <= 4; i += 1) {
  const got = page.getByRole('button', { name: /Got it/i }).first();
  if (await got.isVisible().catch(() => false)) {
    await got.click();
    await page.waitForTimeout(1200);
  } else {
    log(`Got it not visible at step ${i + 1}`);
    break;
  }
}

// 4. Tour Step 5 — refreshed cluster names
await page.screenshot({ path: `${OUT_DIR}/04-tour-step5-cluster-names.png` });
log('captured frame 4 (tour step 5)');

await ctx.close();
await browser.close();

const html = `<!doctype html>
<meta charset="utf-8">
<title>Guided Discovery Wave-6 polish A/B</title>
<style>
  body { font: 14px system-ui; margin: 24px; background: #0a0a0f; color: #eee; }
  h1 { font-weight: 500; }
  h2 { font-weight: 400; color: #aaa; margin-top: 24px; }
  .row { margin-bottom: 32px; }
  img { max-width: 100%; border: 1px solid #222; }
  .note { color: #888; font-size: 12px; }
</style>
<h1>Guided Discovery — Wave 6 polish</h1>
<p class="note">Live walkthrough of the 4 commits shipped 2026-05-30. focal=tomato (or random), filterType=taste.</p>
<div class="row">
  <h2>1. Screen 1 — ingredient pick</h2>
  <img src="01-screen1-ingredient.png">
</div>
<div class="row">
  <h2>2. Screen 2 — radar dots are now α-mode neighbors (GD-RADAR-AFFINITY-COHERENCE)</h2>
  <img src="02-screen2-radar-affinity-neighbors.png">
</div>
<div class="row">
  <h2>3. Network tab — α-rings active on entry + Tour Step 1 popup (GD-TOUR-AFFINITY-ENGAGE + GD-TOUR-MANUAL-ADVANCE)</h2>
  <img src="03-tour-step1-affinity-engaged.png">
</div>
<div class="row">
  <h2>4. Tour Step 5 — refreshed chef-cognitive cluster names (GD-TOUR-COPY-MATCH)</h2>
  <img src="04-tour-step5-cluster-names.png">
</div>
`;
writeFileSync(`${OUT_DIR}/index.html`, html);
log(`done → ${OUT_DIR}/index.html`);
