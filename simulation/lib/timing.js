/**
 * Human-like timing utilities using Gaussian-jittered delays.
 * Simulates realistic user behavior for each persona's speed.
 */

/**
 * Box-Muller transform for Gaussian random numbers.
 */
function gaussianRandom(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, mean + z * stdDev); // clamp to non-negative
}

/**
 * Wait a human-like duration.
 */
export function humanDelay(meanMs, stdDevMs = meanMs * 0.25) {
  const ms = Math.round(gaussianRandom(meanMs, stdDevMs));
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Persona-specific timing profiles.
 */
export const personas = {
  chef: {
    typingDelay: { mean: 80, std: 20 },    // fast power user
    readingPause: { mean: 1200, std: 300 }, // scans quickly
    tapPause: { mean: 500, std: 150 },      // decisive taps
    swipeDuration: 250,
  },
  homeCook: {
    typingDelay: { mean: 150, std: 40 },    // moderate speed
    readingPause: { mean: 2500, std: 600 }, // reads content
    tapPause: { mean: 800, std: 200 },      // deliberate
    swipeDuration: 350,
  },
  curiousBrowser: {
    typingDelay: { mean: 200, std: 60 },    // slow/exploring
    readingPause: { mean: 3000, std: 800 }, // reads everything
    tapPause: { mean: 1000, std: 300 },     // hesitant
    swipeDuration: 400,
  },
  cocktailBuilder: {
    typingDelay: { mean: 100, std: 30 },    // knows what they want
    readingPause: { mean: 1500, std: 400 }, // moderate reading
    tapPause: { mean: 600, std: 150 },      // goal-oriented
    swipeDuration: 280,
  },
};

/**
 * Type text character by character with human-like timing.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector - CSS selector for the input
 * @param {string} text - Text to type
 * @param {object} timing - { mean, std } for per-character delay
 */
export async function humanType(page, selector, text, timing) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await humanDelay(timing.mean, timing.std);
  }
}

/**
 * Simulate a touch drag gesture (for BottomSheet / SuggestionDrawer).
 * @param {import('@playwright/test').Page} page
 * @param {object} from - { x, y } start point
 * @param {object} to - { x, y } end point
 * @param {number} durationMs - total drag time
 */
export async function touchDrag(page, from, to, durationMs = 300) {
  const steps = Math.ceil(durationMs / 16); // ~60fps touch events
  await page.touchscreen.tap(from.x, from.y);

  // Dispatch touchstart
  await page.evaluate(({ fx, fy }) => {
    const el = document.elementFromPoint(fx, fy);
    if (el) {
      el.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true,
        touches: [new Touch({ identifier: 1, target: el, clientX: fx, clientY: fy })],
      }));
    }
  }, { fx: from.x, fy: from.y });

  // Interpolate touchmove events
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    await page.evaluate(({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      if (el) {
        el.dispatchEvent(new TouchEvent('touchmove', {
          bubbles: true,
          touches: [new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy })],
        }));
      }
    }, { cx: x, cy: y });
    await new Promise(r => setTimeout(r, 16));
  }

  // Dispatch touchend
  await page.evaluate(({ tx, ty }) => {
    const el = document.elementFromPoint(tx, ty);
    if (el) {
      el.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true,
        changedTouches: [new Touch({ identifier: 1, target: el, clientX: tx, clientY: ty })],
      }));
    }
  }, { tx: to.x, ty: to.y });
}
