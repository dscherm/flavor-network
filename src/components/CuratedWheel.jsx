/**
 * CuratedWheel — story-first composition of RadialAffinityWheelGeometry.
 *
 * Renders 5–10 hero pairings around a focal ingredient: surprising-tier
 * dots get a fuchsia stroke (matches AffinityPanel's surprising column
 * tone — `#d946ef`); top affinities + ground-truth-cited pairings round
 * out the set. Each hero dot tags a per-pairing story headline tangent
 * to its ring; hovering/tapping surfaces a citation chip when the
 * pair is in ground truth.
 *
 * This shell layer reads `surprisingAffinities()` + `topAffinities()`
 * from `data/affinityTiers.js` and the per-pair `whyThisWorks()`
 * stub. The geometry primitive (wedge/label/dot positions) lives
 * entirely in `RadialAffinityWheelGeometry.jsx`.
 */
import React from 'react';
import RadialAffinityWheelGeometry from './RadialAffinityWheelGeometry.jsx';
import {
  surprisingAffinities,
  topAffinities,
} from '../data/affinityTiers.js';
import { CATEGORICAL_AXES, bucketOf as resolveBucket } from '../data/categoricalAxes.js';
import { FILTER_TO_AXIS } from '../data/networkModes.js';
import { whyThisWorks, groundTruthHas } from '../data/whyThisWorks.js';
import { passesDietaryFilters } from '../data/dietaryFilters.js';

const SURPRISING_STROKE = '#d946ef';

function uniqueByName(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || !item.name || seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
}

function selectCuratedPairings({ focal, ctx, dietary = [] }) {
  if (!focal || !ctx) return [];
  // Over-pull when dietary restrictions are active so post-filter we
  // still land 5-10 heroes. Vegan / vegetarian can prune up to ~30%
  // of a meat-heavy wheel.
  const dietaryActive = Array.isArray(dietary) && dietary.length > 0;
  const mult = dietaryActive ? 2 : 1;
  const surprising = surprisingAffinities(focal.name || focal, ctx, { N: 3 * mult }) || [];
  const top = topAffinities(focal.name || focal, ctx, { N3: 4 * mult, N2: 0, N1: 0 }) || [];
  const cited = (topAffinities(focal.name || focal, ctx, { N3: 10 * mult, N2: 0, N1: 0 }) || [])
    .filter((n) => groundTruthHas(focal.name || focal, n.name))
    .slice(0, 3 * mult);
  // Tag origin so the renderer can swap stroke + chip per source.
  let tagged = [
    ...surprising.map((n) => ({ ...n, _source: 'surprising' })),
    ...top.map((n) => ({ ...n, _source: 'top' })),
    ...cited.map((n) => ({ ...n, _source: 'cited' })),
  ];
  // Dietary filter — applied before dedup + slice so a vegan filter
  // on a chicken focal pulls in 5+ plant-based heroes rather than 1.
  if (dietaryActive) {
    tagged = tagged.filter((n) => {
      const node = ctx?.graph?.nodes?.get?.(n.name) || { name: n.name };
      return passesDietaryFilters(n.name, node, dietary);
    });
  }
  return uniqueByName(tagged).slice(0, 10);
}

function bucketKeyFor(name, axisKey, ctx) {
  // Prefer the categoricalAxes resolver — handles the synthesized
  // compound-food profiles + the per-axis filter-key mapping. Falls
  // back to the raw bucketOf when the node lookup fails.
  const node = ctx?.graph?.nodes?.get?.(name) || { name };
  const filterKey = axisKey === 'aromas' ? 'aroma' : axisKey;
  return resolveBucket(filterKey, node, ctx) || null;
}

export default function CuratedWheel({
  focal,
  ctx,
  axis = 'aroma',
  viewport = { width: 600, height: 600 },
  onSelectPairing,
  className,
  dietary = [],
}) {
  if (!focal || !ctx) return null;

  const axisKey = FILTER_TO_AXIS[axis] || 'aromas';
  const palette = CATEGORICAL_AXES[axisKey];
  const bucketColors = palette
    ? Object.fromEntries(palette.labels.map((l, i) => [l, palette.colors[i]]))
    : {};

  const heroPairings = selectCuratedPairings({ focal, ctx, dietary });
  const neighbors = heroPairings
    .map((n) => ({
      ...n,
      bucketKey: bucketKeyFor(n.name, axisKey, ctx),
    }))
    .filter((n) => n.bucketKey);

  const renderWedge = (w, i) => {
    const sx = Math.cos(w.midAngle - w.span / 2) * 1; // unit-circle helpers
    const sy = Math.sin(w.midAngle - w.span / 2) * 1;
    const ex = Math.cos(w.midAngle + w.span / 2) * 1;
    const ey = Math.sin(w.midAngle + w.span / 2) * 1;
    const R = 100; // unit-radius wedge; geometry.viewBox already scales it
    // Build a pie slice path in the unit-circle then scale via the
    // outer geometry's viewBox. Simpler: emit at the actual radius
    // returned by computeWheelLayout via inline math.
    const r = 0; // unused; we re-derive from layout below
    // Use the actual radius from the wedge midAngle/span — we already
    // know layout.radius via the geometry but it's not handed to render
    // props (Constraint #3 keeps it pure). Approximate with
    // viewport-derived radius identical to computeWheelLayout's math.
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
        fillOpacity={0.12}
        stroke={w.color}
        strokeOpacity={0.4}
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
      fontSize={15}
      fontWeight={600}
      fill="#cbd5e1"
      data-bucket={l.key}
      style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
    >
      {l.label}
    </text>
  );

  // Iter 2026-05-16: nodes + labels enlarged so ingredient names read
  // at glance. The prior 32-char causalSentence slice was unreadable
  // ("Our pairing engine ranked th…") and added no signal beyond the
  // StoryPanel — show the ingredient name only.
  const renderDot = (d, i) => {
    const isSurprising = d.neighbor?._source === 'surprising';
    const r = isSurprising ? 11 : 7;
    const fill = isSurprising ? SURPRISING_STROKE : '#e2e8f0';
    const stroke = isSurprising ? SURPRISING_STROKE : 'none';
    const cited = groundTruthHas(focal?.name || focal, d.neighbor.name);
    return (
      <g
        key={`dot-${d.neighbor.name}-${i}`}
        transform={`translate(${d.x}, ${d.y})`}
        data-name={d.neighbor.name}
        data-source={d.neighbor._source}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectPairing?.(d.neighbor)}
      >
        <circle
          r={r}
          fill={fill}
          stroke={stroke}
          strokeWidth={isSurprising ? 2.5 : 0}
          fillOpacity={isSurprising ? 0.9 : 0.9}
        />
        <text
          x={r + 5}
          y={4}
          fontSize={13}
          fontWeight={500}
          fill="#e2e8f0"
          textAnchor="start"
          data-role="story-headline"
          style={{ paintOrder: 'stroke', stroke: '#0a1428', strokeWidth: 3, strokeLinejoin: 'round' }}
        >
          {d.neighbor.name}
        </text>
        {cited && (
          <foreignObject x={r + 5} y={r + 4} width={60} height={16}>
            <span className="citation-chip text-[10px] text-amber-300/80">cite</span>
          </foreignObject>
        )}
      </g>
    );
  };

  const renderFocal = (f) => (
    <g data-role="focal">
      <circle r={9} fill="#fbbf24" />
      <text
        x={0}
        y={-16}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="#fbbf24"
        style={{ paintOrder: 'stroke', stroke: '#0a1428', strokeWidth: 3, strokeLinejoin: 'round' }}
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

export { selectCuratedPairings, SURPRISING_STROKE };
