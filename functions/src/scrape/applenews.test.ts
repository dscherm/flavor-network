// WEBLINK-8 (2026-08-01). Every assertion here runs against the REAL
// interstitial captured from apple.news/KcFmm7QLuNEyYYYM2Bm9Z_w (an
// America's Test Kitchen recipe) — see __fixtures__/. A hand-written mock
// would have encoded my assumptions about the page rather than the page.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  appleNewsErrorMessage,
  isAppleNewsUrl,
  parseAppleNewsInterstitial,
} from './applenews';
import { handleScrape } from './handler';
import type { FetchedPage, UrlFetcher } from './types';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const INTERSTITIAL = readFileSync(
  join(__dirname, '__fixtures__', 'apple-news-interstitial.html'),
  'utf8',
);

const APPLE_NEWS_URL =
  'https://apple.news/KcFmm7QLuNEyYYYM2Bm9Z_w?article_id=AhwjI88zeSaOwb_V9VlZpXw';

function fetcherReturning(body: string): UrlFetcher {
  return {
    async fetch(url: string): Promise<FetchedPage> {
      return { url, finalUrl: url, contentType: 'text/html', body, fetchPath: 'direct' };
    },
  };
}

describe('isAppleNewsUrl', () => {
  it('recognises apple.news links', () => {
    expect(isAppleNewsUrl(APPLE_NEWS_URL)).toBe(true);
    expect(isAppleNewsUrl('https://www.apple.news/abc')).toBe(true);
  });

  it('does not fire on ordinary recipe sites', () => {
    expect(isAppleNewsUrl('https://www.seriouseats.com/classic-panzanella-salad-recipe')).toBe(false);
    expect(isAppleNewsUrl('https://www.apple.com/news/')).toBe(false);
    // Must not be fooled by a lookalike host.
    expect(isAppleNewsUrl('https://apple.news.evil.example.com/x')).toBe(false);
    expect(isAppleNewsUrl('not a url')).toBe(false);
  });
});

describe('parseAppleNewsInterstitial (real captured page)', () => {
  const info = parseAppleNewsInterstitial(INTERSTITIAL);

  it('extracts the recipe title without the publisher suffix', () => {
    // og:title is "Miso Pork and Eggplant Stir-Fry — America's Test Kitchen".
    expect(info.title).toBe('Miso Pork and Eggplant Stir-Fry');
  });

  it('keeps hyphens inside the recipe name', () => {
    // The suffix separator is an em dash; "Stir-Fry" must survive intact.
    expect(info.title).toContain('Stir-Fry');
  });

  it('extracts the publisher and decodes its entities', () => {
    // The page encodes the apostrophe as &#x27;.
    expect(info.publisher).toBe("America's Test Kitchen");
    expect(info.publisher).not.toContain('&#');
  });

  it('finds NO publisher URL — the whole reason this module exists', () => {
    // Every absolute URL on the interstitial is an Apple domain. Confirmed
    // by inspection: no canonical, no og:url, only apple.com / c.apple.news
    // / w3.org + ogp.me namespace declarations.
    expect(info.publisherUrl).toBeNull();
  });

  it('does not mistake Apple chrome or XML namespaces for the article', () => {
    expect(INTERSTITIAL).toContain('https://www.apple.com/privacy/');
    expect(INTERSTITIAL).toContain('http://ogp.me/ns#');
    expect(info.publisherUrl).toBeNull();
  });
});

describe('publisher-URL resolution when one IS present', () => {
  it('picks up a canonical link', () => {
    const html = `<html><head>
      <link rel="canonical" href="https://www.bonappetit.com/recipe/x">
      <meta property="og:title" content="Some Recipe — Bon Appetit">
    </head></html>`;
    expect(parseAppleNewsInterstitial(html).publisherUrl).toBe('https://www.bonappetit.com/recipe/x');
  });

  it('picks up og:url', () => {
    const html = `<meta property="og:url" content="https://www.seriouseats.com/x">`;
    expect(parseAppleNewsInterstitial(html).publisherUrl).toBe('https://www.seriouseats.com/x');
  });

  it('falls back to any non-Apple absolute link', () => {
    const html = `<a href="https://www.apple.com/privacy/">p</a>
                  <a href="https://food52.com/recipes/123-thing">read on the web</a>`;
    expect(parseAppleNewsInterstitial(html).publisherUrl).toBe('https://food52.com/recipes/123-thing');
  });
});

describe('appleNewsErrorMessage', () => {
  const msg = appleNewsErrorMessage(parseAppleNewsInterstitial(INTERSTITIAL));

  it('names the recipe and publisher so the user knows we read the right one', () => {
    expect(msg).toContain('Miso Pork and Eggplant Stir-Fry');
    expect(msg).toContain("America's Test Kitchen");
  });

  it('does not promise Open-in-Safari always exists', () => {
    // News+ articles have no public web version, and the sample that
    // motivated this module is from a News+ publisher. Overpromising here
    // would send the user hunting for a menu item that isn't there.
    expect(msg).toMatch(/News\+/);
    expect(msg).toMatch(/by hand/i);
  });

  it('degrades gracefully when the page yields nothing', () => {
    const bare = appleNewsErrorMessage({ title: null, publisher: null, publisherUrl: null });
    expect(bare).toContain('that article');
    expect(bare).not.toContain('undefined');
    expect(bare).not.toContain('null');
  });
});

describe('handleScrape on apple.news', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the Apple News branch, not the generic no-markup error', async () => {
    const result = await handleScrape(APPLE_NEWS_URL, {
      fetcher: fetcherReturning(INTERSTITIAL),
    });
    expect(result.status).toBe('error');
    expect(result.errorMessage).not.toMatch(/No recipe markup found/);
    expect(result.errorMessage).toContain('Apple News');
    expect(result.appleNews).toEqual({
      title: 'Miso Pork and Eggplant Stir-Fry',
      publisher: "America's Test Kitchen",
    });
  });

  it('follows through to the publisher when the interstitial exposes one', async () => {
    const RECIPE = `<script type="application/ld+json">
      { "@type": "Recipe", "name": "Resolved Recipe",
        "recipeIngredient": ["1 cup flour", "2 eggs"] }
    </script>`;
    const seen: string[] = [];
    const fetcher: UrlFetcher = {
      async fetch(url: string): Promise<FetchedPage> {
        seen.push(url);
        const body = url.includes('apple.news')
          ? `<link rel="canonical" href="https://example.com/real-recipe">`
          : RECIPE;
        return { url, finalUrl: url, contentType: 'text/html', body, fetchPath: 'direct' };
      },
    };

    const result = await handleScrape(APPLE_NEWS_URL, { fetcher });

    expect(result.status).toBe('ok');
    expect(result.title).toBe('Resolved Recipe');
    expect(seen[1]).toBe('https://example.com/real-recipe');
  });

  it('runs the SSRF gauntlet on the followed publisher URL', async () => {
    // A hostile interstitial naming an internal host must not be followed.
    const fetcher = fetcherReturning(`<link rel="canonical" href="http://127.0.0.1/admin">`);
    const result = await handleScrape(APPLE_NEWS_URL, { fetcher });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toMatch(/forbidden internal host/);
  });

  it('leaves non-apple.news URLs completely alone', async () => {
    const result = await handleScrape('https://example.com/recipe', {
      fetcher: fetcherReturning(`<script type="application/ld+json">
        { "@type": "Recipe", "name": "Normal", "recipeIngredient": ["1 cup flour"] }
      </script>`),
    });
    expect(result.status).toBe('ok');
    expect(result.appleNews).toBeUndefined();
  });
});

// WEBLINK-8 follow-up: a SECOND real interstitial, chosen to straddle the
// paywall boundary. America's Test Kitchen is a News+ (paywalled) publisher;
// Epicurious is free Condé Nast. If only News+ withheld the publisher URL,
// the resolver path would be the primary one for free publishers. It isn't —
// both pages are byte-for-byte the same shape, which is what makes
// "explain honestly" the main path rather than the fallback.
const EPICURIOUS = readFileSync(
  join(__dirname, '__fixtures__', 'apple-news-interstitial-epicurious.html'),
  'utf8',
);

describe('apple.news behaves the same for free and paywalled publishers', () => {
  const info = parseAppleNewsInterstitial(EPICURIOUS);

  it('extracts title and publisher from the free-publisher page too', () => {
    expect(info.title).toBe('Southern Thai Fried Chicken (Gai Tod Hat Yai)');
    expect(info.publisher).toBe('Epicurious');
  });

  it('preserves parentheses in the recipe name', () => {
    expect(info.title).toContain('(Gai Tod Hat Yai)');
  });

  it('exposes NO publisher URL, exactly like the News+ sample', () => {
    expect(info.publisherUrl).toBeNull();
    // Not one external link on the page — the whole basis for this module.
    const external = (EPICURIOUS.match(/https?:\/\/[^"'\s<>)]+/g) ?? [])
      .filter((u) => !/apple\.com|apple\.news|cdn-apple|mzstatic|w3\.org|ogp\.me/i.test(u));
    expect(external).toEqual([]);
  });

  it('names the recipe in the error so the user sees we read the right one', () => {
    const msg = appleNewsErrorMessage(info);
    expect(msg).toContain('Southern Thai Fried Chicken');
    expect(msg).toContain('Epicurious');
  });
});
