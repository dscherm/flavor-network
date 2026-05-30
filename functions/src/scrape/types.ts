// MAKE-WEBLINK-FN (2026-05-30). Lifted from bookstrapCB
// (D:/Projects/bookstrapCB/functions/src/scrape/types.ts) and slimmed:
// no family/uid model, no Firestore-write side effect, no LLM fallback.

export interface ParsedIngredient {
  /** Raw line from JSON-LD recipeIngredient[i] (e.g. "1 cup diced tomato"). */
  raw: string;
  /** Best-effort noun extraction (e.g. "diced tomato") — the client matcher
   *  fuzzy-matches this against the known ingredient dictionary. */
  noun: string;
  quantity?: number;
  unit?: string;
}

export interface ScrapeResult {
  status: 'ok' | 'error';
  /** When status='ok': the JSON-LD recipe name. */
  title?: string;
  /** When status='ok': parsed ingredient lines. May be empty if the page
   *  has JSON-LD with no recipeIngredient array. */
  ingredients?: ParsedIngredient[];
  /** Post-redirect-chain URL. Surfaced so the client can show the user
   *  the actual page they're importing from (vs. the bit.ly / share link). */
  finalUrl?: string;
  /** When status='error': a friendly message safe to render in the UI. */
  errorMessage?: string;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  contentType: string;
  body: string;
}

export interface UrlFetcher {
  fetch(url: string): Promise<FetchedPage>;
}
