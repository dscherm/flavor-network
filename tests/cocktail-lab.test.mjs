/**
 * Cocktail Lab integration test — validates cocktail graph construction,
 * Codex positioning, scoring, and template detection.
 *
 * Run: node tests/cocktail-lab.test.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.log(`  FAIL: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Cocktail augment data exists and is valid
// ---------------------------------------------------------------------------

console.log('\n1. Cocktail augment data...');
const augmentPath = path.join(__dirname, '..', 'public', 'data', 'cocktail_augment.json');
assert(fs.existsSync(augmentPath), 'cocktail_augment.json exists');

const augment = JSON.parse(fs.readFileSync(augmentPath, 'utf-8'));
assert(Array.isArray(augment.ingredients), 'augment has ingredients array');
assert(augment.ingredients.length > 20, `augment has ${augment.ingredients.length} ingredients (expected >20)`);
assert(Array.isArray(augment.pairings), 'augment has pairings array');
assert(augment.pairings.length > 50, `augment has ${augment.pairings.length} pairings (expected >50)`);

// Validate ingredient structure
for (const ing of augment.ingredients) {
  assert(typeof ing.name === 'string' && ing.name.length > 0, `ingredient has name: ${ing.name}`);
  if (passed > 50) break; // Don't spam
}

// Validate edge structure
for (const edge of augment.pairings.slice(0, 10)) {
  assert(typeof edge.source === 'string', `edge has source: ${edge.source}`);
  assert(typeof edge.target === 'string', `edge has target: ${edge.target}`);
  assert(typeof edge.strength === 'number' && edge.strength >= 0 && edge.strength <= 1,
    `edge strength valid: ${edge.strength}`);
}

// ---------------------------------------------------------------------------
// 2. Cocktail scoring functions
// ---------------------------------------------------------------------------

console.log('\n2. Cocktail scoring...');

// Import scoring functions (ESM)
const scoringPath = path.join(__dirname, '..', 'src', 'data', 'cocktailScoring.js');
assert(fs.existsSync(scoringPath), 'cocktailScoring.js exists');

const { computeCompatibility, detectCodexTemplate, suggestNextIngredients, CODEX_TEMPLATES } =
  await import(`file://${scoringPath.replace(/\\/g, '/')}`);

// Test computeCompatibility
assert(typeof computeCompatibility === 'function', 'computeCompatibility is a function');
assert(computeCompatibility([], []) === 0, 'empty ingredients = 0 score');
assert(computeCompatibility(['a'], []) === 0, 'single ingredient = 0 score');

const testEdges = [
  { source: 'gin', target: 'lime', strength: 0.8 },
  { source: 'gin', target: 'tonic water', strength: 0.9 },
  { source: 'lime', target: 'tonic water', strength: 0.6 },
];
const score = computeCompatibility(['gin', 'lime', 'tonic water'], testEdges);
assert(score > 0, `3-ingredient compatibility = ${score} (expected > 0)`);

// Test detectCodexTemplate
assert(typeof detectCodexTemplate === 'function', 'detectCodexTemplate is a function');
assert(CODEX_TEMPLATES.length === 6, `6 Codex templates defined (got ${CODEX_TEMPLATES.length})`);

const mockNodes = new Map([
  ['gin', { cocktailCategory: 'Spirit' }],
  ['dry vermouth', { cocktailCategory: 'Vermouth' }],
  ['angostura bitters', { cocktailCategory: 'Bitters' }],
]);
const template = detectCodexTemplate(['gin', 'dry vermouth', 'angostura bitters'], mockNodes);
assert(template !== null, 'Martini template detected');
assert(template?.name === 'Martini', `template = ${template?.name} (expected Martini)`);

// Test Old Fashioned detection
const ofNodes = new Map([
  ['bourbon', { cocktailCategory: 'Spirit' }],
  ['simple syrup', { cocktailCategory: 'Sweetener' }],
  ['angostura bitters', { cocktailCategory: 'Bitters' }],
]);
const ofTemplate = detectCodexTemplate(['bourbon', 'simple syrup', 'angostura bitters'], ofNodes);
assert(ofTemplate?.name === 'Old Fashioned', `OF template = ${ofTemplate?.name}`);

// Test suggestNextIngredients
assert(typeof suggestNextIngredients === 'function', 'suggestNextIngredients is a function');
const suggestions = suggestNextIngredients(['gin'], mockNodes, testEdges);
assert(Array.isArray(suggestions), 'suggestions is an array');

// ---------------------------------------------------------------------------
// 3. Cocktail data module
// ---------------------------------------------------------------------------

console.log('\n3. Cocktail data module...');
const dataPath = path.join(__dirname, '..', 'src', 'data', 'cocktailData.js');
assert(fs.existsSync(dataPath), 'cocktailData.js exists');

const { COCKTAIL_CATEGORIES } = await import(`file://${dataPath.replace(/\\/g, '/')}`);
assert(typeof COCKTAIL_CATEGORIES === 'object', 'COCKTAIL_CATEGORIES exists');
assert(Object.keys(COCKTAIL_CATEGORIES).length >= 10, `${Object.keys(COCKTAIL_CATEGORIES).length} categories (expected >=10)`);

// Verify required categories
for (const cat of ['Spirit', 'Liqueur', 'Bitters', 'Sweetener', 'Citrus', 'Lengthener']) {
  assert(cat in COCKTAIL_CATEGORIES, `category "${cat}" exists`);
}

// ---------------------------------------------------------------------------
// 4. Cocktail positioning module
// ---------------------------------------------------------------------------

console.log('\n4. Cocktail positioning...');
const posPath = path.join(__dirname, '..', 'src', 'data', 'cocktailPositioning.js');
assert(fs.existsSync(posPath), 'cocktailPositioning.js exists');

// ---------------------------------------------------------------------------
// 5. Component files exist
// ---------------------------------------------------------------------------

console.log('\n5. Component files...');
const components = [
  'CocktailLab.jsx',
  'CocktailPanel.jsx',
  'CocktailRecipeCard.jsx',
  'CocktailBuilder.jsx',
  'CocktailCard.jsx',
];
for (const comp of components) {
  const compPath = path.join(__dirname, '..', 'src', 'components', comp);
  assert(fs.existsSync(compPath), `${comp} exists`);
}

// ---------------------------------------------------------------------------
// 6. Hook files exist
// ---------------------------------------------------------------------------

console.log('\n6. Hook files...');
const hookPath = path.join(__dirname, '..', 'src', 'hooks', 'useCocktailDB.js');
assert(fs.existsSync(hookPath), 'useCocktailDB.js exists');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('All tests passed!');
}
