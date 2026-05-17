/**
 * Extract COMPOUND_FOODS + SUBSTITUTES from src/data/compoundFoods.js
 * into a JSON file that the Python flavor-layout pipeline can consume.
 *
 * Run from project root:
 *   node flavor-gnn/scripts/extract-compound-foods.mjs
 *
 * Re-run whenever compoundFoods.js changes. The output is committed
 * alongside the JS source so the build pipeline doesn't need to invoke
 * node from inside Python.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

const modPath = resolve(ROOT, 'src', 'data', 'compoundFoods.js');
const mod = await import('file://' + modPath.replaceAll('\\', '/'));

// COMPOUND_FOODS is exported; SUBSTITUTES isn't — re-import the source
// text and extract SUBSTITUTES via a tiny eval-in-context. The file is
// authored as plain ESM with a const SUBSTITUTES literal at the top.
import { readFileSync } from 'node:fs';
const src = readFileSync(modPath, 'utf-8');

// Pull out the SUBSTITUTES object literal. Bounded by `const SUBSTITUTES = {`
// and the matching closing `};`. Simple bracket walk.
function extractObjectLiteral(text, marker) {
  const start = text.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  const braceStart = text.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(braceStart, i + 1);
    }
  }
  throw new Error(`unbalanced braces for ${marker}`);
}

const substLiteral = extractObjectLiteral(src, 'const SUBSTITUTES =');
// Use Function() rather than eval so we don't pollute global scope.
const SUBSTITUTES = new Function(`return ${substLiteral};`)();

const out = {
  _meta: {
    source: 'src/data/compoundFoods.js',
    extracted_at: new Date().toISOString(),
    n_compound_foods: Object.keys(mod.COMPOUND_FOODS).length,
    n_substitutes: Object.keys(SUBSTITUTES).length,
    schema: {
      compound_foods: 'name → { constituents: {ingredient: weight}, description, aliasOf?, forceCompound? }',
      substitutes: 'missing-from-GNN ingredient → flavor-similar GNN-having alias',
    },
  },
  compound_foods: mod.COMPOUND_FOODS,
  substitutes: SUBSTITUTES,
};

const outPath = resolve(ROOT, 'public', 'proDataset', 'compound_foods.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
console.log(`wrote ${outPath}`);
console.log(`  ${out._meta.n_compound_foods} compound foods, ${out._meta.n_substitutes} substitutes`);
