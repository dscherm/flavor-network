// WEBLINK-17 (2026-11-07): `?import=<url-encoded link>` starts a link import.
//
// Built for an iOS Shortcut in the Share sheet ("Send to Flavor Network",
// see docs/apple-news-shortcut.md) that opens
//   https://neuralflavor.web.app/?import=<encoded recipe link>
//
// The value is untrusted: anyone can craft such a link. It is only ever
// placed in the URL input's `value` (React escapes it) and sent to the
// scrapeRecipe callable, which runs the full SSRF gauntlet. Anything that
// isn't a plain http(s) URL is dropped here.

const MAX_LEN = 2048;

/** The validated http(s) URL from `?import=`, or null. */
export function readImportParam(search) {
  let raw;
  try {
    raw = new URLSearchParams(search || '').get('import');
  } catch {
    return null;
  }
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_LEN) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** `href` with any `import` parameter removed, as a path+query+hash string. */
export function stripImportParam(href) {
  const u = new URL(href);
  if (!u.searchParams.has('import')) return null;
  u.searchParams.delete('import');
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ''}${u.hash}`;
}
