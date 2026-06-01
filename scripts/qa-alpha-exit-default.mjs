// Verify α-mode → Network default-state transition is correct after the
// 2026-05-31 fix. ESC from α-mode must full-reset, and "None" pill must
// toggle particles on while keeping the active filter's palette.
import { chromium } from 'playwright';

const HOST = process.env.QA_HOST || 'https://neuralflavor.web.app';
const log = (m) => console.log(`[α-exit] ${m}`);
const fails = [];
const ok = (label, cond) => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails.push(label);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then(c => c.newPage());
page.on('pageerror', (e) => console.log(`[browser:error] ${e.message}`));

log('seed localStorage + open with af_debug');
await page.goto(`${HOST}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.evaluate(() => {
  try {
    localStorage.setItem('flavor-tour-complete', 'true');
    localStorage.setItem('fn-training-trace-seen', '1');
  } catch {}
});
await page.goto(`${HOST}/?path=explore&af_debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
const pairingTile = page.locator('button[data-mode="pairing"]');
if (await pairingTile.isVisible({ timeout: 3000 }).catch(() => false)) {
  await pairingTile.click({ force: true });
  await pairingTile.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
}
await page.waitForTimeout(3000);

log('§A select two ingredients + engage α-mode');
await page.evaluate(() => window.__qaSelect?.('basil'));
await page.waitForTimeout(500);
await page.evaluate(() => window.__qaSelect?.('tomato'));
await page.waitForTimeout(500);
await page.evaluate(() => window.__qaEngageAffinity?.(['basil', 'tomato']));
await page.waitForTimeout(3000);

const alphaState = await page.evaluate(() => ({
  selection: window.__qaReadSelection?.()?.selectedNodes ?? null,
  affEngaged: !!window.__af?._engaged,
}));
ok('two ingredients selected', alphaState.selection?.length === 2);
ok('α-mode engaged', alphaState.affEngaged);

log('§B press ESC to exit α-mode → should land in DEFAULT Network state');
await page.keyboard.press('Escape');
await page.waitForTimeout(2500);

const postEsc = await page.evaluate(() => {
  const sel = window.__qaReadSelection?.();
  const aff = window.__af;
  // Read filter pill row to check Flavor Graph is active.
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const flavorPill = pills.find(b => /Flavor Graph/i.test(b.textContent || ''));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  return {
    selection: sel?.selectedNodes ?? null,
    affEngaged: !!aff?._engaged,
    flavorPillActive: flavorPill?.getAttribute('aria-checked') === 'true',
    nonePillActive: nonePill?.getAttribute('aria-checked') === 'true',
  };
});
ok('selection cleared', postEsc.selection?.length === 0);
ok('α-mode NOT engaged', !postEsc.affEngaged);
ok('Flavor Graph pill active', postEsc.flavorPillActive === true);
ok('None pill NOT active (no particles override)', postEsc.nonePillActive === false);

log('§C click "None" pill → particles override engages, palette persists');
await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  nonePill?.click();
});
await page.waitForTimeout(1500);

const postNoneClick = await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const flavorPill = pills.find(b => /Flavor Graph/i.test(b.textContent || ''));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  return {
    flavorPillActive: flavorPill?.getAttribute('aria-checked') === 'true',
    nonePillActive: nonePill?.getAttribute('aria-checked') === 'true',
  };
});
ok('None pill now active', postNoneClick.nonePillActive === true);
ok('Flavor Graph STILL active (filter not cleared)', postNoneClick.flavorPillActive === true);

log('§D click None again → toggles off');
await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  nonePill?.click();
});
await page.waitForTimeout(1000);

const postNoneOff = await page.evaluate(() => {
  const pills = Array.from(document.querySelectorAll('button[role="checkbox"]'));
  const nonePill = pills.find(b => /^None$/i.test((b.textContent || '').trim()));
  return nonePill?.getAttribute('aria-checked') === 'true';
});
ok('None pill toggled off', postNoneOff === false);

await browser.close();
if (fails.length) {
  console.log(`\nFAIL: ${fails.length} check(s) failed:`);
  fails.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
