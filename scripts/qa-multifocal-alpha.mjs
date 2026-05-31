// Multi-focal α-mode visual debug. Loads the live deploy with the
// af_debug=1 query param to enable QA helpers, selects 2 ingredients,
// engages α-mode, captures screenshots + AffinityMode state.
//
// Run: node scripts/qa-multifocal-alpha.mjs

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.QA_URL || 'https://neuralflavor.web.app/?path=network&af_debug=1';
const OUT_DIR = '.playwright-shots/multifocal-alpha';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[mf] ${m}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', (msg) => {
  const t = msg.text();
  if (/AffinityMode|focal|wedge|bucket|engage|pivot|error|warn/i.test(t)) {
    console.log(`[browser:${msg.type()}] ${t}`);
  }
});
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

// Pre-seed localStorage on the deploy origin so the first-use Walkthrough
// AND the training-trace overlay don't intercept canvas interaction.
log('seed localStorage to skip onboarding');
await page.goto(URL.replace(/[?#].*$/, ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => {
  try {
    localStorage.setItem('flavor-tour-complete', 'true');
    localStorage.setItem('fn-training-trace-seen', '1');
  } catch {}
});

log(`load ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Landing tile id is "pairing" (routes to Network tab).
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  log('landing gate — clicking pairing');
  await pairingTile.click();
  await page.waitForTimeout(800);
}

// Skip Walkthrough.
const skipTour = page.locator('button:has-text("Skip Tour"), button:has-text("Skip")').first();
if (await skipTour.isVisible({ timeout: 2000 }).catch(() => false)) {
  log('Walkthrough — skipping');
  await skipTour.click();
  await page.waitForTimeout(500);
}

log('wait for canvas');
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(3000); // Three.js scene + AffinityMode constructor.

// Confirm QA helpers + debug hook present.
const helpersReady = await page.evaluate(() => ({
  qaSelect: typeof window.__qaSelect,
  qaEngage: typeof window.__qaEngageAffinity,
  af: !!window.__af,
}));
log(`helpers: ${JSON.stringify(helpersReady)}`);

await page.screenshot({ path: `${OUT_DIR}/01-initial.png` });
log('captured 01-initial');

// Select tomato via QA helper.
await page.evaluate(() => window.__qaSelect?.('tomato'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/02-tomato-selected.png` });
log('captured 02-tomato-selected');

const stateAfter1 = await page.evaluate(() => window.__qaReadSelection?.());
log(`state after tomato: ${JSON.stringify(stateAfter1)}`);

// Add basil.
await page.evaluate(() => window.__qaSelect?.('basil'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/03-basil-added.png` });
log('captured 03-basil-added');

const stateAfter2 = await page.evaluate(() => window.__qaReadSelection?.());
log(`state after basil: ${JSON.stringify(stateAfter2)}`);

// Engage α-mode with both as focals.
log('engage α-mode with [tomato, basil]');
await page.evaluate(() => window.__qaEngageAffinity?.(['tomato', 'basil']));
await page.waitForTimeout(3000); // engage + camera fly + wedge layout.
await page.screenshot({ path: `${OUT_DIR}/04-alpha-engaged.png` });
log('captured 04-alpha-engaged');

// Probe edge data shape to confirm topAffinities sees the right keys.
const edgeProbe = await page.evaluate(() => {
  const af = window.__af;
  if (!af) return { error: 'no __af' };
  const edges = af.ctx?.graph?.edges;
  if (!Array.isArray(edges)) return { error: 'no edges array', kind: typeof edges };
  const sample = edges.slice(0, 2);
  const tomatoEdges = edges.filter((e) =>
    (e.source === 'tomato' || e.target === 'tomato' ||
     e.ingredientA === 'tomato' || e.ingredientB === 'tomato')
  ).length;
  return { count: edges.length, sample, tomatoEdges };
});
console.log(`[mf] edge probe: ${JSON.stringify(edgeProbe).slice(0, 500)}`);

// Probe AffinityMode internal state.
const alphaState = await page.evaluate(() => {
  const af = window.__af;
  if (!af) return { error: 'no __af' };
  const focalMatrices = [];
  if (af.focalMesh) {
    // Read matrices directly from the InstancedBufferAttribute array.
    const arr = af.focalMesh.instanceMatrix?.array;
    if (arr) {
      for (let i = 0; i < (af.focalMesh.count || 0); i++) {
        const base = i * 16;
        const pos = { x: arr[base + 12], y: arr[base + 13], z: arr[base + 14] };
        const sx = Math.hypot(arr[base + 0], arr[base + 1], arr[base + 2]);
        focalMatrices.push({ idx: i, pos, scale: sx });
      }
    }
  }
  // Probe live curPos at the focal indices to compare against debug cx.
  const st = af.stateRef;
  const liveCurPos = {};
  if (st?.nameIdx && st?.curPos) {
    for (const n of ['tomato', 'basil']) {
      const idx = st.nameIdx.get(n);
      if (idx != null) {
        liveCurPos[n] = {
          idx,
          x: st.curPos[idx*3],
          y: st.curPos[idx*3+1],
          z: st.curPos[idx*3+2],
        };
      }
    }
  }
  const focalLabels = [];
  if (af.focalLabelGroup) {
    for (const sprite of af.focalLabelGroup.children) {
      focalLabels.push({
        text: sprite.userData?.label || sprite.userData?.name || '?',
        visible: sprite.visible,
        pos: sprite.position ? { x: sprite.position.x, y: sprite.position.y, z: sprite.position.z } : null,
      });
    }
  }
  return {
    engaged: af._engaged,
    currentFocal: af._currentFocal,
    currentFocals: af._currentFocals,
    focalMeshCount: af.focalMesh?.count,
    focalMeshVisible: af.focalMesh?.visible,
    affinityCount: af._currentAffinities?.length,
    affinityNames: af._currentAffinities?.slice(0, 10).map((a) => a.name),
    debugIntersection: af._debugLastIntersection,
    debugMultiFocal: af._debugMultiFocal,
    focalMatrices,
    focalLabels,
    focalLabelGroupChildren: af.focalLabelGroup?.children?.length,
    focalLabelGroupVisible: af.focalLabelGroup?.visible,
    focalMeshCapacity: af.focalMesh?.instanceMatrix?.array?.length / 16,
    liveCurPos,
  };
});
log(`α-mode state: ${JSON.stringify(alphaState, null, 2)}`);

await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT_DIR}/05-alpha-settled.png` });
log('captured 05-alpha-settled');

await ctx.close();
await browser.close();

const html = `<!doctype html>
<meta charset="utf-8">
<title>Multi-focal α-mode debug</title>
<style>
  body { font: 14px system-ui; margin: 24px; background: #0a0a0f; color: #eee; }
  h2 { font-weight: 400; color: #aaa; margin-top: 24px; }
  img { max-width: 100%; border: 1px solid #222; }
  pre { background: #111; padding: 12px; border-radius: 6px; overflow: auto; }
</style>
<h1>Multi-focal α-mode — visual debug</h1>
<h2>1. Initial Network mode</h2><img src="01-initial.png">
<h2>2. After selecting tomato</h2><img src="02-tomato-selected.png">
<h2>3. After adding basil</h2><img src="03-basil-added.png">
<h2>4. After engaging α-mode with [tomato, basil]</h2><img src="04-alpha-engaged.png">
<h2>5. α-mode settled (1.5s later)</h2><img src="05-alpha-settled.png">
`;
writeFileSync(`${OUT_DIR}/index.html`, html);
log(`wrote ${OUT_DIR}/index.html`);
