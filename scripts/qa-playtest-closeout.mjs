// Playtest walkthrough — screenshots every surface at phone + desktop sizes,
// measures whether scrollable cards are hidden under the fixed tab bar, and
// runs a text-overlap detector on each surface.
// Run: QA_HOST=http://localhost:4179 node playtest.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const HOST = process.env.QA_HOST || 'http://localhost:4179';
const OUT = process.env.QA_OUT || 'D:/Projects/flavor-network/.playwright-shots/playtest';
mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(`[pt] ${m}`);
const findings = [];

const OVERLAP_DETECTOR = `(() => {
  const isText = (el) => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
  const els = [...document.querySelectorAll('body *')].filter(el => {
    if (!isText(el)) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.2) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) return false;
    const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
  }).map(el => ({ el, r: el.getBoundingClientRect(), t: el.textContent.trim().slice(0, 40) }));
  const out = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const x = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
    const y = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
    const inter = x * y; if (inter <= 0) continue;
    const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
    if (inter / small < 0.25) continue;
    // ignore if one is a positioned overlay covering the other (menus, modals) — z-index differs
    const za = getComputedStyle(a.el).zIndex, zb = getComputedStyle(b.el).zIndex;
    out.push({ a: a.t, b: b.t, pct: Math.round(100 * inter / small), y: Math.round(Math.max(a.r.top, b.r.top)), za, zb });
  }
  return out.slice(0, 12);
})()`;

const TABBAR_OVERLAP = `(() => {
  const tab = [...document.querySelectorAll('div,nav')].find(e => getComputedStyle(e).position === 'fixed' && /bottom-0/.test(e.className) && e.getBoundingClientRect().height > 40);
  const tabTop = tab ? tab.getBoundingClientRect().top : innerHeight;
  const scrollers = [...document.querySelectorAll('div')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4 && e.getBoundingClientRect().width > 200);
  return scrollers.map(s => {
    s.scrollTop = s.scrollHeight;
    const r = s.getBoundingClientRect();
    let last = 0; for (const e of s.querySelectorAll('*')) { const rr = e.getBoundingClientRect(); if (rr.height > 0 && rr.bottom > last) last = rr.bottom; }
    return { cls: s.className.toString().slice(0, 50), bottom: Math.round(r.bottom), lastContent: Math.round(last), tabTop: Math.round(tabTop), hiddenPx: Math.round(Math.max(0, Math.min(last, r.bottom) - tabTop)) };
  }).filter(x => x.hiddenPx > 0);
})()`;

async function run(label, ctxOpts, steps) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 120)); });
  await page.goto(`${HOST}/?af_debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => { try { localStorage.setItem('flavor-tour-complete', 'true'); localStorage.setItem('fn-training-trace-seen', '1'); } catch {} });
  await page.goto(`${HOST}/?af_debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${label}-${name}.png` }); log(`${label}: ${name}`); };
  const audit = async (name) => {
    const ov = await page.evaluate(OVERLAP_DETECTOR);
    const tb = await page.evaluate(TABBAR_OVERLAP);
    if (ov.length) findings.push({ ctx: label, surface: name, textOverlaps: ov });
    if (tb.length) findings.push({ ctx: label, surface: name, tabBarHidden: tb });
  };
  try { await steps({ page, shot, audit }); } catch (e) { findings.push({ ctx: label, error: e.message.slice(0, 200) }); }
  if (errors.length) findings.push({ ctx: label, pageErrors: [...new Set(errors)].slice(0, 6) });
  await browser.close();
}

const clickText = async (page, re, { minH = 30 } = {}) => page.evaluate(([src, flags, minH]) => {
  const rx = new RegExp(src, flags);
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const h = document.elementFromPoint(Math.min(innerWidth-1, r.left + r.width/2), Math.min(innerHeight-1, r.top + r.height/2)); return !!h && (h === e || e.contains(h) || h.contains(e)); };
  const cands = [...document.querySelectorAll('button,[role=button],a')].filter(e => rx.test((e.textContent || '').trim()) && e.getBoundingClientRect().height >= minH);
  let el = cands.find(vis);
  if (!el && cands[0]) { cands[0].scrollIntoView({ block: 'center' }); el = cands.find(vis) || cands[0]; }
  if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true;
}, [re.source, re.flags, minH]);

const walk = async ({ page, shot, audit }) => {
  await shot('00-landing'); await audit('landing');
  await page.locator('[data-mode="labs"]').click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500); await shot('01-labs'); await audit('labs');

  const tab = async (t, wait = 3000) => { await page.evaluate((t) => window.__qaSetTab?.(t), t); await page.waitForTimeout(wait); };

  await tab('cocktail'); await shot('10-cocktail-menu'); await audit('cocktail-menu');
  if (await clickText(page, /^Pina Colada/)) { await page.waitForTimeout(1500); await shot('11-cocktail-card'); await audit('cocktail-card'); await shot('11b-cocktail-card-scrolled'); }
  await clickText(page, /^← Back|^Back/);

  await tab('sauce'); await shot('20-sauce-menu'); await audit('sauce-menu');
  const sauceClicked = await clickText(page, /^Romesco|^Raita|^Tahini/);
  if (sauceClicked) { await page.waitForTimeout(1500); await shot('21-sauce-card'); await audit('sauce-card'); await shot('21b-sauce-card-scrolled'); log(`sauce clicked: ${sauceClicked}`); }
  await clickText(page, /^← Back|^Back/);

  await tab('cookbook'); await shot('30-cookbook'); await audit('cookbook');
  const recipeClicked = await clickText(page, /Tikka|Biryani|Risotto|Ragu|Ramen/i, { minH: 60 });
  await page.waitForTimeout(1500); await shot('31-cookbook-recipe'); await audit('cookbook-recipe'); await shot('31b-cookbook-recipe-scrolled'); log(`recipe clicked: ${recipeClicked}`);
  await page.keyboard.press('Escape');

  await tab('pairing'); await shot('40-pairing'); await audit('pairing');
  await tab('recipe'); await shot('50-notebook'); await audit('notebook');
  await tab('make'); await shot('60-make'); await audit('make');
  await tab('profile'); await shot('70-profile'); await audit('profile');
  await page.locator('button[aria-label="How-to"]').click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500); await shot('80-howto'); await audit('howto');
};

await run('phone', { ...devices['iPhone 14'] }, walk);
await run('phoneSE', { ...devices['iPhone SE'] }, walk);
await run('desktop', { viewport: { width: 1280, height: 800 } }, walk);
writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
log(`done — ${findings.length} finding groups → ${OUT}/findings.json`);
