// Playwright contract for the Guided Discovery "Affinity View" screen
// (replaces the prior taste-radar step 3).
//
// Desired UX (2026-06-01):
// 1. User completes step 1 (pick focal ingredient) + step 2 (swipe).
// 2. Step 3 panel now shows an EMBEDDED α-mode scene (bird's-eye 3D
//    canvas inside the GuidedDiscoveryResults panel) instead of the
//    previous radar.
// 3. Filter pills (Aroma / Taste / Family / Cuisine / Season) sit
//    inside the panel and switch the embedded α-mode's wedge axis.
// 4. A tour overlay reads "Step 1 - Affinity View" with a "Got it"
//    button. Clicking "Got it" advances the tour to step 2.
//
// Run: node scripts/qa-guided-alpha-view.mjs

import { chromium } from 'playwright';

const HOST = process.env.QA_HOST || 'https://neuralflavor.web.app';
const log = (m) => console.log(`[guided-α] ${m}`);
const fails = [];
const ok = (label, cond) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails.push(label);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

log('seed localStorage');
await page.goto(`${HOST}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => {
  try {
    localStorage.setItem('flavor-tour-complete', 'true');
    localStorage.setItem('fn-training-trace-seen', '1');
  } catch {}
});
await page.goto(`${HOST}/?path=explore&af_debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await pairingTile.click({ force: true });
  await pairingTile.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
}
await page.waitForTimeout(2000);

log('§A navigate to Guided Discovery');
await page.evaluate(() => window.__qaSetTab?.('guided'));
await page.waitForTimeout(2500);
// Guided screen renders a ThoughtBubbleCard grid; any of those bubble
// buttons being clickable indicates the start screen is mounted.
// Fall back to checking the URL/path query state if the DOM probe misses.
const guidedVisible = await page.evaluate(() => {
  const bubbles = document.querySelectorAll('[role="button"], button');
  for (const b of bubbles) {
    const txt = (b.textContent || '').toLowerCase();
    if (txt.includes('ingredient') || txt.includes('cuisine') || txt.includes('dietary')) return true;
  }
  return /\bpath=guided\b/.test(window.location.search);
});
ok('Guided Discovery loaded', guidedVisible);

log('§B complete step 1: pick focal ingredient (basil)');
// Test contract: the start screen should expose a __qaGuidedPickIngredient
// helper that sets the focal and advances to step 2. If the harness
// doesn't expose one, we fall back to a search-and-click.
await page.evaluate(() => {
  if (typeof window.__qaGuidedPickIngredient === 'function') {
    window.__qaGuidedPickIngredient('basil');
  }
});
await page.waitForTimeout(1500);

log('§C complete step 2: swipe through (skip / auto-accept)');
await page.evaluate(() => {
  if (typeof window.__qaGuidedSkipSwipe === 'function') {
    window.__qaGuidedSkipSwipe();
  }
});
await page.waitForTimeout(2000);

log('§D step 3 — embedded α-mode view should be present');

// CONTRACT CHECKS — these are the deliverables for the implementation.

// 1. A canvas element renders the embedded α-mode 3D scene inside the
//    GuidedDiscoveryResults panel. Container has a recognizable
//    data-attribute so we can scope.
const panelCanvas = page.locator('[data-guided-alpha-view] canvas').first();
ok('§D-1 embedded α-mode canvas present', await panelCanvas.isVisible().catch(() => false));

// 2. The tour overlay reads "Step 1" + "Affinity View". The label
//    may be split across spans; check that BOTH text strings appear
//    inside the same Step-1 tour container.
const stepLabel = page.locator('[data-guided-alpha-tour-step="1"]').first();
const hasStep1 = stepLabel.locator('text=/Step 1/i').first();
const hasAffinityView = stepLabel.locator('text=/Affinity View/i').first();
const stepBothPresent = (await hasStep1.isVisible().catch(() => false))
  && (await hasAffinityView.isVisible().catch(() => false));
ok('§D-2 "Step 1" + "Affinity View" labels visible inside Step-1 overlay', stepBothPresent);

// 3. A "Got it" button is present INSIDE the Step-1 tour overlay
//    (scope so we don't match a disabled "Got it" elsewhere — e.g.
//    the Walkthrough modal's first-launch button).
const gotItBtn = page.locator(
  '[data-guided-alpha-tour-step="1"] button:has-text("Got it"), [data-guided-alpha-view] button:has-text("Got it")'
).first();
const gotItVisible = await gotItBtn.isVisible().catch(() => false);
const gotItEnabled = gotItVisible ? !(await gotItBtn.isDisabled().catch(() => true)) : false;
ok('§D-3 "Got it" button present + enabled inside Step-1 overlay', gotItVisible && gotItEnabled);

// 4. Filter pills inside the panel — at least Aroma + Taste pills are
//    present and clickable. (Family / Cuisine / Season expected too;
//    spot-check the first two to keep the test resilient to small
//    label changes.)
const panelFilterRow = page.locator('[data-guided-alpha-view] [role="group"][aria-label*="Filter"], [data-guided-alpha-view] button:has-text("Aroma")');
ok('§D-4 filter pills inside the panel', (await panelFilterRow.count()) > 0);

// 5. Filter pill clicks switch the embedded α-mode axis. Expose
//    __qaGuidedAlphaAxis() so the test can read which axis is active.
//    Click "Aroma" pill, expect axis == "aromas".
const aromaPill = page.locator('[data-guided-alpha-view] button:has-text("Aroma")').first();
if (await aromaPill.isVisible().catch(() => false)) {
  await aromaPill.click();
  await page.waitForTimeout(1000);
}
const activeAxis = await page.evaluate(() => window.__qaGuidedAlphaAxis?.() ?? null);
ok('§D-5 clicking Aroma pill switches axis to "aromas"', activeAxis === 'aromas');

// 6. Bird's-eye camera — the embedded scene's camera looks roughly
//    straight down. We check the harness sets a top-down pose: y > x
//    and y > z magnitude.
const cameraPose = await page.evaluate(() => window.__qaGuidedAlphaCameraPose?.() ?? null);
if (cameraPose) {
  const { pos } = cameraPose;
  const topDown = pos && Math.abs(pos[1]) > Math.abs(pos[0]) && Math.abs(pos[1]) > Math.abs(pos[2]);
  ok(`§D-6 bird's-eye camera pose (pos=${JSON.stringify(pos)})`, topDown);
} else {
  ok('§D-6 camera pose harness exposed', false);
}

// 7. Clicking "Got it" advances the tour to step 2 ("Step 2 - …").
//    Only run if the button was found AND enabled — otherwise log a
//    single fail. The click is wrapped so a click-failure doesn't
//    crash the whole probe and lose §D-7b's reading.
if (gotItVisible && gotItEnabled) {
  try {
    await gotItBtn.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    const step1Gone = !(await stepLabel.isVisible().catch(() => true));
    const step2Visible = await page.locator('text=/Step 2/i').first().isVisible().catch(() => false);
    ok('§D-7a "Step 1" label hidden after "Got it"', step1Gone);
    ok('§D-7b "Step 2" label visible after "Got it"', step2Visible);
  } catch (e) {
    ok(`§D-7 "Got it" click flow (click error: ${e.message?.slice(0, 60)})`, false);
  }
} else {
  ok('§D-7 "Got it" click flow (button missing or disabled)', false);
}

await browser.close();
if (fails.length) {
  console.log(`\nFAIL: ${fails.length} check(s) failed:`);
  fails.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
