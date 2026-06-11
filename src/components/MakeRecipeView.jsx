/**
 * MakeRecipeView — parent surface for the B-version "Make a Recipe"
 * top-level destination. (Spec §MAKE-RECIPE-CARDS.)
 *
 * Body conditional on dish-type joystick:
 *   - cocktail → renders CocktailLab inside body (preserves curated UI)
 *   - sauce    → renders SauceLab inside body
 *   - else     → renders MakeRecipeCardsGrid (chalkboard cards)
 *
 * Header chrome (chalkboard menu look):
 *   - "Recipe Name" content-editable title
 *   - Dish-type joystick (RecipeTypePills)
 *   - "+ Add" launcher → opens IngredientPicker as modal
 *   - Menu overflow: "Save to Notebook" + "Examine in Network" stubs
 *
 * Card tap inside grid → opens PairingMode for that ingredient via
 * the parent (App.jsx setPairingModeFocal).
 *
 * B-version note: the "Examine in Network" cluster fly-by tour is a
 * stub here — wiring it to ClusterFocusMode is a P5 follow-up.
 */

import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import RecipeTypePills from './RecipeTypePills.jsx';
import MakeRecipeCardsGrid, { suggestPortion } from './MakeRecipeCardsGrid.jsx';
import IngredientPicker from './IngredientPicker.jsx';
import { predictAmount } from '../ml/quantityRuntime.js';

const CocktailLabV2 = lazy(() => import('./CocktailLabV2.jsx'));
const SauceLab = lazy(() => import('./SauceLab.jsx'));

const FONT_HAND = 'Caveat, cursive';
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

export default function MakeRecipeView({
  data = null,
  initialIngredients = [],
  initialDishType = null,
  initialTitle = '',
  initialImageUrl = null,
  onCardTap,
  onSaveToNotebook,
  onExamineInNetwork,
  onBack,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [dishType, setDishType] = useState(initialDishType);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [portions, setPortions] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAdd = (name) => {
    if (!name) return;
    // B-version (2026-06-03): duplicates allowed. Each commit appends,
    // even if the ingredient is already in the recipe (the picker shows
    // an "already added" badge so the user knows it's a re-add).
    setIngredients((prev) => [...prev, name]);
  };
  const handleRemove = (slotIdx) => {
    if (typeof slotIdx !== 'number') return;
    setIngredients((prev) => prev.filter((_, i) => i !== slotIdx));
    // Drop the portion entry keyed to that slot (composite "name#idx").
    setPortions((prev) => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        const m = k.match(/^(.*)#(\d+)$/);
        if (!m) { next[k] = v; continue; }
        const idx = Number(m[2]);
        if (idx === slotIdx) continue;
        const newIdx = idx > slotIdx ? idx - 1 : idx;
        next[`${m[1]}#${newIdx}`] = v;
      }
      return next;
    });
  };
  const handlePortionChange = (slotKey, value) => {
    setPortions((prev) => ({ ...prev, [slotKey]: value }));
  };
  const handleSuggestPortion = (slotKey, name) => {
    // Instant heuristic fill (synchronous) for immediate feedback, then upgrade
    // to the data-driven FM-Q2 quantity-model value when it resolves.
    const node = data?.graph?.nodes?.get?.(name);
    const heuristic = suggestPortion(node, ingredients.length);
    if (heuristic) {
      setPortions((prev) => ({ ...prev, [slotKey]: heuristic }));
    }
    predictAmount(name)
      .then((amount) => {
        if (amount?.raw) setPortions((prev) => ({ ...prev, [slotKey]: amount.raw }));
      })
      .catch(() => { /* model unavailable → keep heuristic */ });
  };

  // Swipe-down at the page level returns to the entry router (per user
  // 2026-06-03 — iOS users couldn't back out of the cards-grid).
  // 80px vertical drop ≥ horizontal travel triggers the back action.
  const touchStartRef = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !onBack) return;
    const t = (e.changedTouches?.[0]) || null;
    if (!t) return;
    const dy = t.clientY - start.y;
    const dx = Math.abs(t.clientX - start.x);
    if (dy > 80 && dy > dx) onBack();
  };
  useEffect(() => {
    if (!onBack) return;
    const onKey = (e) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const isCocktail = dishType === 'drink' || dishType === 'cocktail';
  const isSauce = dishType === 'sauce';

  return (
    <div
      className="min-h-screen w-full flex flex-col px-4 py-4 sm:px-6 sm:py-6"
      style={{ background: CHALK_BG }}
      data-testid="make-recipe-view"
      data-dish-type={dishType || ''}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {onBack && (
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => onBack()}
            data-testid="make-recipe-back"
            className="px-3 py-2 rounded-md"
            style={{
              color: CHALK_CREAM,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid #6a6a6a`,
              fontFamily: FONT_HAND,
              fontSize: 17,
              textShadow: CHALK_TEXT_SHADOW,
            }}
            aria-label="Back to recipe start"
          >
            ← Back
          </button>
          <span
            style={{ color: '#8a8478', fontFamily: FONT_HAND, fontSize: 13, textShadow: CHALK_TEXT_SHADOW }}
          >
            ↓ swipe down to go back
          </span>
        </div>
      )}
      <div
        className="w-full max-w-3xl mx-auto rounded-2xl px-4 py-4 mb-4"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: `2px double #4a4a4a`,
          boxShadow: 'inset 0 0 0 1px #6a6a6a55',
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Recipe name…"
            data-testid="make-recipe-title"
            className="flex-1 bg-transparent border-0 outline-none placeholder:opacity-50"
            style={{
              color: CHALK_CREAM,
              fontFamily: FONT_HAND,
              fontSize: 32,
              textShadow: CHALK_TEXT_SHADOW,
            }}
          />
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="make-recipe-menu"
              className="px-3 py-2 rounded-md"
              style={{
                color: CHALK_CREAM,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid #6a6a6a`,
                fontFamily: FONT_HAND,
                fontSize: 18,
                textShadow: CHALK_TEXT_SHADOW,
              }}
              aria-label="Recipe menu"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded-md py-1 z-30"
                style={{
                  background: '#0a0a0a',
                  border: `1px solid #6a6a6a`,
                  minWidth: 220,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
                }}
                data-testid="make-recipe-menu-popover"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSaveToNotebook?.({ title, dishType, ingredients, portions });
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-white/5"
                  style={{
                    color: CHALK_CREAM,
                    fontFamily: FONT_HAND,
                    fontSize: 18,
                    textShadow: CHALK_TEXT_SHADOW,
                  }}
                  data-testid="make-recipe-menu-save"
                >
                  Save to Recipe Notebook
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onExamineInNetwork?.({ title, dishType, ingredients, portions });
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-white/5"
                  style={{
                    color: CHALK_CREAM,
                    fontFamily: FONT_HAND,
                    fontSize: 18,
                    textShadow: CHALK_TEXT_SHADOW,
                  }}
                  data-testid="make-recipe-menu-tour"
                >
                  Examine in Network →
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <RecipeTypePills value={dishType} onChange={setDishType} />
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            data-testid="make-recipe-add"
            className="flex-shrink-0 px-4 py-2 rounded-md"
            style={{
              color: CHALK_CREAM,
              background: 'rgba(255,255,255,0.04)',
              border: `1.5px solid #6a6a6a`,
              fontFamily: FONT_HAND,
              fontSize: 18,
              textShadow: CHALK_TEXT_SHADOW,
              minHeight: 40,
            }}
            aria-label="Add ingredient via picker"
          >
            + Add
          </button>
        </div>
      </div>

      {initialImageUrl && (
        <div className="w-full max-w-3xl mx-auto mb-3 flex items-center gap-3">
          <img
            src={initialImageUrl}
            alt="Recipe photo"
            data-testid="make-recipe-image-thumbnail"
            className="rounded-lg object-cover"
            style={{
              height: 96,
              maxWidth: 160,
              border: `1.5px solid #6a6a6a`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
            }}
          />
          <span
            style={{
              color: CHALK_DIM,
              fontFamily: FONT_HAND,
              fontSize: 16,
              textShadow: CHALK_TEXT_SHADOW,
            }}
          >
            Photo attached. Use "+ Add" to chalk in the ingredients.
          </span>
        </div>
      )}

      <div className="w-full max-w-3xl mx-auto flex-1">
        {isCocktail ? (
          <div data-testid="make-recipe-cocktail-variant">
            <Suspense fallback={<div style={{ color: CHALK_DIM, fontFamily: FONT_HAND }} className="text-center py-8">Loading cocktail lab…</div>}>
              <CocktailLabV2 fullData={data} />
            </Suspense>
          </div>
        ) : isSauce ? (
          <div data-testid="make-recipe-sauce-variant">
            <Suspense fallback={<div style={{ color: CHALK_DIM, fontFamily: FONT_HAND }} className="text-center py-8">Loading sauce lab…</div>}>
              <SauceLab fullData={data} />
            </Suspense>
          </div>
        ) : (
          <MakeRecipeCardsGrid
            ingredients={ingredients}
            nodes={data?.graph?.nodes || null}
            portions={portions}
            onCardTap={onCardTap}
            onRemove={handleRemove}
            onPortionChange={handlePortionChange}
            onSuggestPortion={handleSuggestPortion}
          />
        )}
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center px-4 py-8 bg-black/70 backdrop-blur-sm"
          data-testid="make-recipe-picker-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <IngredientPicker
            mode="notebook"
            ctx={{
              graph: data?.graph,
              gnnEntropy: data?.gnnEntropy || null,
              cuisineMap: data?.cuisineMap || null,
              seasonMap: data?.seasonMap || null,
              cuisineNeighborIndex: data?.cuisineNeighborIndex || null,
            }}
            dishType={isCocktail ? 'cocktail' : isSauce ? 'sauce' : null}
            alreadyAdded={ingredients}
            onSelect={handleAdd}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
