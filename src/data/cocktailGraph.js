/**
 * cocktailGraph.js — Build a cocktail-only subgraph from Flavor Bible data
 * merged with cocktail augmentation data.
 *
 * Filters the full ingredient graph to only cocktail-relevant ingredients,
 * then merges in augmented nodes and edges from cocktail_augment.json.
 *
 * Output format matches graph.js: { nodes: Map, edges: Array, ingredientList: string[] }
 */

import { loadCocktailAugment, getCocktailCategory, getCodexRole } from './cocktailData.js';

/**
 * Build the cocktail subgraph.
 *
 * @param {Object} fullGraph - Full graph from buildGraph() { nodes, edges, ingredientList }
 * @param {string} basePath - Base path for data files
 * @returns {Promise<Object>} { nodes: Map, edges: [], ingredientList: [], augmentedMap: Map }
 */
export async function buildCocktailGraph(fullGraph, basePath = '/data') {
  const augment = await loadCocktailAugment(basePath);

  // Build a set of cocktail ingredient names (lowercase)
  const cocktailNames = new Set(
    (augment.cocktailIngredientNames || []).map(n => n.toLowerCase())
  );

  // Build augmented ingredient map
  const augmentedMap = new Map();
  for (const ing of augment.ingredients || []) {
    augmentedMap.set(ing.name.toLowerCase(), ing);
  }

  // --- Collect nodes ---
  const nodes = new Map();
  let id = 0;

  // 1. Include Flavor Bible nodes that are in the cocktail list
  for (const [name, node] of fullGraph.nodes) {
    const lower = name.toLowerCase();
    if (cocktailNames.has(lower) || cocktailNames.has(name)) {
      const category = getCocktailCategory(lower, augmentedMap);
      const codexRole = getCodexRole(lower, augmentedMap);
      nodes.set(name, {
        ...node,
        id: id++,
        cocktailCategory: category,
        codexRole,
      });
    }
  }

  // 2. Add augmented ingredients not already in the graph
  for (const ing of augment.ingredients || []) {
    const name = ing.name.toLowerCase();
    if (!nodes.has(name)) {
      nodes.set(name, {
        id: id++,
        name,
        cuisines: [],
        taste: ing.taste || null,
        weight: ing.weight || null,
        volume: null,
        season: null,
        tips: [],
        pairingCount: 0,
        affinities: [],
        embedding: null,
        position3D: null,
        cocktailCategory: ing.category || 'Other',
        codexRole: ing.codexRole || 'accent',
      });
    }
  }

  // --- Collect edges ---
  const edgeMap = new Map();

  function addEdge(source, target, strength) {
    if (!nodes.has(source) || !nodes.has(target)) return;
    if (source === target) return;
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    const existing = edgeMap.get(key);
    if (!existing || strength > existing.strength) {
      edgeMap.set(key, {
        source: key.split('|')[0],
        target: key.split('|')[1],
        strength,
      });
    }
  }

  // 1. Include Flavor Bible edges where both endpoints are cocktail ingredients
  for (const edge of fullGraph.edges) {
    if (nodes.has(edge.source) && nodes.has(edge.target)) {
      addEdge(edge.source, edge.target, edge.strength);
    }
  }

  // 2. Add augmented pairings (take max strength if both sources have the edge)
  for (const pairing of augment.pairings || []) {
    const source = pairing.source.toLowerCase();
    const target = pairing.target.toLowerCase();
    addEdge(source, target, pairing.strength);
  }

  const edges = [...edgeMap.values()];

  // Update pairing counts on nodes
  const pairingCounts = new Map();
  for (const edge of edges) {
    pairingCounts.set(edge.source, (pairingCounts.get(edge.source) || 0) + 1);
    pairingCounts.set(edge.target, (pairingCounts.get(edge.target) || 0) + 1);
  }
  for (const [name, node] of nodes) {
    node.pairingCount = pairingCounts.get(name) || 0;
  }

  const ingredientList = [...nodes.keys()].sort();

  return { nodes, edges, ingredientList, augmentedMap };
}
