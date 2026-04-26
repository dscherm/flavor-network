import { useState, useEffect, useMemo, useCallback } from 'react';
import NetworkScene from './NetworkScene.jsx';
import SauceDetailPanel from './SauceDetailPanel.jsx';
import {
  loadSauceCodex,
  computeSauceCodexPositions,
} from '../data/sauceCodex.js';
import { createClusterLabels } from '../three/AxisLabels.js';
import ClusterJoystick from './ClusterJoystick.jsx';

/**
 * SauceLab — Codex view (post-redesign). Each NODE is a sauce,
 * grouped into the 10 mother-sauce families:
 *   Béchamel, Velouté, Espagnole, Hollandaise, Tomato (French),
 *   Curry, Stir-fry, Mole, Salsa, Nut Sauce (global).
 *
 * Click a sauce → detail panel with two tabs (Ingredients with
 * technique, Similar sauces by Jaccard) plus an "Open in Recipe Lab"
 * button that hands the ingredients off in Sauce mode.
 *
 * Mirror of CocktailLab.jsx — replaces the previous ingredient-graph
 * + Sauce Builder + Browse/Saved/Lookup panel that lived here.
 */
export default function SauceLab({ onSelectionChange, onOpenRecipeLab }) {
  const [codexData, setCodexData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [filterFamily, setFilterFamily] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      try {
        const codex = await loadSauceCodex();
        const positions = computeSauceCodexPositions(codex.nodes, codex.codex.clusters);
        if (cancelled) return;
        setCodexData({
          graph: {
            nodes: codex.nodes,
            edges: codex.edges,
            ingredientList: codex.ingredientList,
          },
          positions,
          ingredientToSauces: codex.ingredientToSauces,
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

  // 3D cluster labels — one per family at its centroid (root sauce
  // for families that have an eponymous root; first sauce otherwise).
  const sceneExtras = useMemo(() => {
    if (!codexData) return null;
    const centroids = new Map();
    for (const fam of codexData.codex.clusters) {
      const rootName = [...codexData.graph.nodes.values()]
        .find(n => n.isRoot && n.family_id === fam.id)?.name;
      if (rootName) {
        centroids.set(fam.id, codexData.positions.positions[rootName]);
      } else {
        const first = [...codexData.graph.nodes.values()].find(n => n.family_id === fam.id);
        if (first) centroids.set(fam.id, codexData.positions.positions[first.name]);
      }
    }
    const clusters = codexData.codex.clusters.map(c => ({
      id: c.id,
      label: c.name,
      color: c.color,
    }));
    return createClusterLabels(clusters, centroids);
  }, [codexData]);

  // Selection → parent (kept for parity with CocktailLab; App.jsx no
  // longer uses this for the Recipe Lab handoff, but ingredient
  // panels and other consumers still read selectedNodes).
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedSauce ? [selectedSauce] : []);
  }, [selectedSauce, onSelectionChange]);

  // Similar sauces by Jaccard edge weight (within the same family).
  const similarSauces = useMemo(() => {
    if (!selectedSauce || !codexData) return [];
    const sims = [];
    const familyById = new Map(codexData.codex.clusters.map(c => [c.id, c]));
    for (const e of codexData.graph.edges) {
      if (e.kind !== 'jaccard') continue;
      let other = null;
      if (e.source === selectedSauce) other = e.target;
      else if (e.target === selectedSauce) other = e.source;
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
  }, [selectedSauce, codexData]);

  const familyForSelected = useMemo(() => {
    if (!selectedSauce || !codexData) return null;
    const node = codexData.graph.nodes.get(selectedSauce);
    if (!node) return null;
    return codexData.codex.clusters.find(c => c.id === node.family_id) || null;
  }, [selectedSauce, codexData]);

  // Family filter — when active, NetworkScene highlights only that
  // family's sauces (uses the existing treeFilterIngredients hook).
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
    setSelectedSauce(node.name);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-amber-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-amber-400/50 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[30%] bg-amber-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm">Building sauce codex...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to load sauce codex</p>
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
        selectedNode={selectedSauce}
        selectedNodes={selectedSauce ? [selectedSauce] : []}
        showEdges={true}
        showParticles={true}
        filterCuisine=""
        filterTaste=""
        profileWeights={null}
        treeFilterIngredients={familyFilteredNames}
        sceneExtras={sceneExtras}
        showNodeLabels={true}
        labelNodeNames={familyFilteredNames}
      />

      {selectedSauce && (
        <SauceDetailPanel
          sauce={codexData.graph.nodes.get(selectedSauce)}
          family={familyForSelected}
          similarSauces={similarSauces}
          onSelectSauce={(name) => setSelectedSauce(name)}
          onOpenRecipeLab={onOpenRecipeLab}
          onClose={() => setSelectedSauce(null)}
        />
      )}

      {/* Mother-sauce fly-wheel — bottom-center pill strip. Tap a
          family to filter the codex AND fly the camera to its
          centroid (NetworkScene auto-flies on treeFilterIngredients). */}
      <ClusterJoystick
        clusters={codexData.codex.clusters}
        mode="ml"
        focusedClusterId={filterFamily}
        onClusterFocus={(id) => setFilterFamily(id)}
        onFlyTo={() => {}}
      />
    </>
  );
}
