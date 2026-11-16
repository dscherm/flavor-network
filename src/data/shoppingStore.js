/**
 * shoppingStore.js (SHOP-2) — where the shopping list lives and how two copies of it are reconciled.
 * Pure except load/saveShopping, which take a storage object and never throw.
 *
 *   ShoppingState = { list: { items, recipes }, removed: { [itemId]: removedAtMs } }
 *
 * `list` is the SHOP-1 list. `removed` is the set of tombstones: shoppingList.js has none (an item that is
 * removed, cleared, put in the kitchen or folded into another line simply is not in the list any more), and
 * without a record of that, a second device that still has the item would bring it back at the next merge.
 * commitList() makes the tombstones itself by comparing the list before and after any change, so every
 * way an item can leave is covered without each caller remembering to say so.
 *
 * Device: one localStorage key, SHOPPING_KEY. A missing, corrupt or older-version value is ignored (an empty
 * list), and a storage that throws (a private window) just means the list lives for the session.
 * Account: the same object is the `shopping` field of the profile document (see useUserProfile).
 *
 * MERGE (mergeShopping), per item id, last change wins, using each item's updatedAt:
 *   - on both sides            -> the one with the larger updatedAt (a tie is broken by comparing the
 *                                 items' JSON, so both devices pick the same one);
 *   - on one side only         -> kept, unless the other side has a tombstone for it that is NOT older
 *                                 than the item's last change (an edit made after the removal revives it;
 *                                 at an exact tie the removal wins);
 *   - tombstones               -> merged by the later time, pruned after TOMBSTONE_MAX_AGE_MS (30 days) and
 *                                 held to TOMBSTONE_CAP entries (the newest kept). Past 30 days a removed
 *                                 item from a device that was offline the whole time can reappear.
 *   - order                    -> this device's items first, then the other device's new ones.
 *   - over 200 items           -> checked items go first, oldest change first, then the oldest unchecked.
 * Examples (see the tests): check on A + add on B = both kept; remove on A + edit on B later = the edit
 * wins and the item stays; "Clear all" on A + an item B added afterwards = only B's new item survives.
 */
import { emptyList, MAX_ITEMS } from './shoppingList.js';

export const SHOPPING_KEY = 'fn-shopping-v1';
export const SHOPPING_VERSION = 1;
export const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const TOMBSTONE_CAP = 300;
const RECIPE_CAP = 60;

export const emptyShopping = () => ({ list: emptyList(), removed: {} });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function cleanItem(raw) {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 80);
  const key = str(raw.key, 120);
  if (!id || !key) return null;
  const parts = (Array.isArray(raw.parts) ? raw.parts : [])
    .filter((p) => isObj(p) && finite(p.qty) && p.qty > 0)
    .slice(0, 6)
    .map((p) => ({ qty: p.qty, unit: str(p.unit, 30) }));
  const item = {
    id, key,
    label: str(raw.label, 120) || key,
    parts,
    checked: raw.checked === true,
    from: (Array.isArray(raw.from) ? raw.from : []).filter((x) => typeof x === 'string').slice(0, 40).map((x) => x.slice(0, 120)),
    updatedAt: finite(raw.updatedAt) ? raw.updatedAt : 0,
  };
  if (typeof raw.swappedFrom === 'string' && raw.swappedFrom) item.swappedFrom = raw.swappedFrom.slice(0, 120);
  if (typeof raw.note === 'string' && raw.note) item.note = raw.note.slice(0, 200);
  if (isObj(raw.was)) {
    try { item.was = JSON.parse(JSON.stringify(raw.was)); } catch { /* not JSON: dropped */ }
  }
  return item;
}

function cleanRecipe(raw) {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 120);
  if (!id) return null;
  return { id, kind: str(raw.kind, 30), name: str(raw.name, 120), addedAt: finite(raw.addedAt) ? raw.addedAt : 0 };
}

function pruneRemoved(removed, now) {
  const entries = Object.entries(removed).filter(([, at]) => now - at <= TOMBSTONE_MAX_AGE_MS);
  entries.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return Object.fromEntries(entries.slice(0, TOMBSTONE_CAP));
}

function cleanRemoved(raw, now) {
  const out = {};
  if (isObj(raw)) for (const [id, at] of Object.entries(raw)) if (id && id.length <= 80 && finite(at)) out[id] = at;
  return pruneRemoved(out, now);
}

/**
 * Anything (a parsed storage value, a cloud field) -> a clean state. Never throws; undefined, NaN and
 * malformed entries are dropped, so the result is always safe to hand to Firestore.
 */
export function cleanShopping(raw, { now = Date.now() } = {}) {
  const src = isObj(raw) ? raw : {};
  const list = isObj(src.list) ? src.list : {};
  const seen = new Set();
  const items = [];
  for (const r of Array.isArray(list.items) ? list.items : []) {
    const item = cleanItem(r);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  const used = new Set(items.flatMap((i) => i.from));
  const recipes = (Array.isArray(list.recipes) ? list.recipes : []).map(cleanRecipe).filter((r) => r && used.has(r.id)).slice(0, RECIPE_CAP);
  return { list: { items, recipes }, removed: cleanRemoved(src.removed, now) };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const sameShopping = (a, b) => same(cleanShopping(a, { now: 0 }).list, cleanShopping(b, { now: 0 }).list)
  && same(Object.entries(a?.removed || {}).sort(), Object.entries(b?.removed || {}).sort());

/** True for a state with nothing in it (no items and no tombstones to carry). */
export const isEmptyShopping = (s) => !s || (!(s.list?.items || []).length && !Object.keys(s.removed || {}).length);

function pickNewer(a, b) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

/** Reconcile two copies (see the header). Idempotent, and the same set of items whichever side is `a`. */
export function mergeShopping(a, b, { now = Date.now() } = {}) {
  const A = cleanShopping(a, { now });
  const B = cleanShopping(b, { now });
  const removed = { ...A.removed };
  for (const [id, at] of Object.entries(B.removed)) removed[id] = Math.max(removed[id] ?? 0, at);

  const byId = new Map();
  for (const item of [...A.list.items, ...B.list.items]) {
    const cur = byId.get(item.id);
    byId.set(item.id, cur ? pickNewer(cur, item) : item);
  }
  const survivors = [];
  const revived = new Set();
  for (const item of byId.values()) {
    const gone = removed[item.id];
    if (gone !== undefined && gone >= item.updatedAt) continue;
    if (gone !== undefined) revived.add(item.id);
    survivors.push(item);
  }
  for (const id of revived) delete removed[id];

  // This device's order first, then the other's new items.
  const order = new Map();
  [...A.list.items, ...B.list.items].forEach((i) => { if (!order.has(i.id)) order.set(i.id, order.size); });
  survivors.sort((x, y) => order.get(x.id) - order.get(y.id));

  let items = survivors;
  if (items.length > MAX_ITEMS) {
    const drop = new Set(
      [...items].sort((x, y) => (Number(y.checked) - Number(x.checked)) || (x.updatedAt - y.updatedAt) || (x.id < y.id ? -1 : 1))
        .slice(0, items.length - MAX_ITEMS).map((i) => i.id),
    );
    items = items.filter((i) => !drop.has(i.id));
  }

  const used = new Set(items.flatMap((i) => i.from));
  const recipes = [];
  for (const r of [...A.list.recipes, ...B.list.recipes]) if (used.has(r.id) && !recipes.some((x) => x.id === r.id)) recipes.push(r);
  return { list: { items, recipes: recipes.slice(0, RECIPE_CAP) }, removed: pruneRemoved(removed, now) };
}

/**
 * The state after the cook's change: `nextList` replaces the list, and every item that was in the old list
 * and is not in the new one gets a tombstone stamped `now`. An item that is back (same id) loses its tombstone.
 */
export function commitList(state, nextList, { now = Date.now() } = {}) {
  const prev = cleanShopping(state, { now });
  const next = cleanShopping({ list: nextList }, { now }).list;
  if (next.items.length === 0 && prev.list.items.length === 0 && next.recipes.length === 0) return prev;
  const present = new Set(next.items.map((i) => i.id));
  const removed = { ...prev.removed };
  for (const item of prev.list.items) if (!present.has(item.id)) removed[item.id] = now;
  for (const id of present) delete removed[id];
  return { list: next, removed: pruneRemoved(removed, now) };
}

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** The device copy. Missing, unreadable, corrupt or another version -> an empty list. */
export function loadShopping(storage = defaultStorage(), { now = Date.now() } = {}) {
  try {
    const raw = storage?.getItem(SHOPPING_KEY);
    if (!raw) return emptyShopping();
    const parsed = JSON.parse(raw);
    if (!isObj(parsed) || parsed.v !== SHOPPING_VERSION) return emptyShopping();
    return cleanShopping(parsed, { now });
  } catch {
    return emptyShopping();
  }
}

/** Write the device copy. Returns false when storage is unavailable or full (the list then lives for the session). */
export function saveShopping(state, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(SHOPPING_KEY, JSON.stringify({ v: SHOPPING_VERSION, list: state.list, removed: state.removed }));
    return true;
  } catch {
    return false;
  }
}
