/**
 * FlavorPieWheel — Briscione-style concentric pie chart with
 * category-distinct colors per slice and per-ring opacity = activation.
 *
 * Used in TWO places:
 *   - Ingredient Affinities view: 2 rings (focal's own bucket weights
 *     inner, aggregated neighbor bucket weights outer); 3D ingredient
 *     icons orbit at the outer-ring radius on top.
 *   - Recipe Lab: 1..N rings, one per recipe ingredient (Balanced
 *     mode) OR 1 wide focal ring + thin accent arcs (Centered mode).
 *
 * The wheel is pure SVG so it composes cleanly with the 3D scene
 * (z-index layering) and the existing AromaHexWheel scribble style
 * (when showHex is true).
 *
 * Props:
 *   size:         outer diameter in px (default 280)
 *   axis:         'aroma' | 'taste' | 'season' | 'method'
 *                 selects bucket-order + color palette
 *   rings:        Array<{ values: {bucketKey: number}, label?: string }>
 *                 inner → outer. value in [0,1] = slice opacity.
 *   showHex:      when true, the OUTER ring is drawn as a hexagonal
 *                 frame instead of a circle (Recipe-Lab style)
 *   onSliceClick: (bucketKey) => void  — tap to filter to that bucket
 *   activeBucket: bucketKey | null     — highlight the active slice
 *   centerLabel:  string | null        — optional text in the hub
 *   ringInsetPx:  px gap between rings (default 4)
 *   className:    extra classes on the root <svg>
 */
import React, { useMemo } from 'react';
import { bucketColor, axisOrder } from '../data/briscionePalette.js';

const TAU = Math.PI * 2;

function polar(cx, cy, r, theta) {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

/**
 * SVG path string for a single annular sector (donut slice).
 * Angles in radians, measured from -π/2 (12 o'clock) clockwise.
 */
function arcPath(cx, cy, rInner, rOuter, thetaStart, thetaEnd) {
  const a0 = thetaStart - Math.PI / 2;
  const a1 = thetaEnd - Math.PI / 2;
  const largeArc = thetaEnd - thetaStart > Math.PI ? 1 : 0;
  const p0o = polar(cx, cy, rOuter, a0);
  const p1o = polar(cx, cy, rOuter, a1);
  const p1i = polar(cx, cy, rInner, a1);
  const p0i = polar(cx, cy, rInner, a0);
  // outer arc (sweep=1 clockwise), line to inner endpoint, inner arc back (sweep=0), close
  return [
    `M ${p0o.x.toFixed(2)} ${p0o.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1o.x.toFixed(2)} ${p1o.y.toFixed(2)}`,
    `L ${p1i.x.toFixed(2)} ${p1i.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p0i.x.toFixed(2)} ${p0i.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/**
 * Hexagonal outer frame — six points equally spaced on the outer
 * circle, used when showHex is true. Renders as an overlay above the
 * outermost ring so the wheel reads as Briscione + AromaHexWheel.
 */
function hexagonPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export default function FlavorPieWheel({
  size = 280,
  axis = 'aroma',
  rings = [],
  showHex = false,
  onSliceClick = null,
  activeBucket = null,
  centerLabel = null,
  ringInsetPx = 4,
  ringLabels = null,
  className = '',
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const hubR = size * 0.10;

  const buckets = useMemo(() => axisOrder(axis), [axis]);
  const sliceAngle = buckets.length > 0 ? TAU / buckets.length : 0;

  // Compute per-ring radii.
  const ringCount = Math.max(1, rings.length);
  const availableR = outerR - hubR - ringInsetPx * Math.max(0, ringCount - 1);
  const ringThickness = availableR / ringCount;

  const slices = [];
  rings.forEach((ring, ringIdx) => {
    const rInner = hubR + ringIdx * (ringThickness + ringInsetPx);
    const rOuter = rInner + ringThickness;
    buckets.forEach((bucketKey, b) => {
      const theta0 = b * sliceAngle;
      const theta1 = (b + 1) * sliceAngle;
      const v = Math.max(0, Math.min(1, Number(ring.values?.[bucketKey]) || 0));
      const color = bucketColor(axis, bucketKey);
      const isActive = activeBucket === bucketKey;
      slices.push({
        id: `${ringIdx}-${bucketKey}`,
        ringIdx,
        bucketKey,
        d: arcPath(cx, cy, rInner, rOuter, theta0, theta1),
        color,
        opacity: 0.18 + 0.82 * v, // floor so empty slices are still visible faintly
        isActive,
      });
    });
  });

  // Outer slice labels (Briscione's bucket labels around the wheel).
  const labelR = outerR + 12;
  const labels = buckets.map((bucketKey, b) => {
    const mid = (b + 0.5) * sliceAngle - Math.PI / 2;
    const x = cx + labelR * Math.cos(mid);
    const y = cy + labelR * Math.sin(mid);
    return {
      key: bucketKey,
      x, y,
      anchor: Math.cos(mid) > 0.3 ? 'start' : Math.cos(mid) < -0.3 ? 'end' : 'middle',
      color: bucketColor(axis, bucketKey),
    };
  });

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${axis} flavor wheel`}
    >
      {/* Slices, ring by ring */}
      {slices.map((s) => (
        <path
          key={s.id}
          d={s.d}
          fill={s.color}
          fillOpacity={s.opacity}
          stroke={s.isActive ? '#fff' : 'rgba(10,10,18,0.55)'}
          strokeWidth={s.isActive ? 1.6 : 0.6}
          style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
          onClick={onSliceClick ? () => onSliceClick(s.bucketKey) : undefined}
        >
          <title>{s.bucketKey}</title>
        </path>
      ))}

      {/* Optional hex frame around the outermost ring */}
      {showHex && (
        <polygon
          points={hexagonPoints(cx, cy, outerR + 2)}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      )}

      {/* Hub (focal anchor) */}
      <circle cx={cx} cy={cy} r={hubR} fill="rgba(10,10,18,0.85)" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      {centerLabel && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e5e7eb"
          fontSize={Math.max(9, size * 0.04)}
          style={{ pointerEvents: 'none' }}
        >
          {centerLabel}
        </text>
      )}

      {/* Bucket labels around the outer edge */}
      {labels.map((l) => (
        <text
          key={l.key}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline="central"
          fill={l.color}
          fontSize={Math.max(9, size * 0.038)}
          fontWeight={500}
          style={{ pointerEvents: 'none', textTransform: 'capitalize' }}
        >
          {l.key}
        </text>
      ))}

      {/* Optional concentric ring labels (e.g., "Pork Loin", "Recipe blend") */}
      {Array.isArray(ringLabels) && ringLabels.map((label, idx) => {
        if (!label) return null;
        const rInner = hubR + idx * (ringThickness + ringInsetPx);
        const rMid = rInner + ringThickness / 2;
        // Place at -90deg (top); rotate later if needed.
        const a = -Math.PI / 2 + 0.05;
        const x = cx + rMid * Math.cos(a);
        const y = cy + rMid * Math.sin(a);
        return (
          <text
            key={`ringlabel-${idx}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.65)"
            fontSize={Math.max(8, size * 0.03)}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
