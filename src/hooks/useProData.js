/**
 * useProData.js — React hook for loading the proprietary dataset
 * (proDataset output) into the same graph format as useFlavorData.
 */

import { useState, useEffect } from 'react';
import { computeTastePositions } from '../data/tastePositioning.js';

// Map proDataset categories to taste strings that NodeMesh can color.
// NodeMesh checks node.taste for: pungent, astringent, salty, sour, bitter, hot, spicy, sweet
const CATEGORY_TO_TASTE = {
  aromatic: 'pungent',
  fat: 'sweet',
  dairy: 'sweet',
  protein: 'salty',
  umami: 'salty',
  citrus: 'sour',
  acid: 'sour',
  herb: 'astringent',
  spice: 'pungent',
  seasoning: 'pungent',
  chili: 'spicy',
  sweetener: 'sweet',
  nut: 'bitter',
  grain: 'salty',
  liquid: 'sour',
  thickener: 'astringent',
  mixer: 'sour',
  spirit: 'bitter',
  liqueur: 'sweet',
  bitters: 'bitter',
  vegetable: 'astringent',
  fruit: 'sweet',
  other: 'pungent',
};

/**
 * Build a graph from the proDataset output files (ingredients.json + pairings.json).
 * Returns the same structure as buildGraph() from graph.js:
 *   { nodes: Map<string, NodeObject>, edges: Array, ingredientList: string[] }
 */
function buildProGraph(ingredientsData, pairingsData) {
  const nodes = new Map();
  let id = 0;

  // Build nodes from ingredients object (keyed by name)
  for (const [name, info] of Object.entries(ingredientsData)) {
    if (name.startsWith('_')) continue; // skip meta keys
    const sources = info.sources || [];
    // Use explicit taste if available, otherwise infer from category
    const taste = info.taste || CATEGORY_TO_TASTE[info.category] || null;
    nodes.set(name, {
      id: id++,
      name,
      cuisines: [],
      taste,
      weight: null,
      volume: null,
      season: null,
      tips: [],
      pairingCount: 0,
      affinities: [],
      embedding: null,
      position3D: null,
      // ProData-specific
      category: info.category || null,
      sourceCount: sources.length,
      sources,
    });
  }

  // Build edges from pairings array
  const edges = [];
  for (const pairing of pairingsData) {
    const a = pairing.ingredientA;
    const b = pairing.ingredientB;
    if (!nodes.has(a) || !nodes.has(b)) continue;
    const source = a < b ? a : b;
    const target = a < b ? b : a;
    edges.push({
      source,
      target,
      strength: pairing.strength,
    });
  }

  // Normalize edge strengths to [0, 1]
  let maxStrength = 0;
  for (const e of edges) {
    if (e.strength > maxStrength) maxStrength = e.strength;
  }
  if (maxStrength > 0) {
    for (const e of edges) {
      e.strength = e.strength / maxStrength;
    }
  }

  // Update pairing counts
  for (const edge of edges) {
    const sn = nodes.get(edge.source);
    const tn = nodes.get(edge.target);
    if (sn) sn.pairingCount++;
    if (tn) tn.pairingCount++;
  }

  const ingredientList = [...nodes.keys()].sort();

  return { nodes, edges, ingredientList };
}

/**
 * Hook that loads the proprietary dataset and returns the same shape as useFlavorData.
 */
export default function useProData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [ingredientsRes, pairingsRes] = await Promise.all([
          fetch('/proDataset/ingredients.json'),
          fetch('/proDataset/pairings.json'),
        ]);

        if (!ingredientsRes.ok) throw new Error('Failed to load proDataset/ingredients.json');
        if (!pairingsRes.ok) throw new Error('Failed to load proDataset/pairings.json');

        const ingredientsData = await ingredientsRes.json();
        const pairingsData = await pairingsRes.json();

        if (cancelled) return;

        const graph = buildProGraph(ingredientsData, pairingsData);

        // Compute 3D positions using the taste positioning system
        const positions = computeTastePositions(graph.nodes, graph.edges, 50);

        setData({
          graph,
          positions,
          embeddings: null,
          raw: {
            ingredientsData,
            pairingsData,
          },
        });
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { loading, error, data };
}
