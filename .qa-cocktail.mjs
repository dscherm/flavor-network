import { chromium } from 'playwright';
const URL = process.env.QA_URL || 'http://localhost:5174/?af_debug=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__qaSetTab === 'function', { timeout: 60000 });
  await page.evaluate(() => window.__qaSetTab('cocktail'));
  await page.waitForTimeout(6000); // data + lab mount
  await page.screenshot({ path: '.playwright-shots/cocktail-fit.png' });
  // measure: does any shelf SVG overflow the 390px viewport?
  const widths = await page.$$eval('svg[aria-label*="back-bar"]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  console.log('SHELF_WIDTHS', JSON.stringify(widths), 'viewport=390');
  console.log('QA_OK');
} catch (e) { console.log('QA_FAIL:', e.message); try { await page.screenshot({ path: '.playwright-shots/cocktail-fail.png' }); } catch {} }
finally { await browser.close(); }
