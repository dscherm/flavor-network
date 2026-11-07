// WEBLINK-17. Publisher map, title matching, candidate extraction and the
// resolver, all offline: the fetcher is a URL→page table, and the search-page
// fixtures reproduce the link lists the live sites returned on 2026-11-07.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MIN_COVERAGE,
  MIN_DICE,
  PUBLISHERS,
  cleanAppleTitle,
  extractCandidates,
  findPublisher,
  isAmbiguous,
  resolveAppleNews,
  scoreTitles,
  stripByline,
  titlesMatch,
  webSearchQuery,
} from './applenewsResolve';
import { handleScrape } from './handler';
import type { FetchedPage, UrlFetcher } from './types';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
const ATK_INTERSTITIAL = fixture('apple-news-interstitial.html');
const EPI_INTERSTITIAL = fixture('apple-news-interstitial-epicurious.html');

/** Recipe page with JSON-LD, the shape every resolvable publisher serves. */
function recipePage(name: string, ingredients = ['1 cup rice', '2 eggs']): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Recipe', name, recipeIngredient: ingredients,
  })}</script></head><body></body></html>`;
}

/** Search page: a list of hrefs, as the live search pages render them. */
function searchPage(hrefs: string[]): string {
  return `<html><body>${hrefs.map((h) => `<a href="${h}">x</a>`).join('\n')}</body></html>`;
}

// Link lists observed on the live search pages (trimmed).
const EPI_SEARCH = searchPage([
  '/recipes/food/views/southern-thai-fried-chicken-gai-tod-hat-yai',
  '/recipes/food/views/black-pepper-roasted-chicken',
  '/recipes/food/views/thai-muslim-style-grilled-chicken',
  '/recipes/food/views/southern-fried-chicken-with-country-gravy-352491',
  '/recipes/food/views/gai-yang',
  '/recipes-menus/fried-chicken-recipes-gallery', // a gallery, not a recipe
  'https://evil.example.com/recipes/food/views/southern-thai-fried-chicken-gai-tod-hat-yai',
]);
const ATK_SEARCH = searchPage([
  '/recipes/15117-miso-glazed-pork-with-squash-and-brussels-sprouts',
  '/recipes/12529-slow-cooker-miso-pork-ramen',
  '/recipes/17701-miso-pork-and-eggplant-stir-fry',
  '/recipes/17591-seared-eggplant-with-spicy-pork',
]);
const BA_TUNA_SEARCH = searchPage([
  '/recipe/epi-syn-easy-tuna-melt',
  '/recipe/classic-tuna-melt',
  '/recipe/kimchi-tuna-melts',
  '/recipe/tuna-melt-2',
  '/recipe/tuna-melt',
  '/recipe/epi-syn-tuna-melt-374919',
]);

function tableFetcher(table: Record<string, string>, seen: string[] = []): UrlFetcher {
  return {
    async fetch(url: string): Promise<FetchedPage> {
      seen.push(url);
      const hit = Object.entries(table).find(([k]) => url.startsWith(k));
      if (!hit) throw new Error(`HTTP 404 fetching ${url}`);
      return { url, finalUrl: url, contentType: 'text/html', body: hit[1], fetchPath: 'direct' };
    },
  };
}

// ---------------------------------------------------------------------------

describe('publisher map', () => {
  it('maps Apple News author names to the publisher site', () => {
    expect(findPublisher('Epicurious')?.host).toBe('www.epicurious.com');
    expect(findPublisher('Bon Appétit')?.host).toBe('www.bonappetit.com');
    expect(findPublisher('Bon Appetit')?.host).toBe('www.bonappetit.com');
    expect(findPublisher('The Pioneer Woman')?.host).toBe('www.thepioneerwoman.com');
    expect(findPublisher('Food & Wine')?.host).toBe('www.foodandwine.com');
    expect(findPublisher('Food and Wine')?.host).toBe('www.foodandwine.com');
  });

  it('treats straight and curly apostrophes alike (the fixture decodes to a straight one)', () => {
    expect(findPublisher("America's Test Kitchen")?.host).toBe('www.americastestkitchen.com');
    expect(findPublisher('America’s Test Kitchen')?.host).toBe('www.americastestkitchen.com');
    expect(findPublisher("Cook's Illustrated")?.host).toBe('www.americastestkitchen.com');
  });

  it('marks the subscriber-only publishers as paywalled', () => {
    expect(findPublisher("America's Test Kitchen")?.paywalled).toBe(true);
    expect(findPublisher("Cook's Country")?.paywalled).toBe(true);
    expect(findPublisher('NYT Cooking')?.paywalled).toBe(true);
    expect(findPublisher('Epicurious')?.paywalled).toBeFalsy();
  });

  it('marks People Inc. sites as blocking automated access, with no search', () => {
    for (const n of ['Allrecipes', 'Serious Eats', 'Simply Recipes', 'EatingWell', 'Southern Living',
      'Martha Stewart', 'Real Simple', 'Better Homes & Gardens']) {
      const p = findPublisher(n);
      expect(p, n).not.toBeNull();
      expect(p!.search, n).toBeNull();
      expect(p!.unsearchable, n).toBe('blocks-automated-access');
    }
  });

  it('returns null for an unknown or missing publisher', () => {
    expect(findPublisher('Some Food Blog')).toBeNull();
    expect(findPublisher(null)).toBeNull();
  });

  it('every searchable entry searches its OWN host over https and has a recipe-path rule', () => {
    for (const p of PUBLISHERS.filter((x) => x.search)) {
      const u = new URL(p.search!('miso pork & eggs'));
      expect(u.protocol, p.name).toBe('https:');
      expect(u.hostname, p.name).toBe(p.host);
      expect(u.toString(), p.name).not.toContain(' ');
      expect(p.recipePath, p.name).toBeInstanceOf(RegExp);
    }
  });

  it('every unsearchable entry says why', () => {
    for (const p of PUBLISHERS.filter((x) => !x.search)) expect(p.unsearchable, p.name).toBeTruthy();
  });
});

describe('cleanAppleTitle', () => {
  it.each([
    ['Bon Appétit’s Ultimate Tuna Melt', 'Bon Appétit', 'Ultimate Tuna Melt'],
    ['The Pioneer Woman Shares Her Recipe for Sheet-Pan Spicy Peanut Chicken and Broccoli',
      'The Pioneer Woman', 'Sheet-Pan Spicy Peanut Chicken and Broccoli'],
    ['Try This Lemon Pundcake Recipe + Shop for Springy Baking Accessories', 'HGTV Magazine', 'Lemon Pundcake'],
    ['The Best Banana Pudding Recipe (with Video)', 'Allrecipes', 'The Best Banana Pudding'],
    ['Southern Thai Fried Chicken (Gai Tod Hat Yai)', 'Epicurious', 'Southern Thai Fried Chicken (Gai Tod Hat Yai)'],
    ['Miso Pork and Eggplant Stir-Fry', "America's Test Kitchen", 'Miso Pork and Eggplant Stir-Fry'],
  ])('%s', (raw, pub, want) => {
    expect(cleanAppleTitle(raw, pub)).toBe(want);
  });
});

describe('title matching', () => {
  it('thresholds are the documented ones', () => {
    expect(MIN_COVERAGE).toBe(0.85);
    expect(MIN_DICE).toBe(0.85);
  });

  it('accepts the real slugs the live search pages returned', () => {
    expect(titlesMatch('Southern Thai Fried Chicken (Gai Tod Hat Yai)', 'southern-thai-fried-chicken-gai-tod-hat-yai')).toBe(true);
    expect(titlesMatch('Miso Pork and Eggplant Stir-Fry', 'miso-pork-and-eggplant-stir-fry')).toBe(true);
    expect(titlesMatch('Sheet-Pan Spicy Peanut Chicken and Broccoli', 'sheet-pan-spicy-peanut-chicken-and-broccoli-recipe')).toBe(true);
    expect(titlesMatch('Miso Butter Cod', 'miso-butter-cod-recipe')).toBe(true);
  });

  it('ignores Condé Nast slug noise and trailing ids', () => {
    expect(titlesMatch('Black Forest Cupcakes', 'epi-syn-black-forest-cupcakes-389913')).toBe(true);
  });

  it('accepts the publisher’s own title even with typographic differences', () => {
    expect(titlesMatch('Thai Muslim-Style Grilled Chicken', 'Thai Muslim–Style Grilled Chicken')).toBe(true);
    expect(titlesMatch('Miso Mustard Pork Chops with Sesame Green Beans', 'Miso mustard pork chops with sesame green beans')).toBe(true);
  });

  describe('near misses are rejected', () => {
    it.each([
      // Real neighbours from the same search pages.
      ['Miso Pork and Eggplant Stir-Fry', 'miso-glazed-pork-with-squash-and-brussels-sprouts'],
      ['Miso Pork and Eggplant Stir-Fry', 'seared-eggplant-with-spicy-pork'],
      ['Southern Thai Fried Chicken (Gai Tod Hat Yai)', 'southern-fried-chicken-with-country-gravy'],
      ['Black Forest Layer Cake with Cherry Preserves', 'black-forest-cupcakes'],
      ['Black Forest Layer Cake with Cherry Preserves', 'deconstructed-black-forest-cake'],
      // Marketing adjectives count: "Ultimate" ≠ "Easy" ≠ "Classic".
      ['Ultimate Tuna Melt', 'epi-syn-easy-tuna-melt'],
      ['Ultimate Tuna Melt', 'tuna-melt'],
      // One extra word on a two-word title.
      ['Tuna Melt', 'tuna-melt-with-pickles'],
      // One missing word on a four-word title.
      ['Miso Pork Eggplant Stir-Fry', 'miso-pork-stir-fry'],
      // A single shared word never carries a match.
      ['Gai Yang', 'gai-tod'],
    ])('%s ≠ %s', (title, cand) => {
      expect(titlesMatch(title, cand)).toBe(false);
    });
  });

  it('scores the near miss well below threshold, not just under it', () => {
    const s = scoreTitles('Black Forest Layer Cake with Cherry Preserves', 'black-forest-cupcakes');
    expect(s.dice).toBeLessThan(0.6);
  });

  it('strips a "by Publisher" byline only for that publisher', () => {
    const tasty = findPublisher('Tasty')!;
    expect(stripByline('Miso Marinated Salmon Recipe by Tasty', tasty)).toBe('Miso Marinated Salmon Recipe');
    expect(stripByline('Stand By Me Cake', tasty)).toBe('Stand By Me Cake');
  });
});

describe('extractCandidates', () => {
  const epi = findPublisher('Epicurious')!;
  const searchUrl = epi.search!('Southern Thai Fried Chicken (Gai Tod Hat Yai)');

  it('returns only the matching recipe on the publisher host', () => {
    const c = extractCandidates(EPI_SEARCH, searchUrl, epi, 'Southern Thai Fried Chicken (Gai Tod Hat Yai)');
    expect(c.map((x) => x.url)).toEqual([
      'https://www.epicurious.com/recipes/food/views/southern-thai-fried-chicken-gai-tod-hat-yai',
    ]);
  });

  it('drops links to other hosts even when the slug is perfect', () => {
    const c = extractCandidates(EPI_SEARCH, searchUrl, epi, 'Southern Thai Fried Chicken (Gai Tod Hat Yai)');
    expect(c.some((x) => x.url.includes('evil.example.com'))).toBe(false);
  });

  it('drops non-recipe paths (galleries, categories)', () => {
    const c = extractCandidates(EPI_SEARCH, searchUrl, epi, 'Fried Chicken Recipes Gallery');
    expect(c).toEqual([]);
  });

  it('resolves protocol-relative hrefs', () => {
    const html = searchPage(['//www.epicurious.com/recipes/food/views/gai-yang']);
    expect(extractCandidates(html, searchUrl, epi, 'Gai Yang').map((x) => x.url))
      .toEqual(['https://www.epicurious.com/recipes/food/views/gai-yang']);
  });

  it('flags ties as ambiguous (tuna-melt vs tuna-melt-2)', () => {
    const ba = findPublisher('Bon Appétit')!;
    const c = extractCandidates(BA_TUNA_SEARCH, ba.search!('Tuna Melt'), ba, 'Tuna Melt');
    expect(c.length).toBeGreaterThan(1);
    expect(isAmbiguous(c)).toBe(true);
  });
});

describe('resolveAppleNews', () => {
  const EPI_URL = 'https://www.epicurious.com/recipes/food/views/southern-thai-fried-chicken-gai-tod-hat-yai';

  it('finds the Epicurious recipe through Epicurious search', async () => {
    const seen: string[] = [];
    const r = await resolveAppleNews(
      { title: 'Southern Thai Fried Chicken (Gai Tod Hat Yai)', publisher: 'Epicurious' },
      tableFetcher({
        'https://www.epicurious.com/search': EPI_SEARCH,
        [EPI_URL]: recipePage('Southern Thai Fried Chicken (Gai Tod Hat Yai)'),
      }, seen),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.page.finalUrl).toBe(EPI_URL);
    // Only the publisher's own host was contacted.
    expect(seen.every((u) => new URL(u).hostname === 'www.epicurious.com')).toBe(true);
    expect(seen[0]).toMatch(/^https:\/\/www\.epicurious\.com\/search\?q=Southern\+Thai/);
  });

  it('resolves the paywalled ATK recipe from its public ingredient list', async () => {
    const r = await resolveAppleNews(
      { title: 'Miso Pork and Eggplant Stir-Fry', publisher: "America's Test Kitchen" },
      tableFetcher({
        'https://www.americastestkitchen.com/search': ATK_SEARCH,
        'https://www.americastestkitchen.com/recipes/17701-miso-pork-and-eggplant-stir-fry':
          recipePage('Miso Pork and Eggplant Stir-Fry', ['¼ cup white miso', '1 pound ground pork']),
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a slug match whose page title is a different recipe', async () => {
    const r = await resolveAppleNews(
      { title: 'Southern Thai Fried Chicken (Gai Tod Hat Yai)', publisher: 'Epicurious' },
      tableFetcher({
        'https://www.epicurious.com/search': EPI_SEARCH,
        [EPI_URL]: recipePage('Korean Fried Chicken Wings'),
      }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'no-confident-match', tried: 1 });
  });

  it('rejects a page with no ingredients', async () => {
    const r = await resolveAppleNews(
      { title: 'Southern Thai Fried Chicken (Gai Tod Hat Yai)', publisher: 'Epicurious' },
      tableFetcher({
        'https://www.epicurious.com/search': EPI_SEARCH,
        [EPI_URL]: recipePage('Southern Thai Fried Chicken (Gai Tod Hat Yai)', []),
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('refuses an ambiguous title instead of guessing', async () => {
    const r = await resolveAppleNews(
      { title: 'Tuna Melt', publisher: 'Bon Appétit' },
      tableFetcher({ 'https://www.bonappetit.com/search': BA_TUNA_SEARCH }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'ambiguous', tried: 0 });
  });

  it('reports unknown and unsearchable publishers without fetching anything', async () => {
    const seen: string[] = [];
    const f = tableFetcher({}, seen);
    expect(await resolveAppleNews({ title: 'X Y', publisher: 'A Food Blog' }, f))
      .toMatchObject({ ok: false, reason: 'unknown-publisher' });
    expect(await resolveAppleNews({ title: 'Vanilla Milkshake', publisher: 'Allrecipes' }, f))
      .toMatchObject({ ok: false, reason: 'blocks-automated-access' });
    expect(await resolveAppleNews({ title: 'Lemon Cake', publisher: 'HGTV Magazine' }, f))
      .toMatchObject({ ok: false, reason: 'search-unreadable' });
    expect(await resolveAppleNews({ title: null, publisher: 'Epicurious' }, f))
      .toMatchObject({ ok: false, reason: 'no-title' });
    expect(seen).toEqual([]);
  });

  it('reports a failed search fetch', async () => {
    const r = await resolveAppleNews({ title: 'Gai Yang', publisher: 'Epicurious' }, tableFetcher({}));
    expect(r).toMatchObject({ ok: false, reason: 'search-failed' });
  });

  it('gives up at the budget', async () => {
    const slow: UrlFetcher = { fetch: () => new Promise(() => {}) };
    const t0 = Date.now();
    const r = await resolveAppleNews({ title: 'Gai Yang', publisher: 'Epicurious' }, slow, 50);
    expect(r).toMatchObject({ ok: false, reason: 'timeout' });
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

describe('webSearchQuery', () => {
  it('is the cleaned title plus the publisher', () => {
    expect(webSearchQuery('Bon Appétit’s Ultimate Tuna Melt', 'Bon Appétit')).toBe('Ultimate Tuna Melt Bon Appétit');
    expect(webSearchQuery(null, null)).toBe('recipe');
  });
});

describe('handleScrape: apple.news end to end (offline)', () => {
  const EPI_APPLE = 'https://apple.news/KZrKwE9isOtqUF7Y9dIy3GQ';
  const EPI_URL = 'https://www.epicurious.com/recipes/food/views/southern-thai-fried-chicken-gai-tod-hat-yai';

  it('returns a normal success marked resolvedFrom apple.news', async () => {
    const r = await handleScrape(EPI_APPLE, {
      fetcher: tableFetcher({
        'https://apple.news/': EPI_INTERSTITIAL,
        'https://www.epicurious.com/search': EPI_SEARCH,
        [EPI_URL]: recipePage('Southern Thai Fried Chicken (Gai Tod Hat Yai)', ['2 lb chicken', '1 cup rice flour']),
      }),
    });
    expect(r).toMatchObject({
      status: 'ok',
      title: 'Southern Thai Fried Chicken (Gai Tod Hat Yai)',
      resolvedFrom: 'apple.news',
      publisherUrl: EPI_URL,
      publisherHost: 'epicurious.com',
      finalUrl: EPI_URL,
    });
    expect(r.ingredients).toHaveLength(2);
  });

  it('falls back with title, publisher, paywall flag and search query', async () => {
    const r = await handleScrape('https://apple.news/KcFmm7QLuNEyYYYM2Bm9Z_w', {
      fetcher: tableFetcher({
        'https://apple.news/': ATK_INTERSTITIAL,
        'https://www.americastestkitchen.com/search': searchPage([]),
      }),
    });
    expect(r.status).toBe('error');
    expect(r.appleNews).toEqual({
      title: 'Miso Pork and Eggplant Stir-Fry',
      publisher: "America's Test Kitchen",
      paywalled: true,
      searchQuery: "Miso Pork and Eggplant Stir-Fry America's Test Kitchen",
      reason: 'no-confident-match',
    });
    expect(r.errorMessage).toMatch(/subscriber-only/);
  });

  it('marks a canonical-link resolution as resolvedFrom apple.news too', async () => {
    const r = await handleScrape('https://apple.news/ASkjKJFG7Q_a5sG4qvoGQZg', {
      fetcher: tableFetcher({
        'https://apple.news/': '<meta property="og:title" content="Earl Grey Yogurt Cake — Bon Appétit"><link rel="canonical" href="https://www.bonappetit.com/recipe/earl-grey-yogurt-cake">',
        'https://www.bonappetit.com/recipe/earl-grey-yogurt-cake': recipePage('Earl Grey Yogurt Cake'),
      }),
    });
    expect(r).toMatchObject({ status: 'ok', resolvedFrom: 'apple.news', publisherHost: 'bonappetit.com' });
  });

  it('keeps the publisher link in the fallback when that page refuses us', async () => {
    const page = 'https://www.allrecipes.com/recipe/48974/vanilla-milkshake-i/';
    const r = await handleScrape('https://apple.news/A1l3zy9oDQputN5YxMcCF3A', {
      fetcher: tableFetcher({
        'https://apple.news/': `<meta name="Author" content="Allrecipes"><meta property="og:title" content="Vanilla Milkshake — Allrecipes"><link rel="canonical" href="${page}">`,
      }),
    });
    expect(r.status).toBe('error');
    expect(r.appleNews).toMatchObject({
      title: 'Vanilla Milkshake', publisher: 'Allrecipes', paywalled: false,
      reason: 'publisher-page-failed', publisherUrl: page,
    });
  });
});
