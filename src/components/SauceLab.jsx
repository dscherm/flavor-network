import { useState, useEffect, useMemo, useCallback } from 'react';
import NetworkScene from './NetworkScene.jsx';
import SearchBar from './SearchBar.jsx';
import IngredientPanel from './IngredientPanel.jsx';
import SaucePanel from './SaucePanel.jsx';
import { buildSauceGraph, buildAdjacencyMap } from '../data/sauceGraph.js';
import { computeSaucePositions } from '../data/saucePositioning.js';
import { getNeighbors } from '../data/graph.js';
import { SAUCE_CATEGORIES, loadSauceAugment } from '../data/sauceData.js';
import { SAUCE_TEMPLATES } from '../data/sauceScoring.js';
import { createSauceAxisLabels } from '../three/AxisLabels.js';

/**
 * SauceLab — Main container for the Sauce Lab tab.
 * Renders its own NetworkScene with sauce-only data and mother sauce positioning.
 */
export default function SauceLab({ fullData, userProfile, onSelectionChange, onOpenRecipeLab }) {
  const [sauceData, setSauceData] = useState(null);
  const [curatedSauces, setCuratedSauces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [highlightedIngredients, setHighlightedIngredients] = useState(null);
  const [builderIngredients, setBuilderIngredients] = useState([]);
  const [templateFilter, setTemplateFilter] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [legendOpen, setLegendOpen] = useState(false);

  // Build sauce graph and load curated recipes on mount
  useEffect(() => {
    if (!fullData) return;
    let cancelled = false;

    async function build() {
      try {
        const [graph, augment] = await Promise.all([
          buildSauceGraph(fullData.graph),
          loadSauceAugment(),
        ]);

        // GNN-first layout with role-based fallback for nodes not in proDataset.
        const gnnMap = fullData?.positions?.positions || {};
        const posMap = {};
        const missing = [];
        for (const [name] of graph.nodes) {
          if (gnnMap[name]) posMap[name] = gnnMap[name];
          else missing.push(name);
        }
        if (missing.length) {
          const fallback = computeSaucePositions(graph.nodes, graph.edges).positions;
          for (const n of missing) posMap[n] = fallback[n];
        }
        const positions = { positions: posMap };

        if (cancelled) return;

        const adjacencyMap = buildAdjacencyMap(graph.edges);

        setSauceData({ graph, positions, embeddings: null, adjacencyMap });
        setCuratedSauces(augment.sauces || []);
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

  // Mother-sauce axes don't map to the GNN layout; nodes now cluster by
  // chemistry. Hide the sprites.
  const axisLabels = null;

  const ingredientList = useMemo(() => {
    if (!sauceData) return [];
    return sauceData.graph.ingredientList;
  }, [sauceData]);

  const neighbors = useMemo(() => {
    if (!sauceData || !selectedNode) return [];
    return getNeighbors(selectedNode, sauceData.graph.edges);
  }, [sauceData, selectedNode]);

  const selectedNodeData = useMemo(() => {
    if (!sauceData || !selectedNode) return null;
    return sauceData.graph.nodes.get(selectedNode) || null;
  }, [sauceData, selectedNode]);

  // Category filter
  const categoryFilteredNames = useMemo(() => {
    if (!filterCategory || !sauceData) return null;
    const names = [];
    for (const [name, node] of sauceData.graph.nodes) {
      if (node.sauceCategory === filterCategory) {
        names.push(name);
      }
    }
    return names.length > 0 ? names : null;
  }, [filterCategory, sauceData]);

  const handleCategoryFilter = useCallback((key) => {
    setFilterCategory(prev => prev === key ? '' : key);
  }, []);

  const handleNodeClick = useCallback((node) => {
    if (!node) {
      setSelectedNodes([]);
      return;
    }
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

  const handleTemplateFilter = useCallback((template) => {
    if (!sauceData) return;
    if (templateFilter === template.name) {
      setTemplateFilter(null);
      setSelectedNodes([]);
      return;
    }
    setTemplateFilter(template.name);
    const roles = new Set(Object.keys(template.roles));
    const matching = [];
    for (const [name, node] of sauceData.graph.nodes) {
      if (roles.has(node.sauceCategory)) {
        matching.push(name);
      }
    }
    setSelectedNodes(matching);
  }, [sauceData, templateFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-amber-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-amber-400/50 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[30%] bg-amber-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm">Building sauce network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to build sauce network</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NetworkScene
        data={sauceData}
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

      {/* Ingredient detail panel — only when panel is closed and single node selected */}
      {selectedNode && selectedNodes.length < 2 && !panelOpen && (
        <IngredientPanel
          node={selectedNodeData}
          neighbors={neighbors}
          onClose={handlePanelClose}
          onSelectIngredient={handleSearchSelect}
          isFavorite={false}
          onToggleFavorite={() => {}}
          graphNodes={sauceData?.graph?.nodes}
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

      {/* Axis legend */}
      <div className="fixed bottom-16 left-4 z-30 pointer-events-none select-none bg-[#12121a]/80 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-3 py-2">
        <p className="text-[9px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">Sauce Axes</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-yellow-400/70 inline-block flex-shrink-0" />
            X: Light ↔ Rich
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-green-400/70 inline-block flex-shrink-0" />
            Y: Mild ↔ Bold
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <span className="w-2 h-2 rounded-full bg-purple-400/70 inline-block flex-shrink-0" />
            Z: Simple ↔ Complex
          </div>
        </div>
      </div>

      {/* Sauce Panel toggle */}
      <button
        onClick={() => setPanelOpen(p => !p)}
        className={`fixed top-14 right-4 z-50 px-3 py-1.5 text-xs rounded-lg backdrop-blur-md border transition-all select-none ${
          panelOpen
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : 'bg-[#12121a]/90 text-gray-400 hover:text-amber-300 border-[#1e1e2e] hover:border-amber-500/20'
        }`}
      >
        <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        Sauces
      </button>

      {/* Sauce Panel */}
      <SaucePanel
        onOpenRecipeLab={onOpenRecipeLab}
        bridgeCompounds={fullData?.bridgeCompounds}
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        sauceNodes={sauceData?.graph?.nodes}
        sauceEdges={sauceData?.graph?.edges}
        ingredientList={ingredientList}
        onHighlightIngredients={handleHighlightIngredients}
        builderIngredients={builderIngredients}
        onBuilderAdd={handleBuilderAdd}
        onBuilderRemove={handleBuilderRemove}
        onBuilderClear={handleBuilderClear}
        userProfile={userProfile}
        curatedSauces={curatedSauces}
        adjacencyMap={sauceData?.adjacencyMap}
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
            legendOpen ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'
          }`}
          title="Legend"
        >
          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ writingMode: 'vertical-rl' }}>
            Legend
          </span>
        </button>

        {/* Panel */}
        <div className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg p-3 border-l-0 max-h-[70vh] overflow-y-auto">
          {/* Mother Sauces */}
          <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Mother Sauces</p>
          <div className="space-y-0.5 mb-3">
            {SAUCE_TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => handleTemplateFilter(t)}
                className={`w-full flex items-center gap-1.5 text-[9px] text-left px-1 py-0.5 rounded transition-colors ${
                  templateFilter === t.name
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a2e]'
                }`}
                title={t.description}
              >
                <span className="w-1 h-1 rounded-full bg-amber-400/60 flex-shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>

          {/* Ingredient Types */}
          <div className="border-t border-[#1e1e2e] pt-2">
            <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Ingredient Types</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {Object.entries(SAUCE_CATEGORIES)
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
