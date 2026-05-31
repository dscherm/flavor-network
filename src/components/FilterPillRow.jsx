/**
 * FilterPillRow — segmented pill strip rendered above the Network
 * scene below the 2-mode (3D/2D) picker. Toggles the `filterStack`
 * in App.jsx, driving the morph axis + visibility predicate inside
 * LivingArchView.
 *
 * R16 Phase 1 deliverable. Presentational only — all state lives in
 * App.jsx; this component just renders and forwards user intents.
 */

import { FILTER_KEYS, FILTER_LABELS } from '../data/networkModes.js';

export default function FilterPillRow({
  filterStack = [],
  onToggle,
  onClear,
  // mode prop is accepted for future symmetry with 3D/2D-specific
  // pill behavior but is not consumed in Phase 1.
  // eslint-disable-next-line no-unused-vars
  mode,
}) {
  const isNoneActive = filterStack.length === 0;

  return (
    <div
      role="group"
      aria-label="Filter by"
      className="flex items-center gap-1 px-2 py-1 overflow-x-auto"
      style={{
        // Horizontal-scroll on narrow viewports (8 pills × ~88px ≈ 704px
        // would overflow iPhone SE's 320px). Hide the scrollbar to keep
        // the strip visually clean — users scroll-swipe or drag.
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        maxWidth: '100%',
      }}
    >
      {FILTER_KEYS.map((key) => {
        const active = filterStack.includes(key);
        return (
          <button
            key={key}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggle?.(key)}
            className={`flex-shrink-0 px-3 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
              active
                ? 'text-white bg-cyan-500 border border-cyan-400'
                : 'text-gray-400 bg-[#12121a] border border-[#2a2a3a] hover:bg-[#1a1a2a]'
            }`}
            style={{ minHeight: 44 }}
          >
            {FILTER_LABELS[key]}
          </button>
        );
      })}

      {/* "None" pill — clears the stack. Moved to the END per user
          feedback 2026-05-31 (was first). */}
      <button
        type="button"
        role="checkbox"
        aria-checked={isNoneActive}
        onClick={() => onClear?.()}
        className={`flex-shrink-0 px-3 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
          isNoneActive
            ? 'text-white bg-cyan-500 border border-cyan-400'
            : 'text-gray-400 bg-[#12121a] border border-[#2a2a3a] hover:bg-[#1a1a2a]'
        }`}
        style={{ minHeight: 44 }}
      >
        None
      </button>
    </div>
  );
}
