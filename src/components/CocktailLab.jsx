import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NetworkScene from './NetworkScene.jsx';
import SearchBar from './SearchBar.jsx';
import IngredientPanel from './IngredientPanel.jsx';
import CocktailPanel from './CocktailPanel.jsx';
import { buildCocktailGraph, buildAdjacencyMap } from '../data/cocktailGraph.js';
import { computeCocktailPositions } from '../data/cocktailPositioning.js';
import { getNeighbors } from '../data/graph.js';
import { COCKTAIL_CATEGORIES } from '../data/cocktailData.js';
import { CODEX_TEMPLATES } from '../data/cocktailScoring.js';
import { createClusterLabels } from '../three/AxisLabels.js';
import {
  computeClusterCentroids,
  applyClusterBlend,
  spreadCentroidsOnCircle,
} from '../data/labClusterBlend.js';

/**
 * CocktailLab — Main container for the Cocktail Lab tab.
 * Renders its own NetworkScene with cocktail-only data and Codex positioning.
 */
export default function CocktailLab({ fullData, userProfile, onSelectionChange, onOpenRecipeLab }) {
  const [cocktailData, setCocktailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [highlightedIngredients, setHighlightedIngredients] = useState(null);
  const [builderIngredients, setBuilderIngredients] = useState([]);
  const [templateFilter, setTemplateFilter] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [legendOpen, setLegendOpen] = useState(false);

  // Build cocktail graph on mount
  useEffect(() => {
    if (!fullData) return;
    let cancelled = false;

    async function build() {
      try {
        const [graph, clusterRes] = await Promise.all([
          buildCocktailGraph(fullData.graph),
          fetch('/data/cocktail_clusters.json').catch(() => null),
        ]);

        // Use GNN positions from the full proDataset when available so the
        // Cocktail Lab starts from the same chemistry-learned embedding the
        // Network view uses. Nodes without GNN coverage fall back to the
        // role-based Codex layout so nothing is left unpositioned.
        const gnnMap = fullData?.positions?.positions || {};
        const posMap = {};
        const missing = [];
        for (const [name] of graph.nodes) {
          if (gnnMap[name]) posMap[name] = [...gnnMap[name]]; // copy so we don't mutate fullData
          else missing.push(name);
        }
        if (missing.length) {
          const fallback = computeCocktailPositions(graph.nodes, graph.edges).positions;
          for (const n of missing) posMap[n] = fallback[n];
        }

        // Cocktail-codex clustering: derive each ingredient's family from
        // 426 cached CocktailDB recipes (build-time step 09) and pull
        // members toward their family's centroid so the codex archetypes
        // form visible clouds. Centroids are first re-spread on a circle
        // so the 6 families don't pile up in chemistry-space corners.
        let clusterMeta = null;
        if (clusterRes && clusterRes.ok) {
          const clData = await clusterRes.json();
          const ingredientClusters = clData.ingredient_clusters || {};
          const rawCentroids = computeClusterCentroids(posMap, ingredientClusters);
          const spread = spreadCentroidsOnCircle(rawCentroids, clData.clusters || [], 38);
          applyClusterBlend(posMap, ingredientClusters, spread, 0.7);
          clusterMeta = { clusters: clData.clusters || [], centroids: spread };
          for (const [name, node] of graph.nodes) {
            const cl = ingredientClusters[name];
            if (cl) {
              node.clusterId = cl.cluster_id;
              node.clusterLabel = cl.cluster_label;
            }
          }
        }

        const positions = { positions: posMap };

        if (cancelled) return;

        const adjacencyMap = buildAdjacencyMap(graph.edges);

        setCocktailData({
          graph,
          positions,
          embeddings: null,
          adjacencyMap,
          clusterMeta,
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
  }, [fullData]);

  const selectedNode = selectedNodes.length > 0 ? selectedNodes[0] : null;

  // Propagate selection to parent so Recipe Lab can pick it up
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedNodes);
  }, [selectedNodes, onSelectionChange]);

  // Cocktail-codex cluster label sprites — one per family at its
  // centroid. Each cocktail family (Old-Fashioned / Martini / Daiquiri
  // / Sidecar / Highball / Flip) reads as a region label in the scene.
  const axisLabels = useMemo(() => {
    if (!cocktailData?.clusterMeta) return null;
    const { clusters, centroids } = cocktailData.clusterMeta;
    return createClusterLabels(clusters, centroids);
  }, [cocktailData]);

  const ingredientList = useMemo(() => {
    if (!cocktailData) return [];
    return cocktailData.graph.ingredientList;
  }, [cocktailData]);

  const neighbors = useMemo(() => {
    if (!cocktailData || !selectedNode) return [];
    return getNeighbors(selectedNode, cocktailData.graph.edges);
  }, [cocktailData, selectedNode]);

  const selectedNodeData = useMemo(() => {
    if (!cocktailData || !selectedNode) return null;
    return cocktailData.graph.nodes.get(selectedNode) || null;
  }, [cocktailData, selectedNode]);

  const handleNodeClick = useCallback((node) => {
    if (!node) {
      setSelectedNodes([]);
      return;
    }
    // If panel is open, also add/remove from builder
    if (panelOpen) {
      setBuilderIngredients(prev => {
        if (prev.includes(node.name)) {
          return prev.filter(n => n !== node.name);
        }
        return [...prev, node.name];
      });
    }
    setSelectedNodes((prev) => {
      if (prev.includes(node.name)) {
        return prev.filter((n) => n !== node.name);
      }
      return [...prev, node.name];
    });
  }, [panelOpen]);

  const handleSearchSelect = useCallback((name) => {
    setSelectedNodes((prev) => {
      if (prev.includes(name)) return prev;
      return [...prev, name];
    });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedNodes([]);
  }, []);

  const handleHighlightIngredients = useCallback((names) => {
    setHighlightedIngredients(names);
    if (names && names.length > 0) {
      setSelectedNodes(names);
    } else {
      setSelectedNodes([]);
    }
  }, []);

  const handleSelectAlternative = useCallback((originalName, altName, cocktail) => {
    if (cocktail) {
      const others = cocktail.ingredients.map(i => i.name).filter(n => n !== originalName);
      setSelectedNodes([altName, ...others]);
    }
  }, []);

  const handleBuilderAdd = useCallback((name) => {
    setBuilderIngredients(prev => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      setSelectedNodes(next);
      return next;
    });
  }, []);

  const handleBuilderRemove = useCallback((name) => {
    setBuilderIngredients(prev => {
      const next = prev.filter(n => n !== name);
      setSelectedNodes(next);
      return next;
    });
  }, []);

  const handleBuilderClear = useCallback(() => {
    setBuilderIngredients([]);
    setSelectedNodes([]);
  }, []);

  // Compute ingredient names matching the selected category filter
  const categoryFilteredNames = useMemo(() => {
    if (!filterCategory || !cocktailData) return null;
    const names = [];
    for (const [name, node] of cocktailData.graph.nodes) {
      if (node.cocktailCategory === filterCategory) {
        names.push(name);
      }
    }
    return names.length > 0 ? names : null;
  }, [filterCategory, cocktailData]);

  const handleCategoryFilter = useCallback((key) => {
    setFilterCategory(prev => prev === key ? '' : key);
  }, []);

  const handleTemplateFilter = useCallback((template) => {
    if (!cocktailData) return;
    if (templateFilter === template.name) {
      // Toggle off
      setTemplateFilter(null);
      setSelectedNodes([]);
      return;
    }
    setTemplateFilter(template.name);
    // Highlight all ingredients matching the template's required roles
    const roles = new Set(Object.keys(template.roles));
    const matching = [];
    for (const [name, node] of cocktailData.graph.nodes) {
      if (roles.has(node.cocktailCategory)) {
        matching.push(name);
      }
    }
    setSelectedNodes(matching);
  }, [cocktailData, templateFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-purple-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-purple-400/50 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[30%] bg-purple-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm">Building cocktail network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to build cocktail network</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NetworkScene
        data={cocktailData}
        onNodeClick={handleNodeClick}
        onNodeHover={() => {}}
        selectedNode={selectedNode}
        selectedNodes={selectedNodes}
        showEdges={true}
        showParticles={true}
        filterCuisine=""
        filterTaste=""
        profileWeights={null}
        treeFilterIngredients={categoryFilteredNames}
        sceneExtras={axisLabels}
        showNodeLabels={true}
        labelNodeNames={categoryFilteredNames}
      />

      <SearchBar
        ingredients={ingredientList}
        onSelect={handleSearchSelect}
      />

      {/* Ingredient detail panel */}
      {selectedNode && selectedNodes.length < 2 && (
        <IngredientPanel
          node={selectedNodeData}
          neighbors={neighbors}
          onClose={handlePanelClose}
          onSelectIngredient={handleSearchSelect}
          isFavorite={false}
          onToggleFavorite={() => {}}
          graphNodes={cocktailData?.graph?.nodes}
        />
      )}

      {/* Clear selection */}
      {selectedNodes.length > 0 && (
        <div className="fixed top-[100px] left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setSelectedNodes([])}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear ({selectedNodes.length})
          </button>
        </div>
      )}

      {/* 3D axis labels are now sprites in the scene (see sceneExtras prop) */}

      {/* Axis legend (compact) */}
      <div className="fixed bottom-16 left-4 z-30 pointer-events-none select-none bg-[#12121a]/80 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-3 py-2">
        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">Codex Axes</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-red-400/70 inline-block flex-shrink-0" />
            X: Spirit-forward ↔ Modified
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-green-400/70 inline-block flex-shrink-0" />
            Y: Short ↔ Long
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-blue-400/70 inline-block flex-shrink-0" />
            Z: Simple ↔ Complex
          </div>
        </div>
      </div>

      {/* Cocktail Panel toggle */}
      <button
        onClick={() => setPanelOpen(p => !p)}
        className={`fixed top-14 right-4 z-50 px-3 py-1.5 text-xs rounded-lg backdrop-blur-md border transition-all select-none ${
          panelOpen
            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
            : 'bg-[#12121a]/90 text-gray-400 hover:text-purple-300 border-[#1e1e2e] hover:border-purple-500/20'
        }`}
      >
        <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
        Cocktails
      </button>

      {/* Cocktail Panel */}
      <CocktailPanel
        onOpenRecipeLab={onOpenRecipeLab}
        bridgeCompounds={fullData?.bridgeCompounds}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        cocktailNodes={cocktailData?.graph?.nodes}
        cocktailEdges={cocktailData?.graph?.edges}
        adjacencyMap={cocktailData?.adjacencyMap}
        ingredientList={ingredientList}
        onHighlightIngredients={handleHighlightIngredients}
        onSelectAlternative={handleSelectAlternative}
        builderIngredients={builderIngredients}
        onBuilderAdd={handleBuilderAdd}
        onBuilderRemove={handleBuilderRemove}
        onBuilderClear={handleBuilderClear}
        userProfile={userProfile}
      />

      {/* Combined right-side legend — slide-out panel */}
      <div
        className="fixed bottom-4 right-0 z-30 flex items-end select-none transition-transform duration-300 ease-in-out"
        style={{ transform: legendOpen ? 'translateX(0)' : 'translateX(calc(100% - 28px))' }}
      >
        {/* Tab */}
        <button
          onClick={() => setLegendOpen(v => !v)}
          className={`bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] border-r-0 rounded-l-lg px-1.5 py-3 transition-colors shrink-0 ${
            legendOpen ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Legend"
        >
          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ writingMode: 'vertical-rl' }}>
            Legend
          </span>
        </button>

        {/* Panel */}
        <div className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg p-3 border-l-0 max-h-[70vh] overflow-y-auto">
          {/* Cocktail Codex */}
          <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Cocktail Codex</p>
          <div className="space-y-0.5 mb-3">
            {CODEX_TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => handleTemplateFilter(t)}
                className={`w-full flex items-center gap-1.5 text-[9px] text-left px-1 py-0.5 rounded transition-colors ${
                  templateFilter === t.name
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a2e]'
                }`}
                title={t.description}
              >
                <span className="w-1 h-1 rounded-full bg-purple-400/60 flex-shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>

          {/* Ingredient Types */}
          <div className="border-t border-[#1e1e2e] pt-2">
            <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Ingredient Types</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {Object.entries(COCKTAIL_CATEGORIES)
                .filter(([key]) => key !== 'Other')
                .map(([key, { label, color }]) => {
                  const isActive = filterCategory === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleCategoryFilter(key)}
                      className={`flex items-center gap-1 text-[9px] text-left rounded px-1 py-0.5 transition-colors ${
                        isActive
                          ? 'text-white bg-white/10 ring-1 ring-white/20'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      }`}
                      title={isActive ? `Clear ${label} filter` : `Show only ${label}`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-shadow"
                        style={{
                          backgroundColor: color,
                          boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                        }}
                      />
                      {label}
                    </button>
                  );
                })}
            </div>
            {filterCategory && (
              <button
                onClick={() => setFilterCategory('')}
                className="mt-1 text-[8px] text-gray-600 hover:text-blue-400 transition-colors"
              >
                Show all
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
