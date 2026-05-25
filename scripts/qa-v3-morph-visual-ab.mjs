// Visual A/B sanity-check for the v3-derived morph (shipped in ae27fbd).
//
// For each of 5 layout-driving filter axes (aroma / cuisine / season /
// family / taste) we capture 3 bucket states + 1 axis-only state. Plus
// one canonical baseline before any filter is active.
//
// Outputs:
//   .playwright-shots/v3-morph-ab/<axis>__<bucket>.png  (15 frames)
//   .playwright-shots/v3-morph-ab/<axis>__overview.png  ( 5 axis-only frames)
//   .playwright-shots/v3-morph-ab/_baseline.png          ( 1 no-filter frame)
//   .playwright-shots/v3-morph-ab/index.html             (contact sheet)
//   .playwright-shots/v3-morph-ab/manifest.json          (run metadata)
//
// Usage:
//   1. npm run dev (port 5173)
//   2. node scripts/qa-v3-morph-visual-ab.mjs
//   3. open .playwright-shots/v3-morph-ab/index.html

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.QA_URL || 'http://localhost:5173/';
const OUT_DIR = '.playwright-shots/v3-morph-ab';
mkdirSync(OUT_DIR, { recursive: true });

const log = (msg) => console.log(`[ab] ${msg}`);

// Pick 3 representative buckets per axis (diverse, well-populated).
const AXES = [
  { key: 'aroma',   pill: 'Aroma',   buckets: ['Fruity', 'Green', 'Woody'] },
  { key: 'cuisine', pill: 'Cuisine', buckets: ['European', 'East Asian', 'Americas'] },
  { key: 'season',  pill: 'Season',  buckets: ['Spring', 'Summer', 'Autumn'] },
  { key: 'family',  pill: 'Family',  buckets: ['Protein', 'Vegetable', 'Fruit'] },
  { key: 'taste',   pill: 'Taste',   buckets: ['Sweet', 'Sour', 'Bitter'] },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.addInitScript(() => {
  try {
    localStorage.setItem('flavor-tour-complete', '1');
    localStorage.setItem('flavor-landing-seen', '1');
  } catch {}
});

log(`loading ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle' });

const networkTab = await page.$('[data-mode="pairing"]');
if (networkTab) { await networkTab.click(); log('clicked Network tab'); }
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForFunction(() => !!window.__proDataGraph, { timeout: 30000 });
await page.waitForTimeout(3500);

// Dismiss tour overlay if present.
try {
  const gotIt = await page.$('button:has-text("Got it")');
  if (gotIt) { await gotIt.click(); await page.waitForTimeout(800); log('dismissed tour overlay'); }
} catch {}

const v3BoundingRadius = await page.evaluate(async () => {
  try {
    const res = await fetch('/proDataset/flavor_positions_v3.json');
    if (!res.ok) return null;
    const raw = await res.json();
    const FLAVOR_SPREAD = 3.0;
    let maxR = 0;
    for (const [name, xyz] of Object.entries(raw)) {
      if (name.startsWith('_')) continue;
      if (!Array.isArray(xyz) || xyz.length !== 3) continue;
      const r = Math.sqrt(xyz[0]**2 + xyz[1]**2 + xyz[2]**2) * FLAVOR_SPREAD;
      if (r > maxR) maxR = r;
    }
    return maxR;
  } catch { return null; }
});
log(`v3 bounding radius (FLAVOR_SPREAD=3.0): ${v3BoundingRadius?.toFixed(2) ?? 'n/a'}`);

await page.screenshot({ path: `${OUT_DIR}/_baseline.png` });
log('saved _baseline.png');

const captured = [];

const settleMs = 1400;

async function deactivateAll() {
  await page.evaluate(() => {
    const row = document.querySelector('[role="group"][aria-label="Filter by"]');
    if (!row) return;
    const btn = Array.from(row.querySelectorAll('button')).find(
      (b) => (b.textContent || '').trim() === 'None'
    );
    if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); }
  });
  await page.waitForTimeout(settleMs);
}

async function clickFilterAxisPill(label) {
  // Scope to the filter-pill row (aria-label="Filter by") to avoid hitting
  // unrelated "Cuisine" / "Season" labels elsewhere in the chrome.
  const result = await page.evaluate(({ text }) => {
    const row = document.querySelector('[role="group"][aria-label="Filter by"]');
    if (!row) return { ok: false, reason: 'no-filter-row' };
    const btn = Array.from(row.querySelectorAll('button')).find(
      (b) => (b.textContent || '').trim() === text
    );
    if (!btn) return { ok: false, reason: 'pill-not-found' };
    btn.scrollIntoView({ block: 'center', inline: 'center' });
    btn.click();
    return { ok: true, ariaChecked: btn.getAttribute('aria-checked') };
  }, { text: label });
  if (!result.ok) log(`    axis pill click failed for "${label}": ${result.reason}`);
  return result.ok;
}

async function clickBucketPill(label) {
  // Bucket sub-pills sit in the ClusterJoystick (NOT in the filter row).
  // Search the whole document but EXCLUDE the filter row so we don't
  // re-click the axis pill by accident.
  const result = await page.evaluate(({ text }) => {
    const filterRow = document.querySelector('[role="group"][aria-label="Filter by"]');
    const all = Array.from(document.querySelectorAll('button'));
    const candidates = all.filter((b) => {
      if (filterRow && filterRow.contains(b)) return false;
      const t = (b.textContent || '').trim();
      return t === text;
    });
    if (candidates.length === 0) return { ok: false, reason: 'not-found' };
    const btn = candidates[candidates.length - 1];
    btn.scrollIntoView({ block: 'center', inline: 'center' });
    btn.click();
    return { ok: true, count: candidates.length };
  }, { text: label });
  if (!result.ok) log(`    bucket click failed for "${label}": ${result.reason}`);
  return result.ok;
}

for (const axis of AXES) {
  log(`=== axis: ${axis.key} ===`);

  try {
    const axisClicked = await clickFilterAxisPill(axis.pill);
    if (!axisClicked) { log(`  ! axis pill click failed; skipping`); continue; }
    await page.waitForTimeout(settleMs);

    await page.screenshot({ path: `${OUT_DIR}/${axis.key}__overview.png` });
    captured.push({ axis: axis.key, bucket: null, file: `${axis.key}__overview.png` });
    log(`  saved ${axis.key}__overview.png`);

    for (const bucket of axis.buckets) {
      const ok = await clickBucketPill(bucket);
      const slug = bucket.toLowerCase().replace(/\s+/g, '-');
      const path = `${OUT_DIR}/${axis.key}__${slug}.png`;
      if (!ok) {
        log(`  ! bucket "${bucket}" not clickable — saving current view anyway`);
        await page.screenshot({ path });
        captured.push({ axis: axis.key, bucket, file: `${axis.key}__${slug}.png`, missing: true });
        continue;
      }
      await page.waitForTimeout(settleMs);
      await page.screenshot({ path });
      captured.push({ axis: axis.key, bucket, file: `${axis.key}__${slug}.png` });
      log(`  saved ${axis.key}__${slug}.png`);

      await clickBucketPill(bucket);
      await page.waitForTimeout(400);
    }

    await deactivateAll();
  } catch (e) {
    log(`  ✗ axis "${axis.key}" crashed: ${e.message.split('\n')[0]}`);
    await deactivateAll();
  }
}

log(`captured ${captured.length} frames (expected 20: 5 axes × (1 overview + 3 buckets))`);

// Build the HTML contact sheet.
const rowsHtml = AXES.map((axis) => {
  const overview = captured.find((c) => c.axis === axis.key && c.bucket === null);
  const buckets = axis.buckets.map((b) => {
    const cell = captured.find((c) => c.axis === axis.key && c.bucket === b);
    if (!cell) return `<td class="missing">—</td>`;
    const flagged = cell.missing ? ' <span class="warn">[no sub-pill]</span>' : '';
    return `<td>
      <a href="${cell.file}" target="_blank">
        <img src="${cell.file}" alt="${axis.key} ${b}" />
      </a>
      <div class="lbl">${b}${flagged}</div>
    </td>`;
  }).join('');
  const overviewCell = overview
    ? `<td>
        <a href="${overview.file}" target="_blank">
          <img src="${overview.file}" alt="${axis.key} overview" />
        </a>
        <div class="lbl">${axis.pill} axis only</div>
      </td>`
    : `<td class="missing">—</td>`;
  return `<tr>
    <th>${axis.pill}</th>
    ${overviewCell}
    ${buckets}
  </tr>`;
}).join('');

const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>v3-Derived Morph — Visual Sanity-Check</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0f; color: #e5e5e5; padding: 24px; }
  h1 { margin: 0 0 8px; font-weight: 500; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #222; padding: 8px; vertical-align: top; }
  th { text-align: left; width: 100px; background: #14141a; color: #d4d4aa; }
  img { width: 100%; max-width: 380px; display: block; border: 1px solid #333; }
  .lbl { font-size: 12px; margin-top: 6px; color: #aaa; }
  .missing { color: #555; text-align: center; }
  .warn { color: #f59e0b; font-size: 11px; }
  .legend { margin-top: 32px; font-size: 13px; color: #888; line-height: 1.6; }
  .legend code { background: #1a1a22; padding: 1px 5px; border-radius: 3px; color: #d4d4aa; }
  .baseline-box { margin: 16px 0 32px; }
  .baseline-box img { max-width: 600px; }
</style>
</head><body>
<h1>v3-Derived Morph — Visual Sanity-Check</h1>
<div class="meta">
  Generated <code>${new Date().toISOString()}</code> •
  v3 bounding radius: <code>${v3BoundingRadius?.toFixed(2) ?? 'n/a'}</code> •
  legacy synthetic-ring radius was <code>90</code>
</div>

<div class="baseline-box">
  <strong>Baseline (no filter active — canonical v3 layout)</strong>
  <a href="_baseline.png" target="_blank"><img src="_baseline.png" alt="baseline" /></a>
</div>

<table>
  <thead>
    <tr>
      <th>Axis</th>
      <th>Axis-only (all bucket centroids active)</th>
      <th>Bucket 1</th>
      <th>Bucket 2</th>
      <th>Bucket 3</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>

<div class="legend">
  <p><strong>Chef sign-off checklist</strong> — for each cell, ask:</p>
  <ul>
    <li>Does the bucket centroid land in a region of the v3 cloud that <em>chemically</em> makes sense (e.g. <code>sour</code> near citrus + vinegar, <code>fruity</code> near berries + tropical)?</li>
    <li>Do members of the bucket visibly cluster around their centroid (not scattered to random corners)?</li>
    <li>Sparse buckets (synthetic-pole fallback, e.g. <code>salty</code> taste, <code>Spicy</code> aroma) should sit on the v3 bounding-sphere shell at radius ≈ <code>${v3BoundingRadius ? (v3BoundingRadius * 0.65).toFixed(1) : 'n/a'}</code> — clearly OFF the cloud, not inside it.</li>
    <li>No bucket should pull all nodes to a single point (means weighted-average math collapsed).</li>
  </ul>
  <p>Console errors during this run: <code>${consoleErrors.length}</code></p>
</div>

</body></html>`;

writeFileSync(`${OUT_DIR}/index.html`, html);
log(`wrote ${OUT_DIR}/index.html`);

const manifest = {
  url: URL,
  timestamp: new Date().toISOString(),
  v3BoundingRadius,
  axes: AXES.map((a) => a.key),
  framesCaptured: captured.length,
  framesExpected: AXES.length * (1 + 3),
  captured,
  consoleErrors: consoleErrors.slice(0, 50),
};
writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2));
log(`wrote ${OUT_DIR}/manifest.json`);

await browser.close();
log('done');
