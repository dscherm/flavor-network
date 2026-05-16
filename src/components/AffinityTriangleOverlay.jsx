/**
 * AffinityTriangleOverlay — viewport-fixed SVG overlay that draws a
 * right-triangle wedge from the focal ingredient to each of its
 * affinity (accent) ingredients. Replaces the corner wedge-grid wheel
 * per user feedback (2026-05-16, "revisedAff").
 *
 * For each accent:
 *   - Vertex A: focal screen position
 *   - Vertex B: (accent.x, focal.y) — horizontal leg from focal
 *   - Vertex C: accent screen position
 *   - Fill the triangle at 35% transparency using the accent's
 *     node color (cluster color by default, filter color when a
 *     filter pill is active — both supplied by LivingArchView).
 *   - Stroke the hypotenuse (A → C) at 70% opacity, same color.
 *
 * Snapshot shape (written per-frame to `projectionRef.current` by
 * LivingArchView while AffinityMode is engaged):
 *   {
 *     focal:   { name, x, y, color }
 *     accents: [{ name, x, y, color, strength }, ...]
 *     ts:      number
 *   }
 *
 * To avoid 60Hz App-level re-renders, the overlay polls the ref at
 * ~20Hz via its own RAF instead of receiving the snapshot through
 * React state. When the ref is null (no focal / off-screen), the
 * overlay renders nothing.
 *
 * aria-hidden — semantic content is announced via HUDAnnouncer +
 * the IngredientPanel's accent list.
 */

import { useEffect, useRef, useState } from 'react';

const TRIANGLE_OPACITY = 0.35;
const HYPOTENUSE_OPACITY = 0.7;
const HYPOTENUSE_WIDTH = 1.4;
const POLL_INTERVAL_MS = 50; // ~20Hz; smooth at camera-orbit speed, gentle on perf

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
      // Skip render when no fresh snapshot arrived since last tick OR
      // when both the previous and current snapshot are nullish.
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
      {accents.map((a) => {
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
        // Right-triangle vertices: focal, (accent.x, focal.y), accent.
        // This produces the downward-pointing wedge shape from the
        // user's revisedAff sketch — hypotenuse from focal to accent.
        const points = `${fx.toFixed(1)},${fy.toFixed(1)} ${a.x.toFixed(1)},${fy.toFixed(1)} ${a.x.toFixed(1)},${a.y.toFixed(1)}`;
        const color = a.color || '#7dd3fc';
        return (
          <g key={a.name}>
            <polygon
              points={points}
              fill={color}
              fillOpacity={TRIANGLE_OPACITY}
              stroke="none"
            />
            <line
              x1={fx}
              y1={fy}
              x2={a.x}
              y2={a.y}
              stroke={color}
              strokeOpacity={HYPOTENUSE_OPACITY}
              strokeWidth={HYPOTENUSE_WIDTH}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
