// SHARE-6. Reading a user's shared recipe (shared/{id}) for the two public functions.
// The document is UNTRUSTED input: the Firestore rules cap the sizes of its top-level fields and the
// length of the lists, but cannot check what is inside each line. Everything is re-validated and capped
// here before it reaches the preview HTML or the card renderer. Pure and dependency-injected; the
// Firestore read itself lives in index.ts.

import type { CardData } from './card';
import type { SharedLookup } from './handler';

export const LIMITS = { name: 80, key: 60, amount: 30, glass: 60, category: 60, lines: 40, bars: 17, barLabel: 20 } as const;
export const SHARED_TTL_MS = 3 * 60_000;
const KINDS = ['cocktail', 'sauce', 'recipe'] as const;
const NOUN: Record<string, string> = { cocktail: 'cocktail', sauce: 'sauce', recipe: 'dish' };
const SITE = 'Neural Flavor';
const MAX_DESC = 160;

export interface CleanShared {
  kind: (typeof KINDS)[number];
  name: string;
  lines: { key: string; amount: string }[];
  bars: { label: string; color: string; score: number }[];
  glass?: string;
  category?: string;
}

const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

function text(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\s+/g, ' ').replace(CONTROL, '').trim().slice(0, max);
}

/** The document as plain, capped data; null when it is missing, removed or not a usable recipe. */
export function sanitizeShared(raw: unknown): CleanShared | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (d.removed === true) return null;
  const kind = (KINDS as readonly unknown[]).includes(d.kind) ? (d.kind as CleanShared['kind']) : null;
  const name = text(d.name, LIMITS.name);
  if (!kind || !name) return null;
  const lines: CleanShared['lines'] = [];
  for (const l of Array.isArray(d.lines) ? d.lines : []) {
    if (lines.length >= LIMITS.lines) break;
    if (!l || typeof l !== 'object') continue;
    const o = l as Record<string, unknown>;
    const key = text(o.key, LIMITS.key);
    if (key) lines.push({ key, amount: text(o.amount, LIMITS.amount) });
  }
  if (!lines.length) return null;
  const bars: CleanShared['bars'] = [];
  for (const b of Array.isArray(d.bars) ? d.bars : []) {
    if (bars.length >= LIMITS.bars) break;
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    const label = text(o.label, LIMITS.barLabel);
    const color = typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color.toLowerCase() : '';
    const score = typeof o.score === 'number' && Number.isFinite(o.score) && o.score >= 0 && o.score <= 1 ? o.score : null;
    if (label && color && score !== null) bars.push({ label, color, score });
  }
  const glass = text(d.glass, LIMITS.glass);
  const category = text(d.category, LIMITS.category);
  return { kind, name, lines, bars, ...(glass ? { glass } : {}), ...(category ? { category } : {}) };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Same wording as the built-in recipes' preview: the first ingredients, then "A <kind> on Neural Flavor." */
export function describeShared(c: CleanShared): string {
  const names: string[] = [];
  for (const l of c.lines) {
    if (!names.some((x) => x.toLowerCase() === l.key.toLowerCase())) names.push(l.key);
    if (names.length === 4) break;
  }
  const tail = ` A ${NOUN[c.kind]} on ${SITE}.`;
  while (names.length) {
    const out = `${cap(names.join(', ').toLowerCase())}.${tail}`;
    if (out.length <= MAX_DESC) return out;
    names.pop();
  }
  return `A ${NOUN[c.kind]} on ${SITE}.`;
}

export function toPreview(c: CleanShared): SharedLookup {
  return { name: c.name, description: describeShared(c) };
}

export function toCardData(c: CleanShared): CardData {
  return {
    name: c.name,
    kind: c.kind === 'recipe' ? 'dish' : c.kind,
    lines: c.lines.slice(0, 8).map((l) => ({ label: l.key, ...(l.amount ? { amount: l.amount } : {}) })),
    lineCount: c.lines.length,
    bars: c.bars,
    ...(c.category ? { category: c.category } : {}),
    ...(c.glass ? { glass: c.glass } : {}),
  };
}

/**
 * One cached read per id, shared by both functions in an instance. A removed share is served for at most
 * `ttlMs` more after it is removed (misses are cached for the same time, so a viral wrong id costs one read).
 */
export function createSharedLookup(
  read: (id: string) => Promise<unknown>,
  opts: { ttlMs?: number; now?: () => number; maxEntries?: number } = {},
) {
  const ttl = opts.ttlMs ?? SHARED_TTL_MS;
  const now = opts.now ?? Date.now;
  const max = opts.maxEntries ?? 500;
  const cache = new Map<string, { at: number; value: CleanShared | null }>();

  async function get(id: string): Promise<CleanShared | null> {
    if (!/^[a-z0-9]{10}$/.test(id)) return null;
    const hit = cache.get(id);
    if (hit && now() - hit.at < ttl) return hit.value;
    const value = sanitizeShared(await read(id));
    if (cache.size >= max) cache.delete(cache.keys().next().value as string);
    cache.set(id, { at: now(), value });
    return value;
  }

  return {
    get,
    async preview(id: string): Promise<SharedLookup | null> {
      const c = await get(id);
      return c ? toPreview(c) : null;
    },
    async card(id: string): Promise<CardData | null> {
      const c = await get(id);
      return c ? toCardData(c) : null;
    },
  };
}
