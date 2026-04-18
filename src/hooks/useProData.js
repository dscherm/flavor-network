/**
 * useProData.js — React hook for loading the proprietary dataset
 * (proDataset output) into the same graph format as useFlavorData.
 */

import { useState, useEffect } from 'react';
import { computeTastePositions } from '../data/tastePositioning.js';

// Map proDataset categories to taste strings that NodeMesh can color.
// NodeMesh checks node.taste for: pungent, astringent, salty, sour, bitter, hot, spicy, sweet
// Multi-taste profiles per category — NodeMesh blends colors when multiple tastes are present
const CATEGORY_TO_TASTE = {
  aromatic: 'pungent sweet',
  fat: 'sweet',
  dairy: 'sweet sour',
  protein: 'salty pungent',
  umami: 'salty bitter',
  citrus: 'sour sweet',
  acid: 'sour',
  herb: 'astringent bitter',
  spice: 'pungent bitter',
  seasoning: 'pungent salty',
  chili: 'spicy pungent',
  sweetener: 'sweet',
  nut: 'bitter sweet',
  grain: 'sweet',
  liquid: 'sour salty',
  thickener: 'sweet',
  mixer: 'sour sweet',
  spirit: 'bitter pungent',
  liqueur: 'sweet bitter',
  bitters: 'bitter pungent',
  vegetable: 'astringent sweet',
  fruit: 'sweet sour',
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
      embedding: info.embeddingFull || null,
      position3D: info.embedding
        ? [info.embedding.x, info.embedding.y, info.embedding.z]
        : null,
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
    let worker = null;

    async function finish(ingredientsData, pairingsData, seasonRegionData, cuisineMapData) {
      if (cancelled) return;

      const graph = buildProGraph(ingredientsData, pairingsData);

        // Merge season and region data into graph nodes
        // Build reverse index for fuzzy matching (sr name → sr entry)
        const srEntries = Object.entries(seasonRegionData);
        for (const [name, node] of graph.nodes) {
          // Exact match first
          let sr = seasonRegionData[name];
          // Fuzzy fallback: check if ingredient name contains an SR key or vice versa
          if (!sr) {
            for (const [srName, srData] of srEntries) {
              if (name.includes(srName) || srName.includes(name)) {
                sr = srData;
                break;
              }
            }
          }
          if (sr) {
            node.season = sr.season || null;
            node.regions = sr.regions || [];
          }
        }

        // Merge cuisine data into graph nodes
        // cuisineTree.js expects lowercase values with " cuisine" suffix
        for (const [name, node] of graph.nodes) {
          const cuisines = cuisineMapData[name];
          if (cuisines && cuisines.length > 0) {
            node.cuisines = cuisines.map(c =>
              c.toLowerCase().endsWith(' cuisine') ? c.toLowerCase() : c.toLowerCase() + ' cuisine'
            );
          }
        }

        // Prefer GNN + Node2Vec positions (gnn_positions.json covers all
        // 3913 ingredients via recipe-graph topology with GNN chemical-
        // similarity anchors). Fall back to the 8-axis taste sphere only
        // if the positions file is missing.
        let positions;
        try {
          const gnnRes = await fetch('/proDataset/gnn_positions.json');
          if (gnnRes.ok) {
            const gnnRaw = await gnnRes.json();
            const posMap = {};
            let count = 0;
            for (const [name, xyz] of Object.entries(gnnRaw)) {
              if (name.startsWith('_')) continue;
              if (!Array.isArray(xyz) || xyz.length !== 3) continue;
              posMap[name] = xyz;
              count++;
            }
            if (count > graph.nodes.size * 0.5) {
              positions = { positions: posMap, _source: 'gnn+node2vec', _count: count };
            }
          }
        } catch {
          // fall through to taste axes
        }
        if (!positions) {
          positions = computeTastePositions(graph.nodes, graph.edges, 50);
        }

        // Same for per-ingredient entropy (used by color shader for uncertainty viz)
        try {
          const entRes = await fetch('/proDataset/gnn_entropy.json');
          if (entRes.ok) {
            const entRaw = await entRes.json();
            for (const [name, info] of Object.entries(entRaw)) {
              if (name.startsWith('_')) continue;
              const node = graph.nodes.get(name);
              if (node && info && typeof info.entropy_norm === 'number') {
                node.gnnEntropy = info.entropy_norm;
                node.gnnProbs = info.probs || null;
              }
            }
          }
        } catch {
          // optional
        }

        // Per-ingredient compound info (names + flavor tags for the UI)
        try {
          const cmpRes = await fetch('/proDataset/gnn_compounds.json');
          if (cmpRes.ok) {
            const cmpRaw = await cmpRes.json();
            for (const [name, info] of Object.entries(cmpRaw)) {
              const node = graph.nodes.get(name);
              if (node && info) {
                node.gnnCompounds = info;
              }
            }
          }
        } catch {
          // optional
        }

        // Cluster labels + explanations for ML network views
        let clusterLabels = null;
        let clusterExplanations = null;
        try {
          const clRes = await fetch('/proDataset/cluster_labels.json');
          if (clRes.ok) clusterLabels = await clRes.json();
        } catch { /* optional */ }
        try {
          const ceRes = await fetch('/proDataset/cluster_explanations.json');
          if (ceRes.ok) {
            clusterExplanations = await ceRes.json();
            // Attach cluster info to each node
            const ic = clusterExplanations.ingredient_clusters || {};
            for (const [name, info] of Object.entries(ic)) {
              const node = graph.nodes.get(name);
              if (node) {
                node.clusterLabel = info.cluster_label;
                node.clusterId = info.cluster_id;
              }
            }
          }
        } catch { /* optional */ }

        // Bridge compounds for molecular journey
        let bridgeCompounds = null;
        let bridgeMolecules3D = null;
        try {
          const [bcRes, bm3dRes] = await Promise.all([
            fetch('/proDataset/bridge_compounds.json'),
            fetch('/models/bridge_molecules_3d.json'),
          ]);
          if (bcRes.ok) bridgeCompounds = await bcRes.json();
          if (bm3dRes.ok) bridgeMolecules3D = await bm3dRes.json();
        } catch { /* optional */ }

        setData({
          graph,
          positions,
          clusterLabels,
          clusterExplanations,
          bridgeCompounds,
          bridgeMolecules3D,
          embeddings: null,
          raw: {
            ingredientsData,
            pairingsData,
          },
        });
        setLoading(false);
    }

    // Try to use a Web Worker for the fetch+parse (keeps the 27MB
    // JSON.parse off the main thread). Fall back to main-thread
    // fetching if Worker construction or the module URL fails —
    // vitest/jsdom and older browsers don't support module workers.
    try {
      worker = new Worker(
        new URL('../workers/pairingsParser.worker.js', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (event) => {
        const msg = event.data;
        if (!msg || cancelled) return;
        if (msg.type === 'loaded') {
          finish(
            msg.ingredientsData,
            msg.pairingsData,
            msg.seasonRegionData || {},
            msg.cuisineMapData || {}
          ).catch((err) => {
            if (cancelled) return;
            setError(err.message);
            setLoading(false);
          });
        } else if (msg.type === 'error') {
          setError(msg.message);
          setLoading(false);
        }
      };
      worker.onerror = (err) => {
        if (cancelled) return;
        setError(err.message || 'pairings worker failed');
        setLoading(false);
      };
      worker.postMessage({ type: 'load' });
    } catch {
      // Fallback: load on main thread (no Worker support)
      (async () => {
        try {
          const [ingredientsRes, pairingsRes, seasonRegionRes, cuisineMapRes] = await Promise.all([
            fetch('/proDataset/ingredients.json'),
            fetch('/proDataset/pairings.json'),
            fetch('/data/season_region.json').catch(() => null),
            fetch('/data/cuisine_map.json').catch(() => null),
          ]);
          if (!ingredientsRes.ok) throw new Error('Failed to load proDataset/ingredients.json');
          if (!pairingsRes.ok) throw new Error('Failed to load proDataset/pairings.json');
          const ingredientsData = await ingredientsRes.json();
          const pairingsData = await pairingsRes.json();
          const seasonRegionData = seasonRegionRes?.ok ? await seasonRegionRes.json() : {};
          const cuisineMapData = cuisineMapRes?.ok ? await cuisineMapRes.json() : {};
          await finish(ingredientsData, pairingsData, seasonRegionData, cuisineMapData);
        } catch (err) {
          if (!cancelled) {
            setError(err.message);
            setLoading(false);
          }
        }
      })();
    }

    return () => {
      cancelled = true;
      if (worker) {
        try { worker.terminate(); } catch { /* ignore */ }
      }
    };
  }, []);

  return { loading, error, data };
}
