// Cookbook camera-trace probe — opens cookbook from the landing tile
// (the "menu" path) and samples the camera position every 250ms for
// 10 seconds to catch the user-reported "zooms in then snaps back to
// very zoomed out" bug.
//
// Run: node scripts/qa-cookbook-camera-trace.mjs

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.QA_URL || 'https://neuralflavor.web.app/?path=cookbook&af_debug=1';
const OUT_DIR = '.playwright-shots/cookbook-camera';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[ck] ${m}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

log('seed localStorage');
await page.goto(URL.replace(/[?#].*$/, ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => {
  try {
    localStorage.setItem('flavor-tour-complete', 'true');
    localStorage.setItem('fn-training-trace-seen', '1');
  } catch {}
});

log(`load ${URL}`);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Dismiss landing gate by clicking pairing tile, waiting for the
// gate to actually disappear (loading state, then app renders).
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  log('landing gate visible — clicking pairing tile to dismiss');
  await pairingTile.click({ force: true });
  // Wait for tile to disappear (gate dismissed AND data loaded).
  try {
    await pairingTile.waitFor({ state: 'detached', timeout: 30000 });
  } catch {
    log('  WARN: pairing tile did not detach in 30s');
  }
  await page.waitForTimeout(2000);
}
log('navigating to cookbook via __qaSetTab');
const beforeTab = await page.evaluate(() => ({
  hasSetTab: typeof window.__qaSetTab,
  url: window.location.href,
}));
log(`  before: ${JSON.stringify(beforeTab)}`);
await page.evaluate(() => window.__qaSetTab?.('cookbook'));
await page.waitForTimeout(2500);
const afterTab = await page.evaluate(() => ({
  url: window.location.href,
  bodyText: document.body.innerText.slice(0, 200),
}));
log(`  after: ${JSON.stringify(afterTab)}`);

log('wait for canvas (cookbook 3D scene mounts)');
await page.waitForTimeout(2000);
const hasCanvas = await page.locator('canvas').count();
log(`canvas count: ${hasCanvas}`);
if (hasCanvas === 0) {
  log('FAIL — no canvas after navigation; dumping page text');
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 500));
  log(`page text: ${txt}`);
  await page.screenshot({ path: `${OUT_DIR}/debug-no-canvas.png` });
  process.exit(1);
}

// Switch to 3D Explore mode if the default is Browse.
const exploreBtn = page.locator('button:has-text("Explore"), button:has-text("3D Explore")').first();
if (await exploreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  log('switching to 3D Explore mode');
  await exploreBtn.click();
  await page.waitForTimeout(500);
}

// Sample camera position every 250ms for 10s.
const samples = [];
const startT = Date.now();
// Identify which scene we're sampling.
const sceneLabel = await page.evaluate(() => window.__qaSceneLabel || 'no-label');
log(`scene label: ${sceneLabel}`);
log('begin camera trace (10s)');
for (let i = 0; i < 40; i++) {
  const sample = await page.evaluate(() => {
    const st = window.__qaActiveScene || window.__af?.stateRef;
    const cam = st?.camera;
    if (!cam) return null;
    return {
      x: cam.position.x, y: cam.position.y, z: cam.position.z,
      dist: Math.hypot(cam.position.x, cam.position.y, cam.position.z),
      nodeCount: st?.nodeArray?.length,
      hasAnimator: !!st?.cameraAnimator || !!window.__af?._cameraAnimator,
    };
  });
  const t = Date.now() - startT;
  samples.push({ t, ...sample });
  if (i % 4 === 0) {
    log(`  t=${t}ms  dist=${sample?.dist?.toFixed(1) ?? 'n/a'}  pos=(${sample?.x?.toFixed(1)}, ${sample?.y?.toFixed(1)}, ${sample?.z?.toFixed(1)})`);
  }
  await page.waitForTimeout(250);
}

// Detect a snap-back: a fly-in (distance decreasing) followed by a
// snap-out (distance increasing back to default).
const dists = samples.filter((s) => s.dist != null).map((s) => s.dist);
const minDist = Math.min(...dists);
const minIdx = dists.indexOf(minDist);
const initial = dists[0];
const final = dists[dists.length - 1];

log(`initial dist: ${initial?.toFixed(1)}`);
log(`min dist (frame ${minIdx}): ${minDist.toFixed(1)}`);
log(`final dist: ${final?.toFixed(1)}`);
log(`zoom-in delta: ${(initial - minDist).toFixed(1)} units`);
log(`snap-back delta: ${(final - minDist).toFixed(1)} units`);

// Capture a screenshot at the end so the visual state is recorded.
await page.screenshot({ path: `${OUT_DIR}/final.png` });

writeFileSync(`${OUT_DIR}/trace.json`, JSON.stringify(samples, null, 2));

const SNAP_THRESHOLD = 15;
const ZOOM_IN_THRESHOLD = 10;
const zoomedIn = (initial - minDist) > ZOOM_IN_THRESHOLD;
const snappedBack = zoomedIn && (final - minDist) > SNAP_THRESHOLD;

if (snappedBack) {
  log(`BUG REPRODUCED — zoomed in by ${(initial - minDist).toFixed(0)}u, then snapped back ${(final - minDist).toFixed(0)}u`);
  process.exit(2);
} else if (zoomedIn) {
  log(`zoom-in observed, no snap-back`);
} else {
  log(`no significant zoom motion observed`);
}

await ctx.close();
await browser.close();
