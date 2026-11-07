/**
 * dishStories.js — STORIES-1. Lazy, cached, fail-safe loader for
 * `public/data/dish_stories.json` (built offline by
 * scripts/build_dish_stories.mjs from Wikipedia + Wikimedia Commons).
 *
 *   await loadDishStories();          // fetched once, shared by every card
 *   storyFor('recipe', 'paella')      // → { title, text, url, photo? } | null
 *
 * Never throws: a missing / broken file just means no stories. A failed load
 * is not cached, so a later card open retries.
 */

const BUCKET = { recipe: 'recipes', sauce: 'sauces', cocktail: 'cocktails', wine: 'wines' };

let data = null;
let pending = null;

function baseUrl() {
  try { return import.meta.env?.BASE_URL || '/'; } catch { return '/'; }
}

export function loadDishStories(fetchImpl = globalThis.fetch) {
  if (data) return Promise.resolve(data);
  if (pending) return pending;
  if (typeof fetchImpl !== 'function') return Promise.resolve(null);
  pending = Promise.resolve()
    .then(() => fetchImpl(`${baseUrl()}data/dish_stories.json`))
    .then((res) => (res && res.ok ? res.json() : null))
    .then((json) => {
      if (json && typeof json === 'object') data = json;
      return data;
    })
    .catch(() => null)
    .finally(() => { pending = null; });
  return pending;
}

/** The story for one item, or null. Synchronous; call after loadDishStories(). */
export function storyFor(kind, key, source = data) {
  if (!source || key == null) return null;
  const bucket = source[BUCKET[kind] || kind];
  const entry = bucket && Object.prototype.hasOwnProperty.call(bucket, key) ? bucket[key] : null;
  if (!entry || typeof entry !== 'object' || !entry.text) return null;
  return entry;
}

/** True once a load has succeeded (lets a card render synchronously). */
export function dishStoriesLoaded() {
  return data != null;
}

/** Test hook. */
export function _resetDishStories(next = null) {
  data = next;
  pending = null;
}
