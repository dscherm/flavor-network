import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NetworkScene from './NetworkScene.jsx';
import SearchBar from './SearchBar.jsx';
import IngredientPanel from './IngredientPanel.jsx';
import CocktailPanel from './CocktailPanel.jsx';
import { buildCocktailGraph } from '../data/cocktailGraph.js';
import { computeCocktailPositions } from '../data/cocktailPositioning.js';
import { getNeighbors } from '../data/graph.js';
import { COCKTAIL_CATEGORIES } from '../data/cocktailData.js';

/**
 * CocktailLab — Main container for the Cocktail Lab tab.
 * Renders its own NetworkScene with cocktail-only data and Codex positioning.
 */
export default function CocktailLab({ fullData }) {
  const [cocktailData, setCocktailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [highlightedIngredients, setHighlightedIngredients] = useState(null);

  // Build cocktail graph on mount
  useEffect(() => {
    if (!fullData) return;
    let cancelled = false;

    async function build() {
      try {
        const graph = await buildCocktailGraph(fullData.graph);
        const positions = computeCocktailPositions(graph.nodes, graph.edges);

        if (cancelled) return;

        setCocktailData({
          graph,
          positions,
          embeddings: null,
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
    setSelectedNodes((prev) => {
      if (prev.includes(node.name)) {
        return prev.filter((n) => n !== node.name);
      }
      return [...prev, node.name];
    });
  }, []);

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
    // Highlight the alternative and the remaining cocktail ingredients
    if (cocktail) {
      const others = cocktail.ingredients.map(i => i.name).filter(n => n !== originalName);
      setSelectedNodes([altName, ...others]);
    }
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
        treeFilterIngredients={null}
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

      {/* Axis labels */}
      <div className="fixed bottom-16 left-4 z-30 pointer-events-none select-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[9px] text-gray-600">
            <span className="w-2 h-px bg-red-400/40 inline-block" />
            <span>X: Spirit-forward ← → Modified</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-gray-600">
            <span className="w-2 h-px bg-green-400/40 inline-block" />
            <span>Y: Short ← → Long</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-gray-600">
            <span className="w-2 h-px bg-blue-400/40 inline-block" />
            <span>Z: Simple ← → Complex</span>
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
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        cocktailNodes={cocktailData?.graph?.nodes}
        cocktailEdges={cocktailData?.graph?.edges}
        onHighlightIngredients={handleHighlightIngredients}
        onSelectAlternative={handleSelectAlternative}
      />

      {/* Category legend */}
      <div className="fixed bottom-4 right-4 z-30 bg-[#12121a]/80 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-2">
        <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Ingredient Types</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {Object.entries(COCKTAIL_CATEGORIES)
            .filter(([key]) => key !== 'Other')
            .map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-1 text-[9px] text-gray-500">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                {label}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
