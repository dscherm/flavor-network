/**
 * FilterPullSlider — global pull-strength control for the R17 continuous
 * hybrid layout. Sits just below the FilterPillRow; only visible when at
 * least one filter is active.
 *
 * Math: `pos = (1 - pull) * cooccurrence + pull * bucketPole` per node.
 * Snap stops at 0 / 25 / 50 / 75 / 100 round on release, not during drag,
 * so the user gets continuous feedback while dragging but lands on a
 * predictable anchor when they let go.
 *
 * R19 Phase 1B — a plain-language label rides above the thumb mapping
 * the current % to one of 5 anchor strings, so the chef sees what the
 * pull means without having to internalize the cooccurrence × bucket
 * math.
 */

import { useCallback, useRef } from 'react';

const SNAP_STOPS = [0, 0.25, 0.5, 0.75, 1.0];

const PULL_ANCHOR_LABELS = [
  'Pairings only',
  'Pairings, gently grouped',
  'Balanced',
  'Buckets, gently bridged',
  'Buckets only',
];

function nearestAnchorIndex(value) {
  let bestIdx = 0;
  let bestDist = Math.abs(value - SNAP_STOPS[0]);
  for (let i = 1; i < SNAP_STOPS.length; i++) {
    const d = Math.abs(value - SNAP_STOPS[i]);
    if (d < bestDist) { bestIdx = i; bestDist = d; }
  }
  return bestIdx;
}

function snap(value) {
  return SNAP_STOPS[nearestAnchorIndex(value)];
}

/**
 * Map a raw pull strength (0..1) to its plain-language anchor label.
 * Exported for unit-testing each anchor in isolation.
 */
export function pullLabel(value) {
  const v = typeof value === 'number' ? value : 0;
  return PULL_ANCHOR_LABELS[nearestAnchorIndex(v)];
}

export default function FilterPullSlider({
  pullStrength = 0.7,
  onPullChange,
  disabled = false,
}) {
  const draggingRef = useRef(false);
  const percent = Math.round(pullStrength * 100);

  // Range inputs emit `input` (every pixel of drag) and `change` (release).
  // We pipe drag-time updates through directly for live feedback, and
  // snap on release.
  const handleInput = useCallback((e) => {
    draggingRef.current = true;
    const v = Number(e.target.value) / 100;
    onPullChange?.(v);
  }, [onPullChange]);

  const handleChange = useCallback((e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const raw = Number(e.target.value) / 100;
    const snapped = snap(raw);
    if (snapped !== raw) onPullChange?.(snapped);
  }, [onPullChange]);

  const handleKey = useCallback((e) => {
    if (disabled) return;
    let next = pullStrength;
    if (e.key === 'ArrowLeft')       next = pullStrength - (e.shiftKey ? 0.25 : 0.05);
    else if (e.key === 'ArrowRight') next = pullStrength + (e.shiftKey ? 0.25 : 0.05);
    else if (e.key === 'Home')       next = 0;
    else if (e.key === 'End')        next = 1;
    else return;
    e.preventDefault();
    next = Math.max(0, Math.min(1, next));
    onPullChange?.(next);
  }, [pullStrength, onPullChange, disabled]);

  const label = pullLabel(pullStrength);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 text-[11px] bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] rounded-full shadow-lg transition-opacity ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      aria-disabled={disabled}
    >
      <span className="text-gray-400 uppercase tracking-wider text-[9px] whitespace-nowrap">Pull</span>
      <div className="relative">
        {!disabled && (
          <span
            data-testid="pull-thumb-label"
            aria-hidden="true"
            className="absolute bottom-full mb-1 text-[9px] text-cyan-200/85 whitespace-nowrap pointer-events-none"
            style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}
          >
            {label}
          </span>
        )}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onInput={handleInput}
          onChange={handleChange}
          onKeyDown={handleKey}
          aria-label="Filter pull strength"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent} percent — ${label}`}
          disabled={disabled}
          className="w-32 h-1 accent-cyan-400 block"
        />
      </div>
      <span className="text-cyan-300 font-medium tabular-nums w-9 text-right">{percent}%</span>
    </div>
  );
}
