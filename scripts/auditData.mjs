// DATA-1. Repeatable data audit. Reads repo files only (no network), changes no data file.
//
//   npm run audit:data                    print the summary, write data/review/*.tsv and docs/data-quality.md
//   npm run audit:data -- --json          print the full result as JSON (writes nothing)
//   npm run audit:data -- --check         exit 1 if any count is ABOVE data/review/baseline.json (writes nothing)
//   npm run audit:data -- --update-baseline   store this run's counts as the new baseline
//
// The ingredient-hygiene rules look at the RAW generated data; the category and taste rules look at the CURATED data (DATA-4, DATA-5). It also validates the curation tables (src/data/curation)
// and prints the curated counts beside the raw ones; an invalid table fails the run.
//
// Exit code is non-zero only for a missing or malformed input, or a failed --check.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findDuplicates, findNonFood, findPackaged, findCategoryInconsistencies, categorySplits,
  findTasteNeutralSweet, findTasteVocabulary, findTasteOutliers, tasteDistribution, partitionReviewed,
  cocktailChecks, sauceChecks, dishChecks, TASTE_VOCAB,
} from '../src/data/dataAudit.js';
import { CATEGORY_SCHEME } from '../src/data/categoryScheme.js';
import { TASTE_WORDS, TASTE_RULES, TASTE_EXAMPLES } from '../src/data/tasteScheme.js';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { dishTypeOf, DISH_TYPES } from '../src/data/dishType.js';
import { DISH_SKELETONS, DISH_SKELETON_ORDER } from '../src/data/dishSkeletons.js';
import { loadCurationTables, validateAgainst, applyCuration } from './lib/curationTables.mjs';
import { runAgreement } from './checkAromaAgreement.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW_DIR = resolve(ROOT, 'data/review');
const BASELINE_PATH = resolve(REVIEW_DIR, 'baseline.json');
const KEEP_PATH = resolve(REVIEW_DIR, 'keep.json');
const DOC_PATH = resolve(ROOT, 'docs/data-quality.md');

// rule id -> [review file, plain-language title]
export const RULES = {
  'duplicate-misspelling': ['duplicates', 'Ingredient: misspelt name of another ingredient'],
  'duplicate-plural': ['duplicates', 'Ingredient: plural of another ingredient'],
  'duplicate-prefix': ['duplicates', 'Ingredient: another ingredient plus a preparation word'],
  'non-food': ['non-food', 'Ingredient: kitchen equipment or supply'],
  fragment: ['non-food', 'Ingredient: a fragment, not a food'],
  'packaged-brand': ['packaged', 'Ingredient: brand name'],
  'packaged-mix': ['packaged', 'Ingredient: boxed mix'],
  'packaged-soup': ['packaged', 'Ingredient: canned condensed soup'],
  'packaged-flavored': ['packaged', "Ingredient: 'flavored' product"],
  'category-cheese': ['category', 'Category: a cheese outside dairy'],
  'category-juice': ['category', 'Category: a juice outside juice (citrus juices belong to citrus)'],
  'category-flour': ['category', 'Category: a flour outside grain'],
  'category-wine': ['category', 'Category: a wine outside wine'],
  'category-vermouth': ['category', 'Category: a vermouth outside liqueur'],
  'category-beer': ['category', 'Category: a beer or hard cider outside beer'],
  'category-spirit': ['category', 'Category: a spirit outside spirit'],
  'category-umami': ['category', "Category: still filed under 'umami' (a taste; the category is 'savory seasoning')"],
  'taste-neutral-sweet': ['taste', "Taste: starch, plain fat, water or neutral spirit labelled 'sweet'"],
  'taste-vocab': ['taste', 'Taste: word outside the known vocabulary'],
  'taste-missing': ['taste', 'Taste: no label'],
  'taste-outlier': ['taste', 'Taste: first word rare for its category'],
  'cocktail-cream-egg': ['cocktails', 'Cocktail: cream or egg drink (no family of its own)'],
  'cocktail-citrus-stirred': ['cocktails', "Cocktail: lemon or lime in a stirred or 'boozy' family"],
  'cocktail-no-amounts': ['cocktails', 'Cocktail: no amount on any ingredient line'],
  'cocktail-duplicate': ['cocktails', 'Cocktail: same name twice'],
  'cocktail-subgroup-unnamed': ['cocktails', 'Cocktail: sub-group with no name'],
  'cocktail-missing-classic': ['cocktails', 'Cocktail: classic that is missing'],
  'sauce-independent': ['sauces', "Sauce: filed under the catch-all 'Independent'"],
  'dish-singleton': ['dishes', 'Dish: Cookbook type with a single dish'],
  'dish-no-invent-equivalent': ['dishes', 'Dish: Cookbook type with no Invent equivalent'],
};
const REVIEW_FILES = [...new Set(Object.values(RULES).map((r) => r[0]))];

const args = new Set(process.argv.slice(2));

function fail(msg) {
  console.error(`audit:data: ${msg}`);
  process.exit(1);
}

function readJson(path, what) {
  if (!existsSync(path)) fail(`missing input: ${what} (${path})`);
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { return fail(`malformed input: ${what}: ${e.message}`); }
}

export function runAudit() {
  const ingredients = readJson(resolve(ROOT, 'public/proDataset/ingredients.json'), 'ingredients.json');
  const codex = readJson(resolve(ROOT, 'public/data/cocktail_codex_v2.json'), 'cocktail_codex_v2.json');
  const sauces = readJson(resolve(ROOT, 'public/data/sauce_augment.json'), 'sauce_augment.json').sauces;
  if (!sauces || !Array.isArray(codex.cocktails) || !ingredients || typeof ingredients !== 'object') fail('malformed input: unexpected shape');
  const keepFile = existsSync(KEEP_PATH) ? readJson(KEEP_PATH, 'keep.json') : { keep: [] };
  const keep = new Set((keepFile.keep || []).map((k) => k.name));

  const tables = loadCurationTables();
  const tableProblems = validateAgainst(tables, ingredients);
  const rawPairings = args.has('--json') || args.has('--check') ? null : readJson(resolve(ROOT, 'public/proDataset/pairings.json'), 'pairings.json');
  const cur = applyCuration(ingredients, rawPairings, tables);
  const curated = {
    ingredients: { raw: Object.keys(ingredients).length, curated: Object.keys(cur.ingredients).length },
    merged: cur.report.aliasesApplied.length, hidden: cur.report.hiddenApplied.length, packaged: cur.report.packagedApplied.length,
    categoryOverrides: cur.report.categoryApplied.length, tasteOverrides: cur.report.tasteApplied.length, additions: cur.report.additionsApplied.length,
    pairings: rawPairings ? { raw: cur.report.pairingsIn, curated: cur.report.pairingsOut } : null,
    tableProblems,
  };

  const dupsAll = findDuplicates(ingredients, { keep: new Set() });
  const dups = dupsAll;
  const suppressed = 0;

  const dishTypes = Object.fromEntries(SEED_RECIPES.map((r) => [r.name, dishTypeOf(r)]));
  const inventTypes = DISH_SKELETON_ORDER.map((id) => ({ id, label: DISH_SKELETONS[id].label, dishType: DISH_SKELETONS[id].dishType }));
  const cocktail = cocktailChecks(codex);
  const sauce = sauceChecks(sauces);
  const dish = dishChecks({ dishTypes, cookbookTypes: DISH_TYPES, inventTypes });

  const findings = [
    ...dups, ...findNonFood(ingredients), ...findPackaged(ingredients), ...findCategoryInconsistencies(cur.ingredients),
    ...findTasteNeutralSweet(cur.ingredients), ...findTasteVocabulary(cur.ingredients), ...findTasteOutliers(cur.ingredients),
    ...cocktail.findings, ...sauce.findings, ...dish.findings,
  ];
  const isIngredientRule = (r) => /^(duplicate|non-food|fragment|packaged|category|taste)/.test(r);
  for (const f of findings) {
    f.useCount = isIngredientRule(f.rule) ? ((cur.ingredients[f.item] || ingredients[f.item])?.totalCount ?? 0) : '';
  }

  // A candidate already decided (aliased, hidden, flagged packaged, or on the keep list) is REVIEWED.
  // Only the ingredient-hygiene rules are decided this way; category and taste rules are fixed by overrides later.
  const decided = {
    aliased: new Set(Object.keys(tables.aliases || {})), hidden: new Set(Object.keys(tables.hidden || {})),
    packaged: new Set(Object.keys(tables.packaged || {})), kept: keep,
  };
  const { unreviewed, handledItems } = partitionReviewed(findings, decided);
  // A first-word outlier on a name with a taste override has been read and decided (DATA-5): it is the correction itself.
  const tasteRead = new Set(Object.keys(tables.tasteOverrides || {}));
  const stillOpen = unreviewed.filter((f) => !(f.rule === 'taste-outlier' && tasteRead.has(f.item)));
  handledItems.tasteRead = new Set(unreviewed.filter((f) => f.rule === 'taste-outlier' && tasteRead.has(f.item)).map((f) => f.item));
  findings.splice(0, findings.length, ...stillOpen);
  const handled = Object.fromEntries(Object.entries(handledItems).map(([k, v]) => [k, v.size]));

  const rules = {};
  for (const id of Object.keys(RULES)) rules[id] = { total: 0, HIGH: 0, LOW: 0 };
  for (const f of findings) {
    if (!rules[f.rule]) rules[f.rule] = { total: 0, HIGH: 0, LOW: 0 };
    rules[f.rule].total += 1;
    rules[f.rule][f.confidence] += 1;
  }

  const metrics = Object.fromEntries(Object.entries(rules).map(([id, r]) => [id, r.total]));
  metrics['sauce-independent-share-percent'] = sauce.total ? Math.round((100 * sauce.independent) / sauce.total) : 0;
  // AROMA-2: disagreements between the aroma table and the second source that nobody has decided (six-axis set until AROMA-3).
  const aroma = runAgreement({ axes: 'six' });
  metrics['aroma-disagreement-unreviewed'] = aroma.unreviewed.length;
  metrics['aroma-accepted-stale'] = aroma.problems.length;

  return {
    totals: { ingredients: Object.keys(ingredients).length, cocktails: codex.cocktails.length, sauces: sauces.length, dishes: SEED_RECIPES.length },
    aroma: { summary: aroma.summary, unreviewed: aroma.unreviewed.map((x) => x.name), problems: aroma.problems },
    findings, rules, metrics, handled, suppressedByKeepList: suppressed, keepListSize: keep.size, curated,
    details: {
      categorySplits: categorySplits(cur.ingredients),
      categoryCounts: categoryCounts(cur.ingredients),
      categoryCountsRaw: categoryCounts(ingredients),
      tasteDistribution: tasteDistribution(cur.ingredients),
      cocktailsByFamily: cocktail.byFamily,
      sauces: { motherSauce: sauce.motherSauce, cuisine: sauce.cuisine, total: sauce.total, independent: sauce.independent },
      dishes: { count: dish.count, cookbookTypes: dish.cookbookTypes, inventTypes: dish.inventTypes },
    },
  };
}

function summaryTable(result) {
  const rows = [['rule', 'what it finds', 'total', 'HIGH', 'LOW']];
  for (const [id, [, title]] of Object.entries(RULES)) {
    const r = result.rules[id];
    rows.push([id, title, String(r.total), String(r.HIGH), String(r.LOW)]);
  }
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => (i >= 2 ? c.padStart(w[i]) : c.padEnd(w[i]))).join('  ')).join('\n');
}

function categoryCounts(ingredients) {
  const out = {};
  for (const [n, e] of Object.entries(ingredients)) if (!n.startsWith('_')) out[e.category || '(none)'] = (out[e.category || '(none)'] || 0) + 1;
  return out;
}

const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();

function writeReviewFiles(result) {
  mkdirSync(REVIEW_DIR, { recursive: true });
  for (const file of REVIEW_FILES) {
    const rows = result.findings
      .filter((f) => RULES[f.rule]?.[0] === file)
      .sort((a, b) => (Number(b.useCount) || 0) - (Number(a.useCount) || 0) || a.rule.localeCompare(b.rule) || a.item.localeCompare(b.item));
    const head = ['item', 'rule', 'confidence', 'use_count', 'detail', 'suggested_action'].join('\t');
    const body = rows.map((f) => [f.item, f.rule, f.confidence, f.useCount, f.detail, f.suggestion].map(clean).join('\t'));
    writeFileSync(resolve(REVIEW_DIR, `${file}.tsv`), [head, ...body].join('\n') + '\n');
  }
}

function mdTable(rows) {
  const [head, ...rest] = rows;
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rest.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function topWords(dist) {
  return Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w, n]) => `${w} ${n}`).join(', ');
}

// "After DATA-3": before/after numbers for the ingredient clean-up, generated so the section cannot go stale.
const HYGIENE_RULES = ['duplicate-misspelling', 'duplicate-plural', 'duplicate-prefix', 'non-food', 'fragment', 'packaged-brand', 'packaged-mix', 'packaged-soup', 'packaged-flavored'];

function afterData3(result, baseline) {
  const first = (baseline.history || []).find((h) => h.label === 'DATA-1') || baseline;
  const c = result.curated;
  const sum = (m) => HYGIENE_RULES.reduce((n, r) => n + (m[r] ?? 0), 0);
  const rows = [['Check', 'Rule id', `Candidates at the first audit (${first.date})`, 'Unreviewed now']];
  for (const r of HYGIENE_RULES) rows.push([RULES[r][1], `\`${r}\``, String(first.metrics[r] ?? 'n/a'), String(result.rules[r].total)]);
  rows.push(['**All of the above**', '', `**${sum(first.metrics)}**`, `**${sum(result.metrics)}**`]);
  const h = result.handled;
  return `## After DATA-3: ingredient merges, removals and packaged flags

Every candidate on the three ingredient review lists (duplicates, non-food and fragments, packaged)
was read and decided. A decision is one of: **aliased** (merged into the ingredient a cook means,
\`src/data/curation/aliases.json\`), **hidden** (not food, \`hidden.json\`), **flagged packaged**
(kept, searchable, never suggested, \`packaged.json\`), or **kept as it is** with a reason
(\`data/review/keep.json\`). The audit now counts only the candidates nobody has decided; a decided one
is reported as reviewed. The target is zero unreviewed.

${mdTable(rows)}

Decided, counted by name: ${h.aliased} aliased, ${h.hidden} hidden, ${h.packaged} flagged packaged, ${h.kept} kept as they are
(the keep list has ${result.keepListSize} entries; a few are protections for names that are not in the data today).

### Counts, as the audit prints them

| What | Before (raw generated data) | After (curated, what the app loads) |
| --- | --- | --- |
| Ingredients | ${c.ingredients.raw} | ${c.ingredients.curated} (${c.merged} merged away, ${c.hidden} hidden, ${c.additions} corrected spellings added) |
| Pairings | ${c.pairings ? c.pairings.raw : 'n/a (run without --check)'} | ${c.pairings ? c.pairings.curated : 'n/a'} |
| Ingredients flagged packaged | 0 | ${c.packaged} |

Merging a variant moves its pairings onto the ingredient it was merged into (the stronger score is kept,
a pairing between the two is dropped), so the pairing count falls by the pairings that collapsed together
and the pairings of the hidden names.

### Packaged and hidden entries are never offered

Packaged ingredients stay findable by typing and stay valid in saved recipes. The app never puts one in
front of a cook as a suggestion, a stand-in, a checklist pick or a "goes with" partner. One predicate,
\`isSuggestable(name, dataset)\` in \`src/data/curation/suggestable.js\`, is applied at these places:

* every "goes with" list (Pairing Lab, the suggestion drawer, the Make-a-recipe suggestions): \`getNeighbors\` and \`getNeighborsEnriched\` in \`src/data/graph.js\`, plus the Flavor Bible partner list in \`PairingMode.jsx\`;
* the invent panels' shortlists, checklist picks and suggestions: \`rankCocktailSlot\`, \`rankSauceSlot\`, \`rankDishSlot\`, and the shared \`shortlist\`, \`suggestNext\` and \`fillRequired\` in \`inventBuild.js\`;
* stand-ins and replacements: \`swapCandidates\` (\`cocktailRiff.js\`), \`sauceReplacements\` (\`inventSauce.js\`), \`findSwap\` (\`kitchenSwaps.js\`);
* Recipe Notebook suggestions, boost and temper: \`rankLogits\` in \`recipeRuntime.js\` (every set-completion suggestion), \`loadSuggestCandidates\` and \`loadReplaceCandidates\` (\`recipeCandidates.js\`), \`rankByAxisImpact\` (\`recipeProfileAnalysis.js\`), and the browse list of the ingredient picker when nothing has been typed.

Hidden names and merged variants are already gone from the curated dataset (DATA-2), so the predicate is a second guard for them.
`;
}

function writeDoc(result, baseline) {
  const b = baseline;
  const ruleRows = [['Check', 'Rule id', 'Baseline total', 'Now (this run)']];
  for (const [id, [, title]] of Object.entries(RULES)) {
    ruleRows.push([title, `\`${id}\``, String(b.metrics[id] ?? 'n/a'), String(result.rules[id].total)]);
  }
  const d = result.details;
  const splitRows = [['Family', 'Members', 'Split by category (most common first)', 'Category the scheme gives it', 'Outside it']];
  for (const s of d.categorySplits) {
    const by = Object.entries(s.byCategory).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n}`).join(', ');
    splitRows.push([s.family, String(s.total), by, s.target.join(' / ') || 'n/a', String(s.outside.length)]);
  }
  const schemeRows = [['Category', 'Ingredients in the generated data', 'Ingredients now (curated)', 'What it holds', 'Three examples']];
  for (const c of CATEGORY_SCHEME) schemeRows.push([`\`${c.category}\``, String(d.categoryCountsRaw[c.category] ?? 0), String(d.categoryCounts[c.category] ?? 0), c.definition, c.examples.join(', ')]);
  const dropped = Object.entries(d.categoryCountsRaw).filter(([c]) => !CATEGORY_SCHEME.some((x) => x.category === c)).map(([c, n]) => `\`${c}\` (${n})`);
  const famRows = [['Cocktail family', 'Drinks', 'Cream or egg drinks']];
  for (const [f, v] of Object.entries(d.cocktailsByFamily)) famRows.push([f, String(v.total), String(v.creamEgg)]);
  const mother = Object.entries(d.sauces.motherSauce).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  const cuisines = Object.entries(d.sauces.cuisine).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ');
  const tasteWordRows = [['Word', 'What it means', 'Examples']];
  for (const w of TASTE_WORDS) tasteWordRows.push([`**${w.word}**`, w.meaning, w.examples.join(', ')]);
  const tasteExampleRows = [['Ingredient', 'Label', 'Why']];
  for (const e of TASTE_EXAMPLES) tasteExampleRows.push([e.name, `\`${e.label}\``, e.why]);
  const tasteRows = [['Category', 'Most used first taste words']];
  for (const [c, dist] of Object.entries(d.tasteDistribution).sort()) tasteRows.push([c, topWords(dist)]);
  const dishRows = [['Cookbook type (what a recipe is called in the Cookbook)', 'Dishes of that type', 'Invent a recipe type that makes it']];
  for (const [id, label] of Object.entries(d.dishes.cookbookTypes)) {
    const inv = d.dishes.inventTypes.filter((i) => i.dishType === id).map((i) => i.label).join(', ') || 'none';
    dishRows.push([`${label} (\`${id}\`)`, String(d.dishes.count[id] ?? 0), inv]);
  }

  const doc = `# Data quality audit

This page is written for the site owner, not for a developer. It says what the data audit
checks, how far to trust it, and where the numbers stood on the day it was first run.

## What the audit is

The audit is a script, \`npm run audit:data\`, that reads the app's own data files and
looks for things that are probably wrong: the same ingredient spelt two ways, things that are
not food, boxed or branded products, ingredients filed under an odd category, odd taste
labels, cocktails filed under the wrong family, and so on. It makes no network call and changes
no data. It writes this page and one list per kind of finding under \`data/review/\`.

Each list has one line per finding with: the item, the rule that flagged it, a confidence
(HIGH means very likely a real problem; LOW means it is often a real distinction a cook would
care about), how many recipes the item appears in (\`use_count\`, so the busiest items can be
reviewed first), a plain description, and a suggested action.

## The limits you should know about

* **The lists are candidates for review, not verdicts.** The rules match patterns in names. A
  pattern cannot tell that "ground beef" really is a different thing from "beef", or that
  "peanut butter" is not a plain fat. A person decides every line.
* **Reviewed non-merges are remembered.** \`data/review/keep.json\` holds names a person has
  decided are different ingredients, with a reason. The audit skips those and reports how many it
  skipped, so the skipping stays visible. (In the latest run: ${result.handled.kept} candidates kept as they are, by ${result.keepListSize} keep-list entries; ${result.handled.aliased} merged, ${result.handled.hidden} hidden and ${result.handled.packaged} flagged packaged through the curation tables.)
* **The cocktail "cream or egg" rule** counts a drink if any line is cream, milk, half and half,
  ice cream, eggnog, Irish cream, or a whole egg or yolk. Egg white alone does not count, because
  it is the foam of a sour. Coconut cream and milk are not counted either.
* **The branded list** is a list in the code (\`BRANDS\` in \`src/data/dataAudit.js\`) that a person
  can extend. Brands missing from it are not found.
* **The taste "first word" check** only compares the first word of each label. Labels hold up to
  three words in no particular order, so this finds oddities, not errors.
* **"Ginger beer", "root beer" and "ginger ale"** are treated as soft drinks, not beer.
* The audit does not look at pairings, positions, models or any other generated file.

## Baseline, ${b.date}

These are the numbers of the last accepted run, as printed (stored in
\`data/review/baseline.json\`, which also keeps the first audit's numbers under \`history\`). The audit run with \`--check\` fails if any count goes above its baseline,
so later clean-up tasks can show the numbers going down and nothing can quietly go up.

${mdTable(ruleRows)}

${(b.notes || []).length ? '### Where the first audit differed from the by-hand critique\n\n' + b.notes.map((n) => `* ${n}`).join('\n') + '\n' : ''}
Data sizes at baseline: ${b.totals.ingredients} ingredients, ${b.totals.cocktails} cocktails,
${b.totals.sauces} sauces, ${b.totals.dishes} Cookbook dishes.

${afterData3(result, b)}
## After DATA-4: one category scheme

Every ingredient has exactly one category, and the list below is the whole scheme. The generated data
(\`public/proDataset/ingredients.json\`) is not edited: the scheme is applied on load by the curation layer
(\`categoryRenames.json\` renames the old \`umami\` category to \`savory seasoning\`, and \`categoryOverrides.json\`
has one line, with a reason, for each ingredient moved). The category rules below are run over the curated data
and must report zero outside the scheme. Old category words in the generated data that the scheme dropped: ${dropped.join(', ') || 'none'}.

${mdTable(schemeRows)}

Four decisions that are not obvious from the names:

* **Citrus juices stay with citrus.** Lemon, lime, orange, grapefruit and yuzu juice are filed under \`citrus\`, and every other juice under \`juice\`. The cocktail sour slot and the sauce acid slot read the \`citrus\` category, and lemon and lime juice must keep working as the sour; moving them would have meant changing those slot rules.
* **Vermouth stays in \`liqueur\`.** It is an aromatised wine, but My bar and the cocktail slots treat it as a liqueur-shelf modifier, so it is not moved into \`wine\`. The audit checks this too (rule \`category-vermouth\`).
* **Every flour is \`grain\`.** Cornstarch, gelatin and other setting agents stay \`thickener\`; a roux or thickener slot finds flour and cornstarch by name.
* **Apple cider is a \`juice\`.** In a recipe it is pressed apple juice. Bare "cider" is filed under \`beer\`.

## Detail from the latest run

Sizes now: ${result.totals.ingredients} ingredients, ${result.totals.cocktails} cocktails, ${result.totals.sauces} sauces, ${result.totals.dishes} dishes.

### Categories: how each family is split (curated data, what the app loads)

${mdTable(splitRows)}

### Cocktail families

${mdTable(famRows)}

### Sauces

${d.sauces.independent} of ${d.sauces.total} sauces are under the catch-all mother sauce "Independent".
Mother sauces: ${mother}. Most common cuisines: ${cuisines}.

### Dish types: the Cookbook's list beside Invent a recipe's list

${mdTable(dishRows)}

### How taste labels are assigned

Every ingredient has a taste label of one to three words, strongest first. These labels are the app's taste data:
the recipe taste charts are drawn from them. There are ten words.

${mdTable(tasteWordRows)}

The rules:

${TASTE_RULES.map((r, i) => `${i + 1}. ${r}`).join(String.fromCharCode(10))}

Worked examples (checked against the data by a test, so this table cannot drift):

${mdTable(tasteExampleRows)}

In the charts, the first word counts fully, the second 0.6 and the third 0.35. Spicy and pungent both count as heat, astringent counts half toward
bitter, and neutral and rich count toward no taste (rich is a mouthfeel, shown on its own if at all). Every correction is one line with its reason in \`src/data/curation/tasteOverrides.json\`.

### Taste labels: which first word each category uses most

Computed on the curated data (the generated data with the curation tables applied), so it shows the current category names.

The known vocabulary is: ${TASTE_VOCAB.join(', ')}.

${mdTable(tasteRows)}
`;
  writeFileSync(DOC_PATH, doc);
}

function loadBaseline() {
  return existsSync(BASELINE_PATH) ? readJson(BASELINE_PATH, 'baseline.json') : null;
}

function main() {
  const result = runAudit();
  if (args.has('--json')) {
    process.stdout.write(JSON.stringify({ ...result, findings: result.findings }, null, 2) + '\n');
    return;
  }
  const c = result.curated;
  if (c.tableProblems.length) {
    console.error('audit:data: the curation tables are invalid:');
    for (const p of c.tableProblems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(summaryTable(result));
  const h = result.handled;
  console.log(`
reviewed, so not counted above: ${h.aliased} aliased, ${h.hidden} hidden, ${h.packaged} flagged packaged, ${h.kept} kept as they are (keep list has ${result.keepListSize} entries); ${h.tasteRead} taste outliers decided by a taste override`);
  console.log(`
curation tables: valid. ingredients raw ${c.ingredients.raw} -> curated ${c.ingredients.curated} (${c.merged} merged, ${c.hidden} hidden, ${c.additions} added; ${c.packaged} flagged packaged; ${c.categoryOverrides} category and ${c.tasteOverrides} taste overrides)` +
    (c.pairings ? `; pairings raw ${c.pairings.raw} -> curated ${c.pairings.curated}` : ''));
  const ag = result.aroma.summary;
  console.log(`aroma table vs second source (six axes): strongest aroma agrees ${ag.agree}/${ag.compared} (${ag.agreePct}%), chef-sourced ${ag.agreeChef}/${ag.comparedChef} (${ag.agreeChefPct}%); unreviewed disagreements ${result.aroma.unreviewed.length}${result.aroma.unreviewed.length ? ': ' + result.aroma.unreviewed.join(', ') : ''}; data/review/aroma-accepted.json problems ${result.aroma.problems.length}`);
  console.log(`sauces under 'Independent': ${result.details.sauces.independent} of ${result.details.sauces.total} (${result.metrics['sauce-independent-share-percent']}%)`);

  if (args.has('--check')) {
    const base = loadBaseline();
    if (!base) fail('no baseline: data/review/baseline.json is missing');
    const over = Object.entries(base.metrics).filter(([k, v]) => (result.metrics[k] ?? 0) > v);
    if (over.length) {
      console.error('\nCHECK FAILED: above baseline:');
      for (const [k, v] of over) console.error(`  ${k}: ${result.metrics[k]} (baseline ${v})`);
      process.exit(1);
    }
    console.log('\ncheck passed: no count is above the baseline');
    return;
  }

  let baseline = loadBaseline();
  if (!baseline || args.has('--update-baseline')) {
    const history = baseline
      ? [...(baseline.history || [{ label: 'DATA-1', date: baseline.date, totals: baseline.totals, metrics: baseline.metrics }])]
      : [];
    baseline = {
      date: new Date().toISOString().slice(0, 10),
      totals: result.totals,
      metrics: result.metrics,
      notes: baseline?.notes || [],
      history,
    };
    mkdirSync(REVIEW_DIR, { recursive: true });
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`\nbaseline written: ${BASELINE_PATH}`);
  }
  writeReviewFiles(result);
  writeDoc(result, baseline);
  console.log(`wrote ${REVIEW_FILES.length} review lists under data/review/ and docs/data-quality.md`);
}

main();
