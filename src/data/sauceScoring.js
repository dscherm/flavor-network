/**
 * sauceScoring.js — Compatibility scoring, mother sauce template detection,
 * and "what to add next" suggestions for the sauce builder.
 */

// ---------------------------------------------------------------------------
// Mother Sauce Templates (French + Global)
// ---------------------------------------------------------------------------

const SAUCE_TEMPLATES = [
  // French Mother Sauces
  {
    name: 'Béchamel',
    roles: { Fat: 1, Thickener: 1, Liquid: 1 },
    description: 'Fat + Roux + Milk',
    technique: 'roux',
  },
  {
    name: 'Velouté',
    roles: { Fat: 1, Thickener: 1, Liquid: 1 },
    description: 'Fat + Roux + Stock',
    technique: 'roux',
  },
  {
    name: 'Espagnole',
    roles: { Fat: 1, Thickener: 1, Liquid: 1, Aromatic: 1, Protein: 0.5 },
    description: 'Fat + Roux + Stock + Mirepoix',
    technique: 'reduction',
  },
  {
    name: 'Tomato',
    roles: { Fat: 1, Acid: 1, Aromatic: 1, Herb: 0.5 },
    description: 'Fat + Tomato + Aromatics + Herbs',
    technique: 'simmer',
  },
  {
    name: 'Hollandaise',
    roles: { Fat: 1, Thickener: 1, Acid: 1 },
    description: 'Butter + Egg Yolk + Acid',
    technique: 'emulsification',
  },
  // Global Templates
  {
    name: 'Curry',
    roles: { Fat: 1, Aromatic: 1, Seasoning: 1, Chili: 0.5, Liquid: 0.5 },
    description: 'Fat + Aromatics + Spices + Heat',
    technique: 'bloom + simmer',
  },
  {
    name: 'Stir-fry',
    roles: { Protein: 1, Aromatic: 1, Seasoning: 0.5 },
    description: 'Soy/Fish Sauce + Aromatics + Seasoning',
    technique: 'wok',
  },
  {
    name: 'Mole',
    roles: { Fat: 1, Chili: 1, Seasoning: 1, Other: 1 },
    description: 'Fat + Chilies + Spices + Chocolate/Nuts',
    technique: 'toast + blend',
  },
  {
    name: 'Salsa',
    roles: { Acid: 1, Aromatic: 1, Chili: 0.5, Herb: 0.5 },
    description: 'Tomato/Tomatillo + Aromatics + Chili + Herbs',
    technique: 'raw or roast',
  },
  {
    name: 'Nut Sauce',
    roles: { Other: 1, Acid: 0.5, Seasoning: 0.5, Chili: 0.5 },
    description: 'Peanut/Tahini + Acid + Seasoning',
    technique: 'blend',
  },
];

// ---------------------------------------------------------------------------
// Compatibility scoring
// ---------------------------------------------------------------------------

/**
 * Compute average pairwise compatibility for a set of ingredients.
 * @param {string[]} ingredients - Ingredient names
 * @param {Array} edges - Graph edges with { source, target, strength }
 * @param {Map} [adjacencyMap] - Optional adjacency map for O(1) lookups
 * @returns {number} Score 0-10
 */
export function computeCompatibility(ingredients, edges, adjacencyMap) {
  if (!ingredients || ingredients.length < 2 || !edges) return 0;

  let totalStrength = 0;
  let pairCount = 0;

  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const a = ingredients[i];
      const b = ingredients[j];
      if (adjacencyMap) {
        const strength = adjacencyMap.get(a)?.get(b) || 0;
        totalStrength += strength;
      } else {
        for (const edge of edges) {
          if ((edge.source === a && edge.target === b) ||
              (edge.target === a && edge.source === b)) {
            totalStrength += edge.strength;
            break;
          }
        }
      }
      pairCount++;
    }
  }

  if (pairCount === 0) return 0;
  return Math.round((totalStrength / pairCount) * 10 * 10) / 10;
}

// ---------------------------------------------------------------------------
// Template detection
// ---------------------------------------------------------------------------

/**
 * Detect the closest mother sauce template for a set of ingredients.
 * @param {string[]} ingredients - Ingredient names
 * @param {Map} nodes - Graph nodes map with sauceCategory info
 * @returns {{ name, description, confidence, missingRoles }|null}
 */
export function detectSauceTemplate(ingredients, nodes) {
  if (!ingredients || ingredients.length === 0 || !nodes) return null;

  const roleCounts = {};
  for (const name of ingredients) {
    const node = nodes.get(name);
    const cat = node?.sauceCategory || 'Other';
    roleCounts[cat] = (roleCounts[cat] || 0) + 1;
  }

  let bestTemplate = null;
  let bestScore = 0;

  for (const template of SAUCE_TEMPLATES) {
    const requiredRoles = Object.keys(template.roles);
    let matched = 0;
    const missing = [];

    for (const role of requiredRoles) {
      if (roleCounts[role] && roleCounts[role] >= template.roles[role]) {
        matched++;
      } else {
        missing.push(role);
      }
    }

    const score = matched / requiredRoles.length;
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = {
        name: template.name,
        description: template.description,
        technique: template.technique,
        confidence: Math.round(score * 100),
        missingRoles: missing,
      };
    }
  }

  return bestTemplate && bestTemplate.confidence >= 33 ? bestTemplate : null;
}

// ---------------------------------------------------------------------------
// "What to add next" suggestions
// ---------------------------------------------------------------------------

/**
 * Suggest ingredients to add next, ranked by average pairing with existing.
 * Prioritizes filling mother sauce role gaps.
 * @param {string[]} currentIngredients - Already selected ingredients
 * @param {Map} nodes - Graph nodes map
 * @param {Array} edges - Graph edges
 * @param {Map} [adjacencyMap] - Optional adjacency map for O(1) lookups
 * @returns {Array<{ name, score, category, reason }>}
 */
export function suggestNextIngredients(currentIngredients, nodes, edges, adjacencyMap) {
  if (!currentIngredients || currentIngredients.length === 0 || !nodes || !edges) return [];

  const template = detectSauceTemplate(currentIngredients, nodes);
  const priorityRoles = new Set(template?.missingRoles || []);

  const currentSet = new Set(currentIngredients);
  const scored = [];

  for (const [name, node] of nodes) {
    if (currentSet.has(name)) continue;

    let totalStrength = 0;
    let pairs = 0;

    if (adjacencyMap) {
      const neighbors = adjacencyMap.get(name);
      if (neighbors) {
        for (const ing of currentIngredients) {
          const strength = neighbors.get(ing) || 0;
          if (strength > 0) {
            totalStrength += strength;
            pairs++;
          }
        }
      }
    } else {
      for (const ing of currentIngredients) {
        for (const edge of edges) {
          if ((edge.source === name && edge.target === ing) ||
              (edge.target === name && edge.source === ing)) {
            totalStrength += edge.strength;
            pairs++;
            break;
          }
        }
      }
    }

    if (pairs === 0) continue;

    const avgStrength = totalStrength / currentIngredients.length;
    const cat = node.sauceCategory || 'Other';
    const roleBonus = priorityRoles.has(cat) ? 0.3 : 0;
    const score = Math.round((avgStrength + roleBonus) * 10 * 10) / 10;
    const reason = priorityRoles.has(cat)
      ? `Fills ${cat} role`
      : cat;

    scored.push({ name, score, category: cat, reason });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}

export { SAUCE_TEMPLATES };
