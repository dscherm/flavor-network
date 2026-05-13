/**
 * ThoughtBubbleCard — disclosure wrapper used by GuidedDiscoveryStart.
 * Renders as a native <details>/<summary> so we get keyboard +
 * screen-reader behavior for free (Enter/Space toggles open state,
 * aria-expanded follows the open prop).
 *
 * The card is a thin shell — children (the actual primitive: SearchBar,
 * FilterPillRow, chip row, toggle) own selection state. Closed-state
 * shows the bubble's label; if `summaryChip` is provided the card
 * additionally surfaces a short summary of what's selected.
 *
 * Phase 3 (consensus plan v2). Pure presentation — does not import
 * from data/ or hooks/ so the disclosure can be reused in other lanes.
 */

import { useCallback, useRef } from 'react';

export default function ThoughtBubbleCard({
  bubbleKey,
  label,
  selected = false,
  summaryChip = null,
  expanded = false,
  onToggleExpand,
  children,
}) {
  // Synthesise a stable id so an external aria-controls reference
  // could target this disclosure if needed.
  const detailsRef = useRef(null);

  // Intercept the native onToggle so we keep `expanded` controlled
  // from the parent. <details> dispatches a `toggle` event on every
  // open-state change including programmatic ones — re-applying the
  // parent's intent here keeps the controlled model honest.
  const handleToggle = useCallback(
    (e) => {
      const isOpen = e.target.open;
      if (isOpen !== expanded) {
        onToggleExpand?.();
      }
    },
    [expanded, onToggleExpand],
  );

  // The summary's onClick fires before the native toggle — preventing
  // default lets us own the open/close transition via the parent's
  // expanded prop instead of letting the browser flip it under us.
  const handleSummaryClick = useCallback(
    (e) => {
      e.preventDefault();
      onToggleExpand?.();
    },
    [onToggleExpand],
  );

  return (
    <details
      ref={detailsRef}
      open={expanded}
      onToggle={handleToggle}
      data-bubble-key={bubbleKey}
      data-selected={selected ? 'true' : 'false'}
      className={`group rounded-xl border bg-[#12203b] transition-colors overflow-hidden ${
        selected
          ? 'border-emerald-400/70 shadow-[0_0_20px_rgba(52,211,153,0.18)]'
          : 'border-[#1d3158] hover:border-[#2c4470]'
      }`}
    >
      <summary
        onClick={handleSummaryClick}
        aria-expanded={expanded}
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 min-h-[44px]"
        // Hide the default disclosure triangle in WebKit/Blink while
        // keeping the disclosure semantic intact.
        style={{ listStyle: 'none' }}
      >
        <span
          aria-hidden="true"
          className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold leading-none transition-colors ${
            selected
              ? 'border-emerald-300 bg-emerald-400/20 text-emerald-200'
              : 'border-[#2c4470] text-gray-500'
          }`}
        >
          {selected ? '✓' : '+'}
        </span>
        <span className="flex-1 text-sm sm:text-base text-white text-left">
          {label}
        </span>
        {selected && summaryChip && !expanded && (
          <span
            className="hidden sm:inline-flex flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 max-w-[160px] truncate"
            title={summaryChip}
          >
            {summaryChip}
          </span>
        )}
        <svg
          aria-hidden="true"
          className={`flex-shrink-0 w-4 h-4 text-gray-400 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-[#1d3158]/60">
        {children}
      </div>
    </details>
  );
}
