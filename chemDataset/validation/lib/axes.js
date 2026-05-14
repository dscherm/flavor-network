// PURE: classifier predicates only. No perceptron inference, no weight reads beyond the hash-gate header.
//
// Surprise-axis classifiers. Each function returns boolean for whether a pair
// belongs to that axis. Used both for "which axis does this top-k pair surface
// against" and for filtering the ground-truth corpus when computing per-axis
// precision/recall.
//
// Inputs:
//   pair          — element of pairings.json (already-ranked output of 07-blend-v2.js)
//   gtSet         — Set<string> of ground-truth pair-keys (from canonicalPairKey)
//   ingredientMeta — map name -> { cuisines: string[], ... } from public/proDataset/ingredients.json
//   gnnEntropy    — map name -> { probs: {...}, topClass: string } | undefined
//
// Classifier names (the columns the audit report uses):
//   chem-bridged-rare
//   absent-from-books
//   cross-cuisine
//   cross-aroma
//
// Each classifier short-circuits when required metadata is unavailable and
// reports the missing data in the audit report header.

import { canonicalPairKey } from './metrics.js';

/**
 * TRIVIAL_COMPOUND_BLOCKLIST — compounds so ubiquitous across food that
 * their presence in a pair's sharedCompounds is no evidence of a real
 * chemistry bridge. Includes core metabolites, vitamins, minerals, and
 * universal fatty acids. A pair whose ONLY shared compounds are these
 * is excluded from the chem-bridged-rare axis. Real aroma compounds
 * (esters, aldehydes, terpenes, pyrazines, etc.) are never on this list.
 */
export const TRIVIAL_COMPOUND_BLOCKLIST = new Set([
  // Ubiquitous metabolites that fired the prior false positives.
  'Caffeine', 'Ethanol', 'L-Histidine', 'Theobromine', 'Succinic acid',
  // PubChem ID artifacts emitted by the GNN compound list.
  'CID 644104',
  // Minerals (always reported in foodb nutrient rows).
  'Calcium', 'Iron', 'Zinc', 'Potassium', 'Sodium', 'Magnesium', 'Copper',
  'Phosphorus', 'Manganese', 'Selenium',
  // Vitamins and cofactors (foodb nutrient rows).
  'Vitamin A', 'Vitamin D', 'Vitamin E', 'Vitamin K', 'Vitamin C',
  'Retinol', 'beta-Carotene', 'alpha-Tocopherol', 'Cholecalciferol',
  'Thiamine', 'Thiamine hydrochloride', 'Thiamine mononitrate',
  'Riboflavine', 'Riboflavin', 'Niacin', 'Nicotinic acid', 'Niacinamide',
  'Pyridoxine', 'Pyridoxal', 'Pyridoxamine', 'Cyanocobalamin',
  'Folate', 'Folic acid', 'Ascorbic acid', 'Pantothenic acid', 'Biotin',
  // Universal lipid/sterol entries.
  'Cholesterol', '(Z,Z)-9,12-Octadecadienoic acid',
  // Common amino acids (foodb amino-acid rows).
  'L-Tryptophan', 'L-Lysine', 'L-Leucine', 'L-Glutamine', 'L-Arginine',
  'L-Glutamic acid', 'L-Aspartic acid', 'L-Serine', 'L-Threonine',
  'L-Valine', 'L-Isoleucine', 'L-Phenylalanine', 'L-Tyrosine',
  'L-Methionine', 'L-Cysteine', 'L-Proline', 'L-Alanine', 'Glycine',
  'L-Asparagine',
]);

function nonTrivialShared(pair) {
  const shared = Array.isArray(pair.sharedCompounds) ? pair.sharedCompounds : [];
  for (const c of shared) {
    if (typeof c === 'string' && !TRIVIAL_COMPOUND_BLOCKLIST.has(c)) return c;
  }
  return null;
}

function curatedBridge(pair, bridgeCompounds) {
  if (!bridgeCompounds) return null;
  const key = canonicalPairKey(pair.ingredientA, pair.ingredientB);
  const entry = bridgeCompounds[key];
  if (!entry || !Array.isArray(entry.bridges)) return null;
  for (const b of entry.bridges) {
    if (b && typeof b.name === 'string' && !TRIVIAL_COMPOUND_BLOCKLIST.has(b.name)) {
      return b;
    }
  }
  return null;
}

/**
 * chem-bridged-rare: pair shares a RARE chemistry bridge.
 * A pair qualifies when it has either:
 *   - a curated entry in bridge_compounds.json with a non-trivial named
 *     bridge (the canonical 778-pair set with rarity scores), OR
 *   - sharedCompounds in pair.sharedCompounds containing at least one
 *     non-trivial named compound (esters, aldehydes, terpenes, pyrazines —
 *     anything off the metabolic / vitamin / mineral / amino-acid blocklist).
 *
 * The earlier predicate also required `pair.strength < 0.5` to express
 * "rare in corpus", but the ground-truth corpus labels canonical pairs
 * like `lemongrass + makrut lime leave` (Thai-canon, corpus-frequent) as
 * chem-bridged-rare — the axis is about COMPOUND RARITY, not CORPUS
 * rarity. Dropping the strength cutoff makes the axis match GT semantics.
 *
 * The trivial-compound blocklist eliminates the prior false-positive flood
 * (cake mix + mint chocolate chip, gingersnap + worcestershire sauce, etc.)
 * whose only "shared" compounds were ubiquitous metabolites (Caffeine,
 * Ethanol, L-Histidine, Theobromine, vitamins, minerals, amino acids).
 */
export function chemBridgedRare(pair, ctx) {
  if (!pair) return false;
  const bridgeCompounds = ctx && ctx.bridgeCompounds ? ctx.bridgeCompounds : null;
  if (curatedBridge(pair, bridgeCompounds)) return true;
  if (nonTrivialShared(pair)) return true;
  return false;
}

/**
 * RECIPE_ARTIFACT_NAME — detects names that are recipe-text artifacts
 * rather than culinary ingredients. The shipped dataset (derived from
 * RecipeNLG via PMI extraction) contains entries like `liquid butter`,
 * `fluid orange juice`, `tinned tomato`, `freshly orange zest`,
 * `celtic sea salt`, `cake mix`, `pumpkin pie filling`. These are
 * recipe-author phrasings, not pairings a cookbook would ever discuss.
 * They flood the absent-from-books axis at saturation strength because
 * the perceptron has no way to distinguish them from real ingredients.
 *
 * This filter is heuristic. It rejects qualifier-prefixed names (liquid,
 * blanched, brunoise, freshly, etc.), branded forms (celtic, kosher),
 * mix/seasoning/flavoring suffixes, and an explicit hand-curated list
 * of stubborn artifacts that the regex misses.
 */
const QUALIFIER_PREFIX_RE = /^(liquid|fluid|tinned|frozen|freshly|fresh chopped|chopped|sliced|diced|minced|blanched|brunoise|crusty|toasted|grated|whipped|powdered|carbonated|skinless|boneless|ground|dried|sweetened|unsweetened|drained|rinsed|peeled|cored|pitted|seedless|all-purpose|low-fat|low-sodium|fat-free|reduced|sugar-free|lite|crushed|stewed|canned|jarred|bottled|instant)\s/i;
const BRANDED_PREFIX_RE = /^(celtic|kosher|owens|hungry-man|hungry man|himalayan)\s/i;
const ARTIFACT_SUFFIX_RE = /(seasoning|flavoring|filling|mix|paste mix|powder mix|baking mix|cake mix|chocolate chip)$/i;
const EXPLICIT_ARTIFACT_NAMES = new Set([
  'all-purpose seasoning', 'lite salt', 'celtic sea salt',
  'parsley stem', 'brown chicken', 'mexicorn',
  'gingerbread mix', 'cake mix', 'pumpkin pie filling',
  'pumpkin pie spice', 'pizza sauce', 'mint chocolate chip',
  'cream of tarter', 'cream of tartar', 'gingersnap',
  'mushroom gravy mix', 'onion gravy mix', 'gravy mix',
]);

export function isRecipeArtifactName(name) {
  if (!name) return true;
  const n = String(name).toLowerCase().trim();
  if (EXPLICIT_ARTIFACT_NAMES.has(n)) return true;
  if (QUALIFIER_PREFIX_RE.test(n)) return true;
  if (BRANDED_PREFIX_RE.test(n)) return true;
  if (ARTIFACT_SUFFIX_RE.test(n)) return true;
  return false;
}

/**
 * absent-from-books: pair NOT in the CLASSICAL canon (Flavor Bible /
 * Flavor Matrix) AND both ingredients are real culinary entities.
 *
 * Semantic note: an "absent-from-books" pair in our GT (like
 * `sriracha+mayonnaise` or `coconut milk+lemongrass`) IS canon in some
 * cuisine (modern American, SE-Asian) but is absent from the classical
 * Anglo-French references the original Flavor Bible / Matrix used. The
 * filter therefore excludes only CLASSICAL-tagged GT entries, not all
 * GT. Without that distinction, the audit's P@10 is mathematically
 * always 0 because the filter and the target set are disjoint by
 * construction.
 *
 * Falls back to gtSet when classicalGtSet is undefined (test-injection
 * compatibility for older callers that don't pass the new ctx field).
 */
export function absentFromBooks(pair, gtSetOrCtx, maybeCtx) {
  if (!pair) return false;
  if (isRecipeArtifactName(pair.ingredientA)) return false;
  if (isRecipeArtifactName(pair.ingredientB)) return false;
  // Support both legacy 2-arg call (gtSet) and new (gtSet, ctx) signature.
  const ctx = maybeCtx || (gtSetOrCtx && !(gtSetOrCtx instanceof Set) ? gtSetOrCtx : null);
  const gtSet = (gtSetOrCtx instanceof Set) ? gtSetOrCtx : (ctx && ctx.gtSet ? ctx.gtSet : null);
  const classicalGtSet = ctx && ctx.classicalGtSet ? ctx.classicalGtSet : null;
  const exclusionSet = classicalGtSet || gtSet;
  if (!exclusionSet) return false;
  const key = canonicalPairKey(pair.ingredientA, pair.ingredientB);
  return !exclusionSet.has(key);
}

/**
 * cross-cuisine: the two ingredients share no cuisine.
 * Returns false (not a cross-cuisine match) when cuisine metadata is missing
 * for either side, since we cannot prove the intersection is empty.
 */
export function crossCuisine(pair, ingredientMeta) {
  if (!pair || !ingredientMeta) return false;
  const a = ingredientMeta[pair.ingredientA];
  const b = ingredientMeta[pair.ingredientB];
  if (!a || !b) return false;
  const cuisA = Array.isArray(a.cuisines) ? a.cuisines : [];
  const cuisB = Array.isArray(b.cuisines) ? b.cuisines : [];
  // shipped ingredients.json stores cuisines under different fields per pipeline;
  // fall back to `regions` / `cuisine` (singular) if no `cuisines` array.
  if (cuisA.length === 0 && cuisB.length === 0) return false;
  const setA = new Set(cuisA);
  for (const c of cuisB) {
    if (setA.has(c)) return false;
  }
  return cuisA.length > 0 && cuisB.length > 0;
}

/**
 * cross-aroma: top-aroma class differs between the two ingredients.
 * Falls back to false when gnn_entropy.json is unavailable or one side is
 * missing a top class. Audit report flags this fallback in the data-source
 * health section.
 */
export function crossAroma(pair, gnnEntropy) {
  if (!pair || !gnnEntropy) return false;
  const a = gnnEntropy[pair.ingredientA];
  const b = gnnEntropy[pair.ingredientB];
  if (!a || !b) return false;
  const topA = topClassFor(a);
  const topB = topClassFor(b);
  if (!topA || !topB) return false;
  return topA !== topB;
}

function topClassFor(entry) {
  if (!entry) return null;
  if (typeof entry.topClass === 'string') return entry.topClass;
  const probs = entry.probs || entry.probabilities || entry;
  if (!probs || typeof probs !== 'object') return null;
  let bestKey = null;
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(probs)) {
    if (typeof v !== 'number') continue;
    if (v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  }
  return bestKey;
}

/**
 * AXIS_LIST — the canonical ordering the report uses.
 */
export const AXIS_LIST = ['chem-bridged-rare', 'absent-from-books', 'cross-cuisine', 'cross-aroma'];

/**
 * classifyAxes — runs every classifier against a pair and returns the list of
 * axes that fired. Used to populate the per-axis tables.
 */
export function classifyAxes(pair, ctx) {
  const out = [];
  if (chemBridgedRare(pair, ctx)) out.push('chem-bridged-rare');
  if (absentFromBooks(pair, ctx.gtSet, ctx)) out.push('absent-from-books');
  if (crossCuisine(pair, ctx.ingredientMeta)) out.push('cross-cuisine');
  if (crossAroma(pair, ctx.gnnEntropy)) out.push('cross-aroma');
  return out;
}
