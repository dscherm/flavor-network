/**
 * RecipeFlavorProfileCard — aggregated flavor profile for the recipe
 * currently being built in the notebook (B-version 2026-06-03).
 *
 * Inputs:
 *   ingredients     — recipe ingredient names (string[])
 *   nodes           — graph nodes Map for data lookup
 *   edges           — graph edges (used for suggestions)
 *   gnnEntropy      — optional gnnEntropy map for aroma probs
 *   selectedIdx     — when set (iOS one-at-a-time mode), the radars
 *                     show the profile of ingredients[selectedIdx] only;
 *                     when null, show aggregate of every ingredient
 *
 * Renders 4 mini radars (Taste / Aroma / Cuisine / Season), an
 * analysis sentence, and up to 3 pairing suggestions. The notebook
 * keeps its paper aesthetic — the card itself uses the same palette.
 */

import React, { useMemo } from 'react';
import { getAxesFor, getColorMapFor } from '../data/guidedRadarAxes.js';

const FONT = 'Caveat, cursive';
const PAPER_BG = '#fefae0';
const PAPER_BORDER = '#c9b99a';
const INK = '#3a3428';
const INK_DIM = '#7a6a4a';
const INK_FAINT = '#a09070';

function axisAngle(i, n) {
  return (Math.PI * 2 * i) / n - Math.PI / 2;
}

function tokenize(str) {
  if (!str || typeof str !== 'string') return [];
  return str.toLowerCase().split(/[\s,/-]+/).filter(Boolean);
}

// Per-axis value: 1 if any ingredient tokenizes-includes the axis
// label, else 0. For aroma, also check chef tier1 + GNN prob.
function ingredientValueForAxis(node, filterType, axisKey) {
  if (!node) return 0;
  const key = String(axisKey).toLowerCase();
  if (filterType === 'taste') {
    return tokenize(node.taste).includes(key) ? 1 : 0;
  }
  if (filterType === 'season') {
    return tokenize(node.season).includes(key) ? 1 : 0;
  }
  if (filterType === 'cuisine') {
    const list = Array.isArray(node.cuisines) ? node.cuisines : [];
    return list.some((c) => String(c).toLowerCase() === key) ? 1 : 0;
  }
  if (filterType === 'aroma') {
    const tier1 = node?.flavorGraph?.tier1;
    if (Array.isArray(tier1) && tier1.some((t) => String(t).toLowerCase() === key)) return 1;
    const gnnMap = {
      fruity: 'odor_fruity', floral: 'odor_floral',
      green: 'odor_green', woody: 'odor_woody', creamy: 'odor_fatty',
    };
    const col = gnnMap[key];
    const p = node?.gnnProbs?.[col];
    if (typeof p === 'number') return p;
    return 0;
  }
  return 0;
}

// Aggregate values across a set of ingredients. For each axis,
// return the fraction of ingredients that score >= 0.5 on that axis.
function aggregateProfile(nodes, filterType) {
  const axes = getAxesFor(filterType) || [];
  if (axes.length === 0 || !nodes || nodes.length === 0) return new Array(axes.length).fill(0);
  return axes.map((axisKey) => {
    let total = 0;
    for (const n of nodes) {
      const v = ingredientValueForAxis(n, filterType, axisKey);
      if (v >= 0.5) total += 1;
    }
    return total / nodes.length;
  });
}

function MiniRadar({ filterType, values, size = 130, label = '' }) {
  const axes = getAxesFor(filterType) || [];
  const colors = getColorMapFor(filterType) || {};
  const N = axes.length;
  if (N === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.28;
  const labelOffset = size * 0.085;
  const gridLevels = [0.33, 0.66, 1.0];

  const polyPoints = values.map((v, i) => {
    const a = axisAngle(i, N);
    const r = v * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const gridPoints = (level) => axes.map((_, i) => {
    const a = axisAngle(i, N);
    const r = level * radius;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const fontSize = N > 8 ? 8 : 9;

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width: size + 12 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${label} radar`}
        data-testid={`recipe-profile-radar-${filterType}`}
      >
        {gridLevels.map((lvl) => (
          <polygon
            key={lvl}
            points={gridPoints(lvl)}
            fill="none"
            stroke="rgba(74,60,40,0.30)"
            strokeWidth={lvl === 1.0 ? 1 : 0.5}
          />
        ))}
        {axes.map((_, i) => {
          const a = axisAngle(i, N);
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={cx + radius * Math.cos(a)}
              y2={cy + radius * Math.sin(a)}
              stroke="rgba(74,60,40,0.25)"
              strokeWidth={0.5}
            />
          );
        })}
        <polygon
          points={polyPoints}
          fill="rgba(90,74,42,0.20)"
          stroke="#5a4a2a"
          strokeWidth={1.5}
        />
        {axes.map((axisLabel, i) => {
          const a = axisAngle(i, N);
          const cosA = Math.cos(a);
          const sinA = Math.sin(a);
          const tx = cx + (radius + labelOffset) * cosA;
          const ty = cy + (radius + labelOffset) * sinA;
          const textAnchor = cosA > 0.15 ? 'start' : cosA < -0.15 ? 'end' : 'middle';
          const dominantBaseline = sinA > 0.55 ? 'hanging' : sinA < -0.55 ? 'auto' : 'middle';
          return (
            <text
              key={axisLabel}
              x={tx} y={ty}
              textAnchor={textAnchor}
              dominantBaseline={dominantBaseline}
              fontSize={fontSize}
              fontWeight={600}
              fill={colors[axisLabel] || INK_DIM}
              style={{ fontFamily: FONT }}
            >
              {axisLabel}
            </text>
          );
        })}
      </svg>
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: INK_FAINT, fontFamily: FONT }}
      >
        {label}
      </div>
    </div>
  );
}

function topAxes(values, axes, n = 2) {
  return values
    .map((v, i) => ({ axis: axes[i], v }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((x) => x.axis);
}

function buildAnalysis(focusedIngredients, profiles, bowlSize, isFocused) {
  if (focusedIngredients.length === 0) return 'Add ingredients to see the recipe’s profile.';
  const tasteTop = topAxes(profiles.taste, getAxesFor('taste'), 2);
  const aromaTop = topAxes(profiles.aroma, getAxesFor('aroma'), 2);
  const cuisineTop = topAxes(profiles.cuisine, getAxesFor('cuisine'), 1);
  const seasonTop = topAxes(profiles.season, getAxesFor('season'), 1);
  const parts = [];
  if (tasteTop.length > 0) parts.push(`leans ${tasteTop.map((s) => s.toLowerCase()).join(' + ')}`);
  if (aromaTop.length > 0) parts.push(`with ${aromaTop.map((s) => s.toLowerCase()).join(' + ')} aroma`);
  if (cuisineTop.length > 0) parts.push(`reads ${cuisineTop[0].toLowerCase()}`);
  if (seasonTop.length > 0) parts.push(`fits a ${seasonTop[0].toLowerCase()} table`);
  // Single-ingredient view (iOS focus mode OR a bowl of one) reads as
  // a per-ingredient profile, not a recipe-aggregate ("X alone").
  if (focusedIngredients.length === 1) {
    const name = focusedIngredients[0];
    if (parts.length === 0) {
      return isFocused
        ? `${name} — profile too sparse to read yet.`
        : `${name} alone — add more ingredients to chart a flavor balance.`;
    }
    return isFocused
      ? `${name} — ${parts.join(', ')}.`
      : `${name} alone — ${parts.join(', ')}. Add more ingredients to chart a balance.`;
  }
  if (parts.length === 0) return 'Profile too sparse to read yet — try more chef-curated ingredients.';
  return `${focusedIngredients.length} ingredients — ${parts.join(', ')}.`;
}

function rankSuggestions(ingredients, edges, ingredientSet) {
  if (!Array.isArray(edges) || ingredients.length === 0) return [];
  const score = new Map();
  for (const e of edges) {
    const a = e.source ?? e.ingredientA;
    const b = e.target ?? e.ingredientB;
    const s = typeof e.strength === 'number' ? e.strength : 0;
    if (!a || !b || s < 0.45) continue;
    if (ingredientSet.has(a) && !ingredientSet.has(b)) {
      score.set(b, (score.get(b) || 0) + s);
    } else if (ingredientSet.has(b) && !ingredientSet.has(a)) {
      score.set(a, (score.get(a) || 0) + s);
    }
  }
  return [...score.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([name]) => name);
}

export default function RecipeFlavorProfileCard({
  ingredients = [],
  nodes = null,
  edges = null,
  selectedIdx = null,
  onSelectIngredient,
}) {
  const focusedIngredients = useMemo(() => {
    if (typeof selectedIdx === 'number' && ingredients[selectedIdx]) {
      return [ingredients[selectedIdx]];
    }
    return ingredients;
  }, [ingredients, selectedIdx]);

  const focusedNodes = useMemo(() => {
    if (!nodes || typeof nodes.get !== 'function') return [];
    return focusedIngredients
      .map((name) => nodes.get(name))
      .filter(Boolean);
  }, [focusedIngredients, nodes]);

  const profiles = useMemo(() => ({
    taste: aggregateProfile(focusedNodes, 'taste'),
    aroma: aggregateProfile(focusedNodes, 'aroma'),
    cuisine: aggregateProfile(focusedNodes, 'cuisine'),
    season: aggregateProfile(focusedNodes, 'season'),
  }), [focusedNodes]);

  const isFocused = typeof selectedIdx === 'number' && Boolean(ingredients[selectedIdx]);
  const analysis = useMemo(
    () => buildAnalysis(focusedIngredients, profiles, ingredients.length, isFocused),
    [focusedIngredients, profiles, ingredients.length, isFocused],
  );

  const suggestions = useMemo(() => {
    const set = new Set(ingredients);
    return rankSuggestions(ingredients, edges, set);
  }, [ingredients, edges]);

  return (
    <div
      className="mx-3 mt-3 mb-4 rounded-lg border-2 px-3 py-3"
      style={{
        backgroundColor: PAPER_BG,
        borderColor: PAPER_BORDER,
        boxShadow: '0 4px 12px rgba(58,52,40,0.10)',
      }}
      data-testid="recipe-flavor-profile-card"
      data-ingredient-count={ingredients.length}
      data-focused-idx={selectedIdx ?? ''}
    >
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-lg"
          style={{ color: INK, fontFamily: FONT }}
        >
          {isFocused
            ? `Flavor profile — ${ingredients[selectedIdx]}`
            : 'Flavor profile'}
        </h3>
        {isFocused && (
          <button
            type="button"
            onClick={() => onSelectIngredient?.(null)}
            data-testid="recipe-profile-show-all"
            className="text-xs px-2 py-1 rounded-md border"
            style={{
              color: INK_DIM,
              borderColor: PAPER_BORDER,
              backgroundColor: 'rgba(255,255,255,0.4)',
              fontFamily: FONT,
            }}
          >
            ← show all
          </button>
        )}
      </div>

      {ingredients.length > 1 && !isFocused && onSelectIngredient && (
        <div className="flex flex-wrap gap-1 mb-2" data-testid="recipe-profile-tabs">
          {ingredients.map((name, i) => (
            <button
              key={`${name}-${i}`}
              type="button"
              onClick={() => onSelectIngredient(i)}
              data-testid={`recipe-profile-tab-${i}`}
              className="text-xs px-2 py-0.5 rounded-md border"
              style={{
                color: INK_DIM,
                borderColor: PAPER_BORDER,
                backgroundColor: 'rgba(255,255,255,0.4)',
                fontFamily: FONT,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <MiniRadar filterType="taste"   values={profiles.taste}   label="Taste" />
        <MiniRadar filterType="aroma"   values={profiles.aroma}   label="Aroma" />
        <MiniRadar filterType="cuisine" values={profiles.cuisine} label="Cuisine" />
        <MiniRadar filterType="season"  values={profiles.season}  label="Season" />
      </div>

      <p
        className="text-sm leading-snug mb-2"
        style={{ color: INK_DIM, fontFamily: FONT }}
        data-testid="recipe-profile-analysis"
      >
        {analysis}
      </p>

      {suggestions.length > 0 && (
        <div className="flex items-baseline flex-wrap gap-1.5" data-testid="recipe-profile-suggestions">
          <span
            className="text-[11px] uppercase tracking-wider mr-1"
            style={{ color: INK_FAINT, fontFamily: FONT }}
          >
            Try also
          </span>
          {suggestions.map((name) => (
            <span
              key={name}
              data-testid={`recipe-profile-suggestion-${name}`}
              className="px-2 py-0.5 rounded-full text-[13px] border"
              style={{
                color: INK,
                borderColor: PAPER_BORDER,
                backgroundColor: 'rgba(232,220,192,0.65)',
                fontFamily: FONT,
              }}
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
