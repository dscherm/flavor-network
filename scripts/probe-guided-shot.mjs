import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('.playwright-shots/guided-alpha', { recursive: true });
const HOST = 'https://neuralflavor.web.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then(c => c.newPage());
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`${HOST}/?path=explore&af_debug=1`, { waitUntil: 'domcontentloaded' });
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await pairingTile.click({ force: true });
  await pairingTile.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
}
await page.waitForTimeout(3000);
await page.evaluate(() => window.__qaSetTab?.('guided'));
await page.waitForTimeout(1500);
await page.evaluate(() => window.__qaGuidedPickIngredient?.('basil'));
await page.waitForTimeout(6000);
await page.screenshot({ path: '.playwright-shots/guided-alpha/01-default-aroma.png', fullPage: false });
console.log('aroma shot saved');
// Switch to taste filter
await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('[data-guided-alpha-view] button'));
  const tasteBtn = pills.find(b => /^Taste$/i.test((b.textContent || '').trim()));
  tasteBtn?.click();
});
await page.waitForTimeout(2500);
await page.screenshot({ path: '.playwright-shots/guided-alpha/02-taste.png', fullPage: false });
console.log('taste shot saved');
await browser.close();
