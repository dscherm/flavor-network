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
// 2b. Deep unit tests — computeCompatibility
// ---------------------------------------------------------------------------

console.log('\n2b. computeCompatibility (detailed)...');

// 0 ingredients => 0
assert(computeCompatibility([], testEdges) === 0, 'computeCompatibility: 0 ingredients returns 0');

// 1 ingredient => 0 (need at least 2 for a pair)
assert(computeCompatibility(['gin'], testEdges) === 0, 'computeCompatibility: 1 ingredient returns 0');

// 2 ingredients with a known pairing (gin+lime, strength 0.8 => 0.8/1*10 = 8.0)
const score2 = computeCompatibility(['gin', 'lime'], testEdges);
assert(score2 === 8, `computeCompatibility: 2 known ingredients = ${score2} (expected 8)`);

// 2 ingredients with no pairing in edges
const score2None = computeCompatibility(['gin', 'vodka'], testEdges);
assert(score2None === 0, `computeCompatibility: 2 unmatched ingredients = ${score2None} (expected 0)`);

// 3 ingredients — average of 3 pairs: gin-lime(0.8), gin-tonic(0.9), lime-tonic(0.6) => avg 0.7667 => *10 = 7.7
const score3 = computeCompatibility(['gin', 'lime', 'tonic water'], testEdges);
assert(score3 > 7 && score3 < 8, `computeCompatibility: 3 ingredients = ${score3} (expected ~7.7)`);

// With adjacency map — same result
const { buildAdjacencyMap } = await import(
  `file://${path.join(__dirname, '..', 'src', 'data', 'cocktailGraph.js').replace(/\\/g, '/')}`
);
const testAdj = buildAdjacencyMap(testEdges);
const score3Adj = computeCompatibility(['gin', 'lime', 'tonic water'], testEdges, testAdj);
assert(score3Adj === score3, `computeCompatibility: adjacency map path matches linear scan (${score3Adj} vs ${score3})`);

// ---------------------------------------------------------------------------
// 2c. Deep unit tests — detectCodexTemplate
// ---------------------------------------------------------------------------

console.log('\n2c. detectCodexTemplate (detailed)...');

// Empty array => null
assert(detectCodexTemplate([], mockNodes) === null, 'detectCodexTemplate: empty array returns null');

// Old Fashioned: Spirit + Sweetener + Bitters => 100% confidence
const ofNodes2 = new Map([
  ['bourbon', { cocktailCategory: 'Spirit' }],
  ['simple syrup', { cocktailCategory: 'Sweetener' }],
  ['angostura bitters', { cocktailCategory: 'Bitters' }],
]);
const ofResult = detectCodexTemplate(['bourbon', 'simple syrup', 'angostura bitters'], ofNodes2);
assert(ofResult !== null, 'detectCodexTemplate: Old Fashioned detected');
assert(ofResult?.name === 'Old Fashioned', `detectCodexTemplate: OF name = ${ofResult?.name}`);
assert(ofResult?.confidence === 100, `detectCodexTemplate: OF confidence = ${ofResult?.confidence} (expected 100)`);
assert(ofResult?.missingRoles.length === 0, 'detectCodexTemplate: OF has no missing roles');
assert(ofResult?.technique === 'stirred', `detectCodexTemplate: OF technique = ${ofResult?.technique}`);

// Sour / Daiquiri: Spirit + Citrus + Sweetener
const sourNodes = new Map([
  ['gin', { cocktailCategory: 'Spirit' }],
  ['lemon juice', { cocktailCategory: 'Citrus' }],
  ['simple syrup', { cocktailCategory: 'Sweetener' }],
]);
const sourResult = detectCodexTemplate(['gin', 'lemon juice', 'simple syrup'], sourNodes);
assert(sourResult !== null, 'detectCodexTemplate: Sour template detected');
assert(sourResult?.name === 'Daiquiri', `detectCodexTemplate: Sour name = ${sourResult?.name} (expected Daiquiri)`);
assert(sourResult?.confidence === 100, `detectCodexTemplate: Sour confidence = ${sourResult?.confidence}`);
assert(sourResult?.technique === 'shaken', `detectCodexTemplate: Sour technique = ${sourResult?.technique}`);

// Null nodes => null
assert(detectCodexTemplate(['gin'], null) === null, 'detectCodexTemplate: null nodes returns null');

// ---------------------------------------------------------------------------
// 2d. Deep unit tests — suggestNextIngredients
// ---------------------------------------------------------------------------

console.log('\n2d. suggestNextIngredients (detailed)...');

// Build richer test data for suggestions
const suggestEdges = [
  { source: 'gin', target: 'lime', strength: 0.8 },
  { source: 'gin', target: 'tonic water', strength: 0.9 },
  { source: 'gin', target: 'dry vermouth', strength: 0.7 },
  { source: 'gin', target: 'simple syrup', strength: 0.5 },
  { source: 'lime', target: 'simple syrup', strength: 0.6 },
];
const suggestNodes = new Map([
  ['gin', { cocktailCategory: 'Spirit' }],
  ['lime', { cocktailCategory: 'Citrus' }],
  ['tonic water', { cocktailCategory: 'Lengthener' }],
  ['dry vermouth', { cocktailCategory: 'Vermouth' }],
  ['simple syrup', { cocktailCategory: 'Sweetener' }],
]);

// Results are sorted descending by score
const sugg1 = suggestNextIngredients(['gin'], suggestNodes, suggestEdges);
assert(sugg1.length > 0, `suggestNextIngredients: got ${sugg1.length} results`);
for (let i = 1; i < sugg1.length; i++) {
  assert(sugg1[i - 1].score >= sugg1[i].score,
    `suggestNextIngredients: sorted descending at index ${i} (${sugg1[i - 1].score} >= ${sugg1[i].score})`);
}

// Tonic water should be top suggestion (highest strength 0.9)
assert(sugg1[0].name === 'tonic water',
  `suggestNextIngredients: top suggestion = ${sugg1[0].name} (expected tonic water)`);

// Each result has required fields
for (const s of sugg1) {
  assert(typeof s.name === 'string', `suggestion has name: ${s.name}`);
  assert(typeof s.score === 'number', `suggestion has score: ${s.score}`);
  assert(typeof s.category === 'string', `suggestion has category: ${s.category}`);
  assert(typeof s.reason === 'string', `suggestion has reason: ${s.reason}`);
}

// Does not include already-selected ingredients
assert(!sugg1.some(s => s.name === 'gin'), 'suggestNextIngredients: excludes selected ingredients');

// Role priority: when a template has missing roles, those get a bonus
// Start with Spirit + Citrus => Daiquiri missing Sweetener => simple syrup should get a role bonus
const sugg2 = suggestNextIngredients(['gin', 'lime'], suggestNodes, suggestEdges);
const syrupResult = sugg2.find(s => s.name === 'simple syrup');
assert(syrupResult !== undefined, 'suggestNextIngredients: simple syrup appears in suggestions');
assert(syrupResult?.reason?.includes('Sweetener'),
  `suggestNextIngredients: simple syrup reason mentions Sweetener role (got: ${syrupResult?.reason})`);

// Empty / null guards
assert(suggestNextIngredients([], suggestNodes, suggestEdges).length === 0,
  'suggestNextIngredients: empty ingredients returns empty');
assert(suggestNextIngredients(['gin'], null, suggestEdges).length === 0,
  'suggestNextIngredients: null nodes returns empty');
assert(suggestNextIngredients(['gin'], suggestNodes, null).length === 0,
  'suggestNextIngredients: null edges returns empty');

// ---------------------------------------------------------------------------
// 2e. Deep unit tests — buildAdjacencyMap
// ---------------------------------------------------------------------------

console.log('\n2e. buildAdjacencyMap (detailed)...');

const adjEdges = [
  { source: 'gin', target: 'lime', strength: 0.8 },
  { source: 'gin', target: 'tonic water', strength: 0.9 },
  { source: 'lime', target: 'tonic water', strength: 0.6 },
];
const adj = buildAdjacencyMap(adjEdges);

// Returns a Map
assert(adj instanceof Map, 'buildAdjacencyMap: returns a Map');

// All nodes present as keys
assert(adj.has('gin'), 'buildAdjacencyMap: has gin');
assert(adj.has('lime'), 'buildAdjacencyMap: has lime');
assert(adj.has('tonic water'), 'buildAdjacencyMap: has tonic water');

// Each value is a Map
assert(adj.get('gin') instanceof Map, 'buildAdjacencyMap: gin value is a Map');

// Correct strengths
assert(adj.get('gin').get('lime') === 0.8, `buildAdjacencyMap: gin->lime = ${adj.get('gin').get('lime')}`);
assert(adj.get('gin').get('tonic water') === 0.9, `buildAdjacencyMap: gin->tonic = ${adj.get('gin').get('tonic water')}`);

// Bidirectional: lime->gin should equal gin->lime
assert(adj.get('lime').get('gin') === 0.8, `buildAdjacencyMap: lime->gin = ${adj.get('lime').get('gin')} (bidirectional)`);
assert(adj.get('tonic water').get('gin') === 0.9, `buildAdjacencyMap: tonic->gin = ${adj.get('tonic water').get('gin')} (bidirectional)`);
assert(adj.get('tonic water').get('lime') === 0.6, `buildAdjacencyMap: tonic->lime = ${adj.get('tonic water').get('lime')} (bidirectional)`);

// Empty edges => empty Map
const adjEmpty = buildAdjacencyMap([]);
assert(adjEmpty instanceof Map && adjEmpty.size === 0, 'buildAdjacencyMap: empty edges returns empty Map');

// Neighbor count is correct (gin has 2 neighbors)
assert(adj.get('gin').size === 2, `buildAdjacencyMap: gin has ${adj.get('gin').size} neighbors (expected 2)`);

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
