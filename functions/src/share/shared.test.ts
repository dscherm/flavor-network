import { describe, expect, it, vi } from 'vitest';
import { createSharedLookup, describeShared, sanitizeShared, SHARED_TTL_MS, LIMITS } from './shared';
import { handleSharePreview, type ShareDeps } from './handler';
import { handleShareCard } from './card';
import realCards from './share-cards.json';

const SHELL = '<!DOCTYPE html><html><head><title>x</title></head><body></body></html>';
const GOOD = {
  kind: 'cocktail', name: "Grandma's Sour", owner: 'u1', createdAt: 1, removed: false, by: 'Dan',
  lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }, { key: 'syrup', amount: '' }],
  bars: [{ label: 'Sweet', color: '#ff00aa', score: 0.4 }], glass: 'Rocks', category: 'sours',
};
const ID = 'abcdefghjk';
const HOST = { host: 'neuralflavor.web.app' };

describe('sanitizeShared', () => {
  it('keeps a good document and never carries owner or by', () => {
    const c = sanitizeShared(GOOD)!;
    expect(c.name).toBe("Grandma's Sour");
    expect(c.lines).toHaveLength(3);
    expect(JSON.stringify(c)).not.toContain('u1');
    expect(JSON.stringify(c)).not.toContain('Dan');
  });
  it('returns null for missing, removed, wrong-kind, nameless and lineless documents', () => {
    const bads: unknown[] = [null, undefined, 'x', 5, [], {}, { ...GOOD, removed: true }, { ...GOOD, kind: 'wine' }, { ...GOOD, name: '' }, { ...GOOD, name: 7 }, { ...GOOD, lines: [] }, { ...GOOD, lines: 'x' }, { ...GOOD, lines: [null, 3, {}] }];
    for (const bad of bads) expect(sanitizeShared(bad)).toBeNull();
  });
  it('caps and cleans hostile or wrong-typed fields', () => {
    const c = sanitizeShared({
      ...GOOD,
      name: `<script>alert(1)</script>${'x'.repeat(500)}`,
      lines: [
        { key: '"><img src=x onerror=1>', amount: 5 },
        { key: 'k'.repeat(1000), amount: 'a'.repeat(1000) },
        ...Array.from({ length: 100 }, (_, i) => ({ key: `i${i}`, amount: '' })),
      ],
      bars: [
        { label: 'ok', color: 'red', score: 0.5 },
        { label: 'ok', color: '#12345g', score: 0.5 },
        { label: 'ok', color: '#123456', score: 7 },
        { label: 'ok', color: '#123456', score: '0.5' },
        { label: 'good', color: '#ABCDEF', score: 1 },
        ...Array.from({ length: 40 }, () => ({ label: 'b', color: '#000000', score: 0 })),
      ],
      glass: 123,
      category: { a: 1 },
    })!;
    expect(c.name.length).toBeLessThanOrEqual(LIMITS.name);
    expect(c.lines.length).toBeLessThanOrEqual(LIMITS.lines);
    expect(c.lines.every((l) => l.key.length <= LIMITS.key && l.amount.length <= LIMITS.amount)).toBe(true);
    expect(c.lines[0].amount).toBe('');
    expect(c.bars.length).toBeLessThanOrEqual(LIMITS.bars);
    expect(c.bars[0]).toEqual({ label: 'good', color: '#abcdef', score: 1 });
    expect(c.glass).toBeUndefined();
    expect(c.category).toBeUndefined();
  });
  it('strips control characters', () => {
    expect(sanitizeShared({ ...GOOD, name: 'a\u0000b\nc‮d' })!.name).toBe('ab cd');
  });
});

describe('createSharedLookup', () => {
  it('rejects a malformed id without reading', async () => {
    const read = vi.fn(async () => GOOD);
    const s = createSharedLookup(read);
    for (const id of ['', 'short', 'ABCDEFGHJK', 'abcdefghj!', 'abcdefghjkl', '../x']) expect(await s.preview(id)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it('preview text: first ingredients and the kind', async () => {
    const s = createSharedLookup(async () => GOOD);
    expect(await s.preview(ID)).toEqual({ name: "Grandma's Sour", description: 'Bourbon, lemon juice, syrup. A cocktail on Neural Flavor.' });
    expect(describeShared(sanitizeShared({ ...GOOD, kind: 'recipe' })!)).toContain('A dish on');
  });
  it('card data carries the stored bars and the real ingredient count', async () => {
    const s = createSharedLookup(async () => GOOD);
    const c = (await s.card(ID))!;
    expect(c.bars).toEqual(GOOD.bars);
    expect(c.lineCount).toBe(3);
    expect(c.lines[0]).toEqual({ label: 'bourbon', amount: '2 oz' });
  });
  it('caches within the window, and a removed share stops being served once it expires', async () => {
    let t = 1000;
    let doc: unknown = GOOD;
    const read = vi.fn(async () => doc);
    const s = createSharedLookup(read, { now: () => t });
    expect(await s.preview(ID)).not.toBeNull();
    doc = { ...GOOD, removed: true };
    t += SHARED_TTL_MS - 1;
    expect(await s.preview(ID)).not.toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    t += 2;
    expect(await s.preview(ID)).toBeNull();
    expect(await s.card(ID)).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('a missing document is null; a throwing read propagates (the handlers log it and go generic)', async () => {
    expect(await createSharedLookup(async () => null).preview(ID)).toBeNull();
    await expect(createSharedLookup(async () => { throw new Error('db'); }).preview(ID)).rejects.toThrow('db');
  });
  it('the window is a few minutes', () => {
    expect(SHARED_TTL_MS).toBeGreaterThanOrEqual(60_000);
    expect(SHARED_TTL_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});

function previewDeps(s: ReturnType<typeof createSharedLookup>, over: Partial<ShareDeps> = {}): ShareDeps {
  return { fetchIndexHtml: async () => SHELL, lookupShared: (id) => s.preview(id), index: {}, log: () => {}, ...over };
}

describe('hostile content through sharePreview', () => {
  it('is HTML-escaped in every tag', async () => {
    const s = createSharedLookup(async () => ({
      ...GOOD,
      name: '"><script>alert(1)</script>',
      lines: [{ key: '"><b onmouseover=x>', amount: '' }, { key: "'><svg/onload=1>", amount: '' }],
    }));
    const out = await handleSharePreview({ path: `/r/${ID}`, headers: HOST }, previewDeps(s));
    expect(out.status).toBe(200);
    expect(out.body).not.toContain('<script>alert');
    expect(out.body).not.toContain('<b onmouseover');
    expect(out.body).not.toContain('<svg/onload');
    expect(out.body).toContain('&lt;script&gt;');
  });
  it('wrong-typed documents give the generic tags, not a crash', async () => {
    const bads: unknown[] = [{ kind: 5, name: [], lines: {} }, 'oops', 42, { ...GOOD, lines: 'x', name: { a: 1 } }];
    for (const bad of bads) {
      const s = createSharedLookup(async () => bad);
      const out = await handleSharePreview({ path: `/r/${ID}`, headers: HOST }, previewDeps(s));
      expect(out.status).toBe(200);
      expect(out.body).toContain('<title>Neural Flavor</title>');
    }
  });
  it('a removed share gets the generic tags', async () => {
    const s = createSharedLookup(async () => ({ ...GOOD, removed: true }));
    const out = await handleSharePreview({ path: `/r/${ID}`, headers: HOST }, previewDeps(s));
    expect(out.body).toContain('<title>Neural Flavor</title>');
    expect(out.body).not.toContain('Grandma');
  });
  it('a shared recipe gets its own title and image', async () => {
    const s = createSharedLookup(async () => GOOD);
    const out = await handleSharePreview({ path: `/r/${ID}`, headers: HOST }, previewDeps(s));
    expect(out.body).toContain('Grandma&#39;s Sour | Neural Flavor');
    expect(out.body).toContain(`/r-img/${ID}.png`);
  });
});

describe('hostile content through shareCard', () => {
  const run = (doc: unknown) => handleShareCard({ path: `/r-img/${ID}.png` }, {
    cards: realCards as never,
    lookupShared: (id) => createSharedLookup(async () => doc).card(id),
    log: () => {},
  });
  const isPng = (b: unknown) => Buffer.isBuffer(b) && b[0] === 0x89 && b[1] === 0x50;
  it('draws a card from a hostile, oversized document', async () => {
    const res = await run({
      ...GOOD,
      name: '<script>x</script>'.repeat(20),
      lines: Array.from({ length: 80 }, (_, i) => ({ key: `"><b>${i}`.repeat(30), amount: 'z'.repeat(99) })),
      bars: Array.from({ length: 30 }, () => ({ label: '<l>'.repeat(40), color: '#123456', score: 0.3 })),
    });
    expect(res.status).toBe(200);
    expect(isPng(res.body)).toBe(true);
  }, 30_000);
  it('wrong-typed and removed documents give the generic card (200, short cache)', async () => {
    const bads: unknown[] = [{ kind: [], name: 1 }, 'x', { ...GOOD, removed: true }, null];
    for (const bad of bads) {
      const res = await run(bad);
      expect(res.status).toBe(200);
      expect(isPng(res.body)).toBe(true);
      expect(res.headers['Cache-Control']).toBe('public, max-age=600, s-maxage=600');
    }
  }, 30_000);
  it('a user card is cached for minutes so a removal shows quickly', async () => {
    const res = await run(GOOD);
    expect(res.headers['Cache-Control']).toBe('public, max-age=600, s-maxage=600');
  }, 30_000);
});
