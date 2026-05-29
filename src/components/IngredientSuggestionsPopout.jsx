import { useMemo, useState } from 'react';
import { getNeighborsEnriched } from '../data/graph.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { TASTE_COLORS } from '../utils/color.js';
import { AROMA_COLORS } from '../data/recipeScoring.js';
import { roleOf, rolesCompatible } from '../data/ingredientRoles.js';
import { rankSuggestions } from '../data/recipeSuggestionEngine.js';

// 2026-05-27 (batch 6 chef-vocab): renamed 'fatty' → 'creamy'.
const ODOR_KEYS = ['fruity', 'floral', 'green', 'woody', 'creamy'];

// §14 category palette for the food-category filter pills. Per spec,
// any category not in this map renders with #94a3b8 (slate-400).
const CATEGORY_COLORS = {
  Produce: '#65a30d',
  'Meat & Seafood': '#b91c1c',
  Dairy: '#fde68a',
  Grains: '#d4a373',
  'Herbs & Spices': '#4d7c0f',
  Pantry: '#854d0e',
  Beverage: '#0e7490',
  Dessert: '#e879f9',
  Sweetener: '#fbbf24',
  'Fat & Oil': '#f59e0b',
  Condiment: '#9333ea',
  Other: '#94a3b8',
};

// Mirrors SuggestionDrawer's lookupNeighbors stripping logic for
// cocktail / sauce ingredients with no direct edge. Kept in sync —
// any new alias should land in BOTH this map and SuggestionDrawer's.
const QUALIFIER_RE = /^(fresh|cold|hot|chilled|sweet|dry|aged|blanc|blanco|reposado|añejo|anejo|green|yellow|white|black|dark|light|red|rosé|rose|classic|whole|half|heavy|spiced|smoked|toasted|infused|house|extra|virgin|raw|organic|unsalted|salted)\s+/i;
const TRAILING_TOKENS = new Set([
  'leaves','leaf','peel','peels','zest','wedge','wedges','slice','slices',
  'sprig','sprigs','twist','twists','wheel','wheels','ribbon','ribbons',
]);
const ALIAS = new Map([
  ['seltzer','soda water'], ['club soda','soda water'], ['sparkling water','soda water'],
  ['whisky','whiskey'], ['rye','whiskey'], ['rye whiskey','whiskey'], ['scotch','whiskey'], ['scotch whisky','whiskey'],
  ['crème de menthe','mint'], ['creme de menthe','mint'],
  ['crème de cacao','chocolate'], ['creme de cacao','chocolate'],
  ['sugar cube','sugar'], ['demerara','sugar'], ['simple syrup','sugar'], ['rich syrup','sugar'],
  ['agave','honey'], ['agave nectar','honey'], ['agave syrup','honey'],
  ['maraschino','cherry'], ['maraschino liqueur','cherry'],
  ['aperol','campari'], ['pisco','brandy'], ['mezcal','tequila'],
  ['cachaça','rum'], ['cachaca','rum'], ['rhum','rum'], ['rhum agricole','rum'],
  ['armagnac','cognac'], ['calvados','brandy'], ['absinthe','anise'], ['pastis','anise'],
  ['orgeat','almond'], ['allspice dram','allspice'],
  ['st-germain','elderflower'], ['st germain','elderflower'],
  ['lillet','wine'], ['lillet blanc','wine'], ['cocchi americano','wine'],
  ['dolin','vermouth'], ['punt e mes','vermouth'], ['carpano antica','vermouth'],
  ['angostura','bitters'], ['angostura bitters','bitters'],
]);

function lookupNeighborsFlexible(ing, edges, cuisineNeighborIndex) {
  if (!ing || !edges) return [];
  const lc = ing.toLowerCase();
  let n = getNeighborsEnriched(ing, edges, cuisineNeighborIndex);
  if (n.length > 0) return n;
  if (ALIAS.has(lc)) {
    n = getNeighborsEnriched(ALIAS.get(lc), edges, cuisineNeighborIndex);
    if (n.length > 0) return n;
  }
  let stripped = ing;
  while (QUALIFIER_RE.test(stripped)) {
    stripped = stripped.replace(QUALIFIER_RE, '');
    n = getNeighborsEnriched(stripped, edges, cuisineNeighborIndex);
    if (n.length > 0) return n;
    if (ALIAS.has(stripped.toLowerCase())) {
      n = getNeighborsEnriched(ALIAS.get(stripped.toLowerCase()), edges, cuisineNeighborIndex);
      if (n.length > 0) return n;
    }
  }
  let tokens = stripped.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && TRAILING_TOKENS.has(tokens[tokens.length - 1].toLowerCase())) {
    tokens.pop();
    n = getNeighborsEnriched(tokens.join(' '), edges, cuisineNeighborIndex);
    if (n.length > 0) return n;
  }
  return [];
}

function pairStrength(a, b, edges, cuisineNeighborIndex) {
  if (!a || !b || !edges) return 0;
  const ns = getNeighborsEnriched(a, edges, cuisineNeighborIndex);
  const hit = ns.find((x) => x.name === b);
  return hit ? hit.strength : 0;
}

/**
 * IngredientSuggestionsPopout — replaces the hex graphic in the Recipe
 * Lab when the user taps an "R" pill on an ingredient row OR taps the
 * "Suggestions" button below the ingredient list.
 *
 * Two modes:
 *   - replace mode (`ingredient` set): single column of swap candidates
 *     ranked for that ingredient against the rest of the bowl. Tap →
 *     onSwap(ingredient, newName).
 *   - add mode (`ingredient` null/empty): bowl-wide suggestions ranked
 *     by average pair strength to every ingredient in the bowl. Tap →
 *     onAdd(newName).
 *
 * Props:
 *   ingredient:        string|null  (replace mode if set, add mode if null)
 *   recipeIngredients: string[] (replace mode: rest of bowl; add mode: full bowl)
 *   nodes:             Map<string, node>
 *   edges:             Array (graph edges)
 *   scopeFilter:       Set<lower-case name> | null   (cocktail/sauce scope)
 *   labMode:           'taste' | 'cocktail' | 'sauce' | 'general'
 *   onSwap:            (target, newName) => void   (replace mode)
 *   onAdd:             (newName) => void           (add mode)
 *   onClose:           () => void
 */
export default function IngredientSuggestionsPopout({
  ingredient,
  recipeIngredients = [],
  nodes,
  edges,
  cuisineNeighborIndex = null,
  scopeFilter,
  cocktailRoles,
  sauceRoles,
  labMode,
  onSwap,
  onAdd,
  onClose,
  // RL-FOCAL-WIRE: add-mode focal-weighted ranker inputs. When all
  // three are present, the popout uses rankSuggestions(bowl, focalKey,
  // ...) so the focal flag actually influences what's suggested.
  // Missing any → falls back to the existing edge-aggregator below.
  bowl = null,
  focalKey = null,
  recipePairs = null,
  globalCount = null,
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  // §14 food-category filter (RL-CATEGORY-FILTER). null = all categories.
  // Single-select; tap active pill again clears.
  const [categoryFilter, setCategoryFilter] = useState(null);
  // Role purity is on by default in replace-mode (Path C). User can
  // toggle off when no same-role candidates exist or they want
  // broader exploration. Add-mode never enforces (we want any
  // ingredient that fits the bowl, regardless of role).
  const [enforceRole, setEnforceRole] = useState(true);
  const isAddMode = !ingredient;
  const roleCtx = useMemo(
    () => ({ cocktailRoles, sauceRoles, node: ingredient ? nodes?.get(ingredient) : null }),
    [cocktailRoles, sauceRoles, ingredient, nodes]
  );
  const focalRole = useMemo(
    () => (isAddMode ? null : roleOf(ingredient, labMode, roleCtx)),
    [isAddMode, ingredient, labMode, roleCtx]
  );

  // Two-signal swap-candidate ranking (audit response, 2026-05-07):
  //
  //   primary signal — strength of the candidate's pairing with the
  //                    focused ingredient (substitute fit)
  //   secondary signal — average strength of the candidate's pairings
  //                      with the OTHER bowl ingredients (recipe fit)
  //
  // Combined score = 0.55 * primary + 0.45 * secondary
  //
  // High weight on primary so true substitutes win; secondary is heavy
  // enough to break ties in favor of candidates that integrate with
  // the rest of the recipe. If the bowl has only the focused
  // ingredient, secondary defaults to 0 and primary alone ranks.
  //
  // Add mode (no focal ingredient): each bowl ingredient contributes
  // its neighbors to a combined candidate map; score is the average
  // pair strength across the whole bowl, so candidates that pair with
  // EVERY bowl ingredient out-rank ones bonded to a single member.
  const candidates = useMemo(() => {
    if (!nodes || !edges) return [];

    if (isAddMode) {
      // RL-FOCAL-WIRE: focal-weighted recipe-level co-occurrence ranker.
      // Engaged only when the upstream supplied bowl (BowlEntry[]) +
      // recipePairs + globalCount. Otherwise the legacy edge-aggregator
      // below runs unchanged.
      if (Array.isArray(bowl) && bowl.length > 0 && recipePairs && globalCount) {
        const ranked = rankSuggestions(bowl, focalKey, null, {
          recipePairs,
          globalCount,
          K: 200,
        });
        const out = [];
        for (const { name, strength } of ranked) {
          if (scopeFilter && !scopeFilter.has(name.toLowerCase())) continue;
          const node = nodes.get(name);
          if (!node) continue;
          const { channels } = scoreIngredient(name, node);
          let dominantTaste = 'default';
          let bestVal = 0;
          for (const [ch, v] of Object.entries(channels)) {
            if (v > bestVal) { bestVal = v; dominantTaste = ch; }
          }
          out.push({
            name,
            strength,
            bowlFit: strength,
            bowlHitCount: bowl.length,
            score: strength,
            dominantTaste,
            node,
          });
        }
        return out;
      }
      const legacyBowl = recipeIngredients;
      if (legacyBowl.length === 0) return [];
      const bowlSet = new Set(legacyBowl);
      // Aggregate neighbors across the whole bowl. score = sum / bowl.length
      // so a candidate paired with every bowl ingredient gets a higher
      // score than one bonded to a single member.
      const agg = new Map(); // name -> { sum, hits }
      for (const ing of legacyBowl) {
        const neighbors = lookupNeighborsFlexible(ing, edges, cuisineNeighborIndex);
        for (const n of neighbors) {
          if (bowlSet.has(n.name)) continue;
          if (scopeFilter && !scopeFilter.has(n.name.toLowerCase())) continue;
          const cur = agg.get(n.name);
          if (cur) {
            cur.sum += n.strength;
            cur.hits += 1;
          } else {
            agg.set(n.name, { sum: n.strength, hits: 1 });
          }
        }
      }
      const out = [];
      for (const [name, { sum, hits }] of agg.entries()) {
        const node = nodes.get(name);
        if (!node) continue;
        const score = sum / legacyBowl.length;
        const { channels } = scoreIngredient(name, node);
        let dominantTaste = 'default';
        let bestVal = 0;
        for (const [ch, v] of Object.entries(channels)) {
          if (v > bestVal) { bestVal = v; dominantTaste = ch; }
        }
        out.push({
          name,
          strength: score,
          bowlFit: score,
          bowlHitCount: hits,
          score,
          dominantTaste,
          node,
        });
      }
      out.sort((a, b) => b.score - a.score);
      return out;
    }

    const bowlSet = new Set(recipeIngredients);
    bowlSet.add(ingredient);
    const others = recipeIngredients.filter((n) => n !== ingredient);

    // Build the candidate name set. Two sources, deduped:
    //
    //   (a) Direct neighbors of the focal — their pairing-strength to
    //       focal seeds primary score.
    //   (b) ROLE EXPANSION (replace-mode-only, when enforceRole + role
    //       dict are available) — every same-role ingredient from the
    //       lab's role dictionary, even if they aren't direct
    //       neighbors. Critical for base spirits like bourbon whose
    //       graph neighbors are bitters/citrus/syrups (used WITH it
    //       in cocktails) rather than other spirits (rarely mixed
    //       with it). Without this, the slot filter empties the list
    //       because there ARE no spirit-role neighbors of bourbon
    //       in the recipe corpus.
    const candidateStrengths = new Map(); // name → primary pair-strength to focal
    const focusedNeighbors = lookupNeighborsFlexible(ingredient, edges, cuisineNeighborIndex);
    for (const n of focusedNeighbors) candidateStrengths.set(n.name, n.strength);

    const useRoleExpansion =
      enforceRole && focalRole && focalRole !== 'other';
    const focalLc = ingredient.toLowerCase();
    if (useRoleExpansion) {
      const dict =
        labMode === 'cocktail' ? cocktailRoles :
        labMode === 'sauce' ? sauceRoles :
        null;
      if (dict) {
        for (const [lcName, info] of Object.entries(dict)) {
          if (info.role !== focalRole) continue;
          if (lcName === focalLc) continue;
          if (candidateStrengths.has(lcName)) continue;
          candidateStrengths.set(lcName, 0);
        }
      }
    }

    const out = [];
    for (const [candName, primaryFromNeighbor] of candidateStrengths.entries()) {
      if (bowlSet.has(candName)) continue;
      if (scopeFilter && !scopeFilter.has(candName.toLowerCase())) continue;
      const node = nodes.get(candName);
      if (!node) continue;

      // Slot-aware role gate. `rolesCompatible` treats unknown roles
      // ('other' or null) as wildcards so the gate doesn't drop role-
      // expanded candidates whose role-dict entry didn't classify them.
      if (useRoleExpansion) {
        const candRole = roleOf(candName, labMode, { cocktailRoles, sauceRoles, node });
        if (!rolesCompatible(focalRole, candRole)) continue;
      }

      // Primary: pair strength to focal. From neighbor lookup (>0) or
      // direct edge probe for role-expanded candidates (0 when no edge).
      const primary = primaryFromNeighbor > 0
        ? primaryFromNeighbor
        : pairStrength(ingredient, candName, edges, cuisineNeighborIndex);

      // Secondary: average pair strength to the rest of the bowl.
      let bowlAffinity = 0;
      let bowlHits = 0;
      for (const other of others) {
        const s = pairStrength(other, candName, edges, cuisineNeighborIndex);
        if (s > 0) {
          bowlAffinity += s;
          bowlHits += 1;
        }
      }
      const avgBowl = others.length > 0
        ? (bowlAffinity / others.length)
        : 0;

      // Score: when role-expansion injected a candidate with no direct
      // edge to focal (primary=0), bowl-fit is the only signal, so it
      // takes full weight. Otherwise blend 0.55 primary / 0.45 bowl
      // like the existing substitute-fit ranker.
      const score = primary > 0
        ? 0.55 * primary + 0.45 * avgBowl
        : avgBowl;

      const { channels } = scoreIngredient(candName, node);
      let dominantTaste = 'default';
      let bestVal = 0;
      for (const [ch, v] of Object.entries(channels)) {
        if (v > bestVal) { bestVal = v; dominantTaste = ch; }
      }
      out.push({
        name: candName,
        strength: primary,
        bowlFit: avgBowl,
        bowlHitCount: bowlHits,
        score,
        dominantTaste,
        node,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }, [ingredient, recipeIngredients, nodes, edges, scopeFilter, isAddMode, enforceRole, focalRole, labMode, cocktailRoles, sauceRoles, bowl, focalKey, recipePairs, globalCount, cuisineNeighborIndex]);

  const filtered = useMemo(() => {
    // Stage 1: apply the taste/aroma/cuisine filter pill (existing).
    let result;
    if (activeFilter === 'all') {
      result = candidates;
    } else if (activeFilter.startsWith('aroma:')) {
      const odorKey = activeFilter.slice(6);
      const T = 0.15;
      result = candidates.filter((c) => (c.node?.gnnProbs?.[`odor_${odorKey}`] || 0) >= T);
    } else if (activeFilter.startsWith('taste:')) {
      const taste = activeFilter.slice(6);
      result = candidates.filter((c) => c.dominantTaste === taste);
    } else if (activeFilter.startsWith('cuisine:')) {
      const cuisine = activeFilter.slice(8).toLowerCase();
      result = candidates.filter((c) =>
        (c.node?.cuisines || []).some((x) => String(x).toLowerCase() === cuisine),
      );
    } else {
      result = candidates;
    }
    // Stage 2: §14 food-category filter (RL-CATEGORY-FILTER). Runs AFTER
    // ranking + the existing pill filter — does not mutate scores.
    if (categoryFilter) {
      result = result.filter((c) => c.node?.category === categoryFilter);
    }
    return result.slice(0, 40);
  }, [candidates, activeFilter, categoryFilter]);

  // Distinct categories present in the (pre-filter) candidate pool. Only
  // surfacing categories with ≥1 candidate keeps the pill row honest —
  // tapping a pill always returns at least one result.
  const availableCategories = useMemo(() => {
    const seen = new Set();
    for (const c of candidates) {
      const cat = c.node?.category;
      if (cat) seen.add(cat);
    }
    return Array.from(seen).sort();
  }, [candidates]);

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
          <p className="text-[10px] uppercase tracking-wider text-[#a09070] leading-none flex items-center gap-1">
            {isAddMode ? 'Add to recipe' : 'Suggestions for'}
            {!isAddMode && focalRole && (
              <button
                type="button"
                onClick={() => setEnforceRole((v) => !v)}
                title={
                  enforceRole
                    ? `Showing only ${focalRole.replace(/_/g, ' ')} candidates — tap to widen`
                    : 'Showing all roles — tap to lock to same role'
                }
                className={`text-[9px] px-1.5 py-[1px] rounded-full border transition-colors ${
                  enforceRole
                    ? 'bg-[#7a6a4a] text-white border-[#7a6a4a]'
                    : 'bg-transparent text-[#a09070] border-[#c9b99a]'
                }`}
                style={{ textTransform: 'lowercase' }}
              >
                {focalRole.replace(/_/g, ' ')}
              </button>
            )}
          </p>
          <h3 className="text-base font-medium text-[#3a3428] truncate" style={{ fontFamily: 'Caveat, cursive' }}>
            {isAddMode
              ? (recipeIngredients.length > 0
                  ? `${recipeIngredients.length} ingredient${recipeIngredients.length === 1 ? '' : 's'} in bowl`
                  : 'Empty bowl')
              : ingredient}
          </h3>
        </div>
        <span title="Match strength" className="text-[#a09070]">★</span>
      </div>

      {/* §14 food-category filter pills (RL-CATEGORY-FILTER). Sticky
          row above the taste/aroma filter row. Single-select; tap same
          pill again to clear back to all categories. Only surfaces
          categories present in the current candidate pool. */}
      {availableCategories.length > 0 && (
        <div
          className="flex gap-1 px-2 py-1.5 overflow-x-auto flex-shrink-0 border-b border-[#e8dcc0]"
          style={{ scrollbarWidth: 'none' }}
          data-testid="category-filter-row"
        >
          {availableCategories.map((cat) => {
            const isActive = categoryFilter === cat;
            const color = CATEGORY_COLORS[cat] || '#94a3b8';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter((prev) => (prev === cat ? null : cat))}
                aria-pressed={isActive}
                data-testid={`category-pill-${cat}`}
                className="flex-shrink-0 px-3 rounded-full border text-xs transition-colors whitespace-nowrap"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  backgroundColor: isActive ? color : 'transparent',
                  borderColor: isActive ? color : '#c9b99a',
                  color: isActive ? '#fefae0' : '#5a4a2a',
                  fontFamily: 'inherit',
                  paddingTop: 6,
                  paddingBottom: 6,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

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
                  onClick={() => {
                    if (isAddMode) onAdd?.(c.name);
                    else onSwap?.(ingredient, c.name);
                  }}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-full bg-white hover:bg-[#fff5e0] active:bg-[#fef0d0] border border-[#c9b99a] transition-colors flex items-center gap-1.5"
                  style={{ fontFamily: 'Caveat, cursive', color: '#3a3428' }}
                  title={
                    isAddMode
                      ? `Add ${c.name} to recipe (${Math.round(c.strength * 100)}%)`
                      : `Replace ${ingredient} with ${c.name} (${Math.round(c.strength * 100)}%)`
                  }
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
