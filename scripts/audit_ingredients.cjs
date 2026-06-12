#!/usr/bin/env node
/**
 * Ingredient Dataset Audit Script
 * Finds: category mislabels, misspellings, duplicate/variant names
 * Safe operations: category fixes in-place, synonym additions
 * Reports: everything else for human review
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Paths ───────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const INGREDIENTS_PATH = path.join(ROOT, 'public/proDataset/ingredients.json');
const PAIRINGS_PATH = path.join(ROOT, 'public/proDataset/pairings.json');
const SYNONYMS_PATH = path.join(ROOT, 'proDataset/data/synonyms.json');
const AUDIT_OUT = path.join(ROOT, 'flavor-gnn/artifacts/ingredient_data_audit.md');

// Referential integrity files (object-keyed by ingredient name)
const REF_FILES = [
  'public/proDataset/gnn_entropy.json',
  'public/proDataset/gnn_entropy_imputed.json',
  'public/proDataset/gnn_compounds.json',
  'public/proDataset/flavor_positions.json',
  'public/proDataset/flavor_positions_v3.json',
  'public/proDataset/flavor_positions_2d.json',
  'public/proDataset/flavor_positions_2d_v3.json',
  'public/proDataset/gnn_positions.json',
  'public/proDataset/cluster_labels_v3.json',
  'public/proDataset/cluster_labels.json',
];

// ─── Load data ────────────────────────────────────────────────────────────────
const ingredients = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf8'));
const pairings = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf8'));
const synonyms = JSON.parse(fs.readFileSync(SYNONYMS_PATH, 'utf8'));

// Load referential files (name → true)
const refSets = {};
for (const rp of REF_FILES) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, rp), 'utf8'));
    if (!Array.isArray(d)) refSets[rp] = new Set(Object.keys(d));
  } catch (_) { /* skip missing */ }
}

const ingredientKeys = new Set(Object.keys(ingredients));

// ─── 1. CATEGORY AUDIT ────────────────────────────────────────────────────────
// Keyword → expected category rules (conservative: only flag clear mismatches)
// Rules: [regex, expectedCategory, rationale]
const CATEGORY_RULES = [
  // Sauces/condiments (not grain, not protein, not vegetable)
  [/\b(sauce|ketchup|mustard|relish|chutney|salsa|paste|sambal|harissa|sriracha|hoisin|teriyaki|worcestershire|soy sauce|fish sauce|oyster sauce|hot sauce|tabasco|mayo|mayonnaise|aioli|vinaigrette|dressing)\b/i, 'condiment', 'sauce/condiment keyword → condiment'],
  // Specific protein foods
  [/\b(beef|pork|chicken|lamb|veal|venison|duck|turkey|salmon|tuna|shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster|anchovy|sardine|cod|halibut|tilapia|catfish|bass|trout|swordfish|mahi|tofu|tempeh|seitan|egg|bacon|ham|sausage|chorizo|salami|pepperoni|prosciutto|pancetta|lard|lardons|brisket|steak|filet|fillet|tenderloin|sirloin|ribeye|ground beef|ground turkey|ground pork|ground lamb)\b/i, 'protein', 'meat/seafood/protein keyword → protein'],
  // Noodles and pasta → grain
  [/\b(noodle|pasta|spaghetti|fettuccine|linguine|penne|rigatoni|orzo|vermicelli|ramen|udon|soba|rice noodle|glass noodle|cellophane noodle|lo mein|chow mein)\b/i, 'grain', 'pasta/noodle keyword → grain'],
  // Bread, flour, grains → grain
  [/\b(bread|flour|rice\b|wheat|oat|barley|rye|quinoa|millet|couscous|polenta|cornmeal|grits|bulgur|farro|spelt|semolina|tortilla|pita|naan|baguette|loaf|roll|bun|cracker|crouton|breadcrumb)\b/i, 'grain', 'grain/bread keyword → grain'],
  // Oils and fats → fat
  [/\b(oil\b|lard|shortening|margarine|ghee|dripping|suet|tallow|schmaltz)\b/i, 'fat', '* oil/fat → fat'],
  // Butter specifically → fat (not dairy, though debatable — butter is primary fat used in cooking)
  // Skipping butter→fat as it's debatable (butter is dairy AND fat)
  // Fresh vegetables
  [/\b(carrot|celery|broccoli|cauliflower|zucchini|squash|pumpkin|cucumber|eggplant|aubergine|asparagus|artichoke|beetroot|beet\b|turnip|parsnip|radish|leek|fennel|cabbage|kale|spinach|lettuce|arugula|chard|bok choy|collard|brussels sprout|corn\b|pea\b|green bean|snap pea|snow pea|edamame|okra|tomatillo|jicama|daikon|lotus root|water chestnut|yam\b|sweet potato)\b/i, 'vegetable', 'vegetable keyword → vegetable'],
  // Fruits
  [/\b(apple|pear|peach|plum|cherry|grape|mango|papaya|guava|lychee|rambutan|jackfruit|durian|pineapple|watermelon|cantaloupe|honeydew|kiwi|fig|date\b|apricot|nectarine|persimmon|pomegranate|passion fruit|starfruit|dragonfruit|banana|plantain|coconut|avocado|strawberry|raspberry|blueberry|blackberry|cranberry|currant|elderberry|mulberry|gooseberry)\b/i, 'fruit', 'fruit keyword → fruit'],
  // Citrus → citrus
  [/\b(lemon|lime\b|orange\b|grapefruit|tangerine|mandarin|clementine|yuzu|bergamot|kumquat|pomelo|citrus)\b/i, 'citrus', 'citrus keyword → citrus'],
  // Chili peppers → chili (not spice, not vegetable)
  [/\b(chili|chile|chilli|jalapeno|jalapeño|habanero|scotch bonnet|serrano|cayenne|poblano|chipotle|ancho|guajillo|pasilla|arbol|ghost pepper|carolina reaper|bird.s eye|thai pepper|tabasco pepper|fresno)\b/i, 'chili', 'chili pepper → chili'],
  // Herbs → herb
  [/\b(basil|oregano|thyme|rosemary|sage|tarragon|chervil|dill\b|marjoram|savory|bay leaf|bay leave|parsley|cilantro|coriander leaf|mint\b|lemon balm|lemon verbena|epazote|culantro|shiso|perilla)\b/i, 'herb', 'fresh herb → herb'],
  // Spices (dried, ground, seed) → spice
  [/\b(cinnamon|nutmeg|clove|cardamom|star anise|fennel seed|cumin|coriander seed|turmeric|saffron|paprika|sumac|za.atar|fenugreek|caraway|nigella|allspice|mace|juniper|vanilla bean|peppercorn|black pepper|white pepper|szechuan pepper|pink pepper)\b/i, 'spice', 'dried spice → spice'],
  // Dairy → dairy
  [/\b(milk\b|cream\b|butter\b|cheese\b|yogurt|yoghurt|sour cream|creme fraiche|crème fraîche|ricotta|mozzarella|parmesan|cheddar|brie|camembert|gruyere|gouda|feta|mascarpone|cottage cheese|cream cheese|kefir|buttermilk|condensed milk|evaporated milk|whey|casein|ghee)\b/i, 'dairy', 'dairy keyword → dairy'],
  // Nuts/seeds → nut
  [/\b(almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|brazil nut|pine nut|chestnut|peanut|sunflower seed|pumpkin seed|sesame seed|flaxseed|chia seed|hemp seed|poppy seed)\b/i, 'nut', 'nut/seed keyword → nut'],
  // Sweeteners → sweetener
  [/\b(sugar\b|honey\b|maple syrup|molasses|agave|stevia|saccharin|aspartame|corn syrup|fructose|glucose|dextrose|lactose|maltose|xylitol|erythritol|sorbitol|jam\b|jelly\b|syrup\b|treacle|golden syrup)\b/i, 'sweetener', 'sweetener keyword → sweetener'],
  // Aromatics (alliums) → aromatic
  [/\b(garlic|onion\b|shallot|leek\b|chive|scallion|green onion|spring onion)\b/i, 'aromatic', 'allium → aromatic'],
  // Spirits → spirit
  [/\b(vodka|rum\b|gin\b|whiskey|whisky|bourbon|scotch|tequila|mezcal|brandy|cognac|armagnac|calvados|grappa|pisco|sake\b|shochu|baijiu|soju)\b/i, 'spirit', 'spirit keyword → spirit'],
  // Liqueurs → liqueur
  [/\b(liqueur|triple sec|cointreau|grand marnier|amaretto|baileys|kahlua|frangelico|chambord|midori|campari|aperol|st germain|benedictine|chartreuse|creme de)\b/i, 'liqueur', 'liqueur keyword → liqueur'],
  // Acids → acid
  [/\b(vinegar|tamarind|citric acid|lactic acid|malic acid|tartaric acid|acetic acid|ascorbic acid)\b/i, 'acid', 'acid keyword → acid'],
  // Thickeners → thickener
  [/\b(cornstarch|arrowroot|tapioca|gelatin|agar|pectin|xanthan|guar gum|kudzu|potato starch|rice starch|wheat starch)\b/i, 'thickener', 'thickener keyword → thickener'],
];

// Known legitimate "other" that don't need fixing
const KNOWN_OTHER_OK = new Set([
  'water', 'ice', 'broth', 'stock', 'soup', 'dough', 'batter',
]);

const categoryFixes = []; // { name, oldCat, newCat, reason }
const categoryFlagged = []; // { name, cat, suggestedCat, reason }

for (const [name, info] of Object.entries(ingredients)) {
  const cat = info.category;
  const lname = name.toLowerCase();

  for (const [regex, expectedCat, reason] of CATEGORY_RULES) {
    if (regex.test(lname)) {
      if (cat !== expectedCat) {
        // Only flag/fix clear errors - some categories overlap (e.g. chili vs spice)
        // Allowable coexistence pairs (don't flag these)
        const allowedPairs = new Set([
          'chili:spice', 'spice:chili',
          'chili:seasoning', 'seasoning:chili',
          'herb:spice', 'spice:herb',
          'herb:aromatic', 'aromatic:herb',
          'citrus:fruit', 'fruit:citrus',
          'condiment:seasoning', 'seasoning:condiment',
          'condiment:umami', 'umami:condiment',
          'dairy:fat', 'fat:dairy',
          'grain:thickener', 'thickener:grain',
          'nut:fat', 'fat:nut',
          'sweetener:condiment', 'condiment:sweetener',
          'baked:grain', 'grain:baked',
          'protein:umami', 'umami:protein',
          'aromatic:vegetable', 'vegetable:aromatic',
          'spirit:liqueur', 'liqueur:spirit',
          'spirit:bitters', 'bitters:spirit',
        ]);

        const pairKey = `${cat}:${expectedCat}`;
        if (!allowedPairs.has(pairKey)) {
          // It's a clear mismatch - flag for review but only apply if high-confidence
          // High-confidence = the category is completely unrelated (e.g. sauce labeled grain)
          const clearErrors = [
            ['grain', 'condiment'], ['grain', 'protein'], ['grain', 'fruit'],
            ['grain', 'fat'], ['grain', 'dairy'], ['grain', 'citrus'],
            ['grain', 'herb'], ['grain', 'sweetener'], ['grain', 'spirit'],
            ['protein', 'grain'], ['protein', 'fruit'], ['protein', 'sweetener'],
            ['protein', 'herb'], ['protein', 'spice'], ['protein', 'citrus'],
            ['vegetable', 'grain'], ['vegetable', 'sweetener'], ['vegetable', 'spirit'],
            ['vegetable', 'dairy'], ['vegetable', 'fat'],
            ['fruit', 'grain'], ['fruit', 'protein'], ['fruit', 'dairy'],
            ['fruit', 'fat'], ['fruit', 'spice'], ['fruit', 'herb'],
            ['fat', 'protein'], ['fat', 'grain'], ['fat', 'fruit'],
            ['fat', 'sweetener'], ['fat', 'vegetable'],
            ['condiment', 'grain'], ['condiment', 'protein'], ['condiment', 'dairy'],
            ['condiment', 'fruit'], ['condiment', 'fat'],
            ['dairy', 'grain'], ['dairy', 'protein'], ['dairy', 'vegetable'],
            ['sweetener', 'protein'], ['sweetener', 'grain'], ['sweetener', 'dairy'],
            ['aromatic', 'grain'], ['aromatic', 'protein'], ['aromatic', 'sweetener'],
            ['acid', 'grain'], ['acid', 'protein'], ['acid', 'fat'],
            ['spirit', 'grain'], ['spirit', 'protein'], ['spirit', 'fat'],
            ['liqueur', 'grain'], ['liqueur', 'protein'], ['liqueur', 'fat'],
          ];
          const isClearError = clearErrors.some(([a, b]) => a === cat && b === expectedCat);
          if (isClearError) {
            categoryFixes.push({ name, oldCat: cat, newCat: expectedCat, reason });
          } else {
            categoryFlagged.push({ name, cat, suggestedCat: expectedCat, reason });
          }
        }
      }
      break; // Only apply first matching rule
    }
  }
}

// Deduplicate by name (keep first match)
const fixedNames = new Set();
const dedupedFixes = categoryFixes.filter(f => {
  if (fixedNames.has(f.name)) return false;
  fixedNames.add(f.name);
  return true;
});

console.log(`Category audit: ${dedupedFixes.length} clear fixes, ${categoryFlagged.length} flagged for review`);

// ─── 2. MISSPELLING DETECTION ─────────────────────────────────────────────────
// Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_, i) => Array.from({length: n+1}, (_, j) => i===0 ? j : j===0 ? i : 0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// Known misspelling patterns (variant → correct suffix/word mapping)
const KNOWN_MISSPELLINGS = [
  // Pattern: [regex to detect, correct version note]
  { test: /\bleave\b/, fix: 'leaves', note: '"leave" should be "leaves" (plural of leaf)' },
  { test: /\bpotatoe\b/, fix: 'potato', note: '"potatoe" → "potato"' },
  { test: /\btomatoe\b/, fix: 'tomato', note: '"tomatoe" → "tomato"' },
  { test: /\bavacado\b/, fix: 'avocado', note: '"avacado" → "avocado"' },
  { test: /\bbrocoli\b/, fix: 'broccoli', note: '"brocoli" → "broccoli"' },
  { test: /\bcucmber\b/, fix: 'cucumber', note: '"cucmber" → "cucumber"' },
  { test: /\beggplant\b.*\baubergine\b|\baubergine\b.*\beggplant\b/, fix: null, note: 'eggplant/aubergine duplicate' },
  { test: /\bcourgette\b/, fix: 'zucchini', note: '"courgette" is UK English for zucchini (synonym, not misspelling)' },
  { test: /\bcilantro\b.*\bcoriander\b|\bcoriander\b.*\bcilantro\b/, fix: null, note: 'cilantro/coriander duplicate check' },
  { test: /\bpistacchio\b/, fix: 'pistachio', note: '"pistacchio" → "pistachio"' },
  { test: /\bchocolatte\b/, fix: 'chocolate', note: '"chocolatte" → "chocolate"' },
  { test: /\bjalapeño\b/, fix: 'jalapeño', note: 'accented variant' },
];

const misspellingsMapped = []; // Will be added to synonyms.json
const misspellingsFlagged = []; // Needs human review (key rename)

const ingredientList = Object.keys(ingredients);

for (const name of ingredientList) {
  for (const { test, fix, note } of KNOWN_MISSPELLINGS) {
    if (test.test(name.toLowerCase())) {
      if (fix) {
        // Construct the corrected name
        const corrected = name.toLowerCase().replace(test, fix);
        if (corrected !== name.toLowerCase() && ingredientKeys.has(corrected)) {
          // Corrected version already exists as a key → this is a duplicate/misspelling
          misspellingsFlagged.push({ name, corrected, note: note + ' — corrected version exists as a key', action: 'merge-candidate' });
        } else if (corrected !== name.toLowerCase()) {
          // Corrected version doesn't exist → add as synonym mapping corrected→this key
          // (or flag for rename if the misspelling is egregious)
          const editDist = levenshtein(name, corrected);
          if (editDist <= 3) {
            misspellingsMapped.push({ variant: name, canonical: corrected, note });
          } else {
            misspellingsFlagged.push({ name, corrected, note, action: 'review-rename' });
          }
        }
      } else {
        misspellingsFlagged.push({ name, corrected: null, note, action: 'review' });
      }
    }
  }
}

// Specific scan: ingredient names ending in "leave" (should be "leaves")
const leaveIssues = ingredientList.filter(n => n.match(/\bleave\b/i));
console.log(`"leave" misspellings found: ${leaveIssues.length}`, leaveIssues);

console.log(`Misspellings: ${misspellingsMapped.length} synonym-mapped, ${misspellingsFlagged.length} flagged`);

// ─── 3. DUPLICATE DETECTION ───────────────────────────────────────────────────
// Known duplicate/variant pairs to check explicitly
const KNOWN_VARIANT_PAIRS = [
  // [variantA, variantB, canonical, reasoning]
  ['scallion', 'green onion', 'scallion', 'same ingredient (US name = scallion)'],
  ['scallion', 'spring onion', 'scallion', 'same ingredient'],
  ['green onion', 'spring onion', 'green onion', 'same ingredient'],
  ['garbanzo', 'chickpea', 'chickpea', 'same legume, chickpea more universal'],
  ['garbanzo bean', 'chickpea', 'chickpea', 'same legume'],
  ['eggplant', 'aubergine', 'eggplant', 'US/UK names for same vegetable'],
  ['zucchini', 'courgette', 'zucchini', 'US/UK names for same vegetable'],
  ['cilantro', 'coriander', null, 'AMBIGUOUS: cilantro=leaf, coriander=seed in US usage — do NOT merge'],
  ['bell pepper', 'sweet pepper', 'bell pepper', 'same ingredient'],
  ['bell pepper', 'capsicum', 'bell pepper', 'US/UK/AU names'],
  ['sweet pepper', 'capsicum', 'bell pepper', 'regional names'],
  ['shrimp', 'prawn', null, 'AMBIGUOUS: US uses shrimp for small, prawn for large — different in some contexts'],
  ['corn', 'maize', 'corn', 'same ingredient'],
  ['cornstarch', 'corn starch', 'cornstarch', 'spacing variant'],
  ['heavy cream', 'heavy whipping cream', 'heavy cream', 'same product'],
  ['sour cream', 'soured cream', 'sour cream', 'same product'],
  ['yogurt', 'yoghurt', 'yogurt', 'spelling variant'],
  ['chili', 'chilli', 'chili', 'spelling variant'],
  ['chile', 'chili', 'chili', 'spelling/regional variant'],
  ['jalapeño', 'jalapeno', 'jalapeño', 'accent variant'],
  ['poblano', 'poblano pepper', 'poblano', 'redundant word'],
  ['habanero', 'habanero pepper', 'habanero', 'redundant word'],
  ['serrano', 'serrano pepper', 'serrano', 'redundant word'],
  ['scallops', 'scallop', 'scallop', 'plural variant'],
  ['shrimps', 'shrimp', 'shrimp', 'plural variant'],
  ['prawns', 'prawn', 'prawn', 'plural variant'],
  ['lemon', 'lemon juice', null, 'NOT duplicate: ingredient vs juice'],
  ['lime', 'lime juice', null, 'NOT duplicate: ingredient vs juice'],
  ['tomato', 'tomatoes', 'tomato', 'plural variant'],
  ['potato', 'potatoes', 'potato', 'plural variant'],
  ['onion', 'onions', 'onion', 'plural variant'],
  ['mushroom', 'mushrooms', 'mushroom', 'plural variant'],
];

// Check which variant pairs actually exist in ingredients
const duplicateClusters = []; // { variants: [], canonical, reason, action }
const seenDupNames = new Set();

for (const [a, b, canonical, reason] of KNOWN_VARIANT_PAIRS) {
  const hasA = ingredientKeys.has(a);
  const hasB = ingredientKeys.has(b);

  if (hasA && hasB) {
    const pairKey = [a,b].sort().join('|||');
    if (seenDupNames.has(pairKey)) continue;
    seenDupNames.add(pairKey);

    const infoA = ingredients[a];
    const infoB = ingredients[b];

    // Count pairings for each
    const countA = pairings.filter(p => p.ingredientA === a || p.ingredientB === a).length;
    const countB = pairings.filter(p => p.ingredientA === b || p.ingredientB === b).length;

    if (canonical === null) {
      duplicateClusters.push({
        variants: [a, b], canonical: 'AMBIGUOUS — DO NOT MERGE', reason,
        pairingCounts: { [a]: countA, [b]: countB },
        totalCounts: { [a]: infoA.totalCount, [b]: infoB.totalCount },
        action: 'flagged-for-review'
      });
    } else {
      // Check if canonical is one of them or a new name
      const resolvedCanonical = ingredientKeys.has(canonical) ? canonical : (hasA ? a : b);
      duplicateClusters.push({
        variants: [a, b], canonical: resolvedCanonical, reason,
        pairingCounts: { [a]: countA, [b]: countB },
        totalCounts: { [a]: infoA.totalCount, [b]: infoB.totalCount },
        action: 'merge-candidate'
      });
    }
  }
}

// Programmatic near-duplicate detection: edit distance ≤ 2 on names > 5 chars
// and token-overlap duplicates (singular/plural)
const programmaticDups = [];
const allNames = ingredientList;
const checkedPairs = new Set();

for (let i = 0; i < allNames.length; i++) {
  const a = allNames[i];
  for (let j = i+1; j < allNames.length; j++) {
    const b = allNames[j];
    const pairKey = a + '|||' + b;
    if (checkedPairs.has(pairKey)) continue;
    checkedPairs.add(pairKey);

    // Skip if already in known pairs
    if (seenDupNames.has([a,b].sort().join('|||'))) continue;

    // Check plural/singular
    if (a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a) {
      const countA = pairings.filter(p => p.ingredientA === a || p.ingredientB === a).length;
      const countB = pairings.filter(p => p.ingredientA === b || p.ingredientB === b).length;
      programmaticDups.push({
        variants: [a, b],
        reason: 'singular/plural variant',
        pairingCounts: { [a]: countA, [b]: countB },
        action: 'merge-candidate'
      });
      continue;
    }

    // Edit distance ≤ 2, both names > 6 chars
    if (a.length > 6 && b.length > 6 && Math.abs(a.length - b.length) <= 2) {
      const dist = levenshtein(a, b);
      if (dist === 1) {
        const countA = pairings.filter(p => p.ingredientA === a || p.ingredientB === a).length;
        const countB = pairings.filter(p => p.ingredientA === b || p.ingredientB === b).length;
        programmaticDups.push({
          variants: [a, b],
          reason: `edit distance ${dist}`,
          pairingCounts: { [a]: countA, [b]: countB },
          action: 'review'
        });
      }
    }
  }
}

console.log(`Duplicate clusters: ${duplicateClusters.length} known pairs found`);
console.log(`Programmatic near-dups: ${programmaticDups.length}`);

// ─── 4. DETERMINE SAFE MERGES ─────────────────────────────────────────────────
// Only merge if: both exist, no ambiguity, canonical is determinate,
// and we can update all ref files safely.
// For safety in this automated pass, we ONLY do:
//   (a) Category fixes (field change, no key change)
//   (b) Synonym additions for misspellings
//   (c) Synonym additions for known-safe variant→canonical mappings
// We do NOT auto-merge pairings (too risky without explicit human approval)
// Exception: pure plural/singular with one having 0 pairings is safe synonym-only

const synonymAdditions = {}; // variant → canonical to add

// Add "leave" → "leaves" synonyms
for (const name of leaveIssues) {
  const corrected = name.replace(/\bleave\b/gi, 'leaves');
  if (!ingredientKeys.has(corrected)) {
    // The corrected form doesn't exist; add as synonym pointing to the existing key
    // i.e. corrected → name (so searches for "makrut lime leaves" find "makrut lime leave")
    synonymAdditions[corrected] = name;
  } else {
    // Both exist — need to flag as duplicate
    duplicateClusters.push({
      variants: [name, corrected],
      canonical: corrected,
      reason: '"leave" spelling variant of "leaves"',
      action: 'merge-candidate'
    });
  }
}

// Add safe synonym mappings (variant→canonical) for known non-ambiguous pairs
for (const cluster of duplicateClusters) {
  if (cluster.action === 'merge-candidate' && cluster.canonical !== 'AMBIGUOUS — DO NOT MERGE') {
    const variants = cluster.variants.filter(v => v !== cluster.canonical);
    for (const v of variants) {
      if (!synonyms[v]) {
        synonymAdditions[v] = cluster.canonical;
      }
    }
  }
}

// For programmatic near-dups that are clearly plural/singular
for (const dup of programmaticDups) {
  if (dup.action === 'merge-candidate') {
    const [a, b] = dup.variants;
    // Pick the shorter one (singular) as canonical, longer (plural) as variant
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    if (!synonyms[longer]) {
      synonymAdditions[longer] = shorter;
    }
  }
}

console.log(`Synonym additions: ${Object.keys(synonymAdditions).length}`);

// ─── 5. APPLY CATEGORY FIXES ─────────────────────────────────────────────────
console.log('\nApplying category fixes...');
const appliedFixes = [];
for (const fix of dedupedFixes) {
  if (ingredients[fix.name]) {
    ingredients[fix.name].category = fix.newCat;
    appliedFixes.push(fix);
  }
}
console.log(`Applied ${appliedFixes.length} category fixes`);

// ─── 6. APPLY SYNONYM ADDITIONS ──────────────────────────────────────────────
console.log('Applying synonym additions...');
let synonymsAdded = 0;
for (const [variant, canonical] of Object.entries(synonymAdditions)) {
  // Don't overwrite existing synonyms
  if (!synonyms[variant]) {
    synonyms[variant] = canonical;
    synonymsAdded++;
  }
}
console.log(`Added ${synonymsAdded} new synonyms`);

// ─── 7. WRITE MODIFIED FILES ─────────────────────────────────────────────────
fs.writeFileSync(INGREDIENTS_PATH, JSON.stringify(ingredients, null, 2));
fs.writeFileSync(SYNONYMS_PATH, JSON.stringify(synonyms, null, 2));
console.log('Wrote ingredients.json and synonyms.json');

// ─── 8. BUILD AUDIT REPORT ────────────────────────────────────────────────────
const safeMerges = duplicateClusters.filter(d => d.action === 'merge-candidate');
const flaggedMerges = duplicateClusters.filter(d => d.action === 'flagged-for-review');
const allFlaggedForReview = [
  ...categoryFlagged,
  ...misspellingsFlagged,
  ...flaggedMerges,
  ...programmaticDups.filter(d => d.action === 'review'),
];

const report = `# Ingredient Dataset Audit
Generated: ${new Date().toISOString()}
Dataset: ${ingredientList.length} ingredients, ${pairings.length} pairings

---

## Summary

| Metric | Count |
|--------|-------|
| Category fixes applied | ${appliedFixes.length} |
| Category fixes flagged for review | ${categoryFlagged.length} |
| Misspellings added to synonyms | ${synonymsAdded} |
| Misspellings flagged for review | ${misspellingsFlagged.length} |
| Known duplicate pairs found | ${duplicateClusters.length} |
| Synonym-only merges applied | ${safeMerges.length} (synonym only, no key rename) |
| Duplicate clusters flagged for review | ${flaggedMerges.length} |
| Near-duplicate pairs (programmatic) | ${programmaticDups.length} |

---

## 1. Category Fixes Applied

These category field changes were applied in-place. Key names are unchanged; no referential integrity risk.

| Ingredient | Old Category | New Category | Reason |
|------------|-------------|--------------|--------|
${appliedFixes.map(f => `| ${f.name} | ${f.oldCat} | ${f.newCat} | ${f.reason} |`).join('\n') || '| (none) | | | |'}

---

## 2. Category Changes Flagged for Review

These are possible mislabels but involve overlapping categories or ambiguous cases. No changes were made.

| Ingredient | Current Category | Suggested | Reason |
|------------|-----------------|-----------|--------|
${categoryFlagged.map(f => `| ${f.name} | ${f.cat} | ${f.suggestedCat} | ${f.reason} |`).join('\n') || '| (none) | | | |'}

---

## 3. Misspellings — Synonym-Mapped

These names were added to \`proDataset/data/synonyms.json\` so lookups resolve correctly.
The KEY in ingredients.json was NOT changed (no referential integrity risk).

| Variant (synonym added) | Canonical Target | Note |
|------------------------|-----------------|------|
${Object.entries(synonymAdditions).map(([v,c]) => `| ${v} | ${c} | added to synonyms.json |`).join('\n') || '| (none) | | |'}

---

## 4. Misspellings Flagged for Review

These require human decision to rename/merge keys.

${misspellingsFlagged.map(m => `- **${m.name}** → suggested: \`${m.corrected || 'N/A'}\` | ${m.note} | action: ${m.action}`).join('\n') || '(none)'}

---

## 5. "leave" → "leaves" Spelling Issues

Names in ingredients.json containing "leave" (should be "leaves"):

${leaveIssues.map(n => {
  const corrected = n.replace(/\bleave\b/gi, 'leaves');
  const targetExists = ingredientKeys.has(corrected);
  return `- \`${n}\` → corrected: \`${corrected}\` | corrected key exists: ${targetExists} | synonym added: ${!!synonymAdditions[corrected]}`;
}).join('\n') || '(none found)'}

---

## 6. Duplicate Clusters — Known Variant Pairs

Both names exist as keys in ingredients.json. Synonym-only mappings were added where safe.
**No pairings were merged; no keys were deleted.** That requires human execution after review.

${duplicateClusters.map(d => {
  const pairingInfo = Object.entries(d.pairingCounts || {}).map(([k,v]) => `${k}: ${v} pairings`).join(', ');
  const countInfo = Object.entries(d.totalCounts || {}).map(([k,v]) => `${k}: totalCount=${v}`).join(', ');
  return `### ${d.variants.join(' ↔ ')}
- **Action**: ${d.action}
- **Canonical**: ${d.canonical}
- **Reason**: ${d.reason}
- **Pairings**: ${pairingInfo}
- **Counts**: ${countInfo}
- **Synonym added**: ${d.variants.filter(v => synonymAdditions[v]).map(v => `${v}→${d.canonical}`).join(', ') || 'none'}
`;
}).join('\n') || '(no known duplicate pairs found in dataset)'}

---

## 7. Programmatic Near-Duplicate Pairs

Detected by edit-distance or plural/singular analysis. Synonyms added for safe plural/singular cases.

${programmaticDups.map(d => {
  const pairingInfo = Object.entries(d.pairingCounts || {}).map(([k,v]) => `${k}: ${v} pairings`).join(', ');
  return `- **${d.variants.join(' ↔ ')}** | ${d.reason} | pairings: ${pairingInfo} | action: ${d.action}`;
}).join('\n') || '(none)'}

---

## 8. Referential Integrity Check

Keys in referential files that are NOT in ingredients.json (orphan check):

${Object.entries(refSets).map(([file, keySet]) => {
  const orphans = [...keySet].filter(k => !ingredientKeys.has(k));
  return `### ${file.split('/').pop()}
- Keys: ${keySet.size}
- Orphaned keys (in ref file but not in ingredients.json): ${orphans.length}
${orphans.length > 0 ? orphans.slice(0, 20).map(k => `  - \`${k}\``).join('\n') + (orphans.length > 20 ? `\n  ... and ${orphans.length - 20} more` : '') : '  (none)'}
`;
}).join('\n')}

---

## 9. Pairings Referential Integrity

Pairings referencing names NOT in ingredients.json:

${ (() => {
  const orphanedPairings = pairings.filter(p => !ingredientKeys.has(p.ingredientA) || !ingredientKeys.has(p.ingredientB));
  const orphanedNames = new Set();
  orphanedPairings.forEach(p => {
    if (!ingredientKeys.has(p.ingredientA)) orphanedNames.add(p.ingredientA);
    if (!ingredientKeys.has(p.ingredientB)) orphanedNames.add(p.ingredientB);
  });
  return `- Total pairings with missing ingredient refs: ${orphanedPairings.length}
- Distinct orphaned names: ${orphanedNames.size}
${[...orphanedNames].slice(0,30).map(n => `  - \`${n}\``).join('\n')}${orphanedNames.size > 30 ? `\n  ... and ${orphanedNames.size - 30} more` : ''}`;
})() }

---

## Appendix: Files Modified

- \`public/proDataset/ingredients.json\` — ${appliedFixes.length} category field changes
- \`proDataset/data/synonyms.json\` — ${synonymsAdded} new synonym mappings added

Files NOT modified (no safe automated changes):
- \`public/proDataset/pairings.json\` — pairings unchanged (no key renames/merges)
- All GNN/position/cluster files — unchanged
`;

fs.mkdirSync(path.dirname(AUDIT_OUT), { recursive: true });
fs.writeFileSync(AUDIT_OUT, report);
console.log('\nAudit report written to:', AUDIT_OUT);

// Summary
console.log('\n=== AUDIT SUMMARY ===');
console.log(`Category fixes applied: ${appliedFixes.length}`);
console.log(`Category flagged for review: ${categoryFlagged.length}`);
console.log(`Synonyms added: ${synonymsAdded}`);
console.log(`Misspellings flagged: ${misspellingsFlagged.length}`);
console.log(`Known duplicate pairs found: ${duplicateClusters.length}`);
console.log(`Programmatic near-dups: ${programmaticDups.length}`);
