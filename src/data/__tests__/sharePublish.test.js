import { describe, it, expect, vi } from 'vitest';
vi.mock('../shareTargets.js', async (orig) => ({ ...(await orig()), SHARE_CHARTS_ENABLED: true }));
import {
  SHARE_LIMITS, firstName, fromSharedDoc, itemFromRecipe, newShareId, shareFingerprint, toSharedDoc,
} from '../sharePublish.js';

const ITEM = {
  id: 'inv-1', name: 'Grandma Sour', kind: 'cocktail', category: 'sours',
  lines: [{ key: 'bourbon', amount: '2 oz', role: 'base' }, { key: 'lemon juice', amount: '1 oz', role: null }],
  method: 'Shake with ice.\nStrain.', glass: 'Rocks', source: 'invent',
};
const CTX = { kind: 'cocktail', uid: 'u1', by: null, bars: [], now: 1234 };

describe('toSharedDoc', () => {
  it('builds the public document and nothing else', () => {
    const d = toSharedDoc(ITEM, CTX);
    expect(d).toEqual({
      kind: 'cocktail', name: 'Grandma Sour',
      lines: [{ key: 'bourbon', amount: '2 oz', role: 'base' }, { key: 'lemon juice', amount: '1 oz' }],
      method: 'Shake with ice.\nStrain.', glass: 'Rocks', category: 'sours',
      bars: [], by: null, owner: 'u1', createdAt: 1234, removed: false,
    });
  });
  it('drops unknown fields and never carries an email, display name or photo', () => {
    const d = toSharedDoc({ ...ITEM, email: 'a@b.c', displayName: 'Dan S', photoURL: 'http://x', source: 'invent', sharedFrom: 'x', secret: 1 }, CTX);
    const text = JSON.stringify(d);
    for (const bad of ['a@b.c', 'Dan S', 'http://x', 'secret', 'sharedFrom', 'source', 'id']) expect(text).not.toContain(bad);
    expect(Object.keys(d).sort()).toEqual(['bars', 'by', 'category', 'createdAt', 'glass', 'kind', 'lines', 'method', 'name', 'owner', 'removed']);
  });
  it('shows a name only when one was chosen', () => {
    expect(toSharedDoc(ITEM, { ...CTX, by: '' }).by).toBeNull();
    expect(toSharedDoc(ITEM, { ...CTX, by: '   ' }).by).toBeNull();
    expect(toSharedDoc(ITEM, { ...CTX, by: ' Dan ' }).by).toBe('Dan');
    expect(toSharedDoc(ITEM, { ...CTX, by: 'x'.repeat(99) }).by).toHaveLength(SHARE_LIMITS.by);
  });
  it('trims and caps every field', () => {
    const d = toSharedDoc({
      name: `  ${'n'.repeat(200)}  `, glass: 'g'.repeat(200), category: 'c'.repeat(200), protein: 'p'.repeat(200), method: 'm'.repeat(5000),
      lines: Array.from({ length: 70 }, (_, i) => ({ key: ` ${'k'.repeat(100)}${i} `, amount: 'a'.repeat(100), role: 'r'.repeat(100) })),
    }, CTX);
    expect(d.name).toHaveLength(SHARE_LIMITS.name);
    expect(d.glass).toHaveLength(SHARE_LIMITS.glass);
    expect(d.category).toHaveLength(SHARE_LIMITS.category);
    expect(d.protein).toHaveLength(SHARE_LIMITS.protein);
    expect(d.method).toHaveLength(SHARE_LIMITS.method);
    expect(d.lines).toHaveLength(SHARE_LIMITS.lines);
    expect(d.lines.every((l) => l.key.length <= SHARE_LIMITS.key && l.amount.length <= SHARE_LIMITS.amount && l.role.length <= SHARE_LIMITS.role)).toBe(true);
  });
  it('coerces types: numbers become text, junk becomes empty, empty lines are dropped', () => {
    const d = toSharedDoc({ name: 'X', category: 6, glass: { a: 1 }, lines: [{ key: 'a', amount: 2 }, { key: '', amount: '1' }, null, 'plain', { key: 5 }, { name: 'from name' }] }, CTX);
    expect(d.category).toBe('6');
    expect(d.glass).toBeUndefined();
    expect(d.lines.map((l) => l.key)).toEqual(['a', 'plain', '5', 'from name']);
    expect(d.lines[0].amount).toBe('2');
  });
  it('strips control characters and keeps method line breaks', () => {
    const d = toSharedDoc({ name: 'a\u0000b‮c\nd', lines: [{ key: 'x\u0007y', amount: '' }], method: 'one\r\ntwo\t\u0001three' }, CTX);
    expect(d.name).toBe('abc d');
    expect(d.lines[0].key).toBe('xy');
    expect(d.method).toBe('one\ntwo three');
  });
  it('returns null without a name, lines, a valid kind or a uid', () => {
    expect(toSharedDoc({ ...ITEM, name: '  ' }, CTX)).toBeNull();
    expect(toSharedDoc({ ...ITEM, lines: [] }, CTX)).toBeNull();
    expect(toSharedDoc(ITEM, { ...CTX, kind: 'wine' })).toBeNull();
    expect(toSharedDoc(ITEM, { ...CTX, uid: '' })).toBeNull();
    expect(toSharedDoc(null, CTX)).toBeNull();
  });
  it('validates bars: at most 11, label 20, #rrggbb colour, score 0..1', () => {
    const bars = [
      { label: 'Sweet', color: '#FF00AA', score: 0.123456 },
      { label: 'L'.repeat(50), color: '#000000', score: 1 },
      { label: 'bad colour', color: 'red', score: 0.5 },
      { label: 'bad colour 2', color: '#12345', score: 0.5 },
      { label: 'high', color: '#000000', score: 1.5 },
      { label: 'low', color: '#000000', score: -0.1 },
      { label: 'nan', color: '#000000', score: NaN },
      { label: 'str', color: '#000000', score: '0.5' },
      { label: '', color: '#000000', score: 0.5 },
      null, 'x',
      ...Array.from({ length: 30 }, (_, i) => ({ label: `b${i}`, color: '#111111', score: 0.1 })),
    ];
    const d = toSharedDoc(ITEM, { ...CTX, bars });
    expect(d.bars.length).toBeLessThanOrEqual(SHARE_LIMITS.bars);
    expect(d.bars[0]).toEqual({ label: 'Sweet', color: '#ff00aa', score: 0.123 });
    expect(d.bars[1].label).toHaveLength(SHARE_LIMITS.barLabel);
    expect(d.bars.slice(2).every((b) => b.label.startsWith('b'))).toBe(true);
    expect(toSharedDoc(ITEM, { ...CTX, bars: 'nope' }).bars).toEqual([]);
  });
});

describe('fromSharedDoc', () => {
  it('round-trips to the normalised shape the page renders', () => {
    const doc = toSharedDoc(ITEM, { ...CTX, by: 'Dan', bars: [{ label: 'Sweet', color: '#ff00aa', score: 0.4 }] });
    const r = fromSharedDoc(doc, 'abcdefghjk');
    expect(r).toEqual({
      kind: 'cocktail', slug: 'abcdefghjk', shareId: 'abcdefghjk', name: 'Grandma Sour',
      lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }],
      method: 'Shake with ice.\nStrain.', glass: 'Rocks', category: null, categoryId: 'sours', by: 'Dan',
    });
  });
  it('maps a recipe to the page kind dish and keeps its cuisine as the label', () => {
    const doc = toSharedDoc({ name: 'Soup', lines: [{ key: 'carrot', amount: '2' }], category: 'Italian' }, { ...CTX, kind: 'recipe' });
    const r = fromSharedDoc(doc, 'abcdefghjk');
    expect(r.kind).toBe('dish');
    expect(r.category).toBe('Italian');
    expect(r.glass).toBeNull();
    expect(r.method).toBe('');
  });
  it('shows no name when by is not set', () => {
    expect(fromSharedDoc(toSharedDoc(ITEM, CTX), 'abcdefghjk').by).toBeNull();
  });
  it('re-validates an untrusted document: hostile and oversized values are capped, never rejected into a crash', () => {
    const r = fromSharedDoc({ kind: 'sauce', name: '<script>alert(1)</script>'.repeat(10), lines: [{ key: '"><img onerror=x>', amount: 5 }], by: 'b'.repeat(500), removed: false }, 'abcdefghjk');
    expect(r.name.length).toBeLessThanOrEqual(SHARE_LIMITS.name);
    expect(r.by.length).toBeLessThanOrEqual(SHARE_LIMITS.by);
    expect(r.lines[0].amount).toBe('5');
  });
  it('returns null for missing, removed, wrong-typed and empty documents', () => {
    const ok = toSharedDoc(ITEM, CTX);
    for (const bad of [null, undefined, 'x', 3, [], {}, { ...ok, removed: true }, { ...ok, kind: 'wine' }, { ...ok, name: 7 }, { ...ok, lines: 'x' }, { ...ok, lines: [] }]) {
      expect(fromSharedDoc(bad, 'abcdefghjk')).toBeNull();
    }
    expect(fromSharedDoc(ok, '')).toBeNull();
    expect(fromSharedDoc(ok, undefined)).toBeNull();
  });
});

describe('newShareId', () => {
  it('is 10 characters from the unambiguous lowercase alphabet', () => {
    for (let i = 0; i < 200; i += 1) expect(newShareId()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
  });
  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newShareId()));
    expect(ids.size).toBe(500);
  });
});

describe('shareFingerprint', () => {
  it('is stable for the same content, however it is stored', () => {
    expect(shareFingerprint(ITEM)).toBe(shareFingerprint({ ...ITEM }));
    expect(shareFingerprint(ITEM)).toBe(shareFingerprint({ ...ITEM, id: 'other', createdAt: 5, source: 'x', name: '  Grandma Sour ' }));
    expect(shareFingerprint(ITEM)).toMatch(/^[0-9a-f]{14}$/);
  });
  it('changes after any edit to the shareable content', () => {
    const base = shareFingerprint(ITEM);
    for (const edit of [
      { name: 'Grandma Sour 2' }, { method: 'Stir.' }, { glass: 'Coupe' }, { category: 'tiki' }, { protein: 'fish' },
      { lines: [ITEM.lines[0]] }, { lines: [{ ...ITEM.lines[0], amount: '3 oz' }, ITEM.lines[1]] }, { kind: 'sauce' },
    ]) {
      expect(shareFingerprint({ ...ITEM, ...edit })).not.toBe(base);
    }
  });
  it('ignores which name was chosen to show (by is not part of the item)', () => {
    expect(shareFingerprint({ ...ITEM, by: 'Dan' })).toBe(shareFingerprint(ITEM));
  });
});

describe('itemFromRecipe and firstName', () => {
  it('turns a Cookbook recipe into the saved-item shape', () => {
    const item = itemFromRecipe({
      id: 'r1', name: 'Soup', cuisine: 'Italian', instructions: 'Simmer.',
      ingredients: [{ name: 'carrot', quantity: 2, unit: null, raw: '2 carrot' }, { name: 'flour', quantity: null, unit: null, raw: '1 cup flour' }, { name: 'salt', quantity: null, unit: null, raw: 'salt' }, 'plain'],
    });
    expect(item).toMatchObject({ id: 'r1', name: 'Soup', kind: 'recipe', category: 'Italian', method: 'Simmer.' });
    expect(item.lines).toEqual([{ key: 'carrot', amount: '2' }, { key: 'flour', amount: '1 cup' }, { key: 'salt', amount: '' }, { key: 'plain', amount: '' }]);
    expect(itemFromRecipe(null)).toBeNull();
  });
  it('first name is the first word, or empty', () => {
    expect(firstName('Dan Schermele')).toBe('Dan');
    expect(firstName('  Dan  ')).toBe('Dan');
    expect(firstName('')).toBe('');
    expect(firstName(null)).toBe('');
    expect(firstName('x'.repeat(99))).toHaveLength(SHARE_LIMITS.by);
  });
});
