// Visual QA — confirm the §4.2 intra-cluster edge exception renders
// when cluster-focus engages, and disappears on exit.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.QA_URL || 'http://localhost:5173/';
const OUT = '.playwright-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.addInitScript(() => {
  try {
    localStorage.setItem('flavor-tour-complete', '1');
    localStorage.setItem('flavor-landing-seen', '1');
  } catch {}
});

console.log('loading', URL);
await page.goto(URL, { waitUntil: 'networkidle' });
const networkTab = await page.$('[data-mode="pairing"]');
if (networkTab) await networkTab.click();
await page.waitForSelector('canvas');
await page.waitForFunction(() => !!window.__proDataGraph, { timeout: 30000 });
await page.waitForTimeout(3500);

try {
  const gotIt = await page.$('button:has-text("Got it")');
  if (gotIt) { await gotIt.click(); await page.waitForTimeout(800); }
} catch {}

await page.screenshot({ path: `${OUT}/intra-edges-01-baseline.png` });
console.log('saved intra-edges-01-baseline.png');

// Engage cluster-focus via a joystick pill (skip first couple for variety).
const pills = await page.$$('[data-cluster-id]');
console.log(`joystick pills found: ${pills.length}`);
if (pills.length === 0) {
  console.log('ERROR: no cluster pills');
  await browser.close();
  process.exit(1);
}
const targetIdx = Math.min(3, pills.length - 1);
const cid = await pills[targetIdx].getAttribute('data-cluster-id');
console.log(`tapping pill #${targetIdx} (clusterId=${cid})`);
await pills[targetIdx].click();

// Wait for spread (600ms) + camera fly (1200ms) + a buffer.
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/intra-edges-02-focused.png` });
console.log('saved intra-edges-02-focused.png');

// Exit via re-tap.
const samePill = await page.$(`[data-cluster-id="${cid}"]`);
if (samePill) {
  await samePill.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/intra-edges-03-exit.png` });
  console.log('saved intra-edges-03-exit.png');
}

console.log(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log('  -', e);
await browser.close();
