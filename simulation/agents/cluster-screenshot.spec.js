import { test } from '@playwright/test';

test('capture cluster views', async ({ page }) => {
  test.setTimeout(180_000);

  await page.addInitScript(() => {
    try { localStorage.setItem('fn-start-seen', '1'); } catch {}
    try { localStorage.setItem('flavor-tour-complete', '1'); } catch {}
  });

  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 60_000 });
  // wait for positions to load + scene to render
  await page.waitForTimeout(12_000);

  await page.screenshot({ path: 'simulation/output/cooks-with-3d.png', fullPage: false });

  // Switch to Cooks With · 2D
  const ml2dBtn = page.locator('button:has-text("Cooks With · 2D")');
  await ml2dBtn.click();
  await page.waitForTimeout(4_000);
  await page.screenshot({ path: 'simulation/output/cooks-with-2d.png', fullPage: false });

  // Switch to Tastes Like · 3D
  const neuralBtn = page.locator('button:has-text("Tastes Like · 3D")');
  await neuralBtn.click();
  await page.waitForTimeout(4_000);
  await page.screenshot({ path: 'simulation/output/tastes-like-3d.png', fullPage: false });

  // Switch to Tastes Like · Wheel
  const taste2dBtn = page.locator('button:has-text("Tastes Like · Wheel")');
  await taste2dBtn.click();
  await page.waitForTimeout(4_000);
  await page.screenshot({ path: 'simulation/output/tastes-like-wheel.png', fullPage: false });
});
