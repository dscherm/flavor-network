import { useState, useCallback, useMemo, useEffect } from 'react';
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
import ProfilePanel from './components/ProfilePanel.jsx';
import useUserProfile from './hooks/useUserProfile.js';

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
  const [showProfile, setShowProfile] = useState(false);
  const userProfile = useUserProfile();

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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setCompareNode(null);
        setCompareMode(false);
      }
      // "/" to focus search (unless already in an input)
      if (e.key === '/' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput) searchInput.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-2 border-neural-glow/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-neural-glow/50 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-4 border-2 border-neural-glow border-t-transparent rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
            <div className="absolute inset-[38%] bg-neural-glow/80 rounded-full animate-pulse" />
          </div>
          <p className="text-neural-text text-lg font-light tracking-wider mb-1" style={{ textShadow: '0 0 10px rgba(79,143,255,0.5)' }}>
            Flavor Network
          </p>
          <p className="text-neural-muted text-sm">Initializing neural pathways...</p>
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
        filterCuisine={selectedCuisine}
        filterTaste={selectedTaste}
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
      <ProfilePanel
        profile={userProfile.profile}
        actions={userProfile}
        ingredientList={ingredientList}
        cuisines={cuisines}
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
      <button
        onClick={() => setShowProfile((v) => !v)}
        className="fixed top-4 left-4 z-50 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-blue-400 transition-colors select-none"
        aria-label="Toggle profile panel"
      >
        {showProfile ? 'Close Profile' : 'My Profile'}
      </button>
      <HelpButton onClick={() => setShowTour(true)} />
    </>
  );
}
