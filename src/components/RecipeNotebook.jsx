import { useState, useRef, useCallback } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { getNeighborsEnriched } from '../data/graph.js';
import { bowlGetAmount } from '../data/bowlEntry.js';
import RecipeDirections from './RecipeDirections.jsx';

const FONT_FAMILY = 'Caveat, cursive';
const LINE_HEIGHT = 28;

function getDominantTaste(name, node) {
  if (!node) return 'default';
  const { channels } = scoreIngredient(name, node);
  let best = 'default', bestVal = 0;
  for (const [ch, val] of Object.entries(channels)) {
    if (val > bestVal) { bestVal = val; best = ch; }
  }
  return bestVal > 0 ? best : 'default';
}

function getMatchPercent(name, centerIngredient, edges, cuisineNeighborIndex) {
  if (!centerIngredient || name === centerIngredient) return null;
  const neighbors = getNeighborsEnriched(centerIngredient, edges, cuisineNeighborIndex);
  const found = neighbors.find(n => n.name === name);
  return found ? Math.round(found.strength * 100) : null;
}

// Display-form for unit tokens. Canonical 'to_taste' surfaces as
// "to taste" (the underscore is a data-layer sentinel, not user copy).
function displayUnit(unit) {
  if (!unit) return '';
  if (unit === 'to_taste') return 'to taste';
  return unit;
}

// Build the chip label. Qty-less amounts (pinch / dash / to_taste /
// "an ounce"-style article forms) show just the unit; numeric amounts
// show "qty unit"; everything else returns null (no chip rendered).
function chipLabel(amount) {
  if (!amount?.unit) return null;
  const u = displayUnit(amount.unit);
  if (amount.qty == null) return u;
  return `${amount.qty} ${u}`;
}

// AmountInput — single-row 64px monospaced input that commits on blur
// or Enter. Shows the structured chip (e.g. "1 tbsp", "pinch",
// "to taste") inline once parseAmount has resolved a unit; raw text
// stays in the input even when parsing fails so the user's typing is
// never discarded.
function AmountInput({ name, amount, onCommit }) {
  const [draft, setDraft] = useState(amount?.raw || '');
  const commit = useCallback(() => {
    if (draft !== (amount?.raw || '')) onCommit(draft);
  }, [draft, amount, onCommit]);
  const chip = chipLabel(amount);
  return (
    <span
      className="flex-shrink-0 inline-flex items-center gap-1"
      style={{ minHeight: 24 }}
    >
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { setDraft(amount?.raw || ''); e.currentTarget.blur(); }
        }}
        placeholder="amount"
        aria-label={`Amount for ${name}`}
        data-testid={`amount-input-${name}`}
        className="w-[64px] px-1 py-0 text-xs bg-transparent border-b border-[#c9b99a]/60 outline-none focus:border-[#7a6a4a] placeholder-[#c9b99a]"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#5a4a2a' }}
      />
      {chip && (
        <span
          className="text-[10px] px-1 rounded"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            backgroundColor: '#e8dcc0',
            color: '#5a4a2a',
          }}
          data-testid={`amount-chip-${name}`}
        >
          {chip}
        </span>
      )}
    </span>
  );
}

/**
 * RecipeNotebook — Scrollable ingredient list with notebook styling.
 *
 * Props (RL-PORTIONS-UI 2026-05-29 — bowl shape is BowlEntry[]):
 *   bowl: BowlEntry[]                       — recipe ingredients
 *   centerIngredient: string | null
 *   nodes: Map<string, Object>
 *   edges: Array
 *   onRemove: (name) => void
 *   onRecenter: (name) => void
 *   onAmountChange: (name, rawText) => void — §11.3 per-row amount commit
 *   recipeTitle: string
 *   onTitleChange: (title) => void
 *   compatibility: number | null (0-100)
 */
export default function RecipeNotebook({
  bowl = [],
  centerIngredient,
  nodes,
  edges,
  cuisineNeighborIndex = null,
  onRemove,
  onRecenter,
  onAmountChange,
  onFocusIngredient,
  onRequestAdd,
  onRequestSuggestions,
  onFindCocktail,
  onFindSauce,
  aromaDisabled = false,
  recipeTitle,
  onTitleChange,
  compatibility,
  focalKey = null,
  onSetFocal,
}) {
  const entries = bowl;
  // Track swipe-to-delete state
  const [swipedItem, setSwipedItem] = useState(null);
  const touchStart = useRef({ x: 0, y: 0, name: null });

  // §13.3 focal-flag popover. Open via tap-and-hold (500ms) on mobile
  // or right-click on desktop. `focalMenuFor` is the ingredient name
  // whose popover is currently open (null = closed).
  const [focalMenuFor, setFocalMenuFor] = useState(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = useCallback((name) => {
    clearLongPress();
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setFocalMenuFor(name);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    clearLongPress();
  }, []);

  const handleContextMenu = useCallback((e, name) => {
    e.preventDefault();
    setFocalMenuFor(name);
  }, []);

  const closeFocalMenu = useCallback(() => setFocalMenuFor(null), []);

  const toggleFocal = useCallback((name) => {
    onSetFocal?.(name);
    setFocalMenuFor(null);
  }, [onSetFocal]);

  const handleTouchStart = useCallback((e, name) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, name };
    startLongPress(name);
  }, [startLongPress]);

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStart.current.x);
    const dy = Math.abs(touch.clientY - touchStart.current.y);
    if (dx > 10 || dy > 10) cancelLongPress();
  }, [cancelLongPress]);

  const handleTouchEnd = useCallback((e) => {
    cancelLongPress();
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = Math.abs(touch.clientY - touchStart.current.y);
    // Swipe left detection: horizontal > 60px, more horizontal than vertical
    if (dx < -60 && dy < 40) {
      setSwipedItem(touchStart.current.name);
    } else if (dx > 30) {
      setSwipedItem(null); // swipe right to dismiss
    }
    touchStart.current = { x: 0, y: 0, name: null };
  }, [cancelLongPress]);

  if (entries.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center px-6"
        style={{ backgroundColor: '#fefae0' }}
      >
        <div className="text-center" style={{ fontFamily: FONT_FAMILY }}>
          <p className="text-2xl mb-1" style={{ color: '#a09070', fontStyle: 'italic' }}>
            Start your recipe...
          </p>
          <p className="text-lg" style={{ color: '#c9b99a' }}>
            Search for an ingredient above to build around
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        backgroundColor: '#fefae0',
        backgroundImage: `repeating-linear-gradient(transparent, transparent ${LINE_HEIGHT - 1}px, #c9b99a ${LINE_HEIGHT - 1}px, #c9b99a ${LINE_HEIGHT}px)`,
        backgroundPositionY: '4px',
      }}
    >
      {/* Red margin line */}
      <div
        className="absolute left-[40px] top-0 bottom-0 w-[1px]"
        style={{ backgroundColor: '#e07070', opacity: 0.5 }}
      />

      {/* Title input */}
      <div className="px-4 pt-2 pb-1" style={{ paddingLeft: 48 }}>
        <input
          type="text"
          value={recipeTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled Recipe"
          className="w-full bg-transparent outline-none text-xl font-medium placeholder-[#c9b99a]"
          style={{ fontFamily: FONT_FAMILY, color: '#3a3428', lineHeight: `${LINE_HEIGHT}px` }}
        />
      </div>

      {/* Ingredient list */}
      <div className="px-2" style={{ paddingLeft: 48 }}>
        {entries.map((entry) => {
          const name = entry.ingredient;
          const amount = bowlGetAmount(entries, name);
          const isCenter = name === centerIngredient;
          const taste = getDominantTaste(name, nodes?.get(name));
          const tasteColor = TASTE_COLORS[taste] || TASTE_COLORS.default;
          const matchPct = getMatchPercent(name, centerIngredient, edges, cuisineNeighborIndex);
          const isSwiped = swipedItem === name;

          const isFocal = focalKey === name;
          return (
            <div
              key={name}
              data-testid={`notebook-row-${name}`}
              className="relative flex items-center gap-2 pr-2 transition-transform"
              style={{
                height: LINE_HEIGHT,
                transform: isSwiped ? 'translateX(-70px)' : 'translateX(0)',
                transition: 'transform 200ms ease-out',
              }}
              onTouchStart={(e) => handleTouchStart(e, name)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => handleContextMenu(e, name)}
            >
              {/* R pill — opens the ingredient-specific suggestions
                  popout (replaces the hex graphic). User redesign
                  2026-05-07. */}
              {onFocusIngredient && (
                <button
                  onClick={() => onFocusIngredient(name)}
                  title={`Replace ${name} — see suggestions`}
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-full bg-[#e8dcc0] hover:bg-[#dccaa6] active:bg-[#c9b99a] transition-colors"
                  style={{
                    width: 22, height: 22, minWidth: 22,
                    fontFamily: FONT_FAMILY,
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#7a6a4a',
                    border: '1.5px solid #c9b99a',
                  }}
                >
                  R
                </button>
              )}
              {/* Taste color accent */}
              <div
                className="w-[3px] self-stretch rounded-full flex-shrink-0"
                style={{ backgroundColor: tasteColor }}
              />

              {/* Icon: diamond for center, circle for others */}
              <span
                className="flex-shrink-0 inline-block"
                style={{
                  width: 8, height: 8,
                  backgroundColor: tasteColor,
                  borderRadius: isCenter ? 0 : '50%',
                  transform: isCenter ? 'rotate(45deg)' : 'none',
                }}
              />

              {/* Name */}
              <span
                className="flex-1 truncate text-base min-w-0"
                style={{
                  fontFamily: FONT_FAMILY,
                  color: '#3a3428',
                  fontWeight: isCenter ? 600 : 400,
                }}
              >
                {name}
              </span>

              {/* §13.3 focal badge */}
              {isFocal && (
                <span
                  data-testid={`focal-badge-${name}`}
                  className="flex-shrink-0 inline-flex items-center px-1.5 text-[10px] rounded-full"
                  style={{
                    fontFamily: FONT_FAMILY,
                    color: tasteColor,
                    borderColor: tasteColor,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    backgroundColor: '#fefae0',
                    lineHeight: '16px',
                  }}
                >
                  focal
                </span>
              )}

              {/* Amount input (RL-PORTIONS-UI §11.3) — inline, ~64px,
                  monospaced; commits on blur or Enter. Raw text always
                  persists; parsed chip surfaces when parseAmount
                  resolved a structured qty+unit. */}
              {onAmountChange && (
                <AmountInput
                  name={name}
                  amount={amount}
                  onCommit={(raw) => onAmountChange(name, raw)}
                />
              )}

              {/* Match % */}
              {matchPct !== null && (
                <span
                  className="text-xs flex-shrink-0"
                  style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}
                >
                  {matchPct}%
                </span>
              )}

              {/* Recenter button */}
              {!isCenter && (
                <button
                  onClick={() => onRecenter(name)}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#e8dcc0] transition-colors"
                  title="Recenter on this ingredient"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#a09070" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-9-9h18" />
                  </svg>
                </button>
              )}

              {/* Remove button (desktop) */}
              <button
                onClick={() => { onRemove(name); setSwipedItem(null); }}
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-100 transition-colors"
                title="Remove"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#a09070" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* §13.3 focal popover — opens via tap-and-hold (mobile)
                  or right-click (desktop). One item: Set/Clear focal. */}
              {focalMenuFor === name && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={closeFocalMenu}
                    onContextMenu={(e) => { e.preventDefault(); closeFocalMenu(); }}
                    data-testid={`focal-menu-backdrop-${name}`}
                  />
                  <div
                    className="absolute right-2 top-full mt-1 z-[61] rounded-md border bg-[#fefae0] shadow-lg"
                    style={{ borderColor: '#c9b99a', minWidth: 140 }}
                    data-testid={`focal-menu-${name}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFocal(name)}
                      data-testid={`focal-menu-toggle-${name}`}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-[#f0e8d0]"
                      style={{ fontFamily: FONT_FAMILY, color: '#3a3428', minHeight: 40 }}
                    >
                      {isFocal ? 'Clear focal' : 'Set as focal'}
                    </button>
                  </div>
                </>
              )}

              {/* Swipe-to-delete reveal */}
              {isSwiped && (
                <button
                  className="absolute right-0 top-0 bottom-0 w-[70px] flex items-center justify-center bg-red-400 text-white text-xs font-medium"
                  style={{ fontFamily: FONT_FAMILY, transform: 'translateX(100%)' }}
                  onClick={() => { onRemove(name); setSwipedItem(null); }}
                >
                  Delete
                </button>
              )}
            </div>
          );
        })}
        {/* + Add ingredient row — focuses the search input above the
            notebook so the user can type a new ingredient. Sits at the
            end of the list per the redesign sketch. */}
        {onRequestAdd && (
          <button
            onClick={onRequestAdd}
            className="w-full flex items-center gap-2 pr-2 hover:bg-[#f0e8d0] active:bg-[#e8dcc0] transition-colors rounded"
            style={{ height: LINE_HEIGHT, fontFamily: FONT_FAMILY }}
            title="Add an ingredient"
          >
            <span
              className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
              style={{
                width: 22, height: 22,
                fontSize: 16, fontWeight: 700,
                color: '#7a6a4a',
                background: '#fefae0',
                border: '1.5px dashed #c9b99a',
              }}
            >
              +
            </span>
            <span style={{ color: '#a09070', fontSize: 16 }}>Add ingredient…</span>
          </button>
        )}
        {/* Suggestions row — opens IngredientSuggestionsPopout in
            add-mode, ranking candidates by avg pair strength to the
            whole bowl. Mirrors the + Add row's height/style for
            visual rhythm. */}
        {onRequestSuggestions && entries.length > 0 && (
          <button
            onClick={onRequestSuggestions}
            className="w-full flex items-center gap-2 pr-2 hover:bg-[#f0e8d0] active:bg-[#e8dcc0] transition-colors rounded"
            style={{ height: LINE_HEIGHT, fontFamily: FONT_FAMILY }}
            title="Suggest ingredients that pair with the bowl"
          >
            <span
              className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
              style={{
                width: 22, height: 22,
                fontSize: 14, fontWeight: 700,
                color: '#7a6a4a',
                background: '#e8dcc0',
                border: '1.5px solid #c9b99a',
              }}
            >
              ★
            </span>
            <span style={{ color: '#a09070', fontSize: 16 }}>Suggestions…</span>
          </button>
        )}
        {/* P8: Aroma-match pills — route this recipe to Cocktail Lab or
            Sauce Lab pre-populated with matched items. Disabled (not
            hidden) when zero ingredients have GNN aroma data so the
            feature is still discoverable. */}
        {(onFindCocktail || onFindSauce) && entries.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 pb-1">
            {onFindCocktail && (
              <button
                onClick={aromaDisabled ? undefined : onFindCocktail}
                disabled={aromaDisabled}
                aria-label={`Find a cocktail to pair with ${recipeTitle || 'this recipe'}`}
                title={aromaDisabled ? 'Need at least one ingredient with flavor data' : 'Find cocktails that share aroma notes with this recipe'}
                className="w-full flex items-center gap-2 pr-2 rounded transition-colors"
                style={{
                  height: LINE_HEIGHT,
                  fontFamily: FONT_FAMILY,
                  opacity: aromaDisabled ? 0.45 : 1,
                  cursor: aromaDisabled ? 'not-allowed' : 'pointer',
                  background: aromaDisabled ? 'transparent' : undefined,
                }}
                onMouseEnter={e => { if (!aromaDisabled) e.currentTarget.style.background = '#f0e8d0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 22, height: 22,
                    fontSize: 13, fontWeight: 700,
                    color: aromaDisabled ? '#b8a88a' : '#7a5a2a',
                    background: aromaDisabled ? '#f0e8d0' : '#fde8a0',
                    border: '1.5px solid #c9b99a',
                  }}
                >
                  🍸
                </span>
                <span style={{ color: aromaDisabled ? '#b8a88a' : '#7a5a2a', fontSize: 15 }}>
                  Find a Cocktail to serve with this recipe
                </span>
              </button>
            )}
            {onFindSauce && (
              <button
                onClick={aromaDisabled ? undefined : onFindSauce}
                disabled={aromaDisabled}
                aria-label={`Find a sauce to pair with ${recipeTitle || 'this recipe'}`}
                title={aromaDisabled ? 'Need at least one ingredient with flavor data' : 'Find sauces that share aroma notes with this recipe'}
                className="w-full flex items-center gap-2 pr-2 rounded transition-colors"
                style={{
                  height: LINE_HEIGHT,
                  fontFamily: FONT_FAMILY,
                  opacity: aromaDisabled ? 0.45 : 1,
                  cursor: aromaDisabled ? 'not-allowed' : 'pointer',
                  background: aromaDisabled ? 'transparent' : undefined,
                }}
                onMouseEnter={e => { if (!aromaDisabled) e.currentTarget.style.background = '#f0e8d0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 22, height: 22,
                    fontSize: 13, fontWeight: 700,
                    color: aromaDisabled ? '#b8a88a' : '#7a5a2a',
                    background: aromaDisabled ? '#f0e8d0' : '#ffd0a0',
                    border: '1.5px solid #c9b99a',
                  }}
                >
                  🥣
                </span>
                <span style={{ color: aromaDisabled ? '#b8a88a' : '#7a5a2a', fontSize: 15 }}>
                  Need a sauce for this recipe?
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compatibility score */}
      {compatibility !== null && entries.length >= 2 && (
        <div className="px-4 pt-3 pb-2" style={{ paddingLeft: 48 }}>
          <span
            className="text-base"
            style={{ fontFamily: FONT_FAMILY, color: '#7a6a4a' }}
          >
            Compatibility: {Math.round(compatibility)}%
          </span>
        </div>
      )}

      {/* FM-DIR1: grounded directions from the most set-similar real recipe. */}
      <RecipeDirections bowlNames={entries.map((e) => e?.ingredient).filter(Boolean)} />
    </div>
  );
}
