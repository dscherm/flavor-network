/**
 * inventSaved.js — the shape of an item the cook invented and saved (a cocktail,
 * a sauce or a recipe), plus validation and the list helpers. Pure: the profile /
 * Firestore code stores whatever cleanSavedList returns; nothing here touches I/O.
 *
 * SavedItem = {
 *   id, name, createdAt, kind: 'cocktail'|'sauce'|'recipe',
 *   category: string|number|null,          the style / family / dish-type id the cook chose or accepted
 *   lines: [{ key, amount, role }],        amount '' when none; role null when none
 *   method?, glass?, protein?,             only present when given
 *   sharedFrom?,                           '<kind>/<slug>' of the shared recipe it was saved from
 *   picture?: { kind:'icon', icon, v } | { kind:'chalk', v }   see pictureField.js; a chalk picture's image is in profiles/{uid}/pictures/{id}
 *   source: 'invent',
 * }
 */
import { cleanPictureField } from './pictureField.js';

export const SAVED_LIMITS = Object.freeze({ perKind: 200, name: 80 });
export const SAVED_KINDS = Object.freeze(['cocktail', 'sauce', 'recipe']);

/** A fresh item id: letters, digits and hyphens only (it is also the picture document's name). */
export const newItemId = (now = Date.now()) => `inv-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const text = (v) => (typeof v === 'string' ? v.trim() : '');

function cleanLines(lines) {
  const seen = new Set();
  const out = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    const key = text(typeof l === 'string' ? l : l?.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, amount: text(l?.amount), role: l?.role == null || l.role === '' ? null : l.role });
  }
  return out;
}

/**
 * Validate and shape an item for saving.
 * @param {{ kind, name, category?, lines, method?, glass?, protein?, id?, createdAt? }} input
 * @param {{ now?: number, makeId?: () => string }} [ctx]
 * @returns {{ ok: true, item: SavedItem } | { ok: false, item: null, reason: string }}
 */
export function toSavedItem(input, { now = Date.now(), makeId } = {}) {
  const x = input || {};
  const fail = (reason) => ({ ok: false, item: null, reason });
  if (!SAVED_KINDS.includes(x.kind)) return fail('Unknown kind of item.');
  const name = text(x.name);
  if (!name) return fail('Give it a name first.');
  if (name.length > SAVED_LIMITS.name) return fail(`Keep the name to ${SAVED_LIMITS.name} characters.`);
  const lines = cleanLines(x.lines);
  if (lines.length < 2) return fail('Add at least two ingredients first.');
  const gen = makeId || (() => newItemId(now));
  const item = {
    id: x.id || gen(),
    name,
    createdAt: x.createdAt ?? now,
    kind: x.kind,
    category: x.category ?? null,
    lines,
    ...(text(x.method) ? { method: text(x.method) } : {}),
    ...(text(x.glass) ? { glass: text(x.glass) } : {}),
    ...(text(x.protein) ? { protein: text(x.protein) } : {}),
    ...(text(x.sharedFrom) ? { sharedFrom: text(x.sharedFrom) } : {}),
    ...(cleanPictureField(x.picture) ? { picture: cleanPictureField(x.picture) } : {}),
    source: 'invent',
  };
  return { ok: true, item };
}

/**
 * Reopen a saved item in the panel: { name, baseline, lines } where
 * baseline = { category, glass?, protein?, method? } and lines are
 * [{ key, source: 'user', amount, role }] ready for openBuild / applyCategory.
 */
export function fromSavedItem(item) {
  const it = item || {};
  return {
    name: text(it.name),
    baseline: {
      category: it.category ?? null,
      ...(it.glass ? { glass: it.glass } : {}),
      ...(it.protein ? { protein: it.protein } : {}),
      ...(it.method ? { method: it.method } : {}),
    },
    ...(cleanPictureField(it.picture) ? { picture: cleanPictureField(it.picture) } : {}),
    lines: cleanLines(it.lines).map((l) => ({ ...l, source: 'user' })),
  };
}

const isValid = (it) => it && typeof it === 'object' && typeof it.id === 'string' && it.id
  && SAVED_KINDS.includes(it.kind) && text(it.name) && cleanLines(it.lines).length >= 2;

/** A safe array from whatever was stored: malformed entries dropped, repeated ids keep the first, capped at perKind. */
export function cleanSavedList(maybeArray) {
  if (!Array.isArray(maybeArray)) return [];
  const seen = new Set();
  const out = [];
  for (const it of maybeArray) {
    if (!isValid(it) || seen.has(it.id)) continue;
    seen.add(it.id);
    const { picture, ...rest } = it;
    const pic = cleanPictureField(picture);
    out.push({ ...rest, name: text(it.name).slice(0, SAVED_LIMITS.name), lines: cleanLines(it.lines), ...(pic ? { picture: pic } : {}) });
    if (out.length >= SAVED_LIMITS.perKind) break;
  }
  return out;
}

/** Replace the item with the same id in place, else put it first (newest first); capped. */
export function upsertSaved(list, item) {
  const base = cleanSavedList(list);
  const at = base.findIndex((x) => x.id === item.id);
  const next = at >= 0 ? base.map((x, i) => (i === at ? item : x)) : [item, ...base];
  return next.slice(0, SAVED_LIMITS.perKind);
}

export function removeSaved(list, id) {
  return cleanSavedList(list).filter((x) => x.id !== id);
}
