/**
 * Headless probe: load the live build with ?cameraAnim=v1, sample
 * camera.position over time, report whether the cluster tour is
 * actually moving the camera.
 *
 * Usage: node scripts/probe-camera-anim.mjs [url]
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://neuralflavor.web.app/?cameraAnim=v1';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Forward browser console to terminal so we see any errors.
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('CameraAnim') || text.includes('AffinityMode') || msg.type() === 'error') {
      console.log(`[browser:${msg.type()}]`, text);
    }
  });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  console.log(`Loading ${URL}…`);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // let the scene mount + cluster data load

  // Try to enter Network view by clicking the start-page card if visible.
  const networkCard = await page.locator('button', { hasText: /network|discover/i }).first();
  if (await networkCard.count() > 0) {
    try {
      await networkCard.click({ timeout: 2000 });
      console.log('Clicked Network/Discover entry');
    } catch { /* maybe already in app */ }
  }
  await page.waitForTimeout(2000);

  // Sample camera position via THREE scene introspection. The renderer
  // is buried inside React; we walk the scene from the canvas.
  async function sample() {
    return await page.evaluate(() => {
      // Heuristic: find the canvas, then walk window for SceneManager / scene refs.
      // Most reliable: hook through window.__three or scene refs if exposed.
      // Fall back: use any global state SceneManager exposed.
      const out = { found: false };
      // SceneManager exposes window.fn for adaptive-quality introspection.
      // If we can find a renderer's domElement we know the scene exists.
      const canvases = document.querySelectorAll('canvas');
      out.canvasCount = canvases.length;
      // Try to get THREE camera position via a hack: walk React tree?
      // Easier — many three apps stash on window. Check common globals.
      if (window.fn) out.fn = { ...window.fn };
      // Custom: if we exposed a debug hook, grab it.
      if (window.__cameraAnimDebug) out.debug = { ...window.__cameraAnimDebug };
      return out;
    });
  }

  const samples = [];
  for (let i = 0; i < 8; i++) {
    const s = await sample();
    samples.push({ t: i, ...s });
    await page.waitForTimeout(1000);
  }

  console.log('\n=== Samples ===');
  for (const s of samples) console.log(JSON.stringify(s));

  // Save a screenshot for visual confirmation.
  await page.screenshot({ path: '/tmp/camera-probe-final.png', fullPage: false });
  console.log('\nScreenshot saved to /tmp/camera-probe-final.png');

  await browser.close();
})();
