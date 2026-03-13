/**
 * cocktailScoring.js — Compatibility scoring, Codex template detection,
 * and "what to add next" suggestions for the cocktail builder.
 */

// ---------------------------------------------------------------------------
// Cocktail Codex Templates
// ---------------------------------------------------------------------------

const CODEX_TEMPLATES = [
  {
    name: 'Old Fashioned',
    roles: { Spirit: 1, Sweetener: 1, Bitters: 1 },
    description: 'Spirit + Sugar + Bitters',
  },
  {
    name: 'Martini',
    roles: { Spirit: 1, Vermouth: 1, Bitters: 0.5 },
    description: 'Spirit + Vermouth (+ optional Bitters)',
  },
  {
    name: 'Daiquiri',
    roles: { Spirit: 1, Citrus: 1, Sweetener: 1 },
    description: 'Spirit + Citrus + Sugar',
  },
  {
    name: 'Sidecar',
    roles: { Spirit: 1, Liqueur: 1, Citrus: 1 },
    description: 'Spirit + Liqueur + Citrus',
  },
  {
    name: 'Highball',
    roles: { Spirit: 1, Lengthener: 1 },
    description: 'Spirit + Lengthener',
  },
  {
    name: 'Flip',
    roles: { Spirit: 1, Sweetener: 1, 'Dairy/Egg': 1 },
    description: 'Spirit + Sugar + Whole Egg',
  },
];

// ---------------------------------------------------------------------------
// Compatibility scoring
// ---------------------------------------------------------------------------

/**
 * Compute average pairwise compatibility for a set of ingredients.
 * @param {string[]} ingredients - Ingredient names
 * @param {Array} edges - Graph edges with { source, target, strength }
 * @returns {number} Score 0-10
 */
export function computeCompatibility(ingredients, edges) {
  if (!ingredients || ingredients.length < 2 || !edges) return 0;

  let totalStrength = 0;
  let pairCount = 0;

  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const a = ingredients[i];
      const b = ingredients[j];
      let found = false;
      for (const edge of edges) {
        if ((edge.source === a && edge.target === b) ||
            (edge.target === a && edge.source === b)) {
          totalStrength += edge.strength;
          found = true;
          break;
        }
      }
      pairCount++;
      if (!found) {
        // No edge = 0 compatibility for this pair
      }
    }
  }

  if (pairCount === 0) return 0;
  return Math.round((totalStrength / pairCount) * 10 * 10) / 10;
}

// ---------------------------------------------------------------------------
// Codex template detection
// ---------------------------------------------------------------------------

/**
 * Detect the closest Cocktail Codex template for a set of ingredients.
 * @param {string[]} ingredients - Ingredient names
 * @param {Map} nodes - Graph nodes map with cocktailCategory info
 * @returns {{ name, description, confidence, missingRoles }|null}
 */
export function detectCodexTemplate(ingredients, nodes) {
  if (!ingredients || ingredients.length === 0 || !nodes) return null;

  // Count roles present
  const roleCounts = {};
  for (const name of ingredients) {
    const node = nodes.get(name);
    const cat = node?.cocktailCategory || 'Other';
    roleCounts[cat] = (roleCounts[cat] || 0) + 1;
  }

  let bestTemplate = null;
  let bestScore = 0;

  for (const template of CODEX_TEMPLATES) {
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
 * Prioritizes filling Codex role gaps.
 * @param {string[]} currentIngredients - Already selected ingredients
 * @param {Map} nodes - Graph nodes map
 * @param {Array} edges - Graph edges
 * @returns {Array<{ name, score, category, reason }>}
 */
export function suggestNextIngredients(currentIngredients, nodes, edges) {
  if (!currentIngredients || currentIngredients.length === 0 || !nodes || !edges) return [];

  // Detect template to find role gaps
  const template = detectCodexTemplate(currentIngredients, nodes);
  const priorityRoles = new Set(template?.missingRoles || []);

  // Score all non-selected ingredients
  const currentSet = new Set(currentIngredients);
  const scored = [];

  for (const [name, node] of nodes) {
    if (currentSet.has(name)) continue;

    let totalStrength = 0;
    let pairs = 0;

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

    if (pairs === 0) continue;

    const avgStrength = totalStrength / currentIngredients.length;
    const cat = node.cocktailCategory || 'Other';
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

export { CODEX_TEMPLATES };
