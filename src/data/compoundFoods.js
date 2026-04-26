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
  'vegetable oil': 'sunflower oil',  // both neutral, fat-dominant
  'egg': 'egg yolk',                  // yolk carries the flavor signal
  'black pepper': 'peppercorn',       // same ingredient, different name
  'whole milk': 'milk',
  'heavy cream': 'cream',
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
