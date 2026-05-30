// MAKE-WEBLINK-FN (2026-05-30). Firebase Callable Function wrapper for
// the scrapeRecipe pipeline. Lifted from bookstrapCB's
// D:/Projects/bookstrapCB/functions/src/scrape/index.ts and slimmed:
// no rate limit (defer), no family auth (uid only), no LLM fallback.

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { defaultFetcher, handleScrape } from './handler';
import type { ScrapeResult } from './types';

interface ScrapeCallPayload {
  url: string;
}

export const scrapeRecipe = onCall(
  { timeoutSeconds: 30, memory: '512MiB' },
  async (request: CallableRequest<ScrapeCallPayload>): Promise<ScrapeResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to import recipes from a URL.');
    }
    const { url } = request.data ?? ({} as ScrapeCallPayload);
    if (!url) {
      throw new HttpsError('invalid-argument', 'url is required.');
    }

    try {
      const result = await handleScrape(url, { fetcher: defaultFetcher });
      // Surface SSRF / invalid-URL errors as invalid-argument so the
      // client can render a friendlier message than generic 'internal'.
      if (result.status === 'error' && /invalid url|unsupported url|forbidden internal host|forbidden url credentials/i.test(result.errorMessage ?? '')) {
        throw new HttpsError('invalid-argument', result.errorMessage!);
      }
      return result;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : 'Scrape pipeline failed.';
      throw new HttpsError('internal', msg);
    }
  },
);
