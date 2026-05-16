/**
 * ProfileAxisRadar — single dynamic radar that pivots its axis set per
 * the user's pick (taste / aroma / season / cuisine / method). Replaces
 * the Recipe Lab's wedge-grid wheel per user feedback (2026-05-16,
 * "I want it more like the taste radar but the axis can switch").
 *
 * Inputs:
 *   ingredients   — recipe ingredient names (the "bowl")
 *   nodes         — graph nodes Map<name, node>
 *   axis          — 'taste' | 'aroma' | 'season' | 'cuisine' | 'method'
 *   focalName     — optional; when set, draws a second polygon for the
 *                   focal alone, layered under the recipe polygon so
 *                   the user reads "focal core + recipe halo"
 *   onAxisChange  — callback when the user picks a different axis
 *   width         — render size
 *   theme         — 'dark' | 'light'
 *
 * The signal for each axis category is normalized to [0, 1] across
 * the recipe so the polygon fills the radar. This is the "what is
 * this dish leaning toward" view — a single radar that answers
 * "more summery? more woody? more floral?" from the prompt.
 */

import { useMemo } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { bucketColor } from '../data/briscionePalette.js';
import { dominantMethodFor, COOKING_METHODS } from '../data/cookingMethods.js';

const AXIS_CONFIG = {
  taste: {
    label: 'Taste',
    keys: ['sweet', 'sour', 'salty', 'bitter', 'umami', 'spicy', 'pungent', 'astringent'],
    colorFor: (k) => TASTE_COLORS[k] || '#888',
  },
  aroma: {
    label: 'Aroma',
    keys: ['fruity', 'floral', 'green', 'woody', 'spicy', 'fatty'],
    colorFor: (k) => bucketColor('aroma', k) || '#888',
  },
  season: {
    label: 'Season',
    keys: ['spring', 'summer', 'fall', 'winter'],
    colorFor: (k) => bucketColor('season', k) || '#888',
  },
  method: {
    label: 'Method',
    keys: COOKING_METHODS,
    colorFor: (k) => bucketColor('method', k) || '#888',
  },
  // cuisine has a dynamic keyset — see deriveCuisineKeys below.
  cuisine: {
    label: 'Cuisine',
    keys: null,
    colorFor: (k) => bucketColor('cuisine', k) || '#888',
  },
};

const AXIS_ORDER = ['taste', 'aroma', 'season', 'cuisine', 'method'];

function tokenize(str) {
  if (!str || typeof str !== 'string') return [];
  return str.toLowerCase().trim().split(/[\s,/]+/).filter(Boolean);
}

function deriveCuisineKeys(ingredients, nodes) {
  if (!nodes) return [];
  const tally = new Map();
  for (const name of ingredients) {
    const node = nodes.get ? nodes.get(name) : nodes[name];
    const list = Array.isArray(node?.cuisines) ? node.cuisines : [];
    for (const c of list) {
      const k = String(c).toLowerCase().trim();
      if (!k) continue;
      tally.set(k, (tally.get(k) || 0) + 1);
    }
  }
  // Top-8 cuisines by count keep the radar legible.
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);
}

function signalForAxis(node, axis, keyList) {
  // Returns Map<key, value 0..1> for one ingredient on one axis.
  const out = new Map();
  if (!node) return out;
  if (axis === 'aroma') {
    const probs = node.gnnProbs || {};
    for (const k of keyList) {
      const p = probs[`odor_${k}`];
      if (typeof p === 'number') out.set(k, Math.max(0, Math.min(1, p)));
    }
    return out;
  }
  if (axis === 'taste') {
    for (const k of tokenize(node.taste)) {
      if (keyList.includes(k)) out.set(k, 1);
    }
    return out;
  }
  if (axis === 'season') {
    for (const k of tokenize(node.season)) {
      if (keyList.includes(k)) out.set(k, 1);
    }
    return out;
  }
  if (axis === 'cuisine') {
    const list = Array.isArray(node.cuisines) ? node.cuisines : [];
    for (const c of list) {
      const k = String(c).toLowerCase().trim();
      if (keyList.includes(k)) out.set(k, 1);
    }
    return out;
  }
  if (axis === 'method') {
    const m = dominantMethodFor(node.name || '', node);
    if (m && keyList.includes(m)) out.set(m, 1);
    return out;
  }
  return out;
}

function aggregate(ingredients, nodes, axis, keyList) {
  // Sum per-key signal across the recipe, then normalize so the
  // dominant axis hits 1.0. This is the "where is the dish leaning"
  // view, not a per-key probability.
  const acc = new Map();
  for (const k of keyList) acc.set(k, 0);
  for (const name of ingredients) {
    const node = nodes?.get ? nodes.get(name) : nodes?.[name];
    const sig = signalForAxis(node, axis, keyList);
    for (const [k, v] of sig) acc.set(k, (acc.get(k) || 0) + v);
  }
  // Normalize: divide by max so the largest axis lands at 1. If
  // everything is zero, leave as zeros (empty radar).
  let max = 0;
  for (const v of acc.values()) if (v > max) max = v;
  if (max > 0) {
    for (const k of acc.keys()) acc.set(k, (acc.get(k) || 0) / max);
  }
  return acc;
}

export default function ProfileAxisRadar({
  ingredients = [],
  nodes,
  axis = 'taste',
  focalName = null,
  onAxisChange = null,
  width = 320,
  theme = 'light',
}) {
  const isDark = theme === 'dark';

  // Derive keyset (cuisine is dynamic; rest are static).
  const keyList = useMemo(() => {
    if (axis === 'cuisine') return deriveCuisineKeys(ingredients, nodes);
    return AXIS_CONFIG[axis]?.keys || [];
  }, [axis, ingredients, nodes]);

  const recipeSignal = useMemo(
    () => aggregate(ingredients, nodes, axis, keyList),
    [ingredients, nodes, axis, keyList],
  );
  const focalSignal = useMemo(() => {
    if (!focalName) return null;
    return aggregate([focalName], nodes, axis, keyList);
  }, [focalName, nodes, axis, keyList]);

  const cx = width / 2;
  const cy = width / 2;
  const radius = width * 0.34;
  const labelOffset = 18;

  const config = AXIS_CONFIG[axis] || AXIS_CONFIG.taste;
  const colorFor = config.colorFor;

  // Theme palette
  const gridColor = isDark ? 'rgba(120,120,150,0.25)' : 'rgba(120,90,40,0.25)';
  const axisColor = isDark ? 'rgba(160,160,180,0.30)' : 'rgba(120,90,40,0.30)';
  const labelColor = isDark ? '#d1d5db' : '#3f3520';
  const dimText = isDark ? '#9ca3af' : '#7a6a4a';
  const recipeStroke = isDark ? '#22d3ee' : '#b45309';
  const recipeFill = isDark ? 'rgba(34,211,238,0.22)' : 'rgba(180,83,9,0.22)';
  const focalStroke = isDark ? '#fbbf24' : '#7c3a0a';
  const focalFill = isDark ? 'rgba(251,191,36,0.18)' : 'rgba(124,58,10,0.18)';

  // Empty state when no axes are defined (cuisine with no recipe data).
  const empty = keyList.length === 0;

  // Compute polygon points for a given Map<key, 0..1>.
  const polygonPoints = (sigMap) => {
    if (!sigMap || keyList.length === 0) return '';
    return keyList
      .map((k, i) => {
        const angle = (Math.PI * 2 * i) / keyList.length - Math.PI / 2;
        const r = (sigMap.get(k) || 0) * radius;
        return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
      })
      .join(' ');
  };

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Read dominant key to surface a tiny natural-language hint below.
  const dominantKey = useMemo(() => {
    let best = null;
    let bestVal = 0;
    for (const [k, v] of recipeSignal) {
      if (v > bestVal) { bestVal = v; best = k; }
    }
    return bestVal > 0 ? best : null;
  }, [recipeSignal]);

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width }}>
      {/* Axis switcher chips */}
      <div className="flex items-center gap-1 flex-wrap justify-center" role="toolbar" aria-label="Axis filter">
        {AXIS_ORDER.map((key) => {
          const active = key === axis;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onAxisChange?.(key)}
              className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider transition-colors ${
                active
                  ? (isDark ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/60' : 'bg-amber-100 text-amber-900 border border-amber-500')
                  : (isDark ? 'bg-white/[0.06] text-gray-300 border border-white/15 hover:bg-white/[0.10]' : 'bg-white/60 text-stone-700 border border-stone-300 hover:bg-white/80')
              }`}
              aria-pressed={active}
            >
              {AXIS_CONFIG[key].label}
            </button>
          );
        })}
      </div>

      <svg
        width={width}
        height={width}
        viewBox={`0 0 ${width} ${width}`}
        className="select-none"
        role="img"
        aria-label={`${config.label} radar for ${ingredients.length || 0} ingredient${ingredients.length === 1 ? '' : 's'}`}
      >
        {/* Grid polygons (concentric levels) */}
        {!empty && gridLevels.map((level) => {
          const dummy = new Map(keyList.map((k) => [k, level]));
          return (
            <polygon
              key={level}
              points={polygonPoints(dummy)}
              fill="none"
              stroke={gridColor}
              strokeWidth={level === 1.0 ? 1.2 : 0.6}
            />
          );
        })}

        {/* Axis spokes + labels */}
        {!empty && keyList.map((k, i) => {
          const angle = (Math.PI * 2 * i) / keyList.length - Math.PI / 2;
          const endX = cx + radius * Math.cos(angle);
          const endY = cy + radius * Math.sin(angle);
          const labelX = cx + (radius + labelOffset) * Math.cos(angle);
          const labelY = cy + (radius + labelOffset) * Math.sin(angle);
          let anchor = 'middle';
          if (labelX < cx - 5) anchor = 'end';
          else if (labelX > cx + 5) anchor = 'start';
          let baseline = 'middle';
          if (labelY < cy - radius * 0.5) baseline = 'hanging';
          else if (labelY > cy + radius * 0.5) baseline = 'auto';
          return (
            <g key={k}>
              <line x1={cx} y1={cy} x2={endX} y2={endY} stroke={axisColor} strokeWidth={0.5} />
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                dominantBaseline={baseline}
                fill={colorFor(k) || labelColor}
                fontSize={Math.max(9, width * 0.034)}
                fontWeight="600"
                style={{ textTransform: 'capitalize', letterSpacing: '0.03em' }}
              >
                {k}
              </text>
            </g>
          );
        })}

        {/* Focal polygon (drawn first so the recipe halo layers over) */}
        {!empty && focalSignal && (
          <polygon
            points={polygonPoints(focalSignal)}
            fill={focalFill}
            stroke={focalStroke}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        )}

        {/* Recipe-aggregate polygon */}
        {!empty && (
          <polygon
            points={polygonPoints(recipeSignal)}
            fill={recipeFill}
            stroke={recipeStroke}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        )}

        {/* Per-axis data dots colored by bucket */}
        {!empty && keyList.map((k, i) => {
          const v = recipeSignal.get(k) || 0;
          if (v <= 0) return null;
          const angle = (Math.PI * 2 * i) / keyList.length - Math.PI / 2;
          const r = v * radius;
          return (
            <circle
              key={`pt-${k}`}
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r={3}
              fill={colorFor(k)}
              stroke={isDark ? '#111' : '#fefae0'}
              strokeWidth={1}
            />
          );
        })}

        {empty && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={dimText}
            fontSize={12}
            fontStyle="italic"
          >
            No {config.label.toLowerCase()} data
          </text>
        )}
      </svg>

      {/* Natural-language hint */}
      {dominantKey && (
        <div
          className="text-[10px] text-center"
          style={{ color: colorFor(dominantKey) || dimText, fontStyle: 'italic' }}
        >
          Leaning <span style={{ fontWeight: 600 }}>{dominantKey}</span>
        </div>
      )}
    </div>
  );
}
