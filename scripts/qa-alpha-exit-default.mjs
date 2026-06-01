// Verify α-mode → Network default-state transition is correct after the
// 2026-05-31 fix. ESC from α-mode must full-reset, and "None" pill must
// toggle particles on while keeping the active filter's palette.
import { chromium } from 'playwright';

const HOST = process.env.QA_HOST || 'https://neuralflavor.web.app';
const log = (m) => console.log(`[α-exit] ${m}`);
const fails = [];
const ok = (label, cond) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails.push(label);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then(c => c.newPage());
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

log('seed localStorage + open with af_debug');
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
await page.waitForTimeout(3000);

log('§0 baseline screenshot (initial Network state)');
await page.screenshot({ path: '.playwright-shots/alpha-exit/00-baseline.png', fullPage: false });

log('§A select two ingredients + engage α-mode');
await page.evaluate(() => window.__qaSelect?.('basil'));
await page.waitForTimeout(500);
await page.evaluate(() => window.__qaSelect?.('tomato'));
await page.waitForTimeout(500);
await page.evaluate(() => window.__qaEngageAffinity?.(['basil', 'tomato']));
await page.waitForTimeout(3000);

const alphaState = await page.evaluate(() => ({
  selection: window.__qaReadSelection?.()?.selectedNodes ?? null,
  affEngaged: !!window.__af?._engaged,
}));
ok('two ingredients selected', alphaState.selection?.length === 2);
ok('α-mode engaged', alphaState.affEngaged);

log('§B press ESC to exit α-mode → should land in DEFAULT Network state');
await page.keyboard.press('Escape');
await page.waitForTimeout(2500);

const readDefaultState = () => page.evaluate(() => {
  const sel = window.__qaReadSelection?.();
  const aff = window.__af;
  const st = aff?.stateRef;
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const flavorPill = pills.find(b => /Flavor Graph/i.test(b.textContent || ''));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  let zeroScaleCount = 0;
  let totalNodes = 0;
  let particlesVisible = null;
  let edgesVisible = null;
  if (st?.mesh && st?.nodeArray) {
    const arr = st.mesh.instanceMatrix.array;
    totalNodes = st.nodeArray.length;
    for (let i = 0; i < totalNodes; i++) {
      const base = i * 16;
      const sx = Math.hypot(arr[base + 0], arr[base + 1], arr[base + 2]);
      if (sx < 0.01) zeroScaleCount += 1;
    }
    particlesVisible = !!st.particleMesh?.visible;
    edgesVisible = !!st.edgeMesh?.visible;
  }
  return {
    selection: sel?.selectedNodes ?? null,
    affEngaged: !!aff?._engaged,
    flavorPillActive: flavorPill?.getAttribute('aria-checked') === 'true',
    nonePillActive: nonePill?.getAttribute('aria-checked') === 'true',
    totalNodes, zeroScaleCount, particlesVisible, edgesVisible,
  };
});

const verifyDefaultState = (state, label) => {
  ok(`${label} | selection cleared`, state.selection?.length === 0);
  ok(`${label} | α-mode NOT engaged`, !state.affEngaged);
  ok(`${label} | Flavor Graph pill active`, state.flavorPillActive === true);
  ok(`${label} | None pill NOT active`, state.nonePillActive === false);
  ok(`${label} | ALL nodes visible (${state.zeroScaleCount}/${state.totalNodes} hidden)`,
     state.zeroScaleCount === 0);
  ok(`${label} | particles HIDDEN`, state.particlesVisible === false);
  ok(`${label} | edges HIDDEN`, state.edgesVisible === false);
};

const postEsc = await readDefaultState();
verifyDefaultState(postEsc, 'ESC');
await page.screenshot({ path: '.playwright-shots/alpha-exit/01-post-esc.png', fullPage: false });
log(`  [shot] .playwright-shots/alpha-exit/01-post-esc.png`);

log('§C click "None" pill → particles override engages, palette persists');
await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  nonePill?.click();
});
await page.waitForTimeout(1500);

const postNoneClick = await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const flavorPill = pills.find(b => /Flavor Graph/i.test(b.textContent || ''));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  return {
    flavorPillActive: flavorPill?.getAttribute('aria-checked') === 'true',
    nonePillActive: nonePill?.getAttribute('aria-checked') === 'true',
  };
});
ok('None pill now active', postNoneClick.nonePillActive === true);
ok('Flavor Graph STILL active (filter not cleared)', postNoneClick.flavorPillActive === true);

log('§D click None again → toggles off');
await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  nonePill?.click();
});
await page.waitForTimeout(1000);

const postNoneOff = await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  return nonePill?.getAttribute('aria-checked') === 'true';
});
ok('None pill toggled off', postNoneOff === false);

// ===== Clear Selection button exits α-mode to default state =====
log('§E re-engage α-mode then click "Clear Selection" button');
await page.evaluate(() => window.__qaSelect?.('basil'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__qaSelect?.('tomato'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__qaEngageAffinity?.(['basil', 'tomato']));
await page.waitForTimeout(3000);

await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(
    b => /Clear Selection/i.test(b.textContent || '')
  );
  btn?.click();
});
await page.waitForTimeout(2500);

const postClear = await readDefaultState();
verifyDefaultState(postClear, 'CLEAR_BTN');

// ===== Empty-space tap exits α-mode to default state =====
log('§F re-engage α-mode then click empty space on canvas');
await page.evaluate(() => window.__qaSelect?.('basil'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__qaSelect?.('tomato'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__qaEngageAffinity?.(['basil', 'tomato']));
await page.waitForTimeout(3000);

// Click far edge of canvas (an empty region away from any α-mode ring,
// which sits centered). Bottom strip is below the nav, breadcrumb, and
// pill row, and the α-mode rings rarely extend to the bottom-corner
// portion of the canvas.
const canvasBox = await page.locator('canvas').first().boundingBox();
if (canvasBox) {
  // Move first to clear any drag-vs-tap remembered position.
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);
  await page.waitForTimeout(100);
  await page.mouse.click(
    canvasBox.x + canvasBox.width * 0.05,
    canvasBox.y + canvasBox.height * 0.92,
  );
}
await page.waitForTimeout(2500);

const postEmptyTap = await readDefaultState();
verifyDefaultState(postEmptyTap, 'EMPTY_TAP');

await browser.close();
if (fails.length) {
  console.log(`\nFAIL: ${fails.length} check(s) failed:`);
  fails.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
