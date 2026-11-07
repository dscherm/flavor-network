/**
 * myBar.js — "My bar": the bottles and fresh ingredients a user has, kept
 * per device, and "what can I make" with them.
 *
 * Storage: localStorage key `fn-my-bar` (JSON array of ingredient keys).
 * Every read and write is wrapped — private windows and blocked storage
 * give an empty bar, never an error.
 *
 * Keys are the same keys the riff panel uses (src/data/cocktailRiff.js
 * riffRows): the ingredient-graph name when the line resolves, else the
 * normalised text. A bar entry and a recipe line therefore compare as
 * plain strings.
 *
 * Coverage rules (coverCocktail):
 *  - Trivial lines (water, ice, soda, sugar — isTrivialIngredient) and
 *    garnish-only lines (a peel, twist, wheel or wedge) are not counted.
 *  - A line is covered by the same key, by a plain-language equivalent
 *    ("lemon" in a recipe is lemon juice; "syrup" is simple syrup; any
 *    bitters cover a line that just says "bitters"), or — for a base
 *    spirit only — by another spirit of the same family (familyKey: any
 *    whiskey for a whiskey, any rum for a rum, tequila for mezcal; never
 *    vodka for gin, since those are different families). Such lines are
 *    reported as substitutions ("with rye instead of bourbon").
 *  - Exactly one uncovered line = "one away"; we name it and, if the bar
 *    holds something that plays the same role, suggest it.
 */
import { resolveIngredientName, isTrivialIngredient } from './recipePairingMatch.js';
import { riffRows, roleOf, familyKey, swapCandidates } from './cocktailRiff.js';
import { ingredientKind } from './cocktailInvent.js';
import { normalizeIngredient } from './normalizeIngredient.js';

export const MY_BAR_KEY = 'fn-my-bar';

const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

function defaultStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** Read the bar. Missing / unreadable / malformed storage → []. */
export function loadBar(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(MY_BAR_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === 'string' && x.trim()))] : [];
  } catch {
    return [];
  }
}

/** Write the bar. Returns false when storage is unavailable. */
export function saveBar(items, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(MY_BAR_KEY, JSON.stringify(items || []));
    return true;
  } catch {
    return false;
  }
}

// Recipe lines that resolve to a word too generic to stand for a bottle
// ("coffee liqueur" → "liqueur") keep their own text instead.
const GENERIC_KEYS = new Set(['liqueur', 'fruit', 'juice', 'spirit']);
const LIQUEUR_WORDS = /\bsloe\b|liqueur|\bcream\b|schnapp/;

/** Bar / recipe key for free text: graph name when it resolves, else normalised text. */
export function barKey(raw, names = new Set()) {
  const text = stripAccents(raw).trim();
  if (!text) return '';
  const norm = normalizeIngredient(text) || text.toLowerCase();
  const resolved = resolveIngredientName(text, names);
  if (!resolved || (GENERIC_KEYS.has(resolved) && norm !== resolved)) return norm;
  // "Sloe gin" is a liqueur, not gin; "Irish cream" is not whiskey.
  if (resolved !== norm && LIQUEUR_WORDS.test(norm) && !LIQUEUR_WORDS.test(resolved)) return norm;
  return resolved;
}

export function addToBar(bar, raw, names) {
  const key = barKey(raw, names);
  if (!key || (bar || []).includes(key)) return bar || [];
  return [...(bar || []), key];
}

export function removeFromBar(bar, key) {
  return (bar || []).filter((x) => x !== key);
}

const GARNISH_LINE = /\b(peel|twist|wheel|wedge|slice|spiral|zest)\b/;
const SPIRIT_FAMILIES = new Set(['whiskey', 'rum', 'brandy', 'agave spirit', 'gin', 'vodka']);
// Spirit-family words that also appear in liqueurs and creams.
const NOT_A_SPIRIT = /sloe|liqueur|cream|schnapp|syrup|bitters|apricot brandy|cherry brandy/;

// Plain-language equivalents: a recipe line on the left is covered by any
// bar entry on the right.
const EQUIVALENT = {
  lemon: ['lemon juice'], 'lemon juice': ['lemon'],
  lime: ['lime juice'], 'lime juice': ['lime'],
  orange: ['orange juice'], 'orange juice': ['orange'],
  grapefruit: ['grapefruit juice'], 'grapefruit juice': ['grapefruit'],
  syrup: ['simple syrup', 'sugar syrup'], 'simple syrup': ['syrup', 'sugar syrup'],
  'sugar syrup': ['simple syrup', 'syrup'],
  'powdered sugar': ['simple syrup', 'syrup'],
  whisky: ['whiskey'], whiskey: ['whisky'],
};

/** Recipe lines that count toward coverage: { raw, name, key, role }. */
export function countedLines(cocktail, roles, names) {
  const out = [];
  const seen = new Set();
  for (const r of riffRows(cocktail, roles, names)) {
    if (!r.swappable || isTrivialIngredient(r.raw)) continue;
    const key = barKey(r.raw, names) || r.key;
    if (!key || seen.has(key) || isTrivialIngredient(key)) continue;
    if (GARNISH_LINE.test(normalizeIngredient(stripAccents(r.name)) || key)) continue;
    seen.add(key);
    out.push({ raw: r.raw, name: r.name, key, role: r.role, measure: r.measure, swappable: true });
  }
  return out;
}

function isSpiritKey(key, roles) {
  return SPIRIT_FAMILIES.has(familyKey(key)) && !NOT_A_SPIRIT.test(key) && (roleOf(key, roles) || 'spirit') === 'spirit';
}

/**
 * How does the bar cover one line?
 * @returns {{ covered: boolean, via?: string, substitution?: boolean }}
 */
export function coverLine(line, barSet, roles = {}) {
  if (barSet.has(line.key)) return { covered: true, via: line.key, substitution: false };
  for (const eq of EQUIVALENT[line.key] || []) if (barSet.has(eq)) return { covered: true, via: eq, substitution: false };
  if (line.role === 'bitter' && line.key === 'bitters') {
    for (const b of barSet) if (/bitters$/.test(b)) return { covered: true, via: b, substitution: false };
  }
  if (line.key === 'vermouth') {
    for (const b of barSet) if (/vermouth$/.test(b)) return { covered: true, via: b, substitution: false };
  }
  if (isSpiritKey(line.key, roles)) {
    const fam = familyKey(line.key);
    for (const b of barSet) {
      if (b !== line.key && isSpiritKey(b, roles) && familyKey(b) === fam) return { covered: true, via: b, substitution: true };
    }
  }
  return { covered: false };
}

/**
 * Bar entries grouped by role, as a pool for swapCandidates. With `like`
 * (a recipe line), only entries of the same role AND kind — soda for
 * tonic, lemon for lime, one sweet liqueur for another; never Campari for
 * Champagne or soda for egg white.
 */
export function barRolePool(bar, roles, like = null) {
  const pool = new Map();
  for (const key of bar || []) {
    const role = roleOf(key, roles);
    if (!role) continue;
    if (like && (role !== like.role || ingredientKind(key, role) !== ingredientKind(like.key, like.role))) continue;
    if (!pool.has(role)) pool.set(role, new Map());
    pool.get(role).set(key, 1);
  }
  return pool;
}

/**
 * Coverage of one cocktail by the bar.
 * @returns {{ cocktail, total, covered, missing: Array<line>, substitutions: Array<{from, to}>,
 *             suggestion: { for: string, use: string, reason: string } | null }}
 */
export function coverCocktail(cocktail, bar, { roles = {}, names = new Set(), pairingIndex = null } = {}) {
  const barSet = bar instanceof Set ? bar : new Set(bar || []);
  const lines = countedLines(cocktail, roles, names);
  const missing = [];
  const substitutions = [];
  for (const line of lines) {
    const c = coverLine(line, barSet, roles);
    if (!c.covered) missing.push(line);
    else if (c.substitution) substitutions.push({ from: line.key, to: c.via });
  }
  let suggestion = null;
  // A missing base spirit gets no stand-in: same-family spirits are already
  // covered above, and gin in a Rob Roy is a different drink, not a swap.
  if (missing.length === 1 && lines.length > 1 && !isSpiritKey(missing[0].key, roles)) {
    const pool = barRolePool([...barSet], roles, missing[0]);
    const idx = lines.indexOf(missing[0]);
    // swapCandidates excludes what is already in the drink and keeps the role.
    const cands = swapCandidates(lines, idx, pool, pairingIndex || { names: new Set(), strength: new Map() }, 1);
    if (cands.length) suggestion = { for: missing[0].key, use: cands[0].name, reason: cands[0].reason };
  }
  return { cocktail, total: lines.length, covered: lines.length - missing.length, missing, substitutions, suggestion };
}

/** "with rye instead of bourbon" (or "" when no substitution). */
export function substitutionText(substitutions) {
  if (!substitutions?.length) return '';
  return `with ${substitutions.map((s) => `${s.to} instead of ${s.from}`).join(', ')}`;
}

/**
 * Rank every cocktail by bar coverage.
 * @returns {{ make: Array<coverage>, oneAway: Array<coverage> }}
 *   make: every counted line covered (exact matches before family swaps);
 *   oneAway: exactly one line missing (those with a bar substitute first).
 */
export function whatCanIMake(cocktails, bar, ctx = {}) {
  if (!bar || (bar.size ?? bar.length) === 0) return { make: [], oneAway: [] };
  const barSet = bar instanceof Set ? bar : new Set(bar);
  const make = [];
  const oneAway = [];
  for (const c of cocktails || []) {
    const cov = coverCocktail(c, barSet, ctx);
    if (cov.total === 0) continue;
    if (cov.missing.length === 0) make.push(cov);
    else if (cov.missing.length === 1 && cov.total >= 2) oneAway.push(cov);
  }
  make.sort((a, b) => a.substitutions.length - b.substitutions.length || b.total - a.total || a.cocktail.name.localeCompare(b.cocktail.name));
  oneAway.sort((a, b) => (b.suggestion ? 1 : 0) - (a.suggestion ? 1 : 0) || b.covered - a.covered || a.cocktail.name.localeCompare(b.cocktail.name));
  return { make, oneAway };
}

/** The n ingredients that appear in the most cocktails (quick-add chips). */
export function commonBarIngredients(cocktails, roles, names, n = 20) {
  const counts = new Map();
  for (const c of cocktails || []) for (const l of countedLines(c, roles, names)) counts.set(l.key, (counts.get(l.key) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
}

/** Every key a recipe line can produce — the autocomplete vocabulary (one list per cocktail). */
export function barKeyLists(cocktails, roles, names) {
  return (cocktails || []).map((c) => countedLines(c, roles, names).map((l) => l.key));
}
