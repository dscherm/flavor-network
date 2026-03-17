/**
 * structureScoring.js — Score recipe ingredients against cocktail codex
 * templates and mother sauce structures. Uses ProData categories to infer
 * roles, so it works in Recipe Lab without requiring the cocktail/sauce
 * subgraph node data.
 */

// ─── Cocktail Codex Templates ───
const CODEX_TEMPLATES = [
  { key: 'old-fashioned', name: 'Old Fashioned', roles: { spirit: 1, sweetener: 1, seasoning: 1 }, desc: 'Spirit + Sugar + Bitters' },
  { key: 'martini', name: 'Martini', roles: { spirit: 1, modifier: 1 }, desc: 'Spirit + Vermouth' },
  { key: 'daiquiri', name: 'Daiquiri', roles: { spirit: 1, citrus: 1, sweetener: 1 }, desc: 'Spirit + Citrus + Sugar' },
  { key: 'sidecar', name: 'Sidecar', roles: { spirit: 1, liqueur: 1, citrus: 1 }, desc: 'Spirit + Liqueur + Citrus' },
  { key: 'highball', name: 'Highball', roles: { spirit: 1, lengthener: 1 }, desc: 'Spirit + Lengthener' },
  { key: 'flip', name: 'Flip', roles: { spirit: 1, sweetener: 1, dairy: 1 }, desc: 'Spirit + Sugar + Egg' },
];

// ─── Mother Sauce Templates ───
const SAUCE_TEMPLATES = [
  { key: 'bechamel', name: 'Béchamel', roles: { fat: 1, thickener: 1, dairy: 1 }, desc: 'Roux + Milk' },
  { key: 'veloute', name: 'Velouté', roles: { fat: 1, thickener: 1, liquid: 1 }, desc: 'Roux + Stock' },
  { key: 'espagnole', name: 'Espagnole', roles: { fat: 1, thickener: 1, liquid: 1, aromatic: 1 }, desc: 'Roux + Stock + Mirepoix' },
  { key: 'tomato', name: 'Tomato', roles: { fat: 1, acid: 1, aromatic: 1, herb: 0.5 }, desc: 'Tomato + Aromatics + Herbs' },
  { key: 'hollandaise', name: 'Hollandaise', roles: { fat: 1, dairy: 1, acid: 1 }, desc: 'Butter + Egg + Acid' },
  { key: 'curry', name: 'Curry', roles: { fat: 1, aromatic: 1, spice: 1, chili: 0.5 }, desc: 'Fat + Aromatics + Spices' },
  { key: 'stir-fry', name: 'Stir-fry', roles: { umami: 1, aromatic: 1, spice: 0.5 }, desc: 'Soy/Fish Sauce + Aromatics' },
  { key: 'mole', name: 'Mole', roles: { fat: 1, chili: 1, spice: 1 }, desc: 'Chilies + Spices + Chocolate' },
  { key: 'salsa', name: 'Salsa', roles: { acid: 1, aromatic: 1, chili: 0.5, herb: 0.5 }, desc: 'Tomato + Chili + Herbs' },
  { key: 'nut-sauce', name: 'Nut Sauce', roles: { nut: 1, acid: 0.5, spice: 0.5 }, desc: 'Peanut/Tahini + Acid' },
];

// Map ProData categories to abstract roles
const CATEGORY_TO_COCKTAIL_ROLE = {
  spirit: 'spirit', liqueur: 'liqueur', sweetener: 'sweetener',
  citrus: 'citrus', herb: 'modifier', spice: 'seasoning',
  fruit: 'citrus', dairy: 'dairy', protein: 'dairy',
  liquid: 'lengthener', condiment: 'seasoning', acid: 'citrus',
  fat: 'modifier', aromatic: 'modifier', vegetable: null,
  grain: null, nut: null, chili: 'seasoning', seasoning: 'seasoning',
  bitters: 'seasoning', other: null,
};

const CATEGORY_TO_SAUCE_ROLE = {
  fat: 'fat', dairy: 'dairy', liquid: 'liquid', grain: 'thickener',
  thickener: 'thickener', aromatic: 'aromatic', herb: 'herb',
  spice: 'spice', chili: 'chili', acid: 'acid', citrus: 'acid',
  condiment: 'umami', protein: 'umami', seasoning: 'spice',
  vegetable: 'aromatic', nut: 'nut', sweetener: null,
  spirit: null, liqueur: null, fruit: 'acid', other: null,
};

function getRole(ingredientName, node, mode) {
  const cat = (node?.category || 'other').toLowerCase();
  const map = mode === 'cocktail' ? CATEGORY_TO_COCKTAIL_ROLE : CATEGORY_TO_SAUCE_ROLE;
  return map[cat] || null;
}

/**
 * Score all templates against the current ingredients.
 * Returns sorted array of { key, name, desc, confidence (0-100), missing[] }
 */
export function scoreStructures(ingredients, nodes, mode) {
  if (!ingredients || ingredients.length === 0 || !nodes) return [];

  const templates = mode === 'cocktail' ? CODEX_TEMPLATES : SAUCE_TEMPLATES;

  // Count roles present
  const roleCounts = {};
  for (const name of ingredients) {
    const node = nodes.get(name);
    const role = getRole(name, node, mode);
    if (role) roleCounts[role] = (roleCounts[role] || 0) + 1;
  }

  const results = [];
  for (const template of templates) {
    const requiredRoles = Object.entries(template.roles);
    let matched = 0;
    const missing = [];

    for (const [role, weight] of requiredRoles) {
      const count = roleCounts[role] || 0;
      if (count >= weight) {
        matched += weight;
      } else if (count > 0) {
        matched += count / weight * weight * 0.5; // partial credit
        missing.push(role);
      } else {
        missing.push(role);
      }
    }

    const totalWeight = requiredRoles.reduce((s, [, w]) => s + w, 0);
    const confidence = Math.round((matched / totalWeight) * 100);

    results.push({
      key: template.key,
      name: template.name,
      desc: template.desc,
      confidence,
      missing,
    });
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

export { CODEX_TEMPLATES, SAUCE_TEMPLATES };
