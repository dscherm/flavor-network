import { useState, useCallback, useMemo, useEffect } from 'react';
import useProData from './hooks/useProData.js';
import NetworkScene from './components/NetworkScene.jsx';
import SearchBar from './components/SearchBar.jsx';
import IngredientPanel from './components/IngredientPanel.jsx';
import Legend from './components/Legend.jsx';
import Controls from './components/Controls.jsx';
import { getNeighbors } from './data/graph.js';
import { getAllCuisines, getAllTastes } from './data/metadata.js';
import ComparePanel from './components/ComparePanel.jsx';
import Walkthrough from './components/Walkthrough.jsx';
import HelpButton from './components/HelpButton.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import RecipeBuilder from './components/RecipeBuilder.jsx';
import RecipeSharePanel from './components/RecipeSharePanel.jsx';
import RecipeScanner from './components/RecipeScanner.jsx';
import ProfileToggle from './components/ProfileToggle.jsx';

import ProfileInsights from './components/ProfileInsights.jsx';
import GlobalInsights from './components/GlobalInsights.jsx';
import PalateQuiz from './components/PalateQuiz.jsx';
import FlavorTreeExplorer from './components/FlavorTreeExplorer.jsx';
import ProfileTreeView from './components/ProfileTreeView.jsx';
import FlavorDNA from './components/FlavorDNA.jsx';
import CocktailLab from './components/CocktailLab.jsx';
import SauceLab from './components/SauceLab.jsx';
import RecipeLab from './components/RecipeLab.jsx';
import useUserProfile from './hooks/useUserProfile.js';
import useAuth from './hooks/useAuth.js';
import { computeProfileWeights } from './data/profileWeights.js';
import { createTasteAxisLabels } from './three/AxisLabels.js';

export default function App() {
  // Primary data source: ProData (proprietary dataset from RecipeNLG + MealDB + CocktailDB)
  const { loading, error, data } = useProData();
  const { user, loginWithGoogle, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('network'); // 'network' | 'cocktail' | 'sauce' | 'recipe'
  const [cocktailMounted, setCocktailMounted] = useState(false); // lazy mount
  const [sauceMounted, setSauceMounted] = useState(false); // lazy mount
  const [recipeMounted, setRecipeMounted] = useState(false); // lazy mount
  const [labDropdownOpen, setLabDropdownOpen] = useState(false);
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
  const [showRecipeScanner, setShowRecipeScanner] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showGlobalInsights, setShowGlobalInsights] = useState(false);
  const [showPalateQuiz, setShowPalateQuiz] = useState(false);
  const [showTreeExplorer, setShowTreeExplorer] = useState(false);
  const [showProfileTree, setShowProfileTree] = useState(false);
  const [showFlavorDNA, setShowFlavorDNA] = useState(false);
  const [treeFilterIngredients, setTreeFilterIngredients] = useState(null);
  const [treeFilterLabel, setTreeFilterLabel] = useState(null);
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

  const tasteAxisLabels = useMemo(() => createTasteAxisLabels(50), []);

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

  // Parse URL parameters on mount to pre-load shared recipe ingredients
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const ingredientsParam = params.get('ingredients');
    if (ingredientsParam) {
      const names = ingredientsParam.split(',').map(s => s.trim().toLowerCase());
      const knownNodes = data.graph.nodes;
      const matched = names.filter(n => knownNodes.has(n));
      if (matched.length > 0) {
        setSelectedNodes(matched);
      }
    }
  }, [data]);

  // Generate shareable recipe URL from current selection
  const shareUrl = useMemo(() => {
    if (selectedNodes.length === 0) return '';
    const params = new URLSearchParams();
    params.set('ingredients', selectedNodes.join(','));
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
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

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
      {/* Top-level tab navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[60] flex items-center h-10 bg-[#0a0a12]/95 backdrop-blur-md border-b border-[#1e1e2e]">
        <div className="flex items-center gap-0.5 px-3 h-full">
          {/* Network tab */}
          <button
            onClick={() => { setActiveTab('network'); setLabDropdownOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'network'
                ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
            Network
          </button>

          {/* Labs dropdown */}
          <div className="relative">
            <button
              onClick={() => setLabDropdownOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab !== 'network'
                  ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 11.33L18 2l-1.73-1-5.27 9.33L5.73 1 4 2l5 9.33V19H6v2h12v-2h-3v-7.67z" />
              </svg>
              {activeTab === 'cocktail' ? 'Cocktail Lab' : activeTab === 'sauce' ? 'Sauce Lab' : activeTab === 'recipe' ? 'Recipe Lab' : 'Labs'}
              <svg className={`w-3 h-3 transition-transform ${labDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {labDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[59]" onClick={() => setLabDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-44 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[61] overflow-hidden">
                  {[
                    { key: 'cocktail', label: 'Cocktail Lab', icon: 'M7.5 21H2V3h5l4.286 10L16 3h6v18h-5.5v-9.571L13 21h-2.5L7.5 11.429V21z' },
                    { key: 'sauce', label: 'Sauce Lab', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
                    { key: 'recipe', label: 'Recipe Lab', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z' },
                  ].map((lab) => (
                    <button
                      key={lab.key}
                      onClick={() => {
                        setActiveTab(lab.key);
                        if (lab.key === 'cocktail') setCocktailMounted(true);
                        if (lab.key === 'sauce') setSauceMounted(true);
                        if (lab.key === 'recipe') setRecipeMounted(true);
                        setLabDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                        activeTab === lab.key
                          ? 'text-cyan-300 bg-cyan-500/10'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d={lab.icon} />
                      </svg>
                      {lab.label}
                      {activeTab === lab.key && (
                        <svg className="w-3 h-3 ml-auto text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="ml-auto px-3 text-[9px] text-gray-600 tracking-wider uppercase">
          Powered by the Flavor Network
        </div>
      </nav>

      {/* Network tab */}
      <div className={`transition-opacity duration-300 ${activeTab === 'network' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'}`}>
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
        treeFilterIngredients={treeFilterIngredients}
        sceneExtras={tasteAxisLabels}
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

      {/* Clear Selection + Share buttons — shown when anything is selected, positioned below search bar */}
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
              copied ? 'text-green-400 border-green-400/30' : 'text-gray-400 hover:text-neural-glow'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Share
              </>
            )}
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
      <Walkthrough
        active={showTour}
        onComplete={() => setShowTour(false)}
        onSkip={() => setShowTour(false)}
        hasProfile={userProfile.stats.totalItems > 0}
        onStartQuiz={() => setShowPalateQuiz(true)}
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
        onScanRecipe={() => setShowRecipeScanner(true)}
        onTakeQuiz={() => { setShowProfile(false); setShowPalateQuiz(true); }}
      />
      {showRecipeBuilder && (
        <RecipeBuilder
          ingredientList={ingredientList}
          onSave={userProfile.addRecipe}
          onClose={() => setShowRecipeBuilder(false)}
          onScanRecipe={() => { setShowRecipeBuilder(false); setShowRecipeScanner(true); }}
        />
      )}
      {showRecipeShare && (
        <RecipeSharePanel
          ingredientList={ingredientList}
          onSave={userProfile.addRecipe}
          onClose={() => setShowRecipeShare(false)}
        />
      )}
      {showRecipeScanner && (
        <RecipeScanner
          ingredientList={ingredientList}
          onSave={userProfile.addRecipe}
          onClose={() => setShowRecipeScanner(false)}
        />
      )}
      <ProfileToggle
        profileMode={profileMode}
        onToggleMode={() => setProfileMode(v => !v)}
        onOpenPanel={() => setShowProfile(v => !v)}
        onOpenInsights={() => setShowInsights(v => !v)}
        onOpenGlobalInsights={() => setShowGlobalInsights(v => !v)}
        onOpenProfileTree={() => setShowProfileTree(v => !v)}
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
        treeFilterIngredients={treeFilterIngredients}
        treeFilterLabel={treeFilterLabel}
        selectedNodes={selectedNodes}
        isOpen={showGlobalInsights}
        onClose={() => setShowGlobalInsights(false)}
      />
      <ProfileTreeView
        profile={userProfile.profile}
        nodes={data ? data.graph.nodes : null}
        isOpen={showProfileTree}
        onClose={() => setShowProfileTree(false)}
        onAddIngredient={userProfile.addIngredient}
        onOpenFlavorDNA={() => setShowFlavorDNA(true)}
      />
      <FlavorDNA
        profile={userProfile.profile}
        nodes={data ? data.graph.nodes : null}
        isOpen={showFlavorDNA}
        onClose={() => setShowFlavorDNA(false)}
      />
      <FlavorTreeExplorer
        nodes={data ? data.graph.nodes : null}
        isOpen={showTreeExplorer}
        onClose={() => { setShowTreeExplorer(false); setTreeFilterIngredients(null); setTreeFilterLabel(null); }}
        onFilterIngredients={(ingredients, label) => {
          setTreeFilterIngredients(ingredients);
          setTreeFilterLabel(label || null);
        }}
      />
      {/* Tree Explorer toggle button */}
      <button
        onClick={() => setShowTreeExplorer(v => !v)}
        className={`fixed top-[108px] right-4 z-50 p-2 rounded-lg border transition-all ${
          showTreeExplorer
            ? 'bg-neural-glow/20 border-neural-glow/40 text-neural-glow'
            : 'bg-[#12121a]/80 border-[#1e1e2e] text-gray-400 hover:text-gray-200 hover:border-gray-500'
        }`}
        title="Flavor Trees"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      </button>
      <HelpButton onClick={() => setShowTour(true)} />
      <PalateQuiz
        active={showPalateQuiz}
        previousAnswers={userProfile.profile.quizAnswers}
        onComplete={(answers) => {
          userProfile.saveQuizAnswers(answers);
          setShowPalateQuiz(false);
        }}
        onSkip={() => setShowPalateQuiz(false)}
      />
      </div>

      {/* Cocktail Lab tab — lazy-mounted, stays mounted after first open */}
      {cocktailMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'cocktail' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <CocktailLab fullData={data} userProfile={userProfile} />
        </div>
      )}

      {/* Sauce Lab tab — lazy-mounted, stays mounted after first open */}
      {sauceMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'sauce' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <SauceLab fullData={data} userProfile={userProfile} />
        </div>
      )}

      {/* Recipe Lab tab — lazy-mounted, stays mounted after first open */}
      {recipeMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'recipe' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <RecipeLab fullData={data} initialIngredient={selectedNode} userProfile={userProfile} />
        </div>
      )}

    </>
  );
}
