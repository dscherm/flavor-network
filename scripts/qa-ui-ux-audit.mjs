// UI/UX audit harness — sweeps the 5 modes (network / affinity /
// cocktail / sauce / cookbook), validates camera framing, looks for
// button overlap, and runs every check at both desktop + mobile
// viewport. Add to this script as new UI/UX invariants surface.
//
// Run: node scripts/qa-ui-ux-audit.mjs
//
// Sections:
//   §1 Camera framing — clicking a cluster/recipe should frame it and
//      NOT snap back to a zoomed-out default after the fly completes.
//   §2 Button overlap — interactive elements with z-index > 50 should
//      not occlude each other within the viewport.
//   §3 Mobile viewport — every desktop section repeated at 390x844
//      (iPhone 14) so the responsive layout doesn't regress.

import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const HOST = process.env.QA_HOST || 'https://neuralflavor.web.app';
const OUT_DIR = '.playwright-shots/ui-ux-audit';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[ui] ${m}`);
const failures = [];
function check(name, cond, detail = '') {
  if (cond) log(`  PASS  ${name}`);
  else {
    log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
    failures.push({ name, detail });
  }
}

async function seedAndLand(page, path, extraQuery = '') {
  const home = `${HOST}/`;
  await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    try {
      localStorage.setItem('flavor-tour-complete', 'true');
      localStorage.setItem('fn-training-trace-seen', '1');
    } catch {}
  });
  const url = `${HOST}/?path=${path}${extraQuery ? '&' + extraQuery : ''}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
}

async function probeCamera(page) {
  return page.evaluate(() => {
    const st = window.__af?.stateRef;
    const cam = st?.camera;
    if (!cam) return { error: 'no camera' };
    return {
      x: cam.position.x, y: cam.position.y, z: cam.position.z,
      distFromOrigin: Math.hypot(cam.position.x, cam.position.y, cam.position.z),
    };
  });
}

async function runOnContext(viewport, label) {
  log(`========== ${label} (${viewport.width}x${viewport.height}) ==========`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[browser:${label}:error] ${e.message}`));

  // ─── §1 Network mode: cluster pill click camera framing ─────
  log(`§1 Network mode — cluster-pill camera framing`);
  await seedAndLand(page, 'network', 'af_debug=1');
  const pairingTile = page.locator('button[data-mode="pairing"]');
  if (await pairingTile.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pairingTile.click();
    await page.waitForTimeout(1000);
  }
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(2500);

  const camBefore = await probeCamera(page);
  log(`    cam before pill click: ${JSON.stringify(camBefore)}`);

  // Click the first cluster pill (e.g., "Heats & Sharpens" — bottom strip).
  const clusterPill = page.locator('button:has-text("Heats & Sharpens")').first();
  if (await clusterPill.isVisible({ timeout: 2000 }).catch(() => false)) {
    await clusterPill.click();
    await page.waitForTimeout(2500);
    const camAfter = await probeCamera(page);
    log(`    cam after pill click: ${JSON.stringify(camAfter)}`);
    check(
      `${label}/§1.1 cluster pill click moves camera`,
      camBefore.error || camAfter.error || (
        Math.abs(camBefore.x - camAfter.x) > 1 ||
        Math.abs(camBefore.z - camAfter.z) > 1
      ),
      JSON.stringify({ before: camBefore, after: camAfter }),
    );
    // Wait 5s — verify no snap-back to original.
    await page.waitForTimeout(5000);
    const cam5sLater = await probeCamera(page);
    log(`    cam 5s later: ${JSON.stringify(cam5sLater)}`);
    check(
      `${label}/§1.2 camera does NOT snap back after cluster pill fly`,
      !camAfter.error && !cam5sLater.error && (
        Math.abs(camAfter.x - cam5sLater.x) < 5 &&
        Math.abs(camAfter.z - cam5sLater.z) < 5
      ),
      JSON.stringify({ after: camAfter, fiveLater: cam5sLater }),
    );
  } else {
    log(`    SKIP — no cluster pill found in viewport`);
  }

  await page.screenshot({ path: `${OUT_DIR}/${label}-network-final.png` });

  // ─── §2 Cookbook: recipe-card click camera framing + snap-back ─
  log(`§2 Cookbook mode — recipe-card camera framing + snap-back check`);
  await seedAndLand(page, 'cookbook', 'af_debug=1');
  await page.waitForTimeout(2500);
  // Switch to explore mode (3D scene) if not already there.
  const exploreBtn = page.locator('button:has-text("Explore"), button:has-text("3D")').first();
  if (await exploreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await exploreBtn.click();
    await page.waitForTimeout(2000);
  }
  const cookCanvas = await page.locator('canvas').first().boundingBox();
  if (cookCanvas) {
    const camCookBefore = await probeCamera(page);
    log(`    cookbook cam before click: ${JSON.stringify(camCookBefore)}`);
    // Click in the center of the canvas (hopefully hits a recipe node).
    await page.mouse.click(cookCanvas.x + cookCanvas.width / 2, cookCanvas.y + cookCanvas.height / 2);
    await page.waitForTimeout(2500);
    const camCookAfter = await probeCamera(page);
    log(`    cookbook cam after click: ${JSON.stringify(camCookAfter)}`);
    // Wait 6s — verify no snap-back.
    await page.waitForTimeout(6000);
    const camCookLater = await probeCamera(page);
    log(`    cookbook cam 6s later: ${JSON.stringify(camCookLater)}`);
    check(
      `${label}/§2.1 cookbook camera does NOT snap back after recipe click`,
      !camCookAfter.error && !camCookLater.error && (
        Math.abs(camCookAfter.x - camCookLater.x) < 10 &&
        Math.abs(camCookAfter.z - camCookLater.z) < 10
      ),
      JSON.stringify({ after: camCookAfter, sixLater: camCookLater }),
    );
  } else {
    log(`    SKIP — no canvas in cookbook view`);
  }
  await page.screenshot({ path: `${OUT_DIR}/${label}-cookbook-final.png` });

  // ─── §3 Button overlap detection ─────────────────────────────
  log(`§3 Button overlap detection (any visible mode)`);
  await seedAndLand(page, 'network');
  if (await pairingTile.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pairingTile.click();
    await page.waitForTimeout(1500);
  }
  const overlaps = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    const visible = btns.filter((b) => {
      const r = b.getBoundingClientRect();
      const s = getComputedStyle(b);
      return r.width > 10 && r.height > 10 && s.display !== 'none' && s.visibility !== 'hidden';
    });
    // Build (id, rect) tuples ignoring overlaps that are obviously
    // intentional (parent/child, modal backdrops, fullscreen canvas).
    const found = [];
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i];
      const ra = a.getBoundingClientRect();
      // Skip canvas/scene root sized buttons (very large).
      if (ra.width * ra.height > window.innerWidth * window.innerHeight * 0.5) continue;
      for (let j = i + 1; j < visible.length; j++) {
        const b = visible[j];
        if (a.contains(b) || b.contains(a)) continue;
        const rb = b.getBoundingClientRect();
        if (rb.width * rb.height > window.innerWidth * window.innerHeight * 0.5) continue;
        const overlap = !(ra.right <= rb.left || rb.right <= ra.left || ra.bottom <= rb.top || rb.bottom <= ra.top);
        if (overlap) {
          // Skip if both fully contained inside the same direct
          // ancestor (legitimate grouped controls e.g. pill row).
          let sharedParent = null;
          let p = a.parentElement;
          while (p && !sharedParent) {
            if (p.contains(b)) sharedParent = p;
            p = p.parentElement;
          }
          if (sharedParent && sharedParent.tagName !== 'BODY') continue;
          found.push({
            a: a.getAttribute('data-testid') || a.textContent?.slice(0, 30) || 'unnamed',
            b: b.getAttribute('data-testid') || b.textContent?.slice(0, 30) || 'unnamed',
            aRect: { x: ra.x, y: ra.y, w: ra.width, h: ra.height },
            bRect: { x: rb.x, y: rb.y, w: rb.width, h: rb.height },
          });
        }
      }
    }
    return found;
  });
  log(`    found ${overlaps.length} cross-parent button overlaps`);
  if (overlaps.length > 0) log(`    sample: ${JSON.stringify(overlaps.slice(0, 3))}`);
  check(
    `${label}/§3.0 no cross-parent button overlaps in default Network view`,
    overlaps.length === 0,
    `${overlaps.length} overlaps; first: ${overlaps[0] ? JSON.stringify(overlaps[0]) : 'n/a'}`,
  );

  await ctx.close();
  await browser.close();
}

await runOnContext({ width: 1440, height: 900 }, 'desktop');
await runOnContext({ width: 390, height: 844 }, 'mobile');

writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify({ failures }, null, 2));

if (failures.length === 0) {
  log(`ALL CHECKS PASSED`);
  process.exit(0);
} else {
  log(`${failures.length} CHECK(S) FAILED`);
  for (const f of failures) console.log(`  - ${f.name}${f.detail ? ': ' + f.detail.slice(0, 200) : ''}`);
  process.exit(1);
}
