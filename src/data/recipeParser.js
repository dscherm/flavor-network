/**
 * Recipe ingredient parser — extract known ingredients from:
 * 1. Free-text recipe names (e.g., "Garlic Butter Shrimp Pasta")
 * 2. Pasted recipe text / ingredient lists
 *
 * Uses Fuse.js fuzzy matching against the known ingredient database.
 */
import Fuse from 'fuse.js';

// Common units and quantities to strip from ingredient lines
const UNITS = new Set([
  'tsp', 'tsps', 'teaspoon', 'teaspoons',
  'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
  'cup', 'cups', 'c',
  'oz', 'ounce', 'ounces',
  'lb', 'lbs', 'pound', 'pounds',
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters',
  'pt', 'pint', 'pints', 'qt', 'quart', 'quarts',
  'gal', 'gallon', 'gallons',
  'pinch', 'dash', 'handful', 'bunch', 'sprig', 'sprigs',
  'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces',
  'can', 'cans', 'jar', 'jars', 'package', 'pkg',
  'stick', 'sticks', 'head', 'heads',
  'small', 'medium', 'large', 'extra',
]);

// Words that appear in recipe text but aren't ingredients
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'with', 'and', 'or', 'in', 'on', 'to', 'for',
  'at', 'by', 'from', 'into', 'over', 'about', 'some', 'each', 'per',
  'fresh', 'freshly', 'dried', 'dry', 'ground', 'chopped', 'diced',
  'minced', 'sliced', 'grated', 'shredded', 'crushed', 'whole',
  'finely', 'roughly', 'coarsely', 'thinly',
  'optional', 'garnish', 'taste', 'needed', 'desired',
  'hot', 'cold', 'warm', 'room', 'temperature',
  'cooked', 'uncooked', 'raw', 'ripe', 'frozen', 'thawed',
  'peeled', 'seeded', 'pitted', 'trimmed', 'cored', 'halved',
  'boneless', 'skinless', 'organic', 'unsalted', 'salted',
  'recipe', 'style', 'homemade', 'store', 'bought',
]);

// Common cooking method words found in recipe names
const COOKING_WORDS = new Set([
  'baked', 'roasted', 'grilled', 'fried', 'sauteed', 'sautéed',
  'braised', 'steamed', 'poached', 'broiled', 'smoked', 'glazed',
  'stuffed', 'crusted', 'marinated', 'pan', 'stir', 'slow',
  'crispy', 'creamy', 'spicy', 'sweet', 'tangy', 'savory',
]);

// Regex to match leading quantity + unit in an ingredient line
// e.g., "2 cups flour" → { quantity: 2, unit: "cups", rest: "flour" }
// e.g., "1/2 tsp vanilla" → { quantity: 0.5, unit: "tsp", rest: "vanilla" }
const QTY_REGEX = /^(\d+\s*\/\s*\d+|\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*/;

/**
 * Parse a quantity string into a number.
 * Handles fractions (1/2), decimals (1.5), and ranges (2-3 → avg).
 * @param {string} str
 * @returns {number|null}
 */
export function parseQuantity(str) {
  if (!str) return null;
  const trimmed = str.trim();
  // Range: "2-3" → average
  if (/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(trimmed)) {
    const [lo, hi] = trimmed.split(/\s*-\s*/).map(Number);
    return (lo + hi) / 2;
  }
  // Fraction: "1/2"
  if (/^\d+\s*\/\s*\d+$/.test(trimmed)) {
    const [num, den] = trimmed.split(/\s*\/\s*/).map(Number);
    return den !== 0 ? num / den : null;
  }
  // Decimal or integer
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

/**
 * Extract quantity, unit, and remainder from a raw ingredient line.
 * @param {string} line - e.g., "2 cups fresh basil, chopped"
 * @returns {{ quantity: number|null, unit: string|null, rest: string, raw: string }}
 */
export function extractQuantityUnit(line) {
  const raw = line.trim();
  let text = raw
    .replace(/^[\s•\-*·▪►●○◆]\s*/, '')  // strip bullets
    .replace(/^\d+[\s.):-]+(?=\D)/, '')    // strip list numbers like "1. " or "1) "
    .trim();

  let quantity = null;
  let unit = null;

  // Try to match quantity
  const qtyMatch = text.match(QTY_REGEX);
  if (qtyMatch) {
    quantity = parseQuantity(qtyMatch[1]);
    text = text.slice(qtyMatch[0].length).trim();
  }

  // Try to match unit
  const words = text.split(/\s+/);
  if (words.length > 1 && UNITS.has(words[0].toLowerCase())) {
    unit = words[0].toLowerCase();
    text = words.slice(1).join(' ');
  }

  return { quantity, unit, rest: text, raw };
}

/**
 * Parse pasted recipe text and return structured ingredients with quantity/unit.
 * @param {string} text - Full recipe text or ingredient list
 * @param {Fuse} index - Fuse.js index built from ingredient list
 * @returns {Array<{ name: string, quantity: number|null, unit: string|null, raw: string }>}
 */
export function parseRecipeTextStructured(text, index) {
  const lines = text
    .split(/[\n\r]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const results = [];
  const seen = new Set();

  for (const line of lines) {
    const { quantity, unit, rest, raw } = extractQuantityUnit(line);
    const cleaned = cleanIngredientLine(rest);
    if (cleaned.length === 0) continue;

    // Try full cleaned phrase
    let matches = index.search(cleaned, { limit: 1 });
    if (matches.length > 0 && matches[0].score < 0.3) {
      const name = matches[0].item.name;
      if (!seen.has(name)) {
        seen.add(name);
        results.push({ name, quantity, unit, raw });
      }
      continue;
    }

    // Try subphrases
    const words = cleaned.split(/\s+/);
    let foundInLine = false;
    for (let len = Math.min(words.length, 3); len >= 1; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        matches = index.search(phrase, { limit: 1 });
        if (matches.length > 0 && matches[0].score < 0.25) {
          const name = matches[0].item.name;
          if (!seen.has(name)) {
            seen.add(name);
            results.push({ name, quantity, unit, raw });
            foundInLine = true;
          }
        }
      }
      if (foundInLine) break;
    }
  }

  return results;
}

/**
 * Build a Fuse.js index from the known ingredient list.
 * @param {string[]} ingredientList - Array of known ingredient names
 * @returns {Fuse}
 */
export function buildIngredientIndex(ingredientList) {
  const docs = ingredientList.map((name) => ({ name }));
  return new Fuse(docs, {
    keys: ['name'],
    threshold: 0.3,
    includeScore: true,
  });
}

/**
 * Clean a text line: strip quantities, units, and prep instructions.
 * "2 cups fresh basil, chopped" → "basil"
 * @param {string} line
 * @returns {string}
 */
function cleanIngredientLine(line) {
  let text = line
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')       // remove brackets
    .replace(/[^\w\s,/-]/g, ' ')       // keep alphanumeric, spaces, commas, hyphens
    .replace(/\d+\/\d+/g, ' ')         // remove fractions like 1/2
    .replace(/\d+(\.\d+)?/g, ' ')      // remove numbers
    .replace(/\s+/g, ' ')
    .trim();

  // Remove units and stop words from the beginning
  const words = text.split(/[\s,]+/).filter((w) => {
    return w.length > 0 && !UNITS.has(w) && !STOP_WORDS.has(w);
  });

  return words.join(' ');
}

/**
 * Parse a recipe name into candidate ingredient phrases.
 * "Garlic Butter Shrimp Pasta" → ["garlic", "butter", "shrimp", "pasta", "garlic butter", ...]
 * @param {string} name
 * @returns {string[]}
 */
function tokenizeRecipeName(name) {
  const words = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !COOKING_WORDS.has(w) && !STOP_WORDS.has(w));

  const candidates = [];

  // Single words
  for (const w of words) {
    candidates.push(w);
  }

  // Bigrams (multi-word ingredients like "olive oil", "cream cheese")
  for (let i = 0; i < words.length - 1; i++) {
    candidates.push(`${words[i]} ${words[i + 1]}`);
  }

  // Trigrams
  for (let i = 0; i < words.length - 2; i++) {
    candidates.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  return candidates;
}

/**
 * Parse a recipe name and extract known ingredients via fuzzy match.
 * @param {string} recipeName - e.g., "Garlic Butter Shrimp Pasta"
 * @param {Fuse} index - Fuse.js index built from ingredient list
 * @returns {string[]} - Matched ingredient names (deduplicated)
 */
export function parseRecipeName(recipeName, index) {
  const candidates = tokenizeRecipeName(recipeName);
  const matched = new Set();

  for (const candidate of candidates) {
    const results = index.search(candidate, { limit: 1 });
    if (results.length > 0 && results[0].score < 0.25) {
      matched.add(results[0].item.name);
    }
  }

  return [...matched];
}

/**
 * Parse pasted recipe text (ingredient list) and extract known ingredients.
 * Handles common formats:
 *   - "2 cups flour"
 *   - "1/2 tsp vanilla extract"
 *   - "salt and pepper to taste"
 *   - Bullet/numbered lists
 *
 * @param {string} text - Full recipe text or ingredient list
 * @param {Fuse} index - Fuse.js index built from ingredient list
 * @returns {string[]} - Matched ingredient names (deduplicated)
 */
export function parseRecipeText(text, index) {
  // Split into lines, treating bullets/numbers as line separators
  const lines = text
    .split(/[\n\r]+/)
    .map((line) => line.replace(/^[\s•\-*·▪►●○◆]\s*/, '').trim()) // strip bullet chars
    .map((line) => line.replace(/^\d+[\s.):-]+/, '').trim())        // strip leading numbers
    .filter((line) => line.length > 0);

  const matched = new Set();

  for (const line of lines) {
    const cleaned = cleanIngredientLine(line);
    if (cleaned.length === 0) continue;

    // Try the full cleaned phrase first
    let results = index.search(cleaned, { limit: 1 });
    if (results.length > 0 && results[0].score < 0.3) {
      matched.add(results[0].item.name);
      continue;
    }

    // Try subphrases (bigrams, trigrams, then single words)
    const words = cleaned.split(/\s+/);

    // Try multi-word combinations (longer first — more specific)
    let foundInLine = false;
    for (let len = Math.min(words.length, 3); len >= 1; len--) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        results = index.search(phrase, { limit: 1 });
        if (results.length > 0 && results[0].score < 0.25) {
          matched.add(results[0].item.name);
          foundInLine = true;
        }
      }
      if (foundInLine) break;
    }
  }

  return [...matched];
}

/**
 * Convenience: parse any text input and return matched ingredients.
 * Auto-detects whether input is a recipe name (single line, short)
 * or a full recipe text (multi-line or long).
 *
 * @param {string} input - Recipe name, ingredient list, or recipe text
 * @param {Fuse} index - Fuse.js index built from ingredient list
 * @returns {string[]} - Matched ingredient names (deduplicated)
 */
export function parseIngredients(input, index) {
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];

  const lineCount = trimmed.split(/[\n\r]+/).filter((l) => l.trim().length > 0).length;

  // Single short line → treat as recipe name
  if (lineCount === 1 && trimmed.length < 80) {
    return parseRecipeName(trimmed, index);
  }

  // Multi-line or long → treat as recipe text
  return parseRecipeText(trimmed, index);
}
