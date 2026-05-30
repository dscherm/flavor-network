// Wave-8 Make web-link walkthrough capture.
//
// Captures 4 frames against the live deploy. Auth-gated parts (the
// preview success state) require the user to be signed in — without
// auth, the script captures the "Sign in to import recipes from a URL"
// error state, which still confirms the function is reachable.
//
//   1. Make picker — 4-card layout including new "From a web link" card
//   2. Web-link URL input (after clicking the card)
//   3. Parse attempt — Parsing… or Error or Preview depending on auth
//   4. Final state — Preview list (if authed) or Error state (if not)
//
// Run: node scripts/qa-wave8-make-weblink.mjs

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = 'https://neuralflavor.web.app/?path=make';
const RECIPE_URL = 'https://www.seriouseats.com/the-best-pasta-pomodoro-recipe';
const OUT_DIR = '.playwright-shots/wave8-make-weblink';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[w8] ${m}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

log(`load ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Dismiss start-page gate if visible (the ?path=make deep-link still
// renders the landing-tile gate on first load).
const makeTile = page.locator('button[data-mode="make"]');
if (await makeTile.isVisible().catch(() => false)) {
  log('start-page gate visible — clicking Make tile');
  await makeTile.click();
}

log('waiting for Make picker to render');
await page.waitForSelector('[data-testid="make-recipe-start"]', { timeout: 30000 });
await page.waitForTimeout(500);

// Frame 1 — 4-card picker
await page.screenshot({ path: `${OUT_DIR}/01-picker-4-cards.png` });
log('captured 01-picker-4-cards');

// Click the new weblink card
log('click weblink card');
await page.getByTestId('make-card-weblink').click();
await page.waitForSelector('[data-testid="make-weblink-input"]', { timeout: 5000 });
await page.waitForTimeout(400);

// Frame 2 — URL input visible
await page.screenshot({ path: `${OUT_DIR}/02-url-input.png` });
log('captured 02-url-input');

// Paste a real recipe URL + click Parse
log(`paste ${RECIPE_URL}`);
await page.getByTestId('make-weblink-url-input').fill(RECIPE_URL);
await page.waitForTimeout(200);

log('click Parse');
await page.getByTestId('make-weblink-parse-btn').click();

// Wait for either preview OR error OR parsing to settle.
log('wait for terminal state (preview | error)');
const settled = await Promise.race([
  page.waitForSelector('[data-testid="make-weblink-preview"]', { timeout: 30000 }).then(() => 'preview'),
  page.waitForSelector('[data-testid="make-weblink-error"]', { timeout: 30000 }).then(() => 'error'),
]).catch(() => 'unknown');
await page.waitForTimeout(800);

log(`terminal state: ${settled}`);
await page.screenshot({ path: `${OUT_DIR}/03-parse-result.png` });
log('captured 03-parse-result');

// Frame 4 — same state but at slightly different time. If we're in
// preview, scroll the ingredient list a bit to show more of it.
if (settled === 'preview') {
  const list = page.locator('[data-testid="make-weblink-preview"] ul');
  if (await list.isVisible().catch(() => false)) {
    await list.evaluate((el) => el.scrollTop = 100);
    await page.waitForTimeout(300);
  }
}
await page.screenshot({ path: `${OUT_DIR}/04-detail.png` });
log('captured 04-detail');

await ctx.close();
await browser.close();

const html = `<!doctype html>
<meta charset="utf-8">
<title>Wave 8 Make weblink — A/B contact sheet</title>
<style>
  body { font: 14px system-ui; margin: 24px; background: #0a0a0f; color: #eee; }
  h1 { font-weight: 500; }
  h2 { font-weight: 400; color: #aaa; margin-top: 24px; }
  .row { margin-bottom: 32px; }
  img { max-width: 100%; border: 1px solid #222; }
  .note { color: #888; font-size: 12px; }
</style>
<h1>Make Mode "From a web link" — Wave 8 polish (live)</h1>
<p class="note">5 commits + Cloud Function deploy 2026-05-30. Test URL: ${RECIPE_URL}.</p>
<p class="note">Note: parse success requires sign-in (the scrapeRecipe function rejects unauthenticated calls). When unauthed, frame 3/4 show the friendly error state — which itself proves the function call is reaching the Cloud Function and getting a clean rejection.</p>
<div class="row">
  <h2>1. Make picker — 4 cards (existing / scratch / photo / weblink)</h2>
  <img src="01-picker-4-cards.png">
</div>
<div class="row">
  <h2>2. Web-link URL input (after clicking the weblink card)</h2>
  <img src="02-url-input.png">
</div>
<div class="row">
  <h2>3. Parse result — preview (if authed) or error (if not)</h2>
  <img src="03-parse-result.png">
</div>
<div class="row">
  <h2>4. Detail (scrolled list if preview; static otherwise)</h2>
  <img src="04-detail.png">
</div>
`;
writeFileSync(`${OUT_DIR}/index.html`, html);
log(`wrote ${OUT_DIR}/index.html`);
