import { describe, it, expect } from 'vitest';
import { SAVED_LIMITS, toSavedItem, fromSavedItem, cleanSavedList, upsertSaved, removeSaved } from '../inventSaved.js';

const ctx = { now: 1700000000000, makeId: () => 'id-1' };
const base = () => ({
  kind: 'cocktail', name: '  Garden Sour ', category: 2, glass: 'Coupe', method: 'Shake',
  lines: [{ key: 'gin', amount: '2 oz', role: 'spirit' }, { key: 'lime juice', amount: '¾ oz', role: 'sour' }, { key: 'mint' }],
});

describe('toSavedItem', () => {
  it('shapes a valid item', () => {
    const r = toSavedItem(base(), ctx);
    expect(r.ok).toBe(true);
    expect(r.item).toEqual({
      id: 'id-1', name: 'Garden Sour', createdAt: 1700000000000, kind: 'cocktail', category: 2, glass: 'Coupe', method: 'Shake',
      lines: [{ key: 'gin', amount: '2 oz', role: 'spirit' }, { key: 'lime juice', amount: '¾ oz', role: 'sour' }, { key: 'mint', amount: '', role: null }],
      source: 'invent',
    });
  });
  it('refuses an empty name, a long name, fewer than two ingredients, an unknown kind', () => {
    expect(toSavedItem({ ...base(), name: '   ' }, ctx)).toMatchObject({ ok: false, item: null });
    expect(toSavedItem({ ...base(), name: 'x'.repeat(SAVED_LIMITS.name + 1) }, ctx).ok).toBe(false);
    expect(toSavedItem({ ...base(), name: 'x'.repeat(SAVED_LIMITS.name) }, ctx).ok).toBe(true);
    expect(toSavedItem({ ...base(), lines: [{ key: 'gin' }] }, ctx).reason).toMatch(/two ingredients/);
    expect(toSavedItem({ ...base(), lines: [{ key: 'gin' }, { key: 'gin' }, { key: ' ' }] }, ctx).ok).toBe(false);
    expect(toSavedItem({ ...base(), kind: 'soup' }, ctx).ok).toBe(false);
    expect(toSavedItem(null, ctx).ok).toBe(false);
  });
  it('keeps a given id and createdAt (an edit)', () => {
    expect(toSavedItem({ ...base(), id: 'keep', createdAt: 5 }, ctx).item).toMatchObject({ id: 'keep', createdAt: 5 });
  });
  it('generates an id without makeId', () => {
    expect(toSavedItem(base()).item.id).toMatch(/^inv-/);
  });
});

describe('fromSavedItem', () => {
  it('reopens the same lines and category', () => {
    const { item } = toSavedItem({ ...base(), protein: 'chicken' }, ctx);
    const seed = fromSavedItem(item);
    expect(seed.name).toBe('Garden Sour');
    expect(seed.baseline).toEqual({ category: 2, glass: 'Coupe', protein: 'chicken', method: 'Shake' });
    expect(seed.lines.map((l) => l.key)).toEqual(['gin', 'lime juice', 'mint']);
    expect(seed.lines[0]).toEqual({ key: 'gin', amount: '2 oz', role: 'spirit', source: 'user' });
    expect(toSavedItem({ kind: 'cocktail', name: seed.name, category: seed.baseline.category, lines: seed.lines, glass: seed.baseline.glass, protein: seed.baseline.protein, method: seed.baseline.method }, ctx).item.lines)
      .toEqual(item.lines);
  });
  it('a null category stays null; garbage does not throw', () => {
    expect(fromSavedItem({ name: 'x', lines: [] }).baseline.category).toBeNull();
    expect(fromSavedItem(null)).toEqual({ name: '', baseline: { category: null }, lines: [] });
  });
});

describe('list helpers', () => {
  const mk = (id) => toSavedItem(base(), { now: 1, makeId: () => id }).item;
  it('cleanSavedList drops malformed entries and repeated ids, caps at the limit', () => {
    expect(cleanSavedList(null)).toEqual([]);
    expect(cleanSavedList({})).toEqual([]);
    expect(cleanSavedList([mk('a'), null, 3, { id: 'b' }, { ...mk('c'), name: '' }, mk('a'), { ...mk('d'), lines: [{ key: 'x' }] }]).map((x) => x.id)).toEqual(['a']);
    const many = Array.from({ length: 250 }, (_, i) => mk(`i${i}`));
    expect(cleanSavedList(many)).toHaveLength(SAVED_LIMITS.perKind);
  });
  it('upsertSaved replaces in place or puts a new one first, and caps', () => {
    const list = [mk('a'), mk('b')];
    expect(upsertSaved(list, mk('c')).map((x) => x.id)).toEqual(['c', 'a', 'b']);
    const edited = { ...mk('b'), name: 'New' };
    expect(upsertSaved(list, edited).map((x) => x.name)).toEqual(['Garden Sour', 'New']);
    const full = Array.from({ length: SAVED_LIMITS.perKind }, (_, i) => mk(`i${i}`));
    expect(upsertSaved(full, mk('new'))).toHaveLength(SAVED_LIMITS.perKind);
  });
  it('removeSaved removes by id', () => {
    expect(removeSaved([mk('a'), mk('b')], 'a').map((x) => x.id)).toEqual(['b']);
    expect(removeSaved(undefined, 'a')).toEqual([]);
  });
});
