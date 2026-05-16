/**
 * AffinityTriangleOverlay — viewport-fixed SVG overlay that draws a
 * slim isosceles cone from the focal ingredient to each affinity
 * (accent) ingredient. The cone is aligned with the focal→accent
 * screen-ray so it stays visually coherent as the camera orbits
 * (the right-triangle iter was rotation-invariant in a bad way —
 * its legs always pointed at screen X/Y, which read as chaos when
 * the 3D scene below rotated).
 *
 * For each accent:
 *   - Apex  = accent screen position
 *   - Base  = perpendicular segment at the focal, half-width clamped
 *             to [4, 12] px (proportional to ray length)
 *   - Fill  = 22% transparency in the accent's network color (cluster
 *             color by default, filter-bucket color when a pill is
 *             active — same source as the 3D mesh).
 *   - Ray   = stroked hypotenuse from focal → accent at 60% opacity.
 *   - Apex marker = SVG render of the AFFINITY_SHAPE_LEGEND shape
 *             matching the accent's tier (★★★ bipyramid / ★★ cylinder
 *             / ★ sphere / Surprising star), so the user can read
 *             tier without leaving the wedge surface.
 *   - Label = ingredient name beside the apex.
 *
 * Snapshot shape (written per-frame to `projectionRef.current` by
 * LivingArchView while AffinityMode is engaged):
 *   {
 *     focal:   { name, x, y, color }
 *     accents: [{ name, x, y, color, strength, tier, opacity }]
 *     ts:      number
 *   }
 *
 * The overlay polls the ref at ~20Hz via its own RAF — keeps 60Hz
 * camera motion off the App-level re-render path.
 *
 * aria-hidden — semantic content is announced via HUDAnnouncer +
 * the IngredientPanel's accent list.
 */

import { useEffect, useRef, useState } from 'react';
import { affinityShape } from '../data/affinityShapes.js';

const TRIANGLE_OPACITY = 0.22;
const HYPOTENUSE_OPACITY = 0.6;
const HYPOTENUSE_WIDTH = 1.3;
const BASE_HALF_WIDTH_FACTOR = 0.04; // base width = length * factor
const BASE_HALF_WIDTH_MIN = 4;
const BASE_HALF_WIDTH_MAX = 12;
const APEX_ICON_SIZE = 14;
const APEX_LABEL_DX = 9;
const POLL_INTERVAL_MS = 50; // ~20Hz

// Mini SVG icon set mirroring ShapeLegend's silhouettes so the apex
// marker matches the in-scene affinity legend at-a-glance. Drawn
// inside a [-7, 7] box; caller translates to (apex.x, apex.y).
function ApexIcon({ shape, color, opacity = 1 }) {
  const s = APEX_ICON_SIZE;
  const c = s / 2;
  const r = s / 2 - 1;
  const stroke = color;
  const fill = color;
  const fillOpacity = 0.55 * opacity;
  const strokeOpacity = 0.95 * opacity;
  const common = { stroke, strokeOpacity, fill, fillOpacity, strokeWidth: 1.4 };
  switch (shape) {
    case 'bipyramid':
      return (
        <g aria-hidden="true">
          <polygon points={`${c},1 ${s - 2},${c} ${c},${s - 1} 2,${c}`} {...common} />
          <line x1={2} y1={c} x2={s - 2} y2={c} stroke={stroke} strokeOpacity={strokeOpacity * 0.7} strokeWidth={0.7} strokeDasharray="2 2" />
        </g>
      );
    case 'cylinder':
      return (
        <g aria-hidden="true">
          <rect x={s * 0.3} y={1.5} width={s * 0.4} height={s - 3} {...common} />
          <ellipse cx={c} cy={2.5} rx={s * 0.2} ry={1.2} stroke={stroke} strokeOpacity={strokeOpacity * 0.7} fill={fill} fillOpacity={fillOpacity} strokeWidth={1.2} />
          <ellipse cx={c} cy={s - 2.5} rx={s * 0.2} ry={1.2} stroke={stroke} strokeOpacity={strokeOpacity * 0.7} fill="none" strokeWidth={1.2} />
        </g>
      );
    case 'sphere':
      return <circle cx={c} cy={c} r={r} {...common} />;
    case 'star': {
      const outer = r;
      const inner = outer * 0.4;
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? outer : inner;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        pts.push(`${(c + Math.cos(a) * rr).toFixed(2)},${(c + Math.sin(a) * rr).toFixed(2)}`);
      }
      return <polygon points={pts.join(' ')} {...common} strokeLinejoin="round" />;
    }
    case 'dodecahedron':
      return <polygon points={`${c},1 ${s - 1},${s * 0.4} ${s - 2},${s - 1} 2,${s - 1} 1,${s * 0.4}`} {...common} />;
    default:
      return <circle cx={c} cy={c} r={r} {...common} />;
  }
}

function tierToShape(tier) {
  if (tier == null) return 'sphere';
  return affinityShape(tier);
}

export default function AffinityTriangleOverlay({ projectionRef = null }) {
  const [snapshot, setSnapshot] = useState(null);
  const lastTsRef = useRef(0);

  useEffect(() => {
    if (!projectionRef) return undefined;
    let raf = 0;
    let lastPoll = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - lastPoll < POLL_INTERVAL_MS) return;
      lastPoll = now;
      const next = projectionRef.current;
      const ts = next?.ts ?? 0;
      if (ts === lastTsRef.current) return;
      lastTsRef.current = ts;
      setSnapshot(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [projectionRef]);

  if (!snapshot || !snapshot.focal || !Array.isArray(snapshot.accents) || snapshot.accents.length === 0) {
    return null;
  }
  const { focal, accents } = snapshot;
  const fx = focal.x;
  const fy = focal.y;
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[25]"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <defs>
        <filter id="affinity-label-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Pass 1 — slim cones (filled) drawn weakest-first. */}
      {accents.map((a) => {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
        const dx = a.x - fx;
        const dy = a.y - fy;
        const len = Math.hypot(dx, dy);
        if (len < 1) return null;
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py = ux;
        const halfBase = Math.min(BASE_HALF_WIDTH_MAX, Math.max(BASE_HALF_WIDTH_MIN, len * BASE_HALF_WIDTH_FACTOR));
        const b1x = fx + px * halfBase;
        const b1y = fy + py * halfBase;
        const b2x = fx - px * halfBase;
        const b2y = fy - py * halfBase;
        const points = `${b1x.toFixed(1)},${b1y.toFixed(1)} ${a.x.toFixed(1)},${a.y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)}`;
        const color = a.color || '#7dd3fc';
        const fade = Number.isFinite(a.opacity) ? a.opacity : 1;
        return (
          <g key={`cone-${a.name}`}>
            <polygon
              points={points}
              fill={color}
              fillOpacity={TRIANGLE_OPACITY * fade}
              stroke="none"
            />
            <line
              x1={fx}
              y1={fy}
              x2={a.x}
              y2={a.y}
              stroke={color}
              strokeOpacity={HYPOTENUSE_OPACITY * fade}
              strokeWidth={HYPOTENUSE_WIDTH}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* Pass 2 — apex shape icon + ingredient label, drawn after fills
          so the chrome doesn't get washed out. Tier shape mirrors the
          AFFINITY_SHAPE_LEGEND silhouette in the desktop rail. */}
      {accents.map((a) => {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
        const color = a.color || '#7dd3fc';
        const fade = Number.isFinite(a.opacity) ? a.opacity : 1;
        const anchor = a.x >= fx ? 'start' : 'end';
        const dx = a.x >= fx ? APEX_LABEL_DX : -APEX_LABEL_DX;
        const shape = tierToShape(a.tier);
        return (
          <g key={`apex-${a.name}`} opacity={fade}>
            <g transform={`translate(${(a.x - APEX_ICON_SIZE / 2).toFixed(1)}, ${(a.y - APEX_ICON_SIZE / 2).toFixed(1)})`}>
              <ApexIcon shape={shape} color={color} opacity={fade} />
            </g>
            <text
              x={a.x + dx}
              y={a.y - 1}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill="#f3f4f6"
              fontSize={11}
              fontWeight={500}
              filter="url(#affinity-label-shadow)"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {a.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
