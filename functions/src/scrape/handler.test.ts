import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BROWSER_HEADERS,
  DEFAULT_BUDGET_MS,
  READER_PROXY_BASE,
  defaultFetcher,
  handleScrape,
} from './handler';
import type { FetchedPage, UrlFetcher } from './types';

// The fetcher runs assertHostnameResolvesPublicly() before every hop, which
// does a real DNS lookup. Stub the resolver to a public address so these
// tests exercise fetch behaviour without depending on the network — the SSRF
// resolution logic itself is covered by ssrf.test.ts.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

function mockFetcher(body: string, finalUrl = 'https://example.com/recipe'): UrlFetcher {
  return {
    async fetch(url: string): Promise<FetchedPage> {
      return { url, finalUrl, contentType: 'text/html', body };
    },
  };
}

const RECIPE_JSON_LD_HTML = `<html><head>
<script type="application/ld+json">
{ "@type": "Recipe", "name": "Mock Cookies",
  "recipeIngredient": ["2 cups flour", "1 cup sugar", "1 stick butter"] }
</script></head></html>`;

describe('handleScrape', () => {
  it('returns status=ok with title + ingredients on a page with JSON-LD Recipe', async () => {
    const result = await handleScrape('https://example.com/recipe', {
      fetcher: mockFetcher(RECIPE_JSON_LD_HTML),
    });
    expect(result.status).toBe('ok');
    expect(result.title).toBe('Mock Cookies');
    expect(result.ingredients).toHaveLength(3);
    expect(result.finalUrl).toBe('https://example.com/recipe');
  });

  it('returns status=error when the page has no recipe markup at all', async () => {
    const result = await handleScrape('https://example.com/notarecipe', {
      fetcher: mockFetcher('<html><body>just a page</body></html>'),
    });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toMatch(/No recipe markup found/);
  });

  it('returns status=error when the URL is invalid', async () => {
    const result = await handleScrape('not a url', {
      fetcher: mockFetcher(RECIPE_JSON_LD_HTML),
    });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('invalid URL');
  });

  it('returns status=error when the URL is empty', async () => {
    const result = await handleScrape('', { fetcher: mockFetcher('') });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toMatch(/url is required/);
  });

  it('returns status=error when the URL points at a forbidden internal host', async () => {
    const result = await handleScrape('http://127.0.0.1/recipe', {
      fetcher: mockFetcher(RECIPE_JSON_LD_HTML),
    });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toMatch(/forbidden internal host/);
  });

  it('returns status=error when the fetcher throws', async () => {
    const result = await handleScrape('https://example.com/recipe', {
      fetcher: {
        async fetch() {
          throw new Error('connection refused');
        },
      },
    });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toMatch(/connection refused/);
  });

  it('returns status=error when JSON-LD Recipe has zero ingredients', async () => {
    const result = await handleScrape('https://example.com/recipe', {
      fetcher: mockFetcher(`<script type="application/ld+json">
        { "@type": "Recipe", "name": "Just a title", "recipeIngredient": [] }
      </script>`),
    });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toMatch(/No recipe markup found/);
  });

  // WEBLINK-3: JSON-LD stays authoritative — a page carrying both must not
  // fall through to the guessier layers.
  it('reports which strategy parsed the page, preferring JSON-LD', async () => {
    const result = await handleScrape('https://example.com/recipe', {
      fetcher: mockFetcher(RECIPE_JSON_LD_HTML),
    });
    expect(result.parseStrategy).toBe('json-ld');
  });

  it('parses a page that has microdata but no JSON-LD', async () => {
    const result = await handleScrape('https://example.com/recipe', {
      fetcher: mockFetcher(
        `<div itemscope itemtype="http://schema.org/Recipe">
           <h1 itemprop="name">Skillet Cornbread</h1>
           <li itemprop="recipeIngredient">1 cup cornmeal</li>
           <li itemprop="recipeIngredient">1 cup buttermilk</li>
         </div>`,
      ),
    });
    expect(result.status).toBe('ok');
    expect(result.title).toBe('Skillet Cornbread');
    expect(result.ingredients).toHaveLength(2);
    expect(result.parseStrategy).toBe('microdata');
  });
});

// WEBLINK-1 (2026-07-31): the bot-advertising user-agent was the reason
// URL import failed on real recipe sites. Lock the browser-realistic header
// set and the widened budget so a future edit can't quietly regress them.
describe('outbound request shape', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('advertises a real desktop browser, not a bot', () => {
    expect(BROWSER_HEADERS['user-agent']).toMatch(/^Mozilla\/5\.0/);
    expect(BROWSER_HEADERS['user-agent']).not.toMatch(/flavor-network|bot|scrape/i);
    expect(BROWSER_HEADERS['accept-language']).toBeTruthy();
    expect(BROWSER_HEADERS['sec-fetch-dest']).toBe('document');
    expect(BROWSER_HEADERS['sec-fetch-mode']).toBe('navigate');
    expect(BROWSER_HEADERS['sec-fetch-site']).toBe('none');
  });

  it('allows 15s for the fetch, comfortably inside the 30s callable timeout', () => {
    expect(DEFAULT_BUDGET_MS).toBe(15_000);
    expect(DEFAULT_BUDGET_MS).toBeLessThan(25_000);
  });

  it('sends the browser header set on the wire', async () => {
    const seen: Array<Record<string, string>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        seen.push(init.headers as Record<string, string>);
        return {
          status: 200,
          ok: true,
          headers: { get: () => 'text/html' },
          async text(): Promise<string> {
            return RECIPE_JSON_LD_HTML;
          },
        };
      }),
    );

    const page = await defaultFetcher.fetch('https://example.com/recipe');

    expect(page.body).toBe(RECIPE_JSON_LD_HTML);
    expect(seen).toHaveLength(1);
    expect(seen[0]['user-agent']).toMatch(/^Mozilla\/5\.0/);
    expect(seen[0]['accept-language']).toBe('en-US,en;q=0.9');
  });

  it('re-sends the browser headers on every redirect hop', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        seen.push((init.headers as Record<string, string>)['user-agent']);
        if (url === 'https://example.com/recipe') {
          return {
            status: 301,
            ok: false,
            headers: { get: (h: string) => (h === 'location' ? 'https://example.com/final' : null) },
            async text(): Promise<string> {
              return '';
            },
          };
        }
        return {
          status: 200,
          ok: true,
          headers: { get: () => 'text/html' },
          async text(): Promise<string> {
            return RECIPE_JSON_LD_HTML;
          },
        };
      }),
    );

    const page = await defaultFetcher.fetch('https://example.com/recipe');

    expect(page.finalUrl).toBe('https://example.com/final');
    expect(seen).toHaveLength(2);
    expect(seen.every((ua) => /^Mozilla\/5\.0/.test(ua))).toBe(true);
  });
});

// WEBLINK-2 (2026-07-31): headers alone can't reach the Dotdash Meredith
// properties — they answer HTTP 402 to any datacenter IP. One reader-proxy
// retry recovers them. These tests pin exactly WHEN that retry may fire.
describe('reader-proxy fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stub global fetch with a status per requested URL. Records every call. */
  function stubFetch(handler: (url: string) => { status: number; body?: string }) {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        const { status, body = '' } = handler(url);
        return {
          status,
          ok: status >= 200 && status < 300,
          headers: { get: () => 'text/html' },
          async text(): Promise<string> {
            return body;
          },
        };
      }),
    );
    return calls;
  }

  const ORIGIN = 'https://blocked.example.com/recipe';

  it('never proxies when the origin answers directly', async () => {
    const calls = stubFetch(() => ({ status: 200, body: RECIPE_JSON_LD_HTML }));

    const page = await defaultFetcher.fetch(ORIGIN);

    expect(page.fetchPath).toBe('direct');
    expect(calls).toEqual([ORIGIN]);
    expect(calls.some((u) => u.startsWith(READER_PROXY_BASE))).toBe(false);
  });

  it('retries through the reader proxy when the origin returns 402', async () => {
    const calls = stubFetch((url) =>
      url.startsWith(READER_PROXY_BASE)
        ? { status: 200, body: RECIPE_JSON_LD_HTML }
        : { status: 402 },
    );

    const page = await defaultFetcher.fetch(ORIGIN);

    expect(page.fetchPath).toBe('proxy');
    expect(page.body).toBe(RECIPE_JSON_LD_HTML);
    expect(calls).toEqual([ORIGIN, `${READER_PROXY_BASE}${ORIGIN}`]);
  });

  it('asks the proxy for HTML, not markdown, so JSON-LD survives', async () => {
    const seen: Array<Record<string, string>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        seen.push(init.headers as Record<string, string>);
        const proxied = url.startsWith(READER_PROXY_BASE);
        return {
          status: proxied ? 200 : 403,
          ok: proxied,
          headers: { get: () => 'text/html' },
          async text(): Promise<string> {
            return RECIPE_JSON_LD_HTML;
          },
        };
      }),
    );

    await defaultFetcher.fetch(ORIGIN);

    expect(seen[1]['x-return-format']).toBe('html');
  });

  it.each([401, 403, 406, 429, 451, 500, 503])(
    'treats HTTP %i as a bot block worth proxying',
    async (status) => {
      const calls = stubFetch((url) =>
        url.startsWith(READER_PROXY_BASE) ? { status: 200, body: RECIPE_JSON_LD_HTML } : { status },
      );

      const page = await defaultFetcher.fetch(ORIGIN);

      expect(page.fetchPath).toBe('proxy');
      expect(calls).toHaveLength(2);
    },
  );

  it.each([404, 410])('does not burn a proxy hop on HTTP %i', async (status) => {
    const calls = stubFetch(() => ({ status }));

    await expect(defaultFetcher.fetch(ORIGIN)).rejects.toThrow(new RegExp(`HTTP ${status}`));
    expect(calls).toEqual([ORIGIN]);
  });

  it('reports the origin status when the proxy also fails', async () => {
    stubFetch((url) => ({ status: url.startsWith(READER_PROXY_BASE) ? 503 : 402 }));

    await expect(defaultFetcher.fetch(ORIGIN)).rejects.toThrow(/HTTP 402/);
    await expect(defaultFetcher.fetch(ORIGIN)).rejects.toThrow(/site blocked the import/);
  });

  it('proxies at most once — no retry storm', async () => {
    const calls = stubFetch(() => ({ status: 402 }));

    await expect(defaultFetcher.fetch(ORIGIN)).rejects.toThrow();
    expect(calls).toHaveLength(2);
  });

  it('proxies the post-redirect URL, not the original', async () => {
    const REDIRECTED = 'https://blocked.example.com/final';
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url === ORIGIN) {
          return {
            status: 301,
            ok: false,
            headers: { get: (h: string) => (h === 'location' ? REDIRECTED : null) },
            async text(): Promise<string> {
              return '';
            },
          };
        }
        const proxied = url.startsWith(READER_PROXY_BASE);
        return {
          status: proxied ? 200 : 402,
          ok: proxied,
          headers: { get: () => 'text/html' },
          async text(): Promise<string> {
            return RECIPE_JSON_LD_HTML;
          },
        };
      }),
    );

    const page = await defaultFetcher.fetch(ORIGIN);

    expect(page.fetchPath).toBe('proxy');
    expect(calls[2]).toBe(`${READER_PROXY_BASE}${REDIRECTED}`);
  });

  it('surfaces the fetch path on the scrape result', async () => {
    const result = await handleScrape('https://example.com/recipe', {
      fetcher: {
        async fetch(url: string): Promise<FetchedPage> {
          return {
            url,
            finalUrl: url,
            contentType: 'text/html',
            body: RECIPE_JSON_LD_HTML,
            fetchPath: 'proxy',
          };
        },
      },
    });

    expect(result.status).toBe('ok');
    expect(result.fetchPath).toBe('proxy');
  });
});
