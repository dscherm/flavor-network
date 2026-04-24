import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import useProData from './hooks/useProData.js';
// TrainingProgress removed — served as dev demo, not production feature
const MoleculeLab = lazy(() => import('./components/MoleculeLab.jsx'));
const DiscoverPatterns = lazy(() => import('./components/DiscoverPatterns.jsx'));
import DiscoverCTA from './components/DiscoverCTA.jsx';
import ClusterJoystick from './components/ClusterJoystick.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import StartPage from './components/StartPage.jsx';
import ErrorCard from './components/ErrorCard.jsx';
import {
  readStartPageFlag,
  writeStartPageFlag,
  clearStartPageFlag,
} from './utils/startPageFlag.js';
import SearchBar from './components/SearchBar.jsx';
import IngredientPanel from './components/IngredientPanel.jsx';
import Legend from './components/Legend.jsx';
import Controls from './components/Controls.jsx';
import { getNeighbors, findStrongestPath } from './data/graph.js';
import { getAllCuisines, getAllTastes } from './data/metadata.js';
import Walkthrough from './components/Walkthrough.jsx';
import HelpButton from './components/HelpButton.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import ProfileToggle from './components/ProfileToggle.jsx';
import GlobalInsights from './components/GlobalInsights.jsx';
import FlavorTreeExplorer from './components/FlavorTreeExplorer.jsx';
import FlavorBridge from './components/FlavorBridge.jsx';
import LivingArchView from './components/LivingArchView.jsx';
import CocktailLab from './components/CocktailLab.jsx';
import SauceLab from './components/SauceLab.jsx';
import RecipeLab from './components/RecipeLab.jsx';
import MobileTabBar from './components/MobileTabBar.jsx';
import BottomSheet from './components/BottomSheet.jsx';
import useIsMobile from './hooks/useIsMobile.js';
import useUserProfile from './hooks/useUserProfile.js';
import useAuth from './hooks/useAuth.js';
import { computeProfileWeights } from './data/profileWeights.js';

export default function App() {
  // StartPage gate — persisted via localStorage key `fn-start-seen`. Returning
  // users with the flag set skip the picker entirely. `?reset=start` clears
  // the flag on mount (for testing). While false, useProData is disabled so
  // the 27MB pairings payload does not download until the user clicks a card.
  const [startPageComplete, setStartPageComplete] = useState(readStartPageFlag);
  const [howItWorksInitialOpen, setHowItWorksInitialOpen] = useState(false);

  // Primary data source: ProData (proprietary dataset from RecipeNLG + MealDB + CocktailDB)
  const { loading, error, data, retry } = useProData({ enabled: startPageComplete });
  const { user, loginWithGoogle, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('network'); // 'network' | 'cocktail' | 'sauce' | 'recipe'
  const [cocktailMounted, setCocktailMounted] = useState(false);
  const [sauceMounted, setSauceMounted] = useState(false);
  const [recipeMounted, setRecipeMounted] = useState(false);
  // trainingMounted removed
  const [moleculeLabOpen, setMoleculeLabOpen] = useState(false);
  const [labDropdownOpen, setLabDropdownOpen] = useState(false);
  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
  const [livingMode, setLivingMode] = useState('ml');
  const [showEdges, setShowEdges] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [edgeBrightness] = useState(0.3);
  const [particleBrightness] = useState(0.3);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [selectedTaste, setSelectedTaste] = useState('');
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem('flavor-tour-complete')
  );
  const [showProfile, setShowProfile] = useState(false);
  const [profileMode, setProfileMode] = useState(false);
  const [showGlobalInsights, setShowGlobalInsights] = useState(false);
  const [showTreeExplorer, setShowTreeExplorer] = useState(false);
  const [showBridge, setShowBridge] = useState(false);
  const [treeFilterIngredients, setTreeFilterIngredients] = useState(null);
  const [treeFilterLabel, setTreeFilterLabel] = useState(null);
  const [bridgePathIngredients, setBridgePathIngredients] = useState(null);
  const [showFilteredList, setShowFilteredList] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [highlightPairings, setHighlightPairings] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);
  const [clusterHighlights, setClusterHighlights] = useState(null);
  const [focusedCluster, setFocusedCluster] = useState(null);
  const isMobile = useIsMobile();
  const [activePanel, setActivePanel] = useState(null);
  const userProfile = useUserProfile(user);

  const handleModeSelect = useCallback((mode) => {
    writeStartPageFlag();
    setStartPageComplete(true);
    if (mode === 'discover') {
      setActiveTab('network');
    } else if (mode === 'build') {
      setActiveTab('recipe');
      setRecipeMounted(true);
    } else if (mode === 'learn') {
      // Learn mode: land on the Network tab with HowItWorks pre-opened.
      // MoleculeOfTheDay and MoleculeLab are being consolidated into the
      // IngredientPanel per user feedback.
      setActiveTab('network');
      setHowItWorksInitialOpen(true);
    }
  }, []);

  const handleStartOver = useCallback(() => {
    clearStartPageFlag();
    setStartPageComplete(false);
    setHowItWorksInitialOpen(false);
    setMoleculeLabOpen(false);
    setActiveTab('network');
  }, []);

  // Derived state
  const selectedNode = selectedNodes.length > 0 ? selectedNodes[0] : null;

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

  const commonPairings = useMemo(() => {
    if (!data || selectedNodes.length < 2) return [];
    const pairingsByNode = selectedNodes.map((name) => {
      const nbrs = getNeighbors(name, data.graph.edges);
      return new Map(nbrs.map((n) => [n.name, n.strength]));
    });
    const allNames = new Set();
    for (const m of pairingsByNode) for (const k of m.keys()) allNames.add(k);
    const shared = [];
    for (const name of allNames) {
      if (selectedNodes.includes(name)) continue;
      let minStrength = Infinity;
      let allHave = true;
      for (const m of pairingsByNode) {
        if (!m.has(name)) { allHave = false; break; }
        minStrength = Math.min(minStrength, m.get(name));
      }
      if (allHave) shared.push({ name, strength: minStrength });
    }
    return shared.sort((a, b) => b.strength - a.strength).slice(0, 20);
  }, [data, selectedNodes]);

  const selectedNodeData = useMemo(() => {
    if (!data || !selectedNode) return null;
    return data.graph.nodes.get(selectedNode) || null;
  }, [data, selectedNode]);

  // Auto-compute flavor path between exactly 2 selected ingredients
  const flavorPath = useMemo(() => {
    if (!data || selectedNodes.length !== 2) return null;
    const path = getNeighbors ? findStrongestPath(selectedNodes[0], selectedNodes[1], data.graph.edges) : [];
    if (path.length <= 2) return null; // Direct connection, no interesting path
    return path;
  }, [data, selectedNodes]);

  const profileWeights = useMemo(() => {
    if (!profileMode || !data) return null;
    return computeProfileWeights(userProfile.profile, data.graph.nodes);
  }, [profileMode, data, userProfile.profile]);


  const handleNodeClick = useCallback((node) => {
    // Cluster-focus gate: when a cluster is focused, clicking empty
    // space exits focus; clicking a node outside the focused cluster
    // is ignored; clicking a node inside the focused cluster selects
    // normally. Exit via another cluster pill is handled separately.
    if (focusedCluster !== null) {
      if (!node) {
        setFocusedCluster(null);
        setSelectedNodes([]);
        setHighlightPairings(null);
        setActivePanel(null);
        return;
      }
      if (node.clusterId !== focusedCluster) return;
    }
    if (!node) {
      setSelectedNodes([]);
      setHighlightPairings(null);
      setActivePanel(null);
      return;
    }
    setHighlightPairings(null);
    const name = node.name;
    setSelectedNodes((prev) => {
      const next = prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name];
      if (next.length >= 1) {
        setActivePanel('ingredient');
      } else {
        setActivePanel(null);
      }
      return next;
    });
  }, [focusedCluster]);

  const handleSearchSelect = useCallback((name) => {
    setSelectedNodes((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      setActivePanel('ingredient');
      return next;
    });
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedNodes([]);
    setHighlightPairings(null);
    setActivePanel(null);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNodes([]);
    setHighlightPairings(null);
    setActivePanel(null);
  }, []);

  const handleLabSelectionChange = useCallback((nodes) => {
    setSelectedNodes(nodes);
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

  // Double-tap on canvas to clear tree filter
  const handleCanvasDoubleTap = useCallback(() => {
    setTreeFilterIngredients(null);
    setTreeFilterLabel(null);
    setShowFilteredList(false);
  }, []);

  // Auto-show filtered list when filter is set
  useEffect(() => {
    if (treeFilterIngredients && treeFilterIngredients.length > 0) {
      setShowFilteredList(true);
    }
  }, [treeFilterIngredients]);

  // Clear filter handler
  const handleClearTreeFilter = useCallback(() => {
    setTreeFilterIngredients(null);
    setTreeFilterLabel(null);
    setShowFilteredList(false);
  }, []);

  if (!startPageComplete) {
    return <StartPage onModeSelect={handleModeSelect} />;
  }

  if (error) {
    return <ErrorCard onRetry={retry} onStartOver={handleStartOver} />;
  }

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

  return (
    <>
      {/* Screen-reader-only live region: announces the currently-selected
          ingredient and its top pairings so keyboard/screen-reader users
          know what's happening in the 3D canvas they can't see. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {selectedNodeData
          ? `Selected ${selectedNodeData.name}. ${selectedNodeData.pairingCount || 0} pairings. `
            + `Taste: ${selectedNodeData.taste || 'unknown'}.`
          : selectedNodes.length > 1
            ? `${selectedNodes.length} ingredients selected.`
            : 'No ingredient selected.'}
      </div>

      {/* Top-level tab navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[60] flex items-center h-10 bg-[#0a0a12]/95 backdrop-blur-md border-b border-[#1e1e2e] safe-top">
        {/* Mobile: show app name */}
        <span className="sm:hidden px-3 text-xs text-cyan-300/80 font-medium tracking-wide" style={{ textShadow: '0 0 10px rgba(79,143,255,0.3)' }}>
          Flavor Network
        </span>
        <div className="hidden sm:flex items-center gap-0.5 px-3 h-full">
          {/* Network tab */}
          <button
            onClick={() => { setActiveTab('network'); setLabDropdownOpen(false); setExploreDropdownOpen(false); }}
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
              onClick={() => { setLabDropdownOpen(v => !v); setExploreDropdownOpen(false); }}
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
                    { key: 'recipe', label: 'Recipe Lab' },
                    { key: 'cocktail', label: 'Cocktail Lab' },
                    { key: 'sauce', label: 'Sauce Lab' },
                  ].map((lab) => (
                    <button
                      key={lab.key}
                      onClick={() => {
                        setActiveTab(lab.key);
                        if (lab.key === 'cocktail') setCocktailMounted(true);
                        if (lab.key === 'sauce') setSauceMounted(true);
                        if (lab.key === 'recipe') setRecipeMounted(true);
                        if (lab.key === 'molecule') { setMoleculeLabOpen(v => !v); setLabDropdownOpen(false); return; }
                        setLabDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                        activeTab === lab.key
                          ? 'text-cyan-300 bg-cyan-500/10'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                      }`}
                    >
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

          {/* Explore dropdown */}
          <div className="relative">
            <button
              onClick={() => { setExploreDropdownOpen(v => !v); setLabDropdownOpen(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                showTreeExplorer || showBridge || showGlobalInsights
                  ? 'text-purple-300 bg-purple-500/10 border border-purple-500/20'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Explore
              <svg className={`w-3 h-3 transition-transform ${exploreDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
            {exploreDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[59]" onClick={() => setExploreDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[61] overflow-hidden">
                  <button
                    onClick={() => { setShowTreeExplorer(v => !v); setExploreDropdownOpen(false); setActiveTab('network'); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                      showTreeExplorer ? 'text-purple-300 bg-purple-500/10' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                    Ingredient Tree
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Profile button */}
          <button
            onClick={() => setShowProfile(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              showProfile
                ? 'text-blue-300 bg-blue-500/10 border border-blue-500/20'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profile
          </button>
        </div>
        <div className="ml-auto px-3 text-[9px] text-gray-600 tracking-wider uppercase">
          Powered by the Flavor Network
        </div>
      </nav>

      {/* Network tab */}
      <div className={`transition-opacity duration-300 ${activeTab === 'network' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'}`}>
      <LivingArchView
        data={data}
        onNodeClick={handleNodeClick}
        onNodeHover={(node, pos) => {
          setHoveredNode(node);
          setHoverPos(pos);
        }}
        selectedNode={selectedNode}
        selectedNodes={selectedNodes}
        showEdges={showEdges}
        showParticles={showParticles}
        edgeBrightness={edgeBrightness}
        particleBrightness={particleBrightness}
        filterTaste={selectedTaste}
        treeFilterIngredients={treeFilterIngredients}
        bridgePathIngredients={bridgePathIngredients}
        mode={livingMode}
        onModeChange={setLivingMode}
        onDoubleTap={handleCanvasDoubleTap}
        highlightPairings={highlightPairings}
        flyToTarget={flyToTarget}
        highlightIngredients={clusterHighlights}
        focusedClusterId={focusedCluster}
      />
      {/* Hover tooltip — shows ingredient name at cursor position */}
      {hoveredNode && hoverPos && (
        <div
          className="fixed z-[70] px-2 py-1 rounded bg-[#0d0d16]/95 border border-purple-500/40 text-xs text-white pointer-events-none whitespace-nowrap"
          style={{ left: hoverPos.x + 12, top: hoverPos.y - 8 }}
        >
          <span className="font-medium">{hoveredNode.name}</span>
          {hoveredNode.taste && (
            <span className="ml-2 text-gray-400">{hoveredNode.taste}</span>
          )}
        </div>
      )}
      <SearchBar
        ingredients={ingredientList}
        onSelect={handleSearchSelect}
      />

      {/* Ingredient detail panel (desktop only) */}
      {!isMobile && (
        <IngredientPanel
          node={selectedNodeData}
          neighbors={neighbors}
          onClose={handlePanelClose}
          onSelectIngredient={handleSearchSelect}
          onHighlightPairings={(names) => setHighlightPairings(
            highlightPairings ? null : names
          )}
          commonPairings={commonPairings}
          selectedNodes={selectedNodes}
          selectedNodesData={selectedNodes.map(n => data?.graph?.nodes?.get(n)).filter(Boolean)}
          selectedCount={selectedNodes.length}
          flavorPath={flavorPath}
          onBuildRecipe={() => { setRecipeMounted(true); setActiveTab('recipe'); }}
          isFavorite={selectedNode ? userProfile.hasIngredient(selectedNode) : false}
          onToggleFavorite={userProfile.toggleIngredient}
          graphNodes={data?.graph?.nodes}
          bridgeCompounds={data?.bridgeCompounds}
          gnnEntropy={data?.gnnEntropy}
          odorThresholds={data?.odorThresholds}
          ingredientThresholds={data?.ingredientThresholds}
          compoundTastes={data?.compoundTastes}
        />
      )}

      {/* Clear Selection + Share buttons */}
      {selectedNodes.length > 0 && (
        <div className="fixed top-[100px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          <button
            onClick={handleClearSelection}
            className="px-3 py-1.5 min-h-[44px] text-xs text-gray-400 hover:text-red-400 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Selection
            <span className="text-gray-600">({selectedNodes.length})</span>
          </button>
          <button
            onClick={handleCopyShareLink}
            className={`px-3 py-1.5 min-h-[44px] text-xs bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg transition-colors select-none flex items-center gap-1.5 ${
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

      {/* Filtered ingredients panel — shows when a tree filter is active */}
      {treeFilterIngredients && treeFilterIngredients.length > 0 && showFilteredList && (
        <div className="fixed left-2 z-40 w-72 sm:w-80 max-h-[50vh] flex flex-col bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e] rounded-lg overflow-hidden" style={{ top: 'calc(var(--nav-h) + 3.5rem)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neural-glow">{treeFilterLabel}</span>
              <span className="text-[10px] text-gray-500">{treeFilterIngredients.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowFilteredList(false)}
                className="text-gray-500 hover:text-gray-300 text-xs min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Minimize"
              >
                &minus;
              </button>
              <button
                onClick={handleClearTreeFilter}
                className="text-gray-500 hover:text-red-400 text-xs min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Clear filter (or double-tap canvas)"
              >
                &times;
              </button>
            </div>
          </div>
          {/* Scrollable ingredient cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {treeFilterIngredients.map(name => {
              const node = data?.graph?.nodes?.get(name);
              const taste = node?.taste || '';
              const pairingCount = node?.pairingCount || 0;
              return (
                <button
                  key={name}
                  onClick={() => handleSearchSelect(name)}
                  className="w-full min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-md bg-[#1a1a2a]/60 hover:bg-[#1a1a2a] border border-[#2a2a3a]/50 transition-colors text-left"
                >
                  <span className="text-xs text-gray-200 flex-1 truncate">{name}</span>
                  {taste && (
                    <span className="text-[9px] text-gray-500 capitalize">{taste}</span>
                  )}
                  <span className="text-[9px] text-gray-600">{pairingCount}p</span>
                </button>
              );
            })}
          </div>
          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-[#1e1e2e] text-[9px] text-gray-600 text-center">
            Double-tap canvas to clear filter
          </div>
        </div>
      )}

      {/* Minimized filter indicator */}
      {treeFilterIngredients && treeFilterIngredients.length > 0 && !showFilteredList && (
        <button
          onClick={() => setShowFilteredList(true)}
          className="fixed left-2 z-40 px-3 py-1.5 min-h-[44px] bg-[#12121a]/90 backdrop-blur-md border border-neural-glow/30 rounded-lg text-xs text-neural-glow flex items-center gap-2 transition-colors hover:bg-[#1a1a2a]"
          style={{ top: 'calc(var(--nav-h) + 3.5rem)' }}
        >
          <span>{treeFilterLabel}</span>
          <span className="text-gray-500">{treeFilterIngredients.length}</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleClearTreeFilter(); }}
            className="text-gray-500 hover:text-red-400 ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            &times;
          </button>
        </button>
      )}

      <Legend
        selectedTaste={selectedTaste}
        onTasteFilter={setSelectedTaste}
      />
      {/* Controls panel removed — brightness fixed at 30% */}
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
        graphNodes={data?.graph?.nodes}
        onSelectIngredient={handleSearchSelect}
        user={user}
        onLogin={loginWithGoogle}
        onLogout={logout}
        onReplayTour={() => { setShowProfile(false); setShowTour(true); }}
      />
      <ProfileToggle
        profileMode={profileMode}
        onToggleMode={() => setProfileMode(v => !v)}
        profileStats={userProfile.stats}
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
      <FlavorTreeExplorer
        nodes={data ? data.graph.nodes : null}
        isOpen={showTreeExplorer}
        onClose={() => { setShowTreeExplorer(false); }}
        onFilterIngredients={(ingredients, label) => {
          setTreeFilterIngredients(ingredients);
          setTreeFilterLabel(label || null);
          // Auto-close the tree panel when a filter is selected
          if (ingredients) setShowTreeExplorer(false);
        }}
      />
      <FlavorBridge
        nodes={data ? data.graph.nodes : null}
        edges={data ? data.graph.edges : null}
        ingredientList={ingredientList}
        isOpen={showBridge}
        onClose={() => { setShowBridge(false); setBridgePathIngredients(null); }}
        onSelectIngredient={handleSearchSelect}
        onPathChange={setBridgePathIngredients}
        bridgeCompounds={data?.bridgeCompounds}
        bridgeMolecules3D={data?.bridgeMolecules3D}
      />
      <HelpButton onClick={() => setShowTour(true)} />
      <HowItWorks initialOpen={howItWorksInitialOpen} />
      </div>

      {/* Cocktail Lab tab — lazy-mounted */}
      {cocktailMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'cocktail' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <CocktailLab
            fullData={data}
            userProfile={userProfile}
            onSelectionChange={handleLabSelectionChange}
            onOpenRecipeLab={(_mode, initialIngredients) => {
              setSelectedNodes(Array.isArray(initialIngredients) ? [...initialIngredients] : []);
              setRecipeMounted(true);
              setActiveTab('recipe');
            }}
          />
        </div>
      )}

      {/* Sauce Lab tab — lazy-mounted */}
      {sauceMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'sauce' ? 'opacity-100' : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <SauceLab
            fullData={data}
            userProfile={userProfile}
            onSelectionChange={handleLabSelectionChange}
            onOpenRecipeLab={(_mode, initialIngredients) => {
              setSelectedNodes(Array.isArray(initialIngredients) ? [...initialIngredients] : []);
              setRecipeMounted(true);
              setActiveTab('recipe');
            }}
          />
        </div>
      )}

      {/* Recipe Lab — with internal mode switcher */}
      {recipeMounted && (
        <div
          className={`transition-opacity duration-300 ${
            activeTab === 'recipe'
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none fixed inset-0'
          }`}
        >
          <RecipeLab
            fullData={data}
            initialIngredient={selectedNode}
            initialIngredients={selectedNodes}
            userProfile={userProfile}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* Discover Patterns — shows shared molecular patterns between clusters */}
      {activeTab === 'network' && data?.clusterExplanations && (
        <Suspense fallback={null}>
          <DiscoverPatterns
            clusterExplanations={data.clusterExplanations}
            onSelectIngredient={handleSearchSelect}
          />
        </Suspense>
      )}

      {/* Discover CTA — user-seeded pairing finder on the network tab.
          Replaces the old MoleculeOfTheDay floating card per user feedback
          ("doesn't provide important info"). MoleculeLab preset cards are
          folded into the pairing panel context instead. */}
      {activeTab === 'network' && data && (
        <DiscoverCTA
          edges={data.graph.edges}
          nodes={data.graph.nodes}
          ingredientList={ingredientList}
          onPickPair={(names) => {
            setSelectedNodes(names);
            setActivePanel('ingredient');
          }}
        />
      )}

      {/* ClusterJoystick — pinned bottom-center pill strip. In Network
          modes the pills are clusters; in Taste modes they're tastes. */}
      {activeTab === 'network' && data?.clusterLabels?.clusters && (
        <ClusterJoystick
          clusters={data.clusterLabels.clusters}
          mode={livingMode}
          focusedClusterId={focusedCluster}
          onClusterFocus={(id) => {
            setFocusedCluster(id);
            // Exiting focus also clears any stale selection so the user
            // isn't stuck with panels open for ingredients they can no
            // longer reach.
            if (id === null) {
              setSelectedNodes([]);
              setActivePanel(null);
            }
          }}
          onFlyTo={(target) => {
            // Cluster object or raw {position, ts} target.
            if (target && target.label_anchor_3d) {
              setFlyToTarget({ position: target.label_anchor_3d, ts: Date.now() });
              // Surface top-5 cluster members so the user sees "what's
              // actually here" after the camera lands. Use an array ref
              // so repeated taps of the same cluster re-spawn labels.
              const names = (target.top_ingredients || []).slice(0, 5);
              setClusterHighlights(names.length > 0 ? [...names] : null);
            } else if (target && target.position) {
              setFlyToTarget({ position: target.position, ts: Date.now() });
              setClusterHighlights(null);
            }
          }}
        />
      )}

      {/* Molecule Lab — slide-out card */}
      <Suspense fallback={null}>
        <MoleculeLab
          isOpen={moleculeLabOpen}
          onClose={() => setMoleculeLabOpen(false)}
          selectedNodes={selectedNodes}
          selectedNodesData={selectedNodes.map(n => data?.graph?.nodes?.get(n)).filter(Boolean)}
          graphNodes={data?.graph?.nodes}
          onSelectIngredient={handleSearchSelect}
        />
      </Suspense>

      {/* Mobile bottom sheet for panels */}
      {isMobile && (
        <BottomSheet
          isOpen={activePanel != null}
          onClose={() => setActivePanel(null)}
          title={
            activePanel === 'ingredient' ? (selectedNodeData?.name || 'Details') :
            activePanel === 'global-insights' ? 'Network Analysis' :
            'Panel'
          }
        >
          {activePanel === 'ingredient' && selectedNodeData && (
            <IngredientPanel
              node={selectedNodeData}
              neighbors={neighbors}
              onClose={() => setActivePanel(null)}
              onSelectIngredient={handleSearchSelect}
              onHighlightPairings={(names) => setHighlightPairings(
                highlightPairings ? null : names
              )}
              commonPairings={commonPairings}
              selectedNodes={selectedNodes}
              selectedNodesData={selectedNodes.map(n => data?.graph?.nodes?.get(n)).filter(Boolean)}
              selectedCount={selectedNodes.length}
              isFavorite={selectedNode ? userProfile.hasIngredient(selectedNode) : false}
              onToggleFavorite={userProfile.toggleIngredient}
              graphNodes={data?.graph?.nodes}
              embedded
            />
          )}
          {activePanel === 'global-insights' && (
            <GlobalInsights
              nodes={data ? data.graph.nodes : null}
              edges={data ? data.graph.edges : null}
              filterCuisine={selectedCuisine}
              filterTaste={selectedTaste}
              treeFilterIngredients={treeFilterIngredients}
              treeFilterLabel={treeFilterLabel}
              selectedNodes={selectedNodes}
              isOpen={true}
              onClose={() => setActivePanel(null)}
              embedded
            />
          )}
        </BottomSheet>
      )}

      {/* Mobile tab bar */}
      {isMobile && (
        <MobileTabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'cocktail') setCocktailMounted(true);
            if (tab === 'sauce') setSauceMounted(true);
            if (tab === 'recipe') setRecipeMounted(true);
            setLabDropdownOpen(false);
          }}
          onOpenProfile={() => setShowProfile(v => !v)}
          onOpenTreeExplorer={() => setShowTreeExplorer(v => !v)}
          onOpenBridge={() => setShowBridge(v => !v)}
          onOpenGlobalInsights={() => {
            setActivePanel(activePanel === 'global-insights' ? null : 'global-insights');
            setShowGlobalInsights(v => !v);
          }}
        />
      )}

    </>
  );
}
