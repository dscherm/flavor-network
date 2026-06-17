// TRACK-4 REUSE: This radar's shape (filter-adaptive axes + axis-fill +
// per-pairing dots) is a candidate hero for Build's by-dimension surface.
// Do NOT add a 'theme' prop pre-emptively — refactor at Track 4 time if
// the surfaces actually converge. YAGNI confirmed in ralplan R2 OQ3.

/**
 * GuidedProfileRadar — Track 3 / P2 (Guided Overhaul).
 *
 * ADR-1 fork of `ProfileAxisRadar.jsx`: shares SVG math primitives but
 * answers a different question. ProfileAxisRadar asks "where does this
 * recipe LEAN across 5 axes (per-recipe polygon)". GuidedProfileRadar
 * asks "where does each PAIRING land on ONE chosen axis (per-pairing
 * dot)".
 *
 * Inputs:
 *   focal           — focal ingredient node (drawn as a hub dot at center)
 *   pairings[]      — array of pairing nodes to scatter on the radar
 *   filterType      — 'taste' | 'aroma' | 'season' | 'cuisine'
 *   chosenValue     — null = no axis selected (all pairings full opacity)
 *                     string = axis name (matching pairings 1.0, others 0.35)
 *   onAxisTap       — (axisKey) => void; fires when an axis label is tapped
 *   size            — render size in pixels (default 280)
 *   odorThresholds  — optional per-task threshold map for aroma matching
 *   onDropCount     — optional callback fired with the count of pairings
 *                     dropped due to missing data
 *
 * Visual contract (Briscione palette):
 *   - Filled wedge at chosenValue axis, fillOpacity 0.55 (G1 measurable)
 *   - Matching pairings: opacity 1.0, stroke 2.0, label visible
 *   - Non-matching pairings: opacity 0.35, no label
 *   - chosenValue === null: ALL pairings opacity 1.0 (G4 mode-transition)
 *   - Axis labels rendered as <button> with aria-label
 *   - aria-live="polite" announces selection on commit
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  getAxesFor,
  getColorMapFor,
  pairingMatchesAxis,
  coordsForPairing,
} from '../data/guidedRadarAxes.js';

const STROKE_FALLBACK = '#94a3b8';

function axisAngle(i, n) {
  return (Math.PI * 2 * i) / n - Math.PI / 2;
}

/**
 * Slice (wedge) path for a single axis sector. The wedge spans
 * ±half-step around the axis spoke at angle θ_i, from center to radius.
 */
function wedgePath(cx, cy, radius, n, i) {
  const half = Math.PI / n;
  const a = axisAngle(i, n);
  const a0 = a - half;
  const a1 = a + half;
  const x0 = cx + radius * Math.cos(a0);
  const y0 = cy + radius * Math.sin(a0);
  const x1 = cx + radius * Math.cos(a1);
  const y1 = cy + radius * Math.sin(a1);
  // Always small-arc (half-step is well under π for n >= 4).
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

export default function GuidedProfileRadar({
  focal = null,
  pairings = [],
  filterType = 'taste',
  chosenValue = null,
  onAxisTap = null,
  size = 280,
  odorThresholds = null,
  onDropCount = null,
}) {
  const axes = useMemo(() => getAxesFor(filterType), [filterType]);
  const colorMap = useMemo(() => getColorMapFor(filterType), [filterType]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const labelRadius = radius + 22;

  // Per-pairing rendered points: only those with at least one matching
  // axis (or, for aroma, with gnnProbs) get plotted. Everything else
  // is dropped via onDropCount.
  //
  // GD-RADAR-LABEL-DECOLLIDE (2026-05-30): pairings with identical
  // axis-match patterns get identical (x,y) from coordsForPairing,
  // stacking dots + labels into an unreadable pile. Post-process to
  // detect colliding canonical coords and spiral the N>1 members in a
  // small circle around the centroid (DECOLLIDE_RADIUS px) so each dot
  // keeps its own label visible. Strongest neighbor (highest .strength)
  // gets the top slot; others fan clockwise.
  const { plotted, droppedCount } = useMemo(() => {
    const raw = [];
    let dropped = 0;
    // User feedback 2026-05-31 (a): pull every affinity dot closer to
    // the focal node by scaling the raw radial position. 0.62 keeps
    // the dots visually inside the axis spokes (which sit at full
    // `radius`) but well within the wheel so the focal is still the
    // visual center of mass.
    const FOCAL_PULL = 0.62;
    for (const p of pairings) {
      const coords = coordsForPairing(p, filterType, axes, radius, odorThresholds);
      if (!coords) {
        dropped += 1;
        continue;
      }
      raw.push({
        pairing: p,
        coords: { x: coords.x * FOCAL_PULL, y: coords.y * FOCAL_PULL },
      });
    }
    // Bucket by canonical coord (0.5px granularity).
    const buckets = new Map();
    for (const item of raw) {
      const key = `${item.coords.x.toFixed(1)},${item.coords.y.toFixed(1)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(item);
      else buckets.set(key, [item]);
    }
    // User feedback 2026-05-31 (b): for multi-affinity buckets in the
    // same wedge cluster, push each dot OUTWARD along its radial line
    // (away from focal) instead of spiraling azimuthally — that way
    // overlapping dots fan along the spoke direction at increasing
    // distances from center, never re-overlapping with neighbors.
    const out = [];
    const RADIAL_STEP = 10; // px per stacked dot
    for (const bucket of buckets.values()) {
      if (bucket.length === 1) {
        out.push(bucket[0]);
        continue;
      }
      // Strongest first → keeps its inner slot; weaker ones move out.
      const sorted = [...bucket].sort(
        (a, b) => (b.pairing?.strength ?? 0) - (a.pairing?.strength ?? 0),
      );
      const cx0 = sorted[0].coords.x;
      const cy0 = sorted[0].coords.y;
      const dist = Math.hypot(cx0, cy0) || 1;
      const ux = cx0 / dist;
      const uy = cy0 / dist;
      for (let i = 0; i < sorted.length; i += 1) {
        const r = dist + i * RADIAL_STEP;
        out.push({
          pairing: sorted[i].pairing,
          coords: { x: ux * r, y: uy * r },
        });
      }
    }
    return { plotted: out, droppedCount: dropped };
  }, [pairings, filterType, axes, radius, odorThresholds]);

  // Fire drop count when it changes.
  const lastDropRef = useRef(-1);
  useEffect(() => {
    if (typeof onDropCount === 'function' && lastDropRef.current !== droppedCount) {
      lastDropRef.current = droppedCount;
      onDropCount(droppedCount);
    }
  }, [droppedCount, onDropCount]);

  const empty = axes.length === 0;
  const n = axes.length;

  const wedgeColor = chosenValue && colorMap[chosenValue]
    ? colorMap[chosenValue]
    : STROKE_FALLBACK;

  const announce = chosenValue
    ? `Highlighting pairings tagged ${chosenValue}`
    : `Showing all pairings on ${filterType} axes`;

  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ width: size }}
      data-testid="guided-profile-radar"
      data-filter-type={filterType}
      data-chosen-value={chosenValue || ''}
    >
      {/* a11y live region — announces axis commit */}
      <div
        aria-live="polite"
        className="sr-only"
        data-testid="guided-radar-announce"
      >
        {announce}
      </div>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="select-none"
        role="img"
        aria-label={`Guided pairing radar — ${filterType}`}
      >
        {/* Grid concentric polygons */}
        {!empty && [0.25, 0.5, 0.75, 1.0].map((level) => {
          const pts = axes
            .map((_, i) => {
              const a = axisAngle(i, n);
              const r = level * radius;
              return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
            })
            .join(' ');
          return (
            <polygon
              key={`grid-${level}`}
              points={pts}
              fill="none"
              stroke="rgba(120,120,150,0.25)"
              strokeWidth={level === 1.0 ? 1.2 : 0.6}
            />
          );
        })}

        {/* Filled wedge for chosenValue axis */}
        {!empty && chosenValue && axes.includes(chosenValue) && (
          <path
            d={wedgePath(cx, cy, radius, n, axes.indexOf(chosenValue))}
            fill={wedgeColor}
            fillOpacity={0.55}
            stroke="none"
            data-testid="guided-radar-wedge-fill"
          />
        )}

        {/* Axis spokes */}
        {!empty && axes.map((k, i) => {
          const a = axisAngle(i, n);
          const ex = cx + radius * Math.cos(a);
          const ey = cy + radius * Math.sin(a);
          return (
            <line
              key={`spoke-${k}`}
              x1={cx}
              y1={cy}
              x2={ex}
              y2={ey}
              stroke="rgba(160,160,180,0.30)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Per-pairing dots */}
        {!empty && plotted.map(({ pairing, coords }, idx) => {
          const isMatch = chosenValue
            ? pairingMatchesAxis(pairing, filterType, chosenValue, odorThresholds)
            : true;
          const opacity = chosenValue == null ? 1.0 : (isMatch ? 1.0 : 0.35);
          const strokeWidth = isMatch ? 2.0 : 1.0;
          // Always label each pairing node with its ingredient name (shown
          // underneath the dot); when an axis is chosen, non-matching nodes
          // still dim via the parent <g opacity>.
          const showLabel = true;
          const px = cx + coords.x;
          const py = cy + coords.y;
          const name = pairing?.name || `pairing-${idx}`;
          return (
            <g
              key={`pair-${name}-${idx}`}
              data-testid="guided-radar-pairing"
              data-pairing-name={name}
              data-pairing-match={isMatch ? 'true' : 'false'}
              data-pairing-opacity={String(opacity)}
              opacity={opacity}
            >
              <circle
                cx={px}
                cy={py}
                r={4}
                fill="#0a1428"
                stroke="#22d3ee"
                strokeWidth={strokeWidth}
              />
              {showLabel && (
                <text
                  x={px}
                  y={py + 13}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontSize={10}
                  fill="#bfd5f0"
                  data-testid="guided-radar-pairing-label"
                >
                  {name}
                </text>
              )}
            </g>
          );
        })}

        {/* Focal hub at center */}
        {focal && (
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill="#fbbf24"
            stroke="#0a1428"
            strokeWidth={2}
            data-testid="guided-radar-focal-hub"
          />
        )}
      </svg>

      {/* Axis label buttons — outside the SVG so they participate in
          normal DOM accessibility / focus order. Positioned with CSS
          using polar coords on a transparent overlay. */}
      <div
        className="relative -mt-[12px]"
        style={{ width: size, height: size, marginTop: -size, pointerEvents: 'none' }}
        aria-label={`${filterType} axes`}
        role="group"
      >
        {!empty && axes.map((k, i) => {
          const a = axisAngle(i, n);
          const lx = cx + labelRadius * Math.cos(a);
          const ly = cy + labelRadius * Math.sin(a);
          const isChosen = chosenValue === k;
          const color = colorMap[k] || STROKE_FALLBACK;
          return (
            <button
              key={`axis-btn-${k}`}
              type="button"
              onClick={() => onAxisTap?.(k)}
              aria-label={`Highlight pairings tagged ${k}`}
              aria-pressed={isChosen}
              data-testid={`guided-radar-axis-${k}`}
              className="absolute text-[10px] font-semibold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 rounded"
              style={{
                left: `${lx}px`,
                top: `${ly}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
                color,
                background: isChosen ? 'rgba(255,255,255,0.10)' : 'transparent',
                padding: '2px 6px',
              }}
            >
              {k}
            </button>
          );
        })}
      </div>

      {empty && (
        <div className="text-xs italic text-gray-400">
          No {filterType} axes
        </div>
      )}
    </div>
  );
}
