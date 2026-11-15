import { describe, it, expect } from 'vitest';
import { shareTargetUrls, absoluteShareUrl, shareTextFor, captionFor, printedLinkFor, SHARE_OWN_ENABLED } from '../shareTargets.js';

const TRICKY = `Tom & Jerry's "Special" 🍸`;
const URL_ = 'https://neuralflavor.web.app/r/cocktail/tom-and-jerrys';

function param(u, k) { return new URL(u).searchParams.get(k); }

describe('shareTargetUrls', () => {
  const text = shareTextFor({ name: TRICKY });
  const t = shareTargetUrls({ title: TRICKY, text, url: URL_ });

  it('X carries text and url as separate encoded parameters', () => {
    expect(t.x.startsWith('https://twitter.com/intent/tweet?')).toBe(true);
    expect(param(t.x, 'text')).toBe(text);
    expect(param(t.x, 'url')).toBe(URL_);
  });
  it('Facebook and Pinterest encode the url', () => {
    expect(param(t.facebook, 'u')).toBe(URL_);
    expect(param(t.pinterest, 'url')).toBe(URL_);
    expect(param(t.pinterest, 'description')).toBe(text);
  });
  it('WhatsApp puts text and link in one encoded message', () => {
    expect(param(t.whatsapp, 'text')).toBe(`${text} ${URL_}`);
  });
  it('no raw ampersand, quote, apostrophe, space or emoji survives in a query', () => {
    for (const u of Object.values(t)) {
      const q = u.split('?')[1];
      expect(q).not.toMatch(/["' 🍸]/);
      // every & separates a known key
      for (const part of q.split('&')) expect(part).toMatch(/^[a-z]+=/);
    }
    expect(t.x).toContain('%26');
    expect(t.x).toContain('%22');
    expect(t.x).toContain('%F0%9F%8D%B8');
  });
});

describe('helpers', () => {
  it('absoluteShareUrl joins origin and path', () => {
    expect(absoluteShareUrl('/r/dish/risotto', 'https://x.app')).toBe('https://x.app/r/dish/risotto');
    expect(absoluteShareUrl('/r/dish/risotto', 'https://x.app/')).toBe('https://x.app/r/dish/risotto');
    expect(absoluteShareUrl('', 'https://x.app')).toBe('');
  });
  it('shareTextFor is a short plain line', () => {
    expect(shareTextFor({ name: 'Negroni' })).toBe('Negroni, on Neural Flavor');
    expect(shareTextFor({})).toBe('A recipe on Neural Flavor');
  });
  it('sharing own items is off until SHARE-6', () => {
    expect(SHARE_OWN_ENABLED).toBe(false);
  });
});

describe('captionFor', () => {
  it('has the name, the link as text and two hashtags', () => {
    const c = captionFor({ kind: 'cocktail', name: 'Negroni' }, 'https://neuralflavor.web.app/r/cocktail/negroni');
    expect(c.split(String.fromCharCode(10))).toEqual(['Negroni', 'https://neuralflavor.web.app/r/cocktail/negroni', '', '#neuralflavor #cocktails']);
    expect(captionFor({ kind: 'sauce', name: 'Alfredo' }, 'x')).toMatch(/#neuralflavor #sauce$/);
    expect(captionFor({ kind: 'dish', name: 'Risotto' }, 'x')).toMatch(/#neuralflavor #cooking$/);
    expect(captionFor({ kind: 'dish', name: '' }, 'x')).toMatch(/^A recipe/);
  });
});

describe('printedLinkFor', () => {
  it('prints the site host and path, never localhost', () => {
    expect(printedLinkFor('/r/cocktail/negroni', 'https://neuralflavor.web.app')).toBe('neuralflavor.web.app/r/cocktail/negroni');
    expect(printedLinkFor('/r/cocktail/negroni', 'http://localhost:5173')).toBe('neuralflavor.web.app/r/cocktail/negroni');
    expect(printedLinkFor('/r/ab12cd', '')).toBe('neuralflavor.web.app/r/ab12cd');
    expect(printedLinkFor('', 'https://neuralflavor.web.app')).toBe('');
  });
});
