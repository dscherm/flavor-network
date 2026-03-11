import { useState, useEffect } from 'react';
import { loadAllData } from '../data/loader.js';
import { buildGraph } from '../data/graph.js';

/**
 * React hook for loading flavor data, building the graph, and loading embeddings/positions.
 * Returns { loading, error, data } where data includes graph, embeddings, positions, raw data.
 */
export default function useFlavorData() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Load CSV data and pre-computed ML artifacts in parallel
        const [rawData, embeddingsRes, positionsRes] = await Promise.all([
          loadAllData('/data'),
          fetch('/embeddings.json').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/positions3d.json').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        if (cancelled) return;

        // Build graph from parsed CSV data
        const graph = buildGraph(rawData);

        // Attach positions to nodes if available
        if (positionsRes?.positions) {
          for (const [name, node] of graph.nodes) {
            const pos = positionsRes.positions[name];
            if (pos) {
              node.position3D = pos;
            }
          }
        }

        // Attach embeddings to nodes if available
        if (embeddingsRes?.embeddings) {
          for (const [name, node] of graph.nodes) {
            const emb = embeddingsRes.embeddings[name];
            if (emb) {
              node.embedding = emb;
            }
          }
        }

        setState({
          loading: false,
          error: null,
          data: {
            graph,
            embeddings: embeddingsRes,
            positions: positionsRes,
            raw: rawData,
          },
        });
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err.message, data: null });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
