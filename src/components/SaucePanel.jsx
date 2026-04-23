import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import SauceBuilder from './SauceBuilder.jsx';
import OdorBadge from './OdorBadge.jsx';
import { computeCompatibility, detectSauceTemplate, suggestNextIngredients, SAUCE_TEMPLATES } from '../data/sauceScoring.js';
import { INGREDIENT_MODIFIERS, MEALDB_BASE } from '../data/sauceData.js';

function resolveIngredientNames(ingredients, sauceNodes) {
  const names = new Set();
  for (const ing of ingredients) {
    const name = (typeof ing === 'string' ? ing : ing.name).toLowerCase().trim();
    names.add(name);

    if (!sauceNodes) continue;
    if (sauceNodes.has(name)) continue;

    // Strip modifiers: "fresh basil" -> "basil"
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


const SAUCE_KEYWORDS = /sauce|gravy|dressing|dip|marinade/i;
function isSauceRelevant(meal) {
  return SAUCE_KEYWORDS.test(meal.name || '');
}

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
 *   My Sauces: Saved user creations
 *   Lookup: Search TheMealDB for additional recipes
 */
export default function SaucePanel({
  isOpen,
  onClose,
  sauceNodes,
  sauceEdges,
  ingredientList,
  onHighlightIngredients,
  onSelectAlternative,
  builderIngredients = [],
  onBuilderAdd,
  onBuilderRemove,
  onBuilderClear,
  userProfile,
  curatedSauces = [],
  adjacencyMap,
  bridgeCompounds,
  onOpenRecipeLab,
}) {
  const [tab, setTab] = useState('browse');
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [browseFilter, setBrowseFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lookupTypeFilter, setLookupTypeFilter] = useState('');

  // Swap state
  const [swapIngredient, setSwapIngredient] = useState(null);
  const [previewAlt, setPreviewAlt] = useState(null);

  // My Sauces state
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Builder scoring
  const compatibilityScore = useMemo(() => {
    return computeCompatibility(builderIngredients, sauceEdges, adjacencyMap);
  }, [builderIngredients, sauceEdges, adjacencyMap]);

  const sauceTemplate = useMemo(() => {
    return detectSauceTemplate(builderIngredients, sauceNodes);
  }, [builderIngredients, sauceNodes]);

  const suggestions = useMemo(() => {
    return suggestNextIngredients(builderIngredients, sauceNodes, sauceEdges, adjacencyMap);
  }, [builderIngredients, sauceNodes, sauceEdges, adjacencyMap]);

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
    setSwapIngredient(null);
    setPreviewAlt(null);
    if (onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(sauce.ingredients, sauceNodes));
    }
  }, [onHighlightIngredients, sauceNodes]);

  const handleBack = useCallback(() => {
    setSelectedSauce(null);
    setSwapIngredient(null);
    setPreviewAlt(null);
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

  // --- Swap functionality ---
  const handleSwapIngredient = useCallback((ingredientName) => {
    setSwapIngredient(ingredientName);
    setPreviewAlt(null);
  }, []);

  const handleCancelSwap = useCallback(() => {
    setSwapIngredient(null);
    setPreviewAlt(null);
    // Re-highlight the sauce ingredients
    if (selectedSauce && onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(selectedSauce.ingredients, sauceNodes));
    }
  }, [selectedSauce, onHighlightIngredients, sauceNodes]);

  // Compute alternatives for swapped ingredient
  const swapAlternatives = useMemo(() => {
    if (!swapIngredient || !sauceNodes || !adjacencyMap || !selectedSauce) return [];

    const swapName = swapIngredient.toLowerCase().trim();
    const otherIngredients = selectedSauce.ingredients
      .map(i => (typeof i === 'string' ? i : i.name).toLowerCase().trim())
      .filter(n => n !== swapName);
    const otherSet = new Set(otherIngredients);

    // Find neighbors of the swap target
    // Try direct name first, then resolved name
    let swapNeighbors = adjacencyMap.get(swapName);
    if (!swapNeighbors) {
      const resolved = resolveIngredientNames([swapName], sauceNodes);
      for (const r of resolved) {
        swapNeighbors = adjacencyMap.get(r);
        if (swapNeighbors) break;
      }
    }
    if (!swapNeighbors) return [];

    const neighborMap = new Map();
    for (const [neighbor, strength] of swapNeighbors) {
      if (neighbor !== swapName && !otherSet.has(neighbor)) {
        neighborMap.set(neighbor, strength);
      }
    }

    // Score each alternative by average pairing with remaining sauce ingredients
    const scored = [];
    for (const [altName, directStrength] of neighborMap) {
      if (!sauceNodes.has(altName)) continue;

      let totalStrength = directStrength;
      let pairCount = 1;

      for (const other of otherIngredients) {
        const otherNeighbors = adjacencyMap.get(other);
        const strength = otherNeighbors?.get(altName) || 0;
        if (strength > 0) {
          totalStrength += strength;
          pairCount++;
        }
      }

      const avgStrength = totalStrength / Math.max(1, pairCount);
      const node = sauceNodes.get(altName);
      scored.push({
        name: altName,
        score: Math.round(avgStrength * 10 * 10) / 10, // 0-10 scale, 1 decimal
        category: node?.category || 'Other',
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10);
  }, [swapIngredient, sauceNodes, adjacencyMap, selectedSauce]);

  const handleSelectAlt = useCallback((altName) => {
    const alt = swapAlternatives.find(a => a.name === altName);
    setPreviewAlt(alt || { name: altName, score: 0, category: '' });
    if (onSelectAlternative) {
      onSelectAlternative(swapIngredient, altName, selectedSauce);
    }
  }, [swapIngredient, selectedSauce, onSelectAlternative, swapAlternatives]);

  const handleAcceptSwap = useCallback(() => {
    if (!previewAlt || !swapIngredient || !selectedSauce) return;
    const updated = {
      ...selectedSauce,
      ingredients: selectedSauce.ingredients.map(ing => {
        const ingName = (typeof ing === 'string' ? ing : ing.name).toLowerCase().trim();
        return ingName === swapIngredient.toLowerCase().trim()
          ? { ...ing, name: previewAlt.name, measure: ing.measure || '' }
          : ing;
      }),
    };
    setSelectedSauce(updated);
    setSwapIngredient(null);
    setPreviewAlt(null);
    if (onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(updated.ingredients, sauceNodes));
    }
  }, [previewAlt, swapIngredient, selectedSauce, onHighlightIngredients, sauceNodes]);

  // TheMealDB search
  const handleMealSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`${MEALDB_BASE}/search.php?s=${encodeURIComponent(searchQuery.trim())}`);
      const json = await res.json();
      const meals = (json.meals || []).map(normalizeMeal).filter(Boolean);
      // Sort sauce-relevant results first
      meals.sort((a, b) => (isSauceRelevant(b) ? 1 : 0) - (isSauceRelevant(a) ? 1 : 0));
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
    setSwapIngredient(null);
    setPreviewAlt(null);
    if (onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(meal.ingredients, sauceNodes));
    }
  }, [onHighlightIngredients, sauceNodes]);

  const handleSaveFromBuilder = useCallback((name) => {
    if (!userProfile || !builderIngredients.length) return;
    userProfile.addSauce?.({
      name: name || 'My Sauce',
      ingredients: builderIngredients.map(n => ({ name: n, quantity: '', unit: 'tbsp' })),
      instructions: '',
      template: sauceTemplate?.name || null,
      motherSauce: sauceTemplate?.name || '',
      createdAt: Date.now(),
    });
  }, [userProfile, builderIngredients, sauceTemplate]);

  // --- My Sauces handlers ---
  const handleLoadSavedSauce = useCallback((sauce) => {
    if (onHighlightIngredients) {
      onHighlightIngredients(resolveIngredientNames(sauce.ingredients, sauceNodes));
    }
    setTab('builder');
    onBuilderClear?.();
    for (const ing of sauce.ingredients) {
      const name = typeof ing === 'string' ? ing : ing.name;
      if (sauceNodes?.has(name)) {
        onBuilderAdd?.(name);
      }
    }
  }, [onHighlightIngredients, onBuilderClear, onBuilderAdd, sauceNodes]);

  const handleDeleteSauce = useCallback((id) => {
    if (userProfile) {
      userProfile.removeSauce(id);
      setConfirmDelete(null);
    }
  }, [userProfile]);

  const savedSauceCount = userProfile?.profile?.sauces?.length || 0;

  const tabs = [
    { key: 'browse', label: 'Recipes' },
    { key: 'builder', label: 'Builder ↗' },
    { key: 'saved', label: `My Sauces${savedSauceCount > 0 ? ` (${savedSauceCount})` : ''}` },
    { key: 'lookup', label: 'Lookup' },
  ];

  // Builder tab redirects to Recipe Lab (Sauce mode) — the build flow
  // is unified there. Other tabs keep local state.
  const handleTabClick = (key) => {
    if (key === 'builder' && onOpenRecipeLab) {
      onOpenRecipeLab('sauce', builderIngredients);
      return;
    }
    setTab(key);
  };

  // Render the sauce detail view (shared between browse and lookup tabs)
  const renderSauceDetail = () => (
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

      {/* Ingredients with swap support */}
      <div>
        <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">
          Ingredients
          {!swapIngredient && (
            <span className="text-gray-700 normal-case ml-1">- tap to swap</span>
          )}
        </p>
        <div className="space-y-0.5">
          {selectedSauce.ingredients.map((ing, idx) => {
            const ingName = (typeof ing === 'string' ? ing : ing.name);
            const isSwapping = swapIngredient && swapIngredient.toLowerCase() === ingName.toLowerCase();
            return (
              <button
                key={`${ingName}-${idx}`}
                onClick={() => {
                  if (swapIngredient) {
                    // If already swapping a different ingredient, switch target
                    if (!isSwapping) {
                      handleSwapIngredient(ingName);
                    }
                  } else {
                    handleSwapIngredient(ingName);
                  }
                }}
                className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition-all text-left ${
                  isSwapping
                    ? 'text-amber-300 bg-amber-500/15 border border-amber-500/30'
                    : swapIngredient
                    ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a2e]'
                    : 'text-gray-300 hover:bg-amber-500/10 hover:text-amber-200'
                }`}
              >
                <span className="truncate">{ingName}</span>
                <span className="text-[9px] text-gray-600 flex-shrink-0 ml-2">{ing.measure || ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Swap alternatives panel */}
      {swapIngredient && (
        <div className="border border-amber-500/20 rounded-lg p-2 bg-amber-500/5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-amber-400 uppercase tracking-wider">
              Swap: {swapIngredient}
            </p>
            <button
              onClick={handleCancelSwap}
              className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>

          {swapAlternatives.length > 0 ? (
            <div className="space-y-0.5">
              {swapAlternatives.map((alt) => {
                const isPreview = previewAlt?.name === alt.name;
                return (
                  <button
                    key={alt.name}
                    onClick={() => handleSelectAlt(alt.name)}
                    className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition-all text-left ${
                      isPreview
                        ? 'text-amber-200 bg-amber-500/20 border border-amber-500/30'
                        : 'text-gray-300 hover:bg-amber-500/10 hover:text-amber-200'
                    }`}
                  >
                    <span className="truncate">{alt.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-[8px] text-gray-600">{alt.category}</span>
                      <span className={`text-[9px] font-medium ${
                        alt.score >= 7 ? 'text-green-400' : alt.score >= 4 ? 'text-yellow-400' : 'text-gray-500'
                      }`}>
                        {alt.score}
                      </span>
                      <OdorBadge a={swapIngredient} b={alt.name} bridgeCompounds={bridgeCompounds} compact />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[9px] text-gray-600 text-center py-2">
              No alternatives found in network
            </p>
          )}

          {/* Accept swap button */}
          {previewAlt && (
            <button
              onClick={handleAcceptSwap}
              className="w-full text-[10px] text-green-300 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded py-1.5 transition-colors"
            >
              Replace {swapIngredient} with {previewAlt.name}
            </button>
          )}
        </div>
      )}

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
  );

  return (
    <div className={`fixed top-14 right-0 bottom-4 z-40 flex items-stretch select-none ${isOpen ? '' : 'pointer-events-none'}`}>
      <div className={`w-80 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide">Sauce Lab</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e1e2e]">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
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
              {selectedSauce && renderSauceDetail()}

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

          {tab === 'saved' && (
            <div className="p-3 space-y-2">
              {(!userProfile?.profile?.sauces || userProfile.profile.sauces.length === 0) ? (
                <div className="flex items-center justify-center h-48">
                  <p className="text-[10px] text-gray-600 text-center">
                    No saved sauces yet.
                    <br />Use the Builder tab to create and save sauces.
                  </p>
                </div>
              ) : (
                userProfile.profile.sauces.map((sauce) => (
                  <div
                    key={sauce.id}
                    className="p-2 rounded-lg bg-[#1a1a2e]/50 border border-[#2a2a3e] hover:border-amber-500/20 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs text-gray-200 font-medium truncate">{sauce.name}</h4>
                      <div className="flex items-center gap-1">
                        {sauce.template && (
                          <span className="text-[8px] text-amber-400/60 bg-amber-500/10 rounded px-1 py-0.5">
                            {sauce.template}
                          </span>
                        )}
                        {sauce.motherSauce && (
                          <span className="text-[8px] text-amber-400/40 bg-amber-500/5 rounded px-1 py-0.5">
                            {sauce.motherSauce}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-500 mb-1.5">
                      {sauce.ingredients.map(i =>
                        i.quantity ? `${i.quantity} ${i.unit || 'tbsp'} ${i.name}` : i.name
                      ).join(' · ')}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleLoadSavedSauce(sauce)}
                        className="text-[9px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded px-2 py-0.5 transition-colors"
                      >
                        Load
                      </button>
                      {confirmDelete === sauce.id ? (
                        <>
                          <button
                            onClick={() => handleDeleteSauce(sauce.id)}
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
                          onClick={() => setConfirmDelete(sauce.id)}
                          className="text-[9px] text-gray-600 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="text-[8px] text-gray-700 mt-1">
                      {new Date(sauce.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
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
                  {renderSauceDetail()}
                </>
              )}

              {/* Search results */}
              {!selectedSauce && searchResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  {searchResults.map(meal => {
                    const relevant = isSauceRelevant(meal);
                    return (
                      <button
                        key={meal.id}
                        onClick={() => handleSelectMeal(meal)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg bg-[#1a1a2e]/50 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all text-left ${
                          !relevant ? 'opacity-60' : ''
                        }`}
                      >
                        {meal.image && (
                          <img src={`${meal.image}/preview`} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-200 truncate">{meal.name}</p>
                          <div className="flex items-center gap-1.5">
                            {meal.cuisine && <span className="text-[9px] text-gray-600">{meal.cuisine}</span>}
                            {!relevant && (
                              <span className="text-[8px] text-gray-600 italic">May not be a sauce</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
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
