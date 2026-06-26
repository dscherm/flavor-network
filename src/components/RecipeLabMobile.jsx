import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import { getCocktailScope, getSauceScope } from '../data/labScope.js';
import { getCocktailRoles, getSauceRoles } from '../data/ingredientRoles.js';
import RecipeNotebook from './RecipeNotebook.jsx';
import SuggestionCardDeck from './SuggestionCardDeck.jsx';
import RecipeFlavorProfilesCard from './RecipeFlavorProfilesCard.jsx';
import IngredientPicker from './IngredientPicker.jsx';
import { hapticLight, hapticMedium } from '../utils/native.js';
import { computeRecipeAroma } from '../data/recipeAromaSimilarity.js';
import { loadSuggestCandidates, loadReplaceCandidates } from '../data/recipeCandidates.js';
import {
  bowlNames,
  bowlIncludes,
  bowlFromIngredients,
  bowlAddIngredient,
  bowlRemoveIngredient,
  bowlSwapIngredient,
  bowlSetAmount,
  bowlGetAmount,
} from '../data/bowlEntry.js';
import { predictBowlAmounts } from '../ml/quantityRuntime.js';

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
  const [profilesOpen, setProfilesOpen] = useState(false);
  // B-version P2: IngredientPicker modal (Add/Replace) — opens via
  // the "Add ingredient" CTA in the chrome row. Replace-target null
  // means "add new"; non-null means "replace this ingredient".
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerReplaceTarget, setPickerReplaceTarget] = useState(null);
  // Unified "ingredient choices" flow. All three entry points (Add / Suggest /
  // Replace) open the same picker, customized per mode:
  //   add     → full ingredient universe (no curated list)
  //   suggest → model pairings ranked against the whole recipe
  //   replace → similar-flavor substitutes that fit the recipe
  const [pickerMode, setPickerMode] = useState('add'); // 'add' | 'suggest' | 'replace'
  const [pickerCandidates, setPickerCandidates] = useState(null); // curated names, or null
  const [pickerLoading, setPickerLoading] = useState(false);
  // Preview: the ingredient picked from the picker, shown as the chalkboard
  // card (before→after radar) before it's committed. { name, mode, replaceTarget }.
  const [addPreview, setAddPreview] = useState(null);
  const [handoffToast, setHandoffToast] = useState(null);
  const [recipeType, setRecipeType] = useState(handoff?.recipeType || null);
  const [recipeImageUrl, setRecipeImageUrl] = useState(null);
  const [focalKey, setFocalKey] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => { setSelectedStructure(null); }, [labMode]);

  // Name-only adapter cached per render for downstream string[] consumers.
  const recipeNames = useMemo(() => bowlNames(recipeIngredients), [recipeIngredients]);

  // Open the unified "ingredient choices" picker for a given flow, pre-computing
  // the curated candidate list for suggest/replace (add browses the full universe).
  const openIngredientFlow = useCallback(async (flowMode, replaceTarget = null) => {
    setAddPreview(null);
    setPickerMode(flowMode);
    setPickerReplaceTarget(replaceTarget);
    setPickerCandidates(null);
    setPickerOpen(true);
    const gnodes = fullData?.graph?.nodes;
    if (flowMode === 'add' || !gnodes) return;
    setPickerLoading(true);
    try {
      const names = flowMode === 'replace'
        ? await loadReplaceCandidates(replaceTarget, recipeNames, gnodes)
        : await loadSuggestCandidates(recipeNames, gnodes);
      setPickerCandidates(names);
    } catch {
      setPickerCandidates([]);
    } finally {
      setPickerLoading(false);
    }
  }, [fullData, recipeNames]);

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
  const handleAddIngredient = useCallback((name, amount = null) => {
    if (!name) return;
    setCenterIngredient(prev => prev || name);
    setRecipeIngredients(prev => bowlAddIngredient(prev, name, amount));
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

  // "Suggest quantities" — fill amounts for bowl ingredients that don't have
  // one yet, via the FM-Q2 quantity model. Never overwrites a user-entered
  // amount; model-filled amounts are flagged inferred (editable).
  const [quantityBusy, setQuantityBusy] = useState(false);
  const handleSuggestQuantities = useCallback(async () => {
    const names = bowlNames(recipeIngredients);
    if (names.length === 0) return;
    setQuantityBusy(true);
    try {
      const preds = await predictBowlAmounts(names);
      setRecipeIngredients(prev => {
        let next = prev;
        for (const { name, amount } of preds) {
          if (!amount || !amount.raw) continue;
          const existing = bowlGetAmount(next, name);
          if (existing && existing.raw && !existing.inferred) continue; // keep user input
          next = bowlSetAmount(next, name, amount.raw, { inferred: true });
        }
        return next;
      });
    } finally {
      setQuantityBusy(false);
    }
    hapticLight();
  }, [recipeIngredients]);

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
      {/* B-version + 2026-06-25: the recipe-type pill row (Main/Side/
          Appetizer/…) was removed — it didn't drive anything meaningful
          and crowded the action buttons on mobile. recipeType still
          flows from the handoff (drink/sauce → picker dishType). The
          chrome is now just the action buttons, wrapping + centered. */}
      <div className="flex flex-wrap items-center justify-center gap-2 mx-2 mb-1">
        {recipeIngredients.length > 0 && (
          <>
            <button
              type="button"
              data-testid="recipe-chrome-suggestions"
              onClick={() => openIngredientFlow('suggest')}
              className="min-h-[44px] px-3 py-1 text-sm rounded-md border border-[#c9b99a] bg-[#fefae0] text-[#5a4a2a] hover:bg-[#f0e8d0] whitespace-nowrap"
              style={{ fontFamily: FONT_FAMILY }}
              aria-label="Smart ingredient suggestions for the recipe"
            >
              ✨ Suggest
            </button>
            <button
              type="button"
              data-testid="recipe-chrome-quantities"
              onClick={handleSuggestQuantities}
              disabled={quantityBusy}
              className="min-h-[44px] px-3 py-1 text-sm rounded-md border border-[#c9b99a] bg-[#fefae0] text-[#5a4a2a] hover:bg-[#f0e8d0] whitespace-nowrap disabled:opacity-50"
              style={{ fontFamily: FONT_FAMILY }}
              aria-label="Suggest quantities for the recipe"
            >
              {quantityBusy ? '⚖ …' : '⚖ Amounts'}
            </button>
            <button
              type="button"
              data-testid="recipe-chrome-profiles"
              onClick={() => setProfilesOpen(true)}
              className="min-h-[44px] px-3 py-1 text-sm rounded-md border border-[#c9b99a] bg-[#fefae0] text-[#5a4a2a] hover:bg-[#f0e8d0] whitespace-nowrap"
              style={{ fontFamily: FONT_FAMILY }}
              aria-label="Flavor profiles of the recipe"
            >
              ◆ Flavor Profiles
            </button>
          </>
        )}
        <button
          type="button"
          data-testid="recipe-chrome-add-ingredient"
          onClick={() => openIngredientFlow('add')}
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
          onFocusIngredient={(name) => openIngredientFlow('replace', name)}
          onRequestAdd={() => openIngredientFlow('add')}
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

        {/* Flavor-profile display moved to the "◆ Flavor Profiles" pop-out
            card (chrome button) — RecipeFlavorProfilesCard. */}

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
            candidateNames={pickerMode === 'add' ? null : (pickerCandidates || [])}
            title={pickerLoading
              ? 'Finding ingredients…'
              : pickerMode === 'suggest' ? '✨ Suggested ingredients'
              : pickerMode === 'replace' ? `Replace ${pickerReplaceTarget || 'ingredient'}`
              : 'Ingredient choices'}
            onSelect={(name) => {
              setPickerOpen(false);
              // Manual "+ Add" commits straight to the bowl — no preview step.
              // ✨ Suggest / Smart-swaps keep the before→after profile-delta
              // preview card (that's the point of those flows).
              if (pickerMode === 'add') {
                handleAddIngredient(name);
                return;
              }
              setAddPreview({ name, mode: pickerMode === 'replace' ? 'replace' : 'add', replaceTarget: pickerReplaceTarget });
            }}
            onClose={() => { setPickerOpen(false); setPickerReplaceTarget(null); setPickerCandidates(null); }}
          />
        </div>
      )}

      {/* Flavor-radar preview — the ingredient picked in the "ingredient
          choices" picker, shown as the chalkboard card (before→after radar)
          before committing. One card path for Add / Suggest / Replace;
          ✨ Add / Swap commits, ← Back reopens the picker. */}
      {addPreview && fullData?.graph?.nodes && (
        <div className="fixed inset-0 z-50" data-testid="recipe-add-preview-overlay">
          <SuggestionCardDeck
            mode={addPreview.mode}
            ingredient={addPreview.replaceTarget || null}
            candidates={[addPreview.name]}
            bowlNames={recipeNames}
            nodes={fullData.graph.nodes}
            headerLabel={addPreview.mode === 'replace'
              ? `Replace ${addPreview.replaceTarget}`
              : (pickerMode === 'suggest' ? '✨ Add suggestion' : '✨ Add to recipe')}
            onAdd={(name, amount) => { handleAddIngredient(name, amount); setAddPreview(null); }}
            onSwap={(oldName, newName) => { handleSwapIngredient(oldName, newName); setAddPreview(null); }}
            onClose={() => { setAddPreview(null); setPickerOpen(true); }}
          />
        </div>
      )}

      {/* Flavor Profiles overlay — "◆ Flavor Profiles" chrome button. Per-axis
          carousel with analysis + boost/temper suggestions + a pairings page. */}
      {profilesOpen && fullData?.graph?.nodes && (
        <div className="fixed inset-0 z-40" data-testid="recipe-profiles-overlay">
          <RecipeFlavorProfilesCard
            bowlNames={recipeNames}
            bowlEntries={recipeIngredients}
            nodes={fullData.graph.nodes}
            recipeType={recipeType}
            onAdd={(name, amount) => handleAddIngredient(name, amount)}
            onFindCocktail={onFindCocktail ? () => onFindCocktail(recipeNames, recipeTitle) : null}
            onFindSauce={onFindSauce ? () => onFindSauce(recipeNames, recipeTitle) : null}
            onClose={() => setProfilesOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
