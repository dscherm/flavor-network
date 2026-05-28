/**
 * WedgeGridFlavorWheel — Briscione-pure wedge-grid pie chart.
 *
 * 6 vertical aroma sectors × 4 (desktop) / 3 (mobile) concentric filter
 * rings = up to 24 cells. Accent ingredients land in (sector, ring) cells
 * with lines radiating from the focal hub. Sectors are shaded only when
 * the focal's GNN aroma probability passes the per-axis calibrated
 * threshold.
 *
 * Two modes via the `compact` prop:
 *   - full   (compact=false): 6×4 grid for the IngredientPanel mount
 *   - compact (compact=true):  6 sectors only, ≤3 cells per sector, no
 *                              concentric rings; for the 3D-overlay use.
 *
 * Filter integration: if `onFilterBucket` is provided, Alt/Meta-click on
 * a cell calls `onFilterBucket(cell.ring, cell.distinctiveBucketKey)`.
 * Plain click pivots to the cell's ingredient via `onSelectIngredient`.
 *
 * Pure-SVG render. Per-bucket colors via `briscionePalette.js`. Algorithm
 * lives in `accentPlacement.js`.
 */
import React, { useMemo, useState } from 'react';
import { computeAccentPlacement } from '../data/accentPlacement.js';
import { bucketColor } from '../data/briscionePalette.js';
import useIsMobile from '../hooks/useIsMobile.js';

const TAU = Math.PI * 2;
const AROMA_AXES = ['fruity', 'floral', 'green', 'woody', 'spicy', 'creamy'];
const RING_AXES_FULL = ['taste', 'season', 'cuisine', 'method'];
const RING_AXES_MOBILE = ['taste', 'season', 'cuisine'];
// Phase 6 — tab traversal: sectors clockwise from 12 (AROMA_AXES order),
// then rings innermost-first inside each sector. Ranks are precomputed
// once and consulted by cellElements sort below.
const RING_RANK = { taste: 0, season: 1, cuisine: 2, method: 3, compact: 0 };

// Theme palettes — dark = 3D affinity overlay + IngredientPanel mount;
// light = Recipe Lab mount on cream/notebook background. Activated
// sector fills (BRISCIONE_AROMA at 0.55) stay constant across themes;
// only the chrome (text, borders, hub, halos) flips.
const THEMES = {
  dark: {
    stroke: 'rgba(10,10,18,0.55)',
    cellText: '#e5e7eb',
    hubFill: 'rgba(10,10,18,0.85)',
    hubStroke: 'rgba(255,255,255,0.3)',
    hubText: '#e5e7eb',
    labelInactive: 'rgba(255,255,255,0.45)',
    ringAxisLabel: 'rgba(255,255,255,0.45)',
    faintSector: 'rgba(255,255,255,0.04)',
    haloFill: 'rgba(10,10,18,0.55)',
    haloStroke: 'rgba(255,255,255,0.8)',
    chipFill: 'rgba(10,10,18,0.7)',
    chipStroke: 'rgba(255,255,255,0.18)',
    chipText: 'rgba(255,255,255,0.75)',
  },
  light: {
    stroke: 'rgba(10,10,18,0.45)',
    cellText: '#1f2937',
    hubFill: 'rgba(255,255,255,0.92)',
    hubStroke: 'rgba(10,10,18,0.45)',
    hubText: '#1f2937',
    labelInactive: 'rgba(10,10,18,0.55)',
    ringAxisLabel: 'rgba(10,10,18,0.55)',
    faintSector: 'rgba(10,10,18,0.04)',
    haloFill: 'rgba(255,255,255,0.85)',
    haloStroke: 'rgba(10,10,18,0.55)',
    chipFill: 'rgba(255,255,255,0.85)',
    chipStroke: 'rgba(10,10,18,0.25)',
    chipText: 'rgba(10,10,18,0.7)',
  },
};

function polar(cx, cy, r, theta) {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

function arcPath(cx, cy, rInner, rOuter, thetaStart, thetaEnd) {
  const a0 = thetaStart - Math.PI / 2;
  const a1 = thetaEnd - Math.PI / 2;
  const largeArc = thetaEnd - thetaStart > Math.PI ? 1 : 0;
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  return [
    `M ${p0o.x.toFixed(2)} ${p0o.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1o.x.toFixed(2)} ${p1o.y.toFixed(2)}`,
    `L ${p1i.x.toFixed(2)} ${p1i.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p0i.x.toFixed(2)} ${p0i.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export default function WedgeGridFlavorWheel({
  focalNode,
  neighbors = [],
  graphNodes,
  odorThresholds = null,
  size = 280,
  compact = false,
  onSelectIngredient = null,
  onFilterBucket = null,
  className = '',
  theme = 'dark',
  // P4 — primer state. 'pairings' (default) is the existing render path
  // and is locked byte-identical by snapshot (Principle #4). 'primer'
  // renders the focal's flavor-category context only: activated aroma
  // sectors + dominant taste-ring highlight, no cells / no accent lines.
  // Used by AffinityMode glue (P5) on initial engage, before the user
  // explicitly transitions to pairings.
  startingState = 'pairings',
}) {
  const isMobile = useIsMobile();
  const ringAxes = compact ? ['compact'] : (isMobile ? RING_AXES_MOBILE : RING_AXES_FULL);
  const T = THEMES[theme] || THEMES.dark;

  // Phase 5 — cell hover state. One cellKey at a time; null = no hover.
  const [hoveredCellKey, setHoveredCellKey] = useState(null);

  // Geometry per plan §Phase 2.
  const cx = size / 2;
  const cy = size / 2;
  const hubR = size * 0.13;
  const outerR = size * 0.46;
  const ringInsetPx = 6;

  const placement = useMemo(
    () => computeAccentPlacement(focalNode, neighbors, graphNodes, {
      odorThresholds,
      isMobile,
      compact,
    }),
    [focalNode, neighbors, graphNodes, odorThresholds, isMobile, compact],
  );

  // Ring radii: full = N equal slabs between (hubR+inset, outerR); compact = single band.
  const ringRadii = useMemo(() => {
    if (compact) {
      const rInner = hubR + ringInsetPx;
      const rOuter = outerR - 8;
      return { compact: { rInner, rOuter, rMid: (rInner + rOuter) / 2 } };
    }
    const map = {};
    const available = outerR - hubR - ringInsetPx;
    const slab = available / ringAxes.length;
    for (let i = 0; i < ringAxes.length; i++) {
      const rInner = hubR + ringInsetPx + i * slab;
      const rOuter = rInner + slab - 1; // 1px breathing room between rings
      map[ringAxes[i]] = { rInner, rOuter, rMid: (rInner + rOuter) / 2 };
    }
    return map;
  }, [compact, hubR, outerR, ringAxes]);

  const sliceAngle = TAU / AROMA_AXES.length;

  // Pre-compute the sector background arcs (whole donut from hubR+inset to outerR).
  const sectorBgArcs = AROMA_AXES.map((sector, i) => {
    const t0 = i * sliceAngle;
    const t1 = (i + 1) * sliceAngle;
    const activated = placement.activatedAromas.has(sector);
    return {
      key: sector,
      d: arcPath(cx, cy, hubR + ringInsetPx, outerR, t0, t1),
      fill: activated ? bucketColor('aroma', sector) : T.faintSector,
      opacity: activated ? 0.55 : 1,
    };
  });

  // Group cells by (sector, ring) so we can stack them within the slab.
  const cellsByGroup = useMemo(() => {
    const m = new Map();
    for (const c of placement.cells) {
      const key = `${c.sector}|${c.ring}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(c);
    }
    return m;
  }, [placement.cells]);

  // Convert (sector, ring, slotIdx) into screen coordinates for cell anchor.
  function cellCentroid(sector, ring, slotIdx, slotCount) {
    const sectorIdx = AROMA_AXES.indexOf(sector);
    const sliceMid = (sectorIdx + 0.5) * sliceAngle - Math.PI / 2;
    const r = ringRadii[ring]?.rMid ?? hubR + ringInsetPx;
    // Stack slots radially: when slotCount > 1, fan them out tangentially
    // within the slab. Tangential offset = slot index spread.
    const tangentialSpread = compact ? 0 : 12; // px between stacked names
    const offset = slotCount > 1
      ? (slotIdx - (slotCount - 1) / 2) * (tangentialSpread / r)  // angular spread in radians
      : 0;
    const a = sliceMid + offset;
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
      angle: a,
    };
  }

  // Cell text/line render data.
  // Phase 6 — sort by (sector clockwise from 12, ring innermost-first, slot)
  // so Tab traversal walks the wheel in a predictable order.
  const cellElements = [];
  for (const [groupKey, group] of cellsByGroup) {
    group.forEach((cell, idx) => {
      const centroid = cellCentroid(cell.sector, cell.ring, idx, group.length);
      cellElements.push({ cell, centroid, idx, groupSize: group.length, groupKey });
    });
  }
  cellElements.sort((a, b) => {
    const sa = AROMA_AXES.indexOf(a.cell.sector);
    const sb = AROMA_AXES.indexOf(b.cell.sector);
    if (sa !== sb) return sa - sb;
    const ra = RING_RANK[a.cell.ring] ?? 99;
    const rb = RING_RANK[b.cell.ring] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.idx - b.idx;
  });

  // Outer aroma labels.
  const labelR = outerR + 12;
  const aromaLabels = AROMA_AXES.map((sector, i) => {
    const mid = (i + 0.5) * sliceAngle - Math.PI / 2;
    return {
      key: sector,
      x: cx + labelR * Math.cos(mid),
      y: cy + labelR * Math.sin(mid),
      anchor: Math.cos(mid) > 0.3 ? 'start' : Math.cos(mid) < -0.3 ? 'end' : 'middle',
      color: placement.activatedAromas.has(sector) ? bucketColor('aroma', sector) : T.labelInactive,
    };
  });

  // Inner ring axis labels (TASTE/SEASON/CUISINE/METHOD) at 12 o'clock — only in full mode.
  const ringAxisLabels = compact ? [] : ringAxes.map((axis) => {
    const r = ringRadii[axis]?.rMid ?? hubR + ringInsetPx;
    return {
      key: axis,
      label: axis.toUpperCase(),
      // Position just inside the 12-o'clock sector divider for readability.
      x: cx + 4,
      y: cy - r - 2,
    };
  });

  function handleCellClick(cell, event) {
    if (onFilterBucket && (event.altKey || event.metaKey) && cell.ring && cell.distinctiveBucketKey) {
      event.preventDefault();
      onFilterBucket(cell.ring, cell.distinctiveBucketKey);
      return;
    }
    if (onSelectIngredient) onSelectIngredient(cell.ingredientName);
  }

  function handleCellKeyDown(cell, event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.altKey && onFilterBucket && cell.ring && cell.distinctiveBucketKey) {
        onFilterBucket(cell.ring, cell.distinctiveBucketKey);
      } else if (onSelectIngredient) {
        onSelectIngredient(cell.ingredientName);
      }
    }
  }

  // Aroma-swatch legend below the wheel.
  const legendChips = AROMA_AXES.map((sector) => ({
    key: sector,
    color: bucketColor('aroma', sector),
    active: placement.activatedAromas.has(sector),
  }));

  const cellFontSize = Math.max(8, size * (compact ? 0.038 : 0.028));
  const aromaLabelFontSize = Math.max(9, size * 0.038);

  // Phase 6 — aria-live announcement for activated aroma sectors when focal
  // changes. Screen readers hear "Apple's aromas: fruity, fatty" without
  // visual focus shifts. Empty when no aromas activated to keep the live
  // region quiet during sector-less focals.
  const activeAromasList = AROMA_AXES.filter((a) => placement.activatedAromas.has(a));
  const liveAnnouncement = activeAromasList.length
    ? `${focalNode?.name || 'Focal'} activated aromas: ${activeAromasList.join(', ')}`
    : '';

  // ===== P4 — primer-state derived data ==================================
  // Active when `startingState === 'primer'`. The pairings render path is
  // unchanged when primer is inactive — Principle #4 byte-identity lock is
  // asserted by `WedgeGridFlavorWheel.primerState.test.jsx`.
  const isPrimer = startingState === 'primer';
  // Pick the focal's first taste token as the dominant. `node.taste` is a
  // comma/semicolon-separated string of taste keys (the same tokenization
  // accentPlacement uses for filter-category signals).
  const focalDominantTaste = useMemo(() => {
    const t = focalNode?.taste;
    if (typeof t !== 'string' || !t.length) return null;
    const first = t.split(/[,;]/).map((s) => s.trim().toLowerCase()).find(Boolean);
    return first || null;
  }, [focalNode]);
  // Taste-ring arc geometry: shade the full taste-ring slab (a full donut
  // ring across all 6 aroma sectors) at low opacity. The ring axis is
  // always 'taste' in full mode; absent in compact mode (which has only
  // one band) and absent in mobile-3-rings layout (where 'taste' is still
  // present per RING_AXES_MOBILE — so this works there too).
  const primerTasteRingArc = useMemo(() => {
    if (!isPrimer) return null;
    if (compact) return null;
    if (!focalDominantTaste) return null;
    const tasteRing = ringRadii.taste;
    if (!tasteRing) return null;
    const tasteColor = bucketColor('taste', focalDominantTaste);
    if (!tasteColor) return null;
    // Full donut: theta 0 → TAU. arcPath handles wrap via largeArc flag.
    return {
      // Build as two half-arcs to avoid the full-circle degenerate case
      // (theta 0 → TAU collapses in SVG; split at PI is unambiguous).
      d1: arcPath(cx, cy, tasteRing.rInner, tasteRing.rOuter, 0,         Math.PI),
      d2: arcPath(cx, cy, tasteRing.rInner, tasteRing.rOuter, Math.PI,   TAU),
      fill: tasteColor,
    };
  }, [isPrimer, compact, focalDominantTaste, ringRadii, cx, cy]);

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Affinity wheel for ${focalNode?.name || 'focal'}${compact ? ' (compact)' : ''}`}
      >
        {/* Sector backgrounds (activated vs faint) */}
        {sectorBgArcs.map((s) => (
          <path key={`bg-${s.key}`} d={s.d} fill={s.fill} fillOpacity={s.opacity} />
        ))}

        {/* Ring borders (full mode only) */}
        {!compact && ringAxes.map((axis) => {
          const r = ringRadii[axis];
          if (!r) return null;
          return (
            <circle
              key={`ring-${axis}`}
              cx={cx}
              cy={cy}
              r={r.rOuter}
              fill="none"
              stroke={T.stroke}
              strokeWidth={0.6}
              aria-hidden="true"
            />
          );
        })}

        {/* Sector dividers (6 radial lines) */}
        {AROMA_AXES.map((_, i) => {
          const t = i * sliceAngle - Math.PI / 2;
          const x2 = cx + outerR * Math.cos(t);
          const y2 = cy + outerR * Math.sin(t);
          const x1 = cx + (hubR + ringInsetPx) * Math.cos(t);
          const y1 = cy + (hubR + ringInsetPx) * Math.sin(t);
          return (
            <line
              key={`div-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={T.stroke}
              strokeWidth={0.8}
              aria-hidden="true"
            />
          );
        })}

        {/* P4 — Primer taste-ring shading. Only renders when
            startingState='primer' AND focal has a dominant taste AND we're
            in a multi-ring layout. Drawn as two half-donut arcs to keep
            arcPath unambiguous across a full revolution. Sits above the
            sector backgrounds (so the BRISCIONE_TASTE color shows over the
            faint sector tint) and below cell text + lines (which don't
            render in primer anyway). */}
        {primerTasteRingArc && (
          <>
            <path d={primerTasteRingArc.d1} fill={primerTasteRingArc.fill} fillOpacity={0.32} aria-hidden="true" />
            <path d={primerTasteRingArc.d2} fill={primerTasteRingArc.fill} fillOpacity={0.32} aria-hidden="true" />
          </>
        )}

        {/* Accent lines from hub to cell centroid — suppressed in primer */}
        {!isPrimer && cellElements.map(({ cell, centroid, idx }) => {
          const color = bucketColor('aroma', cell.sector);
          return (
            <line
              key={`line-${cell.ingredientName}-${idx}`}
              x1={cx}
              y1={cy}
              x2={centroid.x}
              y2={centroid.y}
              stroke={color}
              strokeOpacity={0.7}
              strokeWidth={cell.thickness * 1.2}
              aria-hidden="true"
            />
          );
        })}

        {/* Cell text (clickable). Phase 5: hover + focus stroke ring, overflow chip.
            P4 — suppressed in primer (no cells / no overflow). */}
        {!isPrimer && cellElements.map(({ cell, centroid, idx }) => {
          const cellKey = `${cell.sector}|${cell.ring}|${cell.ingredientName}|${idx}`;
          const hovered = hoveredCellKey === cellKey;
          const title = !compact && onFilterBucket && cell.ring
            ? `Click to pivot; Alt-click to filter by ${cell.ring}`
            : '';
          const ariaLabel = `${cell.ingredientName} — ${cell.sector} aroma${!compact && cell.ring && cell.ring !== 'compact' ? `, ${cell.ring} accent` : ''}`;
          const displayName = cell.ingredientName.length > 14
            ? cell.ingredientName.slice(0, 13) + '…'
            : cell.ingredientName;
          // Approximate text bbox for hover/focus halo (no measureText in SVG).
          const halfW = (displayName.length * cellFontSize * 0.32) + 4;
          const halfH = cellFontSize * 0.75 + 2;
          return (
            <g
              key={`cell-${cellKey}`}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
              onClick={(e) => handleCellClick(cell, e)}
              onKeyDown={(e) => handleCellKeyDown(cell, e)}
              onMouseEnter={() => setHoveredCellKey(cellKey)}
              onMouseLeave={() => setHoveredCellKey((k) => (k === cellKey ? null : k))}
              onFocus={() => setHoveredCellKey(cellKey)}
              onBlur={() => setHoveredCellKey((k) => (k === cellKey ? null : k))}
              style={{
                cursor: onSelectIngredient || onFilterBucket ? 'pointer' : 'default',
                outline: 'none',
              }}
            >
              {title && <title>{title}</title>}
              {hovered && (
                <rect
                  x={centroid.x - halfW}
                  y={centroid.y - halfH}
                  width={halfW * 2}
                  height={halfH * 2}
                  rx={3}
                  fill={T.haloFill}
                  stroke={T.haloStroke}
                  strokeWidth={1.2}
                  aria-hidden="true"
                />
              )}
              <text
                x={centroid.x}
                y={centroid.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={T.cellText}
                fontSize={cellFontSize}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {displayName}
              </text>
              {cell.overflow > 0 && (() => {
                const chipText = `+${cell.overflow} more`;
                const chipHalfW = (chipText.length * cellFontSize * 0.28) + 3;
                const chipHalfH = cellFontSize * 0.5 + 1.5;
                const chipY = centroid.y + cellFontSize + chipHalfH;
                return (
                  <g aria-hidden="true">
                    <rect
                      x={centroid.x - chipHalfW}
                      y={chipY - chipHalfH}
                      width={chipHalfW * 2}
                      height={chipHalfH * 2}
                      rx={4}
                      fill={T.chipFill}
                      stroke={T.chipStroke}
                      strokeWidth={0.5}
                    />
                    <text
                      x={centroid.x}
                      y={chipY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={T.chipText}
                      fontSize={cellFontSize * 0.8}
                      style={{ pointerEvents: 'none' }}
                    >
                      {chipText}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Ring axis labels (full mode only) */}
        {ringAxisLabels.map((l) => (
          <text
            key={`axis-${l.key}`}
            x={l.x}
            y={l.y}
            fill={T.ringAxisLabel}
            fontSize={Math.max(7, size * 0.022)}
            fontFamily="Georgia, serif"
            style={{ pointerEvents: 'none', letterSpacing: '0.08em', userSelect: 'none' }}
          >
            {l.label}
          </text>
        ))}

        {/* Aroma sector labels (always shown) */}
        {aromaLabels.map((l) => (
          <text
            key={`aroma-${l.key}`}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            dominantBaseline="central"
            fill={l.color}
            fontSize={aromaLabelFontSize}
            fontFamily="Georgia, serif"
            fontWeight={500}
            style={{ pointerEvents: 'none', textTransform: 'capitalize', letterSpacing: '0.06em', userSelect: 'none' }}
          >
            {l.key}
          </text>
        ))}

        {/* Hub + focal name */}
        <circle cx={cx} cy={cy} r={hubR} fill={T.hubFill} stroke={T.hubStroke} strokeWidth={1} />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={T.hubText}
          fontSize={Math.max(9, size * 0.04)}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {focalNode?.name ? (focalNode.name.length > 12 ? focalNode.name.slice(0, 11) + '…' : focalNode.name) : ''}
        </text>
      </svg>

      {/* Phase 6 — visually-hidden aria-live region announces activated
          aromas on focal change. `sr-only` styling via inline CSS so
          we don't depend on Tailwind's sr-only utility being present. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {liveAnnouncement}
      </div>

      {/* Aroma-swatch legend — clickable when onFilterBucket is wired */}
      <div className="flex items-center gap-1 flex-wrap justify-center" role="toolbar" aria-label="Aroma filters">
        {legendChips.map((chip) => {
          const interactive = !!onFilterBucket;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFilterBucket && onFilterBucket('aroma', chip.key)}
              disabled={!interactive}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider transition-all ${
                interactive ? 'hover:bg-white/[0.08] cursor-pointer' : 'cursor-default'
              }`}
              style={{
                color: chip.active ? chip.color : 'rgba(255,255,255,0.55)',
                opacity: chip.active ? 1 : 0.65,
              }}
              aria-label={`Filter by ${chip.key} aroma`}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: chip.color,
                  opacity: chip.active ? 1 : 0.4,
                  display: 'inline-block',
                }}
              />
              {chip.key}
            </button>
          );
        })}
      </div>

      {/* Dropped-neighbor footnote — suppressed in primer (no cells rendered). */}
      {!isPrimer && placement.dropped > 0 && (
        <div className="text-[9px] text-gray-500 italic">
          {placement.dropped} neighbor{placement.dropped === 1 ? '' : 's'} not shown (no aroma data)
        </div>
      )}

      {/* P4 — Primer-only aria-live element. Conditionally MOUNTED (not
          always-rendered with conditional content) so screen readers
          announce the primer state ONLY when it's active. The pairings
          render path is byte-identical to before this prop existed
          (Principle #4 lock). */}
      {isPrimer && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Showing {focalNode?.name || 'focal'}'s flavor profile
        </div>
      )}
    </div>
  );
}
