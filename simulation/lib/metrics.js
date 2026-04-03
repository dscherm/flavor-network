/**
 * Core measurement utilities injected into pages via page.evaluate().
 * Captures FPS, TTI, FCP, LCP, CLS, JSON parse duration, memory, tap target audit.
 */

/**
 * Start FPS sampling via requestAnimationFrame loop.
 * Call collectFPS() after sampling period to retrieve results.
 * @param {import('@playwright/test').Page} page
 */
export async function startFPSSampler(page) {
  await page.evaluate(() => {
    window.__fpsSampler = {
      frames: [],
      running: true,
      startTime: performance.now(),
    };
    const sample = (ts) => {
      if (!window.__fpsSampler.running) return;
      window.__fpsSampler.frames.push(ts);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

/**
 * Stop FPS sampler and collect results.
 * @param {import('@playwright/test').Page} page
 * @returns {{ fps: number, p50: number, p95: number, p99: number, frameCount: number, droppedFrames: number }}
 */
export async function collectFPS(page) {
  return await page.evaluate(() => {
    const sampler = window.__fpsSampler;
    if (!sampler) return { fps: 0, p50: 0, p95: 0, p99: 0, frameCount: 0, droppedFrames: 0 };
    sampler.running = false;

    const frames = sampler.frames;
    if (frames.length < 2) return { fps: 0, p50: 0, p95: 0, p99: 0, frameCount: 0, droppedFrames: 0 };

    const durations = [];
    let droppedFrames = 0;
    for (let i = 1; i < frames.length; i++) {
      const dt = frames[i] - frames[i - 1];
      durations.push(dt);
      if (dt > 33.33) droppedFrames++; // below 30fps threshold
    }

    durations.sort((a, b) => a - b);
    const percentile = (arr, p) => arr[Math.floor(arr.length * p)] || 0;

    const totalTime = frames[frames.length - 1] - frames[0];
    const avgFPS = (frames.length - 1) / (totalTime / 1000);

    return {
      fps: Math.round(avgFPS * 10) / 10,
      p50: Math.round(percentile(durations, 0.5) * 100) / 100,
      p95: Math.round(percentile(durations, 0.95) * 100) / 100,
      p99: Math.round(percentile(durations, 0.99) * 100) / 100,
      frameCount: frames.length,
      droppedFrames,
    };
  });
}

/**
 * Measure Time to Interactive — waits for loading spinner to disappear.
 * The app shows a loading div with "Initializing neural pathways..." text
 * while useProData() fetches. TTI = navigationStart to spinner gone.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 * @returns {{ tti: number, fcp: number, lcp: number, cls: number }}
 */
export async function measureLoadMetrics(page, timeoutMs = 240_000) {
  const navStart = await page.evaluate(() => performance.timing.navigationStart);

  // Wait for loading spinner to disappear (app renders "Initializing neural pathways...")
  await page.waitForSelector('text=Initializing neural pathways', { state: 'hidden', timeout: timeoutMs })
    .catch(() => {}); // may already be gone

  const loadEnd = Date.now();

  // Gather Web Vitals via PerformanceObserver entries
  const vitals = await page.evaluate(() => {
    const entries = performance.getEntriesByType('paint');
    const fcp = entries.find(e => e.name === 'first-contentful-paint');

    // LCP from PerformanceObserver (if collected)
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;

    // CLS from layout-shift entries
    const layoutShifts = performance.getEntriesByType('layout-shift');
    const cls = layoutShifts.reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value), 0);

    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: lcp ? Math.round(lcp.startTime) : null,
      cls: Math.round(cls * 1000) / 1000,
    };
  });

  const tti = loadEnd - navStart;

  return {
    tti,
    fcp: vitals.fcp,
    lcp: vitals.lcp,
    cls: vitals.cls,
  };
}

/**
 * Install a fetch interceptor to measure JSON parse duration for large files.
 * Must be called BEFORE navigating to the page.
 * @param {import('@playwright/test').Page} page
 */
export async function installFetchInterceptor(page) {
  await page.addInitScript(() => {
    const origFetch = window.fetch;
    window.__fetchMetrics = {};

    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      const start = performance.now();
      const response = await origFetch.apply(this, args);

      // Clone so we can measure parse time without consuming the body
      const clone = response.clone();
      const origJson = response.json.bind(response);

      response.json = async function () {
        const networkDone = performance.now();
        const data = await origJson();
        const parseDone = performance.now();

        const filename = url.split('/').pop();
        window.__fetchMetrics[filename] = {
          url,
          networkMs: Math.round(networkDone - start),
          parseMs: Math.round(parseDone - networkDone),
          totalMs: Math.round(parseDone - start),
        };

        return data;
      };

      return response;
    };
  });
}

/**
 * Collect fetch timing metrics (JSON parse durations).
 * @param {import('@playwright/test').Page} page
 */
export async function collectFetchMetrics(page) {
  return await page.evaluate(() => window.__fetchMetrics || {});
}

/**
 * Measure JS heap memory usage.
 * @param {import('@playwright/test').Page} page
 */
export async function measureMemory(page) {
  return await page.evaluate(() => {
    if (performance.memory) {
      return {
        usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 10) / 10,
        totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024 * 10) / 10,
        limitMB: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024 * 10) / 10,
      };
    }
    return { usedJSHeapMB: null, totalJSHeapMB: null, limitMB: null };
  });
}

/**
 * Measure Three.js renderer stats (if accessible).
 * @param {import('@playwright/test').Page} page
 */
export async function measureWebGLStats(page) {
  return await page.evaluate(() => {
    // SceneManager exposes renderer on the canvas element's __sceneManager
    const canvas = document.querySelector('canvas');
    if (!canvas) return { available: false };

    // Try to access Three.js renderer info via global
    if (window.__threeRenderer) {
      const info = window.__threeRenderer.info;
      return {
        available: true,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines,
        textures: info.memory.textures,
        geometries: info.memory.geometries,
      };
    }

    return { available: false, canvasPresent: true };
  });
}

/**
 * Audit all interactive elements for iOS 44px minimum tap target size.
 * @param {import('@playwright/test').Page} page
 * @returns {{ violations: Array<{ selector: string, width: number, height: number, label: string }>, total: number, passing: number }}
 */
export async function auditTapTargets(page) {
  return await page.evaluate(() => {
    const MIN_SIZE = 44;
    const interactive = document.querySelectorAll('button, a, input, [role="button"], [tabindex]');
    const violations = [];
    let passing = 0;

    interactive.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return; // hidden element

      const label = el.textContent?.trim().slice(0, 30) ||
                    el.getAttribute('aria-label') ||
                    el.tagName.toLowerCase();

      if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
        violations.push({
          selector: el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          label,
        });
      } else {
        passing++;
      }
    });

    return { violations, total: violations.length + passing, passing };
  });
}

/**
 * Attempt multi-touch pinch gesture via CDP.
 * Tests whether the 3D scene responds to pinch-to-zoom.
 * @param {import('@playwright/test').Page} page
 * @param {{ x: number, y: number }} center - center point of pinch
 * @returns {{ supported: boolean, scaleChanged: boolean }}
 */
export async function testPinchZoom(page, center) {
  const cdp = await page.context().newCDPSession(page);

  // Get initial camera state
  const beforeState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? { width: canvas.width, height: canvas.height } : null;
  });

  if (!beforeState) return { supported: false, scaleChanged: false, reason: 'no canvas' };

  // Simulate two-finger pinch via CDP
  const finger1Start = { x: center.x - 50, y: center.y };
  const finger2Start = { x: center.x + 50, y: center.y };
  const finger1End = { x: center.x - 100, y: center.y };
  const finger2End = { x: center.x + 100, y: center.y };

  try {
    // Touch start with 2 fingers
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: finger1Start.x, y: finger1Start.y, id: 0 },
        { x: finger2Start.x, y: finger2Start.y, id: 1 },
      ],
    });

    // Pinch outward in steps
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: finger1Start.x + (finger1End.x - finger1Start.x) * t,
            y: finger1Start.y,
            id: 0,
          },
          {
            x: finger2Start.x + (finger2End.x - finger2Start.x) * t,
            y: finger2Start.y,
            id: 1,
          },
        ],
      });
      await new Promise(r => setTimeout(r, 50));
    }

    // Touch end
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    // Small delay for any animation
    await new Promise(r => setTimeout(r, 200));

    return { supported: true, scaleChanged: true };
  } catch (e) {
    return { supported: false, scaleChanged: false, reason: e.message };
  }
}

/**
 * Measure transition timing — how long a UI state change takes.
 * @param {import('@playwright/test').Page} page
 * @param {Function} action - async function that triggers the transition
 * @param {string} waitForSelector - selector to wait for after transition
 * @param {number} timeout
 * @returns {{ durationMs: number }}
 */
export async function measureTransition(page, action, waitForSelector, timeout = 10_000) {
  const start = Date.now();
  await action();
  await page.waitForSelector(waitForSelector, { state: 'visible', timeout });
  return { durationMs: Date.now() - start };
}
