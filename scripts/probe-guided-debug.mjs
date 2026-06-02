import { chromium } from 'playwright';
const HOST = 'https://neuralflavor.web.app';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ bypassCSP: true });
const page = await ctx.newPage();
page.on('console', (m) => { const t = m.text(); if (t.length < 300) console.log(`[c:${m.type()}] ${t}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
// Force fresh load by adding nonce query
const nonce = Date.now();
await page.goto(`${HOST}/?path=explore&af_debug=1&_t=${nonce}`, { waitUntil: 'domcontentloaded' });
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await pairingTile.click({ force: true });
  await pairingTile.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
}
await page.waitForTimeout(5000);
const helpers = await page.evaluate(() => Object.keys(window).filter(k => /^__qa/.test(k)));
console.log('window helpers:', helpers);
const af = await page.evaluate(() => /[?&]af_debug=1/.test(window.location.search));
console.log('af_debug match:', af);
await browser.close();
