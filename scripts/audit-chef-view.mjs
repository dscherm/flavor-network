// Capture exactly what the chef sees on the deployed web app in default
// state (no preset localStorage flags), so we can confirm whether V3
// cluster coloring is visible or stuck on v2.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.VERIFY_URL || 'https://neuralflavor.web.app/';
const SHOT_DIR = '.playwright-shots';
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  try { localStorage.setItem('flavor-tour-complete', '1'); } catch {}
});

console.log(`[chef-view] loading ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle' });

await page.click('[data-mode="pairing"]');
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForFunction(() => !!window.__proDataGraph, { timeout: 30000 });
await page.waitForTimeout(4000);

// Dismiss the "Got it" tour overlay (Watch the model card) that covers the
// network on first load — that's likely why the chef thinks nodes look uncolored.
try {
  const gotIt = await page.$('button:has-text("Got it")');
  if (gotIt) {
    await gotIt.click();
    await page.waitForTimeout(1500);
    console.log('[chef-view] dismissed tour overlay');
  }
} catch (e) {
  console.log(`[chef-view] tour dismiss skipped: ${e.message}`);
}

// Capture chef view with tour dismissed
await page.screenshot({ path: `${SHOT_DIR}/chef-default-view.png` });
console.log('[chef-view] saved chef-default-view.png');

// What V3 mode flag is the chef's session in?
const flagState = await page.evaluate(() => {
  const ls = (() => { try { return localStorage.getItem('FN_FLAVOR_V3'); } catch { return '?'; }})();
  const graph = window.__proDataGraph;
  // Sample a few specific nodes to see what they're tagged with
  const sample = ['pernod', 'mackerel', 'galliano', 'oxtail', 'cod', 'parmesan'];
  const states = sample.map((n) => {
    const node = graph?.nodes?.get(n);
    return {
      name: n,
      found: !!node,
      clusterId: node?.clusterId ?? null,
      clusterColor: node?.clusterColor ?? null,
    };
  });
  // Per-cluster count + null tally. V3 with bisection now runs k=17, so
  // any cluster id < 17 is valid; id >= 17 would be a real leak.
  const V3_MAX_K = 17;
  const counts = { perCluster: {}, in_v3_range: 0, out_of_range: 0, null: 0, total: 0 };
  if (graph?.nodes) {
    for (const [, n] of graph.nodes) {
      counts.total++;
      const cid = n.clusterId;
      if (cid === null || cid === undefined) counts.null++;
      else if (cid >= 0 && cid < V3_MAX_K) {
        counts.in_v3_range++;
        counts.perCluster[cid] = (counts.perCluster[cid] || 0) + 1;
      } else counts.out_of_range++;
    }
  }
  return { localStorage_flag: ls, sample_nodes: states, counts };
});

console.log(`\n[chef-view] localStorage.FN_FLAVOR_V3: ${flagState.localStorage_flag}`);
console.log(`[chef-view] cluster distribution (k=17 valid range):`);
console.log(`  in V3 range (0-16): ${flagState.counts.in_v3_range}`);
console.log(`  out-of-range (>=17): ${flagState.counts.out_of_range}`);
console.log(`  null/gray:          ${flagState.counts.null}`);
console.log(`  total:              ${flagState.counts.total}`);
console.log(`\n  per-cluster nodes (top 10):`);
const sorted = Object.entries(flagState.counts.perCluster)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
for (const [cid, n] of sorted) console.log(`    c${cid.padStart(2)}: ${n}`);
console.log(`\n[chef-view] verdict: ${flagState.counts.out_of_range === 0 ? 'CLEAN V3 (k=17)' : 'OUT-OF-RANGE CLUSTER IDS'}`);
console.log(`\n[chef-view] sample nodes:`);
for (const n of flagState.sample_nodes) {
  console.log(`  ${n.name.padEnd(20)} cid=${String(n.clusterId).padEnd(6)} color=${n.clusterColor || '-'}`);
}

await browser.close();
