/**
 * shareTargets.js — pure builders for the share sheet. Plain web share links
 * (no SDKs, no scripts); every parameter is encodeURIComponent-encoded.
 */

/** Sharing a recipe the person made themselves needs the publish step (SHARE-6); off until then. */
export const SHARE_OWN_ENABLED = false;

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
