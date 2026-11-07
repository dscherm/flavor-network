/**
 * dishStoryMatch.js — STORIES-1. Pure rules for matching a dish / sauce /
 * cocktail / wine name to a Wikipedia article, and for trimming what we keep
 * from it. No network here: `scripts/build_dish_stories.mjs` does the
 * fetching and calls these; the unit tests run them on fixtures.
 */

// ── Name normalisation ────────────────────────────────────────────────

/** Lower-case, strip accents and punctuation, collapse spaces. */
export function fold(s = '') {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Words that only say what kind of thing it is — not part of its identity.
const GENERIC = new Set(['the', 'a', 'an', 'cocktail', 'sauce', 'dish', 'food', 'drink', 'classic', 'wine', 'and', 'n', 'of', 'al', 'alla', 'alle', 'la', 'le', 'de', 'du']);

function stem(w) {
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Significant, stemmed tokens of a name (generic words dropped). */
export function tokens(s = '') {
  return fold(s).split(' ').filter((w) => w && !GENERIC.has(w)).map(stem);
}

/** Drop a trailing "(qualifier)" from a Wikipedia title. */
export function baseTitle(title = '') {
  return String(title).replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * The name we search with: no parenthetical variant note ("Martini (Very
 * Dry)" → "Martini"), no "#2" numbering, first half of "A / B".
 */
export function cleanName(name = '') {
  let s = String(name).split(' / ')[0];
  s = s.replace(/\s*\([^)]*\)/g, ' ');
  s = s.replace(/\s*#\s*\d+.*$/, ' ');
  s = s.replace(/[’]/g, "'");
  return s.replace(/\s+/g, ' ').trim();
}

const QUALIFIERS = {
  recipe: ['(dish)', '(food)'],
  sauce: ['(sauce)', 'sauce', 'Sauce {}'],
  cocktail: ['(cocktail)', 'cocktail'],
  wine: ['(wine)', 'wine'],
};

/** "Mac and Cheese" → "Mac and cheese" (Wikipedia titles are case-sensitive after the first letter). */
export function sentenceCase(s = '') {
  const t = String(s);
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/**
 * Ordered candidate titles for a name: exact (as written, then sentence
 * case), then name + qualifier.
 */
export function candidateTitles(name, kind) {
  const base = cleanName(name);
  const out = [base, sentenceCase(base)];
  const has = new Set(fold(base).split(' '));
  for (const q of QUALIFIERS[kind] || []) {
    // Skip "Tomato Sauce sauce" style doubles.
    const word = fold(q.replace('{}', '')).trim();
    if (has.has(word)) continue;
    out.push(q.includes('{}') ? q.replace('{}', base) : `${base} ${q}`);
  }
  return [...new Set(out)];
}

// ── Acceptance ────────────────────────────────────────────────────────

// Words that make a page clearly food or drink. Deliberately excludes words
// with common non-food senses (port, punch, spirit, stock, sour, flip, rose).
const FOOD_RE = new RegExp(
  '\\b(' + [
    'dish(?:es)?', 'sauces?', 'cocktails?', 'foods?', 'drinks?', 'beverages?', 'soups?', 'stews?',
    'breads?', 'wines?', 'cuisine', 'pastry', 'pastries', 'desserts?', 'salads?', 'condiments?',
    'curry', 'curries', 'pasta', 'noodles?', 'dumplings?', 'liqueurs?', 'sandwich(?:es)?',
    'confection(?:ery)?', 'puddings?', 'broth', 'sherry', 'alcoholic', 'mixed drink', 'cooking',
    'culinary', 'cake', 'cookies?', 'biscuits?', 'pancakes?', 'flatbread', 'casserole', 'snacks?',
    'appetizers?', 'meals?', 'recipes?', 'marinades?', 'dips?', 'relish', 'chutney', 'custard',
    'tart', 'pie', 'cheese', 'grape(?: variety)?', 'vineyards?', 'appellation', 'vermouth',
    'gin', 'rum', 'whisk(?:e)?y', 'bourbon', 'brandy', 'tequila', 'vodka', 'champagne',
    'seasoning', 'spices?', 'rice', 'porridge', 'fritters?', 'tacos?', 'pizza', 'hamburger',
    'sushi', 'kebabs?', 'skewer(?:ed|s)?', 'stir-fried', 'chowder', 'tortillas?', 'beer', 'cider', 'paste', 'cut of meat', 'barbecue', 'pork',
  ].join('|') + ')\\b', 'i');

// Descriptions that say the page is about something else, whatever words its
// extract happens to contain ("Mac & Cheese 3 — album by French Montana").
const NOT_FOOD_RE = /\b(album|song|single|film|movie|novel|book|band|musician|singer|rapper|television|tv series|episode|video game|game show|magazine|racehorse|horse|ship|footballer|politician|actor|actress|company|brand of|restaurant chain|comic|character|play by|opera|ep by|mixtape|town|village|city|commune|municipality|river|mountain|distillery|brewery)\b/i;

/** True when the description or extract reads as food or drink. */
export function isFoodPage(summary) {
  if (!summary) return false;
  const d = summary.description || '';
  if (NOT_FOOD_RE.test(d)) return false;
  // The page's own title must not count as evidence ("Chocolate Chip
  // Cookies is an album…" contains "cookies" only because it names itself).
  const title = baseTitle(summary.title || '');
  const strip = (t) => (title.length > 2 ? String(t).split(title).join(' ').split(title.toLowerCase()).join(' ') : t);
  if (FOOD_RE.test(strip(d))) return true;
  // Extract: only the first sentence, so "X is a mammal… also eaten" can't sneak in.
  const first = strip(firstSentences(summary.extract || '', 1, 400));
  return FOOD_RE.test(first);
}

// Levenshtein similarity on folded, space-free strings (0..1).
export function similarity(a, b) {
  const x = fold(a).replace(/ /g, '');
  const y = fold(b).replace(/ /g, '');
  if (!x || !y) return 0;
  const prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (x[i - 1] === y[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

/**
 * Does the page title plausibly name the item?
 *   mode 'exact'    — we asked for this title; Wikipedia may have redirected.
 *                     A redirect is an editor's assertion, so accept either
 *                     direction of token containment.
 *   mode 'search'   — opensearch guessed it; accept only if every token of
 *                     the item name is in the title (title may be MORE
 *                     specific, never less: "Strawberry Negroni" ≠ "Negroni").
 *   mode 'override' — a human picked it; always plausible.
 */
export function namePlausible(itemName, title, mode = 'exact') {
  if (mode === 'override') return true;
  const a = tokens(cleanName(itemName));
  const b = tokens(baseTitle(title));
  if (!a.length || !b.length) return false;
  const A = new Set(a);
  const B = new Set(b);
  const aInB = a.every((t) => B.has(t));
  const bInA = b.every((t) => A.has(t));
  if (mode === 'search') return aInB;
  // A redirect to a spelling variant ("Shakshuka" → "Shakshouka",
  // "Osso Buco" → "Ossobuco") is the same dish.
  return aInB || bInA || similarity(cleanName(itemName), baseTitle(title)) >= 0.8;
}

/**
 * Full acceptance test for a REST summary. Returns { ok, reason }.
 */
export function acceptSummary(itemName, summary, mode = 'exact') {
  if (!summary || !summary.title) return { ok: false, reason: 'missing' };
  if (summary.type === 'disambiguation') return { ok: false, reason: 'disambiguation' };
  if (/\(disambiguation\)/i.test(summary.title)) return { ok: false, reason: 'disambiguation' };
  if (!isFoodPage(summary)) return { ok: false, reason: 'not-food' };
  if (!namePlausible(itemName, summary.title, mode)) return { ok: false, reason: 'name-mismatch' };
  return { ok: true, reason: mode };
}

// ── Text ──────────────────────────────────────────────────────────────

const ABBREV = /\b(?:St|Mr|Mrs|Dr|Mt|Jr|Sr|ca|c|approx|vs|etc|e\.g|i\.e|U\.S|No|Fr|lit)\.$/i;

/** Split prose into sentences without breaking on common abbreviations. */
/** Tidy extract residue: " ," → ",", empty "( ; )" left by stripped pronunciations. */
export function tidyText(text = '') {
  return String(text)
    .replace(/\(\s*[;,]?\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function splitSentences(text = '') {
  const t = tidyText(text);
  if (!t) return [];
  const out = [];
  let start = 0;
  const re = /[.!?]["”’)]?\s+(?=[A-Z"“(])/g;
  let m;
  while ((m = re.exec(t))) {
    const end = m.index + m[0].trimEnd().length;
    const chunk = t.slice(start, end);
    if (ABBREV.test(chunk.trim()) || /\b[A-Z]\.$/.test(chunk.trim())) continue;
    out.push(chunk.trim());
    start = m.index + m[0].length;
  }
  if (start < t.length) out.push(t.slice(start).trim());
  return out.filter(Boolean);
}

/** First `n` sentences, no longer than `max` characters (word-boundary trim). */
export function firstSentences(text, n = 2, max = 300) {
  const s = splitSentences(text);
  if (!s.length) return '';
  let out = s[0];
  for (let i = 1; i < n && i < s.length; i++) {
    if ((out + ' ' + s[i]).length > max) break;
    out += ' ' + s[i];
  }
  if (out.length > max) {
    const cut = out.slice(0, max - 1);
    out = cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
  }
  return out;
}

// ── Images & licences ─────────────────────────────────────────────────

/**
 * From a lead-image URL, the Commons file name — or null when the file is
 * hosted on enwiki itself (/wikipedia/en/…), which is where non-free
 * ("fair use") images live.
 */
export function commonsFileFromUrl(url = '') {
  const m = String(url).match(/\/wikipedia\/(commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/);
  if (!m || m[1] !== 'commons') return null;
  try { return decodeURIComponent(m[2]); } catch { return m[2]; }
}

/** Free licences only: CC0, public domain, CC BY, CC BY-SA. No NC / ND. */
export function isFreeLicense(short = '') {
  const s = String(short).trim();
  if (!s) return false;
  if (/\b(nc|nd|non-?commercial|no ?deriv|fair use|non-?free)\b/i.test(s)) return false;
  return /^(cc0|cc[- ]zero|public domain|pd\b|pd-|cc[- ]by(-sa)?(\s|-|$)|cc[- ]by[- ]sa)/i.test(s);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Strip HTML tags and entities from a Commons metadata value. */
export function stripHtml(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (all, e) => {
      const k = e.toLowerCase();
      if (ENTITIES[k] != null) return ENTITIES[k];
      if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
      if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
      return all;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// "Own work" in a few languages, and unknown authors: a credit, not an artist.
const NOT_AN_ARTIST = /^(own work|trabajo propio|travail personnel|eigenes werk|opera propria|unknown( author)?|anonymous|author unknown)$/i;

/**
 * Short, clean artist credit (≤ 80 chars), or '' when Commons records no
 * real author (the caller then drops the photo).
 */
export function cleanArtist(html = '') {
  let s = stripHtml(html)
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/^(photo|photograph|author)\s*(by)?\s*:?\s*/i, '')
    // "No machine-readable author provided. Charbel assumed (based on …)"
    .replace(/^No machine-readable author provided\.\s*(\S+)\s+assumed.*$/i, '$1 (assumed)')
    .replace(/\s*The original uploader was.*$/i, '')
    // "User JayKeaton on English Wikipedia, http://…" → "JayKeaton"
    .replace(/^User[: ]\s*(\S+)\s+(on|at)\s+.*$/i, '$1')
    .replace(/^User:/i, '')
    // flickr profile URL as the whole credit → "name (Flickr)"
    .replace(/^https?:\/\/(?:www\.)?flickr\.com\/(?:people|photos)\/([^/\s]+)\/?$/i, '$1 (Flickr)')
    .replace(/https?:\/\/\S+/g, '')
    // wiki-link residue: "( w:en:User:Double.reed )", talk-page links
    .replace(/\(\s*[^()]*\b(w:|User:|talk)[^()]*\)/gi, '')
    .split(/\s+/).filter((t) => !/[\u0590-\u06ff]/.test(t)).join(' ')
    .replace(/\s+,/g, ',')
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/[\s,;:.]+$/, '')
    .trim();
  // "Unknown author Unknown author" → "Unknown author"
  const half = s.length / 2;
  if (s.length > 3 && s.length % 2 === 1 && s.slice(0, half - 0.5) === s.slice(half + 0.5)) s = s.slice(0, half - 0.5);
  if (NOT_AN_ARTIST.test(s)) return '';
  if (s.length > 80) s = s.slice(0, 79).replace(/\s+\S*$/, '') + '…';
  return s;
}
