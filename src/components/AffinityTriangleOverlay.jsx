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

const TRIANGLE_OPACITY = 0.22;
const HYPOTENUSE_OPACITY = 0.6;
const HYPOTENUSE_WIDTH = 1.6;
const BASE_HALF_WIDTH_FACTOR = 0.05; // base width = length * factor
const BASE_HALF_WIDTH_MIN = 5;
const BASE_HALF_WIDTH_MAX = 16;
// Iter (2026-05-16 'tilt the line'): the hypotenuse from focal to
// apex is a quadratic Bezier whose control point sits perpendicular
// to the midpoint. Offset magnitude = sqrt(1 - strength) * length *
// this factor — strong affinities are nearly straight, weak ones
// bow visibly. Sqrt curve compresses the strong end so the visual
// difference between adjacent tiers reads at a glance (the raw
// strengths cluster in [0.5, 0.95], so linear `(1-strength)` gives
// only 2-9 px tilt on a typical line — too subtle to see).
const HYPOTENUSE_TILT_FACTOR = 0.42;
const HYPOTENUSE_TILT_FLOOR = 0.08; // strong affinities still get a tiny visible curve
const APEX_LABEL_DX = 18;
const APEX_LABEL_FONT_SIZE = 16;
const POLL_INTERVAL_MS = 50; // ~20Hz

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

      {/* Pass 1 — slim cones (filled) drawn weakest-first. Iter
          (2026-05-16 'audit'): cone base width is inversely tied to
          affinity strength, so the cone's spread angle encodes
          strength visually — strong affinity = narrow focused beam,
          weak affinity = wider, more diffuse spread. */}
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
        // Strength is in roughly [0, 1] from pairing scores; clamp to
        // [0, 1] then invert so strong → narrow. Multiply by the
        // length-derived base so cones still scale with distance.
        const strengthClamp = Math.max(0, Math.min(1, Number.isFinite(a.strength) ? a.strength : 0.5));
        const inverse = 1 - 0.6 * strengthClamp; // strong 0.4 ··· weak 1.0
        const halfBase = Math.min(
          BASE_HALF_WIDTH_MAX,
          Math.max(BASE_HALF_WIDTH_MIN, len * BASE_HALF_WIDTH_FACTOR * inverse),
        );
        const b1x = fx + px * halfBase;
        const b1y = fy + py * halfBase;
        const b2x = fx - px * halfBase;
        const b2y = fy - py * halfBase;
        const points = `${b1x.toFixed(1)},${b1y.toFixed(1)} ${a.x.toFixed(1)},${a.y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)}`;
        const color = a.color || '#7dd3fc';
        const fade = Number.isFinite(a.opacity) ? a.opacity : 1;
        // Hypotenuse tilt — Bezier control point sits perpendicular to
        // the midpoint. Sqrt curve over (1 - strength) so the visual
        // contrast between strong/weak is legible even when raw
        // strengths cluster near 1. FLOOR keeps the strongest cones
        // visibly curved so the rendering reads as "Bezier" rather
        // than "straight line" across the board.
        const inverseStrength = 1 - strengthClamp;
        const tiltScale = Math.max(HYPOTENUSE_TILT_FLOOR, Math.sqrt(inverseStrength));
        const tiltMag = tiltScale * HYPOTENUSE_TILT_FACTOR * len;
        const midX = (fx + a.x) / 2;
        const midY = (fy + a.y) / 2;
        const ctrlX = midX + px * tiltMag;
        const ctrlY = midY + py * tiltMag;
        const hypotenuseD = `M ${fx.toFixed(1)} ${fy.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
        return (
          <g key={`cone-${a.name}`}>
            <polygon
              points={points}
              fill={color}
              fillOpacity={TRIANGLE_OPACITY * fade}
              stroke="none"
            />
            <path
              d={hypotenuseD}
              fill="none"
              stroke={color}
              strokeOpacity={HYPOTENUSE_OPACITY * fade}
              strokeWidth={HYPOTENUSE_WIDTH}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* Pass 2 — ingredient label only. The 3D ring meshes (bipyramid /
          cylinder / sphere / star — same silhouettes as the affinity
          legend in the upper-left rail) already render at each apex
          position, so the SVG no longer paints a redundant icon over
          them. The label sits beside the apex with a slight offset so
          it doesn't overlap the 3D shape.
          Iter (2026-05-16 'audit'): label text picks up the bucket
          color so direction + cone + apex shape + label all share one
          palette — a floral-direction cone reads in floral colors top
          to bottom. */}
      {accents.map((a) => {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
        const fade = Number.isFinite(a.opacity) ? a.opacity : 1;
        const anchor = a.x >= fx ? 'start' : 'end';
        const dx = a.x >= fx ? APEX_LABEL_DX : -APEX_LABEL_DX;
        const labelColor = a.color || '#f3f4f6';
        return (
          <g key={`apex-${a.name}`} opacity={fade}>
            <text
              x={a.x + dx}
              y={a.y - 2}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill={labelColor}
              fontSize={APEX_LABEL_FONT_SIZE}
              fontWeight={600}
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
