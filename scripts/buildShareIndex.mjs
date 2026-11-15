// SHARE-4. Writes the small index the sharePreview Cloud Function uses to fill in
// link previews for built-in recipes, so the function does not bundle the app's
// data modules. Slugs come from src/data/sharedRecipe.js (the same code the
// /r/ page uses). Runs in `prebuild` and in the functions predeploy; the output
// is committed so functions tests and deploys never depend on run order.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveBuiltIn, slugFor, uniqueBySlug } from '../src/data/sharedRecipe.js';
import { SEED_RECIPES } from '../src/data/seedRecipes.js';
import { RECIPE_DETAILS } from '../src/data/seedRecipeDetails.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT_PATH = resolve(ROOT, 'functions/src/share/share-index.json');
const SITE = 'Neural Flavor';
const NOUN = { cocktail: 'cocktail', sauce: 'sauce', dish: 'dish' };
const MAX_DESC = 160;

const readJson = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function describe(kind, lines) {
  const names = [];
  for (const l of lines) {
    const n = String(l.label || l.key || '').trim();
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
    if (names.length === 4) break;
  }
  const tail = ` A ${NOUN[kind]} on ${SITE}.`;
  while (names.length) {
    const head = cap(names.join(", ").toLowerCase()) + ".";
    const out = head + tail;
    if (out.length <= MAX_DESC) return out;
    names.pop();
  }
  return `A ${NOUN[kind]} on ${SITE}.`;
}

export function buildShareIndex() {
  const codex = readJson('public/data/cocktail_codex_v2.json');
  const sauces = readJson('public/data/sauce_augment.json').sauces || [];
  const data = {
    cocktails: codex.cocktails || [], families: codex.families || [],
    sauces, dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS,
  };
  const index = {};
  const lists = { cocktail: data.cocktails, sauce: data.sauces, dish: data.dishes };
  for (const kind of Object.keys(lists)) {
    for (const item of uniqueBySlug(kind, lists[kind])) {
      const slug = slugFor(kind, item);
      const r = resolveBuiltIn(kind, slug, data);
      if (!r) continue;
      index[`${kind}/${slug}`] = { name: r.name, description: describe(kind, r.lines), kind };
    }
  }
  return index;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = buildShareIndex();
  const sorted = Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]));
  writeFileSync(OUT_PATH, JSON.stringify(sorted) + '\n');
  console.log(`share index: ${Object.keys(sorted).length} recipes -> ${OUT_PATH}`);
}
