// Network-mode selection invariants — Playwright e2e.
//
// Asserts:
//   (1) Selection survives camera rotation (mouse drag on canvas).
//   (2) Selection survives camera zoom (wheel).
//   (3) Selection survives orbit-drag with multi-select.
//   (4) Selection is cleared ONLY by:
//         - tap on empty/black space (mouse click on canvas with no
//           ingredient hit)
//         - "Clear selection" affordance
//   (5) Exit from α-mode (whether via empty-tap or Clear Selection)
//       lands the user back on the default Network/Flavor-Graph view
//       with every ingredient visible (no residual isolate-state).
//
// Run: node scripts/qa-network-selection-rotation.mjs

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const URL = process.env.QA_URL || 'https://neuralflavor.web.app/?path=network&af_debug=1';
const OUT_DIR = '.playwright-shots/network-selection';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[ns] ${m}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

const failures = [];
function check(name, cond, detail = '') {
  if (cond) {
    log(`  PASS  ${name}`);
  } else {
    log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
    failures.push({ name, detail });
  }
}

// Seed localStorage so Walkthrough + training-trace don't intercept.
log('seed localStorage');
await page.goto(URL.replace(/[?#].*$/, ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => {
  try {
    localStorage.setItem('flavor-tour-complete', 'true');
    localStorage.setItem('fn-training-trace-seen', '1');
  } catch {}
});

log(`load ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await pairingTile.click();
  await page.waitForTimeout(800);
}

await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(3000);

const readSel = () => page.evaluate(() => window.__qaReadSelection?.());
const select = (name) => page.evaluate((n) => window.__qaSelect?.(n), name);
const clearSel = () => page.evaluate(() => window.__qaClearSelection?.());
const engageAff = (names) => page.evaluate((n) => window.__qaEngageAffinity?.(n), names);
const afEngaged = () => page.evaluate(() => !!window.__af?._engaged);

// Find the canvas bounding box once.
const canvas = page.locator('canvas').first();
const box = await canvas.boundingBox();
assert(box, 'no canvas bbox');
const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

async function orbitDrag() {
  // Mouse-down on canvas, drag 200px right + 50px down, mouse-up.
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 200, center.y + 50, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}
async function wheelZoom(deltaY = -400) {
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(400);
}
async function tapEmpty() {
  // Click at far-right of canvas where no UI overlay sits — the wheel
  // + nodes are centered, the right edge is reliably empty background.
  // Avoid (10, 10) — that overlaps the help/menu icons at the top-left.
  const before = await page.evaluate(() => window.__qaClickCount || 0);
  await page.mouse.click(box.x + box.width * 0.95, box.y + box.height * 0.5);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({
    count: window.__qaClickCount || 0,
    lastName: window.__qaLastClickNodeName,
  }));
  log(`    tapEmpty click count ${before} -> ${after.count}, lastNodeName=${after.lastName}`);
}

// ----- Test 1: select 1 + rotate + zoom preserves selection -----
log('TEST 1: select 1 + rotate + zoom preserves selection');
await clearSel();
await select('tomato');
await page.waitForTimeout(300);
let s = await readSel();
check('1.0 after select: tomato in selection', s?.selectedNodes?.includes('tomato'), JSON.stringify(s));

await orbitDrag();
s = await readSel();
check('1.1 after orbit drag: selection preserved', s?.selectedNodes?.includes('tomato'), JSON.stringify(s));

await wheelZoom(-400);
s = await readSel();
check('1.2 after zoom in: selection preserved', s?.selectedNodes?.includes('tomato'), JSON.stringify(s));

await wheelZoom(400);
s = await readSel();
check('1.3 after zoom out: selection preserved', s?.selectedNodes?.includes('tomato'), JSON.stringify(s));

// ----- Test 2: multi-select + rotate -----
log('TEST 2: multi-select + rotate preserves all selections');
await select('basil');
await page.waitForTimeout(300);
s = await readSel();
check('2.0 after second select: both in selection',
  s?.selectedNodes?.length === 2 && s.selectedNodes.includes('basil'),
  JSON.stringify(s));
await orbitDrag();
s = await readSel();
check('2.1 after orbit: both still selected',
  s?.selectedNodes?.length === 2 && s.selectedNodes.includes('tomato') && s.selectedNodes.includes('basil'),
  JSON.stringify(s));

// ----- Test 3: tap empty clears selection -----
log('TEST 3: tap empty clears selection');
// Reset to known state.
await page.evaluate(() => {
  window.__qaClearSelection?.();
});
await page.waitForTimeout(400);
await select('tomato');
await page.waitForTimeout(400);
await tapEmpty();
s = await readSel();
check('3.0 after tap-empty: selection cleared',
  Array.isArray(s?.selectedNodes) && s.selectedNodes.length === 0,
  JSON.stringify(s));

// ----- Test 4: programmatic clear works (proxy for "Clear Selection" button) -----
log('TEST 4: clear-selection proxy works');
await select('tomato');
await page.waitForTimeout(500);
await clearSel();
await page.waitForTimeout(500);
s = await readSel();
check('4.0 after clearSel: selection cleared',
  Array.isArray(s?.selectedNodes) && s.selectedNodes.length === 0,
  JSON.stringify(s));

// ----- Test 5: α-mode engage + tap empty exits + restores network -----
log('TEST 5: α-mode exit via tap-empty restores network');
await select('tomato');
await page.waitForTimeout(200);
await select('basil');
await page.waitForTimeout(200);
await engageAff(['tomato', 'basil']);
await page.waitForTimeout(2000);
check('5.0 α-mode engaged', await afEngaged());

await tapEmpty();
await page.waitForTimeout(1500);
const afterExit = await page.evaluate(() => ({
  selection: window.__qaReadSelection?.(),
  afEngaged: !!window.__af?._engaged,
  affinityRequested: window.__qaReadSelection?.()?.affinityRequested,
}));
check('5.1 α-mode exited', afterExit.afEngaged === false, JSON.stringify(afterExit));
check('5.2 selection cleared on α-mode exit', afterExit.selection?.selectedNodes?.length === 0, JSON.stringify(afterExit));

// Capture screenshot of the post-exit state — should be full network.
await page.screenshot({ path: `${OUT_DIR}/06-post-alpha-exit.png` });
log('captured 06-post-alpha-exit');

// ----- Test 6: post-exit, all instances back to non-zero scale -----
const meshState = await page.evaluate(() => {
  const st = window.__af?.stateRef;
  const mesh = st?.mesh;
  if (!mesh) return { error: 'no mesh' };
  const arr = mesh.instanceMatrix?.array;
  if (!arr) return { error: 'no instanceMatrix' };
  let hidden = 0;
  let visible = 0;
  const total = mesh.count;
  for (let i = 0; i < total; i++) {
    const base = i * 16;
    const sx = Math.hypot(arr[base + 0], arr[base + 1], arr[base + 2]);
    if (sx < 0.01) hidden++; else visible++;
  }
  return { total, hidden, visible };
});
log(`mesh state: ${JSON.stringify(meshState)}`);
check('5.3 all node instances visible post-exit (none scale=0)',
  meshState?.hidden === 0,
  JSON.stringify(meshState));

await ctx.close();
await browser.close();

writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify({ failures }, null, 2));

if (failures.length === 0) {
  log(`ALL CHECKS PASSED`);
  process.exit(0);
} else {
  log(`${failures.length} CHECK(S) FAILED`);
  for (const f of failures) console.log(`  - ${f.name}${f.detail ? ': ' + f.detail : ''}`);
  process.exit(1);
}
