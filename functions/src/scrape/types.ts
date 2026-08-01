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
  /** WEBLINK-2: which fetch attempt produced the page. 'proxy' means the
   *  origin bot-blocked us and the reader proxy served it instead — worth
   *  seeing in logs, since proxy reliance is a fragility signal. */
  fetchPath?: FetchPath;
  /** WEBLINK-3: which extraction strategy produced the recipe. A rising
   *  share of 'heuristic' means sites are dropping structured data and the
   *  guesswork layer is carrying more weight than it should. */
  parseStrategy?: ParseStrategy;
  /** WEBLINK-8: present when an apple.news link could not be resolved to a
   *  publisher article. Carries what the interstitial did reveal so the UI
   *  can name the recipe rather than showing a generic failure — the user
   *  needs to see that we read the right article and that the limitation is
   *  Apple's link format, not a mis-parse. */
  appleNews?: { title: string | null; publisher: string | null };
}

/** WEBLINK-2: how a page was retrieved. */
export type FetchPath = 'direct' | 'proxy';

/** WEBLINK-3: which extraction strategy produced the recipe, most reliable first. */
export type ParseStrategy = 'json-ld' | 'microdata' | 'heuristic';

export interface ParsedRecipe {
  title: string;
  ingredients: ParsedIngredient[];
  strategy: ParseStrategy;
}

export interface FetchedPage {
  url: string;
  finalUrl: string;
  contentType: string;
  body: string;
  fetchPath?: FetchPath;
}

export interface UrlFetcher {
  fetch(url: string): Promise<FetchedPage>;
}
