/**
 * profileMerge.js (PROFILE-2) — reconciling the device copy and the account copy of the profile, with removal
 * markers so a deletion on one device is not undone by the other. Pure.
 *
 *   profile.removed = { [listName]: { [identity]: removedAtMs } }      listName in TRACKED
 *
 * List        identity                          item time (last change)        removal is recorded by
 * recipes     name, trimmed, lower-case          none (0)                       marker
 * cocktails   id                                 updatedAt / createdAt, if any  marker
 * sauces      id                                 updatedAt / createdAt, if any  marker
 * cuisines    the string                         none (0)                       marker
 * ingredients the string                         none (0)                       marker
 * pairings    canonical pair "a<sep>b"           none (0)                       marker
 * shares      id (10 chars)                      createdAt                      marker
 * shopping    (own markers, shoppingStore.js)    updatedAt                      its own `removed`
 *
 * The rule per list (same as the shopping list's): the union of the two copies, then an item is dropped when a
 * marker exists whose time is NOT older than the item's own last change; an item changed after the removal
 * stays and the marker is dropped. An item with no time is always older than its marker, so the marker wins.
 * Markers merge by the later time, are pruned after 30 days and held to REMOVED_CAP entries (the newest kept).
 * A device offline for more than 30 days can therefore still bring a removed item back.
 * Putting the same thing back clears its marker (withRemovals sees it present).
 */
import { mergeShopping } from './shoppingStore.js';

export const TRACKED = Object.freeze(['recipes', 'cocktails', 'sauces', 'cuisines', 'ingredients', 'pairings', 'shares']);
export const REMOVED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const REMOVED_CAP = 400;
const ID_MAX = 120;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const arr = (v) => (Array.isArray(v) ? v : []);

/** Canonical favourite pairing: lower-cased, trimmed, a < b; null when unusable. */
export function canonicalPairing(a, b) {
  const lo = String(a || '').toLowerCase().trim();
  const hi = String(b || '').toLowerCase().trim();
  if (!lo || !hi || lo === hi) return null;
  return lo < hi ? { a: lo, b: hi } : { a: hi, b: lo };
}
export const pairingKey = (p) => (p ? `${p.a}\u0001${p.b}` : '');

/** The identity string of an item in a tracked list, or '' when it has none (then it is never tracked). */
export function identityOf(list, item) {
  let id = '';
  switch (list) {
    case 'recipes': id = typeof item?.name === 'string' ? item.name.trim().toLowerCase() : ''; break;
    case 'cocktails':
    case 'sauces':
    case 'shares': id = typeof item?.id === 'string' ? item.id : ''; break;
    case 'cuisines':
    case 'ingredients': id = typeof item === 'string' ? item : ''; break;
    case 'pairings': { const c = canonicalPairing(item?.a, item?.b); id = c ? pairingKey(c) : ''; break; }
    default: id = '';
  }
  return id.slice(0, ID_MAX);
}

/** The time of an item's last change in ms (updatedAt, else createdAt as a number or a date string), or 0. */
export function itemTime(item) {
  if (!isObj(item)) return 0;
  let best = 0;
  for (const v of [item.updatedAt, item.createdAt]) {
    const t = finite(v) ? v : (typeof v === 'string' ? Date.parse(v) : NaN);
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best;
}

export const emptyRemoved = () => ({});

function prune(removed, now) {
  const rows = [];
  for (const list of TRACKED) {
    for (const [id, at] of Object.entries(removed[list] || {})) if (now - at <= REMOVED_MAX_AGE_MS) rows.push([list, id, at]);
  }
  rows.sort((x, y) => y[2] - x[2] || (x[1] < y[1] ? -1 : 1));
  const out = {};
  for (const [list, id, at] of rows.slice(0, REMOVED_CAP)) (out[list] ||= {})[id] = at;
  return out;
}

/** Anything -> a clean markers object (bad entries, unknown lists and anything older than 30 days dropped). */
export function cleanRemoved(raw, { now = Date.now() } = {}) {
  const out = {};
  if (isObj(raw)) {
    for (const list of TRACKED) {
      if (!isObj(raw[list])) continue;
      for (const [id, at] of Object.entries(raw[list])) {
        if (id && id.length <= ID_MAX && finite(at)) (out[list] ||= {})[id] = at;
      }
    }
  }
  return prune(out, now);
}

export function mergeRemoved(a, b, { now = Date.now() } = {}) {
  const out = {};
  for (const src of [cleanRemoved(a, { now }), cleanRemoved(b, { now })]) {
    for (const list of Object.keys(src)) {
      for (const [id, at] of Object.entries(src[list])) {
        out[list] ||= {};
        out[list][id] = Math.max(out[list][id] ?? 0, at);
      }
    }
  }
  return prune(out, now);
}

/**
 * The markers after the cook changed the profile from `prev` to `next`: everything that was in a tracked list
 * and is no longer gets a marker stamped `now`; anything present again loses its marker. Returns `next` with
 * `removed` set (the same object when nothing about markers changed and next already carries them).
 */
export function withRemovals(prev, next, { now = Date.now() } = {}) {
  const removed = cleanRemoved(prev?.removed, { now });
  for (const list of TRACKED) {
    const present = new Set(arr(next?.[list]).map((it) => identityOf(list, it)).filter(Boolean));
    for (const it of arr(prev?.[list])) {
      const id = identityOf(list, it);
      if (id && !present.has(id)) (removed[list] ||= {})[id] = now;
    }
    for (const id of present) if (removed[list]) delete removed[list][id];
    if (removed[list] && !Object.keys(removed[list]).length) delete removed[list];
  }
  return { ...next, removed: prune(removed, now) };
}

function mergeList(list, a, b, markers) {
  const seen = new Set();
  const union = [];
  for (const it of [...a, ...b]) {
    const id = identityOf(list, it);
    if (id) { if (seen.has(id)) continue; seen.add(id); }
    union.push(it);
  }
  const gone = markers[list];
  if (!gone) return { items: union, revived: [] };
  const items = [];
  const revived = [];
  for (const it of union) {
    const id = identityOf(list, it);
    const at = id ? gone[id] : undefined;
    if (at !== undefined && at >= itemTime(it)) continue;
    if (at !== undefined) revived.push(id);
    items.push(it);
  }
  return { items, revived };
}

/** Reconcile two profiles (see the header). Idempotent; `local` items come first. */
export function mergeProfiles(local, cloud, { now = Date.now() } = {}) {
  const markers = mergeRemoved(local.removed, cloud.removed, { now });
  const out = {};
  for (const list of TRACKED) {
    const { items, revived } = mergeList(list, arr(local[list]), arr(cloud[list]), markers);
    out[list] = items;
    for (const id of revived) delete markers[list][id];
  }
  for (const list of Object.keys(markers)) if (!Object.keys(markers[list]).length) delete markers[list];
  return {
    ...out,
    removed: markers,
    quizAnswers: cloud.quizAnswers || local.quizAnswers || null,
    shopping: mergeShopping(local.shopping, cloud.shopping),
  };
}
