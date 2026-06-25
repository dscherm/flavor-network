// Headless QA screenshot of the Pairing Lab. Uses the app's built-in
// window.__qaSetTab hook to bypass the landing gate. Now feasible because
// PERF-LAZY-NETWORK stopped the always-mounted WebGL view from hanging
// headless chromium.
import { chromium } from 'playwright';

const URL = process.env.QA_URL || 'http://localhost:5173/';
const shot = (n) => `.playwright-shots/${n}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__qaSetTab === 'function', { timeout: 60000 });
  await page.evaluate(() => window.__qaSetTab('pairing'));
  await page.waitForSelector('[data-testid="pairing-lab"]', { timeout: 120000 });
  await page.waitForTimeout(3500); // data + canvas settle

  await page.screenshot({ path: shot('pairing-affinity.png') });
  const insightA = await page.$eval('[data-testid="lens-insight"]', (el) => el.textContent).catch(() => '(none)');
  console.log('AFFINITY INSIGHT:', insightA);

  const aroma = await page.$('[data-testid="lens-aroma"]');
  if (aroma) {
    await aroma.click();
    await page.waitForTimeout(1400); // lens-twist tween
    await page.screenshot({ path: shot('pairing-aroma.png') });
    const insightAroma = await page.$eval('[data-testid="lens-insight"]', (el) => el.textContent).catch(() => '(none)');
    console.log('AROMA INSIGHT:', insightAroma);
  }

  const season = await page.$('[data-testid="lens-season"]');
  if (season) {
    await season.click();
    await page.waitForTimeout(1400);
    await page.screenshot({ path: shot('pairing-season.png') });
  }

  console.log('QA_OK');
} catch (e) {
  console.log('QA_FAIL:', e.message);
  try { await page.screenshot({ path: shot('pairing-fail.png') }); } catch { /* */ }
} finally {
  console.log('--- console (last 25) ---');
  console.log(logs.slice(-25).join('\n'));
  await browser.close();
}
