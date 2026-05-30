// MAKE-WEBLINK-FN (2026-05-30). URL-fetch + JSON-LD parse pipeline.
// Lifted from bookstrapCB (D:/Projects/bookstrapCB/functions/src/scrape/handler.ts)
// and slimmed: no Firestore write, no LLM fallback, no family/uid model.
// Returns parsed recipe directly to the callable client.

import { Agent } from 'undici';
import { extractJsonLdRecipes, jsonLdToRecipe } from './parser';
import {
  ssrfReason,
  REDIRECT_MAX,
  assertHostnameResolvesPublicly,
  pinnedAgent,
} from './ssrf';
import type { FetchedPage, ScrapeResult, UrlFetcher } from './types';

export const DEFAULT_BUDGET_MS = 5_000;

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
 * Default fetcher — handles redirect chains with re-validation at every
 * hop. The default redirect: 'follow' would let a public URL chain into
 * http://169.254.169.254/ (or any RFC1918 host) — the SSRF guard at the
 * entry point only covers the initial URL.
 */
export const defaultFetcher: UrlFetcher = {
  async fetch(url: string): Promise<FetchedPage> {
    let current = url;
    for (let hop = 0; hop <= REDIRECT_MAX; hop++) {
      const reason = ssrfReason(current);
      if (reason) throw new Error(reason);
      const pinnedIp = await assertHostnameResolvesPublicly(current);
      const dispatcher = pinnedIp ? pinnedAgent(pinnedIp) : undefined;

      const res = await fetch(current, {
        headers: {
          'user-agent': 'flavor-network-scrape/0.1 (+https://github.com/dscherm/flavor-network)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        },
        redirect: 'manual',
        dispatcher,
      } as RequestInit & { dispatcher?: Agent });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new Error(`HTTP ${res.status} with no Location header for ${current}`);
        current = new URL(loc, current).toString();
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${current}`);
      const body = await res.text();
      return {
        url,
        finalUrl: current,
        contentType: res.headers.get('content-type') ?? 'text/html',
        body,
      };
    }
    throw new Error(`Too many redirects (>${REDIRECT_MAX}) from ${url}`);
  },
};

export interface HandleScrapeDeps {
  fetcher: UrlFetcher;
  budgetMs?: number;
}

export async function handleScrape(url: string, deps: HandleScrapeDeps): Promise<ScrapeResult> {
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
    const msg = err instanceof Error ? err.message : 'fetch failed';
    return { status: 'error', errorMessage: msg };
  }

  let bestRecipe: { title: string; ingredients: ReturnType<typeof jsonLdToRecipe>['ingredients'] } | null = null;
  try {
    const nodes = extractJsonLdRecipes(page.body);
    for (const node of nodes) {
      const r = jsonLdToRecipe(node);
      if (!r.title || r.ingredients.length === 0) continue;
      // First usable Recipe node wins. Some sites embed multiple Recipe
      // entries (e.g. one summary + one detail); we want the one with
      // ingredients populated.
      bestRecipe = r;
      break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'JSON-LD parse failed';
    return { status: 'error', errorMessage: msg, finalUrl: page.finalUrl };
  }

  if (!bestRecipe) {
    return {
      status: 'error',
      errorMessage:
        'No Recipe schema found on this page. Try a different URL — most popular recipe sites embed JSON-LD recipe data.',
      finalUrl: page.finalUrl,
    };
  }

  return {
    status: 'ok',
    title: bestRecipe.title,
    ingredients: bestRecipe.ingredients,
    finalUrl: page.finalUrl,
  };
}
