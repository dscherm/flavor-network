import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { getCocktailScope, getSauceScope } from '../data/labScope.js';
import { getCocktailRoles, getSauceRoles } from '../data/ingredientRoles.js';
import RecipeNotebook from './RecipeNotebook.jsx';
import RecipeFlavorProfileCard from './RecipeFlavorProfileCard.jsx';
import useIsMobile from '../hooks/useIsMobile.js';
import IngredientSuggestionsPopout from './IngredientSuggestionsPopout.jsx';
import RecipeTypePills from './RecipeTypePills.jsx';
import IngredientPicker from './IngredientPicker.jsx';
import { hapticLight, hapticMedium } from '../utils/native.js';
import { computeRecipeAroma } from '../data/recipeAromaSimilarity.js';
import {
  bowlNames,
  bowlIncludes,
  bowlFromIngredients,
  bowlAddIngredient,
  bowlRemoveIngredient,
  bowlSwapIngredient,
  bowlSetAmount,
} from '../data/bowlEntry.js';

const FONT_FAMILY = 'Caveat, cursive';

/**
 * RecipeLabMobile — Mobile-specific Recipe Lab with 3-zone layout:
 *   1. Aroma Profile (top) — RecipeFlavorWheel
 *   2. Recipe Notebook (middle) — scrollable ingredient list w/ amounts
 *
 * Bowl state is BowlEntry[] per RECIPE-LAB-SPEC §11.1; name-only
 * consumers (search, RecipeFlavorWheel, IngredientSuggestionsPopout,
 * aroma-match handlers, save flow) adapt via `bowlNames(bowl)` at the
 * prop boundary.
 */
export default function RecipeLabMobile({ fullData, initialIngredient, initialIngredients, initialMode = null, handoff = null, userProfile, onFindCocktail, onFindSauce }) {
  const [labMode, setLabMode] = useState(initialMode === 'cocktail' ? 'cocktail' : 'taste');

  // Seed the bowl from initialIngredients / initialIngredient, dedup'd
  // via bowlFromIngredients (which also coerces legacy string[] payloads
  // into the canonical BowlEntry[] shape).
  const initialSeedNames = (initialIngredients && initialIngredients.length > 0)
    ? [...new Set(initialIngredients)]
    : (initialIngredient ? [initialIngredient] : []);
  const [centerIngredient, setCenterIngredient] = useState(initialSeedNames[0] || null);
  const [recipeIngredients, setRecipeIngredients] = useState(() => bowlFromIngredients(initialSeedNames));
  const [recipeTitle, setRecipeTitle] = useState('');
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [focusedIngredient, setFocusedIngredient] = useState(null);
  const [suggestionsMode, setSuggestionsMode] = useState(false);
  // B-version P2: IngredientPicker modal (Add/Replace) — opens via
  // the "Add ingredient" CTA in the chrome row. Replace-target null
  // means "add new"; non-null means "replace this ingredient".
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerReplaceTarget, setPickerReplaceTarget] = useState(null);
  const [handoffToast, setHandoffToast] = useState(null);
  const [recipeType, setRecipeType] = useState(handoff?.recipeType || null);
  const [recipeImageUrl, setRecipeImageUrl] = useState(null);
  const [focalKey, setFocalKey] = useState(null);
  // B-version (2026-06-03): per user spec, iOS users see the flavor-
  // profile radars one ingredient at a time; web users see the
  // aggregate of every ingredient in the bowl. profileSelectedIdx
  // controls which ingredient drives the radars (null = aggregate).
  const isMobile = useIsMobile();
  const [profileSelectedIdx, setProfileSelectedIdx] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => { setSelectedStructure(null); }, [labMode]);

  // On iOS, default the flavor-profile selection to the first
  // ingredient (or null when the bowl is empty). On web we always
  // pass null so the radars show the aggregate of every ingredient.
  useEffect(() => {
    if (!isMobile) {
      setProfileSelectedIdx(null);
      return;
    }
    setProfileSelectedIdx((prev) => {
      if (recipeIngredients.length === 0) return null;
      if (prev == null || prev >= recipeIngredients.length) return 0;
      return prev;
    });
  }, [isMobile, recipeIngredients.length]);

  // Name-only adapter cached per render for downstream string[] consumers.
  const recipeNames = useMemo(() => bowlNames(recipeIngredients), [recipeIngredients]);

  // Handoff watcher. Accepts both legacy string[] (existing entry
  // points: Cocktail / Sauce / Build / Network / Profile) and forward-
  // shape BowlEntry[] (future Make-mode payloads) via bowlFromIngredients.
  useEffect(() => {
    if (!handoff || !handoff.ts) return;
    const incoming = bowlFromIngredients(handoff.ingredients);
    const isMake = typeof handoff.source === 'string' && handoff.source.startsWith('make-');
    if (incoming.length === 0 && !isMake) return;
    setRecipeIngredients(prev => {
      const cleared = prev.length;
      // MAKE-E2E-AUDIT (2026-05-30): Make handoffs land with 0 ingredients
      // (scratch / photo). The generic "Loaded 0 ingredients from recipe"
      // toast reads as a confusing zero-state. Tailor the message per
      // Make subtype; non-Make handoffs keep the count-based message.
      const titleSuffix = handoff.title ? ` "${handoff.title}"` : '';
      let msg;
      if (isMake) {
        if (handoff.source === 'make-photo') {
          msg = 'Photo attached. Pick ingredients to build the bowl.';
        } else if (handoff.source === 'make-scratch') {
          msg = 'Empty recipe ready. Pick ingredients to build the bowl.';
        } else if (incoming.length > 0) {
          msg = `Loaded ${incoming.length} ingredients${titleSuffix}`;
        } else {
          msg = 'Recipe ready. Pick ingredients to build the bowl.';
        }
      } else {
        const sourceLabel = handoff.mode === 'cocktail' ? 'cocktail'
                          : handoff.mode === 'sauce' ? 'sauce'
                          : 'recipe';
        msg = cleared > 0
          ? `Loaded ${incoming.length} ingredients from ${sourceLabel}${titleSuffix} — previous ${cleared} cleared`
          : `Loaded ${incoming.length} ingredients from ${sourceLabel}${titleSuffix}`;
      }
      setHandoffToast(msg);
      return incoming;
    });
    setCenterIngredient(incoming[0]?.ingredient || null);
    setRecipeTitle(handoff.title || '');
    setSelectedStructure(null);
    setActiveTab('all');
    if (handoff.mode === 'cocktail') setLabMode('cocktail');
    else if (handoff.mode === 'sauce') setLabMode('sauce');
    else setLabMode('taste');
    setRecipeType(handoff.recipeType || null);
    setFocalKey(null);
    if (handoff.image instanceof File && handoff.image.type?.startsWith('image/')) {
      setRecipeImageUrl(URL.createObjectURL(handoff.image));
    } else {
      setRecipeImageUrl(null);
    }
  }, [handoff?.ts]);

  // Revoke the prior object URL whenever recipeImageUrl changes OR on
  // unmount. Replacing the URL (via handoff) or clearing it (via remove /
  // bowl-clear) triggers cleanup for the prior value.
  useEffect(() => {
    return () => {
      if (recipeImageUrl) URL.revokeObjectURL(recipeImageUrl);
    };
  }, [recipeImageUrl]);

  const handleRemoveImage = useCallback(() => {
    setRecipeImageUrl(null);
  }, []);

  useEffect(() => {
    if (!handoffToast) return;
    const t = setTimeout(() => setHandoffToast(null), 2500);
    return () => clearTimeout(t);
  }, [handoffToast]);

  const aromaDisabled = useMemo(() => {
    if (!fullData?.graph?.nodes || recipeNames.length === 0) return true;
    const nodesObj = Object.fromEntries(fullData.graph.nodes);
    return computeRecipeAroma(recipeNames, nodesObj) === null;
  }, [recipeNames, fullData?.graph?.nodes]);

  // Scope sets (cocktail / sauce) — lazy-loaded once, cached across mode switches.
  const [cocktailScope, setCocktailScope] = useState(null);
  const [sauceScope, setSauceScope] = useState(null);
  const [cocktailRoles, setCocktailRoles] = useState(null);
  const [sauceRoles, setSauceRoles] = useState(null);
  // RL-SAUCE-SUGGEST: sauce_augment.sauces list, lazy-loaded once on
  // mount so the IngredientSuggestionsPopout can rank a top-5 chip row.
  const [sauceList, setSauceList] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/sauce_augment.json`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setSauceList(json.sauces || []);
      } catch {
        if (!cancelled) setSauceList([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (labMode === 'cocktail') {
      if (!cocktailScope) getCocktailScope().then(setCocktailScope).catch(() => setCocktailScope(new Set()));
      if (!cocktailRoles) getCocktailRoles().then(setCocktailRoles).catch(() => setCocktailRoles({}));
    } else if (labMode === 'sauce') {
      if (!sauceScope) getSauceScope().then(setSauceScope).catch(() => setSauceScope(new Set()));
      if (!sauceRoles) getSauceRoles().then(setSauceRoles).catch(() => setSauceRoles({}));
    }
  }, [labMode, cocktailScope, sauceScope, cocktailRoles, sauceRoles]);

  const scopedIngredients = useMemo(() => {
    if (!fullData) return [];
    const all = fullData.graph.ingredientList;
    if (labMode === 'cocktail') {
      if (!cocktailScope) return all;
      return all.filter((n) => cocktailScope.has(n.toLowerCase()));
    }
    if (labMode === 'sauce') {
      if (!sauceScope) return all;
      return all.filter((n) => sauceScope.has(n.toLowerCase()));
    }
    return all;
  }, [fullData, labMode, cocktailScope, sauceScope]);

  const fuse = useMemo(() => {
    if (!scopedIngredients.length) return null;
    const docs = scopedIngredients.map(n => ({ name: n }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [scopedIngredients]);

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
    setCenterIngredient(prev => prev || name);
    setRecipeIngredients(prev => bowlAddIngredient(prev, name));
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

  // Ingredient management — all bowl mutations go through helpers so
  // BowlEntry shape stays canonical (incl. amount preservation on swap).
  const handleAddIngredient = useCallback((name) => {
    if (!name) return;
    setCenterIngredient(prev => prev || name);
    setRecipeIngredients(prev => bowlAddIngredient(prev, name));
    hapticLight();
  }, []);

  const handleRemoveIngredient = useCallback((name) => {
    setRecipeIngredients(prev => bowlRemoveIngredient(prev, name));
    setCenterIngredient(prev => {
      if (prev !== name) return prev;
      const remaining = bowlNames(bowlRemoveIngredient(recipeIngredients, name));
      return remaining[0] || null;
    });
    setFocalKey(prev => (prev === name ? null : prev));
    hapticLight();
  }, [recipeIngredients]);

  const handleSwapIngredient = useCallback((oldName, newName) => {
    if (!oldName || !newName) return;
    setRecipeIngredients(prev => bowlSwapIngredient(prev, oldName, newName));
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
    setActiveTab('all');
    setRecipeImageUrl(null);
    setFocalKey(null);
  }, []);

  // §13.3 focal toggle. Tap-and-hold (mobile) and right-click (desktop)
  // on a row both route here through RecipeNotebook's popover. Passing
  // the same name a second time clears the flag.
  const handleSetFocal = useCallback((name) => {
    setFocalKey((prev) => (prev === name ? null : name));
  }, []);

  // §11.3 — per-row amount input commit callback.
  const handleAmountChange = useCallback((name, rawText) => {
    setRecipeIngredients(prev => bowlSetAmount(prev, name, rawText));
  }, []);

  return (
    <div
      data-testid="recipe-lab"
      className="fixed inset-0 pt-10 flex flex-col"
      style={{ backgroundColor: '#fefae0' }}
    >
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
              userProfile?.addRecipe?.(recipeTitle || 'Untitled Recipe', recipeNames);
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

      {/* B-version (2026-06-03): the General/Cocktail/Sauce mode pills
          were removed per user spec — only the dish-type joystick +
          "+ Add" launcher remain in the chrome above the notebook. */}

      {/* B-version P2: dish-type joystick + Add ingredient launcher.
          Replaces the persistent taste-wheel zone with explicit chrome. */}
      <div className="flex items-center gap-2 mx-2 mb-1">
        <div className="flex-1 min-w-0">
          <RecipeTypePills value={recipeType} onChange={setRecipeType} />
        </div>
        <button
          type="button"
          data-testid="recipe-chrome-add-ingredient"
          onClick={() => { setPickerReplaceTarget(null); setPickerOpen(true); }}
          className="min-h-[44px] px-3 py-1 text-sm rounded-md border border-[#c9b99a] bg-[#fefae0] text-[#5a4a2a] hover:bg-[#f0e8d0] whitespace-nowrap"
          style={{ fontFamily: FONT_FAMILY }}
          aria-label="Add ingredient via picker"
        >
          + Add
        </button>
      </div>

      {/* B-version (2026-06-03): search input + IngredientSuggestionsPopout
          conditional block REMOVED. Add path is now the IngredientPicker
          modal launched by the "+ Add" chrome button. */}

      <div className="flex-1 relative overflow-y-auto" style={{ minHeight: 80 }}>
        {recipeImageUrl && (
          <div className="relative mx-4 mt-2 mb-1 flex items-start gap-2">
            <img
              src={recipeImageUrl}
              alt="Recipe photo"
              data-testid="recipe-photo-preview"
              className="rounded-lg border border-[#c9b99a] object-cover"
              style={{ height: 96, minHeight: 80, maxWidth: '60%' }}
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label="Remove recipe photo"
              data-testid="recipe-photo-remove"
              className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-full border border-[#c9b99a] bg-[#fefae0] text-[#7a6a4a] text-base font-medium hover:bg-[#f0e8d0]"
              style={{ fontFamily: FONT_FAMILY }}
            >
              ×
            </button>
          </div>
        )}
        <RecipeNotebook
          bowl={recipeIngredients}
          centerIngredient={centerIngredient}
          nodes={fullData?.graph?.nodes}
          edges={fullData?.graph?.edges}
          cuisineNeighborIndex={fullData?.cuisineNeighborIndex || null}
          onRemove={handleRemoveIngredient}
          onRecenter={handleRecenter}
          onAmountChange={handleAmountChange}
          onFocusIngredient={(name) => {
            setFocusedIngredient(name);
            setSuggestionsMode(false);
          }}
          onRequestAdd={() => {
            // B-version P2: notebook + buttons route to IngredientPicker.
            setPickerReplaceTarget(null);
            setPickerOpen(true);
          }}
          onRequestSuggestions={() => {
            setSuggestionsMode(true);
            setFocusedIngredient(null);
          }}
          recipeTitle={recipeTitle}
          onTitleChange={setRecipeTitle}
          compatibility={null}
          focalKey={focalKey}
          onSetFocal={handleSetFocal}
          onFindCocktail={onFindCocktail
            ? () => onFindCocktail(recipeNames, recipeTitle)
            : undefined}
          onFindSauce={onFindSauce
            ? () => onFindSauce(recipeNames, recipeTitle)
            : undefined}
          aromaDisabled={aromaDisabled}
        />

        {/* B-version (2026-06-03): inline flavor-profile card. iOS
            shows one ingredient at a time (profileSelectedIdx); web
            shows aggregate. Hidden when bowl is empty. */}
        {recipeIngredients.length > 0 && (
          <RecipeFlavorProfileCard
            ingredients={recipeNames}
            nodes={fullData?.graph?.nodes}
            edges={fullData?.graph?.edges}
            selectedIdx={isMobile ? profileSelectedIdx : null}
            onSelectIngredient={isMobile ? setProfileSelectedIdx : undefined}
          />
        )}

      </div>

      {/* B-version P2: IngredientPicker modal sheet. Mounted at the
          root so it overlays the notebook + drawer. Dish-type prop is
          mapped from recipeType (drink → cocktail for the picker's
          Layer-1 filter, sauce → sauce, others → null pass-through). */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center px-4 py-8 bg-black/60 backdrop-blur-sm"
          data-testid="recipe-picker-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <IngredientPicker
            mode="notebook"
            ctx={{
              graph: fullData?.graph,
              gnnEntropy: fullData?.gnnEntropy || null,
              cuisineMap: fullData?.cuisineMap || null,
              seasonMap: fullData?.seasonMap || null,
            }}
            dishType={recipeType === 'drink' ? 'cocktail' : recipeType === 'sauce' ? 'sauce' : null}
            onSelect={(name) => {
              if (pickerReplaceTarget) {
                handleSwapIngredient(pickerReplaceTarget, name);
              } else {
                handleAddIngredient(name);
              }
              setPickerOpen(false);
              setPickerReplaceTarget(null);
            }}
            onClose={() => { setPickerOpen(false); setPickerReplaceTarget(null); }}
          />
        </div>
      )}
    </div>
  );
}
