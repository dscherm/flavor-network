/**
 * directionsQuality — pure quality checks for the RecipeNLG directions index
 * (WEAK-2).
 *
 * RecipeNLG's scraped "Gathered" rows sometimes carry another recipe's steps
 * ("Barbecue Wieners" — franks, mustard, vinegar — with "Wash turkey
 * thoroughly…"), repeat titles thousands of times, or have a title naming a
 * food their ingredient list lacks. These checks are used by the index
 * builder (flavor-gnn/scripts/fm_dir1_build_index.mjs), by the measurement
 * script (fm_dir1_measure.mjs) and, for title normalisation, by the kitchen
 * panel's one-per-title safety net. No I/O, no side effects.
 */

// ── Text helpers ──────────────────────────────────────────────────────────────

/** Lowercase, strip accents, split on anything that is not a letter/digit. */
function rawTokens(text) {
  return String(text ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]s\b/g, '')        // possessive: "mom's" → "mom"
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Nouns whose singular ends in -ie: cookies → cookie, not "cooky".
const IE_NOUNS = new Set(['cookie', 'brownie', 'pie', 'smoothie', 'veggie', 'hoagie', 'calorie', 'goodie', 'sweetie', 'birdie', 'tie', 'lie']);

/** Crude English singular: potatoes → potato, cherries → cherry, eggs → egg. */
export function singular(word) {
  const w = String(word || '');
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return IE_NOUNS.has(w.slice(0, -1)) ? w.slice(0, -1) : `${w.slice(0, -3)}y`;
  if (/(?:oes|ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return w;
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** Singularised word tokens of a text. */
export function tokens(text) {
  return rawTokens(text).map(singular);
}

/**
 * Normalised title key for de-duplication: lowercase, no accents, no
 * punctuation or possessives, "&" → "and", parentheticals dropped,
 * words singularised (so "Moms"/"Mom's" and "Cookie"/"Cookies" merge),
 * whitespace collapsed. "Mom's Chicken & Rice (Easy!)" → "mom chicken and rice".
 */
export function normalizeTitle(title) {
  const t = String(title ?? '').replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ');
  return rawTokens(t).map(singular).join(' ');
}

// ── Steps ↔ ingredients alignment ─────────────────────────────────────────────

// Words that never identify an ingredient on their own.
const GENERIC = new Set([
  'fresh', 'freshly', 'ground', 'large', 'small', 'medium', 'chopped', 'sliced', 'diced',
  'minced', 'dried', 'dry', 'frozen', 'canned', 'can', 'package', 'pkg', 'jar', 'box',
  'light', 'dark', 'whole', 'red', 'green', 'white', 'black', 'yellow', 'brown', 'golden',
  'hot', 'cold', 'warm', 'sweet', 'plain', 'regular', 'instant', 'quick', 'cooked',
  'uncooked', 'raw', 'lean', 'extra', 'fat', 'free', 'low', 'reduced', 'sodium', 'soft',
  'hard', 'firm', 'mild', 'sharp', 'grated', 'shredded', 'crushed', 'mixed', 'mix',
  'boneless', 'skinless', 'baby', 'young', 'old', 'fashioned', 'style', 'flavored',
  'flavor', 'pure', 'real', 'natural', 'organic', 'all', 'purpose', 'of', 'and', 'or',
  'with', 'the', 'for', 'in', 'to', 'a', 'oz', 'lb', 'cup', 'piece', 'pieces', 'stick',
  'top', 'bottom', 'part', 'half', 'whip', 'whipped', 'heavy', 'thick', 'thin', 'fine',
]);

/**
 * The token sequences that count as "mentioning" an ingredient in steps:
 * the full name, its head noun (last word), and any other non-generic word
 * of 4+ letters ("cream of mushroom soup" → that phrase, "soup", "cream",
 * "mushroom").
 * @returns {string[][]}
 */
export function ingredientTerms(name) {
  const toks = tokens(name);
  if (toks.length === 0) return [];
  const terms = [toks];
  const head = toks[toks.length - 1];
  if (toks.length > 1 && !GENERIC.has(head)) terms.push([head]);
  for (const t of toks.slice(0, -1)) {
    if (t.length >= 4 && !GENERIC.has(t)) terms.push([t]);
  }
  return terms;
}

function containsSeq(hay, seq) {
  if (seq.length === 1) return hay.set.has(seq[0]);
  const arr = hay.arr;
  outer: for (let i = 0; i + seq.length <= arr.length; i++) {
    for (let j = 0; j < seq.length; j++) if (arr[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
}

function haystack(text) {
  const arr = tokens(text);
  return { arr, set: new Set(arr) };
}

/**
 * How many of a recipe's ingredients its steps mention (by full name, head
 * noun or a significant word).
 * @param {string[]} steps
 * @param {string[]} names  ingredient names (NER or vocab names)
 * @returns {{ mentioned:number, total:number, frac:number }}
 */
export function stepMentions(steps, names) {
  const list = [...new Set((names || []).map((n) => String(n).toLowerCase().trim()).filter(Boolean))];
  const hay = haystack(Array.isArray(steps) ? steps.join(' ') : steps);
  let mentioned = 0;
  for (const n of list) {
    if (ingredientTerms(n).some((seq) => containsSeq(hay, seq))) mentioned++;
  }
  return { mentioned, total: list.length, frac: list.length ? mentioned / list.length : 0 };
}

/**
 * Steps belong to this ingredient list: they mention at least one
 * ingredient and at least `minFrac` (default a third) of them.
 */
export function stepsAligned(steps, names, { minFrac = 1 / 3 } = {}) {
  const m = stepMentions(steps, names);
  return m.mentioned >= 1 && m.frac >= minFrac;
}

// ── Title foods ───────────────────────────────────────────────────────────────

/**
 * Headline foods a title can name, keyed by the title word; `alts` are the
 * ingredient words that satisfy it; `meat` marks proteins whose appearance
 * in steps-but-not-ingredients betrays steps from another recipe.
 */
export const MAIN_FOODS = {
  chicken:   { alts: ['chicken', 'hen', 'poultry'], meat: true },
  beef:      { alts: ['beef', 'steak', 'chuck', 'brisket', 'sirloin', 'hamburger', 'roast', 'veal'], meat: true },
  hamburger: { alts: ['hamburger', 'beef', 'turkey', 'chuck'] },
  meatball:  { alts: ['meatball', 'beef', 'pork', 'turkey', 'hamburger', 'veal', 'sausage', 'meat'] },
  meatloaf:  { alts: ['beef', 'pork', 'turkey', 'hamburger', 'veal', 'sausage', 'meat'] },
  pork:      { alts: ['pork', 'ham', 'bacon', 'sausage', 'tenderloin', 'loin'], meat: true },
  ham:       { alts: ['ham', 'pork', 'prosciutto'], meat: true },
  bacon:     { alts: ['bacon', 'pancetta'], meat: true },
  sausage:   { alts: ['sausage', 'chorizo', 'kielbasa', 'bratwurst', 'andouille', 'pepperoni', 'salami'], meat: true },
  turkey:    { alts: ['turkey'], meat: true },
  lamb:      { alts: ['lamb', 'mutton'], meat: true },
  veal:      { alts: ['veal'], meat: true },
  venison:   { alts: ['venison', 'deer'] },
  duck:      { alts: ['duck', 'duckling'] },
  shrimp:    { alts: ['shrimp', 'prawn'], meat: true },
  salmon:    { alts: ['salmon'], meat: true },
  tuna:      { alts: ['tuna'], meat: true },
  crab:      { alts: ['crab', 'crabmeat'], meat: true },
  lobster:   { alts: ['lobster'], meat: true },
  clam:      { alts: ['clam'] },
  oyster:    { alts: ['oyster'] },
  scallop:   { alts: ['scallop'] },
  fish:      { alts: ['fish', 'cod', 'tilapia', 'halibut', 'catfish', 'trout', 'salmon', 'tuna', 'haddock', 'flounder', 'sole', 'bass', 'snapper', 'perch', 'pollock', 'whitefish', 'orange roughy', 'mahi'] },
  wiener:    { alts: ['wiener', 'frank', 'frankfurter', 'hot dog', 'hotdog'] },
  frank:     { alts: ['wiener', 'frank', 'frankfurter', 'hot dog', 'hotdog'] },
  bean:      { alts: ['bean', 'chickpea', 'garbanzo', 'pinto', 'kidney', 'lentil', 'edamame'] },
  lentil:    { alts: ['lentil'] },
  potato:    { alts: ['potato', 'potatoe', 'hash brown', 'tater', 'spud'] },
  chocolate: { alts: ['chocolate', 'cocoa', 'fudge', 'mocha', 'nutella'] },
  rice:      { alts: ['rice'] },
  spaghetti: { alts: ['spaghetti', 'pasta', 'noodle', 'linguine', 'vermicelli'] },
  macaroni:  { alts: ['macaroni', 'pasta', 'noodle', 'elbow'] },
  noodle:    { alts: ['noodle', 'pasta', 'spaghetti', 'macaroni', 'ramen', 'linguine', 'fettuccine', 'egg noodle'] },
  tofu:      { alts: ['tofu', 'bean curd'] },
};

// Title words that name a main food. Two-word forms come first.
const TITLE_FOOD_PHRASES = [
  ['hot dog', 'wiener'], ['frankfurter', 'frank'], ['hamburger', 'hamburger'], ['burger', 'hamburger'],
  ['meatball', 'meatball'], ['meatloaf', 'meatloaf'], ['meat loaf', 'meatloaf'],
];

/** The MAIN_FOODS keys a title names. "Barbecue Wieners" → ['wiener']. */
export function titleFoods(title) {
  const toks = tokens(title);
  const joined = ` ${toks.join(' ')} `;
  const out = new Set();
  for (const [phrase, key] of TITLE_FOOD_PHRASES) {
    if (joined.includes(` ${phrase} `)) out.add(key);
  }
  for (const t of toks) {
    if (MAIN_FOODS[t]) out.add(t);
  }
  // A title naming "hamburger"/"meatball" names its own meat; don't also
  // demand the bare word it contains.
  return [...out];
}

function namesHay(names) {
  return (names || []).map((n) => ` ${tokens(n).join(' ')} `);
}

/** Does any ingredient name contain one of the food's alt words/phrases? */
export function foodInNames(key, names) {
  const food = MAIN_FOODS[key];
  if (!food) return true;
  const hay = Array.isArray(names) && typeof names[0] === 'string' && names[0].startsWith(' ')
    ? names : namesHay(names);
  return food.alts.some((alt) => {
    const a = ` ${tokens(alt).join(' ')} `;
    return hay.some((h) => h.includes(a));
  });
}

/**
 * Which MAIN_FOODS keys the vocab can represent at all. A food the vocab
 * cannot represent (wieners/franks) can never appear in a mapped list, so
 * the title check falls back to the raw ingredient list for it.
 * @param {string[]} vocab
 * @returns {Set<string>}
 */
export function representableFoods(vocab) {
  const hay = namesHay(vocab);
  const out = new Set();
  for (const key of Object.keys(MAIN_FOODS)) if (foodInNames(key, hay)) out.add(key);
  return out;
}

/**
 * Title foods missing from the recipe's ingredients. A food the vocab can
 * represent must be in the mapped list (what the app shows); one it cannot
 * must at least be in the raw list (when given), otherwise it is skipped.
 * @param {string} title
 * @param {{ mapped:string[], raw?:string[], representable?:Set<string> }} lists
 * @returns {string[]}
 */
export function missingTitleFoods(title, { mapped = [], raw = null, representable = null } = {}) {
  const missing = [];
  for (const key of titleFoods(title)) {
    const canMap = representable ? representable.has(key) : true;
    if (canMap) {
      if (!foodInNames(key, mapped)) missing.push(key);
    } else if (Array.isArray(raw)) {
      if (!foodInNames(key, raw)) missing.push(key);
    }
  }
  return missing;
}

/**
 * Meats the steps cook that neither the ingredients nor the title mention —
 * "Wash turkey thoroughly" under a franks-and-mustard list.
 * @returns {string[]}
 */
export function foreignMeats(steps, title, names) {
  const hay = haystack(Array.isArray(steps) ? steps.join(' ') : steps);
  const titleSet = new Set(titleFoods(title));
  const nh = namesHay(names);
  const out = [];
  for (const [key, food] of Object.entries(MAIN_FOODS)) {
    if (!food.meat || !hay.set.has(key) || titleSet.has(key)) continue;
    if (!foodInNames(key, nh)) out.push(key);
  }
  return out;
}

// ── De-duplication ────────────────────────────────────────────────────────────

/** Deterministic 32-bit hash of an integer with a seed (for seeded sampling). */
export function seededHash(n, seed = 0) {
  let h = (Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed | 0, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function jaccard(a, b) {
  const sa = new Set(a); const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

/**
 * Completeness ordering for same-title variants: more mapped ingredients,
 * then more steps (capped at 10, so a 40-step essay doesn't win on length),
 * then better steps↔ingredients alignment, then a seeded tiebreak.
 */
export function compareCompleteness(a, b, seed = 0) {
  return (b.v.length - a.v.length)
    || (Math.min(b.nSteps ?? 0, 10) - Math.min(a.nSteps ?? 0, 10))
    || ((b.align ?? 0) - (a.align ?? 0))
    || (seededHash(a.r ?? 0, seed) - seededHash(b.r ?? 0, seed));
}

/**
 * Choose the variants of one normalised title to keep: the most complete,
 * plus up to `maxVariants - 1` more whose mapped ingredient sets overlap
 * every already-kept variant by at most `maxJaccard` (genuinely different
 * dishes under one name, e.g. a soup-based vs a rice-based "Chicken
 * Casserole").
 * @param {Array<{ r:number, v:number[], nSteps:number, align?:number }>} group
 */
export function pickTitleVariants(group, { maxVariants = 2, maxJaccard = 0.25, seed = 0 } = {}) {
  const sorted = [...(group || [])].sort((a, b) => compareCompleteness(a, b, seed));
  const kept = [];
  for (const rec of sorted) {
    if (kept.length >= maxVariants) break;
    if (kept.every((k) => jaccard(k.v, rec.v) <= maxJaccard)) kept.push(rec);
  }
  return kept;
}
