import { useState, useCallback, useMemo, useEffect } from 'react';
import useProData from '../hooks/useProData.js';
import NetworkScene from './NetworkScene.jsx';
import SearchBar from './SearchBar.jsx';
import IngredientPanel from './IngredientPanel.jsx';
import Legend from './Legend.jsx';
import Controls from './Controls.jsx';
import ComparePanel from './ComparePanel.jsx';
import FlavorTreeExplorer from './FlavorTreeExplorer.jsx';
import GlobalInsights from './GlobalInsights.jsx';
import { getNeighbors } from '../data/graph.js';
import { getAllCuisines, getAllTastes } from '../data/metadata.js';
import { createTasteAxisLabels } from '../three/AxisLabels.js';

/**
 * ProDataNetwork — Self-contained network visualization using the
 * proprietary dataset (proDataset) instead of the Flavor Bible.
 * Mirrors all features of the main Network tab for comparison.
 */
export default function ProDataNetwork() {
  const { loading, error, data } = useProData();
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [showEdges, setShowEdges] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [selectedTaste, setSelectedTaste] = useState('');
  const [treeFilterIngredients, setTreeFilterIngredients] = useState(null);
  const [showTreeExplorer, setShowTreeExplorer] = useState(false);
  const [showGlobalInsights, setShowGlobalInsights] = useState(false);

  const selectedNode = selectedNodes.length > 0 ? selectedNodes[0] : null;
  const isComparing = selectedNodes.length >= 2;

  const ingredientList = useMemo(() => {
    if (!data) return [];
    return data.graph.ingredientList;
  }, [data]);

  const cuisines = useMemo(() => {
    if (!data) return [];
    return getAllCuisines(data.graph.nodes);
  }, [data]);

  const tastes = useMemo(() => {
    if (!data) return [];
    return getAllTastes(data.graph.nodes);
  }, [data]);

  const neighbors = useMemo(() => {
    if (!data || !selectedNode) return [];
    return getNeighbors(selectedNode, data.graph.edges);
  }, [data, selectedNode]);

  const selectedNodeData = useMemo(() => {
    if (!data || !selectedNode) return null;
    return data.graph.nodes.get(selectedNode) || null;
  }, [data, selectedNode]);

  const tasteAxisLabels = useMemo(() => createTasteAxisLabels(50), []);

  const handleNodeClick = useCallback((node) => {
    if (!node) {
      setSelectedNodes([]);
      return;
    }
    const name = node.name;
    setSelectedNodes((prev) => {
      if (prev.includes(name)) {
        return prev.filter((n) => n !== name);
      }
      return [...prev, name];
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

  const handleRemoveFromCompare = useCallback((name) => {
    setSelectedNodes((prev) => prev.filter((n) => n !== name));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNodes([]);
  }, []);

  // Share URL
  const shareUrl = useMemo(() => {
    if (selectedNodes.length === 0) return '';
    const params = new URLSearchParams();
    params.set('ingredients', selectedNodes.join(','));
    params.set('tab', 'prodata');
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [selectedNodes]);

  const [copied, setCopied] = useState(false);
  const handleCopyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setSelectedNodes([]);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-emerald-400/50 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
            <div className="absolute inset-[38%] bg-emerald-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-neural-text text-lg font-light tracking-wider mb-1" style={{ textShadow: '0 0 10px rgba(16,185,129,0.5)' }}>
            ProData Network
          </p>
          <p className="text-neural-muted text-sm">Loading proprietary dataset...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to load ProData</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Dataset badge */}
      <div className="fixed top-14 left-4 z-50 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
        <p className="text-[10px] text-emerald-400 font-medium">
          ProData: {data.graph.nodes.size.toLocaleString()} ingredients &middot; {data.graph.edges.length.toLocaleString()} pairings
        </p>
        <p className="text-[8px] text-gray-600">Source: RecipeNLG (2.2M) + MealDB + CocktailDB</p>
      </div>

      <NetworkScene
        data={data}
        onNodeClick={handleNodeClick}
        onNodeHover={() => {}}
        selectedNode={selectedNode}
        selectedNodes={selectedNodes}
        showEdges={showEdges}
        showParticles={showParticles}
        filterCuisine={selectedCuisine}
        filterTaste={selectedTaste}
        profileWeights={null}
        treeFilterIngredients={treeFilterIngredients}
        sceneExtras={tasteAxisLabels}
      />

      <SearchBar
        ingredients={ingredientList}
        onSelect={handleSearchSelect}
      />

      {/* Single selection: ingredient detail panel */}
      {!isComparing && (
        <IngredientPanel
          node={selectedNodeData}
          neighbors={neighbors}
          onClose={handlePanelClose}
          onSelectIngredient={handleSearchSelect}
          isFavorite={false}
          onToggleFavorite={() => {}}
        />
      )}

      {/* Multi-selection: comparison panel */}
      {isComparing && (
        <ComparePanel
          selectedNames={selectedNodes}
          nodes={data.graph.nodes}
          edges={data.graph.edges}
          onRemove={handleRemoveFromCompare}
          onClose={handleClearSelection}
        />
      )}

      {/* Clear + Share buttons */}
      {selectedNodes.length > 0 && (
        <div className="fixed top-[100px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          <button
            onClick={handleClearSelection}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Selection
            <span className="text-gray-600">({selectedNodes.length})</span>
          </button>
          <button
            onClick={handleCopyShareLink}
            className={`px-3 py-1.5 text-xs bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5 ${
              copied ? 'text-green-400 border-green-400/30' : 'text-gray-400 hover:text-emerald-400'
            }`}
          >
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      )}

      <Legend
        selectedTaste={selectedTaste}
        onTasteFilter={setSelectedTaste}
      />

      <Controls
        showEdges={showEdges}
        showParticles={showParticles}
        onToggleEdges={() => setShowEdges(v => !v)}
        onToggleParticles={() => setShowParticles(v => !v)}
        cuisines={cuisines}
        selectedCuisine={selectedCuisine}
        onCuisineFilter={setSelectedCuisine}
        tastes={tastes}
        selectedTaste={selectedTaste}
        onTasteFilter={setSelectedTaste}
      />

      <GlobalInsights
        nodes={data ? data.graph.nodes : null}
        edges={data ? data.graph.edges : null}
        filterCuisine={selectedCuisine}
        filterTaste={selectedTaste}
        isOpen={showGlobalInsights}
        onClose={() => setShowGlobalInsights(false)}
      />

      <FlavorTreeExplorer
        nodes={data ? data.graph.nodes : null}
        isOpen={showTreeExplorer}
        onClose={() => { setShowTreeExplorer(false); setTreeFilterIngredients(null); }}
        onFilterIngredients={setTreeFilterIngredients}
      />

      {/* Tree Explorer toggle */}
      <button
        onClick={() => setShowTreeExplorer(v => !v)}
        className={`fixed top-[108px] right-4 z-50 p-2 rounded-lg border transition-all ${
          showTreeExplorer
            ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-400'
            : 'bg-[#12121a]/80 border-[#1e1e2e] text-gray-400 hover:text-gray-200 hover:border-gray-500'
        }`}
        title="Flavor Trees"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      </button>

      {/* Global Insights toggle */}
      <button
        onClick={() => setShowGlobalInsights(v => !v)}
        className={`fixed top-[150px] right-4 z-50 p-2 rounded-lg border transition-all ${
          showGlobalInsights
            ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-400'
            : 'bg-[#12121a]/80 border-[#1e1e2e] text-gray-400 hover:text-gray-200 hover:border-gray-500'
        }`}
        title="Global Insights"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </button>
    </>
  );
}
