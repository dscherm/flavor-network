import { useState, useRef, useCallback } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { getNeighbors } from '../data/graph.js';

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

function getMatchPercent(name, centerIngredient, edges) {
  if (!centerIngredient || name === centerIngredient) return null;
  const neighbors = getNeighbors(centerIngredient, edges);
  const found = neighbors.find(n => n.name === name);
  return found ? Math.round(found.strength * 100) : null;
}

/**
 * RecipeNotebook — Scrollable ingredient list with notebook styling.
 *
 * Props:
 *   ingredients: string[]
 *   centerIngredient: string | null
 *   nodes: Map<string, Object>
 *   edges: Array
 *   onRemove: (name) => void
 *   onRecenter: (name) => void
 *   recipeTitle: string
 *   onTitleChange: (title) => void
 *   compatibility: number | null (0-100)
 */
export default function RecipeNotebook({
  ingredients = [],
  centerIngredient,
  nodes,
  edges,
  onRemove,
  onRecenter,
  onFocusIngredient,    // (name) => void — opens suggestions popout for that ingredient
  onRequestAdd,         // () => void — fires when user taps the "+ Add ingredient" row
  recipeTitle,
  onTitleChange,
  compatibility,
}) {
  // Track swipe-to-delete state
  const [swipedItem, setSwipedItem] = useState(null);
  const touchStart = useRef({ x: 0, y: 0, name: null });

  const handleTouchStart = useCallback((e, name) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, name };
  }, []);

  const handleTouchEnd = useCallback((e) => {
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
  }, []);

  if (ingredients.length === 0) {
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
        {ingredients.map((name) => {
          const isCenter = name === centerIngredient;
          const taste = getDominantTaste(name, nodes?.get(name));
          const tasteColor = TASTE_COLORS[taste] || TASTE_COLORS.default;
          const matchPct = getMatchPercent(name, centerIngredient, edges);
          const isSwiped = swipedItem === name;

          return (
            <div
              key={name}
              className="relative flex items-center gap-2 pr-2 transition-transform"
              style={{
                height: LINE_HEIGHT,
                transform: isSwiped ? 'translateX(-70px)' : 'translateX(0)',
                transition: 'transform 200ms ease-out',
              }}
              onTouchStart={(e) => handleTouchStart(e, name)}
              onTouchEnd={handleTouchEnd}
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
                className="flex-1 truncate text-base"
                style={{
                  fontFamily: FONT_FAMILY,
                  color: '#3a3428',
                  fontWeight: isCenter ? 600 : 400,
                }}
              >
                {name}
              </span>

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
      </div>

      {/* Compatibility score */}
      {compatibility !== null && ingredients.length >= 2 && (
        <div className="px-4 pt-3 pb-2" style={{ paddingLeft: 48 }}>
          <span
            className="text-base"
            style={{ fontFamily: FONT_FAMILY, color: '#7a6a4a' }}
          >
            Compatibility: {Math.round(compatibility)}%
          </span>
        </div>
      )}
    </div>
  );
}
