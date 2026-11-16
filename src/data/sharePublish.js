/**
 * sharePublish.js — turning something the cook made into a public, frozen copy (shared/{id}) and
 * back into the shape the shared page renders. Pure: no React, no Firebase.
 *
 *   SHARE_LIMITS                       every length the rules and the functions also enforce
 *   toSharedDoc(item, ctx)             item -> the public document, or null when it is not shareable
 *   fromSharedDoc(doc, id)             a document read back (untrusted) -> normalised recipe, or null
 *   newShareId()                       10 random characters, no lookalikes
 *   shareFingerprint(item)             stable hash of the shareable content (an unedited item keeps its link)
 *   itemFromRecipe(recipe)             a Cookbook recipe -> the saved-item shape the functions above take
 *   firstName(displayName)             the "My first name" choice
 *
 * The public document holds ONLY what is built here: never an email, display name or photo. `owner`
 * (the uid) is stored for the rules, unshare and takedown and is never shown.
 *
 * Document: { kind: 'cocktail'|'sauce'|'recipe', name, lines: [{ key, amount, role? }], method?, glass?,
 *   category?, protein?, bars: [{ label, color, score }], by: string|null, owner, createdAt: number, removed: false }
 */
import { SHARE_CHARTS_ENABLED } from './shareTargets.js';

export const SHARE_LIMITS = Object.freeze({
  name: 80, by: 30, lines: 40, key: 60, amount: 30, role: 30, method: 2000,
  glass: 60, category: 60, protein: 60, bars: 17, barLabel: 20, live: 50,
});

export const SHARE_DOC_KINDS = Object.freeze(['cocktail', 'sauce', 'recipe']);
export const SHARE_ID_LENGTH = 10;
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const PAGE_KIND = { cocktail: 'cocktail', sauce: 'sauce', recipe: 'dish' };

const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

function oneLine(v, max) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).replace(/\s+/g, ' ').replace(CONTROL, '').trim().slice(0, max);
}

function multiLine(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').split('\n').map((s) => s.replace(/\t/g, ' ').replace(CONTROL, '').replace(/\s+$/g, '')).join('\n').trim().slice(0, max);
}

function cleanLines(lines) {
  const out = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    if (out.length >= SHARE_LIMITS.lines) break;
    const o = l && typeof l === 'object' ? l : { key: l };
    const key = oneLine(o.key ?? o.name, SHARE_LIMITS.key);
    if (!key) continue;
    const role = oneLine(typeof o.role === 'string' ? o.role : '', SHARE_LIMITS.role);
    out.push({ key, amount: oneLine(o.amount, SHARE_LIMITS.amount), ...(role ? { role } : {}) });
  }
  return out;
}

function cleanBars(bars) {
  const out = [];
  for (const b of Array.isArray(bars) ? bars : []) {
    if (out.length >= SHARE_LIMITS.bars) break;
    if (!b || typeof b !== 'object') continue;
    const label = oneLine(b.label, SHARE_LIMITS.barLabel);
    const color = typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color.toLowerCase() : '';
    const score = typeof b.score === 'number' && Number.isFinite(b.score) && b.score >= 0 && b.score <= 1 ? Math.round(b.score * 1000) / 1000 : null;
    if (!label || !color || score === null) continue;
    out.push({ label, color, score });
  }
  return out;
}

/** The content fields, cleaned and capped. Shared by toSharedDoc, fromSharedDoc and the fingerprint. */
function cleanContent(x) {
  const name = typeof x.name === 'string' ? oneLine(x.name, SHARE_LIMITS.name) : '';
  const lines = cleanLines(x.lines);
  const method = multiLine(x.method ?? x.instructions, SHARE_LIMITS.method);
  const glass = oneLine(x.glass, SHARE_LIMITS.glass);
  const category = oneLine(x.category, SHARE_LIMITS.category);
  const protein = oneLine(x.protein, SHARE_LIMITS.protein);
  return { name, lines, method, glass, category, protein };
}

/**
 * @param {object} item  saved-item shape { name, lines:[{key,amount,role}], method?, glass?, category?, protein? }
 * @param {{ kind: 'cocktail'|'sauce'|'recipe', uid: string, by?: string|null, bars?: object[], now?: number }} ctx
 * @returns {object|null}
 */
export function toSharedDoc(item, { kind, uid, by = null, bars = [], now = Date.now() } = {}) {
  if (!item || typeof item !== 'object' || !SHARE_DOC_KINDS.includes(kind)) return null;
  if (typeof uid !== 'string' || !uid) return null;
  const c = cleanContent(item);
  if (!c.name || !c.lines.length) return null;
  const who = oneLine(by, SHARE_LIMITS.by);
  return {
    kind,
    name: c.name,
    lines: c.lines,
    ...(c.method ? { method: c.method } : {}),
    ...(c.glass ? { glass: c.glass } : {}),
    ...(c.category ? { category: c.category } : {}),
    ...(c.protein ? { protein: c.protein } : {}),
    bars: SHARE_CHARTS_ENABLED ? cleanBars(bars) : [],
    by: who || null,
    owner: uid,
    createdAt: typeof now === 'number' && Number.isFinite(now) ? now : Date.now(),
    removed: false,
  };
}

/**
 * A document read from Firestore (treat as untrusted: the rules cannot check each line) -> the
 * normalised recipe SharedRecipePage renders, or null for a missing, removed or unusable one.
 * { kind: 'cocktail'|'sauce'|'dish', slug: id, shareId: id, name, lines:[{key,amount}], method, glass,
 *   category, categoryId, by, garnish? omitted }
 */
export function fromSharedDoc(doc, id) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.removed === true) return null;
  const docKind = SHARE_DOC_KINDS.includes(doc.kind) ? doc.kind : null;
  const sid = typeof id === 'string' ? id : '';
  if (!docKind || !sid) return null;
  const c = cleanContent(doc);
  if (!c.name || !c.lines.length) return null;
  const by = oneLine(doc.by, SHARE_LIMITS.by);
  return {
    kind: PAGE_KIND[docKind],
    slug: sid,
    shareId: sid,
    name: c.name,
    lines: c.lines.map((l) => ({ key: l.key, amount: l.amount })),
    method: c.method,
    glass: c.glass || null,
    category: docKind === 'cocktail' ? null : (c.category || null),
    categoryId: c.category || null,
    by: by || null,
  };
}

/** 10 characters from an alphabet without 0/o/1/l/i, via crypto.getRandomValues (rejection sampling: no bias). */
export function newShareId() {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) throw new Error('No secure random source available.');
  const limit = 256 - (256 % ID_ALPHABET.length);
  let id = '';
  while (id.length < SHARE_ID_LENGTH) {
    const buf = new Uint8Array(SHARE_ID_LENGTH * 2);
    cryptoObj.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit && id.length < SHARE_ID_LENGTH) id += ID_ALPHABET[b % ID_ALPHABET.length];
    }
  }
  return id;
}

/** cyrb53: a small, stable, non-cryptographic hash. Enough to tell "edited" from "not edited". */
function hash53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** Same content (after the same cleaning as publishing) -> same fingerprint. The chosen `by` is not part of it. */
export function shareFingerprint(item) {
  if (!item || typeof item !== 'object') return '';
  const c = cleanContent(item);
  return hash53(JSON.stringify([
    item.kind || '', c.name, c.lines.map((l) => [l.key, l.amount, l.role || '']), c.method, c.glass, c.category, c.protein,
  ]));
}

function amountOf(ing) {
  if (typeof ing.quantity === 'number' && Number.isFinite(ing.quantity)) {
    return `${Math.round(ing.quantity * 100) / 100}${ing.unit ? ` ${ing.unit}` : ''}`;
  }
  const raw = typeof ing.raw === 'string' ? ing.raw : '';
  const name = typeof ing.name === 'string' ? ing.name : '';
  if (!raw || !name) return '';
  const i = raw.toLowerCase().indexOf(name.toLowerCase());
  return i < 0 ? '' : `${raw.slice(0, i)}${raw.slice(i + name.length)}`.replace(/[\s,]+$/g, '').trim();
}

/** A Cookbook recipe { name, ingredients:[{name,quantity,unit,raw}], instructions, cuisine, id } -> saved-item shape. */
export function itemFromRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  const ings = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  return {
    id: typeof recipe.id === 'string' ? recipe.id : '',
    name: recipe.name,
    kind: 'recipe',
    category: recipe.cuisine || null,
    lines: ings.map((i) => (typeof i === 'string' ? { key: i, amount: '' } : { key: i?.name, amount: amountOf(i || {}) })),
    method: recipe.instructions || '',
  };
}

/** "Dan Schermele" -> "Dan"; '' when there is no usable name. */
export function firstName(displayName) {
  return oneLine(typeof displayName === 'string' ? displayName.trim().split(/\s+/)[0] : '', SHARE_LIMITS.by);
}
