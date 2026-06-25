/**
 * IngredientPicker — chalkboard-menu rev2 (B-version P4.5).
 *
 * Two-stage interaction:
 *   1. Tap an ingredient row → pin it as a "primary flavor focus" on
 *      the taste radar. Multiple primaries accumulate. The row swaps
 *      to an "+ Add to Recipe" button.
 *   2. Tap "+ Add to Recipe" → commit that specific ingredient to the
 *      recipe (parent's onSelect callback). The committed primary is
 *      cleared from the radar; other pinned primaries stay so the user
 *      can keep narrowing the list.
 *
 * List filtering rules (in order, all applied):
 *   - Layer 1 (notebook mode only): dish-type filter
 *   - Layer 2: search-bar substring match on name (when non-empty)
 *   - Layer 3: when ≥1 primary is pinned, narrow to ingredients that
 *              pair with ANY primary at NPMI ≥ PAIR_THRESHOLD. The
 *              chosenAxis filter is ignored when primaries exist
 *              (pinned primaries take precedence).
 *   - Layer 4: when NO primaries are pinned AND a chosen axis is set,
 *              narrow to ingredients in that axis's bucket.
 *
 * Modes (unchanged from rev1):
 *   - 'notebook' → row tap = pin; commit calls onSelect(name)
 *   - 'guided'   → row tap = navigate to PairingMode (onIngredientPick)
 *
 * Chalkboard aesthetic: near-black slate background, double chalk-rail
 * border, Caveat handwriting font, cream-chalk text with chalk-dust
 * text-shadow. Matches PairingModeCard's chalkboard treatment.
 */

import React, { useMemo, useState } from 'react';
import { CATEGORICAL_AXES, bucketOf } from '../data/categoricalAxes.js';
import { getNeighborsEnriched } from '../data/graph.js';
import HelpBubble from './HelpBubble.jsx';

const FONT_HAND = 'Caveat, cursive';
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_BORDER_OUTER = '#4a4a4a';
const CHALK_BORDER_INNER = '#6a6a6a';
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_SUB = '#8a8478';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

const PAIR_THRESHOLD = 0.5;
const MAX_ROWS = 80;

const CLUSTER_COLORS = [
  '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7',
  '#84cc16', '#fb7185', '#0ea5e9', '#facc15', '#14b8a6',
  '#fde68a', '#94a3b8',
];
function clusterColor(node) {
  const cid = typeof node?.cluster === 'number' ? node.cluster : 0;
  return CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
}

const PILLS = [
  { type: 'taste',   label: 'Taste',   axisKey: 'taste'   },
  { type: 'aroma',   label: 'Aroma',   axisKey: 'aromas'  },
  { type: 'season',  label: 'Season',  axisKey: 'season'  },
  { type: 'cuisine', label: 'Cuisine', axisKey: 'cuisine' },
  { type: 'family',  label: 'Family',  axisKey: 'family'  },
];

const RADAR_SIZE = 240;
const CENTER = RADAR_SIZE / 2;
const RADIUS = CENTER - 32;

function axisAngle(i, n) {
  return (Math.PI * 2 * i) / n - Math.PI / 2;
}

function wedgePath(cx, cy, radius, n, i) {
  const half = Math.PI / n;
  const a = axisAngle(i, n);
  const x0 = cx + radius * Math.cos(a - half);
  const y0 = cy + radius * Math.sin(a - half);
  const x1 = cx + radius * Math.cos(a + half);
  const y1 = cy + radius * Math.sin(a + half);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
}

function valueForAxisInPicker(node, filterType, axisKey, ctx) {
  if (!node || axisKey == null) return 0;
  const key = String(axisKey).toLowerCase();
  if (filterType === 'taste') {
    const tokens = (node.taste || '').toLowerCase().split(/[\s,/]+/).filter(Boolean);
    return tokens.includes(key) ? 1 : 0;
  }
  if (filterType === 'season') {
    const tokens = (node.season || '').toLowerCase().split(/[\s,/-]+/).filter(Boolean);
    if (tokens.includes(key)) return 1;
    const seasonStr = ctx?.seasonMap?.[node.name]?.season;
    if (typeof seasonStr === 'string' && seasonStr.toLowerCase().includes(key)) return 1;
    return 0;
  }
  if (filterType === 'aroma') {
    const tier1 = node?.flavorGraph?.tier1;
    if (Array.isArray(tier1) && tier1.some((t) => String(t).toLowerCase() === key)) return 1;
    return 0;
  }
  if (filterType === 'cuisine') {
    const list = Array.isArray(node?.cuisines) ? node.cuisines : [];
    return list.some((c) => String(c).toLowerCase() === key) ? 1 : 0;
  }
  if (filterType === 'family') {
    const cat = String(node?.category || '').toLowerCase();
    return cat === key ? 1 : 0;
  }
  return 0;
}

function PickerRadar({ filterType, chosenAxis, primaries, onAxisTap, onPinClick, ctx }) {
  const axisKey = PILLS.find((p) => p.type === filterType)?.axisKey || 'taste';
  const axis = CATEGORICAL_AXES[axisKey];
  if (!axis) return null;
  const labels = axis.labels;
  const colors = axis.colors;
  const N = labels.length;
  const chosenIdx = chosenAxis != null ? labels.indexOf(chosenAxis) : -1;

  return (
    <svg
      width={RADAR_SIZE}
      height={RADAR_SIZE}
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      role="img"
      aria-label={`${filterType} radar. ${primaries.length} primaries pinned.`}
      data-testid="ingredient-picker-radar"
      data-chosen-axis={chosenAxis || ''}
      data-primary-count={primaries.length}
    >
      {[0.33, 0.66, 1.0].map((f, i) => (
        <polygon
          key={i}
          points={labels.map((_, j) => {
            const a = axisAngle(j, N);
            const r = RADIUS * f;
            return `${CENTER + r * Math.cos(a)},${CENTER + r * Math.sin(a)}`;
          }).join(' ')}
          fill="none"
          stroke={CHALK_BORDER_INNER + '88'}
          strokeWidth={f === 1.0 ? 1 : 0.5}
        />
      ))}
      {labels.map((_, i) => {
        const a = axisAngle(i, N);
        return (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={CENTER + RADIUS * Math.cos(a)}
            y2={CENTER + RADIUS * Math.sin(a)}
            stroke={CHALK_BORDER_INNER + '66'}
            strokeWidth={0.5}
          />
        );
      })}
      {chosenIdx >= 0 && primaries.length === 0 && (
        <path
          d={wedgePath(CENTER, CENTER, RADIUS, N, chosenIdx)}
          fill={colors[chosenIdx] || '#22d3ee'}
          fillOpacity={0.22}
          stroke={colors[chosenIdx] || '#22d3ee'}
          strokeWidth={1}
        />
      )}
      {primaries.map((p, pi) => {
        const matchedIndices = labels
          .map((lbl, i) => valueForAxisInPicker(p.node, filterType, lbl, ctx) > 0 ? i : -1)
          .filter((i) => i >= 0);
        if (matchedIndices.length === 0) {
          return (
            <g
              key={`pin-${p.name}`}
              transform={`translate(${CENTER}, ${CENTER + 14 + pi * 14})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onPinClick?.(p.name)}
              data-testid={`picker-radar-pin-${p.name}`}
            >
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill={clusterColor(p.node)}
                style={{ fontFamily: FONT_HAND }}
              >
                {p.name}
              </text>
            </g>
          );
        }
        let cx = 0; let cy = 0;
        for (const i of matchedIndices) {
          const a = axisAngle(i, N);
          cx += Math.cos(a) * RADIUS * 0.85;
          cy += Math.sin(a) * RADIUS * 0.85;
        }
        cx = CENTER + cx / matchedIndices.length;
        cy = CENTER + cy / matchedIndices.length;
        const fill = clusterColor(p.node);
        return (
          <g key={`pin-${p.name}`} style={{ cursor: 'pointer' }} onClick={() => onPinClick?.(p.name)} data-testid={`picker-radar-pin-${p.name}`}>
            <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={1.5} />
            <text
              x={cx}
              y={cy - 9}
              textAnchor="middle"
              fontSize={10}
              fill={CHALK_CREAM}
              style={{ fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
            >
              {p.name}
            </text>
          </g>
        );
      })}
      {labels.map((label, i) => {
        const a = axisAngle(i, N);
        const tx = CENTER + (RADIUS + 14) * Math.cos(a);
        const ty = CENTER + (RADIUS + 14) * Math.sin(a);
        const isChosen = i === chosenIdx;
        return (
          <g
            key={label}
            data-testid={`picker-axis-${label}`}
            onClick={() => onAxisTap?.(isChosen ? null : label)}
            style={{ cursor: 'pointer' }}
          >
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={isChosen ? 700 : 600}
              fill={colors[i] || CHALK_DIM}
              style={{ fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
            >
              {label}
            </text>
          </g>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r={2.5} fill={CHALK_DIM} />
    </svg>
  );
}

function dishTypeAllows(node, dishType) {
  if (!dishType) return true;
  if (dishType === 'cocktail') {
    return node?.inCocktailLab === true || node?.category === 'Cocktail';
  }
  if (dishType === 'sauce') {
    return node?.inSauceLab === true || node?.category === 'Sauce';
  }
  return true;
}

export default function IngredientPicker({
  mode = 'notebook',
  ctx = null,
  dishType = null,
  alreadyAdded = [],
  onSelect,
  onIngredientPick,
  onClose,
  maxRows = MAX_ROWS,
  // Curated-candidate mode (Suggest / Replace): when a name array is supplied
  // the list shows ONLY those candidates, in their ranked order. null = the
  // open-ended Add flow (browse the full ingredient universe).
  candidateNames = null,
  title = null,
}) {
  // B-version (2026-06-03): the picker no longer hides non-matching
  // rows on search. The search query SORTS matches to the top instead
  // of filtering out the rest, so a user who types "tomato" still sees
  // tomato (now at the top) AND every other ingredient below. Already-
  // added ingredients carry a chalk badge so users know they're already
  // in the recipe — they can still re-pin/commit them to add again.
  const alreadyAddedSet = useMemo(() => new Set(alreadyAdded || []), [alreadyAdded]);
  const [filterType, setFilterType] = useState('taste');
  const [chosenAxis, setChosenAxis] = useState(null);
  const [search, setSearch] = useState('');
  const [primaries, setPrimaries] = useState([]); // [{name, node}, ...]
  const [confirming, setConfirming] = useState(null); // name string when popup is open

  const activePill = PILLS.find((p) => p.type === filterType) || PILLS[0];
  const nodes = ctx?.graph?.nodes;
  const edges = ctx?.graph?.edges;

  // Union pairing-strength set: when ≥1 primary is pinned, build the
  // set of every node that pairs with ANY primary at NPMI ≥ threshold.
  const primaryPairSet = useMemo(() => {
    if (primaries.length === 0 || !Array.isArray(edges)) return null;
    const set = new Set();
    for (const p of primaries) {
      try {
        const neighbors = getNeighborsEnriched(p.name, edges, ctx?.cuisineNeighborIndex || null);
        for (const n of neighbors) {
          if (typeof n.strength === 'number' && n.strength >= PAIR_THRESHOLD) {
            set.add(n.name);
          }
        }
      } catch { /* skip */ }
    }
    for (const p of primaries) set.delete(p.name);
    return set;
  }, [primaries, edges, ctx]);

  const ingredients = useMemo(() => {
    if (!nodes || typeof nodes.values !== 'function') return [];
    const q = search.trim().toLowerCase();

    // Curated mode (Suggest / Replace): list only the supplied candidate names,
    // in their ranked order, filtered by dish-type + search. Pills/axis/pin
    // filtering is bypassed — the candidate list is the point.
    if (Array.isArray(candidateNames)) {
      const curated = [];
      for (const name of candidateNames) {
        const node = nodes.get(name);
        if (!node) continue;
        if (mode === 'notebook' && !dishTypeAllows(node, dishType)) continue;
        const lower = name.toLowerCase();
        if (q && !lower.includes(q)) continue;
        curated.push({ name, node, pairingCount: node.pairingCount || 0, matchesSearch: !!q && lower.includes(q) });
        if (curated.length >= maxRows) break;
      }
      return curated;
    }

    const out = [];
    for (const node of nodes.values()) {
      if (mode === 'notebook' && !dishTypeAllows(node, dishType)) continue;
      if (primaryPairSet) {
        if (!primaryPairSet.has(node.name)) continue;
      } else {
        const bucket = bucketOf(activePill.type, node, ctx || {});
        if (!bucket) continue;
        if (chosenAxis != null && bucket !== chosenAxis) continue;
      }
      const lower = node.name.toLowerCase();
      const matchesSearch = q && lower.includes(q);
      out.push({
        name: node.name,
        node,
        pairingCount: node.pairingCount || 0,
        matchesSearch,
      });
      if (out.length >= maxRows * 4) break;
    }
    // Sort: search matches first, then pairingCount desc.
    out.sort((a, b) => {
      if (a.matchesSearch !== b.matchesSearch) return a.matchesSearch ? -1 : 1;
      return (b.pairingCount || 0) - (a.pairingCount || 0);
    });
    return out.slice(0, maxRows);
  }, [nodes, ctx, activePill.type, chosenAxis, dishType, mode, maxRows, search, primaryPairSet, candidateNames]);

  const pinnedNames = useMemo(() => new Set(primaries.map((p) => p.name)), [primaries]);

  const handlePillSelect = (type) => {
    setFilterType(type);
    setChosenAxis(null);
  };

  const handleRowTap = (ing) => {
    if (mode === 'guided') {
      onIngredientPick?.(ing.name);
      return;
    }
    // Notebook mode: tap pins to radar as a primary focus.
    if (pinnedNames.has(ing.name)) return;
    setPrimaries((prev) => [...prev, { name: ing.name, node: ing.node }]);
  };

  const handleCommit = (name) => {
    onSelect?.(name);
    setPrimaries((prev) => prev.filter((p) => p.name !== name));
  };

  const handleUnpin = (name) => {
    setPrimaries((prev) => prev.filter((p) => p.name !== name));
  };

  return (
    <div
      className="w-full max-w-3xl mx-auto rounded-2xl shadow-xl flex flex-col"
      style={{
        background: CHALK_BG,
        border: `2px double ${CHALK_BORDER_OUTER}`,
        boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)`,
        maxHeight: '90vh',
      }}
      data-testid="ingredient-picker"
      data-mode={mode}
      data-dish-type={dishType || ''}
      data-primary-count={primaries.length}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${CHALK_BORDER_INNER}55` }}
      >
        <h2
          style={{
            color: CHALK_CREAM,
            fontFamily: FONT_HAND,
            fontSize: 26,
            textShadow: CHALK_TEXT_SHADOW,
            letterSpacing: '0.01em',
          }}
        >
          {title || (mode === 'notebook' ? 'Ingredient choices' : 'Discover by flavor')}
        </h2>
        <div className="flex items-center gap-1">
          {mode === 'notebook' && (
            <HelpBubble
              variant="chalk"
              placement="bottom"
              label="How to add an ingredient"
              testId="picker-help"
              title="Adding an ingredient"
              body={[
                'Tap an ingredient row — it pins as a dot on the taste radar.',
                'Tap that dot, then “Yes, add to recipe” to add it.',
                'Once pinned, the row’s “+ Add to Recipe” shortcut works too.',
                'Try pinning a few to compare their flavors on the radar.',
              ]}
            />
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              data-testid="picker-close"
              aria-label="Close ingredient picker"
              style={{
                color: CHALK_DIM,
                fontFamily: FONT_HAND,
                fontSize: 22,
                padding: '0 8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Picker filter type"
        className="flex items-center gap-2 px-3 py-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', borderBottom: `1px solid ${CHALK_BORDER_INNER}55` }}
        data-testid="picker-pills"
      >
        {PILLS.map((p) => {
          const isActive = p.type === filterType;
          return (
            <button
              key={p.type}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => handlePillSelect(p.type)}
              data-testid={`picker-pill-${p.type}`}
              className="flex-shrink-0 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
              style={{
                color: isActive ? '#0a0a0a' : CHALK_DIM,
                background: isActive ? CHALK_CREAM : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? CHALK_CREAM : CHALK_BORDER_INNER}`,
                fontFamily: FONT_HAND,
                fontSize: 16,
                minHeight: 32,
                textShadow: isActive ? 'none' : CHALK_TEXT_SHADOW,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 px-4 py-3 flex-1 min-h-0">
        <div className="flex flex-col items-center gap-2">
          <PickerRadar
            filterType={filterType}
            chosenAxis={chosenAxis}
            primaries={primaries}
            onAxisTap={(label) => setChosenAxis(label)}
            onPinClick={(name) => setConfirming(name)}
            ctx={ctx}
          />
          {confirming && (
            <div
              className="rounded-md px-3 py-2 flex flex-col items-center gap-2"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${CHALK_BORDER_INNER}`,
                width: RADAR_SIZE,
              }}
              data-testid="picker-radar-confirm"
              data-confirm-name={confirming}
            >
              <span
                className="text-center"
                style={{
                  color: CHALK_CREAM,
                  fontFamily: FONT_HAND,
                  fontSize: 17,
                  textShadow: CHALK_TEXT_SHADOW,
                }}
              >
                Add <span style={{ color: '#bbf7d0' }}>{confirming}</span> to the recipe?
              </span>
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    onSelect?.(confirming);
                    setPrimaries((prev) => prev.filter((p) => p.name !== confirming));
                    setConfirming(null);
                  }}
                  data-testid="picker-radar-confirm-yes"
                  className="flex-1 rounded-md py-1 px-2"
                  style={{
                    color: '#bbf7d0',
                    background: 'rgba(16, 78, 51, 0.55)',
                    border: '1px solid rgba(110, 231, 183, 0.45)',
                    fontFamily: FONT_HAND,
                    fontSize: 15,
                    textShadow: CHALK_TEXT_SHADOW,
                  }}
                >
                  Yes, add to recipe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUnpin(confirming);
                    setConfirming(null);
                  }}
                  data-testid="picker-radar-confirm-remove"
                  className="rounded-md py-1 px-2"
                  style={{
                    color: CHALK_DIM,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${CHALK_BORDER_INNER}`,
                    fontFamily: FONT_HAND,
                    fontSize: 14,
                    textShadow: CHALK_TEXT_SHADOW,
                  }}
                >
                  Unpin
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  data-testid="picker-radar-confirm-cancel"
                  className="rounded-md py-1 px-2"
                  style={{
                    color: CHALK_SUB,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${CHALK_BORDER_INNER}`,
                    fontFamily: FONT_HAND,
                    fontSize: 14,
                    textShadow: CHALK_TEXT_SHADOW,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div
            className="text-[12px] italic"
            style={{ color: CHALK_DIM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
          >
            {primaries.length > 0
              ? `${primaries.length} primary${primaries.length === 1 ? '' : ' primaries'} pinned`
              : chosenAxis
                ? `Leaning ${chosenAxis.toLowerCase()}`
                : 'Tap an axis to filter — tap an ingredient to pin'}
          </div>
        </div>

        <div className="flex flex-col min-h-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients…"
            data-testid="picker-search"
            className="w-full mb-2 px-3 py-2 rounded-md outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${CHALK_BORDER_INNER}`,
              color: CHALK_CREAM,
              fontFamily: FONT_HAND,
              fontSize: 18,
              textShadow: CHALK_TEXT_SHADOW,
            }}
          />
          <div
            className="flex-1 overflow-y-auto rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${CHALK_BORDER_INNER}55`,
              minHeight: 240,
              maxHeight: 360,
            }}
            data-testid="picker-ingredient-list"
          >
            {ingredients.length === 0 ? (
              <div
                className="flex-1 flex items-center justify-center px-4 py-6 text-center"
                style={{ color: CHALK_SUB, fontFamily: FONT_HAND, fontSize: 16 }}
              >
                {search.trim() ? `No matches for "${search.trim()}"` : 'No ingredients match this filter.'}
                {primaries.length > 0 ? ' Try unpinning a primary or widening the search.' : ''}
              </div>
            ) : (
              ingredients.map((ing) => {
                const pinned = pinnedNames.has(ing.name);
                if (pinned) {
                  return (
                    <button
                      key={ing.name}
                      type="button"
                      onClick={() => handleCommit(ing.name)}
                      data-testid={`picker-commit-${ing.name}`}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors"
                      style={{
                        background: 'rgba(134, 239, 172, 0.10)',
                        borderBottom: `1px solid ${CHALK_BORDER_INNER}33`,
                        color: '#bbf7d0',
                        fontFamily: FONT_HAND,
                        fontSize: 18,
                        textShadow: CHALK_TEXT_SHADOW,
                      }}
                    >
                      <span className="truncate">{ing.name}</span>
                      <span
                        className="px-2 py-0.5 rounded text-[14px] tracking-wide"
                        style={{
                          background: 'rgba(16, 78, 51, 0.55)',
                          color: '#bbf7d0',
                          border: '1px solid rgba(110, 231, 183, 0.45)',
                        }}
                      >
                        + Add to Recipe
                      </span>
                    </button>
                  );
                }
                const isAlready = alreadyAddedSet.has(ing.name);
                // HELP-6: "+ Add" is the always-visible primary action — one tap
                // adds the ingredient. The row BODY is the optional, demoted
                // pin-to-radar gesture (compare flavors). In guided mode there
                // is no pin/add split — tapping the row picks directly.
                return (
                  <div
                    key={ing.name}
                    className="w-full flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/5"
                    style={{
                      borderBottom: `1px solid ${CHALK_BORDER_INNER}33`,
                      background: ing.matchesSearch ? 'rgba(134, 231, 245, 0.06)' : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleRowTap(ing)}
                      data-testid={`picker-row-${ing.name}`}
                      data-already-added={isAlready ? 'yes' : 'no'}
                      data-search-match={ing.matchesSearch ? 'yes' : 'no'}
                      className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left"
                      style={{
                        color: CHALK_CREAM,
                        fontFamily: FONT_HAND,
                        fontSize: 18,
                        textShadow: CHALK_TEXT_SHADOW,
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                      title={mode === 'notebook' ? `Pin ${ing.name} on the radar to compare` : undefined}
                    >
                      <span className="truncate flex-1">{ing.name}</span>
                      {isAlready && (
                        <span
                          className="text-[12px] px-1.5 py-0 rounded-md flex-shrink-0"
                          style={{
                            color: '#fde68a',
                            background: 'rgba(252, 211, 77, 0.12)',
                            border: '1px solid rgba(252, 211, 77, 0.30)',
                          }}
                        >
                          already added
                        </span>
                      )}
                      <span
                        className="text-[13px] tabular-nums flex-shrink-0"
                        style={{ color: CHALK_SUB }}
                      >
                        {ing.pairingCount}
                      </span>
                    </button>
                    {mode === 'notebook' && (
                      <button
                        type="button"
                        onClick={() => handleCommit(ing.name)}
                        data-testid={`picker-add-${ing.name}`}
                        aria-label={`Add ${ing.name} to recipe`}
                        className="flex-shrink-0 px-2.5 py-1 rounded text-[14px] tracking-wide min-h-[36px]"
                        style={{
                          background: 'rgba(16, 78, 51, 0.55)',
                          color: '#bbf7d0',
                          border: '1px solid rgba(110, 231, 183, 0.45)',
                          fontFamily: FONT_HAND,
                        }}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div
        className="px-4 py-2"
        style={{
          color: CHALK_SUB,
          fontFamily: FONT_HAND,
          fontSize: 14,
          textShadow: CHALK_TEXT_SHADOW,
          borderTop: `1px solid ${CHALK_BORDER_INNER}55`,
        }}
      >
        {mode === 'notebook'
          ? 'Tap "+ Add" to add an ingredient · tap a row name to pin it on the radar and compare flavors.'
          : 'Tap an ingredient to explore its pairings.'}
      </div>
    </div>
  );
}

export { PILLS as INGREDIENT_PICKER_PILLS };
