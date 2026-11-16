import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { handleShareCard, layoutFor, parseCardPath, printedLink, toSatori, type CardData, type CardDeps } from './card';
import { handleSharePreview, imageUrlFor, type ShareDeps, type ShareEntry } from './handler';
import realCards from './share-cards.json';
import realIndex from './share-index.json';
import * as generated from './cardLayout.generated';

const cards = realCards as unknown as Record<string, CardData>;
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function deps(over: Partial<CardDeps> = {}): CardDeps {
  return { cards, lookupShared: async () => null, log: vi.fn(), ...over };
}
const dims = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

describe('parseCardPath / printedLink', () => {
  it('reads built-in and id forms, with or without .png', () => {
    expect(parseCardPath('/r-img/cocktail/negroni.png')).toEqual({ kind: 'cocktail', slug: 'negroni' });
    expect(parseCardPath('/r-img/Cocktail/Negroni')).toEqual({ kind: 'cocktail', slug: 'negroni' });
    expect(parseCardPath('/r-img/ab12cd.png')).toEqual({ id: 'ab12cd' });
    expect(parseCardPath('/r-img/')).toBeNull();
    expect(parseCardPath('/r-img/a/b/c.png')).toBeNull();
    expect(parseCardPath('/elsewhere')).toBeNull();
    expect(parseCardPath('/r-img/%E0%A4%A.png')).toBeNull();
  });
  it('prints the same path the page lives at', () => {
    expect(printedLink({ kind: 'cocktail', slug: 'negroni' })).toBe('neuralflavor.web.app/r/cocktail/negroni');
    expect(printedLink({ id: 'ab12cd' })).toBe('neuralflavor.web.app/r/ab12cd');
  });
});

describe('og:image agrees with the card route', () => {
  it('every built-in og:image path parses back to the same index key', () => {
    for (const key of Object.keys(realIndex)) {
      const [kind, slug] = key.split('/') as ['cocktail', string];
      const url = new URL(imageUrlFor('https://neuralflavor.web.app', { kind, slug }));
      expect(url.pathname).toBe(`/r-img/${kind}/${slug}.png`);
      expect(parseCardPath(url.pathname)).toEqual({ kind, slug });
      expect(cards[key]).toBeTruthy();
    }
  });
  it('the index and the card data cover the same recipes', () => {
    expect(Object.keys(cards).sort()).toEqual(Object.keys(realIndex).sort());
  });
  it('the preview function writes an og:image that the card function serves', async () => {
    const d: ShareDeps = {
      fetchIndexHtml: async () => '<html><head><title>x</title></head><body></body></html>',
      lookupShared: async () => null,
      index: realIndex as Record<string, ShareEntry>,
      log: vi.fn(),
    };
    const out = await handleSharePreview({ path: '/r/cocktail/negroni', headers: { host: 'neuralflavor.web.app' } }, d);
    const m = /property="og:image" content="([^"]+)"/.exec(String(out.body));
    expect(m).toBeTruthy();
    const url = new URL(m![1]);
    const res = await handleShareCard({ path: url.pathname }, deps());
    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toBe('image/png');
  });
});

describe('shareCard PNG', () => {
  const pick = (kind: string) => Object.keys(cards).find((k) => k.startsWith(`${kind}/`))!;
  for (const [kind, path] of [['cocktail', '/r-img/cocktail/negroni.png'], ['sauce', '/r-img/sauce/hollandaise.png'], ['dish', '/r-img/dish/beef-bolognese.png']]) {
    it(`${kind}: a real 1200x630 PNG with a one-day cache`, async () => {
      expect(cards[path.replace('/r-img/', '').replace('.png', '')] || cards[pick(kind)]).toBeTruthy();
      const res = await handleShareCard({ path }, deps());
      expect(res.status).toBe(200);
      expect(res.headers['Content-Type']).toBe('image/png');
      expect(res.headers['Cache-Control']).toBe('public, max-age=86400, s-maxage=86400');
      const body = res.body as Buffer;
      expect([...body.subarray(0, 8)]).toEqual(PNG_SIG);
      expect(dims(body)).toEqual({ w: 1200, h: 630 });
      expect(body.length).toBeGreaterThan(8000);
    }, 30_000);
  }

  it('an unknown recipe, an unknown kind and a missing share all give a generic 1200x630 card (200)', async () => {
    for (const path of ['/r-img/cocktail/no-such-drink.png', '/r-img/nope/negroni.png', '/r-img/zzzzzz.png', '/r-img/__proto__/x.png', '/r-img/']) {
      const res = await handleShareCard({ path }, deps());
      expect(res.status).toBe(200);
      expect([...(res.body as Buffer).subarray(0, 8)]).toEqual(PNG_SIG);
      expect(dims(res.body as Buffer)).toEqual({ w: 1200, h: 630 });
      expect(res.headers['Cache-Control']).toBe('public, max-age=600, s-maxage=600');
    }
  }, 30_000);

  it('a user share found by lookupShared is drawn; a throwing lookup gives the generic card', async () => {
    const lookupShared = vi.fn(async (id: string) => (id === 'ab12cd' ? { name: 'Grandma soup', kind: 'dish', lines: [{ label: 'carrot', amount: '2' }], bars: [] } : null));
    const hit = await handleShareCard({ path: '/r-img/ab12cd.png' }, deps({ lookupShared }));
    expect(lookupShared).toHaveBeenCalledWith('ab12cd');
    expect(hit.headers['Cache-Control']).toBe('public, max-age=600, s-maxage=600');
    expect(dims(hit.body as Buffer)).toEqual({ w: 1200, h: 630 });
    const log = vi.fn();
    const boom = await handleShareCard({ path: '/r-img/ab12cd.png' }, deps({ lookupShared: async () => { throw new Error('db down'); }, log }));
    expect(boom.status).toBe(200);
    expect(log).toHaveBeenCalled();
  }, 30_000);

  it('a render error is logged and answered with a 302 to the site icon', async () => {
    const log = vi.fn();
    const res = await handleShareCard({ path: '/r-img/cocktail/negroni.png' }, deps({ log, render: async () => { throw new Error('boom'); } }));
    expect(res.status).toBe(302);
    expect(res.headers.Location).toBe('/icons/icon-512.png');
    expect(log).toHaveBeenCalledWith('shareCard render failed', expect.objectContaining({ path: '/r-img/cocktail/negroni.png' }));
  });
});

describe('layout sharing', () => {
  it('the layout the function uses is the browser module, copied (generated file matches the source)', () => {
    // AROMA-4: the layout imports the chart display rule; the generated copy inlines src/data/flavorDisplay.js ahead of it
    // and drops the import line. Line endings are normalised so the check does not depend on how git checked the files out.
    const lf = (t: string) => t.replace(/\r\n/g, '\n');
    const root = join(__dirname, '..', '..', '..', 'src', 'data');
    const layout = lf(readFileSync(join(root, 'shareCardLayout.js'), 'utf8')).split('\n').filter((l) => !l.includes("from './flavorDisplay.js'")).join('\n');
    const rule = lf(readFileSync(join(root, 'flavorDisplay.js'), 'utf8'));
    const gen = lf(readFileSync(join(__dirname, 'cardLayout.generated.ts'), 'utf8'));
    expect(gen.endsWith(layout)).toBe(true);
    expect(gen).toContain(rule);
    expect(gen.startsWith('// @ts-nocheck\n// GENERATED')).toBe(true);
  });
  it('lays out a built-in preview card with the printed link, the site name and the flavor chart', () => {
    const card = layoutFor(cards['cocktail/boulevardier'], 'neuralflavor.web.app/r/cocktail/boulevardier');
    const text = card.primitives.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
    expect(card.width).toBe(1200);
    expect(card.height).toBe(630);
    expect(text).toContain('Boulevardier');
    expect(text).toContain('neuralflavor.web.app/r/cocktail/boulevardier');
    expect(text).toContain('Neural Flavor');
    expect(text).toContain('flavor chart');
    expect(generated.FORMATS.preview.width).toBe(1200);
  });
  it('FLAVOR-6: the committed switch is on, every card in share-cards.json has bars, and the card draws the chart', () => {
    expect(generated.SHARE_CHARTS_ENABLED).toBe(true);
    for (const c of Object.values(realCards as Record<string, any>)) expect(c.bars.length).toBeGreaterThan(0);
    const text = layoutFor(cards['cocktail/boulevardier'], 'x').primitives.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
    expect(text).toContain('flavor chart');
  });
  it('the preview chart keeps to three tastes and three aromas and stays inside the card, even for the busiest recipes', () => {
    const busiest = Object.entries(cards).sort((x, y) => y[1].bars.length - x[1].bars.length).slice(0, 5).map(([k]) => k);
    for (const key of ['cocktail/negroni', 'cocktail/daiquiri', 'dish/beef-bolognese', ...busiest]) {
      const card = layoutFor(cards[key], 'x') as any;
      // AROMA-4: the chart is the display rule's 'card' selection, at most 3 tastes + 3 aromas.
      const shown = (generated as any).groupBars(cards[key].bars, 'card').bars;
      const labels = new Set(shown.map((b: any) => b.label.charAt(0).toUpperCase() + b.label.slice(1)));
      const drawn = card.primitives.filter((p: any) => p.type === 'text' && [...labels].includes(p.text));
      expect(drawn.length).toBe(shown.length);
      expect(shown.length).toBeLessThanOrEqual(6);
      for (const p of card.primitives.filter((q: any) => q.type !== 'line')) expect(p.y + (p.h || 0)).toBeLessThanOrEqual(card.height);
    }
  });
  it('the layout itself still draws the chart when handed bars (what switching it on restores)', () => {
    const bars = [{ label: 'sweet', color: '#ff00aa', score: 0.8 }];
    const card = generated.layoutCard({ format: 'preview', recipe: { ...cards['cocktail/boulevardier'], method: '' }, bars, link: 'x' });
    expect(card.primitives.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')).toContain('flavor chart: a visual guide');
  });
  it('no-chart preview: the ingredients use the full width (two columns from six lines)', () => {
    const lines = Array.from({ length: 8 }, (_, i) => ({ label: `thing ${i}`, amount: '1' }));
    const card = layoutFor({ name: 'Big dish', kind: 'dish', lines, lineCount: 8, bars: [] }, 'x');
    const xs = card.primitives.filter((p: any) => p.type === 'text' && /^thing/.test(p.text)).map((p: any) => p.x);
    expect(Math.max(...xs)).toBeGreaterThan(600);
  });
  it('draws the chart for a recipe with enough flavor data (FLAVOR-6)', () => {
    expect(cards['cocktail/negroni'].bars.length).toBeGreaterThan(0);
    const card = layoutFor(cards['cocktail/negroni'], 'neuralflavor.web.app/r/cocktail/negroni');
    const text = card.primitives.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
    expect(text).toContain('Negroni');
    expect(text).toContain('Bitter');
  });
  it('maps every primitive kind to a satori node', () => {
    const tree = toSatori(layoutFor(cards['cocktail/negroni'], 'x') as any) as any;
    expect(tree.props.style.width).toBe(1200);
    expect(tree.props.children.length).toBeGreaterThan(10);
    for (const c of tree.props.children) expect(c.type).toBe('div');
  });
});
