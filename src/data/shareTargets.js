/**
 * shareTargets.js — pure builders for the share sheet. Plain web share links
 * (no SDKs, no scripts); every parameter is encodeURIComponent-encoded.
 */

/**
 * Sharing a recipe the person made themselves. The publish step exists (SHARE-6) but this stays false until the
 * Report link and the takedown path exist (SHARE-7): nothing a user wrote may go public without a way to report and remove it.
 */
export const SHARE_OWN_ENABLED = true;

/**
 * The flavor chart on PUBLIC share surfaces: the shared recipe page, the share-card images (single and set),
 * the server preview cards, and the bars stored when a user publishes a recipe. Off since 2026-11-15 (SHARE-8):
 * the charts still mostly lead with a wrong taste (docs/flavor-profile.md). FLAVOR-6 turns this back on once the
 * rebuilt charts pass. Charts inside the app (Recipe Notebook, invent panels) are not affected.
 */
export const SHARE_CHARTS_ENABLED = false;

// encodeURIComponent leaves ! ' ( ) * alone; encode those too so an apostrophe can never end a quoted value.
const enc = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** "/r/cocktail/negroni" + "https://neuralflavor.web.app" → the absolute link. */
export function absoluteShareUrl(path, origin) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** A short plain line: "Negroni, on Neural Flavor". */
export function shareTextFor(recipe) {
  const name = String(recipe?.name || '').trim();
  return name ? `${name}, on Neural Flavor` : 'A recipe on Neural Flavor';
}

/** { x, facebook, pinterest, whatsapp } share URLs for { title, text, url }. */
export function shareTargetUrls({ title = '', text = '', url = '' } = {}) {
  const line = text || title;
  return {
    x: `https://twitter.com/intent/tweet?text=${enc(line)}&url=${enc(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    pinterest: `https://www.pinterest.com/pin/create/button/?url=${enc(url)}&description=${enc(line)}`,
    whatsapp: `https://wa.me/?text=${enc(`${line} ${url}`.trim())}`,
  };
}

const KIND_TAG = { cocktail: '#cocktails', sauce: '#sauce', dish: '#cooking' };

/** A ready caption for a post: the name, the link as text (apps do not make it tappable), two hashtags. */
export function captionFor(recipe, link) {
  const name = String(recipe?.name || '').trim() || 'A recipe';
  const tag = KIND_TAG[recipe?.kind] || '#cooking';
  return [name, String(link || '').trim(), '', `#neuralflavor ${tag}`].filter((l, i) => l || i === 2).join('\n');
}

const CANONICAL_HOST = 'neuralflavor.web.app';

/**
 * The short link as printed on a card: "neuralflavor.web.app/r/cocktail/negroni". A path is put on the
 * site's own host unless the page is on one of its real hosts (so a dev machine never prints "localhost").
 */
export function printedLinkFor(path, origin) {
  if (!path) return '';
  const p = path.startsWith('/') ? path : `/${path}`;
  let host = CANONICAL_HOST;
  try {
    const h = new URL(origin).host;
    if (h === 'neuralflavor.firebaseapp.com') host = h;
  } catch { /* no origin: the site host */ }
  return `${host}${p}`;
}
