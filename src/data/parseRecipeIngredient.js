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
  // WEBLINK-7
  'crumbled', 'sauteed', 'sautéed', 'caramelized', 'toasted', 'cooked',
  'stemmed', 'seeded', 'cored', 'pitted', 'trimmed', 'torn',
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
  // WEBLINK-7
  'sliced', 'canned', 'soft', 'firm', 'grated', 'shredded', 'cooked',
  'skinless', 'boneless', 'ground', 'granulated', 'powdered', 'active',
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
  // WEBLINK-7: measured on a 102-line real-recipe corpus. "feta cheese"
  // must reduce to "feta" and "vanilla extract" to "vanilla", because the
  // dictionary carries the bare form and not the compound.
  'cheese', 'extract', 'crumbs', 'crumb', 'halves', 'halve',
  'florets', 'floret', 'chunks', 'chunk', 'wedges', 'wedge',
  'strips', 'strip', 'rounds', 'round', 'cubes', 'cube',
  'matchsticks', 'clumps', 'clump',
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
  // WEBLINK-7 — openers seen in the 102-line corpus.
  'cooked', 'crumbled', 'tossed', 'added', 'separated', 'broken',
  'stems', 'seeds', 'otherwise', 'divided', 'grated', 'shredded',
  'melted', 'softened', 'if', 'to', 'for', 'at', 'as',
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
  // WEBLINK-7: abbreviated units are routinely written with a period
  // ("2 tsp. vanilla extract", "6 oz. chocolate" — Bon Appétit's house
  // style). The unit regex matches [a-zA-Z]+ only, so "tsp." failed to
  // parse as a unit and stayed in the noun as "tsp. vanilla extract",
  // which matched nothing. Drop the period when the bare token is a unit.
  s = s.replace(/\b([a-zA-Z]+)\.(?=\s)/g, (m, word) =>
    KNOWN_UNITS.has(word.toLowerCase()) ? word : m);
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

  // WEBLINK-7: singularize a single-token noun too. This only ever handled
  // the last word of a MULTI-token noun, so a bare "mushrooms" never reached
  // "mushroom" — which is the form the dictionary carries.
  if (tokens.length === 1) {
    const sing = singularize(tokens[0]);
    if (sing !== tokens[0]) push(sing);
  }

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
    // WEBLINK-7: and its singularized form. Generating singulars only from
    // the raw tokens meant "large egg yolks" produced "large egg yolk" and
    // "egg yolks", but never "egg yolk" — the one the dictionary has. Under
    // the exact-only rule for dropped-token candidates that became a miss
    // where it had previously matched.
    const sLast = stripped[stripped.length - 1];
    const sSing = singularize(sLast);
    if (sSing !== sLast) push([...stripped.slice(0, -1), sSing].join(' '));
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

  // WEBLINK-7: the FIRST content token, last. English compounds usually put
  // the head last, which is why the last-token candidate exists — but
  // "panko bread crumbs" carries its identity up front, and the dictionary
  // has "panko" and not "bread crumbs". Safe to offer because dropped-token
  // candidates only win on an exact hit (see matchIngredientName).
  if (tokens.length > 1 && !isShapeWord(tokens[0]) && !LEADING_ADJECTIVES.has(tokens[0])) {
    push(tokens[0]);
  }

  return out;
}

/**
 * WEBLINK-7: does the matched name actually mention the noun's head word?
 *
 * English puts the head of a compound last — the head of "baby arugula" is
 * arugula, of "baking soda" is soda. A fuzzy match that shares only the
 * modifier ("baby eggplant", "baking potatoe") names a different food, and
 * is worse than no match at all.
 *
 * Compared both ways so plural/singular pairs still count as sharing:
 * head "tomatoes" vs match "tomato".
 */
function sharesHeadWord(noun, matchedName) {
  const tokens = String(noun ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const head = tokens[tokens.length - 1].replace(/[^a-z0-9-]/g, '');
  if (!head) return true;
  const headSing = singularize(head);
  const target = String(matchedName ?? '').toLowerCase();
  return target.includes(head) || target.includes(headSing)
    || head.includes(target) || headSing.includes(target);
}

/**
 * WEBLINK-13: heads that describe a FORM rather than an identity. For
 * "baking powder" / "olive oil" / "hot sauce", the head word is shared by
 * dozens of unrelated things and the modifier is what names the food.
 */
const GENERIC_HEADS = new Set([
  'powder', 'oil', 'sauce', 'juice', 'extract', 'flakes', 'paste',
  'syrup', 'vinegar', 'stock', 'broth', 'seasoning', 'blend', 'mix',
]);

/**
 * WEBLINK-13: is this noun nothing but a measurement?
 *
 * The heuristic parser emits table and nav fragments whenever it misfires on
 * a page that isn't a recipe — "lb.", "oz.", "cup", "head". Every one of
 * those is ALSO a real dictionary entry's neighbour, so they matched at high
 * confidence: lb. -> bilberry, oz. -> mozzarella, cup -> cupcake,
 * head -> arrowhead. A measurement is never an ingredient.
 */
function isUnitOnly(noun) {
  const tokens = String(noun ?? '')
    .toLowerCase()
    .replace(/[.,;:()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every(
    (t) => KNOWN_UNITS.has(t) || FORM_SUFFIXES.has(t) || /^[\d/¼½¾⅓⅔⅛⅜⅝⅞.-]+$/.test(t),
  );
}

/**
 * WEBLINK-13: for a generic head, require the modifier to agree too.
 *
 * "baking powder" is absent from the dictionary and "gelatin powder" is
 * present. They share the head "powder", so the WEBLINK-7 head-word guard
 * accepted it — but baking powder is not gelatin powder, and a wrong
 * leavening agent silently changes the recipe's computed profile.
 */
function modifiersAgree(noun, matchedName) {
  const tokens = String(noun ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return true;
  const head = tokens[tokens.length - 1].replace(/[^a-z0-9-]/g, '');
  if (!GENERIC_HEADS.has(head) && !GENERIC_HEADS.has(singularize(head))) return true;

  const target = String(matchedName ?? '').toLowerCase();
  // At least one non-generic, non-adjective modifier must survive into the
  // matched name, otherwise only the shared form word is doing the work.
  const modifiers = tokens
    .slice(0, -1)
    .map((t) => t.replace(/[^a-z0-9-]/g, ''))
    .filter((t) => t.length > 2 && !LEADING_ADJECTIVES.has(t) && !KNOWN_UNITS.has(t));
  if (modifiers.length === 0) return true;
  return modifiers.some((m) => target.includes(m) || target.includes(singularize(m)));
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
  // WEBLINK-13: a measurement is never an ingredient.
  if (isUnitOnly(trimmed)) return null;

  const index = (knownOrIndex && typeof knownOrIndex === 'object' && knownOrIndex.fuse)
    ? knownOrIndex
    : buildMatchIndex(knownOrIndex);

  const candidates = deriveCandidates(trimmed);
  if (candidates.length === 0) return null;

  // WEBLINK-7 (2026-08-01): a candidate produced by DROPPING tokens
  // (idx > 0 — adjective-stripped, form-stripped, last-token, first-token)
  // may only win on an EXACT dictionary hit. Generalizing is a fallback for
  // when the full phrase isn't known, not an upgrade over it.
  //
  // Previously a *fuzzy* hit on a dropped-token candidate could beat the
  // full noun, and fuzzy scores on short strings are enormous: "baking soda"
  // dropped to "soda", which fuzzy-matched "soda water" at 0.99 and won —
  // even though neither "baking soda" nor "soda" is in the dictionary and
  // the honest answer is no match. Same shape turned "vanilla extract" into
  // "lemon extract". The shorter the fragment, the more confidently wrong
  // the neighbour, which is precisely backwards.
  let best = null;
  candidates.forEach((cand, idx) => {
    if (index.exactSet.has(cand)) {
      const canonical = index.canonicalByLower.get(cand) || cand;
      // Ties go to the earlier (more specific) candidate: strict >.
      if (!best || 1 > best.confidence) {
        best = { name: canonical, score: 0, confidence: 1, candidate: cand, idx };
      }
      return;
    }
    // Fuzzy is only trusted on the full noun. A fuzzy hit on a fragment says
    // more about string length than about the ingredient.
    if (idx !== 0) return;
    const hits = index.fuse.search(cand, { limit: 1 });
    if (hits.length === 0) return;
    const [hit] = hits;
    // WEBLINK-7: a fuzzy match must share the noun's HEAD word. Without this
    // a shared leading adjective carries the whole match: "baking soda" ->
    // "baking potatoe", "baby arugula" -> "baby eggplant". Neither soda nor
    // arugula is in the dictionary, so the honest answer is no match, and
    // returning a different food silently changes the recipe's flavor
    // profile. It also correctly refuses "chicken thighs" -> "...chicken
    // breast", which is the wrong cut.
    if (!sharesHeadWord(cand, hit.item)) return;
    // WEBLINK-13: a shared GENERIC head is not enough — "baking powder" and
    // "gelatin powder" share "powder" and are different leavening agents.
    if (!modifiersAgree(cand, hit.item)) return;
    const score = typeof hit.score === 'number' ? hit.score : 1;
    const confidence = Math.max(0, 1 - score);
    if (!best || confidence > best.confidence) {
      best = { name: hit.item, score, confidence, candidate: cand, idx };
    }
  });

  if (!best) return null;
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
