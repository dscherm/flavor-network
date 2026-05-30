// MAKE-WEBLINK-FN (2026-05-30). JSON-LD recipe parser. Lifted from
// bookstrapCB (D:/Projects/bookstrapCB/functions/src/scrape/parser.ts)
// and slimmed: returns ingredients with both `raw` (original line) and
// `noun` (qty+unit stripped) so the client-side matcher can fuzzy-match
// against the known ingredient dictionary. Instructions, yield, time,
// author — dropped (flavor-network doesn't render them).

import type { ParsedIngredient } from './types';

const JSON_LD_RE =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

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
    title: String(node.name ?? '').trim(),
    ingredients: normalizeIngredients(node.recipeIngredient ?? node.ingredients),
  };
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
      return parseIngredientLine(line);
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
