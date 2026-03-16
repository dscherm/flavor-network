import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { getNeighbors } from '../data/graph.js';
import { computeRadialLayout, extractTechniques } from '../data/recipeLayout.js';
import NotebookCanvas from './NotebookCanvas.jsx';
import RecipePanel from './RecipePanel.jsx';

const FONT_FAMILY = 'Caveat, cursive';

export default function RecipeLab({ fullData, initialIngredient, userProfile }) {
  const [centerIngredient, setCenterIngredient] = useState(initialIngredient || null);
  const [recipeIngredients, setRecipeIngredients] = useState(
    initialIngredient ? [initialIngredient] : []
  );
  const [recipeTitle, setRecipeTitle] = useState('');
  const [hoveredNode, setHoveredNode] = useState(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(300, width), height: Math.max(300, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Sync initialIngredient when it changes
  useEffect(() => {
    if (initialIngredient && initialIngredient !== centerIngredient) {
      setCenterIngredient(initialIngredient);
      setRecipeIngredients(prev =>
        prev.includes(initialIngredient) ? prev : [initialIngredient, ...prev]
      );
    }
  }, [initialIngredient]);

  // Fuse.js search index
  const fuse = useMemo(() => {
    if (!fullData) return null;
    const docs = fullData.graph.ingredientList.map(n => ({ name: n }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [fullData]);

  // Click-outside to close search
  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
    setCenterIngredient(name);
    setRecipeIngredients(prev =>
      prev.includes(name) ? prev : [name, ...prev]
    );
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setHighlightIdx(-1);
  }, []);

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

  // Center node data for blended color
  const centerNode = useMemo(() => {
    if (!fullData || !centerIngredient) return null;
    return fullData.graph.nodes.get(centerIngredient) || null;
  }, [fullData, centerIngredient]);

  // Compute pairings for center ingredient
  const pairings = useMemo(() => {
    if (!fullData || !centerIngredient) return [];
    return getNeighbors(centerIngredient, fullData.graph.edges);
  }, [fullData, centerIngredient]);

  // Compute layout positions
  const layoutPositions = useMemo(() => {
    if (!fullData || !centerIngredient || pairings.length === 0) return null;
    return computeRadialLayout(centerIngredient, pairings, fullData.graph.nodes);
  }, [fullData, centerIngredient, pairings]);

  // Extract techniques from pairings (filtered out of canvas)
  const techniques = useMemo(() => {
    if (pairings.length === 0) return [];
    return extractTechniques(pairings);
  }, [pairings]);

  const handleClickNode = useCallback((name) => {
    if (!name) return;
    // If clicking center, do nothing
    if (name === centerIngredient) return;

    // If already in recipe, re-center on it
    if (recipeIngredients.includes(name)) {
      setCenterIngredient(name);
      return;
    }

    // Add to recipe
    setRecipeIngredients(prev => [...prev, name]);
  }, [centerIngredient, recipeIngredients]);

  const handleRemoveIngredient = useCallback((name) => {
    setRecipeIngredients(prev => prev.filter(n => n !== name));
    // If we removed the center ingredient, pick the first remaining or null
    if (name === centerIngredient) {
      setRecipeIngredients(prev => {
        // prev already has the item removed from the earlier filter
        return prev;
      });
      setCenterIngredient(prev => {
        const remaining = recipeIngredients.filter(n => n !== name);
        return remaining.length > 0 ? remaining[0] : null;
      });
    }
  }, [centerIngredient, recipeIngredients]);

  const handleRecenter = useCallback((name) => {
    setCenterIngredient(name);
  }, []);

  const handleClear = useCallback(() => {
    setRecipeIngredients([]);
    setRecipeTitle('');
    setCenterIngredient(null);
  }, []);

  const handleSave = useCallback(() => {
    if (recipeIngredients.length < 2) return;
    const recipe = {
      name: recipeTitle || 'Untitled Recipe',
      ingredients: recipeIngredients,
      createdAt: Date.now(),
    };
    userProfile?.addRecipe?.(recipe);
  }, [recipeIngredients, recipeTitle, userProfile]);

  // Panel width for layout calculation
  const panelWidth = 280;
  const canvasWidth = Math.max(300, size.width - panelWidth);

  return (
    <div className="fixed inset-0 pt-10 flex" style={{ backgroundColor: '#fefae0' }}>
      {/* Notebook-themed search bar */}
      <div
        ref={searchContainerRef}
        className="absolute top-12 left-1/2 -translate-x-1/2 z-20"
        style={{ width: 340 }}
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
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-[#c9b99a] bg-[#fefae0]/95 backdrop-blur-sm text-lg outline-none transition-colors focus:border-[#8a7a5a] placeholder-[#b8a88a]"
            style={{ fontFamily: FONT_FAMILY, color: '#3a3428' }}
            role="combobox"
            aria-expanded={searchOpen}
            aria-autocomplete="list"
          />
        </div>
        {searchOpen && searchResults.length > 0 && (
          <ul className="mt-1 rounded-lg border-2 border-[#c9b99a] bg-[#fefae0]/98 backdrop-blur-sm max-h-64 overflow-y-auto shadow-lg">
            {searchResults.map((name, idx) => (
              <li
                key={name}
                onMouseDown={(e) => { e.preventDefault(); selectFromSearch(name); }}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`px-4 py-2 cursor-pointer text-lg transition-colors ${
                  idx === highlightIdx
                    ? 'bg-[#e8dcc0]'
                    : 'hover:bg-[#f0e8d0]'
                }`}
                style={{ fontFamily: FONT_FAMILY, color: '#3a3428' }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {!centerIngredient && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center" style={{ fontFamily: FONT_FAMILY }}>
              <p className="text-3xl mb-2" style={{ color: '#7a6a4a' }}>Recipe Lab</p>
              <p className="text-xl" style={{ color: '#a09070' }}>
                Search for an ingredient to start planning your recipe
              </p>
            </div>
          </div>
        )}
        <NotebookCanvas
          centerIngredient={centerIngredient}
          centerNode={centerNode}
          layoutPositions={layoutPositions}
          recipeIngredients={recipeIngredients}
          hoveredNode={hoveredNode}
          onHoverNode={setHoveredNode}
          onClickNode={handleClickNode}
          width={canvasWidth}
          height={size.height}
        />
      </div>

      {/* Recipe panel sidebar */}
      <div
        className="flex-shrink-0 border-l-2 border-[#d8cca8] overflow-hidden"
        style={{ width: panelWidth, backgroundColor: '#fef9e0' }}
      >
        <RecipePanel
          ingredients={recipeIngredients}
          nodes={fullData?.graph?.nodes}
          edges={fullData?.graph?.edges}
          onRemove={handleRemoveIngredient}
          onRecenter={handleRecenter}
          onClear={handleClear}
          onSave={handleSave}
          recipeTitle={recipeTitle}
          onTitleChange={setRecipeTitle}
          centerIngredient={centerIngredient}
          techniques={techniques}
        />
      </div>
    </div>
  );
}
