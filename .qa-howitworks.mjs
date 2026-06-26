import { chromium } from 'playwright';
const URL = process.env.QA_URL || 'http://localhost:5174/?af_debug=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__qaSetTab === 'function', { timeout: 60000 });
  await page.evaluate(() => window.__qaSetTab('make'));
  await page.waitForTimeout(3500);
  await page.click('[data-testid="tabbar-howto"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: '.playwright-shots/howitworks-open.png' });
  // scroll the dialog's own scroll container to the bottom → reveal teaser
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="howitworks-overlay"] .overflow-y-auto');
    if (card) card.scrollTop = card.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.playwright-shots/howitworks-teaser.png' });
  console.log('QA_OK');
} catch (e) { console.log('QA_FAIL:', e.message); }
finally { await browser.close(); }
