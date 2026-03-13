import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NetworkScene from './NetworkScene.jsx';
import SearchBar from './SearchBar.jsx';
import IngredientPanel from './IngredientPanel.jsx';
import CocktailPanel from './CocktailPanel.jsx';
import { buildCocktailGraph } from '../data/cocktailGraph.js';
import { computeCocktailPositions } from '../data/cocktailPositioning.js';
import { getNeighbors } from '../data/graph.js';
import { COCKTAIL_CATEGORIES } from '../data/cocktailData.js';
import { CODEX_TEMPLATES } from '../data/cocktailScoring.js';

/**
 * CocktailLab — Main container for the Cocktail Lab tab.
 * Renders its own NetworkScene with cocktail-only data and Codex positioning.
 */
export default function CocktailLab({ fullData, userProfile }) {
  const [cocktailData, setCocktailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [highlightedIngredients, setHighlightedIngredients] = useState(null);
  const [builderIngredients, setBuilderIngredients] = useState([]);
  const [templateFilter, setTemplateFilter] = useState(null);

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

      {/* Axis labels — floating at viewport edges */}
      <div className="fixed inset-0 z-30 pointer-events-none select-none" style={{ top: '3.5rem' }}>
        {/* X axis: left = Spirit-forward, right = Modified */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <span className="text-xs text-red-400/80 font-medium tracking-wider writing-vertical"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
            Spirit-forward
          </span>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <span className="text-xs text-red-400/80 font-medium tracking-wider"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            Modified
          </span>
        </div>
        {/* Y axis: bottom = Short, top = Long */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <span className="text-xs text-green-400/80 font-medium tracking-wider">Short</span>
        </div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <span className="text-xs text-green-400/80 font-medium tracking-wider">Long</span>
        </div>
        {/* Z axis hint in corner */}
        <div className="absolute bottom-4 left-4">
          <div className="flex items-center gap-1 text-[10px] text-blue-400/70">
            <span className="w-2 h-px bg-blue-400/60 inline-block" />
            Depth: Simple ↔ Complex
          </div>
        </div>
      </div>

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
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        cocktailNodes={cocktailData?.graph?.nodes}
        cocktailEdges={cocktailData?.graph?.edges}
        ingredientList={ingredientList}
        onHighlightIngredients={handleHighlightIngredients}
        onSelectAlternative={handleSelectAlternative}
        builderIngredients={builderIngredients}
        onBuilderAdd={handleBuilderAdd}
        onBuilderRemove={handleBuilderRemove}
        onBuilderClear={handleBuilderClear}
        userProfile={userProfile}
      />

      {/* Codex template legend */}
      <div className="fixed bottom-32 right-4 z-30 bg-[#12121a]/80 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-2">
        <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-1">Cocktail Codex</p>
        <div className="space-y-0.5">
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
              <span className="text-[7px] text-gray-700 ml-auto flex-shrink-0">{t.description.split(' + ').length}pt</span>
            </button>
          ))}
        </div>
      </div>

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
