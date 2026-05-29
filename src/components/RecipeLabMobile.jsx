import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { getCocktailScope, getSauceScope } from '../data/labScope.js';
import { getCocktailRoles, getSauceRoles } from '../data/ingredientRoles.js';
import RecipeFlavorWheel from './RecipeFlavorWheel.jsx';
import RecipeNotebook from './RecipeNotebook.jsx';
import IngredientSuggestionsPopout from './IngredientSuggestionsPopout.jsx';
import RecipeTypePills from './RecipeTypePills.jsx';
import { hapticLight, hapticMedium } from '../utils/native.js';
import { computeRecipeAroma } from '../data/recipeAromaSimilarity.js';
// "Start from" template strip + "This looks like" classical match
// card/toast removed in the polish pass — they were redundant against
// the Cocktail/Sauce Lab handoff that already pre-loads the canonical
// recipe and made the Recipe Lab feel busy.

const FONT_FAMILY = 'Caveat, cursive';

/**
 * RecipeLabMobile — Mobile-specific Recipe Lab with 3-zone layout:
 *   1. Aroma Profile (top) — 6-axis aroma bars from GNN predictions
 *   2. Recipe Notebook (middle) — scrollable ingredient list
 *   3. Suggestion Drawer (bottom) — pull-up sheet with taste tabs + chips
 */
export default function RecipeLabMobile({ fullData, initialIngredient, initialIngredients, initialMode = null, handoff = null, userProfile, onFindCocktail, onFindSauce }) {
  // initialMode === 'cocktail' arrives when the user taps "Open in
  // Recipe Lab" from a cocktail card; default the lab into cocktail
  // mode so the suggestion drawer scopes to cocktail-relevant
  // ingredients and the cuisine filter is suppressed.
  const [labMode, setLabMode] = useState(initialMode === 'cocktail' ? 'cocktail' : 'taste');
  // Seed with the full set of selected ingredients when present — fixes
  // the "Build Recipe" button previously losing all but the first.
  const initialSeed = (initialIngredients && initialIngredients.length > 0)
    ? [...new Set(initialIngredients)]
    : (initialIngredient ? [initialIngredient] : []);
  const [centerIngredient, setCenterIngredient] = useState(initialSeed[0] || null);
  const [recipeIngredients, setRecipeIngredients] = useState(initialSeed);
  const [recipeTitle, setRecipeTitle] = useState('');
  const [selectedStructure, setSelectedStructure] = useState(null);
  // Cocktail handoff should pop the drawer open so the user sees the
  // suggestion chips (with inline swap targets) right away.
  const [drawerSnap, setDrawerSnap] = useState(initialMode === 'cocktail' ? 'half' : 'peek');
  const [activeTab, setActiveTab] = useState('all');
  // When the user taps the "R" pill on an ingredient row, the hex
  // graphic is replaced by IngredientSuggestionsPopout for that
  // ingredient. Single-ingredient REPLACE flow without the bottom
  // drawer's add/replace toggle.
  const [focusedIngredient, setFocusedIngredient] = useState(null);
  // When the user taps the "Suggestions" row at the end of the
  // notebook, the same popout opens in add-mode (no focal ingredient,
  // ranks candidates by avg pair strength to the whole bowl).
  const [suggestionsMode, setSuggestionsMode] = useState(false);
  // Transient handoff confirmation — fires when an explicit handoff
  // replaces the bowl, so the user understands their previous recipe
  // was cleared on purpose (and isn't lost to a bug).
  const [handoffToast, setHandoffToast] = useState(null);
  // §16 — user-set recipe-type classifier (RL-RECIPETYPE).
  // null = no type chosen. Hydrated from handoff.recipeType when
  // present so Make picker / Cookbook seed recipes can preserve type.
  const [recipeType, setRecipeType] = useState(handoff?.recipeType || null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Reset structure on mode change
  useEffect(() => { setSelectedStructure(null); }, [labMode]);

  // One-shot handoff watcher. Only fires when App.jsx writes a new
  // `handoff` payload (explicit "Build Recipe" / "Open in Recipe Lab"
  // button presses). REPLACES the bowl rather than appending so the
  // user gets a clean slate for the new recipe context — fixes the
  // bug where exploring cocktails / sauces / network selections
  // silently piled extra ingredients onto an in-progress recipe.
  //
  // `initialIngredients` is intentionally NOT a dependency here: the
  // first-mount seed already lives in `useState(initialSeed)` above,
  // and post-mount we want the bowl to be controlled exclusively by
  // (a) the user's in-lab actions and (b) explicit handoff events.
  useEffect(() => {
    if (!handoff || !handoff.ts) return;
    const incoming = Array.isArray(handoff.ingredients)
      ? [...new Set(handoff.ingredients)]
      : [];
    if (incoming.length === 0) return;
    // Capture the previous bowl size BEFORE we replace, so the toast
    // can tell the user how many ingredients were cleared.
    setRecipeIngredients(prev => {
      const cleared = prev.length;
      const sourceLabel = handoff.mode === 'cocktail' ? 'cocktail'
                        : handoff.mode === 'sauce' ? 'sauce'
                        : 'recipe';
      const titleSuffix = handoff.title ? ` "${handoff.title}"` : '';
      const msg = cleared > 0
        ? `Loaded ${incoming.length} ingredients from ${sourceLabel}${titleSuffix} — previous ${cleared} cleared`
        : `Loaded ${incoming.length} ingredients from ${sourceLabel}${titleSuffix}`;
      setHandoffToast(msg);
      return incoming;
    });
    setCenterIngredient(incoming[0]);
    setRecipeTitle(handoff.title || '');
    setSelectedStructure(null);
    setActiveTab('all');
    setDrawerSnap('half');
    if (handoff.mode === 'cocktail') setLabMode('cocktail');
    else if (handoff.mode === 'sauce') setLabMode('sauce');
    else setLabMode('taste');
    // §16 — preserve recipeType across handoff payloads. null clears
    // any prior selection so each new bowl starts unclassified unless
    // the source explicitly carries the type.
    setRecipeType(handoff.recipeType || null);
  }, [handoff?.ts]);

  // Auto-clear the handoff toast after 2.5s.
  useEffect(() => {
    if (!handoffToast) return;
    const t = setTimeout(() => setHandoffToast(null), 2500);
    return () => clearTimeout(t);
  }, [handoffToast]);

  // P8: Compute whether the current bowl has any GNN aroma coverage.
  // If not, the aroma-match pills render disabled so users understand
  // why the feature isn't available without hiding it entirely.
  const aromaDisabled = useMemo(() => {
    if (!fullData?.graph?.nodes || recipeIngredients.length === 0) return true;
    const nodesObj = Object.fromEntries(fullData.graph.nodes);
    return computeRecipeAroma(recipeIngredients, nodesObj) === null;
  }, [recipeIngredients, fullData?.graph?.nodes]);

  // Scope sets (cocktail / sauce) — lazy-loaded once, cached across mode switches.
  const [cocktailScope, setCocktailScope] = useState(null);
  const [sauceScope, setSauceScope] = useState(null);
  // Role maps for slot-aware replace suggestions (Path C, 2026-05-08).
  // Cocktail: 553 ingredients keyed to cocktails_v2 slot vocabulary.
  // Sauce: 175 ingredients keyed to sauce_augment.codexRole vocabulary.
  // General: computed at lookup time via ingredientRoles.getGeneralRole.
  const [cocktailRoles, setCocktailRoles] = useState(null);
  const [sauceRoles, setSauceRoles] = useState(null);
  useEffect(() => {
    if (labMode === 'cocktail') {
      if (!cocktailScope) getCocktailScope().then(setCocktailScope).catch(() => setCocktailScope(new Set()));
      if (!cocktailRoles) getCocktailRoles().then(setCocktailRoles).catch(() => setCocktailRoles({}));
    } else if (labMode === 'sauce') {
      if (!sauceScope) getSauceScope().then(setSauceScope).catch(() => setSauceScope(new Set()));
      if (!sauceRoles) getSauceRoles().then(setSauceRoles).catch(() => setSauceRoles({}));
    }
  }, [labMode, cocktailScope, sauceScope, cocktailRoles, sauceRoles]);

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
    hapticLight();
  }, [centerIngredient, recipeIngredients]);

  const handleRemoveIngredient = useCallback((name) => {
    setRecipeIngredients(prev => prev.filter(n => n !== name));
    if (name === centerIngredient) {
      const remaining = recipeIngredients.filter(n => n !== name);
      setCenterIngredient(remaining.length > 0 ? remaining[0] : null);
      if (remaining.length === 0) setDrawerSnap('peek');
    }
    hapticLight();
  }, [centerIngredient, recipeIngredients]);

  // Swap one bowl ingredient for another in a single edit. Used by the
  // SuggestionDrawer's Replace mode (entered from a cocktail's "Open in
  // Recipe Lab" button) so the user can experiment with substitutions
  // without manually removing the original.
  const handleSwapIngredient = useCallback((oldName, newName) => {
    if (!oldName || !newName) return;
    setRecipeIngredients(prev => {
      const idx = prev.indexOf(oldName);
      if (idx === -1) return prev.includes(newName) ? prev : [...prev, newName];
      const next = [...prev];
      if (prev.includes(newName)) next.splice(idx, 1);
      else next[idx] = newName;
      return next;
    });
    if (oldName === centerIngredient) setCenterIngredient(newName);
    hapticLight();
  }, [centerIngredient]);

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

  return (
    <div
      data-testid="recipe-lab"
      className="fixed inset-0 pt-10 flex flex-col"
      style={{ backgroundColor: '#fefae0' }}
    >
      {/* Handoff confirmation toast — fades in/out top-center after
          a Cocktail / Sauce / Build-Recipe handoff replaces the bowl. */}
      {handoffToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[70] px-3 py-1.5 text-sm rounded-full shadow-lg pointer-events-none"
          style={{
            top: 'calc(var(--nav-h, 40px) + 12px)',
            backgroundColor: '#3a3428',
            color: '#fefae0',
            fontFamily: FONT_FAMILY,
            animation: 'fn-toast-in 240ms ease-out',
            maxWidth: '90vw',
          }}
          role="status"
          aria-live="polite"
        >
          {handoffToast}
        </div>
      )}
      <style>{`@keyframes fn-toast-in { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
      {/* Top action bar — prominent Save button so users can save the
          recipe they're building from the top of the screen. */}
      <div className="relative z-20 mx-2 mt-1 mb-1 flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-[#c9b99a] bg-[#fefae0]/90">
        <div className="text-xs text-[#7a6a4a]" style={{ fontFamily: FONT_FAMILY }}>
          {recipeIngredients.length === 0
            ? 'Build a recipe…'
            : `${recipeIngredients.length} ingredient${recipeIngredients.length === 1 ? '' : 's'}`}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              if (recipeIngredients.length < 2) return;
              userProfile?.addRecipe?.(recipeTitle || 'Untitled Recipe', recipeIngredients);
              setHandoffToast(`Saved "${recipeTitle || 'Untitled Recipe'}" to profile`);
              hapticMedium();
            }}
            disabled={recipeIngredients.length < 2}
            className={`min-h-[40px] px-4 text-sm font-medium rounded-md border transition-colors ${
              recipeIngredients.length >= 2
                ? 'bg-[#5a4a2a] text-[#fefae0] border-[#5a4a2a] hover:bg-[#3a3428]'
                : 'bg-[#e8dcc0]/50 text-[#a09070] border-[#d8cca8] cursor-not-allowed'
            }`}
            style={{ fontFamily: FONT_FAMILY }}
            aria-label="Save recipe to profile"
          >
            Save Recipe
          </button>
          <button
            onClick={handleClear}
            disabled={recipeIngredients.length === 0}
            className="min-h-[40px] px-3 text-sm rounded-md border border-[#d8cca8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-[#f0e8d0]"
            style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Mode tabs — full-width strip under the top nav so they're obvious
          on mobile. User previously missed the corner-tucked tabs. */}
      <div className="relative z-20 mx-2 mt-1 mb-2 flex items-center gap-1 p-1 rounded-lg border border-[#c9b99a] bg-[#f5edd0]">
        {[
          { key: 'taste', label: 'General' },
          { key: 'cocktail', label: 'Cocktail' },
          { key: 'sauce', label: 'Sauce' },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => setLabMode(m.key)}
            className={`flex-1 min-h-[40px] px-3 py-1.5 text-base rounded-md border transition-colors ${
              labMode === m.key
                ? 'bg-[#e8dcc0] border-[#c9b99a] text-[#5a4a2a] font-medium shadow-sm'
                : 'border-transparent text-[#a09070] hover:bg-[#f0e8d0]'
            }`}
            style={{ fontFamily: FONT_FAMILY }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* §16 recipe-type pill row — single-select, re-tap to clear,
          renders directly below the mode tab strip per spec §16.2. */}
      <RecipeTypePills value={recipeType} onChange={setRecipeType} />

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

      {/* Zone 1: Aroma Profile (sticky at top) — replaced by the
          single-ingredient suggestions popout when an "R" pill is
          tapped (per user redesign 2026-05-07). */}
      <div className="flex-shrink-0 flex justify-center">
        {focusedIngredient ? (
          <IngredientSuggestionsPopout
            ingredient={focusedIngredient}
            recipeIngredients={recipeIngredients.filter((n) => n !== focusedIngredient)}
            nodes={fullData?.graph?.nodes}
            edges={fullData?.graph?.edges}
            cuisineNeighborIndex={fullData?.cuisineNeighborIndex || null}
            scopeFilter={
              labMode === 'cocktail' ? cocktailScope :
              labMode === 'sauce' ? sauceScope :
              null
            }
            cocktailRoles={cocktailRoles}
            sauceRoles={sauceRoles}
            labMode={labMode}
            onSwap={(target, newName) => {
              handleSwapIngredient(target, newName);
              setFocusedIngredient(null);
            }}
            onClose={() => setFocusedIngredient(null)}
          />
        ) : suggestionsMode ? (
          <IngredientSuggestionsPopout
            ingredient={null}
            recipeIngredients={recipeIngredients}
            nodes={fullData?.graph?.nodes}
            edges={fullData?.graph?.edges}
            cuisineNeighborIndex={fullData?.cuisineNeighborIndex || null}
            scopeFilter={
              labMode === 'cocktail' ? cocktailScope :
              labMode === 'sauce' ? sauceScope :
              null
            }
            cocktailRoles={cocktailRoles}
            sauceRoles={sauceRoles}
            labMode={labMode}
            onAdd={(newName) => {
              handleAddIngredient(newName);
            }}
            onClose={() => setSuggestionsMode(false)}
          />
        ) : (
          <RecipeFlavorWheel
            ingredients={recipeIngredients}
            nodes={fullData?.graph?.nodes}
            onTapAroma={(key) => {
              setActiveTab(`aroma:${key}`);
              if (drawerSnap === 'peek') setDrawerSnap('half');
            }}
          />
        )}
      </div>

      {/* Zone 2: Recipe Notebook — scrolls under the sticky hex /
          popout above. Each row gets an "R" pill that fires
          setFocusedIngredient(name); a "+" row at the bottom focuses
          the search input. */}
      <div className="flex-1 relative overflow-y-auto" style={{ minHeight: 80 }}>
        <RecipeNotebook
          ingredients={recipeIngredients}
          centerIngredient={centerIngredient}
          nodes={fullData?.graph?.nodes}
          edges={fullData?.graph?.edges}
          cuisineNeighborIndex={fullData?.cuisineNeighborIndex || null}
          onRemove={handleRemoveIngredient}
          onRecenter={handleRecenter}
          onFocusIngredient={(name) => {
            setFocusedIngredient(name);
            setSuggestionsMode(false);
            // Collapse the bottom drawer so the user's attention is
            // entirely on the popout above.
            setDrawerSnap('peek');
          }}
          onRequestAdd={() => {
            searchInputRef.current?.focus();
            setSearchOpen(true);
          }}
          onRequestSuggestions={() => {
            setSuggestionsMode(true);
            setFocusedIngredient(null);
            setDrawerSnap('peek');
          }}
          recipeTitle={recipeTitle}
          onTitleChange={setRecipeTitle}
          compatibility={null}
          onFindCocktail={onFindCocktail
            ? () => onFindCocktail(recipeIngredients, recipeTitle)
            : undefined}
          onFindSauce={onFindSauce
            ? () => onFindSauce(recipeIngredients, recipeTitle)
            : undefined}
          aromaDisabled={aromaDisabled}
        />

      </div>

      {/* The legacy bottom-up SuggestionDrawer was eliminated per
          user request 2026-05-07 — the per-ingredient
          IngredientSuggestionsPopout is now the only suggestion
          surface in the Recipe Lab, opened via the "R" pill on each
          row. Eliminates the dual-suggestion-surface ambiguity that
          made the Recipe Lab feel busy. */}
    </div>
  );
}
