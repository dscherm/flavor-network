/**
 * useProData.js — React hook for loading the proprietary dataset
 * (proDataset output) into the same graph format as useFlavorData.
 */

import { useState, useEffect } from 'react';
import { computeTastePositions } from '../data/tastePositioning.js';
import { computeAffinityThresholds } from '../data/affinityThresholds.js';
import { buildTier1Thresholds } from '../data/primaryTier1.js';
import { resolvePrimaryTier1 } from '../data/tier1Overrides.js';
import { isNative } from '../utils/native.js';

// N+1 v3 feature flag — when enabled, useProData fetches the corpus-wide
// v3 artifacts (flavor_positions_v3, flavor_positions_2d_v3, cluster_labels_v3)
// in place of the v2 files.
//
// Defaults (as of 2026-05-24):
//   - Web: ON (flipped from OFF after the chef-approved research pass)
//   - Native iOS (Capacitor WKWebView): ON
//
// Opt out (v2 fallback) — primary escape hatch:
//   - localStorage.setItem('FN_FLAVOR_V3', 'false')
//
// Force-on overrides (no-op vs default but kept for parity):
//   - localStorage.setItem('FN_FLAVOR_V3', 'true')
//   - Build-time: VITE_FN_FLAVOR_V3=true npm run build
//
// Canonical spec: docs/NETWORK-AND-AFFINITY-SPEC.md §10.1.
function flavorV3Enabled() {
  try {
    if (typeof localStorage !== 'undefined') {
      const ls = localStorage.getItem('FN_FLAVOR_V3');
      if (ls === 'true') return true;
      if (ls === 'false') return false;
    }
  } catch { /* localStorage blocked (privacy mode) — fall through */ }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FN_FLAVOR_V3 === 'true') {
    return true;
  }
  // V3 is now the default everywhere (web + native). The chef-approved
  // research pass (2026-05-24) added 25 cluster-classified ingredients and
  // 44 aliases to the v3 corpus; flipping web makes that work visible to
  // all users. V2 still reachable via localStorage.FN_FLAVOR_V3='false'.
  if (isNative()) return true;
  return true;
}

// Flavor-layout A/B was promoted on 2026-05-24: chef picked the GNN
// variant, so the canonical _v3 files now contain GNN data. The A/B
// scaffolding (flavorLayoutMode, v3PathFor, FlavorLayoutToggle) was
// removed; pre-promotion encoded snapshots are preserved as
// public/proDataset/*_v3.json.pre-gnn-promote.bak.

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
 *
 * Options:
 *   enabled (default true) — when false, skips the fetch entirely and returns
 *     { loading:false, data:null, error:null }. Flipping to true triggers the
 *     fetch exactly once. Used by the Start Page to defer the 27MB pairings
 *     download until the user picks a mode.
 *
 * Return value also includes `retry()` — invoking it re-runs the fetch,
 * used by the Error Card's Retry button when the initial fetch fails.
 */
export default function useProData({ enabled = true } = {}) {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
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
          // V3 toggle: swap the default ML-mode 3D layout to the corpus-wide
          // UMAP from V3d so cluster centroids align with v3 clusters. Without
          // this swap, the network shows v2 gnn_positions topology painted
          // with v3 cluster colors → mismatched, nodes appear clustered wrong.
          const gnnRes = await fetch(flavorV3Enabled()
            ? '/proDataset/flavor_positions_v3.json'
            : '/proDataset/gnn_positions.json');
          if (gnnRes.ok) {
            const gnnRaw = await gnnRes.json();
            const posMap = {};
            let count = 0;
            // Scale positions ~1.5× so adjacent ingredient nodes have
            // visible breathing room between them. The raw GNN coords
            // pack 3,913 nodes into a ~50-unit bounding box, which on
            // mobile reads as a single dense cloud rather than
            // distinguishable nodes. 1.5× expands the bbox without
            // distorting topology — every cluster, edge, and centroid
            // scales together.
            const POSITION_SPREAD = 1.5;
            for (const [name, xyz] of Object.entries(gnnRaw)) {
              if (name.startsWith('_')) continue;
              if (!Array.isArray(xyz) || xyz.length !== 3) continue;
              posMap[name] = [
                xyz[0] * POSITION_SPREAD,
                xyz[1] * POSITION_SPREAD,
                xyz[2] * POSITION_SPREAD,
              ];
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

        // Flavor-space positions (C₁′ prototype). UMAP over per-ingredient
        // GNN taste+aroma vectors → 3D coordinate per ingredient. Covers
        // ~2,790 ingredients (GNN-resolvable). Ingredients without flavor
        // vectors fall through to the recipe-cooccurrence position so the
        // toggle never loses nodes mid-flight. Optional — only loaded for
        // the 'flavor3D' / 'mlflavor' beta mode.
        let flavorPositions = null;
        try {
          const fpRes = await fetch(flavorV3Enabled()
            ? '/proDataset/flavor_positions_v3.json'
            : '/proDataset/flavor_positions.json');
          if (fpRes.ok) {
            const fpRaw = await fpRes.json();
            const posMap = {};
            // Same 1.5× spread scale used for the recipe-coocc layout
            // so node sizes / camera defaults read consistently across
            // the toggle.
            const FLAVOR_SPREAD = 3.0; // raw UMAP range ~30 → bbox ~90
            for (const [name, xyz] of Object.entries(fpRaw)) {
              if (name.startsWith('_')) continue;
              if (!Array.isArray(xyz) || xyz.length !== 3) continue;
              posMap[name] = [
                xyz[0] * FLAVOR_SPREAD,
                xyz[1] * FLAVOR_SPREAD,
                xyz[2] * FLAVOR_SPREAD,
              ];
            }
            flavorPositions = {
              positions: posMap,
              _source: 'gnn-flavor-umap',
              _count: Object.keys(posMap).length,
            };
          }
        } catch {
          // optional — flavor3D toggle silently falls back to recipe positions
        }

        // v3 P-C4 — 2D-from-3D positions for the `flavor2D` mode key.
        // Same UMAP seed as flavor_positions.json but n_components=2;
        // emitted alongside the 3D layout by flavor_layout_v2.py (v2 P1,
        // shipped commit a04486e). z is filled with 0 so the renderer's
        // existing [x, y, z] consumer reads it unchanged.
        let flavorPositions2D = null;
        try {
          const fp2dRes = await fetch(flavorV3Enabled()
            ? '/proDataset/flavor_positions_2d_v3.json'
            : '/proDataset/flavor_positions_2d.json');
          if (fp2dRes.ok) {
            const fp2dRaw = await fp2dRes.json();
            const posMap = {};
            const FLAVOR_SPREAD = 3.0;
            for (const [name, xy] of Object.entries(fp2dRaw)) {
              if (name.startsWith('_')) continue;
              if (!Array.isArray(xy) || xy.length !== 2) continue;
              posMap[name] = [
                xy[0] * FLAVOR_SPREAD,
                xy[1] * FLAVOR_SPREAD,
                0,
              ];
            }
            flavorPositions2D = {
              positions: posMap,
              _source: 'gnn-flavor-umap-2d',
              _count: Object.keys(posMap).length,
            };
          }
        } catch { /* optional — flavor2D mode silently falls back */ }

        // v3 flavor-graph data (Path B output). The 89-node chef-verified
        // subgraph: per-ingredient {tier1, tier2, tier3, leaves, embedding,
        // cluster} + edges with principle labels + cluster centroids. Used
        // by the v3 IngredientPanel tree-view + the network re-color path.
        // The 3,824 long-tail ingredients have no entry here — they fall
        // through to the gnn-derived primaryTier1Aroma below.
        let flavorGraph = null;
        try {
          const fgRes = await fetch(flavorV3Enabled()
            ? '/proDataset/flavor_graph_data_v3.json'
            : '/proDataset/flavor_graph_data.json');
          if (fgRes.ok) {
            const fgRaw = await fgRes.json();
            const byName = {};
            for (const node of fgRaw.nodes || []) {
              if (node?.name) byName[node.name] = node;
            }
            flavorGraph = {
              byName,
              edges: fgRaw.edges || [],
              clusters: fgRaw.clusters || [],
              _meta: fgRaw._meta || {},
            };
          }
        } catch { /* optional — v3 chef data not yet served in dev */ }

        // Flavor-space cluster labels (k-means over flavor positions).
        // Independent of the Node2Vec cluster_labels.json. The renderer
        // shows these only in flavor3D / mlflavor mode. Centroid coords
        // are scaled by the same FLAVOR_SPREAD factor used on positions
        // so labels line up with the rendered nodes.
        let flavorClusterLabels = null;
        try {
          // V3 toggle: in flavor3D / mlflavor mode the cluster label
          // sprites read from `data.flavorClusterLabels`. Point that at
          // cluster_labels_v3.json (same shape: clusters[{id,label,size,
          // centroid_3d}]) so v3 cluster labels actually render in the
          // default flavor3D view.
          const fclRes = await fetch(flavorV3Enabled()
            ? '/proDataset/cluster_labels_v3.json'
            : '/proDataset/flavor_cluster_labels.json');
          if (fclRes.ok) {
            flavorClusterLabels = await fclRes.json();
            const SPREAD = 3.0;
            if (Array.isArray(flavorClusterLabels?.clusters)) {
              flavorClusterLabels.clusters = flavorClusterLabels.clusters.map(c => ({
                ...c,
                centroid_3d: Array.isArray(c.centroid_3d)
                  ? c.centroid_3d.map(v => v * SPREAD)
                  : c.centroid_3d,
              }));
            }
          }
        } catch { /* optional */ }

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

        // Compound-food synthesis. Runs AFTER the direct GNN load so the
        // model's predictions (when present) win over our synthesized
        // ones. Targets ingredients like mayonnaise / garam masala /
        // ranch dressing that the GNN has no prediction for AND can't
        // reasonably get one (they're recipes-of-other-ingredients,
        // not single molecules). The synthesized profile is tagged
        // `gnnProbsSource = 'compound'` so the UI can badge it.
        try {
          const { applyCompoundSynthesis } = await import('../data/compoundFoods.js');
          applyCompoundSynthesis(graph.nodes);
        } catch {
          // optional — never block the data hook on this
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
          const clRes = await fetch(flavorV3Enabled()
            ? '/proDataset/cluster_labels_v3.json'
            : '/proDataset/cluster_labels.json');
          if (clRes.ok) clusterLabels = await clRes.json();
        } catch { /* optional */ }
        try {
          const ceRes = await fetch('/proDataset/cluster_explanations.json');
          if (ceRes.ok) {
            clusterExplanations = await ceRes.json();
            // Attach cluster info to each node + the cluster's
            // multi-cuisine explanation so IngredientPanel can show
            // *why* an ingredient sits in this cluster (e.g. why
            // pita bread is in "Mexican" — because the cluster spans
            // Turkish/Lebanese/Middle-Eastern co-occurrence too).
            const ic = clusterExplanations.ingredient_clusters || {};
            const cls = clusterExplanations.clusters || {};
            for (const [name, info] of Object.entries(ic)) {
              const node = graph.nodes.get(name);
              if (!node) continue;
              node.clusterLabel = info.cluster_label;
              node.clusterId = info.cluster_id;
              const c = cls[String(info.cluster_id)];
              if (c) {
                node.clusterExplanation = c.explanation;
                node.clusterTopCuisines = c.top_cuisines || [];
                node.clusterTopIngredients = c.top_ingredients || [];
              }
            }
          }
        } catch { /* optional */ }

        // N+1 v3 — when cluster_labels_v3.json was loaded, it exposes
        // an `ingredients` map (name → cluster_id) and a `clusters`
        // array with v3 labels. Override the v2 cluster_explanations
        // assignments so nodes carry v3 cluster ids consistent with
        // cluster_labels_v3.json. cluster_explanations.json has no v3
        // equivalent yet — explanation text + top-cuisines remain
        // v2-shaped (cleared so they don't reference stale v2 ids).
        // Also: tint nodes by v3 cluster color (palette shared with
        // LivingArchView's CLUSTER_HEX) so the 6 v3 clusters are
        // visually distinguishable in flavor3D mode, where the cluster-
        // palette path isn't otherwise wired. primaryTier1Aroma is
        // cleared in v3 mode so the cluster color wins over the per-
        // ingredient aroma color in NodeMesh.getColorForNode (otherwise
        // chef rows would aroma-color over cluster, breaking the visual
        // cluster boundary).
        const V3_CLUSTER_HEX = [
          '#f472b6', '#ea580c', '#22c55e',
          '#dc2626', '#facc15', '#a855f7',
          '#84cc16', '#b45309', '#78350f', '#64748b',
          // Extended palette (cluster ids 10-17) — distinct from 0-9 above.
          // Added 2026-05-24 after layout-v3 bisection grew clusters from 8 to 17.
          '#06b6d4', '#fb7185', '#10b981',
          '#eab308', '#7c3aed', '#15803d',
          '#9333ea', '#0284c7',
          // Further extended for k=20 GNN bisection (cluster ids 18-19)
          '#ef4444', '#14b8a6',
        ];
        if (clusterLabels?.ingredients && Array.isArray(clusterLabels?.clusters)) {
          const labelById = {};
          for (const c of clusterLabels.clusters) {
            labelById[c.id] = c.label;
          }
          // First pass: pre-set every graph node to neutral gray so the
          // 1,762 nodes in ingredients.json that v3 doesn't cover (out
          // of pairings/positions universe) don't fall through to
          // taste-based blending. Without this, cyan/magenta/purple/grey
          // taste colors leak through and visually break the v3 palette.
          const V3_FALLBACK_HEX = '#5a5a6b';
          for (const [, node] of graph.nodes) {
            node.clusterColor = V3_FALLBACK_HEX;
            node.primaryTier1Aroma = null;
            node.clusterLabel = null;
          }
          // Second pass: override with the actual v3 cluster assignment.
          for (const [name, cid] of Object.entries(clusterLabels.ingredients)) {
            const node = graph.nodes.get(name);
            if (!node) continue;
            node.clusterId = cid;
            if (cid >= 0) {
              node.clusterLabel = labelById[cid] ?? null;
              node.clusterColor = V3_CLUSTER_HEX[cid % V3_CLUSTER_HEX.length];
            }
            node.clusterExplanation = undefined;
            node.clusterTopCuisines = undefined;
            node.clusterTopIngredients = undefined;
          }
        }

        // Impute 3D positions for ingredients missing from gnn_positions.json.
        // ~594 of 3913 ingredients have a clusterId but no GNN coordinate
        // (e.g. five-spice powder, red curry, hoisin, gochujang). Without
        // imputation they fall back to the taste-axis sphere in LivingArchView,
        // which scatters them by taste tag rather than by cluster — making them
        // appear orphaned from their actual cluster. Place each missing
        // ingredient at its cluster centroid plus a small deterministic jitter
        // (hashed from the name) so they sit visibly inside the cluster cloud.
        if (positions?.positions && clusterExplanations?.ingredient_clusters) {
          const posMap = positions.positions;
          // Compute per-cluster centroid from ingredients that DO have positions.
          const sumByCluster = new Map();
          const cntByCluster = new Map();
          for (const [name, node] of graph.nodes) {
            if (typeof node.clusterId !== 'number') continue;
            const p = posMap[name];
            if (!p) continue;
            const cid = node.clusterId;
            if (!sumByCluster.has(cid)) { sumByCluster.set(cid, [0, 0, 0]); cntByCluster.set(cid, 0); }
            const s = sumByCluster.get(cid);
            s[0] += p[0]; s[1] += p[1]; s[2] += p[2];
            cntByCluster.set(cid, cntByCluster.get(cid) + 1);
          }
          const centroidByCluster = new Map();
          for (const [cid, s] of sumByCluster) {
            const n = cntByCluster.get(cid) || 1;
            centroidByCluster.set(cid, [s[0] / n, s[1] / n, s[2] / n]);
          }
          // Deterministic per-name jitter via a small string hash → 3 angles.
          // Magnitude ~3 keeps the imputed point well inside the cluster cloud
          // (typical East Asian member sits 3–8 units from centroid).
          let imputed = 0;
          const JITTER_R = 3.0;
          for (const [name, node] of graph.nodes) {
            if (typeof node.clusterId !== 'number') continue;
            if (posMap[name]) continue;
            const c = centroidByCluster.get(node.clusterId);
            if (!c) continue;
            // FNV-1a-ish hash for a stable per-name seed in [0,1).
            let h = 2166136261;
            for (let i = 0; i < name.length; i++) {
              h ^= name.charCodeAt(i);
              h = Math.imul(h, 16777619);
            }
            const u = ((h >>> 0) % 10000) / 10000;
            const v = (((h >>> 8) >>> 0) % 10000) / 10000;
            const w = (((h >>> 16) >>> 0) % 10000) / 10000;
            const theta = u * 2 * Math.PI;
            const phi = Math.acos(2 * v - 1);
            const r = JITTER_R * Math.cbrt(w);
            posMap[name] = [
              c[0] + r * Math.sin(phi) * Math.cos(theta),
              c[1] + r * Math.sin(phi) * Math.sin(theta),
              c[2] + r * Math.cos(phi),
            ];
            imputed++;
          }
          positions._imputed_count = imputed;
        }

        // Recipe-level co-occurrence + globalCount (top-50 partners per
        // ingredient, slim derivative of recipenlg-cooccurrence.json).
        // Drives the v2 SuggestionDrawer ranking — Approach A: weighted
        // recipe co-occurrence × familiarity.
        // Retry up to 3× because a transient QUIC/HTTP3 failure on the
        // 2.7 MB asset would silently disable v2 and fall back to the
        // legacy ranking (which doesn't react to bowl changes).
        let recipePairs = null;
        let globalCount = null;
        for (let attempt = 0; attempt < 3 && !recipePairs; attempt++) {
          try {
            const rpRes = await fetch('/proDataset/recipe_pairs.json');
            if (rpRes.ok) {
              const rp = await rpRes.json();
              recipePairs = rp.pairs || null;
              globalCount = rp.globalCount || null;
              break;
            }
          } catch { /* retry */ }
          if (attempt < 2) await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }

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

        // GNN predicted taste/odor profiles + two threshold artifacts:
        //   - odor_thresholds.json: molecule-level F1-optimized (per compound)
        //   - ingredient_profile_thresholds.json: ingredient-level p85 thresholds
        //     (used by PredictedProfile because mean-pooled ingredient probs
        //     sit far below molecule-level calibration targets)
        // Entropy file prefers the imputed version when available so hub
        // ingredients (egg, butter, ...) also get a profile.
        let gnnEntropy = null;
        let odorThresholds = null;
        let ingredientThresholds = null;
        let compoundTastes = null;
        try {
          const [geImpRes, geRes, otRes, itRes, ctRes] = await Promise.all([
            fetch('/proDataset/gnn_entropy_imputed.json'),
            fetch('/proDataset/gnn_entropy.json'),
            fetch('/proDataset/odor_thresholds.json'),
            fetch('/proDataset/ingredient_profile_thresholds.json'),
            fetch('/proDataset/compound_tastes.json'),
          ]);
          if (geImpRes.ok) gnnEntropy = await geImpRes.json();
          else if (geRes.ok) gnnEntropy = await geRes.json();
          if (otRes.ok) odorThresholds = await otRes.json();
          if (itRes.ok) ingredientThresholds = await itRes.json();
          if (ctRes.ok) compoundTastes = await ctRes.json();
        } catch { /* optional */ }

        // v3 P-C1: per-node flavorGraph decoration + primaryTier1Aroma
        // selector. Chef path for the 89 verified rows in
        // flavor_graph_data.json; GNN path (gnnProbs × ingredient_profile_
        // thresholds) for the ~3,824 long-tail ingredients. See
        // src/data/primaryTier1.js for the selector contract.
        // In v3 mode, the cluster-color path drives node tinting (see
        // the V3_CLUSTER_HEX block above). primaryTier1Aroma is left
        // null so cluster color wins in NodeMesh.getColorForNode.
        // flavorGraph decoration still runs because IngredientPanel
        // chip-cloud rendering depends on it.
        const tier1Thresholds = buildTier1Thresholds(ingredientThresholds);
        // N1-D5 (2026-05-25): primaryTier1Aroma is always computed — chef
        // T1[0] for the 89 verified ingredients, GNN-derived T1 with
        // calibrated thresholds for the long-tail. Drives the
        // BRISCIONE_AROMA palette in NodeMesh.getColorForNode; cluster
        // color falls through as a defensive fallback when no T1 is
        // derivable (canon §3.1 precedence).
        for (const [name, node] of graph.nodes) {
          const entry = flavorGraph?.byName?.[name] ?? null;
          if (entry) {
            node.flavorGraph = {
              tier1: entry.tier1 || [],
              tier2: entry.tier2 || [],
              tier3: entry.tier3 || [],
              leaves: entry.leaves || [],
              embedding: entry.embedding || null,
              cluster: typeof entry.cluster === 'number' ? entry.cluster : null,
              source: 'chef',
            };
            node.primaryTier1Aroma = entry.tier1?.[0] ?? null;
          } else {
            node.flavorGraph = null;
            node.primaryTier1Aroma = resolvePrimaryTier1(name, node.gnnProbs, tier1Thresholds);
          }
        }

        // Affinity Mode (α-mode) lookup maps. Built once at session
        // start so AffinityMode.engage() / .pivot() / topAffinities()
        // can compute tier scoring in O(1) per candidate. See
        // src/data/affinityTiers.js + .omc/plans/ralplan-flavor-affinity-mode.md.
        const pairingStrength = new Map();
        for (const e of graph.edges) {
          // Both directions so tierFor() can look up either way.
          pairingStrength.set(`${e.source}|${e.target}`, e.strength);
          pairingStrength.set(`${e.target}|${e.source}`, e.strength);
        }
        const top5 = new Map();
        for (const [name, node] of graph.nodes) {
          const compounds = node.gnnCompounds?.top_compounds;
          if (Array.isArray(compounds) && compounds.length > 0) {
            top5.set(name, compounds.slice(0, 5).map(c => c.name));
          }
        }
        const bridgeCompoundIndex = new Map();
        if (bridgeCompounds && typeof bridgeCompounds === 'object') {
          for (const [key, val] of Object.entries(bridgeCompounds)) {
            if (key.startsWith('_')) continue; // skip _meta
            if (val && Array.isArray(val.bridges)) {
              bridgeCompoundIndex.set(key, val);
            }
          }
        }
        const affinityThresholds = computeAffinityThresholds(graph.edges);

        // Cuisine-anchored pairings (Stage 1 artifact from
        // proDataset/scripts/14-build-cuisine-pairings.js). Optional —
        // affinity tier promotion + cuisine chip rely on it but fall
        // back to the chemistry-only ranking when absent.
        let cuisinePairings = null;
        const cuisinePairLookup = new Map();   // pairKey → record
        try {
          const cpRes = await fetch('/proDataset/cuisine_pairings.json');
          if (cpRes.ok) {
            cuisinePairings = await cpRes.json();
            if (cuisinePairings?.pairs) {
              for (const [k, v] of Object.entries(cuisinePairings.pairs)) {
                cuisinePairLookup.set(k, v);
              }
            }
          }
        } catch { /* optional */ }

        // Per-ingredient inverted index of cuisine-anchored neighbors.
        // Built once at load time so downstream suggestion / recipe-
        // scoring code paths can do O(1) per-ingredient lookups via
        // `getNeighborsEnriched`. This is the single source of truth
        // for cuisine pairs across notebook suggestions, recipe scoring,
        // ingredient picker, and the affinity 3D view.
        let cuisineNeighborIndex = null;
        if (cuisinePairLookup.size > 0) {
          const { buildCuisineNeighborIndex } = await import('../data/cuisinePairings.js');
          cuisineNeighborIndex = buildCuisineNeighborIndex(
            cuisinePairLookup,
            new Set(graph.nodes.keys()),
          );
        }

        if (typeof window !== 'undefined') window.__proDataGraph = graph;
        setData({
          graph,
          positions,
          flavorPositions,
          flavorPositions2D,
          flavorClusterLabels,
          flavorGraph,
          clusterLabels,
          clusterExplanations,
          bridgeCompounds,
          bridgeMolecules3D,
          gnnEntropy,
          odorThresholds,
          ingredientThresholds,
          compoundTastes,
          recipePairs,
          globalCount,
          // α-mode context (R13-3)
          pairingStrength,
          top5,
          bridgeCompoundIndex,
          affinityThresholds,
          cuisinePairings,
          cuisinePairLookup,
          cuisineNeighborIndex,
          // Phase-2 categorical wheel inputs — LivingArchView consumes
          // these to bucket nodes for the Aromas / Cuisine / Season /
          // Family modes.
          cuisineMap: cuisineMapData || {},
          seasonMap: seasonRegionData || {},
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
  }, [enabled, retryCount]);

  const retry = () => setRetryCount((c) => c + 1);

  return { loading, error, data, retry };
}
