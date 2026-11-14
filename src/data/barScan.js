/**
 * barScan.js — "fill My bar from a photo": the client side. No React.
 *
 * Two ways to scan, both returning the same { bottles, other }:
 *  - the user's own Gemini key (kept on this device, sent only to Google, in
 *    the x-goog-api-key header), or
 *  - an invite code from the owner, which runs the scan on the owner's key
 *    through the scanBar Cloud Function (functions/src/barscan/).
 * The own key wins when both are saved. Neither secret is ever put in a URL,
 * a request body, a log line or an error message.
 *
 * Storage: localStorage keys `fn-gemini-key` and `fn-scan-code`. Every read
 * and write is wrapped, as in myBar.js: blocked storage means "nothing
 * saved", never an error.
 *
 * KEEP IN STEP: RESPONSE_SCHEMA, buildPrompt and the lenient parse below are
 * a plain-JS port of functions/src/barscan/handler.ts. A shared file between
 * functions/ and src/ is not possible, so a change to one is a change to both.
 *
 * Everything that touches the network or the canvas is injected or thin, so
 * the tests run with no network: scanBarPhoto takes fetch / callScanBar /
 * sleep / now; downscaleSize is the tested maths behind downscaleImage.
 *
 * Review step: toReviewRows turns a result into rows the user ticks before
 * anything reaches the bar (names go through barKey / isBooze, myBar.js).
 */
import { barKey, isBooze, barKeyLists, namedBottle, GENERIC_BOTTLE_KEYS } from './myBar.js';
import { kitchenKey } from './myKitchen.js';

export const GEMINI_KEY_STORAGE = 'fn-gemini-key';
export const SCAN_CODE_STORAGE = 'fn-scan-code';

export const MODEL_NAME = 'gemini-2.5-flash';
export const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;
export const MAX_BOTTLES = 60;
export const MAX_OUTPUT_TOKENS = 4096;
export const MODEL_BUDGET_MS = 25_000;
export const MAX_RETRIES = 3;
export const RETRY_BASE_MS = 1_000;
export const MAX_VOCAB = 300;
export const MAX_VOCAB_ENTRY = 60;

// ── Storage ────────────────────────────────────────────────────────────────

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

function load(storageKey, storage) {
  try {
    const v = storage?.getItem(storageKey);
    return typeof v === 'string' && v.trim() ? v.trim() : '';
  } catch {
    return '';
  }
}

function save(storageKey, value, storage) {
  try {
    if (!storage) return false;
    const v = String(value ?? '').trim();
    if (!v) return false;
    storage.setItem(storageKey, v);
    return true;
  } catch {
    return false;
  }
}

function clear(storageKey, storage) {
  try {
    if (!storage) return false;
    if (typeof storage.removeItem === 'function') storage.removeItem(storageKey);
    else storage.setItem(storageKey, '');
    return true;
  } catch {
    return false;
  }
}

export const loadScanKey = (storage = defaultStorage()) => load(GEMINI_KEY_STORAGE, storage);
export const saveScanKey = (key, storage = defaultStorage()) => save(GEMINI_KEY_STORAGE, key, storage);
export const clearScanKey = (storage = defaultStorage()) => clear(GEMINI_KEY_STORAGE, storage);
export const loadScanCode = (storage = defaultStorage()) => load(SCAN_CODE_STORAGE, storage);
export const saveScanCode = (code, storage = defaultStorage()) => save(SCAN_CODE_STORAGE, code, storage);
export const clearScanCode = (storage = defaultStorage()) => clear(SCAN_CODE_STORAGE, storage);

/** Loose sanity check only (Google may change the key's shape): no spaces, 20-100 characters. */
export function looksLikeGeminiKey(text) {
  const t = String(text ?? '').trim();
  return t.length >= 20 && t.length <= 100 && !/\s/.test(t);
}

/** Same shape the function accepts: 8-64 of A-Z a-z 0-9 -. */
export function looksLikeScanCode(text) {
  return /^[A-Za-z0-9-]{8,64}$/.test(String(text ?? '').trim());
}

/** Dots plus the last 4 characters. A secret of 8 or fewer characters shows only dots. */
export function maskSecret(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  return t.length > 8 ? `••••••••${t.slice(-4)}` : '••••••••';
}

/** 'key' | 'code' | null. The user's own key wins when both are saved. */
export function scanMode(storage = defaultStorage()) {
  if (loadScanKey(storage)) return 'key';
  if (loadScanCode(storage)) return 'code';
  return null;
}

// ── Photo ──────────────────────────────────────────────────────────────────

/** Fit inside max x max, keep the aspect ratio, never upscale. */
export function downscaleSize(width, height, max = 1600) {
  const w = Math.max(1, Math.round(Number(width) || 0));
  const h = Math.max(1, Math.round(Number(height) || 0));
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const f = max / long;
  return { width: Math.max(1, Math.round(w * f)), height: Math.max(1, Math.round(h * f)) };
}

/** Browser only: a photo file → JPEG with its long side at most `max`, as base64 (no data: prefix). */
export async function downscaleImage(file, { max = 1600, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = downscaleSize(bitmap.width, bitmap.height, max);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === 'function') bitmap.close();
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: 'image/jpeg', quality })
    : await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(bin), mimeType: 'image/jpeg' };
}

// ── Bottle list ────────────────────────────────────────────────────────────

// Bottles real bars hold that no recipe names (same list as
// scripts/measureBarPhoto.mjs EXTRA_BOTTLES): without them the model has
// nothing to answer with and leaves the key empty.
export const EXTRA_BOTTLES = ['amaretto', 'amarula', 'licor 43', 'goldwasser', 'genepy', 'averna', 'jagermeister', 'strega', 'cynar',
  'creme de cassis', 'creme de violette', 'creme de mure', 'creme de banane', 'creme de peche', 'aquavit', 'ouzo', 'pastis',
  'limoncello', 'soju', 'kirsch', 'slivovitz', 'southern comfort', 'amaro'];

/** Every booze key any recipe uses, most used first, plus EXTRA_BOTTLES; at most 300 entries of at most 60 characters. */
export function barVocab(cocktails, roles, names) {
  const counts = new Map();
  for (const keys of barKeyLists(cocktails, roles, names)) {
    for (const k of new Set(keys)) if (isBooze(k, roles)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const ok = (k) => k && k.length <= MAX_VOCAB_ENTRY && !/[\r\n]/.test(k);
  const extras = [];
  for (const e of EXTRA_BOTTLES) {
    const k = barKey(e, names);
    if (ok(k) && isBooze(k, roles) && !extras.includes(k)) extras.push(k);
  }
  const used = [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k).filter(ok);
  const rest = extras.filter((k) => !counts.has(k));
  return [...used.slice(0, MAX_VOCAB - rest.length), ...rest];
}

// ── Prompt and schema (keep in step with functions/src/barscan/handler.ts) ─

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bottles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          type: { type: 'STRING' },
          key: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
        },
        required: ['label', 'type', 'key', 'confidence'],
      },
    },
    other: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['bottles', 'other'],
};

export function buildPrompt(vocab) {
  const base = `You look at a photo of someone's home bar and list the bottles of alcohol in it, for a cocktail app.

For each distinct bottle you can identify:
- "label": what the label says (brand and expression), e.g. "Maker's Mark", "Carpano Antica Formula".
- "type": the generic kind of drink, lower case, e.g. "bourbon", "london dry gin", "sweet vermouth", "orange liqueur", "aromatic bitters".
- "key": the ONE entry from the app's list below that this bottle counts as (copy it exactly), or "" when nothing on the list fits. Never substitute a different brand's name for the key: if the bottle is not on the list, the key is "".
- "confidence": "high" when you can read the label, "medium" when you recognise the bottle but cannot read it, "low" when you are guessing from shape or colour.

Rules:
- List only bottles whose label you can read or that you clearly recognise. A bottle you cannot identify is left out.
- Never invent a bottle. Do not pad the list: stop when you have listed what you can actually see.
- One entry per distinct product. Two bottles of the same product are one entry.
- Alcohol only in "bottles". Mixers, juices, syrups, fruit and tools go in "other" as short lower-case names (e.g. "tonic water", "lime").
- Output only the JSON object.`;
  const list = (vocab || []).map((v) => String(v).replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (list.length === 0) return `${base}\n\nThe app's list is empty, so every "key" is "".`;
  return `${base}\n\nThe app's list:\n${list.join(', ')}`;
}

// ── Errors ─────────────────────────────────────────────────────────────────

export const SCAN_MESSAGES = {
  'not-set-up': 'Add your Gemini key or an invite code to scan a photo.',
  'bad-key': 'Google did not accept that key. Check it and paste it again.',
  'bad-code': "That code isn't valid. Check it with whoever gave it to you.",
  'daily-limit': 'The scan allowance for today is used up. Try again tomorrow, or add bottles by typing.',
  busy: 'The photo reader is busy. Try again in a minute.',
  offline: "Couldn't reach the photo reader. Check your connection and try again.",
  'too-large': 'That photo is too large. Try a smaller one.',
  'bad-photo': 'That photo could not be read. Try a different one.',
  unreadable: 'The photo reader gave an answer we could not use. Try again.',
};

/** A scan failure with a `kind` and a short plain `message` for the screen. Never carries a key or code. */
export class ScanError extends Error {
  constructor(kind) {
    super(SCAN_MESSAGES[kind] || SCAN_MESSAGES.unreadable);
    this.name = 'ScanError';
    this.kind = kind;
  }
}

// ── Parsing ────────────────────────────────────────────────────────────────

function normalizeResult(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.bottles)) throw new ScanError('unreadable');
  const bottles = [];
  for (const e of obj.bottles) {
    if (!e || typeof e !== 'object') continue;
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    const type = typeof e.type === 'string' ? e.type.trim() : '';
    if (!label || !type) continue;
    const key = typeof e.key === 'string' ? e.key.trim() : '';
    const c = typeof e.confidence === 'string' ? e.confidence.toLowerCase() : '';
    bottles.push({ label, type, key, confidence: c === 'high' || c === 'medium' ? c : 'low' });
  }
  const other = Array.isArray(obj.other) ? obj.other.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim()) : [];
  return { bottles: bottles.slice(0, MAX_BOTTLES), other: other.slice(0, MAX_BOTTLES) };
}

/** Lenient parse of the model's text: fenced JSON and stray prose around the object are tolerated; anything else is unreadable. */
export function parseModelText(text) {
  let raw = String(text ?? '').trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw);
  if (fenced) raw = fenced[1];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) throw new ScanError('unreadable');
    try { parsed = JSON.parse(raw.slice(a, b + 1)); } catch { throw new ScanError('unreadable'); }
  }
  return normalizeResult(parsed);
}

// ── Scanning ───────────────────────────────────────────────────────────────

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A used-up daily quota does not come back in seconds: never retried.
const DAILY_QUOTA = /per ?day|free_tier|quota[\s\S]*exceeded[\s\S]*day/i;

function geminiText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
}

async function scanWithKey({ imageBase64, mimeType, vocab, key, fetch: doFetch, sleep, now }) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: buildPrompt(vocab) }] },
    contents: [{ role: 'user', parts: [
      { text: 'List the bottles in this photo of a home bar.' },
      { inlineData: { mimeType, data: imageBase64 } },
    ] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const startedAt = now();
  for (let attempt = 0; ; attempt += 1) {
    let res;
    try {
      res = await doFetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
      });
    } catch {
      throw new ScanError('offline');
    }
    if (res.ok) {
      let json;
      try { json = await res.json(); } catch { throw new ScanError('unreadable'); }
      return parseModelText(geminiText(json));
    }
    let errBody = '';
    try { errBody = await res.text(); } catch { /* the status is enough */ }
    const status = res.status;
    if (status === 429 && DAILY_QUOTA.test(errBody)) throw new ScanError('daily-limit');
    if (status === 401 || status === 403) throw new ScanError('bad-key');
    if (status === 400) throw new ScanError(/api key|api_key/i.test(errBody) ? 'bad-key' : 'bad-photo');
    if (status === 503 || status === 429) {
      const wait = RETRY_BASE_MS * 2 ** attempt;
      if (attempt >= MAX_RETRIES || now() - startedAt + wait > MODEL_BUDGET_MS) throw new ScanError('busy');
      await sleep(wait);
      continue;
    }
    throw new ScanError(status >= 500 ? 'busy' : 'unreadable');
  }
}

/**
 * Map a callable error. The Firebase SDK prefixes codes ("functions/unavailable")
 * and, when the request never got an answer (fetch failed, status 0), reports
 * code "functions/internal" with the bare message "internal" — a server-thrown
 * 'internal' carries our own sentence instead.
 */
function callableKind(err) {
  const code = String(err?.code || '').replace(/^functions\//, '');
  const msg = String(err?.message || '');
  switch (code) {
    case 'permission-denied': case 'unauthenticated': return 'bad-code';
    case 'resource-exhausted': return 'daily-limit';
    case 'unavailable': return /out of capacity/i.test(msg) ? 'daily-limit' : 'busy';
    case 'deadline-exceeded': return 'busy';
    case 'invalid-argument': return /too large/i.test(msg) ? 'too-large' : 'bad-photo';
    case 'internal': return msg === 'internal' ? 'offline' : 'unreadable';
    default: return 'unreadable';
  }
}

async function scanWithCode({ imageBase64, mimeType, vocab, code, callScanBar }) {
  let res;
  try {
    res = await callScanBar({ code, image: imageBase64, mimeType, vocab });
  } catch (err) {
    throw new ScanError(callableKind(err));
  }
  return normalizeResult(res?.data);
}

/**
 * Ask the model which bottles are in a photo.
 * @returns {Promise<{ bottles: Array<{label,type,key,confidence}>, other: string[] }>}
 * @throws {ScanError} kinds: not-set-up, bad-key, bad-code, daily-limit, busy,
 *   offline, too-large, bad-photo, unreadable
 */
export async function scanBarPhoto({
  imageBase64, mimeType = 'image/jpeg', vocab = [], key = '', code = '',
  fetch: doFetch = (...a) => globalThis.fetch(...a), callScanBar, sleep = defaultSleep, now = () => Date.now(),
} = {}) {
  const k = String(key || '').trim();
  const c = String(code || '').trim();
  if (k) return scanWithKey({ imageBase64, mimeType, vocab, key: k, fetch: doFetch, sleep, now });
  if (c && typeof callScanBar === 'function') return scanWithCode({ imageBase64, mimeType, vocab, code: c, callScanBar });
  throw new ScanError('not-set-up');
}

// ── Review ─────────────────────────────────────────────────────────────────

const RANK = { high: 3, medium: 2, low: 1 };

/** The bar key for one detected bottle ('' = no bar name). Same mapping as keyFor in scripts/measureBarPhoto.mjs. */
function bottleKey(b, names, roles) {
  let k = '';
  for (const text of [b.key, b.type]) {
    if (!text) continue;
    const cand = barKey(text, names);
    if (cand && isBooze(cand, roles)) { k = cand; break; }
  }
  // The label can name a bottle the answer lost ("Licor 43" typed as "liqueur").
  const named = namedBottle(b.label);
  if (named && (!k || GENERIC_BOTTLE_KEYS.has(k))) return named;
  if (k) return k;
  const fromLabel = barKey(b.label, names);
  return fromLabel && isBooze(fromLabel, roles) ? fromLabel : '';
}

/**
 * Rows for the review list. One per distinct bar name (a repeat keeps the
 * more confident one); a bottle with no bar name stays as an editable,
 * unchecked row with barKey ''. `checked` = high confidence and not already
 * in the bar. `editable` = the name needs (or may need) the user's correction.
 * `other` are the non-alcohol items for the shared kitchen list.
 */
export function toReviewRows(result, bar, { names = new Set(), roles = {} } = {}) {
  const inBar = new Set(bar || []);
  const rows = [];
  const index = new Map();
  for (const b of result?.bottles || []) {
    const bk = bottleKey(b, names, roles);
    const id = bk || `?:${b.label.toLowerCase()}`;
    const prev = index.get(id);
    if (prev) {
      if ((RANK[b.confidence] || 0) > (RANK[prev.confidence] || 0)) {
        prev.confidence = b.confidence;
        prev.checked = !!bk && b.confidence === 'high' && !prev.inBar;
        prev.editable = !bk || b.confidence !== 'high';
      }
      continue;
    }
    const row = {
      id, label: b.label, type: b.type, barKey: bk, confidence: b.confidence,
      inBar: !!bk && inBar.has(bk),
      checked: false,
      editable: !bk || b.confidence !== 'high',
    };
    row.checked = !!bk && b.confidence === 'high' && !row.inBar;
    index.set(id, row);
    rows.push(row);
  }
  const other = [];
  const seen = new Set();
  for (const o of result?.other || []) {
    const kk = kitchenKey(o, names);
    if (!kk || seen.has(kk)) continue;
    seen.add(kk);
    other.push({ label: o, kitchenKey: kk });
  }
  return { rows, other };
}

/** Add a second photo's rows: no duplicate bar keys, and what the user already ticked (or not) stays as it is. */
export function mergeReviewRows(existing, incoming) {
  const out = [...(existing || [])];
  const have = new Set(out.map((r) => r.id));
  for (const r of incoming || []) {
    if (have.has(r.id)) continue;
    have.add(r.id);
    out.push(r);
  }
  return out;
}
