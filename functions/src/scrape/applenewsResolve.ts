// WEBLINK-17 (2026-11-07). Resolve an apple.news link to the publisher's own
// recipe page.
//
// apple.news never links the publisher (see applenews.ts). What it DOES give
// us is the recipe title and the publisher name. This module turns that pair
// into the publisher's real page:
//
//   1. map the publisher name to its site (PUBLISHERS below — hard-coded, so
//      the host we contact is never derived from page content);
//   2. fetch THAT SITE'S OWN search page for the title (no general web search
//      engine — their terms forbid scraping results pages);
//   3. keep only links on the publisher's host whose path looks like a recipe,
//      and whose slug matches the title closely (titleMatch below);
//   4. fetch the best candidates, parse them with the normal parser, and accept
//      one only if the PARSED recipe title also matches the Apple News title.
//
// The double check (slug, then parsed title) is what keeps this from importing
// "Black Forest Cupcakes" when the user shared "Black Forest Layer Cake".
//
// Measured 2026-11-07 against live sites (see the WEBLINK-17 bead in plan.md
// for the per-link table). Sites whose search is client-rendered or behind a
// bot wall are listed with `search: null` and a reason, so the user gets an
// honest explanation instead of a slow failure.

import { parseRecipeFromHtml } from './parser';
import type { FetchedPage, ParsedRecipe, UrlFetcher } from './types';

/** Why a publisher can't be searched. Shown in logs; drives fallback copy. */
export type UnsearchableReason =
  /** Origin answers 402 to automated requests and the reader proxy is
   *  barred by the owner (People Inc. / Dotdash Meredith properties). */
  | 'blocks-automated-access'
  /** Search results are rendered client-side or behind a JS challenge, so
   *  the HTML we can fetch has no result links. */
  | 'search-unreadable';

export interface Publisher {
  /** Display name, as Apple News spells it. */
  name: string;
  /** Other spellings Apple (or the publisher) uses for the same site. */
  aliases?: string[];
  host: string;
  /** Subscriber-only on the web (the user can't read the method without an account). */
  paywalled?: boolean;
  /** Build the publisher's own search URL, or null when it can't be searched. */
  search: ((query: string) => string) | null;
  /** Pathname shape of a single recipe page on this site. */
  recipePath?: RegExp;
  unsearchable?: UnsearchableReason;
}

const q = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');

const peopleInc = (name: string, host: string, aliases?: string[]): Publisher => ({
  name, host, aliases, search: null, unsearchable: 'blocks-automated-access',
});

/**
 * The publisher table. Every `search` entry was checked against the live
 * site on 2026-11-07: the URL returns result links in server-rendered HTML
 * (directly, or through the reader proxy where the origin bot-blocks), and
 * `recipePath` matches the recipe links and not the category/collection ones.
 */
export const PUBLISHERS: Publisher[] = [
  // Condé Nast — server-rendered search, direct fetch works.
  {
    name: 'Epicurious', host: 'www.epicurious.com',
    search: (s) => `https://www.epicurious.com/search?q=${q(s)}`,
    recipePath: /^\/recipes\/food\/views\/[a-z0-9-]+\/?$/,
  },
  {
    name: 'Bon Appétit', aliases: ['Bon Appetit'], host: 'www.bonappetit.com',
    search: (s) => `https://www.bonappetit.com/search?q=${q(s)}`,
    recipePath: /^\/recipe\/[a-z0-9-]+\/?$/,
  },
  // Hearst — server-rendered search.
  {
    name: 'Delish', host: 'www.delish.com',
    search: (s) => `https://www.delish.com/search/?q=${q(s)}`,
    recipePath: /^\/cooking\/recipe-ideas\/a\d+\/[a-z0-9-]+\/?$/,
  },
  {
    name: 'The Pioneer Woman', aliases: ['Pioneer Woman'], host: 'www.thepioneerwoman.com',
    search: (s) => `https://www.thepioneerwoman.com/search/?q=${q(s)}`,
    recipePath: /^\/food-cooking\/recipes\/a\d+\/[a-z0-9-]+\/?$/,
  },
  // BuzzFeed — origin 406s a datacenter fetch; the reader proxy serves it.
  {
    name: 'Tasty', host: 'tasty.co',
    search: (s) => `https://tasty.co/search?q=${q(s)}`,
    recipePath: /^\/recipe\/[a-z0-9-]+\/?$/,
  },
  {
    name: 'BBC Good Food', aliases: ['Good Food'], host: 'www.bbcgoodfood.com',
    search: (s) => `https://www.bbcgoodfood.com/search?q=${q(s)}`,
    recipePath: /^\/recipes\/[a-z0-9-]+\/?$/,
  },
  // Subscriber-only on the web. Their recipe pages still publish the
  // ingredient list in public schema.org JSON-LD (it's what search engines
  // index), so the import works even though the method is paywalled.
  {
    name: "America's Test Kitchen", aliases: ["Cook's Illustrated", "Cook's Country", 'ATK'],
    host: 'www.americastestkitchen.com', paywalled: true,
    search: (s) => `https://www.americastestkitchen.com/search?q=${q(s)}`,
    recipePath: /^\/(?:cooksillustrated\/|cookscountry\/)?recipes\/\d+-[a-z0-9-]+\/?$/,
  },
  {
    name: 'NYT Cooking', aliases: ['New York Times Cooking', 'The New York Times', 'New York Times'],
    host: 'cooking.nytimes.com', paywalled: true,
    search: (s) => `https://cooking.nytimes.com/search?q=${q(s)}`,
    recipePath: /^\/recipes\/\d+-[a-z0-9-]+\/?$/,
  },
  // Search exists but can't be read from a server.
  { name: 'Food Network', aliases: ['Food Network Magazine', 'HGTV Magazine'], host: 'www.foodnetwork.com', search: null, unsearchable: 'search-unreadable' },
  { name: 'Food52', host: 'food52.com', search: null, unsearchable: 'search-unreadable' },
  { name: 'The Kitchn', aliases: ['Kitchn'], host: 'www.thekitchn.com', search: null, unsearchable: 'search-unreadable' },
  { name: 'Taste of Home', host: 'www.tasteofhome.com', search: null, unsearchable: 'search-unreadable' },
  // 403 direct; through the reader proxy the search page has no result links.
  { name: 'Saveur', host: 'www.saveur.com', search: null, unsearchable: 'search-unreadable' },
  // People Inc. (Dotdash Meredith): 402 to any automated fetch, and the
  // reader proxy answers 451 "excluded at the request of its owner".
  peopleInc('Allrecipes', 'www.allrecipes.com'),
  peopleInc('Serious Eats', 'www.seriouseats.com'),
  peopleInc('Simply Recipes', 'www.simplyrecipes.com'),
  peopleInc('Food & Wine', 'www.foodandwine.com', ['Food and Wine']),
  peopleInc('EatingWell', 'www.eatingwell.com', ['Eating Well']),
  peopleInc('Southern Living', 'www.southernliving.com'),
  peopleInc('Martha Stewart', 'www.marthastewart.com', ['Martha Stewart Living']),
  peopleInc('Real Simple', 'www.realsimple.com'),
  peopleInc('Better Homes & Gardens', 'www.bhg.com', ['Better Homes and Gardens', 'BHG']),
];

function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findPublisher(name: string | null): Publisher | null {
  if (!name) return null;
  const key = fold(name);
  return (
    PUBLISHERS.find((p) => [p.name, ...(p.aliases ?? [])].some((n) => fold(n) === key)) ?? null
  );
}

// ---------------------------------------------------------------------------
// Title matching
// ---------------------------------------------------------------------------

/**
 * Words that carry no identity: articles, connectives, "recipe".
 *
 * Marketing adjectives ("Best", "Ultimate", "Easy", "Classic") are
 * deliberately NOT here. Measured on Bon Appétit: "Bon Appétit’s Ultimate
 * Tuna Melt" shares {tuna, melt} with five different pages ("easy-tuna-melt",
 * "classic-tuna-melt", "tuna-melt", "tuna-melt-2", ...). With those adjectives
 * stripped, the resolver confidently imported "Easy Tuna Melt" — a different
 * recipe. Keeping them means a headline adjective must be on the page too, or
 * the match is refused and the user gets the helpful fallback.
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'of', 'for', 'in', 'on', 'to', 'from', 'by',
  'recipe', 'recipes', 'video',
  // Slug noise: Condé Nast's syndicated-recipe prefix ("epi-syn-...").
  'epi', 'syn',
]);

function singular(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

export function titleTokens(s: string): string[] {
  const out = new Set<string>();
  for (const raw of fold(s).split(' ')) {
    if (!raw || /^\d+$/.test(raw) || STOPWORDS.has(raw)) continue;
    // Hearst slugs carry an article id ("a32629376") as a path segment;
    // drop anything shaped like one if it ever leaks into a slug.
    if (/^a\d{4,}$/.test(raw)) continue;
    out.add(singular(raw));
  }
  return [...out];
}

/**
 * Strip headline packaging so the title reads like the recipe's own name.
 *   "Bon Appétit’s Ultimate Tuna Melt"            → "Ultimate Tuna Melt"
 *   "The Pioneer Woman Shares Her Recipe for X"   → "X"
 *   "Try This Lemon Poundcake Recipe + Shop for…" → "Lemon Poundcake"
 *   "The Best Banana Pudding Recipe (with Video)" → "The Best Banana Pudding"
 */
export function cleanAppleTitle(title: string, publisher: string | null): string {
  let t = title.trim();
  t = t.split(/\s\+\s/)[0];
  t = t.replace(/^.*?\b(?:shares?|reveals?|gives?)\b.*?\brecipes?\s+for\s+/i, '');
  if (publisher) {
    const esc = publisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`^${esc}[’']s\\s+`, 'i'), '');
  }
  t = t.replace(/^(?:try|make)\s+(?:this|these)\s+/i, '');
  t = t.replace(/\s*\((?:[^)]*\bvideo\b[^)]*)\)\s*/gi, ' ');
  t = t.replace(/\s+recipes?\s*$/i, '');
  return t.replace(/\s+/g, ' ').trim();
}

/** Tasty names its JSON-LD recipes "Miso Marinated Salmon Recipe by Tasty". */
export function stripByline(title: string, publisher: Publisher): string {
  const names = [publisher.name, ...(publisher.aliases ?? [])].map(fold);
  const m = title.match(/^(.*?)\s+by\s+(.+)$/i);
  return m && names.includes(fold(m[2])) ? m[1] : title;
}

export interface TitleScore {
  /** Shared identity tokens. */
  shared: number;
  /** Fraction of the Apple title's tokens present in the candidate. */
  coverage: number;
  /** Dice coefficient 2|A∩B| / (|A|+|B|): penalises extra candidate words. */
  dice: number;
}

export function scoreTitles(appleTitle: string, candidate: string): TitleScore {
  const a = titleTokens(appleTitle);
  const b = new Set(titleTokens(candidate));
  const shared = a.filter((t) => b.has(t)).length;
  if (a.length === 0 || b.size === 0) return { shared: 0, coverage: 0, dice: 0 };
  return { shared, coverage: shared / a.length, dice: (2 * shared) / (a.length + b.size) };
}

/**
 * Acceptance thresholds. Both must hold:
 *
 *   coverage ≥ 0.85 — titles of up to six identity words must match in full;
 *     only a long title (7+ words, like "Southern Thai Fried Chicken (Gai Tod
 *     Hat Yai)") may lose one. "Miso Pork Eggplant Stir-Fry" (5 words, 0.80
 *     without "eggplant") must not land on "Miso Pork Stir-Fry".
 *
 *   dice ≥ 0.85 — the candidate may add very little. For a 2-word title one
 *     extra word gives 0.80 and is rejected ("Tuna Melt" ≠ "Tuna Melt with
 *     Pickles"); for a 3-word title one extra word gives 0.857 and passes;
 *     an exact slug scores 1.0. Near misses seen on real search pages —
 *     "black-forest-cupcakes", "southern-fried-chicken-with-country-gravy",
 *     "miso-pork-ribs-with-chile-honey-glaze" — all score ≤ 0.6.
 *
 * At least two shared words are required unless the title has only one, so a
 * one-word overlap can never carry a match.
 */
export const MIN_COVERAGE = 0.85;
export const MIN_DICE = 0.85;

export function titlesMatch(appleTitle: string, candidate: string): boolean {
  const s = scoreTitles(appleTitle, candidate);
  const need = Math.min(2, titleTokens(appleTitle).length);
  return s.shared >= need && s.coverage >= MIN_COVERAGE && s.dice >= MIN_DICE;
}

// ---------------------------------------------------------------------------
// Candidate extraction from a search page
// ---------------------------------------------------------------------------

export interface Candidate {
  url: string;
  score: TitleScore;
}

/**
 * Pull recipe links for `publisher` out of its search-results HTML and keep
 * those whose slug matches `title`, best first. Links on any other host are
 * dropped — a search page can link anywhere, and only the publisher's own
 * host is one we chose to contact.
 */
export function extractCandidates(
  html: string,
  searchUrl: string,
  publisher: Publisher,
  title: string,
): Candidate[] {
  if (!publisher.recipePath) return [];
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const hrefs = [
    ...html.matchAll(/href=["']([^"'#?\s]+)/gi),
    // The reader proxy sometimes returns markdown-ish text; catch bare URLs too.
    ...html.matchAll(/(https?:\/\/[^\s"'<>()?#]+)/gi),
  ].map((m) => m[1]);
  for (const href of hrefs) {
    let u: URL;
    try {
      u = new URL(href, searchUrl);
    } catch {
      continue;
    }
    if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== publisher.host) continue;
    if (!publisher.recipePath.test(u.pathname)) continue;
    const key = u.pathname.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const slug = key.split('/').pop() ?? '';
    const score = scoreTitles(title, slug.replace(/^\d+-/, ''));
    if (titlesMatch(title, slug.replace(/^\d+-/, ''))) {
      out.push({ url: `https://${publisher.host}${u.pathname}`, score });
    }
  }
  return out.sort((x, y) => y.score.dice - x.score.dice || y.score.coverage - x.score.coverage);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Total wall-clock the resolver may spend. The callable times out at 30s and
 *  the client gives up at 25s; the apple.news fetch itself usually takes
 *  <1s, so 12s of resolution keeps the whole call well under both. */
export const RESOLVE_BUDGET_MS = 12_000;
/** Try at most this many slug-matched candidates. */
export const MAX_CANDIDATES = 3;

export type ResolveFailure =
  | 'no-title'
  | 'unknown-publisher'
  | UnsearchableReason
  | 'search-failed'
  | 'no-confident-match'
  | 'ambiguous'
  | 'timeout';

export type ResolveResult =
  | { ok: true; recipe: ParsedRecipe; page: FetchedPage; publisher: Publisher; tried: number }
  | { ok: false; reason: ResolveFailure; publisher: Publisher | null; tried: number };

class BudgetExceeded extends Error {}

/**
 * Two different pages scoring identically against the title means the title
 * doesn't pick out one recipe ("tuna-melt" and "tuna-melt-2"). Guessing would
 * import the wrong one half the time, so refuse.
 */
export function isAmbiguous(cands: Candidate[]): boolean {
  return (
    cands.length > 1 &&
    cands[0].score.dice === cands[1].score.dice &&
    cands[0].score.coverage === cands[1].score.coverage
  );
}

export async function resolveAppleNews(
  info: { title: string | null; publisher: string | null },
  fetcher: UrlFetcher,
  budgetMs: number = RESOLVE_BUDGET_MS,
): Promise<ResolveResult> {
  const publisher = findPublisher(info.publisher);
  if (!info.title) return { ok: false, reason: 'no-title', publisher, tried: 0 };
  if (!publisher) return { ok: false, reason: 'unknown-publisher', publisher: null, tried: 0 };
  if (!publisher.search) {
    return { ok: false, reason: publisher.unsearchable ?? 'search-unreadable', publisher, tried: 0 };
  }

  const deadline = Date.now() + budgetMs;
  const timed = async (url: string): Promise<FetchedPage> => {
    const left = deadline - Date.now();
    if (left <= 0) throw new BudgetExceeded();
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fetcher.fetch(url),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new BudgetExceeded()), left);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const title = cleanAppleTitle(info.title, info.publisher);
  const searchUrl = publisher.search(title);
  let searchPage: FetchedPage;
  try {
    searchPage = await timed(searchUrl);
  } catch (err) {
    return { ok: false, reason: err instanceof BudgetExceeded ? 'timeout' : 'search-failed', publisher, tried: 0 };
  }

  const all = extractCandidates(searchPage.body, searchUrl, publisher, title);
  if (isAmbiguous(all)) return { ok: false, reason: 'ambiguous', publisher, tried: 0 };
  const candidates = all.slice(0, MAX_CANDIDATES);
  let tried = 0;
  for (const c of candidates) {
    tried += 1;
    let page: FetchedPage;
    try {
      page = await timed(c.url);
    } catch (err) {
      if (err instanceof BudgetExceeded) return { ok: false, reason: 'timeout', publisher, tried };
      continue;
    }
    let recipe: ParsedRecipe | null = null;
    try {
      recipe = parseRecipeFromHtml(page.body);
    } catch {
      recipe = null;
    }
    // Second gate: the page's OWN recipe name must match, not just its slug.
    if (
      recipe && recipe.ingredients.length > 0 &&
      titlesMatch(title, stripByline(recipe.title, publisher))
    ) {
      return { ok: true, recipe, page, publisher, tried };
    }
  }
  return { ok: false, reason: 'no-confident-match', publisher, tried };
}

/** Query for the user's own "Find it on the web" button. */
export function webSearchQuery(title: string | null, publisher: string | null): string {
  const t = title ? cleanAppleTitle(title, publisher) : '';
  return [t, publisher ?? ''].filter(Boolean).join(' ').trim() || 'recipe';
}
