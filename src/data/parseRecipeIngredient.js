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
  const lastComma = s.lastIndexOf(',');
  if (lastComma > 0) {
    const tail = s.slice(lastComma + 1).trim().toLowerCase();
    if (TAIL_MODIFIERS.has(tail)) {
      s = s.slice(0, lastComma).trim();
    }
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

  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const sing = singularize(last);
    if (FORM_SUFFIXES.has(last) || FORM_SUFFIXES.has(sing)) {
      push(tokens.slice(0, -1).join(' '));
    }
  }

  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    push(last);
    const sing = singularize(last);
    if (sing !== last) push(sing);
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
