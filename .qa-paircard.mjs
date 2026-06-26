import { chromium } from 'playwright';
const URL = process.env.QA_URL || 'http://localhost:5174/?af_debug=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__qaSetTab === 'function', { timeout: 60000 });
  await page.evaluate(() => window.__qaSetTab('pairing'));
  await page.waitForSelector('[data-testid="pairing-lab"]', { timeout: 90000 });
  await page.waitForTimeout(4000);
  // find the canvas, long-press its center (the focus oval) → focus card
  const canvas = await page.$('[data-testid="pairing-lab"] canvas');
  const box = await canvas.boundingBox();
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(650); // exceed HOLD_MS (420)
  await page.mouse.up();
  await page.waitForTimeout(500);
  const overlay = await page.$('[data-testid="pairing-card-overlay"]');
  console.log('CARD_OVERLAY_PRESENT', !!overlay);
  await page.screenshot({ path: '.playwright-shots/pairing-focus-card.png' });
  console.log('QA_OK');
} catch (e) { console.log('QA_FAIL:', e.message); }
finally { await browser.close(); }
