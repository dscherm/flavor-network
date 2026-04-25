import { useState, useEffect, useMemo, useCallback } from 'react';
import NetworkScene from './NetworkScene.jsx';
import SearchBar from './SearchBar.jsx';
import CocktailDetailPanel from './CocktailDetailPanel.jsx';
import {
  loadCocktailCodex,
  computeCodexPositions,
} from '../data/cocktailCodex.js';
import { createClusterLabels } from '../three/AxisLabels.js';

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

  // 3D cluster labels — one per family (and Syrups) at its centroid.
  const sceneExtras = useMemo(() => {
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
    const clusters = codexData.codex.clusters.map(c => ({
      id: c.id,
      label: c.name,
      color: c.color,
    }));
    return createClusterLabels(clusters, centroids);
  }, [codexData]);

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

  const handleSearchSelect = useCallback((name) => {
    setSelectedCocktail(name);
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

  const ingredientList = codexData?.graph?.ingredientList || [];

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
      />

      <SearchBar
        ingredients={ingredientList}
        onSelect={handleSearchSelect}
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

      {/* Family filter chips — replaces the old codex-template legend */}
      <div className="fixed bottom-4 left-4 z-30 select-none bg-[#12121a]/85 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-2">
        <p className="text-[8px] text-gray-500 uppercase tracking-wider mb-1.5">Codex Families</p>
        <div className="flex flex-wrap gap-1 max-w-[300px]">
          {codexData.codex.clusters.map(c => {
            const active = filterFamily === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilterFamily(active ? null : c.id)}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  active ? 'bg-white/15 text-white ring-1 ring-white/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </button>
            );
          })}
          {filterFamily != null && (
            <button
              onClick={() => setFilterFamily(null)}
              className="text-[9px] text-gray-500 hover:text-blue-400 transition-colors px-1"
            >
              clear
            </button>
          )}
        </div>
      </div>
    </>
  );
}
