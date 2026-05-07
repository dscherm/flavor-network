import { useMemo, useState } from 'react';
import { rankByRecipeCooccurrence } from '../data/recipeSuggestionEngine.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { TASTE_COLORS } from '../utils/color.js';
import { AROMA_COLORS } from '../data/recipeScoring.js';

const ODOR_KEYS = ['fruity', 'floral', 'green', 'woody', 'fatty'];

/**
 * IngredientSuggestionsPopout — replaces the hex graphic in the Recipe
 * Lab when the user taps an "R" pill on an ingredient row. Shows
 * filter pills (taste / aroma / cuisine) and a single column of swap
 * candidates ranked for that ingredient against the rest of the bowl.
 *
 * Props:
 *   ingredient:        string  (the ingredient being replaced)
 *   recipeIngredients: string[] (the rest of the bowl)
 *   nodes:             Map<string, node>
 *   recipePairs:       Map (recipe co-occurrence pairs)
 *   globalCount:       Map (global ingredient frequency)
 *   scopeFilter:       Set<lower-case name> | null   (cocktail/sauce scope)
 *   labMode:           'taste' | 'cocktail' | 'sauce' | 'general'
 *   onSwap:            (target, newName) => void
 *   onClose:           () => void
 */
export default function IngredientSuggestionsPopout({
  ingredient,
  recipeIngredients = [],
  nodes,
  recipePairs,
  globalCount,
  scopeFilter,
  labMode,
  onSwap,
  onClose,
}) {
  const [activeFilter, setActiveFilter] = useState('all');

  const candidates = useMemo(() => {
    if (!nodes) return [];
    const allNames = [];
    for (const name of nodes.keys()) {
      if (name === ingredient) continue;
      if (recipeIngredients.includes(name)) continue;
      if (scopeFilter && !scopeFilter.has(name.toLowerCase())) continue;
      allNames.push(name);
    }
    const ranked = rankByRecipeCooccurrence(
      [ingredient, ...recipeIngredients],
      recipePairs,
      globalCount,
      120,
    );
    const rankSet = new Map(ranked.map((r) => [r.name, r.strength]));
    const out = [];
    for (const name of allNames) {
      const strength = rankSet.get(name);
      if (strength === undefined) continue;
      const node = nodes.get(name);
      if (!node) continue;
      const { channels } = scoreIngredient(name, node);
      let dominantTaste = 'default';
      let bestVal = 0;
      for (const [ch, v] of Object.entries(channels)) {
        if (v > bestVal) { bestVal = v; dominantTaste = ch; }
      }
      out.push({ name, strength, dominantTaste, node });
    }
    out.sort((a, b) => b.strength - a.strength);
    return out;
  }, [ingredient, recipeIngredients, nodes, recipePairs, globalCount, scopeFilter]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return candidates.slice(0, 40);
    if (activeFilter.startsWith('aroma:')) {
      const odorKey = activeFilter.slice(6);
      const T = 0.15;
      return candidates
        .filter((c) => (c.node?.gnnProbs?.[`odor_${odorKey}`] || 0) >= T)
        .slice(0, 40);
    }
    if (activeFilter.startsWith('taste:')) {
      const taste = activeFilter.slice(6);
      return candidates.filter((c) => c.dominantTaste === taste).slice(0, 40);
    }
    if (activeFilter.startsWith('cuisine:')) {
      const cuisine = activeFilter.slice(8).toLowerCase();
      return candidates.filter((c) =>
        (c.node?.cuisines || []).some((x) => String(x).toLowerCase() === cuisine)
      ).slice(0, 40);
    }
    return candidates.slice(0, 40);
  }, [candidates, activeFilter]);

  const tasteOptions = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent'];
  const aromaOptions = ODOR_KEYS;
  const showCuisine = labMode !== 'cocktail' && labMode !== 'sauce';

  return (
    <div
      className="flex flex-col w-full bg-[#fefae0] border-b border-[#c9b99a]"
      style={{ height: '100%', maxHeight: '40vh' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#c9b99a] flex-shrink-0">
        <button
          onClick={onClose}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#e8dcc0] active:bg-[#dccaa6]"
          title="Back to flavor profile"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a6a4a" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-[#a09070] leading-none">Suggestions for</p>
          <h3 className="text-base font-medium text-[#3a3428] truncate" style={{ fontFamily: 'Caveat, cursive' }}>
            {ingredient}
          </h3>
        </div>
        <span title="Match strength" className="text-[#a09070]">★</span>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1 px-2 py-1.5 overflow-x-auto flex-shrink-0 border-b border-[#e8dcc0]" style={{ scrollbarWidth: 'none' }}>
        {[
          { key: 'all', label: 'All' },
          ...tasteOptions.map((t) => ({ key: `taste:${t}`, label: t, color: TASTE_COLORS[t] })),
          ...aromaOptions.map((a) => ({ key: `aroma:${a}`, label: a, color: AROMA_COLORS?.[`odor_${a}`] || '#a09070' })),
        ].map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-2.5 py-1 min-h-[32px] rounded-full text-[11px] capitalize transition-colors flex-shrink-0 flex items-center gap-1 ${
                isActive ? 'bg-[#7a6a4a] text-white' : 'bg-[#e8dcc0] text-[#7a6a4a] hover:bg-[#dccaa6]'
              }`}
              style={{ fontFamily: 'Caveat, cursive' }}
            >
              {f.color && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Suggestion chips */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-[12px] text-[#a09070] italic" style={{ fontFamily: 'Caveat, cursive' }}>
            No matches for this filter.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((c) => {
              const tasteColor = TASTE_COLORS[c.dominantTaste] || TASTE_COLORS.default;
              return (
                <button
                  key={c.name}
                  onClick={() => onSwap(ingredient, c.name)}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-full bg-white hover:bg-[#fff5e0] active:bg-[#fef0d0] border border-[#c9b99a] transition-colors flex items-center gap-1.5"
                  style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}
                  title={`Replace ${ingredient} with ${c.name} (${Math.round(c.strength * 100)}%)`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tasteColor }} />
                  <span className="text-[14px]">{c.name}</span>
                  <span className="text-[10px] text-[#a09070]">{Math.round(c.strength * 100)}%</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
