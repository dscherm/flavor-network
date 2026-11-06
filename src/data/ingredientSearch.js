/**
 * ingredientSearch.js — shared "search by ingredient" matching for the
 * Cocktail Lab and Sauce Lab browse lists.
 *
 * A query is one or more terms separated by commas or "+"
 * ("gin, lime" / "tomato + basil"). An item matches when EVERY term hits
 * either its name or one of its ingredients.
 *
 * Ingredient matching is word-based so "gin" finds "London dry gin" but
 * not "ginger beer". Terms of 4+ letters also match word prefixes, so a
 * half-typed "ging" already finds ginger.
 */

/** Lowercase, strip accents (Bénédictine → benedictine), collapse spaces. */
export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Crude singular form so "limes" / "tomatoes" / "berries" match their singulars. */
function singular(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function words(s) {
  return normalizeText(s).split(' ').filter(Boolean).map(singular);
}

/** Split a raw query into normalized terms. Empty query → []. */
export function parseQuery(query) {
  return String(query ?? '')
    .split(/[,+]/)
    .map((t) => normalizeText(t))
    .filter(Boolean);
}

/** Does one normalized term hit this ingredient string? */
export function termMatchesIngredient(term, ingredient) {
  const ingWords = words(ingredient);
  if (ingWords.length === 0) return false;
  const termWords = term.split(' ').map(singular);
  const allowPrefix = term.length >= 4;
  // Every word of the term must appear, in order, as consecutive words.
  for (let i = 0; i + termWords.length <= ingWords.length; i++) {
    let ok = true;
    for (let j = 0; j < termWords.length; j++) {
      const w = ingWords[i + j];
      const t = termWords[j];
      const last = j === termWords.length - 1;
      if (w === t) continue;
      if (last && allowPrefix && w.startsWith(t)) continue;
      ok = false;
      break;
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Match one item against parsed terms.
 * @returns {{ match: boolean, hits: string[] }} hits = the ingredients
 *   that matched some term (for "with lime juice" style row hints).
 */
export function matchItem({ name, ingredients }, terms) {
  if (!terms || terms.length === 0) return { match: true, hits: [] };
  const normName = normalizeText(name);
  const ings = (ingredients || []).filter(Boolean);
  const hits = [];
  for (const term of terms) {
    let termHit = false;
    for (const ing of ings) {
      if (termMatchesIngredient(term, ing)) {
        termHit = true;
        if (!hits.includes(ing)) hits.push(ing);
      }
    }
    if (!termHit && !normName.includes(term)) return { match: false, hits: [] };
  }
  return { match: true, hits };
}

/** Cocktail rows carry `ingredients_raw: [{ raw }]`; reduce to strings. */
export function cocktailIngredientNames(cocktail) {
  return (cocktail?.ingredients_raw || [])
    .map((i) => (typeof i === 'string' ? i : i?.raw))
    .filter(Boolean);
}

/**
 * Build a sorted, de-duplicated ingredient vocabulary for autocomplete.
 * Long free-text entries ("2 dashes of …") are dropped.
 */
export function buildIngredientVocab(ingredientLists, { maxWords = 4 } = {}) {
  const seen = new Map();
  for (const list of ingredientLists) {
    for (const ing of list || []) {
      const label = String(ing || '').trim();
      const key = normalizeText(label);
      if (!key || key.split(' ').length > maxWords) continue;
      if (!seen.has(key)) seen.set(key, label.toLowerCase());
    }
  }
  return [...seen.values()].sort();
}
