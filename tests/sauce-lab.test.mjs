/**
 * Sauce Lab integration test — validates sauce graph construction,
 * scoring, template detection, and suggestions.
 *
 * Run: node tests/sauce-lab.test.mjs
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
// 1. Sauce augment data exists and is valid
// ---------------------------------------------------------------------------

console.log('\n1. Sauce augment data...');
const augmentPath = path.join(__dirname, '..', 'public', 'data', 'sauce_augment.json');
assert(fs.existsSync(augmentPath), 'sauce_augment.json exists');

const augment = JSON.parse(fs.readFileSync(augmentPath, 'utf-8'));
assert(Array.isArray(augment.ingredients), 'augment has ingredients array');
assert(augment.ingredients.length > 20, `augment has ${augment.ingredients.length} ingredients (expected >20)`);
assert(Array.isArray(augment.pairings), 'augment has pairings array');
assert(augment.pairings.length > 50, `augment has ${augment.pairings.length} pairings (expected >50)`);

// Validate ingredient structure
for (const ing of augment.ingredients.slice(0, 10)) {
  assert(typeof ing.name === 'string' && ing.name.length > 0, `ingredient has name: ${ing.name}`);
}

// Validate edge structure
for (const edge of augment.pairings.slice(0, 10)) {
  assert(typeof edge.source === 'string', `edge has source: ${edge.source}`);
  assert(typeof edge.target === 'string', `edge has target: ${edge.target}`);
  assert(typeof edge.strength === 'number' && edge.strength >= 0 && edge.strength <= 1,
    `edge strength valid: ${edge.strength}`);
}

// ---------------------------------------------------------------------------
// 2. Sauce scoring functions
// ---------------------------------------------------------------------------

console.log('\n2. Sauce scoring...');

const scoringPath = path.join(__dirname, '..', 'src', 'data', 'sauceScoring.js');
assert(fs.existsSync(scoringPath), 'sauceScoring.js exists');

const { computeCompatibility, detectSauceTemplate, suggestNextIngredients, SAUCE_TEMPLATES } =
  await import(`file://${scoringPath.replace(/\\/g, '/')}`);

assert(typeof computeCompatibility === 'function', 'computeCompatibility is a function');
assert(typeof detectSauceTemplate === 'function', 'detectSauceTemplate is a function');
assert(typeof suggestNextIngredients === 'function', 'suggestNextIngredients is a function');
assert(Array.isArray(SAUCE_TEMPLATES), 'SAUCE_TEMPLATES is an array');
assert(SAUCE_TEMPLATES.length >= 10, `${SAUCE_TEMPLATES.length} sauce templates (expected >=10)`);

// ---------------------------------------------------------------------------
// 2a. computeCompatibility — detailed
// ---------------------------------------------------------------------------

console.log('\n2a. computeCompatibility (detailed)...');

const testEdges = [
  { source: 'butter', target: 'flour', strength: 0.8 },
  { source: 'butter', target: 'milk', strength: 0.7 },
  { source: 'flour', target: 'milk', strength: 0.6 },
  { source: 'butter', target: 'lemon juice', strength: 0.5 },
  { source: 'egg yolk', target: 'butter', strength: 0.9 },
  { source: 'egg yolk', target: 'lemon juice', strength: 0.7 },
];

// 0 ingredients => 0
assert(computeCompatibility([], testEdges) === 0, 'computeCompatibility: 0 ingredients returns 0');

// 1 ingredient => 0 (need at least 2 for a pair)
assert(computeCompatibility(['butter'], testEdges) === 0, 'computeCompatibility: 1 ingredient returns 0');

// 2 ingredients with a known pairing (butter+flour, strength 0.8 => 0.8/1*10 = 8.0)
const score2 = computeCompatibility(['butter', 'flour'], testEdges);
assert(score2 === 8, `computeCompatibility: 2 known ingredients = ${score2} (expected 8)`);

// 2 ingredients with no pairing in edges
const score2None = computeCompatibility(['butter', 'garlic'], testEdges);
assert(score2None === 0, `computeCompatibility: 2 unmatched ingredients = ${score2None} (expected 0)`);

// 3 ingredients — average of 3 pairs: butter-flour(0.8), butter-milk(0.7), flour-milk(0.6) => avg 0.7 => *10 = 7.0
const score3 = computeCompatibility(['butter', 'flour', 'milk'], testEdges);
assert(score3 === 7, `computeCompatibility: 3 ingredients = ${score3} (expected 7)`);

// With adjacency map — same result
const { buildAdjacencyMap } = await import(
  `file://${path.join(__dirname, '..', 'src', 'data', 'sauceGraph.js').replace(/\\/g, '/')}`
);
const testAdj = buildAdjacencyMap(testEdges);
const score3Adj = computeCompatibility(['butter', 'flour', 'milk'], testEdges, testAdj);
assert(score3Adj === score3, `computeCompatibility: adjacency map path matches linear scan (${score3Adj} vs ${score3})`);

// null/undefined guards
assert(computeCompatibility(null, testEdges) === 0, 'computeCompatibility: null ingredients returns 0');
assert(computeCompatibility(['a', 'b'], null) === 0, 'computeCompatibility: null edges returns 0');

// ---------------------------------------------------------------------------
// 2b. detectSauceTemplate — detailed
// ---------------------------------------------------------------------------

console.log('\n2b. detectSauceTemplate (detailed)...');

// Empty array => null
assert(detectSauceTemplate([], new Map()) === null, 'detectSauceTemplate: empty array returns null');

// Null nodes => null
assert(detectSauceTemplate(['butter'], null) === null, 'detectSauceTemplate: null nodes returns null');

// Bechamel: Fat + Thickener + Liquid => should match Bechamel or Veloute
const bechamelNodes = new Map([
  ['butter', { sauceCategory: 'Fat' }],
  ['flour', { sauceCategory: 'Thickener' }],
  ['milk', { sauceCategory: 'Liquid' }],
]);
const bechamelResult = detectSauceTemplate(['butter', 'flour', 'milk'], bechamelNodes);
assert(bechamelResult !== null, 'detectSauceTemplate: Bechamel detected');
assert(
  bechamelResult?.name === 'Béchamel' || bechamelResult?.name === 'Velouté',
  `detectSauceTemplate: Bechamel template name = ${bechamelResult?.name} (expected Bechamel or Veloute)`
);
assert(bechamelResult?.confidence === 100, `detectSauceTemplate: Bechamel confidence = ${bechamelResult?.confidence} (expected 100)`);
assert(bechamelResult?.missingRoles.length === 0, 'detectSauceTemplate: Bechamel has no missing roles');
assert(bechamelResult?.technique === 'roux', `detectSauceTemplate: Bechamel technique = ${bechamelResult?.technique} (expected roux)`);

// Hollandaise: Fat + Thickener + Acid
const hollandaiseNodes = new Map([
  ['butter', { sauceCategory: 'Fat' }],
  ['egg yolk', { sauceCategory: 'Thickener' }],
  ['lemon juice', { sauceCategory: 'Acid' }],
]);
const hollandaiseResult = detectSauceTemplate(['butter', 'egg yolk', 'lemon juice'], hollandaiseNodes);
assert(hollandaiseResult !== null, 'detectSauceTemplate: Hollandaise detected');
assert(hollandaiseResult?.name === 'Hollandaise', `detectSauceTemplate: Hollandaise name = ${hollandaiseResult?.name}`);
assert(hollandaiseResult?.confidence === 100, `detectSauceTemplate: Hollandaise confidence = ${hollandaiseResult?.confidence}`);
assert(hollandaiseResult?.technique === 'emulsification', `detectSauceTemplate: Hollandaise technique = ${hollandaiseResult?.technique}`);

// Template result shape: must have name, description, confidence, missingRoles, technique
assert(typeof hollandaiseResult.name === 'string', 'detectSauceTemplate: result has name');
assert(typeof hollandaiseResult.description === 'string', 'detectSauceTemplate: result has description');
assert(typeof hollandaiseResult.confidence === 'number', 'detectSauceTemplate: result has confidence');
assert(Array.isArray(hollandaiseResult.missingRoles), 'detectSauceTemplate: result has missingRoles');
assert(typeof hollandaiseResult.technique === 'string', 'detectSauceTemplate: result has technique');

// Low confidence => null (below 33% threshold)
const weakNodes = new Map([
  ['salt', { sauceCategory: 'Seasoning' }],
]);
const weakResult = detectSauceTemplate(['salt'], weakNodes);
// Seasoning alone should only partially match some templates; depends on threshold
// Any template needing 4+ roles will be <33% with 1 match => may return null
// But templates with 2 roles where Seasoning is one could hit 50%. Let's just check it handles gracefully.
if (weakResult !== null) {
  assert(weakResult.confidence >= 33, `detectSauceTemplate: weak result confidence = ${weakResult.confidence} (must be >= 33)`);
}

// ---------------------------------------------------------------------------
// 2c. suggestNextIngredients — detailed
// ---------------------------------------------------------------------------

console.log('\n2c. suggestNextIngredients (detailed)...');

const suggestNodes = new Map([
  ['butter', { sauceCategory: 'Fat' }],
  ['flour', { sauceCategory: 'Thickener' }],
  ['milk', { sauceCategory: 'Liquid' }],
  ['egg yolk', { sauceCategory: 'Thickener' }],
  ['lemon juice', { sauceCategory: 'Acid' }],
]);

const suggestEdges = [
  { source: 'butter', target: 'flour', strength: 0.8 },
  { source: 'butter', target: 'milk', strength: 0.7 },
  { source: 'butter', target: 'egg yolk', strength: 0.9 },
  { source: 'butter', target: 'lemon juice', strength: 0.5 },
  { source: 'flour', target: 'milk', strength: 0.6 },
  { source: 'egg yolk', target: 'lemon juice', strength: 0.7 },
];

// Results are sorted descending by score
const sugg1 = suggestNextIngredients(['butter'], suggestNodes, suggestEdges);
assert(sugg1.length > 0, `suggestNextIngredients: got ${sugg1.length} results`);
for (let i = 1; i < sugg1.length; i++) {
  assert(sugg1[i - 1].score >= sugg1[i].score,
    `suggestNextIngredients: sorted descending at index ${i} (${sugg1[i - 1].score} >= ${sugg1[i].score})`);
}

// Each result has required fields
for (const s of sugg1) {
  assert(typeof s.name === 'string', `suggestion has name: ${s.name}`);
  assert(typeof s.score === 'number', `suggestion has score: ${s.score}`);
  assert(typeof s.category === 'string', `suggestion has category: ${s.category}`);
  assert(typeof s.reason === 'string', `suggestion has reason: ${s.reason}`);
}

// Does not include already-selected ingredients
assert(!sugg1.some(s => s.name === 'butter'), 'suggestNextIngredients: excludes selected ingredients');

// Egg yolk should be top suggestion (highest strength 0.9 with butter)
assert(sugg1[0].name === 'egg yolk',
  `suggestNextIngredients: top suggestion = ${sugg1[0].name} (expected egg yolk)`);

// Role priority: butter (Fat) + egg yolk (Thickener) => Hollandaise missing Acid
// lemon juice (Acid) should get a role bonus reason
const sugg2 = suggestNextIngredients(['butter', 'egg yolk'], suggestNodes, suggestEdges);
const lemonResult = sugg2.find(s => s.name === 'lemon juice');
assert(lemonResult !== undefined, 'suggestNextIngredients: lemon juice appears in suggestions');
assert(lemonResult?.reason?.includes('Acid'),
  `suggestNextIngredients: lemon juice reason mentions Acid role (got: ${lemonResult?.reason})`);

// Empty / null guards
assert(suggestNextIngredients([], suggestNodes, suggestEdges).length === 0,
  'suggestNextIngredients: empty ingredients returns empty');
assert(suggestNextIngredients(['butter'], null, suggestEdges).length === 0,
  'suggestNextIngredients: null nodes returns empty');
assert(suggestNextIngredients(['butter'], suggestNodes, null).length === 0,
  'suggestNextIngredients: null edges returns empty');

// ---------------------------------------------------------------------------
// 2d. buildAdjacencyMap — detailed
// ---------------------------------------------------------------------------

console.log('\n2d. buildAdjacencyMap (detailed)...');

const adjEdges = [
  { source: 'butter', target: 'flour', strength: 0.8 },
  { source: 'butter', target: 'milk', strength: 0.7 },
  { source: 'flour', target: 'milk', strength: 0.6 },
];
const adj = buildAdjacencyMap(adjEdges);

// Returns a Map
assert(adj instanceof Map, 'buildAdjacencyMap: returns a Map');

// All nodes present as keys
assert(adj.has('butter'), 'buildAdjacencyMap: has butter');
assert(adj.has('flour'), 'buildAdjacencyMap: has flour');
assert(adj.has('milk'), 'buildAdjacencyMap: has milk');

// Each value is a Map
assert(adj.get('butter') instanceof Map, 'buildAdjacencyMap: butter value is a Map');

// Correct strengths
assert(adj.get('butter').get('flour') === 0.8, `buildAdjacencyMap: butter->flour = ${adj.get('butter').get('flour')}`);
assert(adj.get('butter').get('milk') === 0.7, `buildAdjacencyMap: butter->milk = ${adj.get('butter').get('milk')}`);

// Bidirectional: flour->butter should equal butter->flour
assert(adj.get('flour').get('butter') === 0.8, `buildAdjacencyMap: flour->butter = ${adj.get('flour').get('butter')} (bidirectional)`);
assert(adj.get('milk').get('butter') === 0.7, `buildAdjacencyMap: milk->butter = ${adj.get('milk').get('butter')} (bidirectional)`);
assert(adj.get('milk').get('flour') === 0.6, `buildAdjacencyMap: milk->flour = ${adj.get('milk').get('flour')} (bidirectional)`);

// Empty edges => empty Map
const adjEmpty = buildAdjacencyMap([]);
assert(adjEmpty instanceof Map && adjEmpty.size === 0, 'buildAdjacencyMap: empty edges returns empty Map');

// Neighbor count is correct (butter has 2 neighbors)
assert(adj.get('butter').size === 2, `buildAdjacencyMap: butter has ${adj.get('butter').size} neighbors (expected 2)`);

// ---------------------------------------------------------------------------
// 3. Sauce data module
// ---------------------------------------------------------------------------

console.log('\n3. Sauce data module...');
const dataPath = path.join(__dirname, '..', 'src', 'data', 'sauceData.js');
assert(fs.existsSync(dataPath), 'sauceData.js exists');

// ---------------------------------------------------------------------------
// 4. Component files exist
// ---------------------------------------------------------------------------

console.log('\n4. Component files...');
const components = [
  'SauceLab.jsx',
  'SaucePanel.jsx',
  'SauceBuilder.jsx',
];
for (const comp of components) {
  const compPath = path.join(__dirname, '..', 'src', 'components', comp);
  assert(fs.existsSync(compPath), `${comp} exists`);
}

// ---------------------------------------------------------------------------
// 5. Graph module
// ---------------------------------------------------------------------------

console.log('\n5. Graph module...');
const graphPath = path.join(__dirname, '..', 'src', 'data', 'sauceGraph.js');
assert(fs.existsSync(graphPath), 'sauceGraph.js exists');

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
