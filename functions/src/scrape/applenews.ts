// WEBLINK-8 (2026-08-01). Apple News (apple.news) link handling.
//
// Measured against two real links, chosen to straddle the paywall boundary:
//
//   America's Test Kitchen — a News+ (paywalled) publisher
//   Epicurious            — a free Condé Nast publisher
//
// Both serve an identical ~7.5KB "open this in the News app" interstitial:
//
//   - <title> and og:title carry the recipe name, suffixed with the
//     publisher: "Miso Pork and Eggplant Stir-Fry — America's Test Kitchen"
//   - <meta name="Author"> carries the publisher
//   - there is NO <link rel=canonical> and NO og:url
//   - EVERY absolute URL on the page is an Apple domain — zero external links
//   - the only navigation is a JS redirect to applenewss://, a scheme only
//     the News app can open
//
// The free publisher behaving exactly like the paywalled one is the finding
// that matters: withholding the publisher URL is how apple.news works, not a
// News+ artifact. So there is nothing for the redirect-follower to resolve,
// and a plain scrape returns "no recipe markup" — true, and useless.
//
// This module therefore mainly exists to fail *informatively*: name the
// recipe and publisher so the user can see we read the right article and
// that the limitation is Apple's link format, not a mis-parse.
//
// findPublisherUrl() is kept as a hedge and is fully tested, but be honest
// about its status: it has NEVER fired on a real apple.news link. Do not
// treat it as an exercised path — if you are debugging why an Apple News
// import didn't resolve, the answer is almost certainly that Apple exposed
// no URL, exactly as on both captured fixtures.

/** Hosts whose pages are Apple News interstitials rather than articles. */
const APPLE_NEWS_HOSTS = new Set(['apple.news', 'www.apple.news']);

/**
 * Apple-owned domains that appear on the interstitial as chrome (fonts,
 * image CDN, legal footer). None of these is ever the publisher's article,
 * so they must not be mistaken for one.
 */
const APPLE_OWNED = /(^|\.)(apple\.com|apple\.news|cdn-apple\.com|mzstatic\.com)$/i;

/** Namespace declarations, not links. */
const NON_LINK_HOSTS = /(^|\.)(w3\.org|ogp\.me|schema\.org|purl\.org)$/i;

export interface AppleNewsInterstitial {
  /** Recipe title with the trailing " — Publisher" suffix removed. */
  title: string | null;
  publisher: string | null;
  /** A publisher article URL if the page exposes one — usually it does not. */
  publisherUrl: string | null;
}

export function isAppleNewsUrl(url: string): boolean {
  try {
    return APPLE_NEWS_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function metaContent(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m ? decodeEntities(m[1]).trim() || null : null;
}

/** The interstitial entity-encodes apostrophes ("America&#x27;s"). */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * og:title is "Recipe Name — Publisher". Strip the suffix so the UI can show
 * the recipe on its own. Uses an em/en dash with surrounding spaces, which is
 * Apple's separator — a hyphen inside a recipe name ("Stir-Fry") must survive.
 */
function stripPublisherSuffix(title: string, publisher: string | null): string {
  if (publisher) {
    const idx = title.lastIndexOf(publisher);
    if (idx > 0) {
      return title.slice(0, idx).replace(/\s*[—–-]\s*$/, '').trim() || title;
    }
  }
  const dash = title.lastIndexOf(' — ');
  return dash > 0 ? title.slice(0, dash).trim() : title;
}

/**
 * Find a publisher article URL on the interstitial, if one exists.
 *
 * Checked in descending order of reliability: canonical, og:url, then any
 * absolute link to a non-Apple host. The last is a deliberate catch-all —
 * the only sample in hand is a News+ publisher, and a free publisher may
 * expose a "read on the web" link in a shape not yet seen.
 */
function findPublisherUrl(html: string): string | null {
  const canonical = metaContent(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonical && isPublisherUrl(canonical)) return canonical;

  const ogUrl = metaContent(html, /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  if (ogUrl && isPublisherUrl(ogUrl)) return ogUrl;

  for (const raw of html.match(/https?:\/\/[^"'\s<>)]+/g) ?? []) {
    if (isPublisherUrl(raw)) return raw;
  }
  return null;
}

function isPublisherUrl(candidate: string): boolean {
  let host: string;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return !APPLE_OWNED.test(host) && !NON_LINK_HOSTS.test(host);
}

export function parseAppleNewsInterstitial(html: string): AppleNewsInterstitial {
  const publisher = metaContent(html, /<meta[^>]*name=["']Author["'][^>]*content=["']([^"']+)["']/i);
  const rawTitle =
    metaContent(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    metaContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i);

  return {
    title: rawTitle ? stripPublisherSuffix(rawTitle, publisher) : null,
    publisher,
    publisherUrl: findPublisherUrl(html),
  };
}

/**
 * The message shown when an Apple News link cannot be resolved.
 *
 * Deliberately does NOT promise that Open-in-Safari exists: News+ articles
 * have no public web version at all, and the sample that motivated this
 * (America's Test Kitchen) is a News+ publisher. Naming the recipe matters —
 * it tells the user we read the right article and the failure is Apple's
 * link format, not a mis-parse.
 */
export function appleNewsErrorMessage(info: AppleNewsInterstitial): string {
  const what = info.title
    ? `“${info.title}”${info.publisher ? ` from ${info.publisher}` : ''}`
    : 'that article';
  return (
    `Apple News links don't include the original recipe page, so we can't read the ` +
    `ingredients for ${what}. If the article has a web version, open it in News, tap ⋯ ` +
    `→ Open in Safari, and paste that link instead. News+ articles don't have one — ` +
    `for those you'll need to add the ingredients by hand.`
  );
}
