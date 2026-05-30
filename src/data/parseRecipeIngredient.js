// MAKE-WEBLINK-MATCH (2026-05-30). Client-side ingredient line parser +
// fuzzy matcher. The scrapeRecipe Cloud Function already returns
// pre-parsed { raw, noun, quantity?, unit? } per ingredient, so the
// client mostly needs the matching half. parseIngredientLine is
// preserved here for robustness — if a future caller (paste-a-list,
// OCR import, etc.) hands us raw strings, the same algorithm applies.
//
// Algorithm:
//   1. parseIngredientLine: strip qty + known unit from the head of
//      the string, return { raw, noun, quantity?, unit? }.
//   2. matchIngredientName: fuse.js search the noun against the known
//      ingredient name list. Threshold 0.4, return { name, score,
//      confidence } where confidence = 1 - score (higher = better).
//      Returns null when confidence < 0.5.
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
 * Strip qty + known unit from the head of an ingredient line.
 * Returns { raw, noun, quantity?, unit? } — or null on empty input.
 */
export function parseIngredientLine(line) {
  const trimmed = String(line ?? '').trim();
  if (!trimmed) return null;
  const m = trimmed.match(QTY_UNIT_RE);
  if (!m) return { raw: trimmed, noun: trimmed };

  const [, qtyRaw, unitOrFirstWord, rest] = m;
  const quantity = qtyRaw ? parseFraction(qtyRaw) : undefined;
  if (unitOrFirstWord && KNOWN_UNITS.has(unitOrFirstWord.toLowerCase())) {
    const out = {
      raw: trimmed,
      noun: (rest.trim() || unitOrFirstWord).trim(),
      unit: unitOrFirstWord.toLowerCase(),
    };
    if (quantity != null) out.quantity = quantity;
    return out;
  }
  const noun = [unitOrFirstWord, rest].filter(Boolean).join(' ').trim() || trimmed;
  const out = { raw: trimmed, noun };
  if (quantity != null) out.quantity = quantity;
  return out;
}

const MATCH_THRESHOLD = 0.4;
const CONFIDENCE_FLOOR = 0.5;

/**
 * Fuzzy-match a single noun against a known-ingredient list.
 * @param {string} noun
 * @param {Array<string> | Fuse} knownNames - either a list of names, or
 *   a pre-built Fuse instance (saves the index-build on every call).
 * @returns {{name: string, score: number, confidence: number} | null}
 */
export function matchIngredientName(noun, knownNames) {
  const trimmed = String(noun ?? '').trim().toLowerCase();
  if (!trimmed) return null;
  const fuse = knownNames instanceof Fuse
    ? knownNames
    : new Fuse(knownNames || [], { threshold: MATCH_THRESHOLD, includeScore: true });
  const hits = fuse.search(trimmed, { limit: 1 });
  if (hits.length === 0) return null;
  const [hit] = hits;
  const score = typeof hit.score === 'number' ? hit.score : 1;
  const confidence = Math.max(0, 1 - score);
  if (confidence < CONFIDENCE_FLOOR) return null;
  return { name: hit.item, score, confidence };
}

/**
 * Batch wrapper. Accepts either parsed { raw, noun } objects (from
 * scrapeRecipe) or raw strings (parseIngredientLine internally).
 * Returns one entry per input with the match attached.
 *
 * @returns {Array<{input: string, parsed: {qty?, unit?, noun}, matched: string|null, score: number|null, confidence: number|null}>}
 */
export function matchRecipeIngredients(lines, knownNames) {
  if (!Array.isArray(lines) || lines.length === 0) return [];
  const fuse = new Fuse(knownNames || [], { threshold: MATCH_THRESHOLD, includeScore: true });
  return lines.map((item) => {
    const parsed = typeof item === 'string'
      ? parseIngredientLine(item)
      : (item && typeof item === 'object' ? item : null);
    if (!parsed) {
      return { input: String(item ?? ''), parsed: null, matched: null, score: null, confidence: null };
    }
    const noun = parsed.noun || parsed.raw || '';
    const m = matchIngredientName(noun, fuse);
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
