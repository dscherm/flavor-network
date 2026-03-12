/**
 * ingredientMatcher.js — fuzzy match OCR-extracted text against the 380+ known
 * ingredients using Fuse.js with custom scoring. Handles plurals, abbreviations
 * (tbsp, tsp), misspellings, and partial matches. Returns confidence scores.
 */
import Fuse from 'fuse.js';

// Common abbreviation → full word mappings
const ABBREVIATIONS = {
  'tbsp': 'tablespoon', 'tbs': 'tablespoon', 'tbl': 'tablespoon',
  'tsp': 'teaspoon', 'tsps': 'teaspoon',
  'oz': 'ounce', 'ozs': 'ounce',
  'lb': 'pound', 'lbs': 'pound',
  'pkg': 'package', 'pkgs': 'packages',
  'sm': 'small', 'med': 'medium', 'lg': 'large',
  'pt': 'pint', 'qt': 'quart', 'gal': 'gallon',
  'choc': 'chocolate', 'parm': 'parmesan', 'parmigiano': 'parmesan',
  'evoo': 'olive oil', 'xv': 'extra virgin',
  'chx': 'chicken', 'brn': 'brown', 'wht': 'white',
  'grn': 'green', 'blk': 'black', 'rd': 'red',
  'jalapeno': 'jalapeño', 'habanero': 'habanero',
  'cuke': 'cucumber', 'zuke': 'zucchini', 'zucc': 'zucchini',
  'tom': 'tomato', 'toms': 'tomato', 'mush': 'mushroom',
  'pep': 'pepper', 'pepps': 'pepper',
  'gar': 'garlic', 'gin': 'ginger',
  'cinn': 'cinnamon', 'nut': 'nutmeg',
  'cil': 'cilantro', 'pars': 'parsley',
};

// Simple pluralization rules to try singularizing words
const PLURAL_RULES = [
  { suffix: 'ies', replace: 'y' },      // berries → berry
  { suffix: 'ves', replace: 'f' },       // leaves → leaf
  { suffix: 'oes', replace: 'o' },       // tomatoes → tomato
  { suffix: 'ses', replace: 's' },       // molasses → molass (edge case)
  { suffix: 'es', replace: '' },         // oranges → orang → falls back
  { suffix: 's', replace: '' },          // lemons → lemon
];

/**
 * Try to singularize a word using simple rules.
 * Returns both original and singular form.
 * @param {string} word
 * @returns {string[]}
 */
function getSingularForms(word) {
  const forms = [word];
  const lower = word.toLowerCase();

  for (const rule of PLURAL_RULES) {
    if (lower.endsWith(rule.suffix) && lower.length > rule.suffix.length + 1) {
      forms.push(lower.slice(0, -rule.suffix.length) + rule.replace);
    }
  }

  return [...new Set(forms)];
}

/**
 * Expand abbreviations in a text string.
 * @param {string} text
 * @returns {string}
 */
function expandAbbreviations(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words
    .map((w) => ABBREVIATIONS[w] || w)
    .join(' ');
}

/**
 * Clean OCR text artifacts: fix common misreadings.
 * @param {string} text
 * @returns {string}
 */
function cleanOcrArtifacts(text) {
  return text
    .replace(/[|]/g, 'l')              // pipe → lowercase L
    .replace(/[{}]/g, '')               // stray braces
    .replace(/[~`^]/g, '')             // noise characters
    .replace(/\b0(?=[a-z])/gi, 'o')    // leading 0 before letters → o
    .replace(/\b1(?=[a-z])/gi, 'l')    // leading 1 before letters → l
    .replace(/rn/g, (m, offset, str) => {
      // "rn" is commonly misread as "m" — but only in likely contexts
      const word = str.slice(Math.max(0, offset - 3), offset + 4);
      if (/tu[rm]n|corn|barn|fern/.test(word)) return m; // keep real "rn"
      return m; // too risky to auto-correct, keep as-is
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a Fuse.js index optimized for ingredient matching with OCR text.
 * @param {string[]} ingredientList — array of known ingredient names
 * @returns {Fuse}
 */
export function buildMatcherIndex(ingredientList) {
  const docs = ingredientList.map((name) => ({
    name,
    lower: name.toLowerCase(),
  }));
  return new Fuse(docs, {
    keys: ['name', 'lower'],
    threshold: 0.4,
    includeScore: true,
    distance: 100,
    minMatchCharLength: 2,
  });
}

/**
 * Match a single OCR text line against the known ingredient index.
 * Tries multiple strategies: exact, expanded abbreviations, singular forms,
 * sub-phrases, cleaned OCR artifacts.
 *
 * @param {string} line — raw OCR text line (e.g., "2 tbsp chopped fresh basil")
 * @param {Fuse} index — Fuse.js index from buildMatcherIndex
 * @returns {{ name: string, confidence: number, raw: string } | null}
 */
export function matchIngredientLine(line, index) {
  const raw = line.trim();
  if (raw.length < 2) return null;

  // Clean the line: remove quantities, units, prep words
  let cleaned = raw
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[^\w\s,/'-]/g, ' ')
    .replace(/\d+\/\d+/g, ' ')
    .replace(/\d+(\.\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common quantity/prep words
  const stripWords = new Set([
    'tsp', 'tsps', 'teaspoon', 'teaspoons', 'tbsp', 'tbsps', 'tablespoon', 'tablespoons',
    'cup', 'cups', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
    'g', 'gram', 'grams', 'kg', 'ml', 'liter', 'liters',
    'pinch', 'dash', 'handful', 'bunch', 'sprig', 'sprigs',
    'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces',
    'can', 'cans', 'jar', 'jars', 'package', 'pkg',
    'small', 'medium', 'large', 'extra',
    'a', 'an', 'the', 'of', 'with', 'and', 'or', 'in', 'on', 'to', 'for',
    'fresh', 'freshly', 'dried', 'dry', 'ground', 'chopped', 'diced',
    'minced', 'sliced', 'grated', 'shredded', 'crushed', 'whole',
    'finely', 'roughly', 'coarsely', 'thinly',
    'optional', 'garnish', 'taste', 'needed', 'desired',
    'cooked', 'uncooked', 'raw', 'ripe', 'frozen', 'thawed',
    'peeled', 'seeded', 'pitted', 'trimmed', 'cored', 'halved',
    'boneless', 'skinless', 'organic', 'unsalted', 'salted',
  ]);

  const words = cleaned.split(/[\s,]+/).filter((w) => w.length > 0 && !stripWords.has(w));
  if (words.length === 0) return null;

  cleaned = words.join(' ');

  // Strategy 1: Try the cleaned phrase directly
  let best = tryMatch(cleaned, index);

  // Strategy 2: Try with abbreviations expanded
  const expanded = expandAbbreviations(cleaned);
  if (expanded !== cleaned) {
    const expandedMatch = tryMatch(expanded, index);
    if (expandedMatch && (!best || expandedMatch.score < best.score)) {
      best = expandedMatch;
    }
  }

  // Strategy 3: Try singular forms
  for (const word of words) {
    const singulars = getSingularForms(word);
    for (const singular of singulars) {
      if (singular === word) continue;
      const singularMatch = tryMatch(singular, index);
      if (singularMatch && (!best || singularMatch.score < best.score)) {
        best = singularMatch;
      }
    }
  }

  // Strategy 4: Try OCR artifact cleanup
  const ocrCleaned = cleanOcrArtifacts(cleaned);
  if (ocrCleaned !== cleaned) {
    const ocrMatch = tryMatch(ocrCleaned, index);
    if (ocrMatch && (!best || ocrMatch.score < best.score)) {
      best = ocrMatch;
    }
  }

  // Strategy 5: Try sub-phrases (bigrams, single words) for multi-word lines
  if (words.length > 1) {
    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const biMatch = tryMatch(bigram, index);
      if (biMatch && (!best || biMatch.score < best.score)) {
        best = biMatch;
      }
    }
    // Single words (last resort, only if no match yet)
    if (!best || best.score > 0.25) {
      for (const word of words) {
        if (word.length < 3) continue;
        const wordMatch = tryMatch(word, index);
        if (wordMatch && (!best || wordMatch.score < best.score)) {
          best = wordMatch;
        }
      }
    }
  }

  if (!best || best.score > 0.35) return null;

  // Convert Fuse score (0 = perfect, 1 = worst) to confidence (0-1, higher is better)
  const confidence = Math.max(0, Math.min(1, 1 - best.score));

  return {
    name: best.item.name,
    confidence,
    raw,
  };
}

/**
 * Try to match a phrase against the index.
 * @param {string} phrase
 * @param {Fuse} index
 * @returns {{ item: { name: string }, score: number } | null}
 */
function tryMatch(phrase, index) {
  const results = index.search(phrase, { limit: 1 });
  if (results.length === 0) return null;
  return { item: results[0].item, score: results[0].score };
}

/**
 * Match an array of OCR text lines against known ingredients.
 * Deduplicates by ingredient name, keeping the highest confidence match.
 *
 * @param {string[]} lines — OCR-extracted text lines
 * @param {string[]} ingredientList — known ingredient names
 * @returns {{ name: string, confidence: number, raw: string }[]} — sorted by confidence (highest first)
 */
export function matchOcrLines(lines, ingredientList) {
  const index = buildMatcherIndex(ingredientList);
  const matchMap = new Map(); // name → best match

  for (const line of lines) {
    const match = matchIngredientLine(line, index);
    if (!match) continue;

    const existing = matchMap.get(match.name);
    if (!existing || match.confidence > existing.confidence) {
      matchMap.set(match.name, match);
    }
  }

  return [...matchMap.values()].sort((a, b) => b.confidence - a.confidence);
}
