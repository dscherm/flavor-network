/**
 * FullWheel — IngredientPanel pairings view rendered as a radial wheel.
 *
 * Composes RadialAffinityWheelGeometry with `topAffinities()` (no
 * surprising tier — that lives in CuratedWheel). Dots are tier-coloured:
 *   ★★★ (ringIdx=3)  → saturated bucket color
 *   ★★  (ringIdx=2)  → mid alpha
 *   ★   (ringIdx=1)  → low alpha
 * Click on a dot calls `onIngredientClick(neighborName)` so the
 * consumer (IngredientPanel) can pivot the panel to that ingredient.
 */
import React from 'react';
import RadialAffinityWheelGeometry from './RadialAffinityWheelGeometry.jsx';
import { topAffinities } from '../data/affinityTiers.js';
import { CATEGORICAL_AXES, bucketOf as resolveBucket } from '../data/categoricalAxes.js';
import { FILTER_TO_AXIS } from '../data/networkModes.js';

const TIER_ALPHA = { 3: 1, 2: 0.55, 1: 0.3 };

function bucketKeyFor(name, axisKey, ctx) {
  const node = ctx?.graph?.nodes?.get?.(name) || { name };
  const filterKey = axisKey === 'aromas' ? 'aroma' : axisKey;
  return resolveBucket(filterKey, node, ctx) || null;
}

export default function FullWheel({
  focal,
  ctx,
  axis = 'aroma',
  viewport = { width: 600, height: 600 },
  bucketColors: bucketColorsProp,
  onIngredientClick,
  className,
}) {
  if (!focal || !ctx) return null;

  const axisKey = FILTER_TO_AXIS[axis] || 'aromas';
  const palette = CATEGORICAL_AXES[axisKey];
  const bucketColors = bucketColorsProp || (palette
    ? Object.fromEntries(palette.labels.map((l, i) => [l, palette.colors[i]]))
    : {});

  const ranked = topAffinities(focal.name || focal, ctx, { N3: 5, N2: 10, N1: 15 }) || [];
  const neighbors = ranked
    .map((n) => ({
      ...n,
      bucketKey: bucketKeyFor(n.name, axisKey, ctx),
    }))
    .filter((n) => n.bucketKey);

  const renderWedge = (w, i) => {
    const radius = Math.min(viewport.width, viewport.height) * 0.42;
    const x1 = Math.cos(w.midAngle - w.span / 2) * radius;
    const y1 = Math.sin(w.midAngle - w.span / 2) * radius;
    const x2 = Math.cos(w.midAngle + w.span / 2) * radius;
    const y2 = Math.sin(w.midAngle + w.span / 2) * radius;
    const largeArc = w.span > Math.PI ? 1 : 0;
    const d = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return (
      <path
        key={`wedge-${w.key}-${i}`}
        d={d}
        fill={w.color}
        fillOpacity={0.10}
        stroke={w.color}
        strokeOpacity={0.35}
        strokeWidth={1}
        data-bucket={w.key}
      />
    );
  };

  const renderLabel = (l, i) => (
    <text
      key={`label-${l.key}-${i}`}
      x={l.x}
      y={l.y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fill="#cbd5e1"
      data-bucket={l.key}
    >
      {l.label}
    </text>
  );

  const renderDot = (d, i) => {
    const tier = d.ringIdx >= 1 && d.ringIdx <= 3 ? d.ringIdx : 1;
    const alpha = TIER_ALPHA[tier];
    const color = bucketColors?.[d.bucketKey] || '#cbd5e1';
    return (
      <g
        key={`dot-${d.neighbor.name}-${i}`}
        transform={`translate(${d.x}, ${d.y})`}
        data-name={d.neighbor.name}
        data-tier={tier}
        style={{ cursor: 'pointer' }}
        onClick={() => onIngredientClick?.(d.neighbor.name)}
      >
        <circle
          r={5}
          fill={color}
          fillOpacity={alpha}
          stroke={color}
          strokeOpacity={Math.min(1, alpha + 0.2)}
          strokeWidth={1}
        />
      </g>
    );
  };

  const renderFocal = (f) => (
    <g data-role="focal">
      <circle r={6} fill="#fbbf24" />
      <text
        x={0}
        y={-12}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#fbbf24"
      >
        {f?.name || ''}
      </text>
    </g>
  );

  return (
    <RadialAffinityWheelGeometry
      focal={focal}
      neighbors={neighbors}
      axis={axisKey}
      viewport={viewport}
      bucketColors={bucketColors}
      bucketOrder={palette?.labels}
      renderWedge={renderWedge}
      renderLabel={renderLabel}
      renderDot={renderDot}
      renderFocal={renderFocal}
      className={className}
    />
  );
}

export { TIER_ALPHA };
