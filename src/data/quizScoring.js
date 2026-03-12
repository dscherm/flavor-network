import palateQuestions from './palateQuestions.js';

/**
 * Score quiz answers into an ingredient weight map.
 *
 * Each question has a `mappings` field that defines how answers map to
 * ingredient weights. This function processes all answers and combines
 * the resulting weights into a single Map<ingredientName, weight>.
 *
 * @param {Object} answers - Quiz answers keyed by question id.
 *   - scale questions: answer is index (0-4)
 *   - choice questions: answer is the selected option string
 *   - multi questions: answer is an array of selected option strings
 * @param {Object[]} [questions] - Optional custom question bank (defaults to palateQuestions)
 * @returns {Map<string, number>} Ingredient weight map (0-1 range per ingredient)
 */
export function scoreQuiz(answers, questions) {
  const items = questions || palateQuestions;
  const weights = new Map();

  function addWeight(ingredient, value) {
    const name = ingredient.toLowerCase();
    const current = weights.get(name) || 0;
    // Use max rather than sum to avoid inflation from multiple questions
    // mapping to the same ingredient
    weights.set(name, Math.max(current, value));
  }

  for (const question of items) {
    const answer = answers[question.id];
    if (answer === undefined || answer === null) continue;
    if (!question.mappings) continue;

    switch (question.type) {
      case 'scale': {
        // answer is an index (0-4), mappings[ingredient] is an array of 5 values
        const idx = typeof answer === 'number' ? answer : 0;
        for (const [ingredient, values] of Object.entries(question.mappings)) {
          if (Array.isArray(values) && values[idx] !== undefined) {
            addWeight(ingredient, values[idx]);
          }
        }
        break;
      }

      case 'choice': {
        // answer is a string, mappings[answer] is { ingredient: weight }
        const optionMap = question.mappings[answer];
        if (optionMap && typeof optionMap === 'object') {
          for (const [ingredient, value] of Object.entries(optionMap)) {
            addWeight(ingredient, value);
          }
        }
        break;
      }

      case 'multi': {
        // answer is string[], each option maps to { ingredient: weight }
        const selected = Array.isArray(answer) ? answer : [];
        for (const option of selected) {
          const optionMap = question.mappings[option];
          if (optionMap && typeof optionMap === 'object') {
            for (const [ingredient, value] of Object.entries(optionMap)) {
              addWeight(ingredient, value);
            }
          }
        }
        break;
      }
    }
  }

  return weights;
}

/**
 * Get the adventure/variety score from quiz answers.
 * Higher values (0-4) indicate more willingness to try unfamiliar cuisines.
 * Returns null if the question wasn't answered.
 *
 * @param {Object} answers - Quiz answers keyed by question id
 * @returns {number|null} Adventure score (0-4) or null
 */
export function getAdventureScore(answers) {
  const val = answers?.adventure;
  return typeof val === 'number' ? val : null;
}

/**
 * Merge quiz-based weights with recipe-based weights.
 *
 * When the user has recipes, quiz weights serve as a prior (30% weight)
 * and recipe weights dominate (70%). When no recipes exist, quiz weights
 * are used at 100%.
 *
 * @param {Map<string, number>} quizWeights - From scoreQuiz()
 * @param {Map<string, number>} recipeWeights - From profileWeights/frequencyWeights
 * @returns {Map<string, number>} Merged weight map
 */
export function mergeQuizAndRecipeWeights(quizWeights, recipeWeights) {
  const hasRecipes = recipeWeights && recipeWeights.size > 0;
  const quizFactor = hasRecipes ? 0.3 : 1.0;
  const recipeFactor = hasRecipes ? 0.7 : 0;

  const merged = new Map();

  // Add quiz weights
  for (const [name, weight] of quizWeights) {
    merged.set(name, weight * quizFactor);
  }

  // Blend in recipe weights
  if (hasRecipes) {
    for (const [name, weight] of recipeWeights) {
      const existing = merged.get(name) || 0;
      merged.set(name, existing + weight * recipeFactor);
    }
  }

  return merged;
}
