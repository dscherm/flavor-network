// Contact sheet for MAKE-BUILD-DEPRECATE (2026-05-29).
// Captures the live landing page at desktop + mobile viewports so the
// chef-user can confirm the 3-tile layout is balanced after the Build
// tile removal. The 4-tile baseline is preserved at .playwright-shots/
// landing-{desktop,mobile}.png (captured pre-deprecate).
//
// Usage:
//   node scripts/qa-build-deprecate-landing.mjs
//   open .playwright-shots/landing-build-deprecate-ab/index.html

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

const URL = process.env.QA_URL || 'https://neuralflavor.web.app';
const OUT_DIR = '.playwright-shots/landing-build-deprecate-ab';
mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { key: 'desktop', width: 1440, height: 900 },
  { key: 'mobile',  width: 390,  height: 844 },
];

const browser = await chromium.launch();

for (const v of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
  const page = await ctx.newPage();
  console.log(`[ab] ${v.key} -> ${URL}`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  // Wait for landing tiles to render
  await page.waitForSelector('button[data-mode]', { timeout: 15000 });
  await page.waitForTimeout(500);
  const newPath = `${OUT_DIR}/landing-${v.key}-new.png`;
  await page.screenshot({ path: newPath, fullPage: false });
  console.log(`[ab] wrote ${newPath}`);

  // Copy the pre-deprecate baseline if it exists in the parent dir
  const before = `.playwright-shots/landing-${v.key}.png`;
  if (existsSync(before)) {
    const oldPath = `${OUT_DIR}/landing-${v.key}-old.png`;
    copyFileSync(before, oldPath);
    console.log(`[ab] copied baseline ${before} -> ${oldPath}`);
  }

  await ctx.close();
}

await browser.close();

const html = `<!doctype html>
<meta charset="utf-8">
<title>MAKE-BUILD-DEPRECATE landing A/B</title>
<style>
  body { font: 14px system-ui; margin: 24px; background: #0a0a0f; color: #eee; }
  h1 { font-weight: 500; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
  .col { background: #111; padding: 12px; border-radius: 8px; }
  .col h3 { margin: 0 0 8px; font-weight: 400; color: #aaa; }
  img { max-width: 100%; display: block; border: 1px solid #222; }
  .note { color: #888; font-size: 12px; }
</style>
<h1>MAKE-BUILD-DEPRECATE — landing A/B</h1>
<p class="note">Old = 4-tile (Explore / Guided / Make / Build, pre-2026-05-29). New = 3-tile (Explore / Guided / Make, live now).</p>
${VIEWPORTS.map(v => `
  <h2>${v.key} (${v.width}×${v.height})</h2>
  <div class="row">
    <div class="col"><h3>Old (4 tiles)</h3><img src="landing-${v.key}-old.png"></div>
    <div class="col"><h3>New (3 tiles)</h3><img src="landing-${v.key}-new.png"></div>
  </div>
`).join('')}
`;
writeFileSync(`${OUT_DIR}/index.html`, html);
console.log(`[ab] wrote ${OUT_DIR}/index.html`);
