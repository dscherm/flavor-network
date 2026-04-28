import { useState, useEffect, useMemo, useCallback } from 'react';
import NetworkScene from './NetworkScene.jsx';
import CocktailDetailPanel from './CocktailDetailPanel.jsx';
import {
  loadCocktailCodex,
  computeCodexPositions,
} from '../data/cocktailCodex.js';
import { createClusterLabels } from '../three/AxisLabels.js';
import ClusterJoystick from './ClusterJoystick.jsx';
import ShapeLegend from './ShapeLegend.jsx';
import { COCKTAIL_SHAPE_LEGEND } from '../data/cocktailShapes.js';

/**
 * CocktailLab — Codex view. Each NODE is a cocktail, grouped into the
 * 6 super-cluster families (Old-Fashioned, Martini, Daiquiri, Sidecar,
 * Whisky Highball, Flip) plus a 7th Syrups cluster, each broken into
 * subclusters (Core, Balance, Seasoning, Variations, Extended Family).
 *
 * Click a cocktail → detail panel with three tabs (Ingredients,
 * Cocktails like this, Swap an ingredient) for experimentation.
 */
export default function CocktailLab({ fullData, onSelectionChange, onOpenRecipeLab }) {
  const [codexData, setCodexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCocktail, setSelectedCocktail] = useState(null);
  const [filterFamily, setFilterFamily] = useState(null);
  // Camera fly-to target for the family fly-wheel (R10-66). Set on
  // joystick onFlyTo; consumed by NetworkScene's flyToTarget effect.
  const [flyToTarget, setFlyToTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      try {
        const codex = await loadCocktailCodex();
        const positions = computeCodexPositions(codex.nodes, codex.codex.clusters);
        if (cancelled) return;
        setCodexData({
          graph: {
            nodes: codex.nodes,
            edges: codex.edges,
            ingredientList: codex.ingredientList,
          },
          positions,
          ingredientToCocktails: codex.ingredientToCocktails,
          codex: codex.codex,
        });
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    build();
    return () => { cancelled = true; };
  }, []);

  // Per-family centroid — used by both the 3D label sprites and the
  // fly-wheel onFlyTo handler. Pulled out of sceneExtras so the
  // joystick can resolve a target position without rebuilding labels.
  const familyCentroids = useMemo(() => {
    if (!codexData) return null;
    const centroids = new Map();
    for (const fam of codexData.codex.clusters) {
      const rootName = [...codexData.graph.nodes.values()].find(n => n.isRoot && n.family_id === fam.id)?.name;
      if (rootName) {
        centroids.set(fam.id, codexData.positions.positions[rootName]);
      } else {
        // Syrups have no root cocktail; use the first syrup's position
        const first = [...codexData.graph.nodes.values()].find(n => n.family_id === fam.id);
        if (first) centroids.set(fam.id, codexData.positions.positions[first.name]);
      }
    }
    return centroids;
  }, [codexData]);

  // Member count per family for the fly-to distance scale.
  const familyMemberCount = useMemo(() => {
    if (!codexData) return null;
    const counts = new Map();
    for (const n of codexData.graph.nodes.values()) {
      counts.set(n.family_id, (counts.get(n.family_id) || 0) + 1);
    }
    return counts;
  }, [codexData]);

  // R14 multi-shape: extract `shapeKey` per cocktail from the codex
  // nodes (set in cocktailCodex.js → cocktailShapeKey() based on the
  // subcluster category). Memoized so the NetworkScene's init effect
  // doesn't tear down + rebuild on every render.
  const shapeAssignments = useMemo(() => {
    if (!codexData?.graph?.nodes) return null;
    const m = new Map();
    for (const [name, node] of codexData.graph.nodes) {
      if (node.shapeKey) m.set(name, node.shapeKey);
    }
    return m.size > 0 ? m : null;
  }, [codexData]);

  // 3D cluster labels — one per family (and Syrups) at its centroid.
  const sceneExtras = useMemo(() => {
    if (!codexData || !familyCentroids) return null;
    const clusters = codexData.codex.clusters.map(c => ({
      id: c.id,
      label: c.name,
      color: c.color,
    }));
    return createClusterLabels(clusters, familyCentroids);
  }, [codexData, familyCentroids]);

  // Selection → parent
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedCocktail ? [selectedCocktail] : []);
  }, [selectedCocktail, onSelectionChange]);

  // Similar cocktails by Jaccard edge weight.
  const similarCocktails = useMemo(() => {
    if (!selectedCocktail || !codexData) return [];
    const sims = [];
    const familyById = new Map(codexData.codex.clusters.map(c => [c.id, c]));
    for (const e of codexData.graph.edges) {
      if (e.kind !== 'jaccard') continue;
      let other = null;
      if (e.source === selectedCocktail) other = e.target;
      else if (e.target === selectedCocktail) other = e.source;
      if (!other) continue;
      const node = codexData.graph.nodes.get(other);
      if (!node) continue;
      sims.push({
        name: other,
        similarity: e.strength,
        family_id: node.family_id,
        color: familyById.get(node.family_id)?.color || '#888',
      });
    }
    sims.sort((a, b) => b.similarity - a.similarity);
    return sims.slice(0, 8);
  }, [selectedCocktail, codexData]);

  const familyForSelected = useMemo(() => {
    if (!selectedCocktail || !codexData) return null;
    const node = codexData.graph.nodes.get(selectedCocktail);
    if (!node) return null;
    return codexData.codex.clusters.find(c => c.id === node.family_id) || null;
  }, [selectedCocktail, codexData]);

  const subclusterLabelForSelected = useMemo(() => {
    if (!selectedCocktail || !codexData) return null;
    return codexData.graph.nodes.get(selectedCocktail)?.subclusterLabel || null;
  }, [selectedCocktail, codexData]);

  // Family filter (highlight one super-cluster)
  const familyFilteredNames = useMemo(() => {
    if (filterFamily == null || !codexData) return null;
    const names = [];
    for (const [name, n] of codexData.graph.nodes) {
      if (n.family_id === filterFamily) names.push(name);
    }
    return names.length > 0 ? names : null;
  }, [filterFamily, codexData]);

  const handleNodeClick = useCallback((node) => {
    if (!node) return; // empty-space click no longer dismisses
    setSelectedCocktail(node.name);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-purple-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-purple-400/50 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[30%] bg-purple-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm">Building cocktail codex...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to load cocktail codex</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NetworkScene
        data={codexData}
        onNodeClick={handleNodeClick}
        onNodeHover={() => {}}
        selectedNode={selectedCocktail}
        selectedNodes={selectedCocktail ? [selectedCocktail] : []}
        showEdges={true}
        showParticles={true}
        filterCuisine=""
        filterTaste=""
        profileWeights={null}
        treeFilterIngredients={familyFilteredNames}
        sceneExtras={sceneExtras}
        showNodeLabels={true}
        labelNodeNames={familyFilteredNames}
        flyToTarget={flyToTarget}
        shapeAssignments={shapeAssignments}
      />

      {selectedCocktail && (
        <CocktailDetailPanel
          cocktail={codexData.graph.nodes.get(selectedCocktail)}
          family={familyForSelected}
          subclusterLabel={subclusterLabelForSelected}
          similarCocktails={similarCocktails}
          onSelectCocktail={(name) => setSelectedCocktail(name)}
          onOpenRecipeLab={onOpenRecipeLab}
          onClose={() => setSelectedCocktail(null)}
        />
      )}

      {/* Family fly-wheel — bottom-center pill strip. Tap a family to
          filter the codex to it AND fly the camera to its centroid
          (NetworkScene auto-flies on treeFilterIngredients change). */}
      <ClusterJoystick
        clusters={codexData.codex.clusters}
        mode="ml"
        focusedClusterId={filterFamily}
        onClusterFocus={(id) => setFilterFamily(id)}
        onFlyTo={(family) => {
          const pos = familyCentroids?.get(family.id);
          if (!pos) return;
          setFlyToTarget({
            position: pos,
            memberCount: familyMemberCount?.get(family.id) || 1,
            ts: Date.now(),
          });
        }}
      />

      {/* Shape legend — collapsible, top-right. Maps the 7 subcluster
          categories to their geometries so users can read the 3D scene. */}
      <ShapeLegend title="Subcluster shapes" legend={COCKTAIL_SHAPE_LEGEND} />
    </>
  );
}
