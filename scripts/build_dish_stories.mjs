#!/usr/bin/env node
/**
 * build_dish_stories.mjs — STORIES-1.
 *
 * Builds public/data/dish_stories.json: a 1–2 sentence background and a
 * freely-licensed lead photo from English Wikipedia / Wikimedia Commons for
 * each Cookbook recipe, sauce, cocktail and wine style. Build-time only —
 * the app never calls Wikipedia; it hotlinks the Commons thumbnails.
 *
 *   node scripts/build_dish_stories.mjs            # build (uses cache)
 *   node scripts/build_dish_stories.mjs --review   # also print the match table
 *
 * Deterministic and re-runnable: every raw API response is cached under
 * .cache/dish-stories/ (gitignored), so a re-run makes no requests. Cache
 * misses are throttled to ~1 request/second with a descriptive User-Agent.
 *
 * Matching (rules in src/data/dishStoryMatch.js, unit-tested on fixtures):
 *   1. scripts/dish_story_overrides.json  (item → title, or null to skip)
 *   2. exact title, then title + qualifier ("(sauce)", "(cocktail)", …)
 *   3. opensearch
 * A page is accepted only if it is not a disambiguation page, reads as food
 * or drink, and its title plausibly names the item.
 *
 * Licences: text is CC BY-SA 4.0 (we keep the article URL to attribute).
 * Photos are kept only when the lead image lives on Commons AND its
 * LicenseShortName is CC0 / public domain / CC BY / CC BY-SA.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  candidateTitles, acceptSummary, namePlausible, cleanName, firstSentences,
  commonsFileFromUrl, isFreeLicense, cleanArtist, stripHtml, fold,
} from '../src/data/dishStoryMatch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache', 'dish-stories');
const OUT = path.join(ROOT, 'public', 'data', 'dish_stories.json');
const OVERRIDES = path.join(ROOT, 'scripts', 'dish_story_overrides.json');
const UA = 'FlavorNetworkDishStories/1.0 (https://neuralflavor.web.app; https://github.com/dscherm/flavor-network) build-time script, ~1 req/s';
const WP = 'https://en.wikipedia.org';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const REVIEW = process.argv.includes('--review');

fs.mkdirSync(CACHE, { recursive: true });

// ── Cached, throttled GET ─────────────────────────────────────────────
let lastAt = 0;
let fetched = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const key = crypto.createHash('sha1').update(url).digest('hex');
  const file = path.join(CACHE, `${key}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')).body;
  for (let attempt = 0; ; attempt++) {
    const wait = lastAt + 1050 - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    fetched++;
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA, Accept: 'application/json' } });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    const body = res.status === 200 ? await res.json() : null;
    // Cache 200s and 404s (both are stable answers); never cache transient errors.
    if (res.status === 200 || res.status === 404) {
      fs.writeFileSync(file, JSON.stringify({ url, status: res.status, body }));
    } else {
      throw new Error(`${res.status} for ${url}`);
    }
    return body;
  }
}

const titleKey = (t) => t.replace(/ /g, '_');
const summaryUrl = (t) => `${WP}/api/rest_v1/page/summary/${encodeURIComponent(titleKey(t))}?redirect=true`;

// Batched existence check (50 titles per request) so we only ask the REST
// summary endpoint about pages that exist.
const existsMemo = new Map();
async function resolveExisting(titles) {
  const todo = [...new Set(titles)].filter((t) => !existsMemo.has(t));
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const url = `${WP}/w/api.php?action=query&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`;
    const j = await getJson(url);
    const norm = new Map((j?.query?.normalized || []).map((n) => [n.from, n.to]));
    const redir = new Map((j?.query?.redirects || []).map((n) => [n.from, n.to]));
    const pages = new Map((j?.query?.pages || []).map((p) => [p.title, p]));
    for (const t of batch) {
      let cur = norm.get(t) || t;
      cur = redir.get(cur) || cur;
      const p = pages.get(cur);
      existsMemo.set(t, p && !p.missing && !p.invalid ? cur : null);
    }
  }
}

async function summary(title) {
  return getJson(summaryUrl(title));
}

async function opensearch(q) {
  const j = await getJson(`${WP}/w/api.php?action=opensearch&format=json&namespace=0&limit=5&search=${encodeURIComponent(q)}`);
  return Array.isArray(j?.[1]) ? j[1] : [];
}

// ── Items ─────────────────────────────────────────────────────────────
async function loadItems() {
  const { SEED_RECIPES } = await import(pathToFileURL(path.join(ROOT, 'src/data/seedRecipes.js')).href);
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const sauces = read('public/data/sauce_augment.json').sauces;
  const cocktails = read('public/data/cocktail_codex_v2.json').cocktails;
  const wines = read('public/data/wine_styles.json').wines;
  const uniq = (arr) => [...new Map(arr.map((x) => [x.key, x])).values()];
  return [
    ...uniq(SEED_RECIPES.map((r) => ({ kind: 'recipe', key: r.id, name: r.name }))),
    ...uniq(sauces.map((s) => ({ kind: 'sauce', key: s.name, name: s.name }))),
    ...uniq(cocktails.map((c) => ({ kind: 'cocktail', key: c.name, name: c.name }))),
    ...uniq(wines.map((w) => ({ kind: 'wine', key: w.id, name: w.name }))),
  ];
}

// ── Match one item ────────────────────────────────────────────────────
async function matchItem(item, overrides) {
  const ov = overrides[item.kind]?.[item.key];
  if (ov === null) return { item, skipped: 'override: no suitable article' };
  // Override forms: "Title", or { "title": "Title", "photo": false } to keep
  // the story but drop a lead photo that matches the article, not the dish.
  const ovTitle = typeof ov === 'string' ? ov : ov?.title;
  const noPhoto = typeof ov === 'object' && ov?.photo === false;
  if (ovTitle) {
    const s = await summary(ovTitle);
    const a = acceptSummary(item.name, s, 'override');
    return a.ok ? { item, summary: s, via: 'override', noPhoto } : { item, skipped: `override rejected (${a.reason}): ${ovTitle}` };
  }
  const tried = [];
  for (const t of candidateTitles(item.name, item.kind)) {
    const target = existsMemo.get(t);
    if (!target) continue;
    const s = await summary(t);
    const a = acceptSummary(item.name, s, 'exact');
    tried.push(`${t}→${s?.title}:${a.reason}`);
    if (a.ok) return { item, summary: s, via: t === candidateTitles(item.name, item.kind)[0] ? 'exact' : 'qualifier' };
  }
  for (const t of await opensearch(cleanName(item.name))) {
    // Cheap pre-check on the title before spending a request on it.
    if (!namePlausible(item.name, t, 'search')) continue;
    const s = await summary(t);
    // Opensearch only fixed the capitalisation ("Beef pho" for "Beef Pho"):
    // that title is our exact name, so its redirect is judged like one.
    const mode = fold(t) === fold(cleanName(item.name)) ? 'exact' : 'search';
    const a = acceptSummary(item.name, s, mode);
    tried.push(`search ${t}:${a.reason}`);
    if (a.ok) return { item, summary: s, via: 'search' };
  }
  return { item, skipped: tried.length ? `rejected: ${tried.join('; ')}` : 'no article found' };
}

// ── Photos ────────────────────────────────────────────────────────────
async function photosFor(files) {
  const out = new Map();
  const list = [...new Set(files)].sort();
  for (let i = 0; i < list.length; i += 50) {
    const batch = list.slice(i, i + 50);
    const url = `${COMMONS}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=400&titles=${encodeURIComponent(batch.map((f) => `File:${f}`).join('|'))}`;
    const j = await getJson(url);
    const norm = new Map((j?.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const p of j?.query?.pages || []) {
      const from = (norm.get(p.title) || p.title).replace(/^File:/, '');
      const ii = p.imageinfo?.[0];
      // Missing on Commons → it lives on enwiki (non-free) — skip.
      if (!ii || p.missing) { out.set(from, { reject: 'not on Commons' }); continue; }
      const em = ii.extmetadata || {};
      const lic = stripHtml(em.LicenseShortName?.value || '');
      if (em.NonFree?.value && String(em.NonFree.value).toLowerCase() !== 'false') { out.set(from, { reject: 'non-free' }); continue; }
      if (!isFreeLicense(lic)) { out.set(from, { reject: `licence: ${lic || 'none'}` }); continue; }
      if (!/^image\/(jpeg|png|webp)$/.test(ii.mime || '')) { out.set(from, { reject: `mime ${ii.mime}` }); continue; }
      const artist = cleanArtist(em.Artist?.value || '') || cleanArtist(em.Credit?.value || '');
      if (!artist) { out.set(from, { reject: 'no artist recorded' }); continue; }
      // Hotlink from upload.wikimedia.org at the API's standard thumbnail
      // bucket (arbitrary widths are refused by the thumbnailer).
      const thumb = String(ii.thumburl || '').replace(/^https:\/\/thumb\.wikimedia\.org\//, 'https://upload.wikimedia.org/').replace(/\?.*$/, '');
      if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(thumb)) { out.set(from, { reject: `thumb host ${thumb}` }); continue; }
      out.set(from, {
        src: thumb,
        w: ii.thumbwidth,
        h: ii.thumbheight,
        page: ii.descriptionurl,
        artist,
        license: lic,
        licenseUrl: (em.LicenseUrl?.value || '').replace(/^http:/, 'https:') || null,
      });
    }
  }
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));
  const items = await loadItems();
  // Pre-resolve every candidate title in batches.
  await resolveExisting(items.flatMap((it) => (overrides[it.kind]?.[it.key] !== undefined ? [] : candidateTitles(it.name, it.kind))));

  const results = [];
  for (const it of items) results.push(await matchItem(it, overrides));

  const files = new Map();
  for (const r of results) {
    if (!r.summary) continue;
    if (r.noPhoto) { r.photoSkip = 'override: photo looks wrong for this item'; continue; }
    const f = commonsFileFromUrl(r.summary.originalimage?.source || r.summary.thumbnail?.source || '');
    if (f) files.set(r, f);
    else if (r.summary.originalimage) r.photoSkip = 'hosted on enwiki (not Commons)';
    else r.photoSkip = 'no lead image';
  }
  const photos = await photosFor([...files.values()]);

  const KIND = { recipe: 'recipes', sauce: 'sauces', cocktail: 'cocktails', wine: 'wines' };
  const out = { _meta: null, recipes: {}, sauces: {}, cocktails: {}, wines: {} };
  const counts = {};
  for (const r of results) {
    const k = KIND[r.item.kind];
    counts[k] ||= { items: 0, stories: 0, photos: 0 };
    counts[k].items++;
    if (!r.summary) continue;
    const text = firstSentences(r.summary.extract || '', 2, 300);
    if (!text) { r.skipped = 'empty extract'; continue; }
    const entry = {
      title: r.summary.title,
      desc: r.summary.description || '',
      text,
      url: r.summary.content_urls?.desktop?.page || `${WP}/wiki/${encodeURIComponent(titleKey(r.summary.title))}`,
    };
    const f = files.get(r);
    const ph = f ? photos.get(f) : null;
    if (ph && !ph.reject) { entry.photo = ph; counts[k].photos++; }
    else if (ph?.reject) r.photoSkip = ph.reject;
    r.entry = entry;
    out[k][r.item.key] = entry;
    counts[k].stories++;
  }
  out._meta = {
    source: 'English Wikipedia (REST page summary) + Wikimedia Commons (imageinfo/extmetadata)',
    textLicense: 'CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ ; each entry links its article',
    photoLicense: 'Per photo (CC0 / public domain / CC BY / CC BY-SA only); artist, licence and file page recorded per entry. Thumbnails are hotlinked from upload.wikimedia.org, not redistributed.',
    builtBy: 'scripts/build_dish_stories.mjs',
    built: new Date().toISOString().slice(0, 10),
    counts,
  };
  // Stable key order so re-runs diff cleanly.
  for (const k of Object.values(KIND)) out[k] = Object.fromEntries(Object.entries(out[k]).sort(([a], [b]) => a.localeCompare(b)));
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  if (prev?._meta && JSON.stringify({ ...prev, _meta: { ...prev._meta, built: '' } }) === JSON.stringify({ ...out, _meta: { ...out._meta, built: '' } })) {
    out._meta.built = prev._meta.built; // unchanged content → keep the date (deterministic re-runs)
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');

  const size = fs.statSync(OUT).size;
  console.log(`wrote ${path.relative(ROOT, OUT)} (${(size / 1024).toFixed(0)} KB), ${fetched} network requests`);
  for (const [k, c] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(9)} ${c.stories}/${c.items} stories (${(100 * c.stories / c.items).toFixed(0)}%), ${c.photos} photos (${(100 * c.photos / c.items).toFixed(0)}%)`);
  }
  const report = results.map((r) => ({
    kind: r.item.kind, key: r.item.key, name: r.item.name, title: r.entry?.title || null, via: r.via || null,
    description: r.summary?.description || '', skipped: r.skipped || null, photo: r.entry?.photo ? `${r.entry.photo.license} · ${r.entry.photo.artist}` : (r.photoSkip || null),
    file: files.get(r) || null,
  }));
  fs.writeFileSync(path.join(CACHE, '_review.json'), JSON.stringify(report, null, 1));
  if (REVIEW) {
    for (const r of report) {
      console.log([r.kind, r.name, r.title ? `→ ${r.title} [${r.via}] «${r.description}»` : `✗ ${r.skipped}`, r.title ? `photo: ${r.photo}` : ''].join(' | '));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
