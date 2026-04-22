import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import useCocktailDB from '../hooks/useCocktailDB.js';
import CocktailRecipeCard from './CocktailRecipeCard.jsx';
import CocktailBuilder from './CocktailBuilder.jsx';
import CocktailCard from './CocktailCard.jsx';
import { computeCompatibility, detectCodexTemplate, suggestNextIngredients, CODEX_TEMPLATES } from '../data/cocktailScoring.js';
import { INGREDIENT_MODIFIERS } from '../data/cocktailData.js';

/**
 * Resolve cocktail ingredient names to network node names.
 * Handles modifiers so that "light rum" highlights "rum", "lime juice" highlights "lime", etc.
 * Returns a deduplicated array of names.
 */

function resolveIngredientNames(ingredients, cocktailNodes) {
  const names = new Set();
  for (const ing of ingredients) {
    const name = (typeof ing === 'string' ? ing : ing.name).toLowerCase().trim();
    names.add(name);

    if (!cocktailNodes) continue;

    // If already a known node, no need to resolve further
    if (cocktailNodes.has(name)) continue;

    // "X juice" → also add "X" if it's a known node
    const juiceMatch = name.match(/^(.+?)\s+juice$/i);
    if (juiceMatch) {
      const fruit = juiceMatch[1].toLowerCase().trim();
      if (cocktailNodes.has(fruit)) {
        names.add(fruit);
        continue;
      }
    }

    // Strip modifier words: "light rum" → "rum", "spiced rum" → "rum", etc.
    let stripped = name;
    let changed = true;
    while (changed) {
      const next = stripped.replace(INGREDIENT_MODIFIERS, '');
      changed = next !== stripped;
      stripped = next;
    }
    if (stripped !== name && cocktailNodes.has(stripped)) {
      names.add(stripped);
      continue;
    }

    // Try checking if any known node name is contained in this name
    // e.g., "kahlua coffee liqueur" → "kahlua"
    for (const nodeName of cocktailNodes.keys()) {
      if (nodeName.length >= 3 && name.includes(nodeName)) {
        names.add(nodeName);
        break;
      }
    }
  }
  return Array.from(names);
}

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
  adjacencyMap,
  ingredientList,
  onHighlightIngredients,
  onSelectAlternative,
  builderIngredients = [],
  onBuilderAdd,
  onBuilderRemove,
  onBuilderClear,
  userProfile,
  bridgeCompounds,
}) {
  const [tab, setTab] = useState('lookup');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCocktail, setSelectedCocktail] = useState(null);
  const [swapIngredient, setSwapIngredient] = useState(null);
  const [previewAlt, setPreviewAlt] = useState(null);
  const cocktailDB = useCocktailDB();

  // Existing cocktail match lookup — debounced when builder ingredients change
  const [matchingCocktails, setMatchingCocktails] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const matchTimerRef = useRef(null);

  useEffect(() => {
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);

    if (builderIngredients.length < 2) {
      setMatchingCocktails([]);
      return;
    }

    setMatchLoading(true);
    matchTimerRef.current = setTimeout(async () => {
      try {
        const matches = await cocktailDB.findByIngredients(builderIngredients);
        setMatchingCocktails(matches);
      } catch {
        setMatchingCocktails([]);
      }
      setMatchLoading(false);
    }, 600); // debounce 600ms

    return () => {
      if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    };
  }, [builderIngredients, cocktailDB]);

  // Builder scoring
  const compatibilityScore = useMemo(() => {
    return computeCompatibility(builderIngredients, cocktailEdges, adjacencyMap);
  }, [builderIngredients, cocktailEdges, adjacencyMap]);

  const codexTemplate = useMemo(() => {
    return detectCodexTemplate(builderIngredients, cocktailNodes);
  }, [builderIngredients, cocktailNodes]);

  const suggestions = useMemo(() => {
    return suggestNextIngredients(builderIngredients, cocktailNodes, cocktailEdges, adjacencyMap);
  }, [builderIngredients, cocktailNodes, cocktailEdges, adjacencyMap]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const results = await cocktailDB.searchByName(searchQuery.trim());
    setSearchResults(results);
    setSelectedCocktail(null);
    setSwapIngredient(null);
  }, [searchQuery, cocktailDB]);

  const handleSelectCocktail = useCallback(async (cocktail, switchToLookup = false) => {
    // If it's a full cocktail (from search or match), use directly
    if (cocktail.ingredients && cocktail.ingredients.length > 0) {
      setSelectedCocktail(cocktail);
      setSwapIngredient(null);
      if (switchToLookup) setTab('lookup');
      if (onHighlightIngredients) {
        onHighlightIngredients(resolveIngredientNames(cocktail.ingredients, cocktailNodes));
      }
    } else if (cocktail.id) {
      // Filter result — need to fetch full details
      const full = await cocktailDB.getById(cocktail.id);
      if (full) {
        setSelectedCocktail(full);
        setSwapIngredient(null);
        if (switchToLookup) setTab('lookup');
        if (onHighlightIngredients) {
          onHighlightIngredients(resolveIngredientNames(full.ingredients, cocktailNodes));
        }
      }
    }
  }, [cocktailDB, onHighlightIngredients, cocktailNodes]);

  const handleRandom = useCallback(async () => {
    const cocktail = await cocktailDB.getRandom();
    if (cocktail) {
      setSelectedCocktail(cocktail);
      setSearchResults([]);
      setSwapIngredient(null);
      if (onHighlightIngredients) {
        onHighlightIngredients(resolveIngredientNames(cocktail.ingredients, cocktailNodes));
      }
    }
  }, [cocktailDB, onHighlightIngredients, cocktailNodes]);

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
      onHighlightIngredients(resolveIngredientNames(selectedCocktail.ingredients, cocktailNodes));
    }
  }, [selectedCocktail, onHighlightIngredients, cocktailNodes]);

  // Compute alternatives for swapped ingredient
  const alternatives = useMemo(() => {
    if (!swapIngredient || !cocktailNodes || !adjacencyMap || !selectedCocktail) return [];

    const otherIngredients = selectedCocktail.ingredients
      .map(i => i.name)
      .filter(n => n !== swapIngredient);
    const otherSet = new Set(otherIngredients);

    // Find all neighbors of the swap target using adjacency map
    const swapNeighbors = adjacencyMap.get(swapIngredient);
    if (!swapNeighbors) return [];

    const neighborMap = new Map();
    for (const [neighbor, strength] of swapNeighbors) {
      if (neighbor !== swapIngredient && !otherSet.has(neighbor)) {
        neighborMap.set(neighbor, strength);
      }
    }

    // Score each alternative by average pairing with remaining cocktail ingredients
    const scored = [];
    for (const [altName, directStrength] of neighborMap) {
      if (!cocktailNodes.has(altName)) continue;

      let totalStrength = directStrength;
      let pairCount = 1;

      for (const other of otherIngredients) {
        const strength = adjacencyMap.get(altName)?.get(other) || 0;
        if (strength > 0) {
          totalStrength += strength;
          pairCount++;
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
  }, [swapIngredient, cocktailNodes, adjacencyMap, selectedCocktail]);

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
      onHighlightIngredients(resolveIngredientNames(updated.ingredients, cocktailNodes));
    }
  }, [previewAlt, swapIngredient, selectedCocktail, onHighlightIngredients, cocktailNodes]);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [exportCocktail, setExportCocktail] = useState(null);

  const handleSaveFromBuilder = useCallback((name, quantities = {}) => {
    if (!userProfile || !builderIngredients.length) return;
    userProfile.addCocktail({
      name: name || 'My Cocktail',
      ingredients: builderIngredients.map(n => ({
        name: n,
        quantity: quantities[n]?.amount || '',
        unit: quantities[n]?.unit || 'oz',
      })),
      instructions: '',
      template: codexTemplate?.name || null,
      createdAt: Date.now(),
    });
  }, [userProfile, builderIngredients, codexTemplate]);

  const handleLoadCocktail = useCallback((cocktail) => {
    if (onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(cocktail.ingredients, cocktailNodes));
    }
    // Switch to builder tab and load ingredients
    setTab('builder');
    onBuilderClear?.();
    for (const ing of cocktail.ingredients) {
      onBuilderAdd?.(ing.name);
    }
  }, [onHighlightIngredients, onBuilderClear, onBuilderAdd, cocktailNodes]);

  const handleDeleteCocktail = useCallback((id) => {
    if (userProfile) {
      userProfile.removeCocktail(id);
      setConfirmDelete(null);
    }
  }, [userProfile]);

  const tabs = [
    { key: 'lookup', label: 'Lookup' },
    { key: 'builder', label: 'Builder' },
    { key: 'saved', label: `My Cocktails${(userProfile?.profile?.cocktails?.length || 0) > 0 ? ` (${userProfile.profile.cocktails.length})` : ''}` },
  ];

  return (
    <div className={`fixed top-14 right-0 bottom-4 z-40 flex items-stretch select-none ${isOpen ? '' : 'pointer-events-none'}`}>
      <div className={`w-80 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide">Cocktail Lab</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e1e2e]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 min-h-[44px] py-1.5 text-[10px] transition-colors ${
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

              {/* Codex type selector */}
              {!selectedCocktail && (
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Cocktail Codex</p>
                  <div className="flex flex-wrap gap-1">
                    {CODEX_TEMPLATES.map(t => (
                      <button
                        key={t.name}
                        onClick={async () => {
                          setSearchQuery(t.name);
                          const results = await cocktailDB.searchByName(t.name);
                          setSearchResults(results);
                          setSelectedCocktail(null);
                          setSwapIngredient(null);
                        }}
                        className={`text-[9px] px-1.5 py-1 rounded border transition-all ${
                          searchQuery === t.name && searchResults.length > 0
                            ? 'text-purple-300 bg-purple-500/15 border-purple-500/30'
                            : 'text-gray-400 hover:text-purple-300 bg-[#1a1a2e] hover:bg-purple-500/10 border-[#2a2a3e] hover:border-purple-500/20'
                        }`}
                        title={t.description}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                      className="w-full min-h-[44px] flex items-center gap-2.5 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all text-left"
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
              onSave={handleSaveFromBuilder}
              matchingCocktails={matchingCocktails}
              matchLoading={matchLoading}
              onSelectCocktail={handleSelectCocktail}
            />
          )}

          {tab === 'saved' && (
            <div className="p-3 space-y-2">
              {(!userProfile?.profile?.cocktails || userProfile.profile.cocktails.length === 0) ? (
                <div className="flex items-center justify-center h-48">
                  <p className="text-[10px] text-gray-600 text-center">
                    No saved cocktails yet.
                    <br />Use the Builder tab to create and save cocktails.
                  </p>
                </div>
              ) : (
                userProfile.profile.cocktails.map((cocktail) => (
                  <div
                    key={cocktail.id}
                    className="p-2 rounded-lg bg-[#1a1a2e]/50 border border-[#2a2a3e] hover:border-purple-500/20 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs text-gray-200 font-medium truncate">{cocktail.name}</h4>
                      <div className="flex items-center gap-1">
                        {cocktail.template && (
                          <span className="text-[8px] text-purple-400/60 bg-purple-500/10 rounded px-1 py-0.5">
                            {cocktail.template}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-500 mb-1.5">
                      {cocktail.ingredients.map(i =>
                        i.quantity ? `${i.quantity} ${i.unit || 'oz'} ${i.name}` : i.name
                      ).join(' · ')}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleLoadCocktail(cocktail)}
                        className="text-[9px] text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded px-2 py-0.5 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => setExportCocktail(cocktail)}
                        className="text-[9px] text-gray-500 hover:text-purple-300 transition-colors"
                      >
                        Export
                      </button>
                      {confirmDelete === cocktail.id ? (
                        <>
                          <button
                            onClick={() => handleDeleteCocktail(cocktail.id)}
                            className="text-[9px] text-red-400 hover:text-red-300 bg-red-500/10 rounded px-2 py-0.5 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-[9px] text-gray-500 hover:text-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(cocktail.id)}
                          className="text-[9px] text-gray-600 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-[8px] text-gray-700 mt-1">
                      {new Date(cocktail.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Export card modal */}
      {exportCocktail && (
        <CocktailCard
          cocktail={exportCocktail}
          compatibilityScore={computeCompatibility(
            exportCocktail.ingredients.map(i => i.name),
            cocktailEdges
          )}
          codexTemplate={detectCodexTemplate(
            exportCocktail.ingredients.map(i => i.name),
            cocktailNodes
          )}
          onClose={() => setExportCocktail(null)}
        />
      )}
    </div>
  );
}
