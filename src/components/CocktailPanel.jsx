import { useState, useCallback, useMemo } from 'react';
import useCocktailDB from '../hooks/useCocktailDB.js';
import CocktailRecipeCard from './CocktailRecipeCard.jsx';
import CocktailBuilder from './CocktailBuilder.jsx';
import { computeCompatibility, detectCodexTemplate, suggestNextIngredients } from '../data/cocktailScoring.js';

/**
 * CocktailPanel — Right-side panel in Cocktail Lab with tabs:
 *   Lookup: Search cocktails from TheCocktailDB
 *   Builder: (future) Build cocktails with ingredient selection
 *   My Cocktails: (future) Saved creations
 */
export default function CocktailPanel({
  isOpen,
  onClose,
  cocktailNodes,
  cocktailEdges,
  ingredientList,
  onHighlightIngredients,
  onSelectAlternative,
  builderIngredients = [],
  onBuilderAdd,
  onBuilderRemove,
  onBuilderClear,
}) {
  const [tab, setTab] = useState('lookup');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCocktail, setSelectedCocktail] = useState(null);
  const [swapIngredient, setSwapIngredient] = useState(null);
  const [previewAlt, setPreviewAlt] = useState(null);
  const cocktailDB = useCocktailDB();

  // Builder scoring
  const compatibilityScore = useMemo(() => {
    return computeCompatibility(builderIngredients, cocktailEdges);
  }, [builderIngredients, cocktailEdges]);

  const codexTemplate = useMemo(() => {
    return detectCodexTemplate(builderIngredients, cocktailNodes);
  }, [builderIngredients, cocktailNodes]);

  const suggestions = useMemo(() => {
    return suggestNextIngredients(builderIngredients, cocktailNodes, cocktailEdges);
  }, [builderIngredients, cocktailNodes, cocktailEdges]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const results = await cocktailDB.searchByName(searchQuery.trim());
    setSearchResults(results);
    setSelectedCocktail(null);
    setSwapIngredient(null);
  }, [searchQuery, cocktailDB]);

  const handleSelectCocktail = useCallback(async (cocktail) => {
    // If it's a full cocktail (from search), use directly
    if (cocktail.ingredients && cocktail.ingredients.length > 0) {
      setSelectedCocktail(cocktail);
      setSwapIngredient(null);
      // Highlight ingredients on the network
      if (onHighlightIngredients) {
        const names = cocktail.ingredients.map(i => i.name);
        onHighlightIngredients(names);
      }
    } else if (cocktail.id) {
      // Filter result — need to fetch full details
      const full = await cocktailDB.getById(cocktail.id);
      if (full) {
        setSelectedCocktail(full);
        setSwapIngredient(null);
        if (onHighlightIngredients) {
          const names = full.ingredients.map(i => i.name);
          onHighlightIngredients(names);
        }
      }
    }
  }, [cocktailDB, onHighlightIngredients]);

  const handleRandom = useCallback(async () => {
    const cocktail = await cocktailDB.getRandom();
    if (cocktail) {
      setSelectedCocktail(cocktail);
      setSearchResults([]);
      setSwapIngredient(null);
      if (onHighlightIngredients) {
        const names = cocktail.ingredients.map(i => i.name);
        onHighlightIngredients(names);
      }
    }
  }, [cocktailDB, onHighlightIngredients]);

  const handleBack = useCallback(() => {
    setSelectedCocktail(null);
    setSwapIngredient(null);
    if (onHighlightIngredients) onHighlightIngredients(null);
  }, [onHighlightIngredients]);

  const handleSwapIngredient = useCallback((ingredientName) => {
    setSwapIngredient(ingredientName);
    setPreviewAlt(null);
  }, []);

  const handleCancelSwap = useCallback(() => {
    setSwapIngredient(null);
    setPreviewAlt(null);
    // Re-highlight the cocktail ingredients
    if (selectedCocktail && onHighlightIngredients) {
      onHighlightIngredients(selectedCocktail.ingredients.map(i => i.name));
    }
  }, [selectedCocktail, onHighlightIngredients]);

  // Compute alternatives for swapped ingredient
  const alternatives = useMemo(() => {
    if (!swapIngredient || !cocktailNodes || !cocktailEdges || !selectedCocktail) return [];

    const otherIngredients = selectedCocktail.ingredients
      .map(i => i.name)
      .filter(n => n !== swapIngredient);

    // Find all neighbors of the swap target
    const neighborMap = new Map();
    for (const edge of cocktailEdges) {
      if (edge.source === swapIngredient && !otherIngredients.includes(edge.target) && edge.target !== swapIngredient) {
        neighborMap.set(edge.target, (neighborMap.get(edge.target) || 0) + edge.strength);
      }
      if (edge.target === swapIngredient && !otherIngredients.includes(edge.source) && edge.source !== swapIngredient) {
        neighborMap.set(edge.source, (neighborMap.get(edge.source) || 0) + edge.strength);
      }
    }

    // Score each alternative by average pairing with remaining cocktail ingredients
    const scored = [];
    for (const [altName, directStrength] of neighborMap) {
      if (!cocktailNodes.has(altName)) continue;

      let totalStrength = directStrength;
      let pairCount = 1;

      for (const other of otherIngredients) {
        for (const edge of cocktailEdges) {
          if ((edge.source === altName && edge.target === other) ||
              (edge.target === altName && edge.source === other)) {
            totalStrength += edge.strength;
            pairCount++;
          }
        }
      }

      const avgStrength = totalStrength / Math.max(1, pairCount);
      const node = cocktailNodes.get(altName);
      scored.push({
        name: altName,
        score: Math.round(avgStrength * 10 * 10) / 10, // 0-10 scale, 1 decimal
        category: node?.cocktailCategory || 'Other',
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 15);
  }, [swapIngredient, cocktailNodes, cocktailEdges, selectedCocktail]);

  // When swap mode is active, preview alternative on network
  const handleSelectAlt = useCallback((altName) => {
    const alt = alternatives.find(a => a.name === altName);
    setPreviewAlt(alt || { name: altName, score: 0, category: '' });
    // Highlight the alternative + remaining ingredients on the network
    if (onSelectAlternative) {
      onSelectAlternative(swapIngredient, altName, selectedCocktail);
    }
  }, [swapIngredient, selectedCocktail, onSelectAlternative, alternatives]);

  // Accept the previewed swap — replace ingredient in working cocktail
  const handleAcceptSwap = useCallback(() => {
    if (!previewAlt || !swapIngredient || !selectedCocktail) return;
    const updated = {
      ...selectedCocktail,
      ingredients: selectedCocktail.ingredients.map(ing =>
        ing.name === swapIngredient
          ? { ...ing, name: previewAlt.name, measure: ing.measure }
          : ing
      ),
    };
    setSelectedCocktail(updated);
    setSwapIngredient(null);
    setPreviewAlt(null);
    // Re-highlight with updated ingredients
    if (onHighlightIngredients) {
      onHighlightIngredients(updated.ingredients.map(i => i.name));
    }
  }, [previewAlt, swapIngredient, selectedCocktail, onHighlightIngredients]);

  const tabs = [
    { key: 'lookup', label: 'Lookup' },
    { key: 'builder', label: 'Builder' },
    { key: 'saved', label: 'My Cocktails' },
  ];

  return (
    <div className={`fixed top-14 right-0 bottom-4 z-40 flex items-stretch select-none ${isOpen ? '' : 'pointer-events-none'}`}>
      <div className={`w-80 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide">Cocktail Lab</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e1e2e]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-1.5 text-[10px] transition-colors ${
                tab === t.key
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'lookup' && (
            <div className="p-3 space-y-3">
              {/* Search */}
              <div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search cocktails..."
                    className="flex-1 text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-gray-600"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={cocktailDB.loading || !searchQuery.trim()}
                    className="text-[10px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-30 rounded px-2 py-1 transition-colors"
                  >
                    {cocktailDB.loading ? '...' : 'Go'}
                  </button>
                </div>
                <button
                  onClick={handleRandom}
                  disabled={cocktailDB.loading}
                  className="mt-1.5 w-full text-[10px] text-gray-500 hover:text-purple-300 transition-colors py-1"
                >
                  Or try a random cocktail
                </button>
              </div>

              {cocktailDB.error && (
                <p className="text-[10px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded px-2 py-1.5">
                  {cocktailDB.error}
                </p>
              )}

              {/* Selected cocktail detail */}
              {selectedCocktail && (
                <div>
                  <button
                    onClick={handleBack}
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors mb-2 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to results
                  </button>
                  <CocktailRecipeCard
                    cocktail={selectedCocktail}
                    onSwapIngredient={handleSwapIngredient}
                    swapIngredient={swapIngredient}
                    alternatives={alternatives}
                    onSelectAlternative={handleSelectAlt}
                    onCancelSwap={handleCancelSwap}
                    previewAlt={previewAlt}
                    onAcceptSwap={handleAcceptSwap}
                  />
                </div>
              )}

              {/* Search results list */}
              {!selectedCocktail && searchResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  {searchResults.map(cocktail => (
                    <button
                      key={cocktail.id}
                      onClick={() => handleSelectCocktail(cocktail)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all text-left"
                    >
                      {cocktail.image && (
                        <img
                          src={`${cocktail.image}/preview`}
                          alt=""
                          className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-gray-200 truncate">{cocktail.name}</p>
                        {cocktail.glass && (
                          <p className="text-[9px] text-gray-600">{cocktail.glass}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!selectedCocktail && searchResults.length === 0 && !cocktailDB.loading && searchQuery.trim() && (
                <p className="text-[10px] text-gray-600 text-center py-4">
                  No cocktails found. Try a different search.
                </p>
              )}
            </div>
          )}

          {tab === 'builder' && (
            <CocktailBuilder
              cocktailNodes={cocktailNodes}
              cocktailEdges={cocktailEdges}
              ingredientList={ingredientList}
              selectedNodes={builderIngredients}
              onAddIngredient={onBuilderAdd}
              onRemoveIngredient={onBuilderRemove}
              onClearIngredients={onBuilderClear}
              builderIngredients={builderIngredients}
              codexTemplate={codexTemplate}
              compatibilityScore={compatibilityScore}
              suggestions={suggestions}
            />
          )}

          {tab === 'saved' && (
            <div className="p-3 flex items-center justify-center h-48">
              <p className="text-[10px] text-gray-600 text-center">
                Saved cocktails coming soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
