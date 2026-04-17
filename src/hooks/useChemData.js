/**
 * useChemData — C variant.
 * Loads public/chemDataset/{ingredients,pairings}.json and adapts to the
 * useProData / useFlavorData return shape: { loading, error, data }
 * where data = { graph, positions, embeddings, raw }.
 *
 * The dataset is produced by chemDataset/scripts/10-blend.js. Until that
 * pipeline runs for real, this hook degrades gracefully to an empty graph.
 */

import { useEffect, useState } from 'react';
import { computeTastePositions } from '../data/tastePositioning.js';

function buildChemGraph(ingredientsData, pairingsData) {
  const nodes = new Map();
  let id = 0;
  for (const [name, info] of Object.entries(ingredientsData || {})) {
    if (name.startsWith('_')) continue;
    nodes.set(name, {
      id: id++,
      name,
      cuisines: [],
      taste: info.taste || null,
      weight: null,
      volume: null,
      season: null,
      tips: [],
      pairingCount: 0,
      affinities: [],
      embedding: null,
      position3D: null,
      category: info.category || null,
      compoundCount: info.compoundCount || 0,
      sources: info.sources || ['chem'],
    });
  }

  const edges = [];
  let maxStrength = 0;
  for (const p of pairingsData || []) {
    if (!nodes.has(p.ingredientA) || !nodes.has(p.ingredientB)) continue;
    const src = p.ingredientA < p.ingredientB ? p.ingredientA : p.ingredientB;
    const tgt = p.ingredientA < p.ingredientB ? p.ingredientB : p.ingredientA;
    edges.push({ source: src, target: tgt, strength: p.strength });
    if (p.strength > maxStrength) maxStrength = p.strength;
  }
  if (maxStrength > 0) for (const e of edges) e.strength /= maxStrength;
  for (const e of edges) {
    nodes.get(e.source).pairingCount++;
    nodes.get(e.target).pairingCount++;
  }

  return { nodes, edges, ingredientList: [...nodes.keys()].sort() };
}

export default function useChemData() {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ingRes, pairRes] = await Promise.all([
          fetch('/chemDataset/ingredients.json'),
          fetch('/chemDataset/pairings.json'),
        ]);
        if (!ingRes.ok) throw new Error('chemDataset/ingredients.json missing — run `cd chemDataset && npm run all`');
        const ingredientsData = await ingRes.json();
        const pairingsData = pairRes.ok ? await pairRes.json() : [];
        if (cancelled) return;
        const graph = buildChemGraph(ingredientsData, pairingsData);
        const positions = computeTastePositions(graph.nodes, graph.edges, 50);
        setState({ loading: false, error: null, data: { graph, positions, embeddings: null, raw: { ingredientsData, pairingsData } } });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
