// Mobile walkthrough — visits every mode at iPhone 14 viewport and
// dumps screenshots so we can eyeball issues that the assertion-based
// audit might miss (cramped layouts, overflowing labels, etc.).
//
// Run: node scripts/qa-mobile-walkthrough.mjs

import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const HOST = process.env.QA_HOST || 'https://neuralflavor.web.app';
const OUT_DIR = '.playwright-shots/mobile-walkthrough';
mkdirSync(OUT_DIR, { recursive: true });

const log = (m) => console.log(`[mw] ${m}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  ...devices['iPhone 14'],
  // 390x844 logical resolution (iPhone 14 portrait)
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

log('seed localStorage');
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
  await page.waitForTimeout(2500);
}

async function shot(name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: false });
  log(`  captured ${name}`);
}

async function nav(tab) {
  await page.evaluate((t) => window.__qaSetTab?.(t), tab);
  await page.waitForTimeout(2500);
}

log('§A landing → network mode');
await shot('00-landing-network');

log('§B network: select an ingredient via search');
await page.evaluate(() => window.__qaSelect?.('basil'));
await page.waitForTimeout(2500);
await shot('01-network-basil-selected');

log('§C network: multi-select');
await page.evaluate(() => window.__qaSelect?.('tomato'));
await page.waitForTimeout(2500);
await shot('02-network-multi-select');

log('§D network: engage α-mode');
await page.evaluate(() => window.__qaEngageAffinity?.(['basil', 'tomato']));
await page.waitForTimeout(3500);
await shot('03-alpha-mode');

log('§E clear + visit cookbook');
await page.evaluate(() => window.__qaClearSelection?.());
await nav('cookbook');
await shot('04-cookbook');

log('§F visit sauce');
await nav('sauce');
await shot('05-sauce');

log('§G visit cocktail');
await nav('cocktail');
await shot('06-cocktail');

log('§H visit make');
await nav('make');
await shot('07-make');

log('§I visit guided');
await nav('guided');
await shot('08-guided');

log('§J back to network — verify reset');
await nav('network');
await shot('09-back-to-network');

await ctx.close();
await browser.close();
log(`done — see ${OUT_DIR}/`);
