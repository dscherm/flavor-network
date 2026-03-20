import { useMemo } from 'react';
import { TASTE_COLORS } from '../utils/color.js';

const TASTES = ['sweet', 'sour', 'salty', 'bitter', 'umami', 'spicy', 'pungent', 'astringent'];

const OPPOSITES = {
  sweet: 'bitter',
  bitter: 'sweet',
  sour: 'umami',
  umami: 'sour',
  salty: 'sweet',
  spicy: 'astringent',
  pungent: 'sour',
  astringent: 'spicy',
};

// Suggestion ingredients for each taste
const TASTE_SUGGESTIONS = {
  sweet: 'honey or maple syrup',
  sour: 'lemon or vinegar',
  salty: 'soy sauce or salt',
  bitter: 'dark chocolate or arugula',
  umami: 'parmesan or mushrooms',
  spicy: 'chili or black pepper',
  pungent: 'garlic or ginger',
  astringent: 'green tea or cranberry',
};

function computeTasteCounts(ingredients, nodes) {
  const counts = {};
  for (const t of TASTES) counts[t] = 0;

  if (!ingredients || !nodes) return counts;

  for (const name of ingredients) {
    const node = nodes.get ? nodes.get(name) : nodes[name];
    if (!node || !node.taste) continue;
    const taste = node.taste.toLowerCase().trim();
    if (counts[taste] !== undefined) {
      counts[taste]++;
    }
  }
  return counts;
}

function assessBalance(counts, total) {
  if (total === 0) return null;

  const normalized = {};
  for (const t of TASTES) normalized[t] = counts[t] / total;

  // Find dominant taste
  let maxTaste = TASTES[0];
  let maxVal = 0;
  let nonZeroCount = 0;
  for (const t of TASTES) {
    if (normalized[t] > maxVal) { maxVal = normalized[t]; maxTaste = t; }
    if (normalized[t] > 0) nonZeroCount++;
  }

  // Check if one taste dominates (>50%)
  if (maxVal > 0.5) {
    const opposite = OPPOSITES[maxTaste];
    return `Heavy on ${maxTaste} -- consider adding ${opposite}`;
  }

  // Check for missing key tastes (sweet, sour, salty, umami are "key")
  const keyTastes = ['sweet', 'sour', 'salty', 'umami'];
  for (const t of keyTastes) {
    if (counts[t] === 0 && total >= 3) {
      return `Missing ${t} -- try adding ${TASTE_SUGGESTIONS[t]}`;
    }
  }

  // Check balance: if at least 3 tastes present and max <= 50%
  if (nonZeroCount >= 3 && maxVal <= 0.5) {
    return 'Well balanced';
  }

  return null;
}

export default function TasteRadar({ ingredients = [], nodes, compact = false, theme = 'dark' }) {
  const svgSize = compact ? 160 : 260;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const radius = compact ? 50 : 90;
  const labelOffset = compact ? 14 : 28;

  const counts = useMemo(() => computeTasteCounts(ingredients, nodes), [ingredients, nodes]);
  const total = ingredients.length || 1;

  const normalized = useMemo(() => {
    const n = {};
    for (const t of TASTES) n[t] = counts[t] / total;
    return n;
  }, [counts, total]);

  const assessment = useMemo(() => assessBalance(counts, ingredients.length), [counts, ingredients.length]);

  // Compute polygon points for a given scale
  const getPolygonPoints = (values) => {
    return TASTES.map((taste, i) => {
      const angle = (Math.PI * 2 * i) / TASTES.length - Math.PI / 2;
      const r = values[taste] * radius;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
  };

  // Grid levels
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Theme colors
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(55,65,81,0.6)' : 'rgba(252,211,77,0.3)';
  const fillColor = isDark ? 'rgba(6,182,212,0.3)' : 'rgba(217,119,6,0.3)';
  const strokeColor = isDark ? '#22d3ee' : '#b45309';
  const textColor = isDark ? '#9ca3af' : '#7a6a4a';
  const bgColor = isDark ? 'rgba(17,17,27,0.6)' : 'rgba(254,250,224,0.6)';

  // Axis endpoint positions and label positions
  const axisData = TASTES.map((taste, i) => {
    const angle = (Math.PI * 2 * i) / TASTES.length - Math.PI / 2;
    return {
      taste,
      endX: cx + radius * Math.cos(angle),
      endY: cy + radius * Math.sin(angle),
      labelX: cx + (radius + labelOffset) * Math.cos(angle),
      labelY: cy + (radius + labelOffset) * Math.sin(angle),
      angle,
    };
  });

  const fontSize = compact ? 8 : 12;
  const assessmentFontSize = compact ? 9 : 13;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="select-none"
        role="img"
        aria-label="Taste radar chart"
      >
        {/* Background */}
        <rect x="0" y="0" width={svgSize} height={svgSize} rx="8" fill={bgColor} />

        {/* Grid polygons */}
        {gridLevels.map((level) => {
          const vals = {};
          for (const t of TASTES) vals[t] = level;
          return (
            <polygon
              key={level}
              points={getPolygonPoints(vals)}
              fill="none"
              stroke={gridColor}
              strokeWidth={level === 1.0 ? 1 : 0.5}
            />
          );
        })}

        {/* Axis lines */}
        {axisData.map(({ taste, endX, endY }) => (
          <line
            key={taste}
            x1={cx}
            y1={cy}
            x2={endX}
            y2={endY}
            stroke={gridColor}
            strokeWidth={0.5}
          />
        ))}

        {/* Data polygon */}
        {ingredients.length > 0 && (
          <polygon
            points={getPolygonPoints(normalized)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {ingredients.length > 0 && axisData.map(({ taste, angle }) => {
          const r = normalized[taste] * radius;
          if (r === 0) return null;
          return (
            <circle
              key={taste}
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r={compact ? 2 : 3}
              fill={TASTE_COLORS[taste] || '#888'}
              stroke={isDark ? '#111' : '#fefae0'}
              strokeWidth={1}
            />
          );
        })}

        {/* Labels */}
        {axisData.map(({ taste, labelX, labelY }) => {
          const color = TASTE_COLORS[taste] || textColor;
          // Text anchor based on horizontal position
          let anchor = 'middle';
          if (labelX < cx - 5) anchor = 'end';
          else if (labelX > cx + 5) anchor = 'start';
          // Dominant baseline based on vertical position
          let baseline = 'middle';
          if (labelY < cy - radius * 0.5) baseline = 'hanging';
          else if (labelY > cy + radius * 0.5) baseline = 'auto';

          return (
            <text
              key={taste}
              x={labelX}
              y={labelY}
              textAnchor={anchor}
              dominantBaseline={baseline}
              fill={color}
              fontSize={fontSize}
              fontWeight="600"
            >
              {taste}
            </text>
          );
        })}
      </svg>

      {/* Balance assessment */}
      {assessment && (
        <p
          className="text-center px-2 leading-tight"
          style={{
            fontSize: assessmentFontSize,
            color: assessment === 'Well balanced'
              ? (isDark ? '#4ade80' : '#4a8a4a')
              : (isDark ? '#fbbf24' : '#8a7a3a'),
            fontStyle: assessment === 'Well balanced' ? 'normal' : 'italic',
          }}
        >
          {assessment}
        </p>
      )}
    </div>
  );
}
