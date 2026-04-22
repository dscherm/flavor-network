import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { getNeighbors } from '../data/graph.js';
import { getCocktailScope, getSauceScope } from '../data/labScope.js';
import TasteWheel from './TasteWheel.jsx';
import RecipeNotebook from './RecipeNotebook.jsx';
import SuggestionDrawer from './SuggestionDrawer.jsx';

const FONT_FAMILY = 'Caveat, cursive';

/**
 * RecipeLabMobile — Mobile-specific Recipe Lab with 3-zone layout:
 *   1. Taste Wheel (top) — octagonal pencil-shaded flavor radar
 *   2. Recipe Notebook (middle) — scrollable ingredient list
 *   3. Suggestion Drawer (bottom) — pull-up sheet with taste tabs + chips
 */
export default function RecipeLabMobile({ fullData, initialIngredient, userProfile }) {
  const [labMode, setLabMode] = useState('taste');
  const [centerIngredient, setCenterIngredient] = useState(initialIngredient || null);
  const [recipeIngredients, setRecipeIngredients] = useState(
    initialIngredient ? [initialIngredient] : []
  );
  const [recipeTitle, setRecipeTitle] = useState('');
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [drawerSnap, setDrawerSnap] = useState('peek');
  const [activeTab, setActiveTab] = useState('all');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(375);

  // Reset structure on mode change
  useEffect(() => { setSelectedStructure(null); }, [labMode]);

  // Sync initialIngredient
  useEffect(() => {
    if (initialIngredient && initialIngredient !== centerIngredient) {
      setCenterIngredient(initialIngredient);
      setRecipeIngredients(prev =>
        prev.includes(initialIngredient) ? prev : [initialIngredient, ...prev]
      );
    }
  }, [initialIngredient]);

  // Container width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Scope sets (cocktail / sauce) — lazy-loaded once, cached across mode switches.
  const [cocktailScope, setCocktailScope] = useState(null);
  const [sauceScope, setSauceScope] = useState(null);
  useEffect(() => {
    if (labMode === 'cocktail' && !cocktailScope) {
      getCocktailScope().then(setCocktailScope).catch(() => setCocktailScope(new Set()));
    } else if (labMode === 'sauce' && !sauceScope) {
      getSauceScope().then(setSauceScope).catch(() => setSauceScope(new Set()));
    }
  }, [labMode, cocktailScope, sauceScope]);

  // Ingredient list filtered by the current lab mode.
  // General mode → full proDataset. Cocktail/Sauce → only scope-appropriate ingredients.
  const scopedIngredients = useMemo(() => {
    if (!fullData) return [];
    const all = fullData.graph.ingredientList;
    if (labMode === 'cocktail') {
      if (!cocktailScope) return all; // while loading, don't pretend to filter
      return all.filter((n) => cocktailScope.has(n.toLowerCase()));
    }
    if (labMode === 'sauce') {
      if (!sauceScope) return all;
      return all.filter((n) => sauceScope.has(n.toLowerCase()));
    }
    return all;
  }, [fullData, labMode, cocktailScope, sauceScope]);

  // Fuse search — index rebuilt when scope changes.
  const fuse = useMemo(() => {
    if (!scopedIngredients.length) return null;
    const docs = scopedIngredients.map(n => ({ name: n }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [scopedIngredients]);

  // Click-outside search close
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (!fuse || value.trim().length === 0) {
      setSearchResults([]);
      setSearchOpen(false);
      setHighlightIdx(-1);
      return;
    }
    const matched = fuse.search(value, { limit: 8 }).map(r => r.item.name);
    setSearchResults(matched);
    setSearchOpen(matched.length > 0);
    setHighlightIdx(-1);
  }, [fuse]);

  const selectFromSearch = useCallback((name) => {
    if (!centerIngredient) {
      setCenterIngredient(name);
    }
    setRecipeIngredients(prev =>
      prev.includes(name) ? prev : [...prev, name]
    );
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setHighlightIdx(-1);
    // Auto-expand drawer when first ingredient is picked
    if (!centerIngredient) setDrawerSnap('half');
  }, [centerIngredient]);

  const handleSearchKeyDown = useCallback((e) => {
    if (!searchOpen || searchResults.length === 0) {
      if (e.key === 'Escape') { setSearchOpen(false); searchInputRef.current?.blur(); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx(prev => (prev < searchResults.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx(prev => (prev > 0 ? prev - 1 : searchResults.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < searchResults.length) {
          selectFromSearch(searchResults[highlightIdx]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSearchOpen(false);
        setHighlightIdx(-1);
        break;
      default: break;
    }
  }, [searchOpen, searchResults, highlightIdx, selectFromSearch]);

  // Ingredient management
  const handleAddIngredient = useCallback((name) => {
    if (!name || recipeIngredients.includes(name)) return;
    if (!centerIngredient) setCenterIngredient(name);
    setRecipeIngredients(prev => [...prev, name]);
  }, [centerIngredient, recipeIngredients]);

  const handleRemoveIngredient = useCallback((name) => {
    setRecipeIngredients(prev => prev.filter(n => n !== name));
    if (name === centerIngredient) {
      const remaining = recipeIngredients.filter(n => n !== name);
      setCenterIngredient(remaining.length > 0 ? remaining[0] : null);
      if (remaining.length === 0) setDrawerSnap('peek');
    }
  }, [centerIngredient, recipeIngredients]);

  const handleRecenter = useCallback((name) => {
    setCenterIngredient(name);
  }, []);

  const handleClear = useCallback(() => {
    setRecipeIngredients([]);
    setRecipeTitle('');
    setCenterIngredient(null);
    setDrawerSnap('peek');
    setActiveTab('all');
  }, []);

  // Taste wheel → drawer interaction
  const handleTapAxis = useCallback((axis) => {
    setActiveTab(axis);
    if (drawerSnap === 'peek') setDrawerSnap('half');
  }, [drawerSnap]);


  return (
    <div
      ref={containerRef}
      data-testid="recipe-lab"
      className="fixed inset-0 pt-10 flex flex-col"
      style={{ backgroundColor: '#fefae0' }}
    >
      {/* Mode tabs */}
      <div className="absolute top-11 right-3 z-20 flex items-center gap-1">
        {[
          { key: 'taste', label: 'General' },
          { key: 'cocktail', label: 'Cocktail' },
          { key: 'sauce', label: 'Sauce' },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => setLabMode(m.key)}
            className={`px-2 py-1 text-xs rounded-md border transition-colors ${
              labMode === m.key
                ? 'bg-[#e8dcc0] border-[#c9b99a] text-[#5a4a2a] font-medium'
                : 'border-[#d8cca8] text-[#a09070] hover:bg-[#f0e8d0]'
            }`}
            style={{ fontFamily: FONT_FAMILY }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div
        ref={searchContainerRef}
        className="relative z-20 mx-4 mt-1 mb-2"
      >
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="rgba(120,100,70,0.6)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
            placeholder="Search ingredients..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-lg border-2 border-[#c9b99a] bg-[#fefae0]/95 text-lg outline-none transition-colors focus:border-[#8a7a5a] placeholder-[#b8a88a]"
            style={{ fontFamily: FONT_FAMILY, color: '#3a3428' }}
          />
        </div>
        {searchOpen && searchResults.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 rounded-lg border-2 border-[#c9b99a] bg-[#fefae0]/98 backdrop-blur-sm max-h-64 overflow-y-auto shadow-lg z-30">
            {searchResults.map((name, idx) => (
              <li
                key={name}
                onMouseDown={(e) => { e.preventDefault(); selectFromSearch(name); }}
                onTouchStart={(e) => { e.preventDefault(); selectFromSearch(name); }}
                className={`px-4 py-3 cursor-pointer text-lg transition-colors ${
                  idx === highlightIdx ? 'bg-[#e8dcc0]' : ''
                }`}
                style={{ fontFamily: FONT_FAMILY, color: '#3a3428', minHeight: '48px', display: 'flex', alignItems: 'center' }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Zone 1: Taste Wheel */}
      <div className="flex-shrink-0 flex justify-center">
        <TasteWheel
          ingredients={recipeIngredients}
          nodes={fullData?.graph?.nodes}
          onTapAxis={handleTapAxis}
          width={containerWidth}
        />
      </div>

      {/* Zone 2: Recipe Notebook */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 80 }}>
        <RecipeNotebook
          ingredients={recipeIngredients}
          centerIngredient={centerIngredient}
          nodes={fullData?.graph?.nodes}
          edges={fullData?.graph?.edges}
          onRemove={handleRemoveIngredient}
          onRecenter={handleRecenter}
          recipeTitle={recipeTitle}
          onTitleChange={setRecipeTitle}
          compatibility={null}
        />

        {/* Save / Clear buttons */}
        {recipeIngredients.length >= 2 && (
          <div className="absolute bottom-1 right-2 flex gap-1 z-10">
            <button
              onClick={() => {
                const recipe = { name: recipeTitle || 'Untitled Recipe', ingredients: recipeIngredients, createdAt: Date.now() };
                userProfile?.addRecipe?.(recipe);
              }}
              className="px-3 py-1 text-xs rounded-md border border-[#c9b99a] bg-[#e8dcc0] transition-colors"
              style={{ fontFamily: FONT_FAMILY, color: '#5a4a2a' }}
            >
              Save
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1 text-xs rounded-md border border-[#d8cca8] transition-colors"
              style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Zone 3: Suggestion Drawer */}
      <SuggestionDrawer
        centerIngredient={centerIngredient}
        recipeIngredients={recipeIngredients}
        nodes={fullData?.graph?.nodes}
        edges={fullData?.graph?.edges}
        onAddIngredient={handleAddIngredient}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        snapState={drawerSnap}
        onSnapChange={setDrawerSnap}
        labMode={labMode}
        selectedStructure={selectedStructure}
      />
    </div>
  );
}
