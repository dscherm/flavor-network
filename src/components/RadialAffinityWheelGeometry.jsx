// PURE LAYOUT: This component computes wedge angles, ring radii, label positions,
// and bucket-color slot lookups. It has NO mode prop, NO business logic, NO imports
// from data/, hooks/, or IngredientPanel. Mode-specific concerns (story labels,
// citation chips, click semantics, surprising highlights) live in the consuming
// shells (CuratedWheel, FullWheel). DO NOT add `mode === 'curated' ? ... : ...`
// branches here — Executor Handoff Constraint #3.

import React from 'react';

const TAU = Math.PI * 2;
const FALLBACK_VIEWPORT_PX = 480;

/**
 * computeWheelLayout — pure layout function. No React, no IO. Given a
 * focal ingredient + a list of neighbors (each tagged with a
 * `bucketKey`) + the active axis's bucket palette, returns the wedges
 * (one per bucket), the per-neighbor dot positions, the per-bucket
 * labels, and a `fallback` flag set when the viewport is narrower than
 * the ListFallback breakpoint.
 *
 * Wedge geometry: outer radius `R = min(width, height) * 0.42`. N
 * wedges = N buckets. Wedge angle = `2π / N`. Label position = midpoint
 * at `R * 1.08`. Focal sits at the SVG origin (0, 0) in viewBox space.
 *
 * Deterministic dot placement (testable):
 *   inside wedge w (members M), neighbor at index i:
 *     baseAngle = w.midAngle - w.span / 2
 *     slot      = (i + 0.5) / M.length
 *     angle     = baseAngle + slot * w.span
 *     r         = (0.35 + 0.5 * neighbor.strength) * R
 *
 * Neighbors with no `bucketKey` (or whose bucketKey is unknown) are
 * dropped from the dot list — the consumer is expected to filter
 * upstream, but defensive filtering here keeps the layout total + the
 * dot total in agreement.
 *
 * @param {{
 *   focal: {name: string},
 *   neighbors: Array<{name: string, strength: number, bucketKey: string, ringIdx?: number}>,
 *   axis: string,
 *   viewport: {width: number, height: number},
 *   bucketColors?: Object<string, string>,
 *   bucketOrder?: string[],
 * }} args
 * @returns {{
 *   wedges: Array<{key: string, label: string, color: string, midAngle: number, span: number, members: any[]}>,
 *   dots: Array<{neighbor: any, x: number, y: number, ringIdx: number, bucketKey: string}>,
 *   labels: Array<{key: string, label: string, x: number, y: number, angle: number}>,
 *   radius: number,
 *   viewBox: string,
 *   fallback: boolean,
 * }}
 */
export function computeWheelLayout({
  focal,
  neighbors = [],
  axis = 'aroma',
  viewport = { width: 600, height: 600 },
  bucketColors = {},
  bucketOrder = null,
}) {
  const width = Number(viewport?.width) || 600;
  const height = Number(viewport?.height) || width;
  const fallback = width < FALLBACK_VIEWPORT_PX;
  const radius = Math.min(width, height) * 0.42;

  // Stable bucket discovery: respect explicit bucketOrder when given,
  // otherwise build it from the order each bucketKey first appears in
  // the neighbor list. This keeps tests deterministic.
  const bucketKeys = [];
  const bucketSeen = new Set();
  if (Array.isArray(bucketOrder) && bucketOrder.length > 0) {
    for (const k of bucketOrder) {
      if (!bucketSeen.has(k)) { bucketSeen.add(k); bucketKeys.push(k); }
    }
  }
  for (const n of neighbors) {
    const k = n?.bucketKey;
    if (!k || bucketSeen.has(k)) continue;
    bucketSeen.add(k);
    bucketKeys.push(k);
  }
  // No buckets at all → emit one anchor wedge so the SVG remains valid.
  const safeKeys = bucketKeys.length > 0 ? bucketKeys : ['_empty'];
  const span = TAU / safeKeys.length;

  const membersByKey = new Map();
  for (const k of safeKeys) membersByKey.set(k, []);
  for (const n of neighbors) {
    const k = n?.bucketKey;
    if (!k || !membersByKey.has(k)) continue;
    membersByKey.get(k).push(n);
  }

  const wedges = safeKeys.map((key, i) => {
    const midAngle = -Math.PI / 2 + (i + 0.5) * span;
    return {
      key,
      label: key === '_empty' ? '' : key,
      color: bucketColors?.[key] || '#475569',
      midAngle,
      span,
      members: membersByKey.get(key),
    };
  });

  const labels = wedges.map((w) => {
    const labelR = radius * 1.08;
    return {
      key: w.key,
      label: w.label,
      x: Math.cos(w.midAngle) * labelR,
      y: Math.sin(w.midAngle) * labelR,
      angle: w.midAngle,
    };
  });

  const dots = [];
  for (const w of wedges) {
    const M = w.members;
    const baseAngle = w.midAngle - w.span / 2;
    for (let i = 0; i < M.length; i++) {
      const neighbor = M[i];
      const slot = (i + 0.5) / M.length;
      const angle = baseAngle + slot * w.span;
      const strength = Math.max(0, Math.min(1, Number(neighbor?.strength) || 0));
      const r = (0.35 + 0.5 * strength) * radius;
      dots.push({
        neighbor,
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        ringIdx: typeof neighbor?.ringIdx === 'number' ? neighbor.ringIdx : 0,
        bucketKey: w.key,
      });
    }
  }

  // viewBox is centered on the focal so consumer renderProps can place
  // dots at the (x, y) values returned above without further offset.
  const pad = radius * 1.25;
  const viewBox = `${-pad} ${-pad} ${pad * 2} ${pad * 2}`;

  return { wedges, dots, labels, radius, viewBox, fallback, axis, focal };
}

function ListFallback({ layout }) {
  if (!layout) return null;
  return (
    <ul className="text-xs text-gray-200 space-y-1">
      {layout.wedges.map((w) => (
        <li key={w.key}>
          <div className="font-semibold" style={{ color: w.color }}>
            {w.label || '(none)'}
          </div>
          {w.members.length === 0 ? (
            <div className="text-gray-500 italic ml-2">no pairings</div>
          ) : (
            <ul className="ml-2 space-y-0.5">
              {w.members.map((m) => (
                <li key={m.name} className="text-gray-300">
                  {m.name}
                  <span className="text-gray-500 tabular-nums ml-1">
                    {Math.round((m.strength || 0) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function RadialAffinityWheelGeometry({
  focal,
  neighbors,
  axis = 'aroma',
  viewport = { width: 600, height: 600 },
  bucketColors,
  bucketOrder,
  renderWedge,
  renderDot,
  renderLabel,
  renderFocal,
  fallbackList,
  className,
}) {
  const layout = computeWheelLayout({ focal, neighbors, axis, viewport, bucketColors, bucketOrder });
  if (layout.fallback) {
    return fallbackList ? fallbackList(layout) : <ListFallback layout={layout} />;
  }
  return (
    <svg
      viewBox={layout.viewBox}
      className={className}
      role="img"
      aria-label={`Radial affinity wheel for ${focal?.name || 'focal'}`}
    >
      <g data-layer="wedges">
        {layout.wedges.map((w, i) => renderWedge?.(w, i))}
      </g>
      <g data-layer="labels">
        {layout.labels.map((l, i) => renderLabel?.(l, i))}
      </g>
      <g data-layer="dots">
        {layout.dots.map((d, i) => renderDot?.(d, i))}
      </g>
      <g data-layer="focal">
        {renderFocal?.(focal)}
      </g>
    </svg>
  );
}

export { ListFallback };
