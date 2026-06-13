// Wave-7 Guided Discovery polish walkthrough.
//
// Captures 5 frames against the live deploy, bypassing landing via the
// ?path=guided deep-link so the script doesn't depend on tile-click
// transitions:
//   1. Screen 1 — ingredient pick
//   2. Screen 2 — radar (α-mode neighbors + diverse axes + decollided dots)
//   3. Screen 2 — sweet axis armed (wedge fill, dots highlighted)
//   4. Network tab — Tour Step 1 with axis-intent extraContext line
//   5. Tour Step 4 — ClusterJoystick + named cluster in extraContext
//
// Run: node scripts/qa-wave7-guided-polish.mjs

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = 'https://neuralflavor.web.app/?path=guided';
const OUT_DIR = '.playwright-shots/wave7-guided-polish';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[w7] ${m}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

log(`load ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Click the Guided Discovery tile. proData starts fetching AFTER this
// (useProData is gated by startPageComplete) so the post-click wait
// must cover the data fetch — several MB of brotli.
log('click Guided Discovery tile');
await page.locator('button[data-mode="guided"]').click();
log('waiting for Guided Screen 1 to render (data fetch + commit)');
await page.waitForSelector('button:has-text("Suggest one for me")', { timeout: 30000 });
await page.waitForTimeout(500);

// Frame 1 — Screen 1 ingredient pick
await page.screenshot({ path: `${OUT_DIR}/01-screen1-ingredient.png` });
log('captured 01-screen1-ingredient');

// Pick an ingredient via "Suggest one for me" then Got it
log('suggest ingredient');
const swipeScope = page.getByTestId('guided-discovery-swipe');
await swipeScope.getByRole('button', { name: /Suggest one for me/i }).click();
log('wait for Got it to enable + click');
const advance1 = swipeScope.locator('button[aria-disabled="false"]').filter({ hasText: /Got it/i });
await advance1.waitFor({ state: 'visible', timeout: 5000 });
await advance1.click();
log('wait for filter-type card');
await swipeScope.locator('button[role="radio"]').first().waitFor({ state: 'visible', timeout: 5000 });

log('pick filter type: a taste');
await swipeScope.locator('button[role="radio"]').filter({ hasText: /a taste/i }).first().click();

log('wait for Got it to enable + click to commit filter type');
const advance2 = swipeScope.locator('button[aria-disabled="false"]').filter({ hasText: /Got it/i });
await advance2.waitFor({ state: 'visible', timeout: 5000 });
await advance2.click();
log('wait for Screen 2 radar');
await page.waitForSelector('[data-testid="guided-profile-radar"]', { timeout: 15000 });
await page.waitForTimeout(1000);

// Frame 2 — Screen 2 radar
await page.screenshot({ path: `${OUT_DIR}/02-screen2-radar.png` });
log('captured 02-screen2-radar');

// Tap "sweet" axis once to arm wedge fill
log('first tap sweet axis (arm wedge)');
const sweetAxis = page.locator('button[data-testid="guided-radar-axis-sweet"]').first();
let armedSweet = false;
if (await sweetAxis.isVisible().catch(() => false)) {
  await sweetAxis.click();
  await page.waitForTimeout(800);
  armedSweet = true;
}

// Frame 3 — Screen 2 with sweet armed
await page.screenshot({ path: `${OUT_DIR}/03-screen2-sweet-armed.png` });
log('captured 03-screen2-sweet-armed');

if (armedSweet) {
  log('second tap sweet axis (commit + jump to network)');
  // Use evaluate-click to bypass Playwright's post-click navigation
  // wait — the commit triggers a heavy re-render + tab swap that
  // holds the standard .click() promise open past timeout.
  await sweetAxis.evaluate((el) => el.click());
  log('waiting for Tour Step 1 popup on network tab');
  try {
    await page.waitForSelector('[role="dialog"][data-tour-stage="affinity"]', { timeout: 15000 });
    await page.waitForTimeout(800);
  } catch {
    log('Tour Step 1 popup never appeared — capture will show whatever rendered');
  }
}

// Frame 4 — Network tab with Step 1 popup
await page.screenshot({ path: `${OUT_DIR}/04-network-step1-popup.png` });
log('captured 04-network-step1-popup');

// Walk Got it 3 times to reach Step 4 (clusters). Each stage transition
// re-renders the popup; use evaluate-click to dispatch the event
// without Playwright's post-click navigation wait.
const STAGE_IDS = ['pull1', 'pull2', 'clusters'];
for (let i = 0; i < STAGE_IDS.length; i += 1) {
  const got = page.locator('[role="dialog"] button').filter({ hasText: /^Got it/ });
  if (!(await got.isVisible().catch(() => false))) {
    log(`Got it not visible at advance ${i + 1}`);
    break;
  }
  log(`tap Got it → advance to stage ${STAGE_IDS[i]}`);
  await got.evaluate((el) => el.click());
  try {
    await page.waitForSelector(`[role="dialog"][data-tour-stage="${STAGE_IDS[i]}"]`, { timeout: 10000 });
    // Step 4 needs extra time for the cluster pick + camera fly.
    await page.waitForTimeout(STAGE_IDS[i] === 'clusters' ? 2500 : 800);
  } catch {
    log(`stage ${STAGE_IDS[i]} popup didn't appear`);
    break;
  }
}

// Frame 5 — Step 4 popup
await page.screenshot({ path: `${OUT_DIR}/05-tour-step4-clusters.png` });
log('captured 05-tour-step4-clusters');

await ctx.close();
await browser.close();

const html = `<!doctype html>
<meta charset="utf-8">
<title>Wave 7 Guided Discovery polish — A/B contact sheet</title>
<style>
  body { font: 14px system-ui; margin: 24px; background: #0a0a0f; color: #eee; }
  h1 { font-weight: 500; }
  h2 { font-weight: 400; color: #aaa; margin-top: 24px; }
  .row { margin-bottom: 32px; }
  img { max-width: 100%; border: 1px solid #222; }
  .note { color: #888; font-size: 12px; }
</style>
<h1>Guided Discovery — Wave 7 polish (live)</h1>
<p class="note">6 commits shipped 2026-05-30. focal = auto-suggested, filterType = taste, axis pick = sweet.</p>
<div class="row">
  <h2>1. Screen 1 — ingredient pick</h2>
  <img src="01-screen1-ingredient.png">
</div>
<div class="row">
  <h2>2. Screen 2 — radar with α-mode neighbors + axis-coverage padding + decollided dots</h2>
  <img src="02-screen2-radar.png">
</div>
<div class="row">
  <h2>3. Screen 2 — sweet axis armed (wedge fill + matching dots opaque)</h2>
  <img src="03-screen2-sweet-armed.png">
</div>
<div class="row">
  <h2>4. Network tab — Tour Step 1 popup with axis-intent extraContext line</h2>
  <img src="04-network-step1-popup.png">
</div>
<div class="row">
  <h2>5. Tour Step 4 — ClusterJoystick + named cluster in extraContext</h2>
  <img src="05-tour-step4-clusters.png">
</div>
`;
writeFileSync(`${OUT_DIR}/index.html`, html);
log(`wrote ${OUT_DIR}/index.html`);
