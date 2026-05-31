// Sauce lab camera-framing probe — navigates to Sauce Lab, picks a
// sauce family from the ClusterJoystick, verifies the camera flies
// to frame that family's cluster and stays put.
//
// Run: node scripts/qa-sauce-camera.mjs

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.QA_URL || 'https://neuralflavor.web.app/?path=sauce&af_debug=1';
const OUT_DIR = '.playwright-shots/sauce-camera';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[sc] ${m}`);

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
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await pairingTile.click({ force: true });
  await pairingTile.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
await page.evaluate(() => window.__qaSetTab?.('sauce'));
await page.waitForTimeout(3000);

log('verify sauce scene mounted');
const sceneLabel = await page.evaluate(() => window.__qaSceneLabel || 'no-label');
log(`scene label: ${sceneLabel}`);

await page.screenshot({ path: `${OUT_DIR}/01-initial.png` });

const camBefore = await page.evaluate(() => {
  const st = window.__qaActiveScene;
  const cam = st?.camera;
  if (!cam) return null;
  return { x: cam.position.x, y: cam.position.y, z: cam.position.z, dist: Math.hypot(cam.position.x, cam.position.y, cam.position.z) };
});
log(`cam before sauce-type click: ${JSON.stringify(camBefore)}`);

// Click "Hollandaise" — a well-known sauce family name. The pills
// live in the ClusterJoystick at the bottom; pill text matches its
// sauce-family label exactly.
log('clicking Hollandaise pill');
const pill = page.locator('button:has-text("Hollandaise")').first();
if (!(await pill.isVisible({ timeout: 3000 }).catch(() => false))) {
  log('FAIL — Hollandaise pill not visible');
  await page.screenshot({ path: `${OUT_DIR}/no-pill.png` });
  process.exit(1);
}
const pillBox = await pill.boundingBox();
log(`pill at (${pillBox?.x?.toFixed(0)}, ${pillBox?.y?.toFixed(0)})`);
await pill.click({ force: true });
const clicked = 'Hollandaise';

await page.waitForTimeout(3000);
const camAfter = await page.evaluate(() => {
  const st = window.__qaActiveScene;
  const cam = st?.camera;
  if (!cam) return null;
  return { x: cam.position.x, y: cam.position.y, z: cam.position.z, dist: Math.hypot(cam.position.x, cam.position.y, cam.position.z) };
});
log(`cam after clicking "${clicked}": ${JSON.stringify(camAfter)}`);

const movedDist = camBefore && camAfter
  ? Math.hypot(camBefore.x - camAfter.x, camBefore.y - camAfter.y, camBefore.z - camAfter.z)
  : 0;
log(`camera moved ${movedDist.toFixed(1)} units`);

await page.screenshot({ path: `${OUT_DIR}/02-after-pill.png` });

// Verify camera holds position (no orbit drift) after the fly settles.
await page.waitForTimeout(4000);
const camLater = await page.evaluate(() => {
  const st = window.__qaActiveScene;
  const cam = st?.camera;
  if (!cam) return null;
  return { x: cam.position.x, y: cam.position.y, z: cam.position.z, dist: Math.hypot(cam.position.x, cam.position.y, cam.position.z) };
});
log(`cam 4s later: ${JSON.stringify(camLater)}`);

const drift = camAfter && camLater
  ? Math.hypot(camAfter.x - camLater.x, camAfter.y - camLater.y, camAfter.z - camLater.z)
  : 0;
log(`drift after settle: ${drift.toFixed(1)} units`);

await page.screenshot({ path: `${OUT_DIR}/03-after-settle.png` });

await ctx.close();
await browser.close();

writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify({
  clickedPill: clicked,
  camBefore, camAfter, camLater,
  movedDist, drift,
}, null, 2));

if (movedDist < 5) {
  log('FAIL — camera did not move after sauce-type click');
  process.exit(1);
}
if (drift > 10) {
  log('FAIL — camera drifted after settling (cluster tour still running?)');
  process.exit(2);
}
log('PASS — sauce-type click flies camera + holds position');
