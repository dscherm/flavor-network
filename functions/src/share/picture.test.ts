// PICTURE-4. The picture on a user's share card: what is accepted, what is refused (and that the card is still drawn),
// that a removed share serves no picture, and that icon pictures come from the generated drawing map.
import { inflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { handleShareCard, layoutFor, renderPng, type CardData, type CardDeps } from './card';
import { iconPicture, isKnownIcon, jpegSize, validateChalkPicture } from './picture';
import { createSharedLookup, sanitizeShared } from './shared';
import { PICTURE_SVGS } from './pictureSvgs.generated';
import realCards from './share-cards.json';

// Real files made with sharp: a 64x64 solid red JPEG, an 80x60 solid blue one, and the same red as WebP and PNG.
const RED = '/9j/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCABAAEADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAcI/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AgQCZNxgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//Z';
const BLUE = '/9j/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAA8AFADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAYI/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AiwBuNNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//Z';
const WEBP = 'UklGRlIAAABXRUJQVlA4IEYAAADQAwCdASpAAEAAPm02mEkkIyKhIggAgA2JaQB2AAAg0KrxC4wC4gAA/vA4Q//i1rcLSw//+0s/+pZ/9Sz/GJUUqxwAAAAA';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAn0lEQVR4nO2SUQkAQBSDlsT+URbrQtyHPBgsgMpSOL3oBJ0AesXuQtxddIJOAL1idyHuLjpBJ4BesbsQdxedoBNAr9hdiLuLTtAJoFfsLsTdRSfoBNArdhfi7qITdALoFbsLcXfRCToB9Irdhbi76ASdAHrF7kLcXXSCTgC9Ynch7i46QSeAXrG7EHcXnaATQK/YXYi7i07QCaBX/LnQA8qnQPFc+cRRAAAAAElFTkSuQmCC';

const cards = realCards as unknown as Record<string, CardData>;
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const jpegDoc = (data = RED, over: Record<string, unknown> = {}) => ({ data, mime: 'image/jpeg', w: 64, h: 64, owner: 'u1', createdAt: 1, ...over });

/** A minimal PNG reader for the 8-bit RGBA, non-interlaced files resvg writes: { w, h, px(x, y) -> [r, g, b, a] }. */
function decodePng(buf: Buffer) {
  expect([...buf.subarray(0, 8)]).toEqual(PNG_SIG);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  expect(buf[24]).toBe(8);
  expect(buf[25]).toBe(6);
  const idat: Buffer[] = [];
  for (let i = 8; i < buf.length;) {
    const len = buf.readUInt32BE(i);
    if (buf.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(buf.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y += 1) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? out[y * stride + x - 4] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
      let v = cur;
      if (f === 1) v = cur + a;
      else if (f === 2) v = cur + b;
      else if (f === 3) v = cur + ((a + b) >> 1);
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, px: (x: number, y: number) => [out[y * stride + x * 4], out[y * stride + x * 4 + 1], out[y * stride + x * 4 + 2], out[y * stride + x * 4 + 3]] };
}

const base: CardData = { ...cards['cocktail/negroni'] };
const noImage = (png: ReturnType<typeof decodePng>, box: { x: number; y: number; w: number; h: number }, other: ReturnType<typeof decodePng>) => {
  let diff = 0;
  for (let y = box.y; y < box.y + box.h; y += 4) for (let x = box.x; x < box.x + box.w; x += 4) {
    const a = png.px(x, y); const b = other.px(x, y);
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 40) diff += 1;
  }
  return diff;
};

describe('validateChalkPicture', () => {
  it('accepts a real JPEG and reads its size from the file, not from the document', () => {
    const r = validateChalkPicture(jpegDoc(RED, { w: 999, h: 5 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.picture).toMatchObject({ w: 64, h: 64, kind: 'chalk', src: `data:image/jpeg;base64,${RED}` });
    const wide = validateChalkPicture(jpegDoc(BLUE, { w: 80, h: 60 }));
    expect(wide.ok && wide.picture.w).toBe(80);
    expect(wide.ok && wide.picture.h).toBe(60);
  });

  it('jpegSize reads the frame header and refuses anything else', () => {
    expect(jpegSize(Buffer.from(RED, 'base64'))).toEqual({ w: 64, h: 64 });
    expect(jpegSize(Buffer.from(PNG, 'base64'))).toBeNull();
    expect(jpegSize(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(jpegSize(Buffer.alloc(0))).toBeNull();
  });

  const refused: [string, unknown][] = [
    ['not an object', 'a string'],
    ['an array', []],
    ['null', null],
    ['no data', { mime: 'image/jpeg' }],
    ['empty data', jpegDoc('')],
    ['data that is not text', jpegDoc(undefined, { data: 42 })],
    ['bad base64 (characters)', jpegDoc('!!!!not base64!!!!')],
    ['bad base64 (length)', jpegDoc(`${RED}A`)],
    ['bad base64 (padding in the middle)', jpegDoc(`${RED.slice(0, 40)}==${RED.slice(40)}`)],
    ['a data: address pasted as the data', jpegDoc(`data:image/jpeg;base64,${RED}`)],
    ['a mime type that is not on the list', { ...jpegDoc(), mime: 'text/html' }],
    ['an SVG labelled as an image', { ...jpegDoc(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')), mime: 'image/svg+xml' }],
    ['PNG bytes labelled as JPEG', jpegDoc(PNG)],
    ['text labelled as JPEG', jpegDoc(Buffer.from('hello world, definitely a picture').toString('base64'))],
    ['WebP (resvg cannot draw it)', { ...jpegDoc(WEBP), mime: 'image/webp' }],
    ['WebP bytes labelled as JPEG', jpegDoc(WEBP)],
    ['over the size cap', jpegDoc('A'.repeat(210_000))],
    ['a header declaring an absurd size', jpegDoc((() => {
      const b = Buffer.from(RED, 'base64');
      const at = b.indexOf(Buffer.from([0xff, 0xc0]));
      b.writeUInt16BE(60000, at + 5); b.writeUInt16BE(60000, at + 7);
      return b.toString('base64');
    })())],
    ['a header declaring a tiny size', jpegDoc((() => {
      const b = Buffer.from(RED, 'base64');
      const at = b.indexOf(Buffer.from([0xff, 0xc0]));
      b.writeUInt16BE(4, at + 5); b.writeUInt16BE(4, at + 7);
      return b.toString('base64');
    })())],
  ];
  for (const [name, doc] of refused) {
    it(`refuses ${name}`, () => {
      const r = validateChalkPicture(doc);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(5);
    });
  }
});

describe('icon pictures', () => {
  it('come from the generated map: every id the chooser offers is known, and an unknown or malformed id is not', () => {
    for (const id of Object.keys(PICTURE_SVGS)) {
      expect(isKnownIcon(id)).toBe(true);
      expect(iconPicture(id)?.src.startsWith('data:image/svg+xml;base64,')).toBe(true);
    }
    expect(Object.keys(PICTURE_SVGS).length).toBeGreaterThanOrEqual(33);
    for (const bad of ['glass:retired', '', 'x', 5, null, undefined, '../x', 'glass:coupe"onload="x', '__proto__', 'constructor:x']) {
      expect(isKnownIcon(bad)).toBe(false);
      expect(iconPicture(bad)).toBeNull();
    }
  });
});

describe('sanitizeShared keeps only a picture it can vouch for', () => {
  const doc = (picture: unknown) => ({ kind: 'cocktail', name: 'X', lines: [{ key: 'gin', amount: '1' }], bars: [], picture });
  it('a drawing in the map, or a chalk marker; nothing else', () => {
    expect(sanitizeShared(doc({ kind: 'icon', icon: 'glass:coupe' }))?.picture).toEqual({ kind: 'icon', icon: 'glass:coupe' });
    expect(sanitizeShared(doc({ kind: 'chalk', data: 'ignored' }))?.picture).toEqual({ kind: 'chalk' });
    for (const bad of [{ kind: 'icon', icon: 'glass:retired' }, { kind: 'icon' }, { kind: 'url', url: 'https://x' }, 'chalk', 7, [], null]) {
      expect(sanitizeShared(doc(bad))?.picture).toBeUndefined();
    }
  });
});

describe('the lookup the card function uses', () => {
  const share = (picture: unknown, over: Record<string, unknown> = {}) => ({ kind: 'cocktail', name: 'Grandma Sour', lines: [{ key: 'bourbon', amount: '2 oz' }, { key: 'lemon juice', amount: '1 oz' }], bars: [], picture, ...over });
  const ID = 'abcdefghjk';

  it('a share with a chalk picture gets it, validated, and the picture is read once per cache window', async () => {
    const readPicture = vi.fn(async () => jpegDoc());
    const lookup = createSharedLookup(async () => share({ kind: 'chalk' }), { readPicture });
    expect((await lookup.card(ID))?.picture).toMatchObject({ kind: 'chalk', w: 64 });
    await lookup.card(ID);
    expect(readPicture).toHaveBeenCalledTimes(1);
  });

  it('a share with a drawing needs no picture read', async () => {
    const readPicture = vi.fn();
    const lookup = createSharedLookup(async () => share({ kind: 'icon', icon: 'glass:flute' }), { readPicture });
    expect((await lookup.card(ID))?.picture).toMatchObject({ kind: 'icon' });
    expect(readPicture).not.toHaveBeenCalled();
  });

  it('a share with no picture never asks for one', async () => {
    const readPicture = vi.fn();
    const lookup = createSharedLookup(async () => share(undefined), { readPicture });
    expect((await lookup.card(ID))?.picture).toBeUndefined();
    expect(readPicture).not.toHaveBeenCalled();
  });

  it('a REMOVED share serves no card data and no picture, and its picture is never read', async () => {
    const readPicture = vi.fn(async () => jpegDoc());
    const lookup = createSharedLookup(async () => share({ kind: 'chalk' }, { removed: true }), { readPicture });
    expect(await lookup.card(ID)).toBeNull();
    expect(readPicture).not.toHaveBeenCalled();
  });

  it('a share removed AFTER it was cached stops serving its picture once the cache window ends', async () => {
    let removed = false;
    let t = 1_000_000;
    const readPicture = vi.fn(async () => jpegDoc());
    const lookup = createSharedLookup(async () => share({ kind: 'chalk' }, { removed }), { readPicture, ttlMs: 180_000, now: () => t });
    expect((await lookup.card(ID))?.picture).toBeTruthy();
    removed = true;
    t += 60_000;
    expect((await lookup.card(ID))?.picture).toBeTruthy(); // inside the window: still the cached copy (3 minutes, then 10 more at the CDN)
    t += 130_000;
    expect(await lookup.card(ID)).toBeNull();
  });

  it('a picture read that throws, or returns hostile data, leaves the card without a picture and logs it', async () => {
    const log = vi.fn();
    for (const readPicture of [async () => { throw new Error('boom'); }, async () => jpegDoc(PNG), async () => ({ ...jpegDoc(WEBP), mime: 'image/webp' }), async () => null]) {
      const lookup = createSharedLookup(async () => share({ kind: 'chalk' }), { readPicture, log });
      const data = await lookup.card(ID);
      expect(data?.name).toBe('Grandma Sour');
      expect(data?.picture).toBeUndefined();
    }
    expect(log).toHaveBeenCalled();
  });
});

describe('the card with a picture', () => {
  const deps = (over: Partial<CardDeps> = {}): CardDeps => ({ cards, lookupShared: async () => null, log: vi.fn(), ...over });
  const withPic = (picture: CardData['picture']): CardData => ({ ...base, picture });
  const box = (d: CardData) => {
    const layout = layoutFor(d, 'neuralflavor.web.app/r/abcde23456') as { primitives: { type: string; x: number; y: number; w: number; h: number }[] };
    return layout.primitives.find((p) => p.type === 'image')!;
  };

  it('a chalk picture: a real 1200x630 PNG with the picture\'s own pixels in its place (and none there without it)', async () => {
    const check = validateChalkPicture(jpegDoc());
    if (!check.ok) throw new Error(check.reason);
    const data = withPic(check.picture);
    const res = await handleShareCard({ path: '/r-img/abcdefghjk.png' }, deps({ lookupShared: async () => data }));
    expect(res.status).toBe(200);
    const png = decodePng(res.body as Buffer);
    expect([png.w, png.h]).toEqual([1200, 630]);
    const plain = decodePng((await handleShareCard({ path: '/r-img/abcdefghjk.png' }, deps({ lookupShared: async () => base }))).body as Buffer);
    const b = box(data);
    const mid = png.px(Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2));
    expect(mid[0]).toBeGreaterThan(150); // the fixture is solid red
    expect(mid[1]).toBeLessThan(90);
    expect(mid[2]).toBeLessThan(90);
    expect(noImage(png, b, plain)).toBeGreaterThan(200);
    // nothing outside the picture's frame moved except where the layout makes room (the note block); the left half is the same
    expect(noImage(png, { x: 0, y: 0, w: 560, h: 560 }, plain)).toBe(0);
  }, 30_000);

  it('a drawing: a real 1200x630 PNG that differs from the plain card inside the picture frame', async () => {
    const pic = iconPicture('dish:pasta')!;
    const res = await handleShareCard({ path: '/r-img/abcdefghjk.png' }, deps({ lookupShared: async () => withPic(pic) }));
    expect(res.status).toBe(200);
    const png = decodePng(res.body as Buffer);
    const plain = decodePng((await handleShareCard({ path: '/r-img/abcdefghjk.png' }, deps({ lookupShared: async () => base }))).body as Buffer);
    const b = box(withPic(pic));
    expect(noImage(png, b, plain)).toBeGreaterThan(100);
  }, 30_000);

  it('a hostile picture document is refused by the lookup and the card is the plain card, byte for byte', async () => {
    const log = vi.fn();
    const lookup = createSharedLookup(
      async () => ({ kind: 'cocktail', name: 'Negroni', lines: base.lines.map((l) => ({ key: l.label, amount: l.amount ?? '' })), bars: [], picture: { kind: 'chalk' } }),
      { readPicture: async () => jpegDoc(WEBP), log },
    );
    const withHostile = await handleShareCard({ path: '/r-img/abcdefghjk.png' }, deps({ lookupShared: (id) => lookup.card(id) }));
    const without = await handleShareCard({ path: '/r-img/abcdefghjk.png' }, deps({
      lookupShared: async () => { const c = await createSharedLookup(async () => ({ kind: 'cocktail', name: 'Negroni', lines: base.lines.map((l) => ({ key: l.label, amount: l.amount ?? '' })), bars: [] })).card('abcdefghjk'); return c; },
    }));
    expect(withHostile.status).toBe(200);
    expect((withHostile.body as Buffer).equals(without.body as Buffer)).toBe(true);
    expect(log).toHaveBeenCalledWith('shareCard picture refused', expect.objectContaining({ reason: expect.any(String) }));
  }, 30_000);

  it('the renderer in this package skips a WebP image without an error: why WebP pictures are refused above', async () => {
    const card = (src: string) => ({
      width: 100, height: 100, background: { inner: '#000000', mid: '#000000', outer: '#000000' },
      primitives: [{ type: 'image', x: 0, y: 0, w: 100, h: 100, src, fit: 'cover' }],
    });
    const px = async (src: string) => decodePng(await renderPng(card(src))).px(50, 50);
    const jpeg = await px(`data:image/jpeg;base64,${RED}`);
    expect(jpeg[0]).toBeGreaterThan(150);
    const webp = await px(`data:image/webp;base64,${WEBP}`);
    expect(webp[0]).toBeLessThan(20); // nothing was drawn
  }, 30_000);

  it('a card without a picture is the card it was (no image primitive in the layout)', () => {
    const layout = layoutFor(base, 'neuralflavor.web.app/r/cocktail/negroni') as { primitives: { type: string }[] };
    expect(layout.primitives.some((p) => p.type === 'image')).toBe(false);
  });
});
