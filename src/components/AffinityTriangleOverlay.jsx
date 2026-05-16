/**
 * AffinityTriangleOverlay — viewport-fixed SVG overlay that draws a
 * right-triangle wedge from the focal ingredient to each of its
 * affinity (accent) ingredients. Replaces the corner wedge-grid wheel
 * per user feedback (2026-05-16, "revisedAff").
 *
 * For each accent:
 *   - Vertex A: focal screen position
 *   - Vertex B: (accent.x, focal.y) — horizontal leg from focal
 *   - Vertex C: accent screen position (the "apex")
 *   - Fill the triangle at 22% transparency using the accent's
 *     node color (cluster color by default, filter color when a
 *     filter pill is active).
 *   - Stroke the hypotenuse (A → C) at 60% opacity, same color.
 *   - Draw an apex marker: filled circle + ingredient name, so
 *     the user can identify which triangle is tracking which
 *     ingredient (user feedback iter 2026-05-16).
 *
 * Snapshot shape (written per-frame to `projectionRef.current` by
 * LivingArchView while AffinityMode is engaged):
 *   {
 *     focal:   { name, x, y, color }
 *     accents: [{ name, x, y, color, strength, opacity }, ...]
 *     ts:      number
 *   }
 *
 * `accents` is already top-K (capped + sorted weakest-first so the
 * strongest paint over). LivingArchView is responsible for the
 * limit and the soft NDC-edge fade (per-accent opacity).
 *
 * The overlay polls the ref at ~20Hz via its own RAF instead of
 * receiving the snapshot through React state — keeps 60Hz camera
 * motion off the App-level re-render path.
 *
 * aria-hidden — semantic content is announced via HUDAnnouncer +
 * the IngredientPanel's accent list.
 */

import { useEffect, useRef, useState } from 'react';

const TRIANGLE_OPACITY = 0.22;
const HYPOTENUSE_OPACITY = 0.6;
const HYPOTENUSE_WIDTH = 1.3;
const APEX_RADIUS = 5;
const APEX_LABEL_DX = 8;
const APEX_LABEL_DY = -2;
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
        {/* Drop-shadow filter for the apex label so it stays legible
            against bright triangle fills. */}
        <filter id="affinity-label-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Pass 1 — triangles (fill + hypotenuse) painted weakest-first
          so strong accents end up on top. */}
      {accents.map((a) => {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
        const points = `${fx.toFixed(1)},${fy.toFixed(1)} ${a.x.toFixed(1)},${fy.toFixed(1)} ${a.x.toFixed(1)},${a.y.toFixed(1)}`;
        const color = a.color || '#7dd3fc';
        const fade = Number.isFinite(a.opacity) ? a.opacity : 1;
        return (
          <g key={`tri-${a.name}`}>
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

      {/* Pass 2 — apex markers + labels on top so the ingredient at
          the hypotenuse peak is identifiable. Same iteration order;
          painted after fills so they don't get washed out. */}
      {accents.map((a) => {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
        const color = a.color || '#7dd3fc';
        const fade = Number.isFinite(a.opacity) ? a.opacity : 1;
        // Anchor the label on the side of the accent away from focal
        // so it doesn't overlap the hypotenuse.
        const anchor = a.x >= fx ? 'start' : 'end';
        const dx = a.x >= fx ? APEX_LABEL_DX : -APEX_LABEL_DX;
        return (
          <g key={`apex-${a.name}`} opacity={fade}>
            <circle
              cx={a.x}
              cy={a.y}
              r={APEX_RADIUS}
              fill={color}
              fillOpacity={0.85}
              stroke="#0a0a12"
              strokeWidth={1}
            />
            <text
              x={a.x + dx}
              y={a.y + APEX_LABEL_DY}
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
