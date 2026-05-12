/**
 * FilterPullSlider — global pull-strength control for the R17 continuous
 * hybrid layout. Sits just below the FilterPillRow; only visible when at
 * least one filter is active.
 *
 * Math: `pos = (1 - pull) * cooccurrence + pull * bucketPole` per node.
 * Snap stops at 0 / 25 / 50 / 75 / 100 round on release, not during drag,
 * so the user gets continuous feedback while dragging but lands on a
 * predictable anchor when they let go.
 */

import { useCallback, useRef } from 'react';

const SNAP_STOPS = [0, 0.25, 0.5, 0.75, 1.0];

function snap(value) {
  let best = SNAP_STOPS[0];
  let bestDist = Math.abs(value - best);
  for (let i = 1; i < SNAP_STOPS.length; i++) {
    const d = Math.abs(value - SNAP_STOPS[i]);
    if (d < bestDist) { best = SNAP_STOPS[i]; bestDist = d; }
  }
  return best;
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

  return (
    <div
      className={`flex items-center gap-3 px-3 py-1.5 text-[11px] bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] rounded-full shadow-lg transition-opacity ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      aria-disabled={disabled}
    >
      <span className="text-gray-400 uppercase tracking-wider text-[9px] whitespace-nowrap">Pull</span>
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
        aria-valuetext={`${percent} percent`}
        disabled={disabled}
        className="w-32 h-1 accent-cyan-400"
        style={{ accentColor: '#22d3ee' }}
      />
      <span className="text-cyan-300 font-medium tabular-nums w-9 text-right">{percent}%</span>
    </div>
  );
}
