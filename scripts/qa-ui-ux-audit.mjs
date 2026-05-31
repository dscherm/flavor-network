// UI/UX audit harness — sweeps the 5 modes (network / affinity /
// cocktail / sauce / cookbook), validates camera framing + cluster
// pill behavior at desktop + mobile viewports.
//
// Run: node scripts/qa-ui-ux-audit.mjs
//
// Sections (each runs at desktop AND mobile):
//   §1 Network — cluster pill click moves camera, no snap-back.
//   §2 Cookbook — initial mount, no cluster-tour drift.
//   §3 Sauce — clicking a sauce family pill frames its cluster.
//   §4 Cocktail — clicking a cocktail family pill frames its cluster.
//   §5 Button overlap — flags cross-parent interactive collisions
//      in the default Network view.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const HOST = process.env.QA_HOST || 'https://neuralflavor.web.app';
const OUT_DIR = '.playwright-shots/ui-ux-audit';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[ui] ${m}`);
const failures = [];
function check(name, cond, detail = '') {
  if (cond) log(`  PASS  ${name}`);
  else {
    log(`  FAIL  ${name}${detail ? ' — ' + detail.slice(0, 250) : ''}`);
    failures.push({ name, detail });
  }
}

async function seedAndEnter(page) {
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
    await page.waitForTimeout(2000);
  }
}

async function setTab(page, tab) {
  await page.evaluate((t) => window.__qaSetTab?.(t), tab);
  await page.waitForTimeout(2500);
}

async function probeCam(page) {
  return page.evaluate(() => {
    const st = window.__qaActiveScene;
    const cam = st?.camera;
    if (!cam) return null;
    return {
      x: cam.position.x, y: cam.position.y, z: cam.position.z,
      dist: Math.hypot(cam.position.x, cam.position.y, cam.position.z),
    };
  });
}

async function runOnContext(viewport, label) {
  log(`========== ${label} (${viewport.width}x${viewport.height}) ==========`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[browser:${label}:error] ${e.message}`));
  await seedAndEnter(page);

  // ─── §1 Network mode: cluster pill camera framing + no snap-back
  log('§1 Network — cluster pill click');
  await setTab(page, 'network');
  const netBefore = await probeCam(page);
  const heatsPill = page.locator('button:has-text("Heats & Sharpens")').first();
  if (await heatsPill.isVisible({ timeout: 2000 }).catch(() => false)) {
    await heatsPill.click({ force: true });
    await page.waitForTimeout(2500);
    const netAfter = await probeCam(page);
    const moved = (netBefore && netAfter) ? Math.hypot(netBefore.x - netAfter.x, netBefore.y - netAfter.y, netBefore.z - netAfter.z) : 0;
    check(`${label}/§1.1 Network: cluster pill moves camera`, moved > 5, `moved ${moved.toFixed(1)}u`);
    await page.waitForTimeout(4000);
    const netLater = await probeCam(page);
    const drift = (netAfter && netLater) ? Math.hypot(netAfter.x - netLater.x, netAfter.y - netLater.y, netAfter.z - netLater.z) : 0;
    // Network mode INTENTIONALLY keeps the cluster tour (the user
    // explicitly opted into it via cluster-pill click). So drift is
    // expected here — just verify it stays roughly framing the cluster.
    check(`${label}/§1.2 Network: post-fly camera still in cluster vicinity`, drift < 60, `drift ${drift.toFixed(1)}u`);
  } else {
    log('  SKIP (no Heats & Sharpens pill in viewport)');
  }
  await page.screenshot({ path: `${OUT_DIR}/${label}-network.png` });

  // ─── §2 Cookbook: no cluster-tour drift on mount
  log('§2 Cookbook — no auto-orbit on mount');
  await setTab(page, 'cookbook');
  const cookT0 = await probeCam(page);
  await page.waitForTimeout(5000);
  const cookT5 = await probeCam(page);
  const cookDrift = (cookT0 && cookT5) ? Math.hypot(cookT0.x - cookT5.x, cookT0.y - cookT5.y, cookT0.z - cookT5.z) : 0;
  check(`${label}/§2.1 Cookbook: no auto-orbit drift (>5u in 5s = bug)`, cookDrift < 5, `drift ${cookDrift.toFixed(1)}u`);
  await page.screenshot({ path: `${OUT_DIR}/${label}-cookbook.png` });

  // ─── §3 Sauce: sauce-type click frames cluster + no drift
  log('§3 Sauce — Hollandaise pill frames cluster');
  await setTab(page, 'sauce');
  await page.waitForTimeout(2500);
  const sauceBefore = await probeCam(page);
  const hollPill = page.locator('button:has-text("Hollandaise")').first();
  if (await hollPill.isVisible({ timeout: 2000 }).catch(() => false)) {
    await hollPill.click({ force: true });
    await page.waitForTimeout(2500);
    const sauceAfter = await probeCam(page);
    const sauceMoved = (sauceBefore && sauceAfter) ? Math.hypot(sauceBefore.x - sauceAfter.x, sauceBefore.y - sauceAfter.y, sauceBefore.z - sauceAfter.z) : 0;
    check(`${label}/§3.1 Sauce: sauce-type click moves camera`, sauceMoved > 30, `moved ${sauceMoved.toFixed(1)}u`);
    await page.waitForTimeout(3000);
    const sauceLater = await probeCam(page);
    const sauceDrift = (sauceAfter && sauceLater) ? Math.hypot(sauceAfter.x - sauceLater.x, sauceAfter.y - sauceLater.y, sauceAfter.z - sauceLater.z) : 0;
    check(`${label}/§3.2 Sauce: no post-fly drift`, sauceDrift < 5, `drift ${sauceDrift.toFixed(1)}u`);
  } else {
    log('  SKIP (no Hollandaise pill in viewport)');
  }
  await page.screenshot({ path: `${OUT_DIR}/${label}-sauce.png` });

  // ─── §4 Cocktail: cocktail-type click frames cluster + no drift
  log('§4 Cocktail — cocktail family pill');
  await setTab(page, 'cocktail');
  await page.waitForTimeout(4000);  // graph + centroids need to settle
  const cockBefore = await probeCam(page);

  // Print all bottom-strip buttons. Filter out off-screen elements
  // (x < 0 or x > vw) — previous-tab DOM remnants are still in the
  // document, just shifted off-canvas.
  const bottomPills = await page.evaluate(({ vh, vw }) => {
    return Array.from(document.querySelectorAll('button'))
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { text: (b.textContent || '').trim(), y: r.y, x: r.x, w: r.width };
      })
      .filter((p) =>
        p.y > vh * 0.7 && p.y < vh &&
        p.x >= 0 && p.x < vw &&
        p.w > 30 && p.w < 250 &&
        p.text.length > 3 && p.text.length < 30 &&
        // Exclude known sauce-family labels (lingering from prev tab).
        !/^(Hollandaise|Béchamel|Velouté|Espagnole|Tomato|Curry|Stir-Fry|Mole|Salsa|Nut Sauce|Veloute)$/.test(p.text)
      );
  }, { vh: viewport.height, vw: viewport.width });
  log(`  bottom-strip pills: ${JSON.stringify(bottomPills.slice(0, 8))}`);

  let cockClicked = false;
  // Click the first bottom-strip pill — they're all cocktail families.
  if (bottomPills.length > 0) {
    const targetText = bottomPills[0].text;
    const pill = page.locator(`button:has-text("${targetText}")`).first();
    if (await pill.isVisible({ timeout: 1000 }).catch(() => false)) {
      log(`  clicking pill: "${targetText}"`);
      await pill.click({ force: true });
      cockClicked = true;
    }
  }
  if (cockClicked) {
    await page.waitForTimeout(2500);
    const cockAfter = await probeCam(page);
    const cockMoved = (cockBefore && cockAfter) ? Math.hypot(cockBefore.x - cockAfter.x, cockBefore.y - cockAfter.y, cockBefore.z - cockAfter.z) : 0;
    log(`  cam before: ${JSON.stringify(cockBefore)}`);
    log(`  cam after:  ${JSON.stringify(cockAfter)}`);
    check(`${label}/§4.1 Cocktail: pill click moves camera`, cockMoved > 30, `moved ${cockMoved.toFixed(1)}u`);
    await page.waitForTimeout(3000);
    const cockLater = await probeCam(page);
    const cockDrift = (cockAfter && cockLater) ? Math.hypot(cockAfter.x - cockLater.x, cockAfter.y - cockLater.y, cockAfter.z - cockLater.z) : 0;
    check(`${label}/§4.2 Cocktail: no post-fly drift`, cockDrift < 5, `drift ${cockDrift.toFixed(1)}u`);
  } else {
    log('  SKIP (no cocktail family pill found in bottom strip)');
  }
  await page.screenshot({ path: `${OUT_DIR}/${label}-cocktail.png` });

  // ─── §5 Button overlap detection in default Network view
  log('§5 Button overlap detection (Network view)');
  await setTab(page, 'network');
  await page.waitForTimeout(1500);
  const overlaps = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    const visible = btns.filter((b) => {
      const r = b.getBoundingClientRect();
      const s = getComputedStyle(b);
      return r.width > 10 && r.height > 10 && s.display !== 'none' && s.visibility !== 'hidden';
    });
    const found = [];
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i];
      const ra = a.getBoundingClientRect();
      if (ra.width * ra.height > window.innerWidth * window.innerHeight * 0.5) continue;
      for (let j = i + 1; j < visible.length; j++) {
        const b = visible[j];
        if (a.contains(b) || b.contains(a)) continue;
        const rb = b.getBoundingClientRect();
        if (rb.width * rb.height > window.innerWidth * window.innerHeight * 0.5) continue;
        const overlap = !(ra.right <= rb.left || rb.right <= ra.left || ra.bottom <= rb.top || rb.bottom <= ra.top);
        if (overlap) {
          // Skip if both are descendants of a shared non-body wrapper
          // (legitimate grouped controls like pill rows).
          let sharedParent = null;
          let p = a.parentElement;
          while (p && !sharedParent) {
            if (p.contains(b)) sharedParent = p;
            p = p.parentElement;
          }
          if (sharedParent && sharedParent.tagName !== 'BODY' && sharedParent.tagName !== 'MAIN') continue;
          found.push({
            a: a.getAttribute('data-testid') || a.textContent?.slice(0, 30) || 'unnamed',
            b: b.getAttribute('data-testid') || b.textContent?.slice(0, 30) || 'unnamed',
          });
        }
      }
    }
    return found;
  });
  log(`  ${overlaps.length} cross-parent button overlaps`);
  if (overlaps.length > 0) log(`  sample: ${JSON.stringify(overlaps.slice(0, 3))}`);
  check(`${label}/§5.0 No cross-parent button overlaps in Network`, overlaps.length === 0, `${overlaps.length} overlaps`);

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
