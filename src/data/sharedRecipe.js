/**
 * sharedRecipe.js — the links and the one recipe shape behind the public
 * "shared recipe" page (/r/...). Pure: no React, no fetch.
 *
 *   /r/<kind>/<slug>   a built-in recipe (kind: cocktail | sauce | dish)
 *   /r/<id>            a user's published copy (SHARE-6; not resolved here)
 *
 * Normalised recipe (what the page renders; SHARE-6 produces the same shape):
 *   { kind, slug, name, lines: [{ key, amount, label?, suggested? }],
 *     method, glass, category, garnish?, meta? }
 *   key     ingredient name used to look up flavor data
 *   amount  as written ('' when the source gives none); `suggested` marks a house default
 *   label   the name as the source wrote it, when it differs from `key`
 *   method  text; steps separated by newlines
 *   glass   glass or vessel, or null
 *   category family / mother sauce / cuisine, or null
 *
 * Slugs: lowercase, accents and apostrophes dropped, runs of anything else
 * become one hyphen. They come from the item's canonical name (cocktail), name
 * (sauce) or id (dish), so they do not change when the lists are reordered.
 */
import { normalizeIngredient } from './normalizeIngredient.js';
import { suggestAmounts } from './cocktailAmounts.js';
import { guessSlot } from './cocktailFacets.js';

export const SHARE_KINDS = Object.freeze(['cocktail', 'sauce', 'dish']);

const strip = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Piña Colada's #2" → "pina-coladas-2". */
export function slugify(text) {
  return strip(text)
    .toLowerCase()
    .replace(/['‘’ʼ`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Two distinct codex recipes slugify alike ('old-fashioned' and 'old fashioned', the IBA
// one); the second keeps the plain slug, the first is pinned here. The test guards new clashes.
const SLUG_OVERRIDE = { cocktail: { 'old-fashioned': 'old-fashioned-2' } };

function baseOf(kind, item) {
  if (!item) return '';
  if (kind === 'cocktail') {
    const canonical = item.canonical || item.name;
    return SLUG_OVERRIDE.cocktail[canonical] || canonical;
  }
  if (kind === 'sauce') return item.name;
  if (kind === 'dish') return item.id || item.name;
  return '';
}

/** The slug for one built-in item, or '' for an unknown kind / empty item. */
export function slugFor(kind, item) {
  if (!SHARE_KINDS.includes(kind)) return '';
  return slugify(baseOf(kind, item));
}

/** "/r/<kind>/<slug>", or '' when the item has no slug. */
export function shareLinkFor(kind, item) {
  const slug = slugFor(kind, item);
  return slug ? `/r/${kind}/${slug}` : '';
}

function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/**
 * Read a pathname. null when it is not a share path at all; { kind, slug } for
 * /r/<kind>/<slug> (kind is whatever was typed, resolveBuiltIn rejects unknown
 * ones); { id } for /r/<id> and for any other shape under /r/.
 */
export function parseSharePath(pathname) {
  if (typeof pathname !== 'string') return null;
  const parts = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean).map(safeDecode);
  if (parts[0] !== 'r' || parts.length < 2) return null;
  if (parts.length === 2) return { id: parts[1] };
  if (parts.length === 3) return { kind: parts[1].toLowerCase(), slug: parts[2].toLowerCase() };
  return { id: parts.slice(1).join('/') };
}

const BUILD_TEXT = {
  shake: 'Shake with ice, then strain into the glass.',
  stir: 'Stir with ice, then strain into the glass.',
  build: 'Build in the glass over ice.',
  blend: 'Blend with ice until smooth.',
  muddle: 'Muddle the first ingredients in the glass, add the rest and ice, and stir.',
  swizzle: 'Swizzle over crushed ice until the glass frosts.',
};

/** First match for a slug, ignoring later items that repeat a slug. */
function findBySlug(kind, slug, items) {
  for (const it of items || []) if (slugFor(kind, it) === slug) return it;
  return null;
}

/** The items of a kind with repeated slugs dropped (the codex lists two cocktails twice). */
export function uniqueBySlug(kind, items) {
  const seen = new Set();
  const out = [];
  for (const it of items || []) {
    const s = slugFor(kind, it);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(it);
  }
  return out;
}

function cocktailMethod(c) {
  const rawLines = new Set((c.ingredients_raw || []).map((r) => String(typeof r === 'string' ? r : r?.raw || '').trim().toLowerCase()));
  const prose = String(c.recipe_text || '').split('\n').map((l) => l.trim()).filter((l) => {
    if (!l || /^(garnish|rim)\s*:/i.test(l)) return false;
    return !rawLines.has(l.toLowerCase());
  }).join(' ');
  return prose || BUILD_TEXT[c.build_method] || '';
}

function resolveCocktail(c, data) {
  const normalize = (raw) => normalizeIngredient(strip(raw));
  const { items } = suggestAmounts(c.ingredients_raw || [], (n) => guessSlot(n), normalize);
  const lines = items.map((i) => {
    const key = normalize(i.name) || strip(i.name).toLowerCase();
    return {
      key,
      amount: i.measure || '',
      ...(i.name && i.name.toLowerCase() !== key ? { label: i.name } : {}),
      ...(i.suggested ? { suggested: true } : {}),
    };
  });
  const family = (data?.families || []).find((f) => f.id === c.family_id);
  const garnish = (c.garnishes || []).filter((g) => g && !/^no garnish$/i.test(g)).join(', ');
  return {
    kind: 'cocktail', slug: slugFor('cocktail', c), name: c.name, lines,
    method: cocktailMethod(c), glass: c.glass || null, category: family?.name || null,
    ...(garnish ? { garnish } : {}),
  };
}

function resolveSauce(s) {
  const lines = (s.ingredients || []).map((i) => (typeof i === 'string' ? { name: i, measure: '' } : i))
    .filter((i) => i && i.name)
    .map((i) => ({ key: String(i.name).toLowerCase(), amount: i.measure || '' }));
  return {
    kind: 'sauce', slug: slugFor('sauce', s), name: s.name, lines,
    method: s.instructions || '', glass: null,
    category: s.motherSauce && s.motherSauce !== 'Independent' ? s.motherSauce : null,
  };
}

function resolveDish(d, data) {
  const det = data?.dishDetails?.[d.id] || null;
  const amounts = det?.amounts || {};
  const lines = (d.ingredients || []).map((n) => ({ key: String(n).toLowerCase(), amount: amounts[n] || '' }));
  const meta = det ? [det.serves ? `Serves ${det.serves}` : '', det.time || ''].filter(Boolean).join(' · ') : '';
  return {
    kind: 'dish', slug: slugFor('dish', d), name: d.name, lines,
    method: (det?.steps || []).join('\n'), glass: null, category: d.cuisine || null,
    ...(meta ? { meta } : {}),
  };
}

/**
 * One built-in recipe in the normalised shape, or null for an unknown kind or slug.
 * data = { cocktails, families, sauces, dishes, dishDetails } — the raw lists
 * (public/data/cocktail_codex_v2.json, sauce_augment.json's `sauces`,
 * SEED_RECIPES, RECIPE_DETAILS); a kind whose list is missing resolves to null.
 */
export function resolveBuiltIn(kind, slug, data) {
  if (!SHARE_KINDS.includes(kind) || typeof slug !== 'string' || !slug) return null;
  const want = slug.toLowerCase();
  if (kind === 'cocktail') {
    const c = findBySlug(kind, want, data?.cocktails);
    return c ? resolveCocktail(c, data) : null;
  }
  if (kind === 'sauce') {
    const s = findBySlug(kind, want, data?.sauces);
    return s ? resolveSauce(s) : null;
  }
  const d = findBySlug(kind, want, data?.dishes);
  return d ? resolveDish(d, data) : null;
}
