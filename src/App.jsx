import { useState, useCallback, useMemo } from 'react';
import useFlavorData from './hooks/useFlavorData.js';
import NetworkScene from './components/NetworkScene.jsx';
import SearchBar from './components/SearchBar.jsx';
import IngredientPanel from './components/IngredientPanel.jsx';
import Legend from './components/Legend.jsx';
import Controls from './components/Controls.jsx';
import { getNeighbors, getSharedPairings } from './data/graph.js';
import { getAllCuisines, getAllTastes } from './data/metadata.js';
import ComparePanel from './components/ComparePanel.jsx';
import Walkthrough from './components/Walkthrough.jsx';
import HelpButton from './components/HelpButton.jsx';

export default function App() {
  const { loading, error, data } = useFlavorData();
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEdges, setShowEdges] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [selectedTaste, setSelectedTaste] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareNode, setCompareNode] = useState(null);
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem('flavor-tour-complete')
  );

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

  const sharedPairings = useMemo(() => {
    if (!data || !selectedNode || !compareNode) return [];
    return getSharedPairings(selectedNode, compareNode, data.graph.edges);
  }, [data, selectedNode, compareNode]);

  const compareNodeData = useMemo(() => {
    if (!data || !compareNode) return null;
    return data.graph.nodes.get(compareNode) || null;
  }, [data, compareNode]);

  const handleNodeClick = useCallback((node) => {
    const name = node ? node.name : null;
    if (compareMode && selectedNode && name && name !== selectedNode) {
      setCompareNode(name);
    } else {
      setSelectedNode(name);
      setCompareNode(null);
    }
  }, [compareMode, selectedNode]);

  const handleSearchSelect = useCallback((name) => {
    setSelectedNode(name);
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-neural-glow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neural-muted text-sm">Loading flavor network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to load data</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NetworkScene
        data={data}
        onNodeClick={handleNodeClick}
        onNodeHover={() => {}}
        selectedNode={selectedNode}
        showEdges={showEdges}
        showParticles={showParticles}
      />
      <SearchBar
        ingredients={ingredientList}
        onSelect={handleSearchSelect}
      />
      <IngredientPanel
        node={selectedNodeData}
        neighbors={neighbors}
        onClose={handlePanelClose}
        onSelectIngredient={handleSearchSelect}
      />
      {compareNode && (
        <ComparePanel
          node1={selectedNodeData}
          node2={compareNodeData}
          sharedPairings={sharedPairings}
          neighbors1={neighbors}
          neighbors2={data ? getNeighbors(compareNode, data.graph.edges) : []}
          onClose={() => { setCompareNode(null); setCompareMode(false); }}
        />
      )}
      <Legend />
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
      <Walkthrough
        active={showTour}
        onComplete={() => setShowTour(false)}
        onSkip={() => setShowTour(false)}
      />
      <HelpButton onClick={() => setShowTour(true)} />
    </>
  );
}
