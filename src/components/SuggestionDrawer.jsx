import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { getNeighbors } from '../data/graph.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { findWeakestAxis, aggregateRecipeTastes } from '../data/tasteScoring.js';
import { analyzeRecipe } from '../data/recipeAnalysis.js';
import { rankByRecipeCooccurrence } from '../data/recipeSuggestionEngine.js';
import OdorBadge from './OdorBadge.jsx';

// `?engine=v1` forces the legacy avg-NPMI ranking even when the new
// engine has data. Default = v2 (recipe-level co-occurrence). Read once
// at module load — switching mid-session requires a refresh.
const ENGINE_MODE = (() => {
  if (typeof window === 'undefined') return 'v2';
  const p = new URLSearchParams(window.location.search).get('engine');
  return p === 'v1' ? 'v1' : 'v2';
})();
if (typeof window !== 'undefined' && !window.__fnEngineLogged) {
  window.__fnEngineLogged = true;
  // eslint-disable-next-line no-console
  console.log('[SuggestionDrawer] engine =', ENGINE_MODE);
}

const FONT_FAMILY = 'Caveat, cursive';
const AXES = ['sweet', 'salty', 'sour', 'bitter', 'umami', 'spicy', 'pungent', 'astringent'];

function ChipButton({ chip, onAdd, showTasteBadge = false, centerIngredient, bridgeCompounds }) {
  return (
    <button
      onClick={() => !chip.inRecipe && onAdd(chip.name)}
      disabled={chip.inRecipe}
      className="flex items-start gap-1.5 p-2 rounded-lg border text-left transition-colors"
      style={{
        borderColor: chip.inRecipe ? '#e8dcc0' : '#c9b99a',
        backgroundColor: chip.inRecipe ? '#f5edd0' : '#fefae0',
        opacity: chip.inRecipe ? 0.5 : 1,
        borderLeftWidth: 3,
        borderLeftColor: TASTE_COLORS[chip.taste] || TASTE_COLORS.default,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span
            className="text-sm truncate"
            style={{ fontFamily: FONT_FAMILY, color: '#3a3428' }}
          >
            {chip.name}
          </span>
          <span
            className="text-xs flex-shrink-0"
            style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}
          >
            {chip.matchPct}%
          </span>
          {centerIngredient && (
            <OdorBadge a={centerIngredient} b={chip.name} bridgeCompounds={bridgeCompounds} compact />
          )}
        </div>
        {showTasteBadge && chip.taste !== 'default' ? (
          <div className="flex gap-1 mt-0.5">
            <span
              className="text-[10px] px-1.5 rounded-full"
              style={{
                fontFamily: FONT_FAMILY,
                color: '#fff',
                backgroundColor: TASTE_COLORS[chip.taste] || TASTE_COLORS.default,
              }}
            >
              {chip.taste}
            </span>
          </div>
        ) : chip.tasteLabels.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {chip.tasteLabels.map(t => (
              <span
                key={t}
                className="text-[10px] px-1 rounded"
                style={{
                  fontFamily: FONT_FAMILY,
                  color: '#7a6a4a',
                  backgroundColor: `${TASTE_COLORS[t] || TASTE_COLORS.default}22`,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      {!chip.inRecipe && (
        <span className="text-base flex-shrink-0" style={{ color: '#a09070' }}>+</span>
      )}
    </button>
  );
}

// Snap points (from bottom of screen)
const PEEK_HEIGHT = 56;
const HALF_RATIO = 0.4;   // 40vh
const FULL_RATIO = 0.75;  // 75vh

function getSnapHeight(state, viewportHeight) {
  if (state === 'peek') return PEEK_HEIGHT;
  if (state === 'half') return viewportHeight * HALF_RATIO;
  return viewportHeight * FULL_RATIO;
}

function nearestSnap(y, viewportHeight) {
  const peek = PEEK_HEIGHT;
  const half = viewportHeight * HALF_RATIO;
  const full = viewportHeight * FULL_RATIO;
  const dists = [
    { state: 'peek', d: Math.abs(y - peek) },
    { state: 'half', d: Math.abs(y - half) },
    { state: 'full', d: Math.abs(y - full) },
  ];
  dists.sort((a, b) => a.d - b.d);
  return dists[0].state;
}

function getDominantTaste(name, node) {
  if (!node) return 'default';
  const { channels } = scoreIngredient(name, node);
  let best = 'default', bestVal = 0;
  for (const [ch, val] of Object.entries(channels)) {
    if (val > bestVal) { bestVal = val; best = ch; }
  }
  return bestVal > 0 ? best : 'default';
}

function getTasteLabels(name, node) {
  if (!node) return [];
  const { channels } = scoreIngredient(name, node);
  return Object.entries(channels)
    .filter(([, v]) => v > 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([ch]) => ch);
}

/**
 * SuggestionDrawer — Bottom sheet with taste tabs and ingredient chips.
 *
 * Props:
 *   centerIngredient: string | null
 *   recipeIngredients: string[]
 *   nodes: Map<string, Object>
 *   edges: Array
 *   onAddIngredient: (name) => void
 *   activeTab: string | null — externally controlled active taste tab (from wheel tap)
 *   onTabChange: (tab) => void
 *   snapState: 'peek' | 'half' | 'full'
 *   onSnapChange: (state) => void
 *   labMode: string
 *   selectedStructure: string | null
 */
export default function SuggestionDrawer({
  centerIngredient,
  recipeIngredients = [],
  nodes,
  edges,
  onAddIngredient,
  activeTab = 'all',
  onTabChange,
  snapState = 'peek',
  onSnapChange,
  labMode = 'taste',
  selectedStructure = null,
  bridgeCompounds,
  recipePairs = null,
  globalCount = null,
}) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, startHeight: 0, dragging: false });
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [suggestion, setSuggestion] = useState(null);
  // Scaffolded filter surface: show ONE filter class at a time (taste OR
  // cuisine) rather than both in one long strip — avoids overwhelming.
  const [filterMode, setFilterMode] = useState('taste');

  // If the user switches modes, drop them back to "all" so stale taste
  // selection doesn't hide cuisine-filtered results, and vice versa.
  const switchMode = useCallback((mode) => {
    setFilterMode(mode);
    onTabChange?.('all');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onTabChange]);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sheetHeight = getSnapHeight(snapState, viewportHeight);

  // Drag gesture
  const handleDragStart = useCallback((clientY) => {
    dragRef.current = { startY: clientY, startHeight: sheetHeight, dragging: true };
  }, [sheetHeight]);

  const handleDragMove = useCallback((clientY) => {
    if (!dragRef.current.dragging || !sheetRef.current) return;
    const dy = dragRef.current.startY - clientY;
    const newHeight = Math.max(PEEK_HEIGHT, Math.min(viewportHeight * FULL_RATIO, dragRef.current.startHeight + dy));
    sheetRef.current.style.height = `${newHeight}px`;
    sheetRef.current.style.transition = 'none';
  }, [viewportHeight]);

  const handleDragEnd = useCallback((clientY) => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    const dy = dragRef.current.startY - clientY;
    const finalHeight = Math.max(PEEK_HEIGHT, dragRef.current.startHeight + dy);
    const snap = nearestSnap(finalHeight, viewportHeight);
    if (sheetRef.current) sheetRef.current.style.transition = '';
    onSnapChange(snap);
  }, [viewportHeight, onSnapChange]);

  // Touch events on drag handle
  const handleTouchStart = useCallback((e) => {
    handleDragStart(e.touches[0].clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e) => {
    handleDragMove(e.touches[0].clientY);
  }, [handleDragMove]);

  const handleTouchEnd = useCallback((e) => {
    handleDragEnd(e.changedTouches[0].clientY);
  }, [handleDragEnd]);

  // Engine v2: rank candidates by recipe-level co-occurrence × familiarity,
  // pulling from the entire bowl (recipeIngredients ∪ centerIngredient) so
  // suggestions reflect the *recipe direction*, not just the searched item.
  // v1 fallback uses the legacy pairwise NPMI from `edges` for A/B comparison.
  const useV2 = ENGINE_MODE === 'v2' && !!recipePairs && !!globalCount;

  const pairings = useMemo(() => {
    if (useV2) {
      const bowl = [...new Set([...(recipeIngredients || []), ...(centerIngredient ? [centerIngredient] : [])])];
      if (bowl.length === 0) return [];
      return rankByRecipeCooccurrence(bowl, recipePairs, globalCount, 100);
    }
    if (!centerIngredient || !edges) return [];
    return getNeighbors(centerIngredient, edges);
  }, [useV2, centerIngredient, recipeIngredients, edges, recipePairs, globalCount]);

  // Decorate pairings with taste tags + in-recipe state. In v2 the strength
  // is already aggregated over the bowl, so no per-chip avg loop is needed.
  // In v1, fall back to the legacy avg-pairwise computation.
  const chipData = useMemo(() => {
    if (!nodes || pairings.length === 0) return [];
    const recipeSet = new Set(recipeIngredients);

    return pairings.map(({ name, strength }) => {
      const node = nodes.get(name);
      const taste = getDominantTaste(name, node);
      const tasteLabels = getTasteLabels(name, node);
      const inRecipe = recipeSet.has(name);

      let finalStrength = strength;
      if (!useV2 && recipeIngredients.length > 1) {
        let total = 0, count = 0;
        for (const ri of recipeIngredients) {
          if (ri === name) continue;
          const riNeighbors = getNeighbors(ri, edges);
          const found = riNeighbors.find(n => n.name === name);
          if (found) { total += found.strength; count++; }
        }
        if (count > 0) finalStrength = total / count;
      }

      return { name, strength: finalStrength, taste, tasteLabels, inRecipe, matchPct: Math.round(finalStrength * 100) };
    }).sort((a, b) => {
      if (a.inRecipe !== b.inRecipe) return a.inRecipe ? 1 : -1;
      return b.strength - a.strength;
    });
  }, [pairings, nodes, edges, recipeIngredients, useV2]);

  // Filter by active tab — split into matches + complements for taste tabs
  const { filteredChips, complementChips } = useMemo(() => {
    if (activeTab === 'all') return { filteredChips: chipData, complementChips: [] };
    if (activeTab === 'best') {
      if (!nodes || recipeIngredients.length === 0) return { filteredChips: chipData, complementChips: [] };
      const profile = aggregateRecipeTastes(recipeIngredients, nodes);
      const [weakAxis] = findWeakestAxis(profile.normalized);
      const matches = chipData.filter(c => c.taste === weakAxis || c.tasteLabels.includes(weakAxis));
      return { filteredChips: matches, complementChips: [] };
    }
    // Cuisine tab — filter by the chip's node.cuisines list.
    if (activeTab.startsWith('cuisine:')) {
      const target = activeTab.slice(8).toLowerCase();
      const matches = chipData.filter(c => {
        const node = nodes?.get(c.name);
        const cuisines = (node?.cuisines || []).map(x => String(x).toLowerCase());
        return cuisines.includes(target);
      });
      return { filteredChips: matches, complementChips: [] };
    }
    // Taste tab: split into matching taste + high-strength complements from other tastes
    const matches = [];
    const complements = [];
    const MIN_COMPLEMENT_STRENGTH = 0.5;
    for (const chip of chipData) {
      if (chip.taste === activeTab || chip.tasteLabels.includes(activeTab)) {
        matches.push(chip);
      } else if (chip.strength >= MIN_COMPLEMENT_STRENGTH && !chip.inRecipe) {
        complements.push(chip);
      }
    }
    return { filteredChips: matches, complementChips: complements.slice(0, 12) };
  }, [chipData, activeTab, nodes, recipeIngredients]);

  // "Give me a suggestion" handler
  const handleSuggest = useCallback(() => {
    if (!nodes || !edges || recipeIngredients.length < 2) return;
    const analysis = analyzeRecipe(recipeIngredients, nodes, edges, labMode, selectedStructure);
    if (!analysis?.suggestions?.add?.length) {
      setSuggestion({ name: null, reason: 'No suggestions available — try adding more ingredients.' });
      return;
    }

    // Cross-reference with taste gap
    const profile = aggregateRecipeTastes(recipeIngredients, nodes);
    const [weakAxis] = findWeakestAxis(profile.normalized);
    const weakPct = Math.round((profile.normalized[weakAxis] || 0) * 100);

    // Try to find a suggestion that fills the gap
    let pick = null;
    for (const s of analysis.suggestions.add) {
      if (recipeIngredients.includes(s.name)) continue;
      const node = nodes.get(s.name);
      if (node) {
        const { channels } = scoreIngredient(s.name, node);
        if (channels[weakAxis] > 0.2) {
          pick = { ...s, gapAxis: weakAxis, gapPct: weakPct };
          break;
        }
      }
    }

    if (!pick) {
      const s = analysis.suggestions.add.find(s => !recipeIngredients.includes(s.name));
      if (s) pick = { ...s, gapAxis: null };
    }

    if (pick) {
      const reason = pick.gapAxis
        ? `Your recipe is missing ${pick.gapAxis} (${pick.gapPct}%) — ${pick.name} would help`
        : pick.reason;
      setSuggestion({ name: pick.name, reason });
    }
  }, [recipeIngredients, nodes, edges, labMode, selectedStructure]);

  // Cuisines that any pairing chip actually has — avoids empty tabs.
  const cuisineOptions = useMemo(() => {
    if (!nodes || chipData.length === 0) return [];
    const set = new Set();
    for (const c of chipData) {
      const node = nodes.get(c.name);
      for (const cu of (node?.cuisines || [])) set.add(String(cu).toLowerCase());
    }
    return [...set].sort();
  }, [chipData, nodes]);

  // Tabs differ by mode. 'all' is always available; 'balance' + taste axes
  // show only in taste mode; cuisine list only in cuisine mode. Keeps the
  // surface compact and the choice explicit.
  const tabs = filterMode === 'cuisine'
    ? [
        { key: 'all', label: 'All' },
        ...cuisineOptions.map(c => ({ key: `cuisine:${c}`, label: c, isCuisine: true })),
      ]
    : [
        { key: 'all', label: 'All' },
        { key: 'best', label: 'Balance' },
        ...AXES.map(a => ({ key: a, label: a })),
      ];

  return (
    <div
      ref={sheetRef}
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-xl shadow-lg"
      style={{
        height: sheetHeight,
        backgroundColor: '#fefae0',
        borderTop: '2px solid #c9b99a',
        transition: 'height 300ms ease-out',
        touchAction: 'none',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex flex-col items-center justify-center cursor-grab flex-shrink-0"
        style={{ minHeight: '44px' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          handleDragStart(e.clientY);
          const onMove = (ev) => handleDragMove(ev.clientY);
          const onUp = (ev) => { handleDragEnd(ev.clientY); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#c9b99a' }} />
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm" style={{ fontFamily: FONT_FAMILY, color: '#7a6a4a' }}>
            Suggestions
          </span>
          {chipData.filter(c => !c.inRecipe).length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: '#e8dcc0', color: '#7a6a4a', fontFamily: FONT_FAMILY }}
            >
              {chipData.filter(c => !c.inRecipe).length}
            </span>
          )}
        </div>
      </div>

      {/* Filter-mode toggle (Taste vs. Cuisine) — scaffolded so we only
          show one flavor-axis class at a time. Cuisine mode is hidden
          when no chip carries a cuisine tag (most ingredients). */}
      {snapState !== 'peek' && cuisineOptions.length > 0 && (
        <div className="flex-shrink-0 px-2 pb-1 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#a09070', fontFamily: FONT_FAMILY }}>Filter by</span>
          {[
            { k: 'taste', label: 'Taste' },
            { k: 'cuisine', label: 'Cuisine' },
          ].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => switchMode(k)}
              className="px-2.5 py-0.5 rounded-full text-xs transition-colors"
              style={{
                fontFamily: FONT_FAMILY,
                color: filterMode === k ? '#3a3428' : '#a09070',
                backgroundColor: filterMode === k ? '#e8dcc0' : 'transparent',
                border: `1px solid ${filterMode === k ? '#c9b99a' : 'transparent'}`,
              }}
            >{label}</button>
          ))}
        </div>
      )}

      {/* Active-mode tab strip */}
      {snapState !== 'peek' && (
        <div className="flex-shrink-0 overflow-x-auto px-2 pb-1" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1 min-w-max">
            {tabs.map(t => {
              const isActive = activeTab === t.key;
              const tasteColor = TASTE_COLORS[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => onTabChange(t.key)}
                  className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors"
                  style={{
                    fontFamily: FONT_FAMILY,
                    color: isActive ? '#3a3428' : '#a09070',
                    backgroundColor: isActive && tasteColor ? `${tasteColor}33` : isActive ? '#e8dcc0' : 'transparent',
                    border: `1px solid ${isActive ? (tasteColor || '#c9b99a') : 'transparent'}`,
                  }}
                >
                  {tasteColor && (
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: tasteColor }}
                    />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingredient chips grid */}
      {snapState !== 'peek' && (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {!centerIngredient && (
            <p className="text-center text-sm py-4" style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}>
              Search to get started
            </p>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {filteredChips.map(chip => (
              <ChipButton key={chip.name} chip={chip} onAdd={onAddIngredient} centerIngredient={centerIngredient} bridgeCompounds={bridgeCompounds} />
            ))}
          </div>

          {/* Complements section — cross-taste high-strength pairings */}
          {complementChips.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-3 mb-1.5 px-1">
                <div className="flex-1 h-px" style={{ backgroundColor: '#d8cca8' }} />
                <span className="text-xs" style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}>
                  Complements
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#d8cca8' }} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {complementChips.map(chip => (
                  <ChipButton key={chip.name} chip={chip} onAdd={onAddIngredient} showTasteBadge centerIngredient={centerIngredient} bridgeCompounds={bridgeCompounds} />
                ))}
              </div>
            </>
          )}

          {/* Suggestion feature */}
          {snapState === 'full' && recipeIngredients.length >= 2 && (
            <div className="mt-3 pt-3 border-t border-[#d8cca8]">
              {!suggestion ? (
                <button
                  onClick={handleSuggest}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-[#c9b99a] text-base transition-colors hover:bg-[#f0e8d0]"
                  style={{ fontFamily: FONT_FAMILY, color: '#7a6a4a' }}
                >
                  Give me a suggestion
                </button>
              ) : (
                <div className="rounded-lg border-2 border-[#c9b99a] bg-[#f5edd0] p-3">
                  <p className="text-sm mb-2" style={{ fontFamily: FONT_FAMILY, color: '#5a4a2a' }}>
                    {suggestion.reason}
                  </p>
                  {suggestion.name && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onAddIngredient(suggestion.name); setSuggestion(null); }}
                        className="flex-1 py-1.5 rounded-md text-sm transition-colors"
                        style={{
                          fontFamily: FONT_FAMILY,
                          color: '#3a3428',
                          backgroundColor: '#e8dcc0',
                        }}
                      >
                        Add {suggestion.name}
                      </button>
                      <button
                        onClick={() => setSuggestion(null)}
                        className="px-3 py-1.5 rounded-md text-sm transition-colors"
                        style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
