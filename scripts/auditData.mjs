// DATA-1. Repeatable data audit. Reads repo files only (no network), changes no data file.
//
//   npm run audit:data                    print the summary, write data/review/*.tsv and docs/data-quality.md
//   npm run audit:data -- --json          print the full result as JSON (writes nothing)
//   npm run audit:data -- --check         exit 1 if any count is ABOVE data/review/baseline.json (writes nothing)
//   npm run audit:data -- --update-baseline   store this run's counts as the new baseline
//
// Exit code is non-zero only for a missing or malformed input, or a failed --check.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findDuplicates, findNonFood, findPackaged, findCategoryInconsistencies, categorySplits,
  findTasteNeutralSweet, findTasteVocabulary, findTasteOutliers, tasteDistribution,
  cocktailChecks, sauceChecks, dishChecks, TASTE_VOCAB,
} from '../src/data/dataAudit.js';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { dishTypeOf, DISH_TYPES } from '../src/data/dishType.js';
import { DISH_SKELETONS, DISH_SKELETON_ORDER } from '../src/data/dishSkeletons.js';

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
  'category-cheese': ['category', 'Category: a cheese outside the usual cheese category'],
  'category-juice': ['category', 'Category: a juice outside the usual juice category'],
  'category-flour': ['category', 'Category: a flour outside the usual flour category'],
  'category-wine': ['category', 'Category: a wine outside the usual wine category'],
  'category-beer': ['category', 'Category: a beer or cider outside the usual category'],
  'category-spirit': ['category', 'Category: a spirit outside the usual spirit category'],
  'category-umami': ['category', "Category: filed under 'umami' (a taste, not a kind of food)"],
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

  const dupsAll = findDuplicates(ingredients, { keep: new Set() });
  const dups = findDuplicates(ingredients, { keep });
  const suppressed = dupsAll.length - dups.length;

  const dishTypes = Object.fromEntries(SEED_RECIPES.map((r) => [r.name, dishTypeOf(r)]));
  const inventTypes = DISH_SKELETON_ORDER.map((id) => ({ id, label: DISH_SKELETONS[id].label, dishType: DISH_SKELETONS[id].dishType }));
  const cocktail = cocktailChecks(codex);
  const sauce = sauceChecks(sauces);
  const dish = dishChecks({ dishTypes, cookbookTypes: DISH_TYPES, inventTypes });

  const findings = [
    ...dups, ...findNonFood(ingredients), ...findPackaged(ingredients), ...findCategoryInconsistencies(ingredients),
    ...findTasteNeutralSweet(ingredients), ...findTasteVocabulary(ingredients), ...findTasteOutliers(ingredients),
    ...cocktail.findings, ...sauce.findings, ...dish.findings,
  ];
  const isIngredientRule = (r) => /^(duplicate|non-food|fragment|packaged|category|taste)/.test(r);
  for (const f of findings) {
    f.useCount = isIngredientRule(f.rule) ? (ingredients[f.item]?.totalCount ?? 0) : '';
  }

  const rules = {};
  for (const id of Object.keys(RULES)) rules[id] = { total: 0, HIGH: 0, LOW: 0 };
  for (const f of findings) {
    if (!rules[f.rule]) rules[f.rule] = { total: 0, HIGH: 0, LOW: 0 };
    rules[f.rule].total += 1;
    rules[f.rule][f.confidence] += 1;
  }

  const metrics = Object.fromEntries(Object.entries(rules).map(([id, r]) => [id, r.total]));
  metrics['sauce-independent-share-percent'] = sauce.total ? Math.round((100 * sauce.independent) / sauce.total) : 0;

  return {
    totals: { ingredients: Object.keys(ingredients).length, cocktails: codex.cocktails.length, sauces: sauces.length, dishes: SEED_RECIPES.length },
    findings, rules, metrics, suppressedByKeepList: suppressed, keepListSize: keep.size,
    details: {
      categorySplits: categorySplits(ingredients),
      tasteDistribution: tasteDistribution(ingredients),
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

function writeDoc(result, baseline) {
  const b = baseline;
  const ruleRows = [['Check', 'Rule id', 'Baseline total', 'Now (this run)']];
  for (const [id, [, title]] of Object.entries(RULES)) {
    ruleRows.push([title, `\`${id}\``, String(b.metrics[id] ?? 'n/a'), String(result.rules[id].total)]);
  }
  const d = result.details;
  const splitRows = [['Family', 'Members', 'Split by category (most common first)', 'Outside the most common']];
  for (const s of d.categorySplits) {
    const by = Object.entries(s.byCategory).sort((x, y) => y[1] - x[1]).map(([c, n]) => `${c} ${n}`).join(', ');
    splitRows.push([s.family, String(s.total), by, String(s.minority.length)]);
  }
  const famRows = [['Cocktail family', 'Drinks', 'Cream or egg drinks']];
  for (const [f, v] of Object.entries(d.cocktailsByFamily)) famRows.push([f, String(v.total), String(v.creamEgg)]);
  const mother = Object.entries(d.sauces.motherSauce).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(', ');
  const cuisines = Object.entries(d.sauces.cuisine).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ');
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
  skipped, so the skipping stays visible. (In the latest run: ${result.suppressedByKeepList} candidates suppressed by ${result.keepListSize} keep-list entries.)
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

These are the numbers exactly as the first run printed them (stored in
\`data/review/baseline.json\`). The audit run with \`--check\` fails if any count goes above its baseline,
so later clean-up tasks can show the numbers going down and nothing can quietly go up.

${mdTable(ruleRows)}

${(b.notes || []).length ? '### Where these differ from the first, by-hand critique\n\n' + b.notes.map((n) => `* ${n}`).join('\n') + '\n' : ''}
Data sizes at baseline: ${b.totals.ingredients} ingredients, ${b.totals.cocktails} cocktails,
${b.totals.sauces} sauces, ${b.totals.dishes} Cookbook dishes.

## Detail from the latest run

Sizes now: ${result.totals.ingredients} ingredients, ${result.totals.cocktails} cocktails, ${result.totals.sauces} sauces, ${result.totals.dishes} dishes.

### Categories: how each family is split

${mdTable(splitRows)}

### Cocktail families

${mdTable(famRows)}

### Sauces

${d.sauces.independent} of ${d.sauces.total} sauces are under the catch-all mother sauce "Independent".
Mother sauces: ${mother}. Most common cuisines: ${cuisines}.

### Dish types: the Cookbook's list beside Invent a recipe's list

${mdTable(dishRows)}

### Taste labels: which first word each category uses most

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
  console.log(summaryTable(result));
  console.log(`\nsuppressed by keep list: ${result.suppressedByKeepList} (keep list has ${result.keepListSize} entries)`);
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
    baseline = {
      date: new Date().toISOString().slice(0, 10),
      totals: result.totals,
      metrics: result.metrics,
      notes: baseline?.notes || [],
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
