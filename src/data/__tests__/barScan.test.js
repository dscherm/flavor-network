import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadScanKey, saveScanKey, clearScanKey, loadScanCode, saveScanCode, clearScanCode,
  looksLikeGeminiKey, looksLikeScanCode, maskSecret, scanMode, downscaleSize, barVocab,
  scanBarPhoto, ScanError, toReviewRows, mergeReviewRows, buildPrompt, GEMINI_URL,
  GEMINI_KEY_STORAGE, SCAN_CODE_STORAGE,
} from '../barScan.js';

const read = (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

function memStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };

const KEY = 'AIzaSyD-SECRETKEY-1234567890abcdefg';
const CODE = 'friend-code-SECRET99';
const okBody = { bottles: [{ label: 'Maker\'s Mark', type: 'bourbon', key: 'bourbon', confidence: 'high' }], other: ['lime'] };
const geminiOk = (obj = okBody) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] }), text: async () => '' });
const geminiErr = (status, text = '') => ({ ok: false, status, json: async () => ({}), text: async () => text });
const photo = { imageBase64: 'QUJD', mimeType: 'image/jpeg', vocab: ['bourbon', 'gin'] };

afterEach(() => vi.restoreAllMocks());

describe('storage', () => {
  it('key and code each round-trip under their own storage key', () => {
    const s = memStorage();
    expect(saveScanKey(`  ${KEY} `, s)).toBe(true);
    expect(saveScanCode(CODE, s)).toBe(true);
    expect(s._m.get(GEMINI_KEY_STORAGE)).toBe(KEY);
    expect(s._m.get(SCAN_CODE_STORAGE)).toBe(CODE);
    expect(GEMINI_KEY_STORAGE).toBe('fn-gemini-key');
    expect(SCAN_CODE_STORAGE).toBe('fn-scan-code');
    expect(loadScanKey(s)).toBe(KEY);
    expect(loadScanCode(s)).toBe(CODE);
    clearScanKey(s);
    expect(loadScanKey(s)).toBe('');
    expect(loadScanCode(s)).toBe(CODE);
    clearScanCode(s);
    expect(loadScanCode(s)).toBe('');
  });
  it('blocked or missing storage means nothing saved, never an error', () => {
    for (const s of [blocked, null, undefined]) {
      expect(loadScanKey(s ?? null)).toBe('');
      expect(loadScanCode(s ?? null)).toBe('');
      expect(saveScanKey(KEY, s ?? null)).toBe(false);
      expect(saveScanCode(CODE, s ?? null)).toBe(false);
      expect(clearScanKey(s ?? null)).toBe(false);
      expect(scanMode(s ?? null)).toBe(null);
    }
  });
  it('an empty value is not saved', () => {
    const s = memStorage();
    expect(saveScanKey('   ', s)).toBe(false);
    expect(loadScanKey(s)).toBe('');
  });
  it('mask shows only dots and the last 4 characters', () => {
    const m = maskSecret(KEY);
    expect(m.endsWith(KEY.slice(-4))).toBe(true);
    expect(m).not.toContain(KEY.slice(0, 12));
    expect(m.replace(/[•]/g, '')).toBe(KEY.slice(-4));
    expect(maskSecret('short')).not.toContain('short');
    expect(maskSecret('')).toBe('');
  });
  it('scanMode prefers the own key, then the code, else null', () => {
    const s = memStorage();
    expect(scanMode(s)).toBe(null);
    saveScanCode(CODE, s);
    expect(scanMode(s)).toBe('code');
    saveScanKey(KEY, s);
    expect(scanMode(s)).toBe('key');
    clearScanKey(s);
    expect(scanMode(s)).toBe('code');
  });
  it('format checks are loose for keys and exact for codes', () => {
    expect(looksLikeGeminiKey(KEY)).toBe(true);
    expect(looksLikeGeminiKey(`  ${KEY}  `)).toBe(true);
    expect(looksLikeGeminiKey('x'.repeat(19))).toBe(false);
    expect(looksLikeGeminiKey('x'.repeat(101))).toBe(false);
    expect(looksLikeGeminiKey('has a space in the middle of it')).toBe(false);
    expect(looksLikeGeminiKey('Zm9vYmFy-not-an-AIza-prefix_ok')).toBe(true);
    expect(looksLikeScanCode(CODE)).toBe(true);
    expect(looksLikeScanCode(' abcd-1234 ')).toBe(true);
    expect(looksLikeScanCode('short')).toBe(false);
    expect(looksLikeScanCode('has space in it')).toBe(false);
    expect(looksLikeScanCode('a'.repeat(65))).toBe(false);
    expect(looksLikeScanCode('under_score1')).toBe(false);
  });
});

describe('downscaleSize', () => {
  it('keeps the aspect ratio, never upscales, long side at most max', () => {
    expect(downscaleSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(downscaleSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(downscaleSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(downscaleSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
    expect(downscaleSize(8000, 1000, 1000)).toEqual({ width: 1000, height: 125 });
    const big = downscaleSize(12345, 6789);
    expect(Math.max(big.width, big.height)).toBe(1600);
  });
});

describe('key path', () => {
  it('posts to Google only, key in the header and nowhere else', async () => {
    const fetch = vi.fn(async () => geminiOk());
    const r = await scanBarPhoto({ ...photo, key: KEY, fetch, callScanBar: vi.fn() });
    expect(r).toEqual({ bottles: okBody.bottles, other: ['lime'] });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(GEMINI_URL);
    expect(new URL(url).hostname).toBe('generativelanguage.googleapis.com');
    expect(url).not.toContain(KEY);
    expect(init.method).toBe('POST');
    expect(init.headers['x-goog-api-key']).toBe(KEY);
    expect(init.body).not.toContain(KEY);
    expect(JSON.stringify(Object.entries(init.headers).filter(([h]) => h !== 'x-goog-api-key'))).not.toContain(KEY);
    const body = JSON.parse(init.body);
    expect(body.generationConfig).toMatchObject({ temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } });
    expect(body.generationConfig.responseSchema.required).toEqual(['bottles', 'other']);
    expect(body.systemInstruction.parts[0].text).toContain('bourbon, gin');
    expect(body.systemInstruction.parts[0].text).not.toMatch(/at most \d+/i);
    expect(JSON.stringify(body.contents)).toContain('QUJD');
  });
  it('the key wins when a code is also given', async () => {
    const fetch = vi.fn(async () => geminiOk());
    const callScanBar = vi.fn();
    await scanBarPhoto({ ...photo, key: KEY, code: CODE, fetch, callScanBar });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(callScanBar).not.toHaveBeenCalled();
  });
  it('a 503 then success is retried', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(geminiErr(503)).mockResolvedValueOnce(geminiErr(429, 'slow down')).mockResolvedValueOnce(geminiOk());
    const sleep = vi.fn(async () => {});
    const r = await scanBarPhoto({ ...photo, key: KEY, fetch, sleep });
    expect(r.bottles).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
  it('retries exhausted gives busy (3 retries)', async () => {
    const fetch = vi.fn(async () => geminiErr(503));
    await expect(scanBarPhoto({ ...photo, key: KEY, fetch, sleep: async () => {} })).rejects.toMatchObject({ kind: 'busy' });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it('past the 25 s budget gives busy without waiting', async () => {
    let t = 0;
    const fetch = vi.fn(async () => { t += 30_000; return geminiErr(503); });
    const sleep = vi.fn(async () => {});
    await expect(scanBarPhoto({ ...photo, key: KEY, fetch, sleep, now: () => t })).rejects.toMatchObject({ kind: 'busy' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it('a daily-quota 429 is daily-limit and not retried', async () => {
    for (const text of ['Quota exceeded for metric generate_content_free_tier_requests', 'GenerateRequestsPerDayPerProjectPerModel limit 20 per day']) {
      const fetch = vi.fn(async () => geminiErr(429, text));
      const sleep = vi.fn();
      await expect(scanBarPhoto({ ...photo, key: KEY, fetch, sleep })).rejects.toMatchObject({ kind: 'daily-limit' });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }
  });
  it('400 with an API-key message, 401 and 403 are bad-key; other 400 is bad-photo', async () => {
    for (const [status, text, kind] of [[400, 'API key not valid. Please pass a valid API key.', 'bad-key'], [401, '', 'bad-key'], [403, 'denied', 'bad-key'], [400, 'Request payload size exceeds', 'bad-photo']]) {
      await expect(scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiErr(status, text) })).rejects.toMatchObject({ kind });
    }
  });
  it('a network error is offline; malformed or empty output is unreadable', async () => {
    await expect(scanBarPhoto({ ...photo, key: KEY, fetch: async () => { throw new TypeError('Failed to fetch'); } })).rejects.toMatchObject({ kind: 'offline' });
    await expect(scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiOk('not json at all') })).rejects.toMatchObject({ kind: 'unreadable' });
    await expect(scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiOk('{"bottles": [{"label":"a"') })).rejects.toMatchObject({ kind: 'unreadable' });
    await expect(scanBarPhoto({ ...photo, key: KEY, fetch: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }) })).rejects.toMatchObject({ kind: 'unreadable' });
    await expect(scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiOk({ other: [] }) })).rejects.toMatchObject({ kind: 'unreadable' });
  });
});

describe('code path', () => {
  it('calls scanBar with { code, image, mimeType, vocab } and never fetch', async () => {
    const fetch = vi.fn();
    const callScanBar = vi.fn(async () => ({ data: okBody }));
    const r = await scanBarPhoto({ ...photo, code: CODE, fetch, callScanBar });
    expect(callScanBar).toHaveBeenCalledWith({ code: CODE, image: 'QUJD', mimeType: 'image/jpeg', vocab: ['bourbon', 'gin'] });
    expect(fetch).not.toHaveBeenCalled();
    expect(r).toEqual({ bottles: okBody.bottles, other: ['lime'] });
  });
  const fail = (code, message) => scanBarPhoto({ ...photo, code: CODE, callScanBar: async () => { throw Object.assign(new Error(message), { code }); } });
  it('maps the callable error codes (with or without the functions/ prefix)', async () => {
    await expect(fail('functions/permission-denied', 'x')).rejects.toMatchObject({ kind: 'bad-code' });
    await expect(fail('permission-denied', 'x')).rejects.toMatchObject({ kind: 'bad-code' });
    await expect(fail('functions/resource-exhausted', 'This code has used its 10 photo scans')).rejects.toMatchObject({ kind: 'daily-limit' });
    await expect(fail('functions/unavailable', 'The photo reader is out of capacity for today. Try again tomorrow')).rejects.toMatchObject({ kind: 'daily-limit' });
    await expect(fail('functions/unavailable', 'The photo reader is busy. Try again in a minute.')).rejects.toMatchObject({ kind: 'busy' });
    await expect(fail('functions/unavailable', 'unavailable')).rejects.toMatchObject({ kind: 'busy' });
    await expect(fail('functions/deadline-exceeded', 'deadline-exceeded')).rejects.toMatchObject({ kind: 'busy' });
    await expect(fail('functions/internal', 'The photo reader could not read that photo. Try again.')).rejects.toMatchObject({ kind: 'unreadable' });
    await expect(fail('functions/invalid-argument', 'That photo is too large. Try a smaller one (under 4 MB).')).rejects.toMatchObject({ kind: 'too-large' });
    await expect(fail('functions/invalid-argument', 'The photo could not be read.')).rejects.toMatchObject({ kind: 'bad-photo' });
  });
  it('the SDK reports a failed network request as functions/internal with the bare message "internal": offline', async () => {
    await expect(fail('functions/internal', 'internal')).rejects.toMatchObject({ kind: 'offline' });
  });
  it('malformed callable data is unreadable', async () => {
    await expect(scanBarPhoto({ ...photo, code: CODE, callScanBar: async () => ({ data: { nope: 1 } }) })).rejects.toMatchObject({ kind: 'unreadable' });
    await expect(scanBarPhoto({ ...photo, code: CODE, callScanBar: async () => ({}) })).rejects.toMatchObject({ kind: 'unreadable' });
  });
});

describe('both paths', () => {
  const messy = {
    bottles: [
      { label: 'A', type: 'gin', key: 'gin', confidence: 'HIGH' },
      { label: 'B', type: 'rum', key: '', confidence: 'certain' },
      { label: '', type: 'vodka', key: 'vodka', confidence: 'high' },
      { label: 'C', type: '', key: '', confidence: 'high' },
      { label: 'D', type: 'tequila' },
      null,
    ],
    other: ['lime', '', 5, ' tonic water '],
  };
  const paths = {
    key: (o) => scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiOk(o) }),
    code: (o) => scanBarPhoto({ ...photo, code: CODE, callScanBar: async () => ({ data: o }) }),
  };
  for (const [name, run] of Object.entries(paths)) {
    it(`${name}: drops entries missing label/type, coerces confidence, cleans other`, async () => {
      const r = await run(messy);
      expect(r.bottles).toEqual([
        { label: 'A', type: 'gin', key: 'gin', confidence: 'high' },
        { label: 'B', type: 'rum', key: '', confidence: 'low' },
        { label: 'D', type: 'tequila', key: '', confidence: 'low' },
      ]);
      expect(r.other).toEqual(['lime', 'tonic water']);
    });
    it(`${name}: more than 60 bottles are truncated to 60`, async () => {
      const many = { bottles: Array.from({ length: 90 }, (_, i) => ({ label: `L${i}`, type: 'gin', key: 'gin', confidence: 'high' })), other: [] };
      expect((await run(many)).bottles).toHaveLength(60);
    });
  }
  it('key path tolerates fenced JSON and prose around the object', async () => {
    const r1 = await scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiOk('```json\n' + JSON.stringify(okBody) + '\n```') });
    expect(r1.bottles).toHaveLength(1);
    const r2 = await scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiOk('Here you go: ' + JSON.stringify(okBody) + ' done') });
    expect(r2.bottles).toHaveLength(1);
  });
  it('neither key nor code is not-set-up, and nothing is called', async () => {
    const fetch = vi.fn();
    const callScanBar = vi.fn();
    const e = await scanBarPhoto({ ...photo, fetch, callScanBar }).catch((x) => x);
    expect(e).toBeInstanceOf(ScanError);
    expect(e.kind).toBe('not-set-up');
    expect(fetch).not.toHaveBeenCalled();
    expect(callScanBar).not.toHaveBeenCalled();
    await expect(scanBarPhoto({ ...photo, code: CODE, fetch })).rejects.toMatchObject({ kind: 'not-set-up' });
  });
});

describe('secrets never leak', () => {
  it('no key or code in any console call or error message, even when Google echoes the key', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const errors = [];
    const attempts = [
      scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiErr(400, `API key not valid: ${KEY}`) }),
      scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiErr(403, `key ${KEY} denied`) }),
      scanBarPhoto({ ...photo, key: KEY, fetch: async () => { throw new Error(`failed https://x?key=${KEY}`); } }),
      scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiErr(500, KEY) }),
      scanBarPhoto({ ...photo, key: KEY, fetch: async () => geminiOk(`garbage ${KEY}`) }),
      scanBarPhoto({ ...photo, code: CODE, callScanBar: async () => { throw Object.assign(new Error(`bad ${CODE}`), { code: 'functions/permission-denied' }); } }),
      scanBarPhoto({ ...photo, code: CODE, callScanBar: async () => { throw Object.assign(new Error(`bad ${CODE}`), { code: 'functions/internal' }); } }),
    ];
    for (const p of attempts) errors.push(await p.catch((e) => e));
    for (const e of errors) {
      expect(e).toBeInstanceOf(ScanError);
      expect(e.message).not.toContain(KEY);
      expect(e.message).not.toContain(CODE);
      expect(JSON.stringify({ ...e })).not.toContain(KEY);
      expect(String(e.stack || '')).not.toContain(KEY);
      expect(String(e.stack || '')).not.toContain(CODE);
    }
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
  it('the prompt never contains a secret', () => {
    expect(buildPrompt(['bourbon'])).not.toContain('AIza');
  });
});

describe('real data', () => {
  const roles = read('public/data/cocktail_roles.json');
  const names = new Set(Object.keys(read('public/proDataset/ingredients.json')));
  const cocktails = read('public/data/cocktail_codex_v2.json').cocktails;

  it('barVocab: booze only, most used first, named bottles included, within the function limits', () => {
    const v = barVocab(cocktails, roles, names);
    expect(v.length).toBeGreaterThan(50);
    expect(v.length).toBeLessThanOrEqual(300);
    expect(v.every((k) => k.length <= 60 && k === k.trim())).toBe(true);
    expect(new Set(v).size).toBe(v.length);
    for (const k of ['gin', 'bourbon', 'campari', 'licor 43', 'amaretto', 'creme de cassis', 'genepy', 'amarula', 'averna', 'jagermeister']) expect(v, k).toContain(k);
    expect(v).not.toContain('lemon juice');
    expect(v.indexOf('gin')).toBeLessThan(v.indexOf('licor 43'));
  });

  it("toReviewRows on the owner's bar photo (IMG_1835)", () => {
    const result = {
      bottles: [
        { label: 'Sole Rosso Vermouth', type: 'sweet vermouth', key: 'sweet vermouth', confidence: 'high' },
        { label: 'Cynar', type: 'amaro', key: 'cynar', confidence: 'high' },
        { label: 'Amaro Montenegro', type: 'amaro', key: 'amaro montenegro', confidence: 'high' },
        { label: 'Gionelli Blue Curacao', type: 'orange liqueur', key: 'blue curacao', confidence: 'high' },
        { label: 'Forij Gin', type: 'gin', key: 'gin', confidence: 'high' },
        { label: 'Campari', type: 'aperitivo', key: 'campari', confidence: 'high' },
        { label: 'Lillet Blanc', type: 'aperitif wine', key: 'lillet blanc', confidence: 'high' },
        { label: 'Dolin Genepy des Alpes', type: 'herbal liqueur', key: 'herbal liqueur', confidence: 'high' },
        { label: 'Ron Zacapa Centenario 23', type: 'rum', key: 'rum', confidence: 'medium' },
        { label: 'Mystery Bottle', type: 'thing', key: '', confidence: 'low' },
        { label: 'Forij Gin', type: 'gin', key: 'gin', confidence: 'high' },
      ],
      other: ['tonic water', 'lime', 'Lime'],
    };
    const { rows, other } = toReviewRows(result, ['gin'], { names, roles });
    const by = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(rows.map((r) => r.barKey)).toEqual(['sweet vermouth', 'cynar', 'amaro montenegro', 'blue curacao', 'gin', 'campari', 'lillet blanc', 'genepy', 'rum', '']);
    expect(by['Dolin Genepy des Alpes'].barKey).toBe('genepy');
    expect(by['Forij Gin']).toMatchObject({ inBar: true, checked: false });
    expect(by['Campari']).toMatchObject({ inBar: false, checked: true, confidence: 'high' });
    expect(by['Ron Zacapa Centenario 23']).toMatchObject({ checked: false, confidence: 'medium' });
    expect(by['Mystery Bottle']).toMatchObject({ barKey: '', checked: false, editable: true });
    expect(rows).toHaveLength(10);
    expect(other.map((o) => o.kitchenKey)).toEqual(expect.arrayContaining(['lime']));
    expect(other.filter((o) => o.kitchenKey === 'lime')).toHaveLength(1);
  });

  it('a generic type with a named label keeps the brand, and a non-booze answer falls back to the label', () => {
    const { rows } = toReviewRows({ bottles: [
      { label: 'Licor 43 Cuarenta y Tres', type: 'liqueur', key: '', confidence: 'high' },
      { label: 'Averna Amaro Siciliano', type: 'amaro', key: 'amaro montenegro', confidence: 'high' },
      { label: 'Cassisée', type: 'creme de cassis', key: '', confidence: 'high' },
    ], other: [] }, [], { names, roles });
    expect(rows.map((r) => r.barKey)).toEqual(['licor 43', 'averna', 'creme de cassis']);
  });

  it('mergeReviewRows adds a second photo without duplicates or un-ticking', () => {
    const first = toReviewRows({ bottles: [
      { label: 'Campari', type: 'aperitivo', key: 'campari', confidence: 'high' },
      { label: 'Gin', type: 'gin', key: 'gin', confidence: 'high' },
    ], other: [] }, [], { names, roles }).rows;
    first[1].checked = false; // the user unticked gin
    const second = toReviewRows({ bottles: [
      { label: 'Campari Bitter', type: 'aperitivo', key: 'campari', confidence: 'high' },
      { label: 'Tanqueray', type: 'gin', key: 'gin', confidence: 'high' },
      { label: 'Cynar', type: 'amaro', key: 'cynar', confidence: 'high' },
      { label: 'Mystery', type: 'x', key: '', confidence: 'low' },
    ], other: [] }, [], { names, roles }).rows;
    const merged = mergeReviewRows(first, second);
    expect(merged.map((r) => r.barKey)).toEqual(['campari', 'gin', 'cynar', '']);
    expect(merged[1].checked).toBe(false);
    expect(merged[0]).toBe(first[0]);
    expect(mergeReviewRows(merged, second)).toHaveLength(4);
    expect(mergeReviewRows(null, second)).toHaveLength(4);
  });
});
