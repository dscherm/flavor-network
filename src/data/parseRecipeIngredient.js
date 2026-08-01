// MAKE-WEBLINK-MATCH-V2 (2026-05-30). Client-side ingredient line parser +
// cascading fuzzy matcher. The scrapeRecipe Cloud Function returns
// pre-parsed { raw, noun, quantity?, unit? } per ingredient; the client
// re-runs the parse + match because real-world recipe lines pack
// modifiers into the noun ("light brown sugar, packed", "garlic paste
// (or 1 clove garlic, minced)", "4 (4-ounce) salmon fillets") that a
// single fuse.js query can't recover from.
//
// Algorithm:
//   1. parseIngredientLine: strip parenthetical content + tail
//      modifiers from raw line; pull qty + known unit off the head;
//      return { raw, noun, quantity?, unit? }.
//   2. matchIngredientName: cascade — try the noun against a list of
//      derived candidates (full, singularized, adjective-stripped,
//      form-stripped, last-token); pick highest confidence. Exact dict
//      hit short-circuits to confidence=1.0. Form-stripped candidate
//      only kept if it scores HIGHER than the full noun so canonical
//      compounds like "tomato paste" / "ginger paste" survive.
//   3. matchRecipeIngredients: batch wrapper for arrays.

import Fuse from 'fuse.js';

const QTY_UNIT_RE =
  /^\s*([\d./\s¼½¾⅓⅔⅛⅜⅝⅞]+)?\s*([a-zA-Z]+)?\s+(.*?)\s*$/;

const KNOWN_UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'g', 'gram', 'grams', 'kg', 'ml', 'l',
  'lb', 'lbs', 'pound', 'pounds', 'pinch', 'dash', 'clove', 'cloves',
  'sprig', 'sprigs', 'slice', 'slices', 'piece', 'pieces',
  // WEBLINK-6: container and count words. Without these, "2 cans tomato
  // paste" kept "cans" in the noun, so the only candidates were
  // "cans tomato paste" / "cans tomato" — never plain "tomato" — and it
  // matched "italian tomatoe". Measured on real recipe lines.
  'can', 'cans', 'package', 'packages', 'pkg', 'jar', 'jars', 'bottle',
  'bottles', 'box', 'boxes', 'bunch', 'bunches', 'head', 'heads',
  'stalk', 'stalks', 'stick', 'sticks', 'ear', 'ears', 'sheet', 'sheets',
  'quart', 'quarts', 'pint', 'pints', 'gallon', 'liter', 'liters',
]);

const UNICODE_FRACTIONS = {
  '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

// Trailing comma-tail modifiers that should be dropped from the noun
// before matching. "1 lb chicken, diced" → noun "chicken".
const TAIL_MODIFIERS = new Set([
  'packed', 'minced', 'peeled', 'diced', 'chopped', 'sliced',
  'divided', 'optional', 'softened', 'melted', 'grated', 'shredded',
  'crushed', 'mashed', 'cubed', 'halved', 'quartered', 'julienned',
  'finely chopped', 'roughly chopped', 'thinly sliced',
  'to taste', 'for serving', 'for garnish', 'plus more for greasing',
  'plus more for serving', 'plus more', 'room temperature',
  'at room temperature', 'cold', 'warm', 'hot', 'rinsed', 'drained',
  'rinsed and drained', 'thawed', 'frozen', 'fresh',
]);

// Leading qualifier adjectives that get stripped to expose the canonical
// noun. "light brown sugar" → "brown sugar"; "extra virgin olive oil"
// → "virgin olive oil" → "olive oil".
const LEADING_ADJECTIVES = new Set([
  'light', 'dark', 'fresh', 'raw', 'dried', 'ground', 'whole', 'large',
  'small', 'medium', 'extra', 'virgin', 'fine', 'coarse', 'kosher',
  'sea', 'hot', 'cold', 'warm', 'organic', 'free-range', 'all-purpose',
  'low-fat', 'fat-free', 'unsalted', 'salted', 'thick', 'thin', 'old',
  'young', 'baby', 'mini', 'jumbo', 'boneless', 'skinless', 'lean',
  'sweet', 'sour', 'spicy', 'mild', 'crushed', 'plain', 'pure',
  // WEBLINK-6: exposed by real recipe lines — "packed basil leaves" must
  // reduce to "basil", "mixed ripe tomatoes" to "tomatoes".
  'packed', 'ripe', 'mixed', 'rustic', 'freshly', 'roughly', 'finely',
  'thinly', 'coarsely', 'toasted', 'chopped', 'diced',
]);

// Trailing "form" / preparation nouns that can be stripped to expose
// the head ingredient — only when the stripped form scores BETTER than
// the unstripped form (preserves canonical "tomato paste", "ginger
// paste", etc.).
const FORM_SUFFIXES = new Set([
  'paste', 'powder', 'flakes', 'granules', 'fillets', 'fillet',
  'breast', 'breasts', 'thigh', 'thighs', 'leg', 'legs', 'wing', 'wings',
  'leaves', 'leaf', 'sprigs', 'sprig', 'cloves', 'clove', 'slices',
  'slice', 'pieces', 'piece', 'sticks', 'stick',
]);

/**
 * WEBLINK-6: is this token a shape/measure word rather than a food?
 * "cubes", "leaves", "pieces", "cup" describe how much or what form —
 * they must never stand alone as an ingredient candidate.
 */
function isShapeWord(token) {
  const t = String(token ?? '').toLowerCase();
  return FORM_SUFFIXES.has(t) || KNOWN_UNITS.has(t);
}

// WEBLINK-6: verbs and phrases that open a preparation clause. TAIL_MODIFIERS
// only matched a comma-tail EXACTLY, so real-world tails carrying any detail
// ("cut into bite-size pieces", "cut into 1 1/2-inch cubes", "plus more for
// seasoning") survived into the noun and left a shape word trailing. Match on
// the opening word instead, which covers the long tail of phrasings.
const PREP_CLAUSE_OPENERS = [
  'cut', 'torn', 'tear', 'trimmed', 'stemmed', 'seeded', 'cored', 'pitted',
  'husked', 'scrubbed', 'washed', 'patted', 'plus', 'preferably', 'ideally',
  'about', 'approximately', 'such', 'or', 'plus more', 'well', 'lightly',
  'roughly', 'finely', 'thinly', 'coarsely', 'freshly', 'very',
];

function isPrepClause(tail) {
  const t = String(tail ?? '').trim().toLowerCase();
  if (!t) return false;
  if (TAIL_MODIFIERS.has(t)) return true;
  const first = t.split(/\s+/)[0];
  if (PREP_CLAUSE_OPENERS.includes(first)) return true;
  // "…, minced" style single-word tails already covered by TAIL_MODIFIERS;
  // this catches "…, minced and drained" and similar compounds.
  return TAIL_MODIFIERS.has(first);
}

function parseFraction(s) {
  const t = String(s ?? '').trim();
  if (!t) return undefined;
  if (t.length === 1 && UNICODE_FRACTIONS[t] != null) return UNICODE_FRACTIONS[t];
  if (t.includes('/')) {
    const [a, b] = t.split('/').map((x) => Number(x.trim()));
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }
  const parts = t.split(/\s+/);
  if (parts.length === 2) {
    const whole = Number(parts[0]);
    const frac = parseFraction(parts[1]);
    if (Number.isFinite(whole) && frac != null) return whole + frac;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Strip parenthetical content and trailing comma-tail modifiers from a
 * raw ingredient line. "1 tablespoon light brown sugar, packed" →
 * "1 tablespoon light brown sugar"; "4 (4-ounce) salmon fillets" →
 * "4 salmon fillets"; "1 tsp garlic paste (or 1 clove garlic, minced)"
 * → "1 tsp garlic paste".
 */
function preprocessLine(line) {
  let s = String(line ?? '').trim();
  if (!s) return '';
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  // WEBLINK-6: strip EVERY trailing prep clause, not just the last one and
  // not only on an exact TAIL_MODIFIERS hit. "…bread, cut into cubes" and
  // "…tomatoes, cut into bite-size pieces" both used to survive intact.
  let lastComma = s.lastIndexOf(',');
  while (lastComma > 0 && isPrepClause(s.slice(lastComma + 1))) {
    s = s.slice(0, lastComma).trim();
    lastComma = s.lastIndexOf(',');
  }
  return s;
}

/**
 * Strip qty + known unit from the head of a (preprocessed) line.
 * Returns { raw, noun, quantity?, unit? } — or null on empty input.
 */
export function parseIngredientLine(line) {
  const original = String(line ?? '').trim();
  if (!original) return null;
  const cleaned = preprocessLine(original);
  if (!cleaned) return null;
  const m = cleaned.match(QTY_UNIT_RE);
  if (!m) return { raw: original, noun: cleaned };

  const [, qtyRaw, unitOrFirstWord, rest] = m;
  const quantity = qtyRaw ? parseFraction(qtyRaw) : undefined;
  if (unitOrFirstWord && KNOWN_UNITS.has(unitOrFirstWord.toLowerCase())) {
    const out = {
      raw: original,
      noun: (rest.trim() || unitOrFirstWord).trim(),
      unit: unitOrFirstWord.toLowerCase(),
    };
    if (quantity != null) out.quantity = quantity;
    return out;
  }
  const noun = [unitOrFirstWord, rest].filter(Boolean).join(' ').trim() || cleaned;
  const out = { raw: original, noun };
  if (quantity != null) out.quantity = quantity;
  return out;
}

const MATCH_THRESHOLD = 0.4;
const CONFIDENCE_FLOOR = 0.5;

function singularize(word) {
  if (!word || word.length < 4) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  // WEBLINK-6: "-oes" plurals lose both letters — tomatoes -> tomato,
  // potatoes -> potato. The generic trailing-s rule below produced
  // "tomatoe", which then matched a malformed dictionary entry of the same
  // spelling at confidence 1.0, so a real recipe imported "tomatoe".
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('es') && /(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Generate ordered candidate strings to try matching, from most-specific
 * to most-general. Order matters for tie-breaking — earlier candidates
 * win when scores are equal.
 */
function deriveCandidates(noun) {
  const base = String(noun ?? '').trim().toLowerCase();
  if (!base) return [];
  const out = [];
  const push = (c) => {
    const t = c.trim();
    if (t && !out.includes(t)) out.push(t);
  };

  push(base);

  const tokens = base.split(/\s+/);
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const sing = singularize(last);
    if (sing !== last) {
      push([...tokens.slice(0, -1), sing].join(' '));
    }
  }

  let stripped = tokens.slice();
  while (stripped.length > 1 && LEADING_ADJECTIVES.has(stripped[0])) {
    stripped = stripped.slice(1);
    push(stripped.join(' '));
  }

  // WEBLINK-6: strip the form suffix from BOTH the original tokens and the
  // adjective-stripped form. Applying it only to the original meant
  // "packed basil leaves" yielded "packed basil" but never plain "basil",
  // so the best available candidate lost to "thai basil leave" at 0.69.
  for (const variant of [tokens, stripped]) {
    if (variant.length > 1) {
      const last = variant[variant.length - 1];
      const sing = singularize(last);
      if (FORM_SUFFIXES.has(last) || FORM_SUFFIXES.has(sing)) {
        push(variant.slice(0, -1).join(' '));
      }
    }
  }

  // WEBLINK-6 (2026-08-01): the bare last token is a useful last resort for
  // lines like "rustic sourdough bread" -> "bread", but ONLY when that token
  // names a food. When the line ends in a shape or measure word the candidate
  // becomes "pieces" / "cubes" / "leaves", and those fuzzy-match unrelated
  // dictionary entries at crushing confidence — measured against the real
  // 3,891-name list: pieces -> "allspice" (0.76), cubes -> "cubed cheese"
  // (0.99), leaves -> "leaves lettuce" (0.99). A Panzanella imported as
  // allspice + cubed cheese + lettuce, with tomato/bread/basil all present in
  // the dictionary and never chosen.
  //
  // This module already classifies these words as FORM_SUFFIXES and strips
  // them above to expose the head noun; offering them as ingredients two
  // blocks later contradicts that. A shape word is never the ingredient.
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const sing = singularize(last);
    if (!isShapeWord(last) && !isShapeWord(sing)) {
      push(last);
      if (sing !== last) push(sing);
    }
  }

  return out;
}

function buildMatchIndex(knownNames) {
  const list = (knownNames || []).map((n) => String(n));
  return {
    fuse: new Fuse(list, { threshold: MATCH_THRESHOLD, includeScore: true }),
    exactSet: new Set(list.map((n) => n.toLowerCase())),
    canonicalByLower: new Map(list.map((n) => [n.toLowerCase(), n])),
  };
}

/**
 * Fuzzy-match a single noun against a known-ingredient list using a
 * cascade of derived candidates. Exact dict-key hit short-circuits to
 * confidence=1.0. Form-stripped candidates (e.g. "garlic" derived from
 * "garlic paste") only win if they score strictly higher than the full
 * noun — preserves canonical compounds like "tomato paste".
 *
 * @param {string} noun
 * @param {Array<string> | {fuse, exactSet, canonicalByLower}} knownOrIndex
 * @returns {{name: string, score: number, confidence: number} | null}
 */
export function matchIngredientName(noun, knownOrIndex) {
  const trimmed = String(noun ?? '').trim().toLowerCase();
  if (!trimmed) return null;

  const index = (knownOrIndex && typeof knownOrIndex === 'object' && knownOrIndex.fuse)
    ? knownOrIndex
    : buildMatchIndex(knownOrIndex);

  const candidates = deriveCandidates(trimmed);
  if (candidates.length === 0) return null;

  let best = null;
  let baseConfidence = 0;
  candidates.forEach((cand, idx) => {
    if (index.exactSet.has(cand)) {
      const canonical = index.canonicalByLower.get(cand) || cand;
      const hit = { name: canonical, score: 0, confidence: 1, candidate: cand, idx };
      if (idx === 0) baseConfidence = 1;
      if (!best || hit.confidence > best.confidence) best = hit;
      return;
    }
    const hits = index.fuse.search(cand, { limit: 1 });
    if (hits.length === 0) return;
    const [hit] = hits;
    const score = typeof hit.score === 'number' ? hit.score : 1;
    const confidence = Math.max(0, 1 - score);
    if (idx === 0) baseConfidence = confidence;
    if (!best || confidence > best.confidence) {
      best = { name: hit.item, score, confidence, candidate: cand, idx };
    }
  });

  if (!best) return null;

  // Form-stripped / generalized candidates (idx > 0) only win on STRICT
  // improvement. Ties go to the more-specific full noun so canonical
  // compounds ("tomato paste", "ginger paste", "red wine vinegar")
  // aren't collapsed to their head word.
  if (best.idx > 0 && best.confidence <= baseConfidence + 1e-6) {
    if (baseConfidence >= CONFIDENCE_FLOOR) {
      const baseHit = index.fuse.search(candidates[0], { limit: 1 })[0];
      if (baseHit) {
        const score = typeof baseHit.score === 'number' ? baseHit.score : 1;
        return { name: baseHit.item, score, confidence: Math.max(0, 1 - score) };
      }
    }
  }

  if (best.confidence < CONFIDENCE_FLOOR) return null;
  return { name: best.name, score: best.score, confidence: best.confidence };
}

/**
 * Batch wrapper. Accepts either parsed { raw, noun } objects (from
 * scrapeRecipe) or raw strings (parseIngredientLine internally).
 * Returns one entry per input with the match attached.
 *
 * @returns {Array<{input: string, parsed: {qty?, unit?, noun}|null, matched: string|null, score: number|null, confidence: number|null}>}
 */
export function matchRecipeIngredients(lines, knownNames) {
  if (!Array.isArray(lines) || lines.length === 0) return [];
  const index = buildMatchIndex(knownNames);
  return lines.map((item) => {
    let parsed = null;
    if (typeof item === 'string') {
      parsed = parseIngredientLine(item);
    } else if (item && typeof item === 'object') {
      // Re-run preprocess/parse on the raw line if present — the server
      // emits noun=untouched, which keeps parentheticals + tail modifiers.
      if (typeof item.raw === 'string' && item.raw.trim()) {
        parsed = parseIngredientLine(item.raw);
      } else {
        parsed = item;
      }
    }
    if (!parsed) {
      return { input: String(item ?? ''), parsed: null, matched: null, score: null, confidence: null };
    }
    const noun = parsed.noun || parsed.raw || '';
    const m = matchIngredientName(noun, index);
    return {
      input: parsed.raw || noun,
      parsed: {
        noun,
        ...(parsed.quantity != null ? { quantity: parsed.quantity } : {}),
        ...(parsed.unit ? { unit: parsed.unit } : {}),
      },
      matched: m?.name ?? null,
      score: m?.score ?? null,
      confidence: m?.confidence ?? null,
    };
  });
}
