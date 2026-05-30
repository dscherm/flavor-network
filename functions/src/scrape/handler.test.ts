import { describe, it, expect } from 'vitest';
import { handleScrape } from './handler';
import type { FetchedPage, UrlFetcher } from './types';

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

  it('returns status=error when the page has no JSON-LD Recipe', async () => {
    const result = await handleScrape('https://example.com/notarecipe', {
      fetcher: mockFetcher('<html><body>just a page</body></html>'),
    });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toMatch(/No Recipe schema/);
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
    expect(result.errorMessage).toMatch(/No Recipe schema/);
  });
});
