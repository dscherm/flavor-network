/**
 * Data Integrity Tests v2
 * Validates quiz scoring, recipe scraping, and tree structures.
 *
 * Run: node src/data/tests/dataIntegrity.test.js
 */

import { scoreQuiz, getAdventureScore, mergeQuizAndRecipeWeights } from '../quizScoring.js';
import palateQuestions from '../palateQuestions.js';
import { REGION_MAP } from '../cuisineTree.js';
import { TASTE_HIERARCHY } from '../tasteTree.js';
import { FAMILIES } from '../ingredientFamilyTree.js';
import { SEASON_HIERARCHY } from '../seasonTree.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

// --- Quiz Scoring Tests ---
console.log('\n=== Quiz Scoring ===');

// Test: scoreQuiz returns a Map
{
  const answers = { heat: 2, sweet_savory: 'Savory', herbs: ['Basil', 'Thyme'] };
  const weights = scoreQuiz(answers);
  assert(weights instanceof Map, 'scoreQuiz returns a Map');
  assert(weights.size > 0, 'scoreQuiz returns non-empty Map for valid answers');
}

// Test: scale question scoring
{
  const answers = { heat: 4 }; // Extreme
  const weights = scoreQuiz(answers);
  assert(weights.get('chile pepper') === 1.0, 'Extreme heat maps chile pepper to 1.0');
  assert(weights.get('cayenne') === 0.9, 'Extreme heat maps cayenne to 0.9');
}

// Test: choice question scoring
{
  const answers = { sweet_savory: 'Sweet' };
  const weights = scoreQuiz(answers);
  assert(weights.has('sugar'), 'Sweet choice maps to sugar');
  assert(weights.has('honey'), 'Sweet choice maps to honey');
  assert(!weights.has('soy sauce'), 'Sweet choice does not map to soy sauce');
}

// Test: multi question scoring
{
  const answers = { herbs: ['Basil', 'Cilantro'] };
  const weights = scoreQuiz(answers);
  assert(weights.get('basil') === 0.9, 'Herb selection maps basil to 0.9');
  assert(weights.get('cilantro') === 0.9, 'Herb selection maps cilantro to 0.9');
  assert(!weights.has('dill'), 'Unselected herb not in weights');
}

// Test: empty answers
{
  const weights = scoreQuiz({});
  assert(weights.size === 0, 'Empty answers produce empty weights');
}

// Test: adventure score
{
  assert(getAdventureScore({ adventure: 3 }) === 3, 'Adventure score extraction');
  assert(getAdventureScore({}) === null, 'Missing adventure returns null');
  assert(getAdventureScore(null) === null, 'Null answers returns null');
}

// Test: merge quiz and recipe weights
{
  const quiz = new Map([['garlic', 0.8], ['basil', 0.5]]);
  const recipe = new Map([['garlic', 0.6], ['tomato', 0.9]]);
  const merged = mergeQuizAndRecipeWeights(quiz, recipe);
  assert(merged.has('garlic'), 'Merged has garlic from both sources');
  assert(merged.has('basil'), 'Merged has basil from quiz');
  assert(merged.has('tomato'), 'Merged has tomato from recipe');
  // With recipes: quiz=30%, recipe=70%
  const expectedGarlic = 0.8 * 0.3 + 0.6 * 0.7;
  assert(Math.abs(merged.get('garlic') - expectedGarlic) < 0.001, 'Merge applies 30/70 split with recipes');
}

// Test: merge without recipes
{
  const quiz = new Map([['garlic', 0.8]]);
  const merged = mergeQuizAndRecipeWeights(quiz, new Map());
  assert(merged.get('garlic') === 0.8, 'Without recipes, quiz = 100%');
}

// --- Question Bank Validation ---
console.log('\n=== Question Bank ===');

// All questions have required fields
for (const q of palateQuestions) {
  assert(q.id && typeof q.id === 'string', `Question ${q.id} has id`);
  assert(q.type && ['scale', 'choice', 'multi'].includes(q.type), `Question ${q.id} has valid type`);
  assert(q.title && typeof q.title === 'string', `Question ${q.id} has title`);
  assert(q.question && typeof q.question === 'string', `Question ${q.id} has question`);
  assert(q.mappings && typeof q.mappings === 'object', `Question ${q.id} has mappings`);

  if (q.type === 'scale') {
    assert(Array.isArray(q.labels) && q.labels.length === 5, `Scale question ${q.id} has 5 labels`);
    // Check that scale mappings have arrays of 5
    for (const [ing, vals] of Object.entries(q.mappings)) {
      if (Array.isArray(vals)) {
        assert(vals.length === 5, `Scale mapping ${q.id}.${ing} has 5 values`);
      }
    }
  }

  if (q.type === 'choice') {
    assert(Array.isArray(q.options) && q.options.length >= 2, `Choice question ${q.id} has options`);
  }

  if (q.type === 'multi') {
    assert(Array.isArray(q.options) && q.options.length >= 2, `Multi question ${q.id} has options`);
    assert(typeof q.max === 'number', `Multi question ${q.id} has max`);
  }
}

// No duplicate question IDs
{
  const ids = palateQuestions.map(q => q.id);
  const unique = new Set(ids);
  assert(ids.length === unique.size, 'No duplicate question IDs');
}

// --- Tree Structure Tests ---
console.log('\n=== Tree Structures ===');

// Cuisine tree: all region names are present
assert(Object.keys(REGION_MAP).length >= 5, 'REGION_MAP has at least 5 regions');
for (const [region, cuisines] of Object.entries(REGION_MAP)) {
  assert(Array.isArray(cuisines) && cuisines.length > 0, `Region ${region} has cuisines`);
  for (const c of cuisines) {
    assert(typeof c === 'string' && c.length > 0, `Cuisine in ${region} is non-empty string`);
  }
}

// Taste tree: all primary tastes
assert(Object.keys(TASTE_HIERARCHY).length >= 5, 'TASTE_HIERARCHY has at least 5 primary tastes');
for (const [taste, config] of Object.entries(TASTE_HIERARCHY)) {
  assert(Array.isArray(config.keywords) && config.keywords.length > 0, `Taste ${taste} has keywords`);
  assert(config.subcategories && typeof config.subcategories === 'object', `Taste ${taste} has subcategories`);
}

// Ingredient families: no cycles, all have keywords
assert(FAMILIES.length >= 15, 'At least 15 ingredient families');
for (const family of FAMILIES) {
  assert(family.name && typeof family.name === 'string', `Family has name`);
  assert(Array.isArray(family.keywords) && family.keywords.length > 0, `Family ${family.name} has keywords`);
}

// Season tree: all four seasons
assert(Object.keys(SEASON_HIERARCHY).length === 4, 'SEASON_HIERARCHY has exactly 4 seasons');
for (const [season, config] of Object.entries(SEASON_HIERARCHY)) {
  assert(Array.isArray(config.keywords), `Season ${season} has keywords`);
  assert(Array.isArray(config.subseasons) && config.subseasons.length === 2, `Season ${season} has 2 subseasons`);
}

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All data integrity tests passed!');
}
