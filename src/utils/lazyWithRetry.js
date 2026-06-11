/**
 * lazyWithRetry — React.lazy hardened against transient chunk-load failures.
 *
 * A dynamic import can reject for two recoverable reasons:
 *   1. A momentary network blip (ERR_CONNECTION_TIMED_OUT) — retrying works.
 *   2. The chunk hash changed after a new deploy while the tab was open — the
 *      old hash 404s; a single page reload fetches the fresh manifest.
 *
 * Without this, either failure leaves a lazy route permanently broken (blank
 * screen / error boundary). We retry with backoff, then reload exactly once
 * (guarded by sessionStorage so we never loop).
 */
import { lazy } from 'react';

const RELOAD_KEY = 'fn_chunk_reload';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function safeSessionStorage() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch { /* privacy mode / SSR */ }
  return null;
}
function defaultReload() {
  try { if (typeof window !== 'undefined') window.location.reload(); } catch { /* */ }
}

/**
 * Resolve a dynamic-import factory with retries, then a one-shot reload.
 * Injectable `reload`/`storage`/timing keep it unit-testable.
 * @returns {Promise<any>} the imported module
 */
export async function loadWithRetry(factory, {
  retries = 3, interval = 600, reload = defaultReload, storage = safeSessionStorage(),
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const mod = await factory();
      try { storage?.removeItem(RELOAD_KEY); } catch { /* */ }
      return mod;
    } catch (err) {
      if (attempt < retries) {
        await delay(interval * (attempt + 1)); // linear backoff
        continue;
      }
      // Retries exhausted — likely a stale chunk after a deploy. Reload once.
      try {
        if (storage && !storage.getItem(RELOAD_KEY)) {
          storage.setItem(RELOAD_KEY, '1');
          reload();
          return new Promise(() => {}); // hang while the page reloads
        }
      } catch { /* */ }
      throw err;
    }
  }
  // unreachable, but keeps linters happy
  return factory();
}

/** Drop-in for React.lazy with retry + stale-deploy reload recovery. */
export function lazyWithRetry(factory, opts) {
  return lazy(() => loadWithRetry(factory, opts));
}
