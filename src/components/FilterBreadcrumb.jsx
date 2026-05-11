/**
 * FilterBreadcrumb — derived view of the filter stack with optional
 * tail-bucket label.
 *
 * R16 Phase 2. Renders `All › <segment1> › … › <segmentN>` where each
 * non-tail segment is a filter label ("Cuisine", "Season") and the
 * tail segment is the joystick-picked bucket label when set, falling
 * back to the filter label otherwise.
 *
 * State is derived from App.jsx; this component is purely
 * presentational. Click on segment N pops the filter stack back to
 * length N. Mobile truncates to 4 levels with an ellipsis; desktop
 * shows up to 6.
 *
 * Spec amendment 2 (see plan): non-tail buckets do NOT carry their
 * own picked-bucket label because focusedCluster is single-valued.
 */

import { FILTER_LABELS } from '../data/networkModes.js';

export default function FilterBreadcrumb({
  filterStack = [],
  focusedBucketLabel = null,
  onPop,
  isMobile = false,
}) {
  if (!filterStack.length) return null;

  const maxSegments = isMobile ? 4 : 6;
  const total = filterStack.length + 1; // +1 for 'All'
  const truncated = total > maxSegments;
  const visibleCount = truncated ? maxSegments - 1 : total;

  const segments = ['All', ...filterStack.map((f, i) => {
    const isTail = i === filterStack.length - 1;
    if (isTail && focusedBucketLabel) return focusedBucketLabel;
    return FILTER_LABELS[f] || f;
  })];

  const visible = truncated
    ? [...segments.slice(0, 1), '…', ...segments.slice(-(visibleCount - 2))]
    : segments;

  return (
    <nav
      aria-label="Active filters breadcrumb"
      className="flex items-center gap-1 px-3 py-1 text-[11px] text-gray-400 bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] rounded-full"
    >
      {visible.map((seg, idx) => {
        const isLast = idx === visible.length - 1;
        const isEllipsis = seg === '…';
        const popIndex = isLast ? null : idx; // index into the visible array
        return (
          <span key={`${seg}-${idx}`} className="flex items-center gap-1">
            {isEllipsis ? (
              <span className="text-gray-600">…</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  // Pop to length `popIndex` in the original stack —
                  // map back through the visible→original index relation.
                  // 'All' is index 0 in visible AND in segments; truncation
                  // hides middle indices. For the simple non-truncated
                  // case, segment index 0 = 'All' → pop to length 0.
                  // segment index N (1..filterStack.length) → pop to N-1.
                  if (isLast) return;
                  if (idx === 0) { onPop?.(0); return; }
                  // Find the original-segments index by matching the
                  // label/order. For non-truncated nav idx === original
                  // index. For truncated case, popIndex maps to the
                  // last `visibleCount - 2` filterStack entries.
                  let originalIdx = idx;
                  if (truncated && idx > 0) {
                    originalIdx = segments.length - (visible.length - idx);
                  }
                  // originalIdx of 'All' is 0 → pop to 0; of segment N
                  // (N>=1) → pop to N (keep N segments after All).
                  onPop?.(originalIdx);
                }}
                className={`px-1 rounded transition-colors ${
                  isLast
                    ? 'text-cyan-300 font-medium cursor-default'
                    : 'hover:text-cyan-200 hover:bg-[#1a1a2a] cursor-pointer'
                }`}
              >
                {seg}
              </button>
            )}
            {!isLast && <span className="text-gray-600">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
