// Compare main mesh instance matrix BEFORE α-mode engage vs AFTER exit.
// If the user's "most nodes not visible" claim is real, the post-exit
// matrix will differ from baseline (some scales smaller / positions off).
import { chromium } from 'playwright';

const HOST = process.env.QA_HOST || 'https://neuralflavor.web.app';
const log = (m) => console.log(`[diff] ${m}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then(c => c.newPage());
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

await page.goto(`${HOST}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  try {
    localStorage.setItem('flavor-tour-complete', 'true');
    localStorage.setItem('fn-training-trace-seen', '1');
  } catch {}
});
await page.goto(`${HOST}/?path=explore&af_debug=1`, { waitUntil: 'domcontentloaded' });
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await pairingTile.click({ force: true });
  await pairingTile.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
}
await page.waitForTimeout(4000);

const captureMatrixStats = () => page.evaluate(() => {
  const st = window.__af?.stateRef;
  if (!st?.mesh) return null;
  const arr = st.mesh.instanceMatrix.array;
  const count = st.nodeArray.length;
  const scales = new Float32Array(count);
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const zs = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const b = i * 16;
    scales[i] = Math.hypot(arr[b], arr[b+1], arr[b+2]);
    xs[i] = arr[b+12]; ys[i] = arr[b+13]; zs[i] = arr[b+14];
  }
  return {
    count,
    sampleScales: [scales[0], scales[100], scales[1000], scales[3000]],
    samplePositions: [
      [xs[0], ys[0], zs[0]],
      [xs[100], ys[100], zs[100]],
      [xs[1000], ys[1000], zs[1000]],
      [xs[3000], ys[3000], zs[3000]],
    ],
    minScale: Math.min(...scales),
    maxScale: Math.max(...scales),
    avgScale: Array.from(scales).reduce((a, b) => a + b, 0) / count,
    scalesArr: Array.from(scales),
  };
});

log('§A baseline (no α-mode)');
const baseline = await captureMatrixStats();
log(`  count=${baseline.count} min=${baseline.minScale.toFixed(3)} max=${baseline.maxScale.toFixed(3)} avg=${baseline.avgScale.toFixed(3)}`);
log(`  samples: scales=${baseline.sampleScales.map(s => s.toFixed(2)).join(',')}`);
log(`  positions: ${baseline.samplePositions.map(p => `(${p[0].toFixed(1)},${p[1].toFixed(1)},${p[2].toFixed(1)})`).join(' ')}`);

log('§B engage α-mode (basil + tomato)');
await page.evaluate(() => window.__qaSelect?.('basil'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__qaSelect?.('tomato'));
await page.waitForTimeout(400);
await page.evaluate(() => window.__qaEngageAffinity?.(['basil', 'tomato']));
await page.waitForTimeout(3000);

log('§C ESC → post-exit');
await page.keyboard.press('Escape');
await page.waitForTimeout(4000); // wait for fly + finalize

const postExit = await captureMatrixStats();
log(`  count=${postExit.count} min=${postExit.minScale.toFixed(3)} max=${postExit.maxScale.toFixed(3)} avg=${postExit.avgScale.toFixed(3)}`);
log(`  samples: scales=${postExit.sampleScales.map(s => s.toFixed(2)).join(',')}`);
log(`  positions: ${postExit.samplePositions.map(p => `(${p[0].toFixed(1)},${p[1].toFixed(1)},${p[2].toFixed(1)})`).join(' ')}`);

// Diff: count nodes with significantly different scale or position
let scaleDiffs = 0;
let posDiffs = 0;
for (let i = 0; i < baseline.count; i += 1) {
  if (Math.abs(baseline.scalesArr[i] - postExit.scalesArr[i]) > 0.01) scaleDiffs += 1;
}
log(`§D diff: ${scaleDiffs}/${baseline.count} nodes have scale diff > 0.01`);
log(`  baseline avg scale: ${baseline.avgScale.toFixed(3)}`);
log(`  post-exit avg scale: ${postExit.avgScale.toFixed(3)}`);

await browser.close();
