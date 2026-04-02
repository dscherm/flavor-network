import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { getNeighbors } from '../data/graph.js';
import { computeRadialLayout, extractTechniques } from '../data/recipeLayout.js';
import { buildIngredientIndex, parseIngredients } from '../data/recipeParser.js';
import { scrapeRecipe } from '../data/recipeScraper.js';
import NotebookCanvas from './NotebookCanvas.jsx';
import RecipePanel from './RecipePanel.jsx';
import StructureSelector from './StructureSelector.jsx';
import RecipeLabMobile from './RecipeLabMobile.jsx';

const FONT_FAMILY = 'Caveat, cursive';

export default function RecipeLab({ fullData, initialIngredient, userProfile, isMobile = false }) {
  // Mobile: render dedicated mobile layout
  if (isMobile) {
    return <RecipeLabMobile fullData={fullData} initialIngredient={initialIngredient} userProfile={userProfile} />;
  }
  const [labMode, setLabMode] = useState('taste'); // internal mode: 'taste' | 'cocktail' | 'sauce'
  const [centerIngredient, setCenterIngredient] = useState(initialIngredient || null);
  const [recipeIngredients, setRecipeIngredients] = useState(
    initialIngredient ? [initialIngredient] : []
  );
  const [recipeTitle, setRecipeTitle] = useState('');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [showImport, setShowImport] = useState(false);

  // Reset structure selection when switching lab modes
  useEffect(() => {
    setSelectedStructure(null);
  }, [labMode]);
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
    if (name === centerIngredient) return;
    if (recipeIngredients.includes(name)) return;
    setRecipeIngredients(prev => [...prev, name]);
  }, [centerIngredient, recipeIngredients]);

  const handleRemoveIngredient = useCallback((name) => {
    setRecipeIngredients(prev => prev.filter(n => n !== name));
    if (name === centerIngredient) {
      setRecipeIngredients(prev => {
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

  // Import: add extracted ingredients to the current recipe
  const handleImportIngredients = useCallback((names) => {
    for (const name of names) {
      if (!centerIngredient && names.indexOf(name) === 0) {
        setCenterIngredient(name);
      }
      setRecipeIngredients(prev =>
        prev.includes(name) ? prev : [...prev, name]
      );
    }
    setShowImport(false);
  }, [centerIngredient]);

  // Panel width for layout calculation
  const panelWidth = 280;
  const canvasWidth = isMobile ? size.width : Math.max(300, size.width - panelWidth);

  return (
    <div className={`fixed inset-0 pt-10 flex ${isMobile ? 'flex-col' : ''}`} style={{ backgroundColor: '#fefae0' }}>
      {/* Mode tabs — top bar */}
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
        <button
          onClick={() => setShowImport(true)}
          className="px-2 py-1 text-xs rounded-md border border-[#c9b99a] text-[#7a6a4a] hover:bg-[#e8dcc0] transition-colors flex items-center gap-1"
          style={{ fontFamily: FONT_FAMILY }}
          title="Import recipe from URL or text"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
          </svg>
          Import
        </button>
      </div>

      {/* Structure selector — top left, only for cocktail/sauce modes */}
      {(labMode === 'cocktail' || labMode === 'sauce') && (
        <div className="absolute top-12 left-3 z-20">
          <StructureSelector
            mode={labMode}
            selected={selectedStructure}
            onSelect={setSelectedStructure}
          />
        </div>
      )}

      {/* Notebook-themed search bar */}
      <div
        ref={searchContainerRef}
        className="absolute top-12 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] sm:w-[340px]"
        style={isMobile ? {} : { width: 340 }}
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
          labMode={labMode}
          selectedStructure={selectedStructure}
        />
      </div>

      {/* Recipe panel sidebar — desktop */}
      {!isMobile && (
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
            labMode={labMode}
            selectedStructure={selectedStructure}
          />
        </div>
      )}

      {/* Recipe panel — mobile bottom sheet */}
      {isMobile && recipeIngredients.length > 0 && (
        <div
          className="flex-shrink-0 border-t-2 border-[#d8cca8] overflow-y-auto"
          style={{ maxHeight: '40vh', backgroundColor: '#fef9e0' }}
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
            labMode={labMode}
            selectedStructure={selectedStructure}
          />
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          ingredientList={fullData?.graph?.ingredientList || []}
          onImport={handleImportIngredients}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

function ImportModal({ ingredientList, onImport, onClose }) {
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [extracted, setExtracted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scraped, setScraped] = useState(false);

  const parserIndex = useMemo(
    () => buildIngredientIndex(ingredientList || []),
    [ingredientList],
  );

  const handleScrapeUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    try { const parsed = new URL(trimmed); if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(); }
    catch { setError('Please enter a valid URL'); return; }

    setLoading(true);
    setError('');
    setExtracted([]);
    setScraped(false);
    try {
      const data = await scrapeRecipe(trimmed);
      if (data.title) setRecipeName(data.title);
      const matched = (data.ingredients || [])
        .map((ing) => {
          const results = parserIndex.search(ing, { limit: 1 });
          if (results.length > 0 && results[0].score < 0.35) {
            return { name: results[0].item.name, confirmed: true };
          }
          return null;
        })
        .filter(Boolean);
      const seen = new Set();
      const unique = matched.filter((m) => { if (seen.has(m.name)) return false; seen.add(m.name); return true; });
      setExtracted(unique);
      setScraped(true);
      if (unique.length === 0) setError('No known ingredients found. Try pasting the ingredient list instead.');
    } catch {
      setError('Could not fetch recipe. Try pasting the text directly.');
    } finally {
      setLoading(false);
    }
  }, [url, parserIndex]);

  const handleParseText = useCallback(() => {
    if (!pasteText.trim()) return;
    setError('');
    const found = parseIngredients(pasteText, parserIndex);
    const items = found.map((name) => ({ name, confirmed: true }));
    setExtracted(items);
    setScraped(true);
    if (items.length === 0) setError('No known ingredients matched. Try a longer list.');
  }, [pasteText, parserIndex]);

  const toggleIngredient = useCallback((name) => {
    setExtracted((prev) =>
      prev.map((item) => item.name === name ? { ...item, confirmed: !item.confirmed } : item)
    );
  }, []);

  const confirmed = useMemo(() => extracted.filter(i => i.confirmed).map(i => i.name), [extracted]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[420px] max-h-[75vh] bg-[#fefae0] border-2 border-[#c9b99a] rounded-lg flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#d8cca8]">
          <h2 className="text-lg font-medium" style={{ fontFamily: 'Caveat, cursive', color: '#5a4a2a' }}>
            Import Recipe
          </h2>
          <button onClick={onClose} className="text-[#a09070] hover:text-[#5a4a2a] text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!scraped && (
            <>
              <div className="flex border-b-2 border-[#d8cca8]">
                <button
                  onClick={() => { setMode('url'); setError(''); }}
                  className={`flex-1 py-1.5 text-sm transition-colors ${
                    mode === 'url' ? 'text-[#5a4a2a] border-b-2 border-[#8a7a5a]' : 'text-[#a09070]'
                  }`}
                  style={{ fontFamily: 'Caveat, cursive' }}
                >
                  Paste URL
                </button>
                <button
                  onClick={() => { setMode('paste'); setError(''); }}
                  className={`flex-1 py-1.5 text-sm transition-colors ${
                    mode === 'paste' ? 'text-[#5a4a2a] border-b-2 border-[#8a7a5a]' : 'text-[#a09070]'
                  }`}
                  style={{ fontFamily: 'Caveat, cursive' }}
                >
                  Paste Text
                </button>
              </div>

              {mode === 'url' && (
                <div>
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://www.allrecipes.com/recipe/..."
                    className="w-full text-sm bg-white/60 border-2 border-[#c9b99a] rounded-lg px-3 py-2 focus:outline-none focus:border-[#8a7a5a] placeholder-[#b8a88a]"
                    style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}
                    onKeyDown={e => e.key === 'Enter' && handleScrapeUrl()}
                  />
                  <button
                    onClick={handleScrapeUrl}
                    disabled={!url.trim() || loading}
                    className="mt-2 w-full text-sm bg-[#e8dcc0] hover:bg-[#d8cca8] disabled:opacity-40 rounded-lg py-2 transition-colors"
                    style={{ fontFamily: 'Caveat, cursive', color: '#5a4a2a' }}
                  >
                    {loading ? 'Fetching...' : 'Extract Ingredients'}
                  </button>
                </div>
              )}

              {mode === 'paste' && (
                <div>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={"Paste ingredient list...\n2 cups flour\n3 cloves garlic\n1 tbsp olive oil"}
                    rows={5}
                    className="w-full text-sm bg-white/60 border-2 border-[#c9b99a] rounded-lg px-3 py-2 focus:outline-none focus:border-[#8a7a5a] placeholder-[#b8a88a] resize-none"
                    style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}
                  />
                  <button
                    onClick={handleParseText}
                    disabled={!pasteText.trim()}
                    className="mt-1.5 w-full text-sm bg-[#e8dcc0] hover:bg-[#d8cca8] disabled:opacity-40 rounded-lg py-2 transition-colors"
                    style={{ fontFamily: 'Caveat, cursive', color: '#5a4a2a' }}
                  >
                    Extract Ingredients
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-sm bg-[#f5e6c8] border border-[#c9a96a] rounded-lg px-3 py-2" style={{ fontFamily: 'Caveat, cursive', color: '#8a6a2a' }}>
              {error}
            </div>
          )}

          {scraped && extracted.length > 0 && (
            <div className="space-y-2">
              <div className="bg-white/40 border-2 border-[#c9b99a] rounded-lg max-h-48 overflow-y-auto">
                {extracted.map(item => (
                  <button
                    key={item.name}
                    onClick={() => toggleIngredient(item.name)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm border-b border-[#e8dcc0] last:border-b-0 transition-colors ${
                      item.confirmed ? 'text-[#3a3428]' : 'text-[#b8a88a] line-through'
                    }`}
                    style={{ fontFamily: 'Caveat, cursive' }}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      item.confirmed ? 'border-[#7a6a4a] bg-[#e8dcc0]' : 'border-[#c9b99a]'
                    }`}>
                      {item.confirmed && (
                        <svg className="w-3 h-3 text-[#5a4a2a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {item.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setScraped(false); setExtracted([]); setError(''); }}
                className="text-xs text-[#a09070] hover:text-[#7a6a4a] transition-colors"
                style={{ fontFamily: 'Caveat, cursive' }}
              >
                Start over
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t-2 border-[#d8cca8]">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 text-[#a09070] hover:text-[#5a4a2a] transition-colors"
            style={{ fontFamily: 'Caveat, cursive' }}
          >
            Cancel
          </button>
          {scraped && (
            <button
              onClick={() => onImport(confirmed)}
              disabled={confirmed.length === 0}
              className="text-sm bg-[#d8cca8] hover:bg-[#c9b99a] disabled:opacity-40 rounded-lg px-4 py-1.5 transition-colors"
              style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}
            >
              Add {confirmed.length} to Recipe
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
