// SHOP-2: the shopping store: cleaning, the per-item merge with tombstones, and the device copy.
import { describe, it, expect } from 'vitest';
import {
  SHOPPING_KEY, TOMBSTONE_MAX_AGE_MS, TOMBSTONE_CAP, emptyShopping, cleanShopping, mergeShopping, commitList,
  loadShopping, saveShopping, sameShopping, isEmptyShopping,
} from '../shoppingStore.js';
import { emptyList, addLine, toggle, remove, clearChecked, MAX_ITEMS } from '../shoppingList.js';

const T = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
let n = 0;
const newId = () => `id${++n}`;
const add = (list, key, at, amount) => addLine(list, { key, label: key, amount }, { now: at, newId }).list;
const ids = (s) => s.list.items.map((i) => i.key).sort();
const find = (s, key) => s.list.items.find((i) => i.key === key);
const st = (list, removed = {}) => ({ list, removed });

describe('cleanShopping', () => {
  it('a missing or odd value is an empty list', () => {
    for (const v of [undefined, null, 5, 'x', [], {}, { list: 3 }, { list: { items: 'x' } }]) {
      expect(cleanShopping(v, { now: T })).toEqual(emptyShopping());
    }
  });

  it('keeps well-formed items, drops malformed ones and duplicate ids, and never leaves undefined', () => {
    const good = { id: 'a', key: 'garlic', label: 'garlic', parts: [{ qty: 2, unit: 'clove' }], checked: false, from: ['r1'], updatedAt: 5 };
    const out = cleanShopping({
      list: {
        items: [good, { id: 'a', key: 'dup' }, { key: 'noid' }, null, 'x', { id: 'b', key: 'salt', label: undefined, parts: [{ qty: 'x' }, { qty: -1 }], checked: 'yes', note: undefined, was: { row: { id: 'z', undef: undefined } } }],
        recipes: [{ id: 'r1', kind: 'dish', name: 'Pasta', addedAt: 1 }, { id: 'unused', name: 'x' }],
      },
      removed: { a: 'bad', b: 3, '': 9 },
    }, { now: T });
    expect(out.list.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(out.list.items[1]).toEqual({ id: 'b', key: 'salt', label: 'salt', parts: [], checked: false, from: [], updatedAt: 0, was: { row: { id: 'z' } } });
    expect(out.list.recipes).toEqual([{ id: 'r1', kind: 'dish', name: 'Pasta', addedAt: 1 }]);
    expect(out.removed).toEqual({}); // 'bad' and '' are malformed; b:3 is far older than 30 days
    expect(JSON.stringify(out)).not.toContain('undefined');
  });

  it('holds the list to 200 items', () => {
    const items = Array.from({ length: 260 }, (_, i) => ({ id: `i${i}`, key: `k${i}`, label: `k${i}`, parts: [], checked: false, from: [], updatedAt: i }));
    expect(cleanShopping({ list: { items } }, { now: T }).list.items).toHaveLength(MAX_ITEMS);
  });
});

describe('commitList (tombstones are made from what left the list)', () => {
  it('removing, clearing checked and folding an unchecked twin each leave a tombstone', () => {
    let s = emptyShopping();
    let l = add(emptyList(), 'milk', T);
    l = add(l, 'rice', T);
    l = add(l, 'kale', T);
    s = commitList(s, l, { now: T });
    expect(s.removed).toEqual({});
    const milk = find(s, 'milk');
    s = commitList(s, remove(s.list, milk.id), { now: T + 1 });
    expect(s.removed).toEqual({ [milk.id]: T + 1 });
    const eggs = find(s, 'rice');
    s = commitList(s, clearChecked(toggle(s.list, eggs.id, { now: T + 2 })), { now: T + 3 });
    expect(s.removed[eggs.id]).toBe(T + 3);
    expect(ids(s)).toEqual(['kale']);
  });

  it('an item that comes back with the same id loses its tombstone', () => {
    const l = add(emptyList(), 'milk', T);
    let s = commitList(emptyShopping(), l, { now: T });
    s = commitList(s, emptyList(), { now: T + 1 });
    expect(Object.keys(s.removed)).toHaveLength(1);
    s = commitList(s, l, { now: T + 2 });
    expect(s.removed).toEqual({});
  });

  it('tombstones older than 30 days are pruned and the map is capped', () => {
    const old = { x: T - TOMBSTONE_MAX_AGE_MS - 1, y: T - TOMBSTONE_MAX_AGE_MS + 1000 };
    const s = commitList({ list: emptyList(), removed: old }, add(emptyList(), 'milk', T), { now: T });
    expect(s.removed).toEqual({ y: old.y });
    const many = {};
    for (let i = 0; i < TOMBSTONE_CAP + 50; i++) many[`t${i}`] = T - i;
    const c = cleanShopping({ removed: many }, { now: T });
    expect(Object.keys(c.removed)).toHaveLength(TOMBSTONE_CAP);
    expect(c.removed.t0).toBe(T);
    expect(c.removed[`t${TOMBSTONE_CAP + 10}`]).toBeUndefined();
  });
});

describe('mergeShopping, offline edits on both sides', () => {
  // Both devices start from the same synced copy (same item ids).
  const BASE = commitList(emptyShopping(), add(add(emptyList(), 'milk', T), 'rice', T), { now: T });
  const base = () => structuredClone(BASE);

  it('check on A, add on B: both survive', () => {
    const a0 = base();
    const b0 = base();
    const a = commitList(a0, toggle(a0.list, find(a0, 'milk').id, { now: T + 10 }), { now: T + 10 });
    const b = commitList(b0, add(b0.list, 'kale', T + 20), { now: T + 20 });
    for (const m of [mergeShopping(a, b, { now: T + 30 }), mergeShopping(b, a, { now: T + 30 })]) {
      expect(ids(m)).toEqual(['kale', 'milk', 'rice']);
      expect(find(m, 'milk').checked).toBe(true);
      expect(find(m, 'rice').checked).toBe(false);
    }
  });

  it('the later change to the same item wins, whichever side made it', () => {
    const a0 = base();
    const milk = find(a0, 'milk').id;
    const a = commitList(a0, toggle(a0.list, milk, { now: T + 10 }), { now: T + 10 });          // checked at +10
    const b = commitList(a0, toggle(toggle(a0.list, milk, { now: T + 5 }), milk, { now: T + 25 }), { now: T + 25 }); // unchecked again at +25
    expect(find(mergeShopping(a, b, { now: T + 30 }), 'milk').checked).toBe(false);
    expect(find(mergeShopping(b, a, { now: T + 30 }), 'milk').checked).toBe(false);
  });

  it('remove on A, no change on B: the item stays gone (the tombstone stops it coming back)', () => {
    const a0 = base();
    const b = base();
    const milk = find(a0, 'milk').id;
    const a = commitList(a0, remove(a0.list, milk), { now: T + 10 });
    expect(ids(mergeShopping(a, b, { now: T + 30 }))).toEqual(['rice']);
    expect(ids(mergeShopping(b, a, { now: T + 30 }))).toEqual(['rice']);
    expect(mergeShopping(a, b, { now: T + 30 }).removed[milk]).toBe(T + 10);
  });

  it('remove on A, edit on B LATER: the edit wins and the item stays (and its tombstone is dropped)', () => {
    const a0 = base();
    const b0 = base();
    const milk = find(a0, 'milk').id;
    const a = commitList(a0, remove(a0.list, milk), { now: T + 10 });
    const b = commitList(b0, toggle(b0.list, milk, { now: T + 20 }), { now: T + 20 });
    for (const m of [mergeShopping(a, b, { now: T + 30 }), mergeShopping(b, a, { now: T + 30 })]) {
      expect(ids(m)).toEqual(['milk', 'rice']);
      expect(find(m, 'milk').checked).toBe(true);
      expect(m.removed[milk]).toBeUndefined();
    }
  });

  it('remove on A, edit on B EARLIER than the removal: the removal wins', () => {
    const a0 = base();
    const b0 = base();
    const milk = find(a0, 'milk').id;
    const b = commitList(b0, toggle(b0.list, milk, { now: T + 5 }), { now: T + 5 });
    const a = commitList(a0, remove(a0.list, milk), { now: T + 10 });
    expect(ids(mergeShopping(a, b, { now: T + 30 }))).toEqual(['rice']);
  });

  it('Clear all on A while B added an item later: only B\'s later item survives', () => {
    const a0 = base();
    const b0 = base();
    const a = commitList(a0, emptyList(), { now: T + 10 });
    const b = commitList(b0, add(b0.list, 'kale', T + 20), { now: T + 20 });
    for (const m of [mergeShopping(a, b, { now: T + 30 }), mergeShopping(b, a, { now: T + 30 })]) {
      expect(ids(m)).toEqual(['kale']);
    }
  });

  it('Clear all on A, B edited one of the old items later: that item survives', () => {
    const a0 = base();
    const b0 = base();
    const eggs = find(b0, 'rice').id;
    const a = commitList(a0, emptyList(), { now: T + 10 });
    const b = commitList(b0, toggle(b0.list, eggs, { now: T + 20 }), { now: T + 20 });
    expect(ids(mergeShopping(a, b, { now: T + 30 }))).toEqual(['rice']);
  });

  it('is idempotent, and merging with an empty or missing copy changes nothing', () => {
    const a = base();
    const b = commitList(a, add(a.list, 'kale', T + 5), { now: T + 5 });
    const m = mergeShopping(a, b, { now: T + 30 });
    expect(sameShopping(mergeShopping(m, m, { now: T + 30 }), m)).toBe(true);
    expect(sameShopping(mergeShopping(m, undefined, { now: T + 30 }), m)).toBe(true);
    expect(sameShopping(mergeShopping(undefined, m, { now: T + 30 }), m)).toBe(true);
  });

  it('keeps this side\'s order first, then the other side\'s new items', () => {
    const a = commitList(emptyShopping(), add(add(emptyList(), 'a1', T), 'a2', T), { now: T });
    const b = commitList(emptyShopping(), add(emptyList(), 'b1', T + 1), { now: T + 1 });
    expect(mergeShopping(a, b, { now: T + 5 }).list.items.map((i) => i.key)).toEqual(['a1', 'a2', 'b1']);
  });

  it('over 200 items, checked ones go first, oldest first', () => {
    const mk = (prefix, count, at, checked) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, key: `${prefix}${i}`, label: 'x', parts: [], checked, from: [], updatedAt: at + i }));
    const a = { list: { items: [...mk('u', 130, 1000, false), ...mk('c', 30, 100, true)], recipes: [] }, removed: {} };
    const b = { list: { items: mk('n', 60, 5000, false), recipes: [] }, removed: {} };
    const m = mergeShopping(a, b, { now: T });
    expect(m.list.items).toHaveLength(MAX_ITEMS);
    expect(m.list.items.filter((i) => i.checked)).toHaveLength(10); // 220 in, 20 over: the 20 oldest checked ones go
  });

  it('a pruned tombstone no longer holds the item down (the stated limit)', () => {
    const l = add(emptyList(), 'milk', T);
    const withItem = commitList(emptyShopping(), l, { now: T });
    const gone = commitList(withItem, emptyList(), { now: T + 1 });
    expect(ids(mergeShopping(gone, withItem, { now: T + 5 }))).toEqual([]);
    expect(ids(mergeShopping(gone, withItem, { now: T + 31 * DAY }))).toEqual(['milk']);
  });
});

describe('the device copy', () => {
  const memory = (initial = {}) => {
    const data = { ...initial };
    return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
  };

  it('survives a reload (save then load)', () => {
    const storage = memory();
    const s = commitList(emptyShopping(), add(add(emptyList(), 'milk', T, '2 cups'), 'kale', T), { now: T });
    expect(saveShopping(s, storage)).toBe(true);
    expect(Object.keys(storage.data)).toEqual([SHOPPING_KEY]);
    expect(JSON.parse(storage.data[SHOPPING_KEY]).v).toBe(1);
    expect(loadShopping(storage, { now: T })).toEqual(s);
  });

  it('nothing stored, corrupt JSON, the wrong shape or another version all load as an empty list', () => {
    expect(loadShopping(memory(), { now: T })).toEqual(emptyShopping());
    for (const bad of ['{not json', '[]', '"x"', 'null', JSON.stringify({ v: 0, list: { items: [{ id: 'a', key: 'k' }] } }), JSON.stringify({ v: 2, list: { items: [{ id: 'a', key: 'k' }] } }), JSON.stringify({ list: { items: [{ id: 'a', key: 'k' }] } })]) {
      expect(loadShopping(memory({ [SHOPPING_KEY]: bad }), { now: T })).toEqual(emptyShopping());
    }
  });

  it('storage that throws or is missing never throws: the list lives for the session', () => {
    const angry = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(loadShopping(angry)).toEqual(emptyShopping());
    expect(saveShopping(emptyShopping(), angry)).toBe(false);
    expect(saveShopping(emptyShopping(), null)).toBe(false);
    expect(loadShopping(null)).toEqual(emptyShopping());
  });

  it('isEmptyShopping', () => {
    expect(isEmptyShopping(emptyShopping())).toBe(true);
    expect(isEmptyShopping(undefined)).toBe(true);
    expect(isEmptyShopping(st(emptyList(), { a: 1 }))).toBe(false);
  });
});
