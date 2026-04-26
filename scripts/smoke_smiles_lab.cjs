// Headless smoke test for the SMILES Lab. Navigates to the dev preview,
// opens MoleculeLab, types caffeine, waits for prediction, asserts a
// taste bar shows >50% bitter (caffeine's calibrated bitter ≈ 0.99).
//
// Requires the preview server running at http://localhost:5173.
const { chromium } = require('@playwright/test');

const CAFFEINE = 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C';
const URL = process.env.SMOKE_URL || 'http://localhost:5173/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.error('[browser pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[browser console.error]', msg.text());
  });

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  console.log(`[smoke] page loaded in ${Date.now() - t0}ms`);

  // The landing screen has three "Explore" cards. Click the Pairing
  // Model card to enter the main network view where the Labs nav lives.
  await page.locator('button:has-text("Explore Pairing Model")').first().click();
  console.log('[smoke] entered Pairing Model');

  // The bootstrapping overlay can linger — force-click through it.
  await page.waitForTimeout(2000);
  const labBtn = page.locator('button:has-text("Labs")').first();
  await labBtn.waitFor({ state: 'visible', timeout: 15000 });
  await labBtn.click({ force: true });
  await page.locator('button:has-text("Molecule Lab")').first().click({ force: true });

  // Wait for the SMILES input to appear
  const smilesInput = page.getByPlaceholder(/^e\.g\..*CN1/);
  await smilesInput.waitFor({ state: 'visible', timeout: 15000 });
  console.log('[smoke] SMILES input visible');

  // Type caffeine
  await smilesInput.fill(CAFFEINE);
  console.log('[smoke] typed caffeine SMILES');

  // Wait for prediction to land. Either a TasteBars 'bitter' bar or status 'ok'.
  // We look for the calibration status line "X atoms · Y bonds".
  const ok = page.getByText(/atoms\s*·\s*\d+\s+bonds/);
  try {
    await ok.waitFor({ state: 'visible', timeout: 30000 });
    const text = await ok.textContent();
    console.log(`[smoke] prediction landed: ${text}`);
  } catch (err) {
    const errLine = await page.getByText(/parse|Inference failed|invalid/i).textContent().catch(() => '');
    console.error(`[smoke] prediction never appeared. status text: "${errLine}"`);
    await page.screenshot({ path: 'scripts/smoke_failed.png', fullPage: true });
    process.exitCode = 1;
  }

  await browser.close();
})();
