/**
 * AffinityFlavorWheel — Briscione two-ring pie chart for the
 * Ingredient Affinities view (Phase 2 of task 6).
 *
 * Two concentric rings + filter pills above:
 *   - INNER ring = focal ingredient's own bucket weights (GNN-driven
 *     for aroma; categorical lookup for cuisine/taste/season). This
 *     is the focal's identity slice.
 *   - OUTER ring = aggregated bucket weights from the focal's top
 *     pairings, weighted by pair strength. This is what the focal
 *     "pulls toward."
 *
 * Filter pills (Aroma / Cuisine / Taste / Season) re-axis the wheel.
 * Tap a slice → fire onFilterBucket(bucketKey) so the consumer can
 * surface neighbors filtered to that bucket.
 *
 * Drop-in for the IngredientPanel's Top Pairings section. The 3D
 * affinity icons (when α-mode is engaged) remain in the scene
 * behind — this is a 2D summary panel that lives alongside them.
 */
import React, { useMemo, useState } from 'react';
import FlavorPieWheel from './FlavorPieWheel.jsx';
import { axisOrder } from '../data/briscionePalette.js';
import { dominantMethodFor } from '../data/cookingMethods.js';

// 2026-05-27 (batch 6 chef-vocab): renamed 'fatty' → 'creamy'. Kept at
// 6 keys for visual surface parity (spicy wedge stays but its underlying
// odor_spicy is calibration-disabled, so the wedge reads empty).
const BRISCIONE_AROMA_KEYS = ['fruity', 'floral', 'green', 'woody', 'spicy', 'creamy'];
const FILTER_AXES = [
  { key: 'aroma',  label: 'Aroma' },
  { key: 'taste',  label: 'Taste' },
  { key: 'season', label: 'Season' },
  { key: 'method', label: 'Method' },
];

function focalAromaValues(node) {
  if (!node?.gnnProbs) return {};
  const out = {};
  let total = 0;
  for (const k of BRISCIONE_AROMA_KEYS) {
    out[k] = Math.max(0, Math.min(1, node.gnnProbs[`odor_${k}`] || 0));
    total += out[k];
  }
  // Normalize so the dominant axis hits ~1.0 — easier visual read.
  if (total > 0) {
    for (const k of BRISCIONE_AROMA_KEYS) out[k] = Math.min(1, out[k] / total * 3);
  }
  return out;
}

function focalTasteValues(node) {
  const out = {};
  if (!node?.taste || typeof node.taste !== 'string') return out;
  const tokens = node.taste.toLowerCase().split(/\s+/);
  for (const k of axisOrder('taste')) {
    out[k] = tokens.some((t) => t.includes(k)) ? 1 : 0;
  }
  return out;
}

function focalSeasonValues(node) {
  const out = {};
  if (!node?.season || typeof node.season !== 'string') return out;
  const s = node.season.toLowerCase();
  for (const k of axisOrder('season')) {
    out[k] = s.includes(k) ? 1 : 0;
  }
  return out;
}

function focalMethodValues(node) {
  const out = {};
  if (!node?.name) return out;
  const method = dominantMethodFor(node.name, node);
  for (const k of axisOrder('method')) out[k] = k === method ? 1 : 0;
  return out;
}

function focalValuesFor(axis, node) {
  switch (axis) {
    case 'aroma':  return focalAromaValues(node);
    case 'taste':  return focalTasteValues(node);
    case 'season': return focalSeasonValues(node);
    case 'method': return focalMethodValues(node);
    default:       return {};
  }
}

function neighborBucketKey(axis, neighborNode) {
  if (!neighborNode) return null;
  if (axis === 'aroma') {
    if (!neighborNode.gnnProbs) return null;
    let best = null;
    let bestV = 0;
    for (const k of BRISCIONE_AROMA_KEYS) {
      const v = neighborNode.gnnProbs[`odor_${k}`] || 0;
      if (v > bestV) { bestV = v; best = k; }
    }
    return best;
  }
  if (axis === 'taste') {
    const s = (neighborNode.taste || '').toLowerCase();
    for (const k of axisOrder('taste')) if (s.includes(k)) return k;
    return null;
  }
  if (axis === 'season') {
    const s = (neighborNode.season || '').toLowerCase();
    for (const k of axisOrder('season')) if (s.includes(k)) return k;
    return null;
  }
  if (axis === 'method') {
    return dominantMethodFor(neighborNode.name || '', neighborNode);
  }
  return null;
}

function aggregateNeighborValues(axis, neighbors, graphNodes) {
  const agg = {};
  for (const k of axisOrder(axis)) agg[k] = 0;
  if (!Array.isArray(neighbors)) return agg;
  let total = 0;
  for (const nb of neighbors) {
    const node = graphNodes?.get?.(nb.name);
    const bucket = neighborBucketKey(axis, node);
    if (!bucket) continue;
    const w = Math.max(0, Math.min(1, Number(nb.strength) || 0));
    agg[bucket] = (agg[bucket] || 0) + w;
    total += w;
  }
  if (total > 0) {
    for (const k of axisOrder(axis)) agg[k] = Math.min(1, (agg[k] || 0) / total * 3);
  }
  return agg;
}

export default function AffinityFlavorWheel({
  focalNode,
  neighbors,
  graphNodes,
  size = 280,
  onFilterBucket = null,
  defaultAxis = 'aroma',
  className = '',
}) {
  const [axis, setAxis] = useState(defaultAxis);
  const [activeBucket, setActiveBucket] = useState(null);

  const innerValues = useMemo(() => focalValuesFor(axis, focalNode), [axis, focalNode]);
  const outerValues = useMemo(
    () => aggregateNeighborValues(axis, neighbors, graphNodes),
    [axis, neighbors, graphNodes],
  );

  const rings = [
    { values: innerValues, label: 'self' },
    { values: outerValues, label: 'neighbors' },
  ];

  function handleSlice(bucketKey) {
    setActiveBucket((prev) => (prev === bucketKey ? null : bucketKey));
    if (onFilterBucket) onFilterBucket(axis, bucketKey);
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div role="tablist" aria-label="Wheel axis" className="flex items-center gap-1 flex-wrap justify-center">
        {FILTER_AXES.map((a) => (
          <button
            key={a.key}
            role="tab"
            aria-selected={axis === a.key}
            onClick={() => { setAxis(a.key); setActiveBucket(null); }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
              axis === a.key
                ? 'bg-white/15 border-white/50 text-white'
                : 'bg-white/[0.04] border-white/15 text-gray-300 hover:bg-white/[0.08]'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <FlavorPieWheel
        size={size}
        axis={axis}
        rings={rings}
        ringLabels={['self', 'neighbors']}
        onSliceClick={handleSlice}
        activeBucket={activeBucket}
        centerLabel={focalNode?.name || null}
      />
      {activeBucket && (
        <div className="text-[10px] text-gray-300 uppercase tracking-wider">
          Filtered: <span className="text-white">{activeBucket}</span>
          <button
            type="button"
            onClick={() => { setActiveBucket(null); if (onFilterBucket) onFilterBucket(axis, null); }}
            className="ml-2 text-cyan-300 hover:text-cyan-100 underline"
          >
            clear
          </button>
        </div>
      )}
    </div>
  );
}
