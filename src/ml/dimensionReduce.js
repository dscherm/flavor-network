/**
 * Dimension reduction — project high-dimensional embeddings to 3D using UMAP.
 * Used at build time (train script) and can also run in browser for dynamic projections.
 */

import { UMAP } from 'umap-js';

const DEFAULT_UMAP_CONFIG = {
  nComponents: 3,
  nNeighbors: 15,
  minDist: 0.1,
  spread: 1.0,
  nEpochs: 400,
};

/**
 * Project embedding vectors to 3D positions using UMAP.
 * @param {Object} embeddingsData - { embeddings: { name: number[] }, dim: number }
 * @param {Object} config - UMAP configuration overrides
 * @returns {{ positions: Object<string, [number, number, number]>, names: string[] }}
 */
export function projectTo3D(embeddingsData, config = {}) {
  const names = Object.keys(embeddingsData.embeddings);
  const vectors = names.map(n => embeddingsData.embeddings[n]);

  const umapConfig = { ...DEFAULT_UMAP_CONFIG, ...config };
  const umap = new UMAP(umapConfig);

  const projected = umap.fit(vectors);

  // Scale positions to a reasonable range for the 3D scene
  const positions = {};
  const scale = 50; // spread nodes across a 100-unit cube

  // Find bounds for normalization
  let mins = [Infinity, Infinity, Infinity];
  let maxs = [-Infinity, -Infinity, -Infinity];
  for (const pos of projected) {
    for (let d = 0; d < 3; d++) {
      mins[d] = Math.min(mins[d], pos[d]);
      maxs[d] = Math.max(maxs[d], pos[d]);
    }
  }

  for (let i = 0; i < names.length; i++) {
    const normalized = [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const range = maxs[d] - mins[d] || 1;
      normalized[d] = ((projected[i][d] - mins[d]) / range - 0.5) * 2 * scale;
    }
    positions[names[i]] = normalized;
  }

  return { positions, names };
}

/**
 * Load pre-computed 3D positions from static JSON (browser use).
 */
export async function loadPrecomputed3DPositions(path = '/positions3d.json') {
  const res = await fetch(path);
  return res.json();
}
