/**
 * wineStyles.js — loader + lookups for public/data/wine_styles.json.
 */
import { normalizeText } from './ingredientSearch.js';

let _promise = null;

/** Fetch the wine styles once; resolves to { families, wines } or null. */
export function loadWineStyles(base = '') {
  if (!_promise) {
    _promise = fetch(`${base}data/wine_styles.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.wines ? { families: j._meta?.families || [], wines: j.wines } : null))
      .catch(() => { _promise = null; return null; });
  }
  return _promise;
}

/** Test seam: forget the cached fetch. */
export function _resetWineStylesCache() { _promise = null; }

/**
 * Wines most like `wine`: closest structure (body, acidity, tannin,
 * sweetness, alcohol) plus shared aromas, same colour preferred.
 */
export function similarWines(wine, wines, k = 6) {
  if (!wine) return [];
  const keys = ['body', 'acidity', 'tannin', 'sweetness', 'alcohol'];
  return (wines || [])
    .filter((w) => w.id !== wine.id)
    .map((w) => {
      const dist = Math.sqrt(keys.reduce((s, key) => s + (w[key] - wine[key]) ** 2, 0));
      const shared = w.aromas.filter((a) => wine.aromas.includes(a)).length;
      const colour = w.colour === wine.colour ? 0 : 1.5;
      return { wine: w, d: dist + colour - 0.4 * shared };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map(({ wine: w }) => w);
}

/** Everything a search box should match on for a wine. */
export function wineSearchText(wine) {
  return [
    wine.name, wine.region, wine.area, ...(wine.countries || [wine.country]),
    ...(wine.grapes || []), ...(wine.aromas || []), ...(wine.classicMatches || []),
  ].filter(Boolean);
}

/** Does the wine come from `country` (any of its countries)? */
export function fromCountry(wine, country) {
  return !country || (wine.countries || [wine.country]).includes(country);
}

/**
 * Countries in the list, most styles first, each with its regions:
 * [{ country, count, areas: [{ area, count }] }]. A wine counts for every
 * country it is made in; its region counts under its primary country.
 */
export function countryIndex(wines) {
  const byCountry = new Map();
  for (const w of wines || []) {
    for (const c of w.countries || [w.country]) {
      if (!c) continue;
      if (!byCountry.has(c)) byCountry.set(c, { country: c, count: 0, areas: new Map() });
      const e = byCountry.get(c);
      e.count += 1;
      if (c === w.country && w.area) e.areas.set(w.area, (e.areas.get(w.area) || 0) + 1);
    }
  }
  return [...byCountry.values()]
    .map((e) => ({ ...e, areas: [...e.areas].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area)) }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

/** Five-dot meter for a 0–5 scale: "●●●○○". */
export function dots(v, max = 5) {
  const n = Math.max(0, Math.min(max, Math.round(v)));
  return '●'.repeat(n) + '○'.repeat(max - n);
}

/** Stable key for a family id → its colour. */
export function familyColor(families, id) {
  return (families || []).find((f) => f.id === id)?.color || '#9a8f7a';
}

export { normalizeText };
