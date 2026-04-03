/**
 * Network throttling profiles via Chrome DevTools Protocol.
 * Applied per-persona to simulate real cellular conditions.
 */

export const networkProfiles = {
  wifi: {
    label: 'WiFi',
    downloadThroughput: (30 * 1024 * 1024) / 8, // 30 Mbps in bytes/s
    uploadThroughput: (15 * 1024 * 1024) / 8,
    latency: 2,
  },
  lte: {
    label: 'LTE',
    downloadThroughput: (12 * 1024 * 1024) / 8, // 12 Mbps
    uploadThroughput: (5 * 1024 * 1024) / 8,
    latency: 70,
  },
  slow4g: {
    label: 'Slow 4G',
    downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps
    uploadThroughput: (0.75 * 1024 * 1024) / 8,
    latency: 300,
  },
};

/**
 * Apply network throttling to a Playwright page via CDP session.
 * @param {import('@playwright/test').Page} page
 * @param {keyof networkProfiles} profile
 */
export async function applyThrottle(page, profile) {
  const conditions = networkProfiles[profile];
  if (!conditions) throw new Error(`Unknown network profile: ${profile}`);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: conditions.downloadThroughput,
    uploadThroughput: conditions.uploadThroughput,
    latency: conditions.latency,
  });

  return { cdp, conditions };
}

/**
 * Remove network throttling.
 */
export async function clearThrottle(cdp) {
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}
