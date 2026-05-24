// Headless audit: confirm the 25 newly-classified V3 ingredients render
// with their cluster color (not the gray fallback or the taste fallback).
//
// Run against a local preview build (faster, cache-free):
//   npm run build && npm run preview   (in another shell)
//   node scripts/audit-new-cluster-colors.mjs
//
// Or against the deployed app:
//   VERIFY_URL=https://neuralflavor.web.app node scripts/audit-new-cluster-colors.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.VERIFY_URL || 'http://localhost:4173/';
const SHOT_DIR = '.playwright-shots';
mkdirSync(SHOT_DIR, { recursive: true });

// The 25 ingredients we just classified (per apply_v3_assignments.py output).
// Each line: [name, expected_cluster_id, expected_hex].
const V3_CLUSTER_HEX = [
  '#f472b6', '#ea580c', '#22c55e',
  '#dc2626', '#facc15', '#a855f7',
  '#84cc16', '#b45309', '#78350f', '#64748b',
];
const NEW_ITEMS = [
  ['bok choi', 0],
  ['galliano', 1],
  ['blackcurrant cordial', 1],
  ['creme de cassi', 1],
  ['anisette', 1],
  ['elderflower cordial', 1],
  ['garcinia indica', 1],
  ['fromage frai', 1],
  ['dutch stroop', 1],
  ['pernod', 3],
  ['absinthe', 3],
  ['amaro montenegro', 3],
  ['jägermeister', 3],
  ['ouzo', 3],
  ['falernum', 3],
  ['lillet', 3],
  ['lillet blanc', 3],
  ['st. germain', 1],
  ['mackerel', 4],
  ['herring', 4],
  ['kielbasa', 4],
  ['freekeh', 4],
  ['oxtail', 7],
  ['morcilla', 7],
  ['manchego', 7],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.addInitScript(() => {
  try {
    localStorage.setItem('flavor-tour-complete', '1');
    localStorage.setItem('FN_FLAVOR_V3', 'true');
  } catch {}
});

console.log(`[audit] loading ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle' });

// Land on the start page, then click into the Network (pairing) mode so
// useProData fires and the 3D scene mounts.
await page.click('[data-mode="pairing"]');
await page.waitForSelector('canvas', { timeout: 30000 });
// Wait for graph load + Three.js scene to populate.
await page.waitForFunction(() => !!window.__proDataGraph, { timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOT_DIR}/v3-classify-network-overview.png`, fullPage: false });
console.log('[audit] saved overview screenshot');

// Inspect the graph directly via window.__proDataGraph (exposed for audits).
// If absent, we report so the chef knows the visual screenshots are the only
// signal — no silent fallback to a fragile canvas-pixel sampler.
const audit = await page.evaluate(({ names }) => {
  const graph = window.__proDataGraph;
  if (!graph?.nodes?.get) {
    return { source: null, results: [], error: 'window.__proDataGraph not exposed' };
  }
  const results = [];
  for (const n of names) {
    const node = graph.nodes.get(n);
    results.push({
      name: n,
      found: !!node,
      clusterId: node?.clusterId ?? null,
      clusterColor: node?.clusterColor ?? null,
      clusterLabel: node?.clusterLabel ?? null,
      primaryTier1: node?.primaryTier1Aroma ?? null,
      taste: node?.taste ?? null,
    });
  }
  return { source: 'graph', results };
}, { names: NEW_ITEMS.map((r) => r[0]) });

console.log(`\n[audit] data source: ${audit.source || 'NONE (no window hook)'}`);
if (audit.error) console.log(`[audit] note: ${audit.error}`);

if (audit.results.length) {
  console.log('\n[audit] per-ingredient verification:');
  console.log(`${'name'.padEnd(22)} ${'expected'.padEnd(8)} ${'got_cid'.padEnd(8)} ${'got_color'.padEnd(10)} ${'verdict'}`);
  console.log('-'.repeat(70));
  let pass = 0;
  let fail = 0;
  for (const r of audit.results) {
    const expectedCid = NEW_ITEMS.find((x) => x[0] === r.name)?.[1];
    const expectedColor = V3_CLUSTER_HEX[expectedCid] || '?';
    const ok = r.clusterId === expectedCid && r.clusterColor?.toLowerCase() === expectedColor.toLowerCase();
    if (ok) pass++; else fail++;
    const verdict = ok ? 'PASS' : (r.found ? `FAIL (got cid=${r.clusterId} color=${r.clusterColor})` : 'NOT FOUND');
    console.log(`${r.name.padEnd(22)} ${String(expectedCid).padEnd(8)} ${String(r.clusterId).padEnd(8)} ${(r.clusterColor || '-').padEnd(10)} ${verdict}`);
  }
  console.log(`\n[audit] ${pass}/${pass + fail} passed`);
} else {
  console.log('[audit] could not inspect graph — taking visual screenshot only');
}

// Try to navigate to a specific ingredient via the search bar and screenshot
// it so the chef can see what one of the new nodes looks like rendered.
try {
  const searchInput = await page.$('input[placeholder*="search" i], input[type="search"]');
  if (searchInput) {
    await searchInput.click();
    await searchInput.fill('pernod');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/v3-classify-pernod-search.png` });
    console.log('[audit] saved pernod-search screenshot');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOT_DIR}/v3-classify-pernod-selected.png` });
    console.log('[audit] saved pernod-selected screenshot');
  } else {
    console.log('[audit] no search input found');
  }
} catch (e) {
  console.log(`[audit] search probe failed: ${e.message}`);
}

// ─── Global cluster-distribution audit ───────────────────────────
const globalAudit = await page.evaluate(({ palette }) => {
  const graph = window.__proDataGraph;
  if (!graph?.nodes) return null;
  const counts = {};
  const grayHex = '#5a5a6b'.toLowerCase();
  let total = 0;
  let gray = 0;
  let nullId = 0;
  let hasPos = 0;
  let noPos = 0;
  for (const [, node] of graph.nodes) {
    total++;
    const c = (node.clusterColor || '').toLowerCase();
    if (c === grayHex) gray++;
    const id = node.clusterId;
    if (id === null || id === undefined || id < 0) nullId++;
    counts[id] = (counts[id] || 0) + 1;
    if (node.position && Number.isFinite(node.position.x)) hasPos++; else noPos++;
  }
  return { total, gray, nullId, hasPos, noPos, counts, palette };
}, { palette: V3_CLUSTER_HEX });

if (globalAudit) {
  console.log('\n[audit] global node distribution:');
  console.log(`  total nodes in graph: ${globalAudit.total}`);
  console.log(`  with valid position:  ${globalAudit.hasPos}`);
  console.log(`  without position:     ${globalAudit.noPos}`);
  console.log(`  gray-fallback color:  ${globalAudit.gray}`);
  console.log(`  null/negative cluster id: ${globalAudit.nullId}`);
  console.log('\n  per-cluster node counts:');
  const keys = Object.keys(globalAudit.counts).sort((a, b) => {
    if (a === 'null' || a === 'undefined') return 1;
    if (b === 'null' || b === 'undefined') return -1;
    return Number(a) - Number(b);
  });
  for (const k of keys) {
    const c = globalAudit.counts[k];
    const hex = (k !== 'null' && k !== 'undefined' && Number(k) >= 0)
      ? V3_CLUSTER_HEX[Number(k) % V3_CLUSTER_HEX.length]
      : '(gray fallback)';
    console.log(`    cluster ${k}: ${c} nodes  color=${hex}`);
  }
}

if (consoleErrors.length) {
  console.log('\n[audit] CONSOLE ERRORS:');
  for (const e of consoleErrors) console.log(`  ${e}`);
}

await browser.close();
console.log('\n[audit] done');
