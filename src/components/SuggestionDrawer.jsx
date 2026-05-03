import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { getNeighbors } from '../data/graph.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { findWeakestAxis, aggregateRecipeTastes } from '../data/tasteScoring.js';
import { analyzeRecipe } from '../data/recipeAnalysis.js';
import { rankByRecipeCooccurrence } from '../data/recipeSuggestionEngine.js';
import { rankAddByTaste, TASTE_COLUMNS, computeDominantTaste, EMPTY_ADD_COLUMNS } from '../data/addModeBucketing.js';
import useIsMobile from '../hooks/useIsMobile.js';
import { AROMA_LABELS, AROMA_COLORS } from '../data/recipeScoring.js';
import OdorBadge from './OdorBadge.jsx';
import SuggestionDrawerToggle from './SuggestionDrawerToggle.jsx';

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
      className="flex items-start gap-2 p-2.5 rounded-lg border text-left transition-colors hover:bg-[#f5edd0]"
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
            className="truncate"
            style={{ fontFamily: FONT_FAMILY, color: '#3a3428', fontSize: '15px' }}
          >
            {chip.name}
          </span>
          <span
            className="flex-shrink-0"
            style={{ fontFamily: FONT_FAMILY, color: '#a09070', fontSize: '12px' }}
          >
            {chip.matchPct}%
          </span>
          {centerIngredient && (
            <OdorBadge a={centerIngredient} b={chip.name} bridgeCompounds={bridgeCompounds} compact />
          )}
        </div>
        {showTasteBadge && chip.taste !== 'default' ? (
          <div className="flex gap-1 mt-1">
            <span
              className="px-1.5 rounded-full"
              style={{
                fontFamily: FONT_FAMILY,
                color: '#fff',
                backgroundColor: TASTE_COLORS[chip.taste] || TASTE_COLORS.default,
                fontSize: '11px',
              }}
            >
              {chip.taste}
            </span>
          </div>
        ) : chip.tasteLabels.length > 0 && (
          <div className="flex gap-1 mt-1">
            {chip.tasteLabels.map(t => (
              <span
                key={t}
                className="px-1.5 rounded"
                style={{
                  fontFamily: FONT_FAMILY,
                  color: '#7a6a4a',
                  backgroundColor: `${TASTE_COLORS[t] || TASTE_COLORS.default}22`,
                  fontSize: '11px',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      {!chip.inRecipe && (
        <span className="text-lg flex-shrink-0" style={{ color: '#a09070' }}>+</span>
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

function getTasteLabels(name, node) {
  if (!node) return [];
  const { channels } = scoreIngredient(name, node);
  return Object.entries(channels)
    .filter(([, v]) => v > 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([ch]) => ch);
}

// Apply the active filter tab to a chip list. Used by the column
// layout so each column independently respects the current
// taste/aroma filter.
function applyChipFilter(chips, activeTab, nodes) {
  if (!activeTab || activeTab === 'all' || activeTab === 'best') return chips;
  if (activeTab.startsWith('cuisine:')) {
    const target = activeTab.slice(8).toLowerCase();
    return chips.filter(c => {
      const node = nodes?.get(c.name);
      const cuisines = (node?.cuisines || []).map(x => String(x).toLowerCase());
      return cuisines.includes(target);
    });
  }
  if (activeTab.startsWith('aroma:')) {
    const odorKey = activeTab.slice(6);
    const AROMA_THRESHOLD = 0.2;
    return chips.filter(c => {
      const node = nodes?.get(c.name);
      const p = node?.gnnProbs?.[`odor_${odorKey}`] || 0;
      return p >= AROMA_THRESHOLD;
    });
  }
  // Plain taste tab
  return chips.filter(c => c.taste === activeTab || c.tasteLabels.includes(activeTab));
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
  onSwapIngredient = null,
  activeTab = 'all',
  onTabChange,
  snapState = 'peek',
  onSnapChange,
  labMode = 'taste',
  selectedStructure = null,
  bridgeCompounds,
  recipePairs = null,
  globalCount = null,
  scopeFilter = null,           // Set<string> | null — restricts chip pool (e.g. cocktail-relevant only)
}) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ startY: 0, startHeight: 0, dragging: false });
  const isMobile = useIsMobile();
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [suggestion, setSuggestion] = useState(null);
  // Scaffolded filter surface: show ONE filter class at a time (taste OR
  // cuisine) rather than both in one long strip — avoids overwhelming.
  const [filterMode, setFilterMode] = useState('taste');

  // ADD / REPLACE toggle state.
  // effectiveBowlSize counts recipeIngredients + centerIngredient (if any)
  // so a single focal ingredient still enables REPLACE.
  const effectiveBowlSize = (recipeIngredients?.length || 0) + (centerIngredient ? 1 : 0);
  // manualMode is null (auto) or an explicit user override.
  const [manualMode, setManualMode] = useState(null);
  // Derived mode: auto-rule is REPLACE when effectiveBowlSize≥1, else ADD.
  // manualMode overrides, but resets to null when bowl drains to 0.
  const mode = (() => {
    if (manualMode && effectiveBowlSize > 0) return manualMode;
    return effectiveBowlSize >= 1 ? 'REPLACE' : 'ADD';
  })();
  // Reset manualMode when bowl drains so the auto-rule reactivates.
  useEffect(() => {
    if (effectiveBowlSize === 0) setManualMode(null);
  }, [effectiveBowlSize]);

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

  // Sync filterMode when activeTab is set externally (e.g. tapping an
  // aroma bar in the Recipe Lab). Without this, an `aroma:fruity` tab
  // would be active but the visible tab strip would still be the taste
  // strip — confusing.
  useEffect(() => {
    if (typeof activeTab !== 'string') return;
    if (activeTab.startsWith('aroma:') && filterMode !== 'aroma') setFilterMode('aroma');
    else if (activeTab.startsWith('cuisine:') && filterMode !== 'cuisine') setFilterMode('cuisine');
  }, [activeTab, filterMode]);

  // If labMode flips to cocktail while filterMode is cuisine, drop back
  // to taste — the cuisine button is hidden in cocktail context, so
  // staying on cuisine would leave the user with no visible filter
  // selected and an empty chip pool.
  useEffect(() => {
    if (labMode === 'cocktail' && filterMode === 'cuisine') {
      setFilterMode('taste');
      onTabChange?.('all');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labMode]);

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
    // Legacy v1 fallback: union of neighbors across the bowl so the
    // chip pool actually reacts when ingredients are added (the old
    // centerIngredient-only path froze the pool whenever the user
    // stopped searching).
    if (!edges) return [];
    const seed = centerIngredient || (recipeIngredients?.[recipeIngredients.length - 1] ?? null);
    if (!seed && (recipeIngredients?.length ?? 0) === 0) return [];
    const seen = new Map();
    const seeds = recipeIngredients?.length > 0
      ? recipeIngredients
      : (seed ? [seed] : []);
    for (const s of seeds) {
      for (const n of getNeighbors(s, edges)) {
        const prev = seen.get(n.name);
        if (!prev || n.strength > prev.strength) seen.set(n.name, n);
      }
    }
    return [...seen.values()].sort((a, b) => b.strength - a.strength);
  }, [useV2, centerIngredient, recipeIngredients, edges, recipePairs, globalCount]);

  // Decorate pairings with taste tags + in-recipe state. In v2 the strength
  // is already aggregated over the bowl, so no per-chip avg loop is needed.
  // In v1, fall back to the legacy avg-pairwise computation.
  const chipData = useMemo(() => {
    if (!nodes || pairings.length === 0) return [];
    const recipeSet = new Set(recipeIngredients);
    // Drop scope-incompatible candidates (e.g. flour/bread when in
    // cocktail mode). Lowercase compare since pairings.json is lc.
    const scopeOk = scopeFilter
      ? (name) => scopeFilter.has(name.toLowerCase())
      : () => true;

    return pairings.filter(({ name }) => scopeOk(name)).map(({ name, strength }) => {
      const node = nodes.get(name);
      const taste = computeDominantTaste(name, node) ?? 'default';
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
  }, [pairings, nodes, edges, recipeIngredients, useV2, scopeFilter]);

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
    // Aroma tab — filter by GNN-predicted odor probability for the
    // selected aroma class. Threshold of 0.2 = "this ingredient is
    // meaningfully <aroma>" (calibrated post-R12). Sort by both the
    // engine strength AND the aroma probability so chips that are
    // BOTH high-pairing AND strongly <aroma> bubble up.
    if (activeTab.startsWith('aroma:')) {
      const odorKey = activeTab.slice(6);
      const AROMA_THRESHOLD = 0.2;
      const matches = chipData
        .map(c => {
          const node = nodes?.get(c.name);
          const p = node?.gnnProbs?.[`odor_${odorKey}`] || 0;
          return { ...c, aromaProb: p };
        })
        .filter(c => c.aromaProb >= AROMA_THRESHOLD)
        .sort((a, b) => {
          if (a.inRecipe !== b.inRecipe) return a.inRecipe ? 1 : -1;
          return (b.strength + b.aromaProb) - (a.strength + a.aromaProb);
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

  // Per-bowl-ingredient columns: one column per recipe ingredient,
  // each containing the top-N replacement candidates (ranked by pair
  // strength). The column header is the ingredient being replaced —
  // chip click swaps that ingredient with the chip. When scopeFilter
  // is set (e.g. cocktail mode), filters out non-cocktail ingredients
  // like flour, bread, olive oil. Falls back through stripped-qualifier
  // forms if the literal bowl string has no edges (e.g. "fresh lemon
  // juice" → "lemon juice"; "mint leaves" → "mint"; "white rum" → "rum").
  const replaceColumns = useMemo(() => {
    if (!edges || recipeIngredients.length === 0) return [];
    const bowlSet = new Set(recipeIngredients);
    const COLUMN_LIMIT = 12;
    const QUALIFIER_RE = /^(fresh|cold|hot|chilled|sweet|dry|aged|blanc|blanco|reposado|añejo|anejo|green|yellow|white|black|dark|light|red|rosé|rose|classic|whole|half|heavy|spiced|smoked|toasted|infused|house|extra|virgin|raw|organic|unsalted|salted)\s+/i;
    // Trailing words that get pluck-stripped: "mint leaves" → "mint",
    // "soda water" → "soda", "orange peel" → "orange".
    const TRAILING_TOKENS = new Set([
      'leaves','leaf','peel','peels','zest','wedge','wedges','slice','slices',
      'sprig','sprigs','twist','twists','wheel','wheels','ribbon','ribbons',
      'cube','cubes','crystals','flakes','powder','dust','seeds','seed',
    ]);
    // Hand-curated aliases for cocktail terms with no direct edge in
    // pairings.json. Maps to the canonical ingredient with non-empty
    // pairings. Values were verified against the live data:
    //   seltzer (0)        → soda water (65)
    //   whisky/rye (0)     → whiskey (23)
    //   creme de menthe(0) → mint (100)
    //   sugar cube (0)     → sugar (995)
    //   maraschino (0)     → cherry (20)
    //   aperol/pisco (0)   → campari (15) / brandy (56)
    //   demerara (0)       → sugar (995)
    //   agave (0)          → honey (115)
    const ALIASES = new Map([
      ['seltzer', 'soda water'],
      ['club soda', 'soda water'],
      ['sparkling water', 'soda water'],
      ['whisky', 'whiskey'],
      ['rye', 'whiskey'],
      ['rye whiskey', 'whiskey'],
      ['scotch', 'whiskey'],
      ['scotch whisky', 'whiskey'],
      ['crème de menthe', 'mint'],
      ['creme de menthe', 'mint'],
      ['crème de cacao', 'chocolate'],
      ['creme de cacao', 'chocolate'],
      ['crème de violette', 'violet'],
      ['creme de violette', 'violet'],
      ['sugar cube', 'sugar'],
      ['sugar cubes', 'sugar'],
      ['demerara', 'sugar'],
      ['demerara sugar', 'sugar'],
      ['simple syrup', 'sugar'],          // fallback only — direct hit usually wins
      ['rich syrup', 'sugar'],
      ['agave', 'honey'],
      ['agave nectar', 'honey'],
      ['agave syrup', 'honey'],
      ['maraschino', 'cherry'],
      ['maraschino liqueur', 'cherry'],
      ['aperol', 'campari'],
      ['pisco', 'brandy'],
      ['mezcal', 'tequila'],
      ['cachaça', 'rum'],
      ['cachaca', 'rum'],
      ['rhum', 'rum'],
      ['rhum agricole', 'rum'],
      ['armagnac', 'cognac'],
      ['calvados', 'brandy'],
      ['absinthe', 'anise'],
      ['pastis', 'anise'],
      ['chartreuse', 'herbs'],
      ['green chartreuse', 'herbs'],
      ['yellow chartreuse', 'herbs'],
      ['benedictine', 'herbs'],
      ['drambuie', 'whiskey'],
      ['fernet', 'mint'],
      ['fernet branca', 'mint'],
      ['amaro', 'orange peel'],
      ['amaretto', 'almond'],
      ['frangelico', 'hazelnut'],
      ['galliano', 'vanilla'],
      ['kahlúa', 'coffee'],
      ['kahlua', 'coffee'],
      ['baileys', 'cream'],
      ['curaçao', 'orange'],
      ['curacao', 'orange'],
      ['blue curaçao', 'orange'],
      ['blue curacao', 'orange'],
      ['grand marnier', 'orange'],
      ['triple sec', 'orange'],         // direct hit usually wins (37)
      ['st-germain', 'elderflower'],
      ['st germain', 'elderflower'],
      ['lillet', 'wine'],
      ['lillet blanc', 'wine'],
      ['cocchi americano', 'wine'],
      ['dolin', 'vermouth'],
      ['punt e mes', 'vermouth'],
      ['carpano antica', 'vermouth'],
      ['suze', 'gentian'],
      ['velvet falernum', 'lime'],
      ['orgeat', 'almond'],
      ['allspice dram', 'allspice'],
      ['mole bitters', 'chocolate'],
      ['peychaud', 'anise'],
      ["peychaud's", 'anise'],
      ['peychauds', 'anise'],
      ['angostura', 'bitters'],
      ['angostura bitters', 'bitters'],
    ]);
    function lookupNeighbors(ing) {
      const ingLc = ing.toLowerCase();
      // 1. Literal hit
      let neighbors = getNeighbors(ing, edges);
      if (neighbors.length > 0) return neighbors;
      // 2. Alias table — covers brand-name spirits and non-indexed terms
      if (ALIASES.has(ingLc)) {
        neighbors = getNeighbors(ALIASES.get(ingLc), edges);
        if (neighbors.length > 0) return neighbors;
      }
      // 3. Strip leading qualifier(s): "fresh lemon juice" → "lemon juice"
      let stripped = ing;
      while (QUALIFIER_RE.test(stripped)) {
        stripped = stripped.replace(QUALIFIER_RE, '');
        neighbors = getNeighbors(stripped, edges);
        if (neighbors.length > 0) return neighbors;
        if (ALIASES.has(stripped.toLowerCase())) {
          neighbors = getNeighbors(ALIASES.get(stripped.toLowerCase()), edges);
          if (neighbors.length > 0) return neighbors;
        }
      }
      // 4. Pop trailing modifier nouns: "mint leaves" → "mint",
      //    "orange peel" → "orange", "lime wedge" → "lime".
      let tokens = stripped.split(/\s+/).filter(Boolean);
      while (tokens.length > 1 && TRAILING_TOKENS.has(tokens[tokens.length - 1].toLowerCase())) {
        tokens.pop();
        neighbors = getNeighbors(tokens.join(' '), edges);
        if (neighbors.length > 0) return neighbors;
      }
      // 5. Last-ditch head-noun fallback (drop leading words):
      //    "white crème de menthe" → "crème de menthe" → "de menthe" → "menthe"
      tokens = stripped.split(/\s+/).filter(Boolean);
      while (tokens.length > 1) {
        tokens.shift();
        const candidate = tokens.join(' ');
        neighbors = getNeighbors(candidate, edges);
        if (neighbors.length > 0) return neighbors;
        if (ALIASES.has(candidate.toLowerCase())) {
          neighbors = getNeighbors(ALIASES.get(candidate.toLowerCase()), edges);
          if (neighbors.length > 0) return neighbors;
        }
      }
      return [];
    }
    return recipeIngredients.map(bi => {
      const candidates = lookupNeighbors(bi)
        .filter(n => !bowlSet.has(n.name))
        .filter(n => !scopeFilter || scopeFilter.has(n.name.toLowerCase()))
        .slice(0, COLUMN_LIMIT)
        .map(n => {
          const node = nodes?.get(n.name);
          const taste = computeDominantTaste(n.name, node) ?? 'default';
          const tasteLabels = getTasteLabels(n.name, node);
          return {
            name: n.name,
            strength: n.strength,
            taste,
            tasteLabels,
            inRecipe: false,
            matchPct: Math.round(n.strength * 100),
          };
        });
      return { ingredient: bi, candidates };
    });
  }, [recipeIngredients, edges, nodes, scopeFilter]);

  // ADD-mode columns: 8 buckets (one per taste) of recipe-cooccurrence
  // candidates partitioned by dominant taste. Always returns 8 entries
  // (empty buckets included) so the UI keeps its 8-column rhythm.
  // rankAddByTaste now returns chip-ready candidates directly.
  const addColumns = useMemo(() => {
    if (mode !== 'ADD' || !nodes || !recipePairs || !globalCount) return EMPTY_ADD_COLUMNS;
    const bowl = [...new Set([...(recipeIngredients || []), ...(centerIngredient ? [centerIngredient] : [])])];
    return rankAddByTaste(bowl, recipePairs, globalCount, nodes, scopeFilter, { topK: 12 }, recipeIngredients || []);
  }, [mode, nodes, recipePairs, globalCount, recipeIngredients, centerIngredient, scopeFilter]);

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

  // Tabs differ by mode. 'all' is always available; 'balance' + taste
  // axes show only in taste mode; cuisine list only in cuisine mode;
  // aroma classes only in aroma mode. Keeps the surface compact.
  const tabs = filterMode === 'cuisine'
    ? [
        { key: 'all', label: 'All' },
        ...cuisineOptions.map(c => ({ key: `cuisine:${c}`, label: c, isCuisine: true })),
      ]
    : filterMode === 'aroma'
    ? [
        { key: 'all', label: 'All' },
        ...Object.keys(AROMA_LABELS).map(odorKey => ({
          key: `aroma:${odorKey.replace('odor_', '')}`,
          label: AROMA_LABELS[odorKey],
          aromaColor: AROMA_COLORS[odorKey],
          isAroma: true,
        })),
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

      {/* ADD / REPLACE mode toggle pill */}
      {snapState !== 'peek' && (
        <SuggestionDrawerToggle
          mode={mode}
          onChange={setManualMode}
          effectiveBowlSize={effectiveBowlSize}
          panelId="suggestion-panel"
        />
      )}

      {/* Filter-mode toggle (Taste / Aroma / Cuisine) — show one
          flavor-axis class at a time. Cuisine mode is hidden in
          cocktail context (cocktail ingredients rarely carry cuisine
          tags) AND when no chip exposes one (most pure ingredients). */}
      {snapState !== 'peek' && (
        <div className="flex-shrink-0 px-2 pb-1 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#a09070', fontFamily: FONT_FAMILY }}>Filter by</span>
          {[
            { k: 'taste', label: 'Taste' },
            { k: 'aroma', label: 'Aroma' },
            ...(labMode !== 'cocktail' && cuisineOptions.length > 0 ? [{ k: 'cuisine', label: 'Cuisine' }] : []),
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

      {/* Active-mode tab strip — taste/aroma render as chip pills.
          Cuisine collapses to a single dropdown so the drawer header
          doesn't need to scroll horizontally through 15+ cuisine
          names. Choosing a cuisine populates the chips below with
          replacements scoped to that cuisine. */}
      {snapState !== 'peek' && filterMode === 'cuisine' && (
        <div className="flex-shrink-0 px-2 pb-1">
          <select
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value)}
            className="w-full text-sm rounded-md border px-2 py-1.5"
            style={{
              fontFamily: FONT_FAMILY,
              color: '#3a3428',
              backgroundColor: '#fff8e1',
              borderColor: '#c9b99a',
            }}
          >
            {tabs.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
      )}
      {snapState !== 'peek' && filterMode !== 'cuisine' && (
        <div className="flex-shrink-0 overflow-x-auto px-2 pb-1" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1 min-w-max">
            {tabs.map(t => {
              const isActive = activeTab === t.key;
              const dotColor = t.aromaColor || TASTE_COLORS[t.key];
              return (
                <button
                  key={t.key}
                  onClick={() => onTabChange(t.key)}
                  className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors"
                  style={{
                    fontFamily: FONT_FAMILY,
                    color: isActive ? '#3a3428' : '#a09070',
                    backgroundColor: isActive && dotColor ? `${dotColor}33` : isActive ? '#e8dcc0' : 'transparent',
                    border: `1px solid ${isActive ? (dotColor || '#c9b99a') : 'transparent'}`,
                  }}
                >
                  {dotColor && (
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingredient chips */}
      {snapState !== 'peek' && (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {!centerIngredient && recipeIngredients.length === 0 && (
            <p className="text-center text-sm py-4" style={{ fontFamily: FONT_FAMILY, color: '#a09070' }}>
              Search to get started
            </p>
          )}

          {mode === 'ADD' ? (
            // ADD mode — 8 taste-partitioned columns from recipe co-occurrence ranking.
            <div
              id="suggestion-panel"
              role="tabpanel"
              aria-labelledby="suggestion-panel-tab-add"
              className="grid gap-2 pb-1"
              style={{
                gridTemplateColumns: isMobile
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'repeat(auto-fit, minmax(140px, 1fr))',
              }}
            >
              {addColumns.map(col => {
                const filtered = applyChipFilter(col.candidates, activeTab, nodes);
                const emptyPlaceholder = labMode === 'cocktail'
                  ? `No options in cocktail scope`
                  : `No ${col.taste} candidates`;
                return (
                  <div key={col.taste} data-testid="add-column" data-taste={col.taste} className="flex flex-col min-w-0">
                    <div
                      className="px-2 py-1.5 rounded-t-lg border-2 border-b-0"
                      style={{
                        backgroundColor: '#e8dcc0',
                        borderColor: '#c9b99a',
                        fontFamily: FONT_FAMILY,
                      }}
                    >
                      <p
                        className="font-medium truncate leading-tight"
                        style={{ color: '#3a3428', fontSize: '13px' }}
                      >
                        {col.taste.charAt(0).toUpperCase() + col.taste.slice(1)}
                      </p>
                    </div>
                    <div
                      className="flex-1 flex flex-col gap-1.5 p-1.5 rounded-b-lg border-2 border-t-0"
                      style={{ borderColor: '#c9b99a', backgroundColor: '#fff8e1' }}
                    >
                      {filtered.length === 0 && (
                        <p
                          data-testid="add-column-empty"
                          className="text-xs px-1 py-2 text-center"
                          style={{ color: '#a09070', fontFamily: FONT_FAMILY }}
                        >
                          {emptyPlaceholder}
                        </p>
                      )}
                      {filtered.slice(0, 8).map(chip => (
                        <ChipButton
                          key={chip.name}
                          chip={chip}
                          onAdd={onAddIngredient}
                          centerIngredient={centerIngredient}
                          bridgeCompounds={bridgeCompounds}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : mode === 'REPLACE' ? (
            // REPLACE mode — one column per bowl ingredient. Header IS
            // the replacement target, so chip click swaps that
            // ingredient with the chip.
            //   • Desktop: CSS grid auto-fits as many ~180px columns as
            //     the viewport allows; wraps to a new row beyond that.
            //   • Mobile (≤640px / iOS Capacitor): 2 columns max,
            //     stacked into more rows when bowl size > 2.
            <div
              id="suggestion-panel"
              role="tabpanel"
              aria-labelledby="suggestion-panel-tab-replace"
              className="grid gap-2 pb-1"
              style={{
                gridTemplateColumns: isMobile
                  ? (replaceColumns.length <= 2
                      ? `repeat(${replaceColumns.length}, minmax(0, 1fr))`
                      : 'repeat(2, minmax(0, 1fr))')
                  : 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              {replaceColumns.map(col => {
                const filtered = applyChipFilter(col.candidates, activeTab, nodes);
                return (
                  <div key={col.ingredient} className="flex flex-col min-w-0">
                    <div
                      className="px-2 py-1.5 rounded-t-lg border-2 border-b-0 mb-0"
                      style={{
                        backgroundColor: '#e8dcc0',
                        borderColor: '#c9b99a',
                        fontFamily: FONT_FAMILY,
                      }}
                      title={`Replace "${col.ingredient}"`}
                    >
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#7a6a4a' }}>Replace</p>
                      <p
                        className="font-medium truncate leading-tight"
                        style={{ color: '#3a3428', fontSize: '14px' }}
                      >
                        {col.ingredient}
                      </p>
                    </div>
                    <div
                      className="flex-1 flex flex-col gap-1.5 p-1.5 rounded-b-lg border-2 border-t-0"
                      style={{ borderColor: '#c9b99a', backgroundColor: '#fff8e1' }}
                    >
                      {filtered.length === 0 && (
                        <p className="text-xs px-1 py-2 text-center" style={{ color: '#a09070', fontFamily: FONT_FAMILY }}>
                          No matches
                        </p>
                      )}
                      {filtered.slice(0, 8).map(chip => (
                        <ChipButton
                          key={chip.name}
                          chip={chip}
                          onAdd={(name) => {
                            if (onSwapIngredient) onSwapIngredient(col.ingredient, name);
                            else onAddIngredient(name);
                          }}
                          centerIngredient={col.ingredient}
                          bridgeCompounds={bridgeCompounds}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {filteredChips.map(chip => (
                  <ChipButton
                    key={chip.name}
                    chip={chip}
                    onAdd={onAddIngredient}
                    centerIngredient={centerIngredient}
                    bridgeCompounds={bridgeCompounds}
                  />
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
                      <ChipButton
                        key={chip.name}
                        chip={chip}
                        onAdd={onAddIngredient}
                        showTasteBadge
                        centerIngredient={centerIngredient}
                        bridgeCompounds={bridgeCompounds}
                      />
                    ))}
                  </div>
                </>
              )}
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
