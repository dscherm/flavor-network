// SHARE-4. The sharePreview pipeline: take the app's index.html and fill its
// <head> with the title, description and image of the recipe a /r/ link points
// at, so social sites and messengers (which do not run JavaScript) show a real
// preview. Pure and dependency-injected (shell fetch, shared-recipe lookup,
// built-in index, logger); no network or Firestore in here.

export const SITE_NAME = 'Neural Flavor';
export const CANONICAL_HOST = 'neuralflavor.web.app';
export const ALLOWED_HOSTS = ['neuralflavor.web.app', 'neuralflavor.firebaseapp.com'];
export const SHELL_TTL_MS = 5 * 60_000;
export const GENERIC_TITLE = SITE_NAME;
export const GENERIC_DESCRIPTION = 'Build cocktails, sauces and dishes from what pairs well.';
export const GENERIC_IMAGE_PATH = '/icons/icon-512.png';
export const KINDS = ['cocktail', 'sauce', 'dish'] as const;
export type Kind = (typeof KINDS)[number];

export interface ShareEntry {
  name: string;
  description: string;
  kind: string;
}

/** What SHARE-6 returns for a user-published recipe (/r/<id>). */
export interface SharedLookup {
  name: string;
  description: string;
}

export interface ShareDeps {
  fetchIndexHtml: (origin: string) => Promise<string>;
  lookupShared: (id: string) => Promise<SharedLookup | null>;
  index: Record<string, ShareEntry>;
  log: (message: string, fields?: Record<string, unknown>) => void;
}

export interface ShareRequest {
  path: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface ShareResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface Tags {
  title: string;
  description: string;
  image: string;
  url: string;
  type: 'article' | 'website';
  card: 'summary_large_image' | 'summary';
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function first(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '').split(',')[0].trim().toLowerCase();
}

/** Origin for URLs in the tags: only an allow-listed host is ever echoed back. */
export function originFor(headers: ShareRequest['headers']): string {
  const host = first(headers['x-forwarded-host']) || first(headers['host']);
  if (ALLOWED_HOSTS.includes(host)) return `https://${host}`;
  if (/^localhost(:\d{1,5})?$/.test(host)) return `http://${host}`;
  return `https://${CANONICAL_HOST}`;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export type Target = { kind: Kind; slug: string } | { id: string } | null;

/** /r/<kind>/<slug> or /r/<id>; null for anything else. */
export function parseTarget(path: string): Target {
  const parts = String(path || '').split('?')[0].split('#')[0].split('/').filter(Boolean).map(safeDecode);
  if (parts[0] !== 'r' || parts.length < 2) return null;
  if (parts.length === 2) return { id: parts[1] };
  if (parts.length === 3) {
    const kind = parts[1].toLowerCase();
    if ((KINDS as readonly string[]).includes(kind)) return { kind: kind as Kind, slug: parts[2].toLowerCase() };
    return null;
  }
  return null;
}

function genericTags(origin: string, url: string): Tags {
  return {
    title: GENERIC_TITLE,
    description: GENERIC_DESCRIPTION,
    image: `${origin}${GENERIC_IMAGE_PATH}`,
    url,
    type: 'website',
    card: 'summary',
  };
}

/** Where SHARE-5's shareCard function serves the image; a 404 until it ships. */
export function imageUrlFor(origin: string, target: { kind: Kind; slug: string } | { id: string }): string {
  return 'id' in target
    ? `${origin}/r-img/${encodeURIComponent(target.id)}.png`
    : `${origin}/r-img/${target.kind}/${encodeURIComponent(target.slug)}.png`;
}

async function tagsFor(path: string, origin: string, deps: ShareDeps): Promise<Tags> {
  const target = parseTarget(path);
  const generic = genericTags(origin, `${origin}/`);
  if (!target) return generic;
  const slugPart = 'id' in target ? encodeURIComponent(target.id) : `${target.kind}/${encodeURIComponent(target.slug)}`;
  const url = `${origin}/r/${slugPart}`;
  let found: { name: string; description: string } | null = null;
  if ('id' in target) {
    found = await deps.lookupShared(target.id);
  } else {
    const key = `${target.kind}/${target.slug}`;
    const e = Object.prototype.hasOwnProperty.call(deps.index, key) ? deps.index[key] : null;
    if (e) found = { name: e.name, description: e.description };
  }
  if (!found || !found.name) return generic;
  return {
    title: `${found.name} | ${SITE_NAME}`,
    description: found.description || GENERIC_DESCRIPTION,
    image: imageUrlFor(origin, target),
    url,
    type: 'article',
    card: 'summary_large_image',
  };
}

const meta = (attr: 'name' | 'property', key: string, value: string) =>
  `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;

function tagBlock(t: Tags): string {
  return [
    `<title>${escapeHtml(t.title)}</title>`,
    meta('name', 'description', t.description),
    meta('property', 'og:title', t.title),
    meta('property', 'og:description', t.description),
    meta('property', 'og:image', t.image),
    meta('property', 'og:url', t.url),
    meta('property', 'og:type', t.type),
    meta('property', 'og:site_name', SITE_NAME),
    meta('name', 'twitter:card', t.card),
    meta('name', 'twitter:title', t.title),
    meta('name', 'twitter:description', t.description),
    meta('name', 'twitter:image', t.image),
  ].join('\n    ');
}

/** Replace (never duplicate) the title and the description / og / twitter tags in the shell's <head>. */
export function injectTags(html: string, t: Tags): string {
  const stripped = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\b[^>]*\b(?:name|property)\s*=\s*["'](?:description|og:[^"']*|twitter:[^"']*)["'][^>]*>\s*/gi, '');
  const block = `${tagBlock(t)}\n    `;
  if (/<\/head>/i.test(stripped)) return stripped.replace(/<\/head>/i, () => `${block}</head>`);
  return `<head>${block}</head>${stripped}`;
}

function fallbackHtml(t: Tags): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${tagBlock(t)}
</head><body style="font-family:sans-serif;padding:2rem;background:#0d1f38;color:#f4efe0">
<p>${escapeHtml(SITE_NAME)} could not load this page just now.</p>
<p><a style="color:#f4efe0" href="/">Go to ${escapeHtml(SITE_NAME)}</a></p>
</body></html>`;
}

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=600, s-maxage=600',
};

/** Never throws: any failure still answers 200 with usable HTML. */
export async function handleSharePreview(req: ShareRequest, deps: ShareDeps): Promise<ShareResponse> {
  const origin = originFor(req.headers);
  let tags: Tags;
  try {
    tags = await tagsFor(req.path, origin, deps);
  } catch (err) {
    deps.log('sharePreview tag lookup failed', { error: String((err as Error)?.message || err) });
    tags = genericTags(origin, `${origin}/`);
  }
  try {
    const shell = await deps.fetchIndexHtml(origin);
    return { status: 200, headers: { ...HEADERS }, body: injectTags(shell, tags) };
  } catch (err) {
    deps.log('sharePreview shell unavailable', { error: String((err as Error)?.message || err) });
    return { status: 200, headers: { ...HEADERS, 'Cache-Control': 'public, max-age=60, s-maxage=60' }, body: fallbackHtml(tags) };
  }
}

/**
 * Wraps a fetch of the app shell with an in-memory cache. Within the TTL the
 * cached copy is returned; after it, a refresh is attempted and, if that fails,
 * the last good copy is served. Throws only when no copy has ever loaded.
 */
export function createShellFetcher(
  fetchShell: (origin: string) => Promise<string>,
  now: () => number = Date.now,
  ttlMs: number = SHELL_TTL_MS,
): (origin: string) => Promise<string> {
  const cache = new Map<string, { html: string; at: number }>();
  return async (origin) => {
    const hit = cache.get(origin);
    if (hit && now() - hit.at < ttlMs) return hit.html;
    try {
      const html = await fetchShell(origin);
      cache.set(origin, { html, at: now() });
      return html;
    } catch (err) {
      if (hit) return hit.html;
      throw err;
    }
  };
}
