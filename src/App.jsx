import { useState, useCallback, useMemo, useEffect } from 'react';
import useFlavorData from './hooks/useFlavorData.js';
import NetworkScene from './components/NetworkScene.jsx';
import SearchBar from './components/SearchBar.jsx';
import IngredientPanel from './components/IngredientPanel.jsx';
import Legend from './components/Legend.jsx';
import Controls from './components/Controls.jsx';
import { getNeighbors } from './data/graph.js';
// NodeFavoriteButton removed — favorite is now in IngredientPanel
import { getAllCuisines, getAllTastes } from './data/metadata.js';
import ComparePanel from './components/ComparePanel.jsx';
import Walkthrough from './components/Walkthrough.jsx';
import HelpButton from './components/HelpButton.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import RecipeBuilder from './components/RecipeBuilder.jsx';
import RecipeSharePanel from './components/RecipeSharePanel.jsx';
import ProfileToggle from './components/ProfileToggle.jsx';

import ProfileInsights from './components/ProfileInsights.jsx';
import GlobalInsights from './components/GlobalInsights.jsx';
import useUserProfile from './hooks/useUserProfile.js';
import useAuth from './hooks/useAuth.js';
import { computeProfileWeights } from './data/profileWeights.js';

export default function App() {
  const { loading, error, data } = useFlavorData();
  const { user, loginWithGoogle, logout } = useAuth();
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [showEdges, setShowEdges] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [selectedTaste, setSelectedTaste] = useState('');
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem('flavor-tour-complete')
  );
  const [showProfile, setShowProfile] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);
  const [showRecipeShare, setShowRecipeShare] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showGlobalInsights, setShowGlobalInsights] = useState(false);
  const userProfile = useUserProfile(user);

  // Derived state for backwards compat
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

  const profileWeights = useMemo(() => {
    if (!profileMode || !data) return null;
    return computeProfileWeights(userProfile.profile, data.graph.nodes);
  }, [profileMode, data, userProfile.profile]);

  const handleNodeClick = useCallback((node) => {
    if (!node) {
      // Clicked empty space — clear all
      setSelectedNodes([]);
      return;
    }
    const name = node.name;
    setSelectedNodes((prev) => {
      if (prev.includes(name)) {
        // Already selected — remove it
        return prev.filter((n) => n !== name);
      }
      // Add to selection
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedNodes([]);
      }
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
        selectedNodes={selectedNodes}
        showEdges={showEdges}
        showParticles={showParticles}
        filterCuisine={selectedCuisine}
        filterTaste={selectedTaste}
        profileWeights={profileWeights}
      />
      <SearchBar
        ingredients={ingredientList}
        onSelect={handleSearchSelect}
      />

      {/* Single selection: show ingredient detail panel */}
      {!isComparing && (
        <IngredientPanel
          node={selectedNodeData}
          neighbors={neighbors}
          onClose={handlePanelClose}
          onSelectIngredient={handleSearchSelect}
          isFavorite={selectedNode ? userProfile.hasIngredient(selectedNode) : false}
          onToggleFavorite={userProfile.toggleIngredient}
        />
      )}

      {/* Multi-selection: show comparison panel */}
      {isComparing && (
        <ComparePanel
          selectedNames={selectedNodes}
          nodes={data.graph.nodes}
          edges={data.graph.edges}
          onRemove={handleRemoveFromCompare}
          onClose={handleClearSelection}
        />
      )}

      {/* Clear Selection button — shown when anything is selected, positioned below search bar */}
      {selectedNodes.length > 0 && (
        <button
          onClick={handleClearSelection}
          className="fixed top-[60px] left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear Selection
          <span className="text-gray-600">({selectedNodes.length})</span>
        </button>
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
        onCreateRecipe={() => setShowRecipeBuilder(true)}
        onImportRecipe={() => setShowRecipeShare(true)}
      />
      {showRecipeBuilder && (
        <RecipeBuilder
          ingredientList={ingredientList}
          onSave={userProfile.addRecipe}
          onClose={() => setShowRecipeBuilder(false)}
        />
      )}
      {showRecipeShare && (
        <RecipeSharePanel
          ingredientList={ingredientList}
          onSave={userProfile.addRecipe}
          onClose={() => setShowRecipeShare(false)}
        />
      )}
      <ProfileToggle
        profileMode={profileMode}
        onToggleMode={() => setProfileMode(v => !v)}
        onOpenPanel={() => setShowProfile(v => !v)}
        onOpenInsights={() => setShowInsights(v => !v)}
        onOpenGlobalInsights={() => setShowGlobalInsights(v => !v)}
        profileStats={userProfile.stats}
        user={user}
        onLogin={loginWithGoogle}
        onLogout={logout}
      />
      <ProfileInsights
        profile={userProfile.profile}
        nodes={data ? data.graph.nodes : null}
        isOpen={showInsights}
        onClose={() => setShowInsights(false)}
        onSelectIngredient={handleSearchSelect}
        onAddIngredient={userProfile.addIngredient}
      />
      <GlobalInsights
        nodes={data ? data.graph.nodes : null}
        edges={data ? data.graph.edges : null}
        filterCuisine={selectedCuisine}
        filterTaste={selectedTaste}
        isOpen={showGlobalInsights}
        onClose={() => setShowGlobalInsights(false)}
      />
      <HelpButton onClick={() => setShowTour(true)} />
    </>
  );
}
