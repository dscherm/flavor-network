import { describe, expect, it, vi } from 'vitest';
import {
  createShellFetcher,
  handleSharePreview,
  originFor,
  parseTarget,
  type ShareDeps,
  type ShareEntry,
} from './handler';
import realIndex from './share-index.json';

const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Flavor Network</title>
    <meta name="description" content="old" />
    <meta property="og:title" content="Neural Flavor" />
    <meta property="og:image" content="https://x/old.png" />
    <meta name="twitter:card" content="summary" />
    <script type="module" src="/assets/index-abc.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

const HOST = { host: 'neuralflavor.web.app' };

function deps(over: Partial<ShareDeps> = {}): ShareDeps {
  return {
    fetchIndexHtml: async () => SHELL,
    lookupShared: async () => null,
    index: realIndex as Record<string, ShareEntry>,
    log: () => {},
    ...over,
  };
}

const count = (s: string, re: RegExp) => (s.match(re) || []).length;

describe('handleSharePreview, built-in recipes', () => {
  for (const [kind, slug] of [['cocktail', 'negroni'], ['sauce', 'alfredo'], ['dish', 'margherita-pizza']] as const) {
    it(`fills the tags for ${kind}/${slug}`, async () => {
      const entry = (realIndex as Record<string, ShareEntry>)[`${kind}/${slug}`];
      expect(entry).toBeTruthy();
      const res = await handleSharePreview({ path: `/r/${kind}/${slug}`, headers: HOST }, deps());
      expect(res.status).toBe(200);
      expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
      expect(res.headers['Cache-Control']).toBe('public, max-age=600, s-maxage=600');
      const b = res.body;
      expect(b).toContain(`<title>${entry.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;')} | Neural Flavor</title>`);
      expect(b).toContain('property="og:type" content="article"');
      expect(b).toContain('property="og:site_name" content="Neural Flavor"');
      expect(b).toContain(`property="og:url" content="https://neuralflavor.web.app/r/${kind}/${slug}"`);
      expect(b).toContain(`property="og:image" content="https://neuralflavor.web.app/r-img/${kind}/${slug}.png"`);
      expect(b).toContain('name="twitter:card" content="summary_large_image"');
      expect(b).toContain('name="twitter:image"');
      expect(b).toContain('name="twitter:title"');
      expect(b).toContain('name="twitter:description"');
      expect(b).toContain('name="description"');
      expect(b).toContain('/assets/index-abc.js');
    });
  }

  it('uses the first ingredients in the cocktail description', async () => {
    const e = (realIndex as Record<string, ShareEntry>)['cocktail/negroni'];
    expect(e.description).toMatch(/^Gin, /);
    expect(e.description).toMatch(/A cocktail on Neural Flavor\.$/);
  });

  it('replaces existing tags instead of duplicating them', async () => {
    const res = await handleSharePreview({ path: '/r/cocktail/negroni', headers: HOST }, deps());
    expect(count(res.body, /<title/g)).toBe(1);
    expect(count(res.body, /name="description"/g)).toBe(1);
    expect(count(res.body, /property="og:title"/g)).toBe(1);
    expect(count(res.body, /property="og:image"/g)).toBe(1);
    expect(count(res.body, /name="twitter:card"/g)).toBe(1);
    expect(res.body).not.toContain('old.png');
    expect(res.body).not.toContain('content="old"');
  });
});

describe('escaping', () => {
  it('escapes quotes, angle brackets, ampersand and apostrophe in every value', async () => {
    const nasty = `A "B" <script>alert('x')</script> & Co`;
    const res = await handleSharePreview(
      { path: '/r/cocktail/evil', headers: HOST },
      deps({ index: { 'cocktail/evil': { name: nasty, description: nasty, kind: 'cocktail' } } }),
    );
    expect(res.body).not.toContain('<script>alert');
    expect(res.body).toContain('A &quot;B&quot; &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; Co');
    expect(res.body).not.toMatch(/content="[^"]*"[^>]*"[^"]*<script/);
  });
});

describe('generic tags', () => {
  const generic = (b: string) => {
    expect(b).toContain('<title>Neural Flavor</title>');
    expect(b).toContain('property="og:type" content="website"');
    expect(b).toContain('name="twitter:card" content="summary"');
    expect(b).not.toContain('/r-img/');
  };
  it('unknown slug', async () => {
    generic((await handleSharePreview({ path: '/r/cocktail/no-such-thing', headers: HOST }, deps())).body);
  });
  it('unknown kind', async () => {
    generic((await handleSharePreview({ path: '/r/wine/merlot', headers: HOST }, deps())).body);
  });
  it('prototype keys are not slugs', async () => {
    generic((await handleSharePreview({ path: '/r/cocktail/__proto__', headers: HOST }, deps())).body);
  });
  it('/r/<id> with lookupShared returning null', async () => {
    const lookupShared = vi.fn(async () => null);
    generic((await handleSharePreview({ path: '/r/ab12cd', headers: HOST }, deps({ lookupShared }))).body);
    expect(lookupShared).toHaveBeenCalledWith('ab12cd');
  });
  it('/r/<id> with a hit uses the shared recipe', async () => {
    const res = await handleSharePreview(
      { path: '/r/ab12cd', headers: HOST },
      deps({ lookupShared: async () => ({ name: 'My Soup', description: 'Leeks, stock.' }) }),
    );
    expect(res.body).toContain('<title>My Soup | Neural Flavor</title>');
    expect(res.body).toContain('og:image" content="https://neuralflavor.web.app/r-img/ab12cd.png"');
  });
  it('a throwing lookupShared gives generic tags and still 200', async () => {
    const res = await handleSharePreview(
      { path: '/r/ab12cd', headers: HOST },
      deps({ lookupShared: async () => { throw new Error('firestore down'); } }),
    );
    expect(res.status).toBe(200);
    generic(res.body);
  });
});

describe('host handling', () => {
  it('a spoofed Host falls back to the canonical host', async () => {
    const res = await handleSharePreview(
      { path: '/r/cocktail/negroni', headers: { host: 'evil.example.com', 'x-forwarded-host': 'evil.example.com' } },
      deps(),
    );
    expect(res.body).not.toContain('evil.example.com');
    expect(res.body).toContain('https://neuralflavor.web.app/r/cocktail/negroni');
  });
  it('honours x-forwarded-host and the allow-list', () => {
    expect(originFor({ 'x-forwarded-host': 'neuralflavor.firebaseapp.com', host: 'cloudfunctions.net' })).toBe('https://neuralflavor.firebaseapp.com');
    expect(originFor({ host: 'localhost:5000' })).toBe('http://localhost:5000');
    expect(originFor({ host: 'neuralflavor.web.app.evil.com' })).toBe('https://neuralflavor.web.app');
    expect(originFor({})).toBe('https://neuralflavor.web.app');
  });
  it('parseTarget', () => {
    expect(parseTarget('/r/cocktail/Negroni')).toEqual({ kind: 'cocktail', slug: 'negroni' });
    expect(parseTarget('/r/abc')).toEqual({ id: 'abc' });
    expect(parseTarget('/x/abc')).toBeNull();
    expect(parseTarget('/r/a/b/c')).toBeNull();
  });
});

describe('failure behaviour', () => {
  it('a failing shell fetch still returns 200 with usable HTML and a link home', async () => {
    const log = vi.fn();
    const res = await handleSharePreview(
      { path: '/r/cocktail/negroni', headers: HOST },
      deps({ fetchIndexHtml: async () => { throw new Error('boom'); }, log }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toContain('<title>');
    expect(res.body).toContain('href="/"');
    expect(res.body).toContain('og:title');
    expect(log).toHaveBeenCalled();
  });
  it('an empty index still works', async () => {
    const res = await handleSharePreview({ path: '/r/cocktail/negroni', headers: HOST }, deps({ index: {} }));
    expect(res.status).toBe(200);
    expect(res.body).toContain('<title>Neural Flavor</title>');
  });
});

describe('createShellFetcher', () => {
  it('caches within the TTL, refreshes after, and serves stale on failure', async () => {
    let t = 0;
    let n = 0;
    let fail = false;
    const f = createShellFetcher(async () => {
      if (fail) throw new Error('down');
      n += 1;
      return `shell-${n}`;
    }, () => t, 1000);
    expect(await f('o')).toBe('shell-1');
    t = 500;
    expect(await f('o')).toBe('shell-1');
    t = 2000;
    expect(await f('o')).toBe('shell-2');
    fail = true;
    t = 5000;
    expect(await f('o')).toBe('shell-2');
  });
  it('throws when nothing was ever cached', async () => {
    const f = createShellFetcher(async () => { throw new Error('down'); });
    await expect(f('o')).rejects.toThrow('down');
  });
});
