/**
 * Graph builder — constructs node/edge graph from parsed data.
 * Nodes = ingredients, Edges = pairings with strength values.
 */

/**
 * Build the full ingredient graph from loaded data.
 * @param {Object} data - Output from loadAllData()
 * @returns {{ nodes: Map<string, Object>, edges: Array<Object>, ingredientList: string[] }}
 */
export function buildGraph(data) {
  const { pairings, metadata, ingredientCuisines, affinities } = data;

  // Collect all unique ingredients from pairings (both sides)
  const ingredientSet = new Set();
  for (const [ingredient, targets] of pairings) {
    ingredientSet.add(ingredient);
    for (const target of targets) {
      ingredientSet.add(target);
    }
  }

  const ingredientList = [...ingredientSet].sort();

  // Build nodes
  const nodes = new Map();
  let id = 0;
  for (const name of ingredientList) {
    const meta = metadata.get(name) || { taste: null, weight: null, volume: null, season: null, tips: [] };
    const cuisines = ingredientCuisines.get(name) || [];
    const pairingCount = pairings.has(name) ? pairings.get(name).length : 0;
    const ingredientAffinities = affinities.get(name) || [];

    nodes.set(name, {
      id: id++,
      name,
      cuisines,
      taste: meta.taste,
      weight: meta.weight,
      volume: meta.volume,
      season: meta.season,
      tips: meta.tips,
      pairingCount,
      affinities: ingredientAffinities,
      embedding: null,   // filled later by ML pipeline
      position3D: null,  // filled later by dimension reduction
    });
  }

  // Build edges — deduplicate bidirectional pairs and compute strength
  const edgeMap = new Map();
  for (const [source, targets] of pairings) {
    for (const target of targets) {
      // Skip if target isn't a known ingredient (could be a cuisine or metadata)
      if (!nodes.has(target)) continue;

      const key = source < target ? `${source}|${target}` : `${target}|${source}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { source: key.split('|')[0], target: key.split('|')[1], strength: 0 });
      }
      // Strength increases for each direction the pairing appears
      edgeMap.get(key).strength += 1;
    }
  }

  // Normalize strength to 0-1 range
  const edges = [...edgeMap.values()];
  const maxStrength = Math.max(1, ...edges.map(e => e.strength));
  for (const edge of edges) {
    edge.strength = edge.strength / maxStrength;
  }

  return { nodes, edges, ingredientList };
}

/**
 * Get all neighbors of an ingredient with their edge strengths.
 */
export function getNeighbors(ingredient, edges) {
  const neighbors = [];
  for (const edge of edges) {
    if (edge.source === ingredient) {
      neighbors.push({ name: edge.target, strength: edge.strength });
    } else if (edge.target === ingredient) {
      neighbors.push({ name: edge.source, strength: edge.strength });
    }
  }
  return neighbors.sort((a, b) => b.strength - a.strength);
}

/**
 * Enriched neighbor lookup — chemistry pairs + cuisine-anchored pairs
 * from the same ingredient. This is the single-source-of-truth API
 * for every suggestion / recipe-scoring / notebook code path that
 * wants culinary-tradition pairings alongside chemistry pairings.
 *
 * Behavior:
 *  - Chemistry neighbors from `edges` come first (provenance='chemistry').
 *  - For each chemistry neighbor that's also cuisine-anchored, the
 *    cuisineAnchor + cuisineStrength fields are attached and provenance
 *    flips to 'both' — the chemistry strength is preserved so existing
 *    rank logic doesn't change.
 *  - Cuisine-only pairs (no chemistry edge) are appended with
 *    `strength = cuisineStrength` so they sort into the list at a
 *    meaningful position rather than landing at 0.
 *
 * @param {string} ingredient
 * @param {Array} edges
 * @param {Map<string, Array>} [cuisineNeighborIndex]
 * @returns {Array<{name, strength, provenance?, cuisineStrength?, cuisineAnchor?}>}
 */
export function getNeighborsEnriched(ingredient, edges, cuisineNeighborIndex) {
  const base = getNeighbors(ingredient, edges);
  if (!cuisineNeighborIndex || !cuisineNeighborIndex.has(ingredient)) {
    for (const n of base) n.provenance = 'chemistry';
    return base;
  }
  const seen = new Map();
  for (const n of base) {
    n.provenance = 'chemistry';
    seen.set(n.name, n);
  }
  for (const cn of cuisineNeighborIndex.get(ingredient)) {
    const existing = seen.get(cn.name);
    if (existing) {
      existing.cuisineAnchor = cn.cuisineAnchor;
      existing.cuisineStrength = cn.cuisineStrength;
      existing.provenance = 'both';
    } else {
      seen.set(cn.name, {
        name: cn.name,
        strength: cn.cuisineStrength,
        cuisineStrength: cn.cuisineStrength,
        cuisineAnchor: cn.cuisineAnchor,
        provenance: 'cuisine',
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.strength - a.strength);
}

/**
 * Get shared pairings between two ingredients.
 */
export function getSharedPairings(ing1, ing2, edges) {
  const neighbors1 = new Set(getNeighbors(ing1, edges).map(n => n.name));
  const neighbors2 = new Set(getNeighbors(ing2, edges).map(n => n.name));
  return [...neighbors1].filter(n => neighbors2.has(n));
}

/**
 * Build an adjacency list for fast lookups.
 */
export function buildAdjacencyList(edges) {
  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source).push({ name: edge.target, strength: edge.strength });
    adj.get(edge.target).push({ name: edge.source, strength: edge.strength });
  }
  return adj;
}

/**
 * Find the strongest connection path between two ingredients using
 * a modified Dijkstra's where edge weight = 1 - strength (prefer strong connections).
 * Returns the path as an array of ingredient names, or [] if no path exists.
 */
export function findStrongestPath(start, end, edges, maxDepth = 5) {
  const adj = buildAdjacencyList(edges);
  if (!adj.has(start) || !adj.has(end)) return [];

  // Dijkstra with cost = 1 - strength (so strong edges are cheap)
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  dist.set(start, 0);
  const queue = [{ name: start, cost: 0, depth: 0 }];

  while (queue.length > 0) {
    // Simple priority queue via sort (fine for small graphs)
    queue.sort((a, b) => a.cost - b.cost);
    const { name: current, cost, depth } = queue.shift();

    if (current === end) {
      // Reconstruct path
      const path = [];
      let node = end;
      while (node) {
        path.unshift(node);
        node = prev.get(node) || null;
      }
      return path;
    }

    if (visited.has(current) || depth >= maxDepth) continue;
    visited.add(current);

    for (const neighbor of (adj.get(current) || [])) {
      const edgeCost = 1 - neighbor.strength;
      const newCost = cost + edgeCost;
      if (!dist.has(neighbor.name) || newCost < dist.get(neighbor.name)) {
        dist.set(neighbor.name, newCost);
        prev.set(neighbor.name, current);
        queue.push({ name: neighbor.name, cost: newCost, depth: depth + 1 });
      }
    }
  }

  return [];
}
