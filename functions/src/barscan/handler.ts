// BARPHOTO-3. The scanBar pipeline: validate, enforce the daily cap, ask the
// model which bottles are in the photo, parse its answer. Pure and
// dependency-injected (model, usage store, clock, logger) so the tests need
// no network. Prompt and schema come from scripts/measureBarPhoto.mjs, the
// accuracy test that proved the approach.

import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import type {
  BarScanDeps,
  Confidence,
  ScanBarResult,
  ScannedBottle,
} from './types';

export const DAILY_SCAN_CAP = 10;
export const MAX_DAILY_CAP = 200;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_VOCAB = 300;
export const MAX_VOCAB_ENTRY = 60;
// Enforced here, not in the prompt: a stated cap of 40 acted as a target and
// the model invented bottles to reach it.
export const MAX_BOTTLES = 60;
export const MAX_OUTPUT_TOKENS = 4096;
export const MODEL_BUDGET_MS = 25_000;
export const MAX_RETRIES = 3;
export const RETRY_BASE_MS = 1_000;

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Plain-object form of the Gemini response schema (the strings are the same
// ones the SDK's SchemaType enum holds).
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

// KEEP IN STEP with src/data/barScan.js: RESPONSE_SCHEMA, buildPrompt and
// parseModelOutput are ported there to plain JS for the in-browser own-key path.
export function buildPrompt(vocab: string[]): string {
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
  if (vocab.length === 0) return `${base}\n\nThe app's list is empty, so every "key" is "".`;
  return `${base}\n\nThe app's list:\n${vocab.join(', ')}`;
}

function approxDecodedBytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export function validateRequest(data: unknown): { image: string; mimeType: string; vocab: string[] } {
  const d = (data ?? {}) as { image?: unknown; mimeType?: unknown; vocab?: unknown };
  if (typeof d.image !== 'string' || d.image.length === 0) {
    throw new HttpsError('invalid-argument', 'A photo is required.');
  }
  if (typeof d.mimeType !== 'string' || !ALLOWED_MIME.includes(d.mimeType.toLowerCase())) {
    throw new HttpsError('invalid-argument', 'That file type is not supported. Use a JPEG, PNG, WebP or HEIC photo.');
  }
  if (approxDecodedBytes(d.image) > MAX_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', 'That photo is too large. Try a smaller one (under 4 MB).');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(d.image)) {
    throw new HttpsError('invalid-argument', 'The photo could not be read. Try a different one.');
  }
  let vocab: string[] = [];
  if (d.vocab !== undefined) {
    if (
      !Array.isArray(d.vocab) ||
      d.vocab.length > MAX_VOCAB ||
      d.vocab.some((v) => typeof v !== 'string' || v.length > MAX_VOCAB_ENTRY)
    ) {
      throw new HttpsError('invalid-argument', 'The bottle list is invalid.');
    }
    // Collapse whitespace so one entry cannot smuggle a line break into the prompt.
    vocab = (d.vocab as string[]).map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  return { image: d.image, mimeType: d.mimeType.toLowerCase(), vocab };
}

const BAD_OUTPUT = 'The photo reader gave an answer we could not use. Try again.';

/** Lenient parse + shape check. Throws HttpsError('internal') on anything unusable. */
export function parseModelOutput(text: string): ScanBarResult {
  let raw = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw);
  if (fenced) raw = fenced[1];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) throw new HttpsError('internal', BAD_OUTPUT);
    try {
      parsed = JSON.parse(raw.slice(a, b + 1));
    } catch {
      throw new HttpsError('internal', BAD_OUTPUT);
    }
  }
  const obj = parsed as { bottles?: unknown; other?: unknown } | null;
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.bottles)) {
    throw new HttpsError('internal', BAD_OUTPUT);
  }
  const bottles: ScannedBottle[] = [];
  for (const b of obj.bottles) {
    const e = b as Record<string, unknown> | null;
    if (!e || typeof e !== 'object') continue;
    const label = typeof e.label === 'string' ? e.label.trim() : '';
    const type = typeof e.type === 'string' ? e.type.trim() : '';
    if (!label || !type) continue;
    const key = typeof e.key === 'string' ? e.key.trim() : '';
    const c = typeof e.confidence === 'string' ? e.confidence.toLowerCase() : '';
    const confidence: Confidence = c === 'high' || c === 'medium' ? c : 'low';
    bottles.push({ label, type, key, confidence });
  }
  const other = Array.isArray(obj.other)
    ? obj.other.filter((o): o is string => typeof o === 'string' && o.trim() !== '').map((o) => o.trim())
    : [];
  return { bottles: bottles.slice(0, MAX_BOTTLES), other: other.slice(0, MAX_BOTTLES) };
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const BAD_CODE = "That code isn't valid. Check it with whoever gave it to you.";

/** Trimmed code if it has the right shape (8-64 of A-Z a-z 0-9 -), else null. */
export function codeShape(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(code) ? code : null;
}

/** A code's own cap if it is a whole number from 1 to 200, else the default. */
export function capFor(dailyCap: unknown): number {
  return typeof dailyCap === 'number' && Number.isInteger(dailyCap) && dailyCap >= 1 && dailyCap <= MAX_DAILY_CAP
    ? dailyCap
    : DAILY_SCAN_CAP;
}

export async function handleScanBar(data: unknown, deps: BarScanDeps): Promise<ScanBarResult> {
  // The code is checked first. Missing, malformed, unknown and disabled codes
  // all get the same answer, so a guesser learns nothing.
  const code = codeShape((data as { code?: unknown } | null | undefined)?.code);
  if (!code) throw new HttpsError('permission-denied', BAD_CODE);
  const entry = await deps.codes.get(code);
  if (!entry || entry.enabled !== true) throw new HttpsError('permission-denied', BAD_CODE);

  // The code itself is never logged: its label and a short one-way fingerprint are.
  const who = {
    code: entry.label,
    fp: createHash('sha256').update(code).digest('hex').slice(0, 8),
  };

  const { image, mimeType, vocab } = validateRequest(data);
  const bytes = approxDecodedBytes(image);

  const startedAt = deps.now();
  const day = utcDay(startedAt);
  const cap = capFor(entry.dailyCap);
  const used = await deps.usage.get(code, day);
  if (used >= cap) {
    deps.log('scanBar', { ...who, bytes, mimeType, outcome: 'over-cap' });
    throw new HttpsError(
      'resource-exhausted',
      `This code has used its ${cap} photo scans for today. Try again tomorrow, or add bottles by typing.`,
    );
  }
  // Counted when the model is actually called, so a failed call still costs a scan.
  await deps.usage.increment(code, day);

  const sleep = deps.sleep ?? defaultSleep;
  const prompt = buildPrompt(vocab);
  let text = '';
  for (let attempt = 0; ; attempt += 1) {
    try {
      text = await deps.askModel(image, mimeType, prompt, RESPONSE_SCHEMA);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /(503|429)/.test(msg);
      // The owner's key is on a small free daily quota. A used-up daily quota
      // does not come back in seconds: do not retry it.
      if (retryable && /per day|free_tier/i.test(msg)) {
        deps.log('scanBar', { ...who, bytes, mimeType, outcome: 'quota', ms: deps.now() - startedAt });
        throw new HttpsError('unavailable', 'The photo reader is out of capacity for today. Try again tomorrow, or add bottles by typing.');
      }
      if (!retryable) {
        // Only the status number and Google's reason token are logged, never the
        // error text itself (it could echo the photo): enough to tell a bad key
        // from a bad request.
        const status = /\[(\d{3}) /.exec(msg)?.[1] ?? '';
        const reason = /"reason":"([A-Z_]{1,40})"/.exec(msg)?.[1] ?? '';
        deps.log('scanBar', { ...who, bytes, mimeType, outcome: 'model-error', status, reason, ms: deps.now() - startedAt });
        throw new HttpsError('internal', 'The photo reader could not read that photo. Try again.');
      }
      const wait = RETRY_BASE_MS * 2 ** attempt;
      if (attempt >= MAX_RETRIES || deps.now() - startedAt + wait > MODEL_BUDGET_MS) {
        deps.log('scanBar', { ...who, bytes, mimeType, outcome: 'busy', attempts: attempt + 1, ms: deps.now() - startedAt });
        throw new HttpsError('unavailable', 'The photo reader is busy. Try again in a minute.');
      }
      await sleep(wait);
    }
  }

  let result: ScanBarResult;
  try {
    result = parseModelOutput(text);
  } catch (err) {
    deps.log('scanBar', { ...who, bytes, mimeType, outcome: 'bad-output', ms: deps.now() - startedAt });
    throw err;
  }
  deps.log('scanBar', {
    ...who,
    bytes,
    mimeType,
    outcome: 'ok',
    bottles: result.bottles.length,
    other: result.other.length,
    ms: deps.now() - startedAt,
  });
  return result;
}