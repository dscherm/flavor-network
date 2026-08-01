// MAKE-WEBLINK-FN (2026-05-30). URL-fetch + JSON-LD parse pipeline.
// Lifted from bookstrapCB (D:/Projects/bookstrapCB/functions/src/scrape/handler.ts)
// and slimmed: no Firestore write, no LLM fallback, no family/uid model.
// Returns parsed recipe directly to the callable client.

import { parseRecipeFromHtml } from './parser';
import {
  appleNewsErrorMessage,
  isAppleNewsUrl,
  parseAppleNewsInterstitial,
} from './applenews';
import {
  ssrfReason,
  REDIRECT_MAX,
  assertHostnameResolvesPublicly,
} from './ssrf';
import type { FetchedPage, ParsedRecipe, ScrapeResult, UrlFetcher } from './types';

// WEBLINK-1 (2026-07-31): 5s was too tight — a redirect chain on a slow
// origin regularly blew the budget before the page arrived, and it leaves
// no room for a second fetch attempt. 15s still sits well inside the 30s
// callable timeout and the client's 25s race.
export const DEFAULT_BUDGET_MS = 15_000;

/**
 * WEBLINK-1 (2026-07-31): outbound request headers.
 *
 * The previous `flavor-network-scrape/0.1 (+github…)` user-agent advertised
 * a bot and got us blocked. Measured against live recipe sites: with the bot
 * UA foodnetwork.com returns 403; with this header set it returns 200.
 *
 * Sites that block by datacenter IP rather than by UA (the Dotdash Meredith
 * properties — allrecipes / seriouseats / simplyrecipes — answer 402 to any
 * header set) are out of scope here; they need the proxy hop in WEBLINK-2.
 */
export const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'upgrade-insecure-requests': '1',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
};

class ScrapeTimeoutError extends Error {
  readonly kind = 'scrape-timeout';
  constructor(stage: string, ms: number) {
    super(`Scrape pipeline exceeded ${ms}ms during ${stage}.`);
  }
}

async function withBudget<T>(p: Promise<T>, ms: number, stage: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<T>([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ScrapeTimeoutError(stage, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * WEBLINK-2 (2026-07-31): reader proxy used when an origin bot-blocks us.
 *
 * Hard-coded on purpose. This value is NEVER derived from user input — the
 * user-supplied URL is only ever appended as a path suffix, after it has
 * already cleared the full SSRF gauntlet (ssrfReason + DNS resolution check)
 * on the direct attempt. There is no code path that lets a caller choose a
 * different proxy host.
 */
export const READER_PROXY_BASE = 'https://r.jina.ai/';

/**
 * Statuses that mean "the origin refused a robot", as opposed to "this page
 * genuinely isn't there". Measured on live recipe sites: Dotdash Meredith
 * properties (allrecipes / seriouseats / simplyrecipes) answer 402 to any
 * datacenter IP no matter what headers we send; others use 403 or 429.
 *
 * 404 and 410 are deliberately absent — a missing page must fail fast and
 * honestly rather than burning a proxy round-trip to rediscover it's missing.
 */
const BOT_BLOCK_STATUSES = new Set([401, 402, 403, 406, 429, 451]);

function isBotBlockStatus(status: number): boolean {
  return BOT_BLOCK_STATUSES.has(status) || status >= 500;
}

/** Carries the origin's HTTP status so the proxy decision can be made upstream. */
class OriginStatusError extends Error {
  constructor(readonly status: number, readonly requestedUrl: string) {
    super(`HTTP ${status} fetching ${requestedUrl}`);
  }
}

/**
 * Direct fetch — handles redirect chains with re-validation at every hop.
 * The default redirect: 'follow' would let a public URL chain into
 * http://169.254.169.254/ (or any RFC1918 host) — the SSRF guard at the
 * entry point only covers the initial URL.
 *
 * Resolves to the fetched page, or throws OriginStatusError carrying the
 * refusing status so the caller can decide whether a proxy retry is warranted.
 */
async function fetchDirect(url: string): Promise<FetchedPage> {
  let current = url;
  for (let hop = 0; hop <= REDIRECT_MAX; hop++) {
    const reason = ssrfReason(current);
    if (reason) throw new Error(reason);
    // DNS-level SSRF check: reject hostnames that resolve to internal IPs.
    // We intentionally do NOT pin the resolved IP into the fetch dispatcher
    // — undici 6's connect.lookup callback signature is incompatible with
    // node's classic (err, addr, family) form, and the remaining attack
    // surface (DNS rebinding within ms between our lookup and undici's
    // connect-time lookup, against an auth-gated endpoint) is too narrow
    // to justify the complexity. The synchronous SSRF guard + this DNS
    // check + redirect-by-redirect re-validation cover the main threats.
    await assertHostnameResolvesPublicly(current);

    const res = await fetch(current, {
      headers: { ...BROWSER_HEADERS },
      redirect: 'manual',
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error(`HTTP ${res.status} with no Location header for ${current}`);
      current = new URL(loc, current).toString();
      continue;
    }

    if (!res.ok) throw new OriginStatusError(res.status, current);
    const body = await res.text();
    return {
      url,
      finalUrl: current,
      contentType: res.headers.get('content-type') ?? 'text/html',
      body,
      fetchPath: 'direct',
    };
  }
  throw new Error(`Too many redirects (>${REDIRECT_MAX}) from ${url}`);
}

/**
 * Reader-proxy fetch. r.jina.ai with `x-return-format: html` returns the
 * origin's real HTML — JSON-LD block included — rather than its markdown
 * rendering, which is what the parser needs.
 */
async function fetchViaReaderProxy(url: string): Promise<FetchedPage> {
  const res = await fetch(`${READER_PROXY_BASE}${url}`, {
    headers: { 'x-return-format': 'html', accept: '*/*' },
    redirect: 'follow',
  });
  if (!res.ok) throw new OriginStatusError(res.status, url);
  return {
    url,
    finalUrl: url,
    contentType: res.headers.get('content-type') ?? 'text/html',
    body: await res.text(),
    fetchPath: 'proxy',
  };
}

/**
 * Default fetcher: try the origin directly, then fall back through the
 * reader proxy exactly once if — and only if — the origin bot-blocked us.
 */
export const defaultFetcher: UrlFetcher = {
  async fetch(url: string): Promise<FetchedPage> {
    try {
      return await fetchDirect(url);
    } catch (err) {
      if (!(err instanceof OriginStatusError) || !isBotBlockStatus(err.status)) {
        throw err;
      }
      try {
        return await fetchViaReaderProxy(err.requestedUrl);
      } catch {
        // Report the ORIGIN's refusal, not the proxy's — the origin status is
        // the actionable fact ("that site blocked the import"), and leaking a
        // proxy-shaped error would send debugging in the wrong direction.
        throw new Error(
          `HTTP ${err.status} fetching ${err.requestedUrl} (site blocked the import; reader proxy also failed)`,
        );
      }
    }
  },
};

export interface HandleScrapeDeps {
  fetcher: UrlFetcher;
  budgetMs?: number;
}

/**
 * One structured line per scrape, so proxy reliance is queryable rather than
 * inferred. Three of the six recipe sites we verified only import because
 * r.jina.ai is up and free — that is a real fragility, and the thing you want
 * before it bites is the trend, not the incident. Count `path=proxy` against
 * `path=direct` per host over time:
 *
 *   firebase functions:log --only scrapeRecipe | grep '\[scrape\] outcome'
 *
 * Host (not full URL) is deliberate: it's the grouping key for "which sites
 * need the proxy", and it keeps user-supplied paths out of the log.
 */
function logOutcome(fields: {
  host: string;
  ok: boolean;
  fetchPath?: string;
  parseStrategy?: string;
  ingredients?: number;
  ms: number;
  error?: string;
}): void {
  console.info('[scrape] outcome', JSON.stringify(fields));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid-url';
  }
}

export async function handleScrape(url: string, deps: HandleScrapeDeps): Promise<ScrapeResult> {
  const startedAt = Date.now();
  if (!url || typeof url !== 'string') {
    return { status: 'error', errorMessage: 'url is required' };
  }
  const reason = ssrfReason(url);
  if (reason) return { status: 'error', errorMessage: reason };

  const budget = deps.budgetMs ?? DEFAULT_BUDGET_MS;
  let page: FetchedPage;
  try {
    page = await withBudget(deps.fetcher.fetch(url), budget, 'url-fetch');
  } catch (err) {
    // undici's global fetch throws TypeError: "fetch failed" with the real
    // reason on err.cause. Surface both so the client + logs show what
    // actually broke (DNS, TLS, ECONNREFUSED, etc.).
    const baseMsg = err instanceof Error ? err.message : 'fetch failed';
    const cause = err instanceof Error && 'cause' in err ? (err as Error & { cause?: unknown }).cause : undefined;
    const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : '';
    const fullMsg = causeMsg ? `${baseMsg}: ${causeMsg}` : baseMsg;
    console.error('[scrape] url-fetch failed', { url, message: baseMsg, cause: causeMsg, raw: cause });
    logOutcome({ host: hostOf(url), ok: false, ms: Date.now() - startedAt, error: 'fetch-failed' });
    return { status: 'error', errorMessage: fullMsg };
  }

  // WEBLINK-8: apple.news serves an "open in the News app" interstitial, not
  // the article. If it names a publisher URL, follow that and scrape it
  // normally — re-entering handleScrape so the followed URL runs the full
  // SSRF gauntlet, since it is user-influenced content. Otherwise report what
  // the interstitial DOES tell us instead of the generic no-markup error.
  if (isAppleNewsUrl(url)) {
    const info = parseAppleNewsInterstitial(page.body);
    if (info.publisherUrl) {
      console.info('[scrape] apple.news resolved to publisher', {
        url, publisherUrl: info.publisherUrl,
      });
      return handleScrape(info.publisherUrl, deps);
    }
    logOutcome({
      host: hostOf(url), ok: false, fetchPath: page.fetchPath,
      ms: Date.now() - startedAt, error: 'apple-news-unresolvable',
    });
    return {
      status: 'error',
      errorMessage: appleNewsErrorMessage(info),
      finalUrl: page.finalUrl,
      fetchPath: page.fetchPath,
      appleNews: { title: info.title, publisher: info.publisher },
    };
  }

  // WEBLINK-3: JSON-LD, then microdata, then class/id heuristics. JSON-LD
  // still wins whenever the page publishes it.
  let bestRecipe: ParsedRecipe | null = null;
  try {
    bestRecipe = parseRecipeFromHtml(page.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Recipe parse failed';
    logOutcome({
      host: hostOf(url), ok: false, fetchPath: page.fetchPath,
      ms: Date.now() - startedAt, error: 'parse-threw',
    });
    return { status: 'error', errorMessage: msg, finalUrl: page.finalUrl, fetchPath: page.fetchPath };
  }

  if (!bestRecipe) {
    logOutcome({
      host: hostOf(url), ok: false, fetchPath: page.fetchPath,
      ms: Date.now() - startedAt, error: 'no-recipe-markup',
    });
    return {
      status: 'error',
      errorMessage:
        'No recipe markup found on this page — it has no recipe card we can read. Try the page with the actual recipe on it, or add the ingredients by hand.',
      finalUrl: page.finalUrl,
      fetchPath: page.fetchPath,
    };
  }

  logOutcome({
    host: hostOf(url),
    ok: true,
    fetchPath: page.fetchPath,
    parseStrategy: bestRecipe.strategy,
    ingredients: bestRecipe.ingredients.length,
    ms: Date.now() - startedAt,
  });

  return {
    status: 'ok',
    title: bestRecipe.title,
    ingredients: bestRecipe.ingredients,
    finalUrl: page.finalUrl,
    fetchPath: page.fetchPath,
    parseStrategy: bestRecipe.strategy,
  };
}
