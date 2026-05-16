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
// User iter (2026-05-16 'view tweeks'): hypotenuse line removed in
// favor of the shaded cone alone. Cone narrowed (less "angle
// intensity"), and same-bucket same-tier accents pick up a SLIGHT
// asymmetric base offset so they don't sit on the exact same plane
// in screen space — a subtle fan, not the prior aggressive one.
const BASE_HALF_WIDTH_FACTOR = 0.025; // narrower cones — halved from prior 0.05
const BASE_HALF_WIDTH_MIN = 3;
const BASE_HALF_WIDTH_MAX = 10;
// Per-slot perpendicular shift at the base, capped small so the
// effect is "easier to read" rather than disruptive.
const BASE_SLOT_SHIFT_FACTOR = 0.018; // base mid moves up to ~2% of len per slot
const BASE_SLOT_SHIFT_MAX = 14;       // hard pixel cap on the shift
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

  // Iter (2026-05-16 'view tweeks'): re-introduce a SUBTLE per-slot
  // shift so same-bucket same-tier accents don't sit on the exact
  // same screen plane. The 3D pyramid already separates tiers, so
  // this only addresses within-tier within-bucket stacking — keep
  // the magnitude small (BASE_SLOT_SHIFT_FACTOR ~2%).
  const bucketSlotByName = new Map();
  const bucketSignByName = new Map();
  const byBucket = new Map();
  for (const a of accents) {
    const k = a.bucketKey || '_unbucketed';
    if (!byBucket.has(k)) byBucket.set(k, []);
    byBucket.get(k).push(a);
  }
  for (const [, group] of byBucket) {
    group.sort((p, q) => (q.strength || 0) - (p.strength || 0));
    group.forEach((a, idx) => {
      bucketSlotByName.set(a.name, idx);
      bucketSignByName.set(a.name, idx % 2 === 0 ? 1 : -1);
    });
  }

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

      {/* Cones only — no hypotenuse line. Each cone is a slim
          isosceles triangle with apex at the accent and base
          perpendicular at (or near) the focal. Cone width inversely
          tied to strength (strong = narrow, weak = wider). Same-
          bucket same-tier accents pick up a subtle per-slot
          perpendicular shift at the base so they don't all sit on
          the exact same screen plane. */}
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
        const strengthClamp = Math.max(0, Math.min(1, Number.isFinite(a.strength) ? a.strength : 0.5));
        const inverse = 1 - 0.6 * strengthClamp; // strong 0.4 ··· weak 1.0
        const halfBase = Math.min(
          BASE_HALF_WIDTH_MAX,
          Math.max(BASE_HALF_WIDTH_MIN, len * BASE_HALF_WIDTH_FACTOR * inverse),
        );
        // Subtle base-mid perpendicular shift per slot within bucket.
        const slotIdx = bucketSlotByName.get(a.name) ?? 0;
        const slotSign = bucketSignByName.get(a.name) ?? 1;
        const slotMag = Math.min(
          BASE_SLOT_SHIFT_MAX,
          len * BASE_SLOT_SHIFT_FACTOR * Math.ceil(slotIdx / 2),
        ) * slotSign;
        const bMidX = fx + px * slotMag;
        const bMidY = fy + py * slotMag;
        const b1x = bMidX + px * halfBase;
        const b1y = bMidY + py * halfBase;
        const b2x = bMidX - px * halfBase;
        const b2y = bMidY - py * halfBase;
        const points = `${b1x.toFixed(1)},${b1y.toFixed(1)} ${a.x.toFixed(1)},${a.y.toFixed(1)} ${b2x.toFixed(1)},${b2y.toFixed(1)}`;
        const color = a.color || '#7dd3fc';
        const fade = Number.isFinite(a.opacity) ? a.opacity : 1;
        return (
          <polygon
            key={`cone-${a.name}`}
            points={points}
            fill={color}
            fillOpacity={TRIANGLE_OPACITY * fade}
            stroke="none"
          />
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
        const labelColor = a.color || '#f3f4f6';
        // Label sits at the accent (3D node) position with a small
        // perpendicular offset. The tier-stratified pyramid layout in
        // AffinityMode already gives same-bucket labels natural
        // screen-Y separation, so the previous Bezier-midpoint
        // placement is unnecessary.
        const anchor = a.x >= fx ? 'start' : 'end';
        const labelDx = a.x >= fx ? APEX_LABEL_DX : -APEX_LABEL_DX;
        return (
          <g key={`apex-${a.name}`} opacity={fade}>
            <text
              x={a.x + labelDx}
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
