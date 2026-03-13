import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import SauceBuilder from './SauceBuilder.jsx';
import { computeCompatibility, detectSauceTemplate, suggestNextIngredients, SAUCE_TEMPLATES } from '../data/sauceScoring.js';

/**
 * Resolve sauce ingredient names to network node names.
 * Strips modifiers so "fresh basil" → "basil", "dried red chili" → "chili", etc.
 */
const INGREDIENT_MODIFIERS = /^(fresh|dried|ground|whole|crushed|chopped|minced|sliced|diced|roasted|toasted|smoked|blanched|raw|unsalted|salted|dark|light|sweet|hot|mild|extra|pure|virgin|cold-pressed|clarified)\s+/i;

function resolveIngredientNames(ingredients, sauceNodes) {
  const names = new Set();
  for (const ing of ingredients) {
    const name = (typeof ing === 'string' ? ing : ing.name).toLowerCase().trim();
    names.add(name);

    if (!sauceNodes) continue;
    if (sauceNodes.has(name)) continue;

    // Strip modifiers: "fresh basil" → "basil"
    let stripped = name;
    let changed = true;
    while (changed) {
      const next = stripped.replace(INGREDIENT_MODIFIERS, '');
      changed = next !== stripped;
      stripped = next;
    }
    if (stripped !== name && sauceNodes.has(stripped)) {
      names.add(stripped);
      continue;
    }

    // Check if any known node is contained in this name
    for (const nodeName of sauceNodes.keys()) {
      if (nodeName.length >= 3 && name.includes(nodeName)) {
        names.add(nodeName);
        break;
      }
    }
  }
  return Array.from(names);
}

// TheMealDB API for supplementary sauce lookup
const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

function normalizeMeal(raw) {
  if (!raw) return null;
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = raw[`strIngredient${i}`];
    const measure = raw[`strMeasure${i}`];
    if (name && name.trim()) {
      ingredients.push({ name: name.trim().toLowerCase(), measure: measure ? measure.trim() : '' });
    }
  }
  return {
    id: raw.idMeal,
    name: raw.strMeal || 'Unknown',
    image: raw.strMealThumb || null,
    category: raw.strCategory || null,
    cuisine: raw.strArea || null,
    instructions: raw.strInstructions || '',
    ingredients,
  };
}

/**
 * SaucePanel — Right-side panel in Sauce Lab with tabs:
 *   Browse: Curated sauce recipes organized by mother sauce family
 *   Builder: Build sauces with ingredient selection
 *   Lookup: Search TheMealDB for additional recipes
 */
export default function SaucePanel({
  isOpen,
  onClose,
  sauceNodes,
  sauceEdges,
  ingredientList,
  onHighlightIngredients,
  builderIngredients = [],
  onBuilderAdd,
  onBuilderRemove,
  onBuilderClear,
  userProfile,
  curatedSauces = [],
}) {
  const [tab, setTab] = useState('browse');
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [browseFilter, setBrowseFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lookupTypeFilter, setLookupTypeFilter] = useState('');

  // Builder scoring
  const compatibilityScore = useMemo(() => {
    return computeCompatibility(builderIngredients, sauceEdges);
  }, [builderIngredients, sauceEdges]);

  const sauceTemplate = useMemo(() => {
    return detectSauceTemplate(builderIngredients, sauceNodes);
  }, [builderIngredients, sauceNodes]);

  const suggestions = useMemo(() => {
    return suggestNextIngredients(builderIngredients, sauceNodes, sauceEdges);
  }, [builderIngredients, sauceNodes, sauceEdges]);

  // Group curated sauces by mother sauce
  const saucesByFamily = useMemo(() => {
    const groups = {};
    for (const sauce of curatedSauces) {
      const family = sauce.motherSauce || 'Other';
      if (!groups[family]) groups[family] = [];
      groups[family].push(sauce);
    }
    return groups;
  }, [curatedSauces]);

  const familyNames = useMemo(() => Object.keys(saucesByFamily), [saucesByFamily]);

  // Sauces matching the selected type in the lookup tab
  const lookupTypeSauces = useMemo(() => {
    if (!lookupTypeFilter) return [];
    return curatedSauces.filter(s => s.motherSauce === lookupTypeFilter);
  }, [lookupTypeFilter, curatedSauces]);

  const filteredSauces = useMemo(() => {
    if (!browseFilter) return curatedSauces;
    return saucesByFamily[browseFilter] || [];
  }, [browseFilter, curatedSauces, saucesByFamily]);

  const handleSelectSauce = useCallback((sauce) => {
    setSelectedSauce(sauce);
    if (onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(sauce.ingredients, sauceNodes));
    }
  }, [onHighlightIngredients, sauceNodes]);

  const handleBack = useCallback(() => {
    setSelectedSauce(null);
    if (onHighlightIngredients) onHighlightIngredients(null);
  }, [onHighlightIngredients]);

  const handleLoadIntoBuilder = useCallback((sauce) => {
    onBuilderClear?.();
    const resolved = resolveIngredientNames(sauce.ingredients, sauceNodes);
    for (const name of resolved) {
      if (sauceNodes?.has(name)) {
        onBuilderAdd?.(name);
      }
    }
    setTab('builder');
  }, [onBuilderClear, onBuilderAdd, sauceNodes]);

  // TheMealDB search
  const handleMealSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`${MEALDB_BASE}/search.php?s=${encodeURIComponent(searchQuery.trim())}`);
      const json = await res.json();
      const meals = (json.meals || []).map(normalizeMeal).filter(Boolean);
      setSearchResults(meals);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }, [searchQuery]);

  const handleSelectMeal = useCallback((meal) => {
    setSelectedSauce({
      name: meal.name,
      motherSauce: 'Lookup',
      cuisine: meal.cuisine || '',
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      pairsWith: [],
      image: meal.image,
    });
    if (onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(meal.ingredients, sauceNodes));
    }
  }, [onHighlightIngredients, sauceNodes]);

  const handleSaveFromBuilder = useCallback((name) => {
    if (!userProfile || !builderIngredients.length) return;
    userProfile.addSauce?.({
      name: name || 'My Sauce',
      ingredients: builderIngredients.map(n => ({ name: n, quantity: '', unit: 'tbsp' })),
      template: sauceTemplate?.name || null,
    });
  }, [userProfile, builderIngredients, sauceTemplate]);

  const tabs = [
    { key: 'browse', label: 'Recipes' },
    { key: 'builder', label: 'Builder' },
    { key: 'lookup', label: 'Lookup' },
  ];

  return (
    <div className={`fixed top-14 right-0 bottom-4 z-40 flex items-stretch select-none ${isOpen ? '' : 'pointer-events-none'}`}>
      <div className={`w-80 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide">Sauce Lab</h2>
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
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'browse' && (
            <div className="p-3 space-y-3">
              {/* Back button if viewing a sauce */}
              {selectedSauce && (
                <button
                  onClick={handleBack}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors mb-1 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to recipes
                </button>
              )}

              {/* Sauce detail */}
              {selectedSauce && (
                <div className="space-y-2.5">
                  <div className="flex gap-2.5">
                    {selectedSauce.image && (
                      <img src={selectedSauce.image} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-gray-200 leading-tight">{selectedSauce.name}</h3>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {selectedSauce.motherSauce && selectedSauce.motherSauce !== 'Lookup' && (
                          <span className="text-[8px] text-amber-400/80 bg-amber-500/10 rounded px-1.5 py-0.5">
                            {selectedSauce.motherSauce}
                          </span>
                        )}
                        {selectedSauce.cuisine && (
                          <span className="text-[8px] text-gray-500 bg-gray-500/10 rounded px-1.5 py-0.5">
                            {selectedSauce.cuisine}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Ingredients</p>
                    <div className="space-y-0.5">
                      {selectedSauce.ingredients.map((ing, idx) => (
                        <div key={`${ing.name}-${idx}`} className="flex items-center justify-between px-2 py-1 text-[11px] text-gray-300 hover:bg-[#1a1a2e] rounded">
                          <span className="truncate">{ing.name}</span>
                          <span className="text-[9px] text-gray-600 flex-shrink-0 ml-2">{ing.measure || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  {selectedSauce.instructions && (
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Technique</p>
                      <p className="text-[10px] text-gray-400 leading-relaxed">{selectedSauce.instructions}</p>
                    </div>
                  )}

                  {/* Pairs with */}
                  {selectedSauce.pairsWith && selectedSauce.pairsWith.length > 0 && (
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Pairs With</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedSauce.pairsWith.map(item => (
                          <span key={item} className="text-[9px] text-gray-400 bg-[#1a1a2e] rounded px-1.5 py-0.5">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Load into builder */}
                  <button
                    onClick={() => handleLoadIntoBuilder(selectedSauce)}
                    className="w-full text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded py-1.5 transition-colors"
                  >
                    Load into Builder
                  </button>
                </div>
              )}

              {/* Browse list */}
              {!selectedSauce && (
                <>
                  {/* Family filter */}
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setBrowseFilter('')}
                      className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                        !browseFilter ? 'text-amber-300 bg-amber-500/15' : 'text-gray-500 hover:text-gray-300 bg-[#1a1a2e]'
                      }`}
                    >
                      All ({curatedSauces.length})
                    </button>
                    {familyNames.map(family => (
                      <button
                        key={family}
                        onClick={() => setBrowseFilter(family)}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                          browseFilter === family ? 'text-amber-300 bg-amber-500/15' : 'text-gray-500 hover:text-gray-300 bg-[#1a1a2e]'
                        }`}
                      >
                        {family} ({saucesByFamily[family].length})
                      </button>
                    ))}
                  </div>

                  {/* Sauce list */}
                  <div className="space-y-1">
                    {filteredSauces.map((sauce, idx) => (
                      <button
                        key={`${sauce.name}-${idx}`}
                        onClick={() => handleSelectSauce(sauce)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-200 truncate">{sauce.name}</p>
                          <div className="flex gap-1 mt-0.5">
                            <span className="text-[8px] text-amber-400/60">{sauce.motherSauce}</span>
                            {sauce.cuisine && (
                              <span className="text-[8px] text-gray-600">· {sauce.cuisine}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[9px] text-gray-600 flex-shrink-0">
                          {sauce.ingredients.length} ing.
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'builder' && (
            <SauceBuilder
              sauceNodes={sauceNodes}
              sauceEdges={sauceEdges}
              ingredientList={ingredientList}
              onAddIngredient={onBuilderAdd}
              onRemoveIngredient={onBuilderRemove}
              onClearIngredients={onBuilderClear}
              builderIngredients={builderIngredients}
              sauceTemplate={sauceTemplate}
              compatibilityScore={compatibilityScore}
              suggestions={suggestions}
              onSave={handleSaveFromBuilder}
            />
          )}

          {tab === 'lookup' && (
            <div className="p-3 space-y-3">
              <p className="text-[9px] text-gray-600">Search TheMealDB for sauce-related recipes</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMealSearch()}
                  placeholder="Search recipes..."
                  className="flex-1 text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-600"
                />
                <button
                  onClick={handleMealSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="text-[10px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 rounded px-2 py-1 transition-colors"
                >
                  {searchLoading ? '...' : 'Go'}
                </button>
              </div>

              {/* Sauce type selector — shows filtered recipes inline */}
              {!selectedSauce && (
                <div>
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Browse by Type</p>
                  <div className="flex flex-wrap gap-1">
                    {familyNames.map(family => (
                      <button
                        key={family}
                        onClick={() => setLookupTypeFilter(prev => prev === family ? '' : family)}
                        className={`text-[9px] px-1.5 py-1 rounded border transition-all ${
                          lookupTypeFilter === family
                            ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
                            : 'text-gray-400 hover:text-amber-300 bg-[#1a1a2e] hover:bg-amber-500/10 border-[#2a2a3e] hover:border-amber-500/20'
                        }`}
                      >
                        {family}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type-filtered recipe list */}
              {!selectedSauce && lookupTypeFilter && lookupTypeSauces.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider">
                    {lookupTypeFilter} ({lookupTypeSauces.length})
                  </p>
                  {lookupTypeSauces.map((sauce, idx) => (
                    <button
                      key={`${sauce.name}-${idx}`}
                      onClick={() => handleSelectSauce(sauce)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-200 truncate">{sauce.name}</p>
                        {sauce.cuisine && (
                          <span className="text-[8px] text-gray-600">{sauce.cuisine}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-600 flex-shrink-0">
                        {sauce.ingredients.length} ing.
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected sauce/meal detail */}
              {selectedSauce && (
                <>
                  <button
                    onClick={handleBack}
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <div className="space-y-2.5">
                    <div className="flex gap-2.5">
                      {selectedSauce.image && (
                        <img src={selectedSauce.image} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-gray-200 leading-tight">{selectedSauce.name}</h3>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {selectedSauce.motherSauce && selectedSauce.motherSauce !== 'Lookup' && (
                            <span className="text-[8px] text-amber-400/80 bg-amber-500/10 rounded px-1.5 py-0.5">
                              {selectedSauce.motherSauce}
                            </span>
                          )}
                          {selectedSauce.cuisine && (
                            <span className="text-[8px] text-gray-500 bg-gray-500/10 rounded px-1.5 py-0.5">
                              {selectedSauce.cuisine}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Ingredients</p>
                      {selectedSauce.ingredients.map((ing, idx) => (
                        <div key={idx} className="flex justify-between px-2 py-0.5 text-[11px] text-gray-300">
                          <span>{ing.name}</span>
                          <span className="text-gray-600">{ing.measure}</span>
                        </div>
                      ))}
                    </div>
                    {selectedSauce.instructions && (
                      <div>
                        <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Technique</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed">{selectedSauce.instructions}</p>
                      </div>
                    )}
                    {selectedSauce.pairsWith && selectedSauce.pairsWith.length > 0 && (
                      <div>
                        <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Pairs With</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedSauce.pairsWith.map(item => (
                            <span key={item} className="text-[9px] text-gray-400 bg-[#1a1a2e] rounded px-1.5 py-0.5">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => handleLoadIntoBuilder(selectedSauce)}
                      className="w-full text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded py-1.5 transition-colors"
                    >
                      Load into Builder
                    </button>
                  </div>
                </>
              )}

              {/* Search results */}
              {!selectedSauce && searchResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  {searchResults.map(meal => (
                    <button
                      key={meal.id}
                      onClick={() => handleSelectMeal(meal)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all text-left"
                    >
                      {meal.image && (
                        <img src={`${meal.image}/preview`} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-gray-200 truncate">{meal.name}</p>
                        {meal.cuisine && <p className="text-[9px] text-gray-600">{meal.cuisine}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!selectedSauce && searchResults.length === 0 && !searchLoading && searchQuery.trim() && (
                <p className="text-[10px] text-gray-600 text-center py-4">No results found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
