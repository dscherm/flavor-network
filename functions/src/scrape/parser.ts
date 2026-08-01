// MAKE-WEBLINK-FN (2026-05-30). JSON-LD recipe parser. Lifted from
// bookstrapCB (D:/Projects/bookstrapCB/functions/src/scrape/parser.ts)
// and slimmed: returns ingredients with both `raw` (original line) and
// `noun` (qty+unit stripped) so the client-side matcher can fuzzy-match
// against the known ingredient dictionary. Instructions, yield, time,
// author — dropped (flavor-network doesn't render them).

import type { ParsedIngredient, ParseStrategy, ParsedRecipe } from './types';

const JSON_LD_RE =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// ---------------------------------------------------------------------------
// HTML text normalization (WEBLINK-3)
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  frac13: '⅓',
  frac23: '⅔',
};

/**
 * WEBLINK-3: decode HTML entities.
 *
 * JSON-LD blocks routinely carry entity-encoded text, and it was reaching the
 * UI raw — real examples from live sites: "World&#39;s Best Lasagna",
 * "Homemade Pizza &amp; Pizza Dough". Decoding matters more than cosmetics
 * for ingredients: the client fuzzy-matches `noun` against the ingredient
 * dictionary, and an entity in the middle of a word blocks the match.
 *
 * `&amp;` is resolved last so an encoded ampersand ("&amp;#39;") doesn't
 * double-decode into an unrelated character.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input || !input.includes('&')) return input;
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name: string) => {
      const decoded = NAMED_ENTITIES[name.toLowerCase()];
      return decoded ?? m;
    })
    .replace(/&amp;/g, '&');
}

/** Strip tags, decode entities, collapse whitespace. */
function stripHtml(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Minimum ingredients before the class-name heuristic counts as a recipe.
 * A real recipe essentially always lists three or more; one or two hits from
 * pattern-matching on "ingredient" in a class name is far more likely noise.
 */
const MIN_HEURISTIC_INGREDIENTS = 3;

/** Ingredient lines shorter/longer than this are markup noise, not food. */
function isPlausibleIngredientLine(line: string): boolean {
  return line.length > 1 && line.length < 200;
}

function toIngredients(lines: string[]): ParsedIngredient[] {
  return dedupeLines(lines.filter(isPlausibleIngredientLine))
    .map((line) => parseIngredientLine(line))
    .filter((x): x is ParsedIngredient => x !== null && Boolean(x.noun));
}

interface JsonLdNode {
  '@type'?: string | string[];
  '@graph'?: JsonLdNode[];
  name?: string;
  recipeIngredient?: unknown;
  ingredients?: unknown;
  [key: string]: unknown;
}

export interface JsonLdRecipe {
  title: string;
  ingredients: ParsedIngredient[];
}

export function extractJsonLdRecipes(html: string): JsonLdNode[] {
  if (!html) return [];
  const recipes: JsonLdNode[] = [];
  for (const match of html.matchAll(JSON_LD_RE)) {
    const raw = match[1].trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    walkForRecipes(parsed, recipes);
  }
  return recipes;
}

function walkForRecipes(node: unknown, out: JsonLdNode[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walkForRecipes(item, out);
    return;
  }
  const obj = node as JsonLdNode;
  const t = obj['@type'];
  const types = Array.isArray(t) ? t : t ? [t] : [];
  if (types.some((x) => String(x).toLowerCase() === 'recipe')) {
    out.push(obj);
  }
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) walkForRecipes(item, out);
  }
}

export function jsonLdToRecipe(node: JsonLdNode): JsonLdRecipe {
  return {
    title: decodeHtmlEntities(String(node.name ?? '').trim()),
    ingredients: normalizeIngredients(node.recipeIngredient ?? node.ingredients),
  };
}

// ---------------------------------------------------------------------------
// Strategy 2: microdata (itemprop) — WEBLINK-3
// ---------------------------------------------------------------------------

/**
 * Extract ingredients from schema.org microdata attributes. Ported from the
 * client-side src/data/recipeScraper.js, which had these fallbacks all along
 * while the Cloud Function understood JSON-LD only.
 */
export function extractMicrodataIngredients(html: string): ParsedIngredient[] {
  if (!html) return [];
  const lines: string[] = [];

  // Element-content form: <li itemprop="recipeIngredient">1 cup flour</li>
  const contentRe = /itemprop\s*=\s*["']recipeIngredient["'][^>]*>([^<]+)/gi;
  for (const m of html.matchAll(contentRe)) {
    lines.push(stripHtml(m[1]));
  }

  // Attribute form: <meta itemprop="recipeIngredient" content="1 cup flour">
  const attrRe = /itemprop\s*=\s*["']recipeIngredient["'][^>]*content\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(attrRe)) {
    lines.push(stripHtml(m[1]));
  }

  return toIngredients(lines);
}

// ---------------------------------------------------------------------------
// Strategy 3: class/id heuristics — WEBLINK-3
// ---------------------------------------------------------------------------

/** Class-name patterns used by the common WordPress recipe plugins. */
const INGREDIENT_CLASS_PATTERNS = [
  /class\s*=\s*["'][^"']*wprm-recipe-ingredient[^"']*["'][^>]*>([\s\S]*?)<\//gi,
  /class\s*=\s*["'][^"']*tasty-recipe[^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\//gi,
  /class\s*=\s*["'][^"']*recipe-ingred[^"']*["'][^>]*>([\s\S]*?)<\//gi,
  /class\s*=\s*["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\//gi,
];

export function extractHeuristicIngredients(html: string): ParsedIngredient[] {
  if (!html) return [];
  const lines: string[] = [];

  for (const pattern of INGREDIENT_CLASS_PATTERNS) {
    for (const m of html.matchAll(pattern)) {
      lines.push(stripHtml(m[1]));
    }
  }

  // Nothing matched by class name — try <li> items inside any container whose
  // id or class mentions "ingredient".
  if (lines.filter(isPlausibleIngredientLine).length === 0) {
    const sectionRe =
      /(?:id|class)\s*=\s*["'][^"']*ingredient[^"']*["'][^>]*>([\s\S]*?)<\/(?:ul|ol|div|section)/gi;
    for (const section of html.matchAll(sectionRe)) {
      for (const li of section[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        lines.push(stripHtml(li[1]));
      }
    }
  }

  return toIngredients(lines);
}

// ---------------------------------------------------------------------------
// Title extraction — WEBLINK-3
// ---------------------------------------------------------------------------

/** Title fallback order: microdata name -> og:title -> <title>. */
export function extractTitle(html: string): string {
  if (!html) return '';

  const itemprop = html.match(/itemprop\s*=\s*["']name["'][^>]*>([^<]+)/i);
  if (itemprop) {
    const t = stripHtml(itemprop[1]);
    if (t) return t;
  }

  const og = html.match(
    /<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i,
  );
  if (og) {
    const t = stripHtml(og[1]);
    if (t) return t;
  }

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleTag) {
    const t = stripHtml(titleTag[1]);
    if (t) return t;
  }

  return '';
}

// ---------------------------------------------------------------------------
// Orchestrator — WEBLINK-3
// ---------------------------------------------------------------------------

/**
 * Try each extraction strategy in descending order of reliability and return
 * the first that yields a usable recipe.
 *
 * JSON-LD always wins when a Recipe node with ingredients exists — it is
 * structured data the site publishes deliberately, where the fallbacks are
 * inference over presentation markup. The fallbacks exist because a page can
 * fetch perfectly and still carry no schema.org block, which previously
 * failed outright with "No Recipe schema found".
 */
export function parseRecipeFromHtml(html: string): ParsedRecipe | null {
  if (!html) return null;

  for (const node of extractJsonLdRecipes(html)) {
    const r = jsonLdToRecipe(node);
    // Some sites emit several Recipe entries (a summary plus a detail); keep
    // looking until one carries both a title and ingredients.
    if (r.title && r.ingredients.length > 0) {
      return { ...r, strategy: 'json-ld' };
    }
  }

  const strategies: Array<[ParseStrategy, (html: string) => ParsedIngredient[], number]> = [
    // JSON-LD and microdata are things a site *declares*, so a single
    // ingredient is legitimate. The heuristic layer only pattern-matches on
    // class names, so one hit is far more likely to be a stray element than a
    // recipe. Observed live: a 404 page yielded exactly one "ingredient" and
    // was reported as a successful parse titled "Page not found".
    ['microdata', extractMicrodataIngredients, 1],
    ['heuristic', extractHeuristicIngredients, MIN_HEURISTIC_INGREDIENTS],
  ];

  for (const [strategy, extract, minIngredients] of strategies) {
    const ingredients = extract(html);
    if (ingredients.length >= minIngredients) {
      return {
        title: extractTitle(html) || 'Untitled Recipe',
        ingredients,
        strategy,
      };
    }
  }

  return null;
}

function normalizeIngredients(raw: unknown): ParsedIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ParsedIngredient | null => {
      let line: string;
      if (typeof item === 'string') {
        line = item;
      } else if (item && typeof item === 'object') {
        const o = item as { name?: string; text?: string };
        line = String(o.text ?? o.name ?? '');
      } else {
        return null;
      }
      // WEBLINK-3: entity-decode before parsing — the client fuzzy-matches
      // `noun` against the ingredient dictionary, and an embedded entity
      // ("jalape&ntilde;o") blocks the match.
      return parseIngredientLine(decodeHtmlEntities(line));
    })
    .filter((x): x is ParsedIngredient => x !== null && Boolean(x.noun));
}

const QTY_UNIT_RE =
  /^\s*([\d./\s¼½¾⅓⅔⅛⅜⅝⅞]+)?\s*([a-zA-Z]+)?\s+(.*?)\s*$/;

const KNOWN_UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'oz', 'ounce', 'ounces', 'g', 'gram', 'grams', 'kg', 'ml', 'l',
  'lb', 'lbs', 'pound', 'pounds', 'pinch', 'dash', 'clove', 'cloves',
  'sprig', 'sprigs', 'slice', 'slices', 'piece', 'pieces',
]);

function parseFraction(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const unicode: Record<string, number> = {
    '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };
  if (t.length === 1 && unicode[t] != null) return unicode[t];
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

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const m = trimmed.match(QTY_UNIT_RE);
  if (!m) return { raw: trimmed, noun: trimmed };

  const [, qtyRaw, unitOrFirstWord, rest] = m;
  const quantity = qtyRaw ? parseFraction(qtyRaw) : undefined;
  if (unitOrFirstWord && KNOWN_UNITS.has(unitOrFirstWord.toLowerCase())) {
    const out: ParsedIngredient = {
      raw: trimmed,
      noun: (rest.trim() || unitOrFirstWord).trim(),
      unit: unitOrFirstWord.toLowerCase(),
    };
    if (quantity != null) out.quantity = quantity;
    return out;
  }
  const noun = [unitOrFirstWord, rest].filter(Boolean).join(' ').trim() || trimmed;
  const out: ParsedIngredient = { raw: trimmed, noun };
  if (quantity != null) out.quantity = quantity;
  return out;
}
