import { chromium } from 'playwright';
const URL = process.env.QA_URL || 'http://localhost:5174/?af_debug=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500); // landing renders (no data needed)
  await page.screenshot({ path: '.playwright-shots/landing-labs.png' });
  // open the labs panel
  await page.waitForFunction(() => typeof window.__qaSetTab === 'function', { timeout: 60000 });
  await page.evaluate(() => window.__qaSetTab('labs'));
  await page.waitForSelector('[data-testid="labs-panel"]', { timeout: 90000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '.playwright-shots/labs-panel.png' });
  const cards = await page.$$eval('[data-testid^="labs-card-"]', (els) => els.map((e) => e.getAttribute('data-testid')));
  console.log('LAB_CARDS', JSON.stringify(cards));
  console.log('QA_OK');
} catch (e) { console.log('QA_FAIL:', e.message); }
finally { await browser.close(); }
