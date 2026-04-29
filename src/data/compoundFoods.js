/**
 * compoundFoods.js — synthesize aroma profiles for compound foods that
 * the GNN has no direct prediction for, using weighted aggregation of
 * their constituent ingredients' GNN predictions.
 *
 * The motivation: ingredients like mayonnaise, garam masala, ranch
 * dressing aren't single molecules — they're recipes-of-other-
 * ingredients. The GNN trained on FooDB compound chemistry has no
 * prediction for them and never will. But the user still expects an
 * aroma profile when they tap "mayonnaise" in the catalog.
 *
 * Approach: declare each compound food's constituent breakdown by
 * weight (totaling ~1.0). At runtime, look up each constituent's GNN
 * prediction, drop missing constituents, renormalize, and weighted-sum
 * the remaining probability vectors. Tag the resulting profile with
 * `gnnProbsSource = 'compound'` so the UI can badge it as
 * "Predicted from components" rather than letting users assume it's a
 * direct molecular prediction.
 *
 * Coverage gate: a compound food only synthesizes if the available
 * constituents represent ≥50% of the declared weight. Otherwise we
 * leave the profile null and the UI shows the standard "no aroma data"
 * empty state.
 */

// Substitute table — when a constituent isn't in the GNN data, fall back
// to a flavor-similar ingredient that IS. Verified against the current
// gnn_entropy.json. Substitutions are applied BEFORE the coverage gate
// so a compound food with an obvious alternative still synthesizes.
const SUBSTITUTES = {
  'vegetable oil': 'sunflower oil',   // both neutral, fat-dominant
  'egg': 'egg yolk',                   // yolk carries the flavor signal
  'black pepper': 'peppercorn',        // same ingredient, different name
  'whole milk': 'milk',
  'heavy cream': 'cream',
  // R14 Phase 3 additions — constituents we use in spice blends and
  // sauces below that don't themselves have GNN predictions. Each
  // alias picks the closest GNN-having neighbor in flavor space.
  'cilantro': 'coriander',             // same plant, leaf vs. seed
  'cloves': 'allspice',                // both warm pungent baking spices
  'clove': 'allspice',
  'paprika': 'red chili pepper',       // dried mild chile
  'smoked paprika': 'red chili pepper',
  'mirin': 'sake',                     // both rice wines
  'galangal': 'ginger',                // botanical cousin
  'chipotle': 'red chili pepper',      // smoked jalapeño
  'molasses': 'brown sugar',           // brown sugar is sugar + molasses
  'sumac': 'lemon juice',              // sour/citrusy stand-in
  'bay leaf': 'allspice',              // warm aromatic — closest available
  'caraway': 'caraway seed',
};

export const COMPOUND_FOODS = {
  // ---- Emulsions ----
  mayonnaise: {
    constituents: { 'egg yolk': 0.5, 'vegetable oil': 0.4, 'vinegar': 0.05, 'mustard': 0.05 },
    description: 'egg yolk emulsified in oil',
  },
  mayo: { aliasOf: 'mayonnaise' },

  // ---- Dressings ----
  'italian dressing': {
    constituents: { 'olive oil': 0.55, 'vinegar': 0.25, 'oregano': 0.07, 'garlic': 0.05, 'basil': 0.05, 'parsley': 0.03 },
    description: 'oil + vinegar + Italian herbs',
  },
  'ranch dressing': {
    constituents: { 'mayonnaise': 0.5, 'buttermilk': 0.35, 'parsley': 0.05, 'garlic': 0.05, 'dill': 0.05 },
    description: 'mayo–buttermilk base with herbs',
  },
  'caesar dressing': {
    constituents: { 'olive oil': 0.45, 'egg yolk': 0.2, 'parmesan': 0.15, 'anchovy': 0.1, 'lemon juice': 0.05, 'garlic': 0.05 },
    description: 'oil-egg emulsion with anchovy + parmesan',
  },

  // ---- Spice blends ----
  'garam masala': {
    constituents: {
      'cumin': 0.2, 'coriander': 0.2, 'cardamom': 0.15, 'cinnamon': 0.15,
      'nutmeg': 0.1, 'black pepper': 0.1, 'bay leaf': 0.05, 'ginger': 0.05,
    },
    description: 'warm Indian spice blend',
  },

  // ---- Single ingredients hidden behind FooDB name misses ----
  // These are technically NOT compound foods, but the same synthesis
  // mechanism gets us a reasonable profile while we wait for proper
  // alias-expansion in the embed_ingredients matcher (separate work
  // item per .claude/.chemdataset-status.md).
  tahini: {
    constituents: { 'sesame oil': 0.7, 'sesame seed': 0.3 },
    description: 'sesame seed paste',
  },

  // ─────────────────────────────────────────────────────────────
  // R14 Phase 3 — extended coverage. All target ingredients verified
  // present in the catalog and confirmed to lack a direct GNN
  // prediction (`gnn_entropy.json`). Constituents picked from the
  // 64-name pool that DOES have GNN predictions, with substitutions
  // declared above for cilantro/cloves/paprika/etc.
  // ─────────────────────────────────────────────────────────────

  // ---- More dressings ----
  'french dressing': {
    constituents: {
      'olive oil': 0.4, 'apple cider vinegar': 0.2, 'tomato': 0.1,
      'sugar': 0.1, 'paprika': 0.1, 'mustard': 0.05, 'garlic': 0.05,
    },
    description: 'sweet-tangy oil + vinegar with paprika',
  },

  // ---- Spice blends ----
  'cajun spice': {
    constituents: {
      'paprika': 0.25, 'red chili pepper': 0.15, 'peppercorn': 0.15,
      'thyme': 0.15, 'oregano': 0.1, 'onion': 0.1, 'garlic': 0.1,
    },
    description: 'paprika, cayenne, garlic, thyme — Louisiana style',
  },
  'cajun spice mix': { aliasOf: 'cajun spice' },

  'chinese five-spice': {
    constituents: {
      'star anise': 0.25, 'cloves': 0.2, 'cinnamon': 0.2,
      'sichuan peppercorn': 0.2, 'fennel seed': 0.15,
    },
    description: 'star anise, cloves, cinnamon, Sichuan peppercorn, fennel',
  },
  'chinese five spice powder': { aliasOf: 'chinese five-spice' },
  'five-spice powder': { aliasOf: 'chinese five-spice' },

  'jerk spice': {
    constituents: {
      'allspice': 0.25, 'thyme': 0.15, 'red chili pepper': 0.15,
      'peppercorn': 0.1, 'cinnamon': 0.1, 'nutmeg': 0.1,
      'ginger': 0.1, 'garlic': 0.05,
    },
    description: 'Jamaican allspice, thyme, scotch bonnet, warm spice',
  },

  "za'atar spice mix": {
    constituents: {
      'thyme': 0.3, 'sesame seed': 0.25, 'oregano': 0.15,
      'marjoram': 0.1, 'sumac': 0.1, 'olive oil': 0.1,
    },
    description: 'thyme, sesame, sumac, oregano — Levantine',
  },

  // ---- Curry pastes ----
  'curry paste': {
    constituents: {
      'cumin': 0.2, 'coriander': 0.2, 'red chili pepper': 0.15,
      'turmeric': 0.1, 'ginger': 0.1, 'garlic': 0.1,
      'cardamom': 0.1, 'cinnamon': 0.05,
    },
    description: 'cumin, coriander, chili, turmeric, ginger',
  },
  'thai green curry paste': {
    constituents: {
      'red chili pepper': 0.25, 'lemongrass': 0.2, 'cilantro': 0.1,
      'kaffir lime': 0.1, 'fish sauce': 0.1, 'garlic': 0.1,
      'shallot': 0.1, 'lime juice': 0.05,
    },
    description: 'green chile, lemongrass, kaffir lime, cilantro, fish sauce',
  },
  'thai red curry paste': {
    constituents: {
      'red chili pepper': 0.35, 'lemongrass': 0.15, 'kaffir lime': 0.1,
      'fish sauce': 0.1, 'cumin': 0.1, 'coriander': 0.1,
      'garlic': 0.05, 'shallot': 0.05,
    },
    description: 'red chile, lemongrass, kaffir lime, fish sauce',
  },

  // ---- Salsas + chili pastes ----
  'green chile salsa': {
    constituents: {
      'red chili pepper': 0.5, 'onion': 0.2,
      'cilantro': 0.1, 'lime juice': 0.1, 'garlic': 0.1,
    },
    description: 'green chile, onion, cilantro, lime',
  },
  'harissa paste': {
    constituents: {
      'red chili pepper': 0.45, 'cumin': 0.15, 'coriander': 0.1,
      'caraway': 0.1, 'garlic': 0.1, 'olive oil': 0.05,
      'lemon juice': 0.05,
    },
    description: 'North African chili paste with cumin + coriander + caraway',
  },
  'harissa spice': { aliasOf: 'harissa paste' },

  'gochujang': {
    constituents: {
      'red chili pepper': 0.4, 'miso': 0.3, 'sugar': 0.15, 'rice vinegar': 0.15,
    },
    description: 'fermented Korean chili paste',
  },
  'hoisin': {
    constituents: {
      'soybean': 0.35, 'sugar': 0.2, 'sesame oil': 0.15,
      'rice vinegar': 0.1, 'garlic': 0.1, 'red chili pepper': 0.1,
    },
    description: 'sweet-savory soybean paste with sesame',
  },
};

/**
 * Synthesize an aroma profile for a compound food from its constituents.
 *
 * @param {string} name — compound food name (e.g. "mayonnaise")
 * @param {Map<string, {gnnProbs?: Record<string, number>}>} nodes — graph nodes
 * @returns {null | { probs: Record<string, number>, source: 'compound', constituents: string[], description: string, coverage: number }}
 */
export function synthesizeCompoundProfile(name, nodes) {
  const def = COMPOUND_FOODS[name];
  if (!def) return null;
  if (def.aliasOf) return synthesizeCompoundProfile(def.aliasOf, nodes);

  const consts = def.constituents;
  let availableWeight = 0;
  let totalWeight = 0;
  const sumProbs = {};

  for (const [cName, weight] of Object.entries(consts)) {
    totalWeight += weight;
    const lookup = SUBSTITUTES[cName] || cName;
    const cNode = nodes.get(lookup);
    const probs = cNode?.gnnProbs;
    if (!probs) continue;
    availableWeight += weight;
    for (const [task, p] of Object.entries(probs)) {
      sumProbs[task] = (sumProbs[task] || 0) + p * weight;
    }
  }

  // Gate: need ≥50% constituent coverage to publish a profile.
  if (availableWeight / totalWeight < 0.5) return null;

  // Renormalize by ACTUAL available weight (drops missing constituents).
  const out = {};
  for (const [task, p] of Object.entries(sumProbs)) {
    out[task] = p / availableWeight;
  }

  return {
    probs: out,
    source: 'compound',
    constituents: Object.keys(consts),
    description: def.description,
    coverage: availableWeight / totalWeight,
  };
}

/**
 * Apply compound-food synthesis to the entire graph after gnn_entropy
 * has been loaded. Mutates each compound-food node in place — adds
 * `gnnProbs` (the synthesized vector) plus metadata fields the UI
 * uses to badge the profile.
 *
 * Skips compound foods that already have a direct GNN prediction
 * (defer to the model) and ones not in the catalog.
 *
 * @returns {string[]} names of compound foods that successfully synthesized
 */
export function applyCompoundSynthesis(nodes) {
  const synthesized = [];
  for (const name of Object.keys(COMPOUND_FOODS)) {
    const def = COMPOUND_FOODS[name];
    if (def.aliasOf) {
      // Resolve alias → if the canonical synthesized, mirror it onto the alias node.
      const aliasNode = nodes.get(name);
      const canonNode = nodes.get(def.aliasOf);
      if (aliasNode && !aliasNode.gnnProbs && canonNode?.gnnProbs && canonNode.gnnProbsSource === 'compound') {
        aliasNode.gnnProbs = canonNode.gnnProbs;
        aliasNode.gnnProbsSource = 'compound';
        aliasNode.gnnConstituents = canonNode.gnnConstituents;
        aliasNode.gnnConstituentsDescription = canonNode.gnnConstituentsDescription;
        synthesized.push(name);
      }
      continue;
    }
    const node = nodes.get(name);
    if (!node || node.gnnProbs) continue;
    const synth = synthesizeCompoundProfile(name, nodes);
    if (!synth) continue;
    node.gnnProbs = synth.probs;
    node.gnnProbsSource = 'compound';
    node.gnnConstituents = synth.constituents;
    node.gnnConstituentsDescription = synth.description;
    synthesized.push(name);
  }
  return synthesized;
}
