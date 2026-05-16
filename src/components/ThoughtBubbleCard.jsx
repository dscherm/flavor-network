/**
 * ThoughtBubbleCard — disclosure wrapper used by GuidedDiscoveryStart.
 * Renders as a native <details>/<summary> so we get keyboard +
 * screen-reader behavior for free (Enter/Space toggles open state,
 * aria-expanded follows the open prop).
 *
 * Iter 2026-05-16 (cloud rebuild):
 *   - Cloud-silhouette SVG outline (CloudOutline) replaces the prior
 *     rounded-rect border. Each card's outline is uniquely colored
 *     per CARD_COLOR_BY_KEY so the 9 cards read as 9 distinct
 *     thoughts at a glance.
 *   - Closed state: bold uppercase title on top + LARGE colored icon
 *     below. Both centered. The card feels like a tile, not a row.
 *   - Open state: icon hides; sub-view chips (the `children` slot)
 *     take its place. Title stays visible.
 *   - Cards are taller (min-h scales with viewport) so the cloud
 *     silhouette has room to read at typical screen sizes.
 *   - Per-card tail dots inherit the card's stroke color.
 */

import { useCallback, useRef } from 'react';
import { HEADER_ICON_BY_KEY, CARD_COLOR_BY_KEY, CloudOutline } from './guidedIcons.jsx';

// Per-card tail-dot placement (left vs right) — alternates so the grid
// doesn't visually rhyme. Mapping by bubbleKey for determinism.
const TAIL_VARIANT_BY_KEY = {
  ingredient: 'bl',
  season: 'br',
  cuisine: 'bl',
  meat: 'br',
  aroma: 'bl',
  cocktail: 'br',
  sauce: 'bl',
  dessert: 'br',
  dietary: 'bl',
};

export default function ThoughtBubbleCard({
  bubbleKey,
  label,
  selected = false,
  summaryChip = null,
  expanded = false,
  onToggleExpand,
  children,
}) {
  const tailVariant = TAIL_VARIANT_BY_KEY[bubbleKey] || 'bl';
  const HeaderIcon = HEADER_ICON_BY_KEY[bubbleKey] || null;
  const palette = CARD_COLOR_BY_KEY[bubbleKey] || CARD_COLOR_BY_KEY.ingredient;
  const detailsRef = useRef(null);

  const handleToggle = useCallback(
    (e) => {
      const isOpen = e.target.open;
      if (isOpen !== expanded) {
        onToggleExpand?.();
      }
    },
    [expanded, onToggleExpand],
  );

  const handleSummaryClick = useCallback(
    (e) => {
      e.preventDefault();
      onToggleExpand?.();
    },
    [onToggleExpand],
  );

  // When selected, swap the cloud outline to emerald-tinted; otherwise
  // use the per-card palette stroke. This keeps "selected" globally
  // legible while preserving the per-card identity at rest.
  const strokeColor = selected ? '#34d399' : palette.stroke;
  const fillTint = selected
    ? 'rgba(20, 53, 36, 0.78)'
    : 'rgba(13, 31, 56, 0.78)';

  return (
    <details
      ref={detailsRef}
      open={expanded}
      onToggle={handleToggle}
      data-bubble-key={bubbleKey}
      data-selected={selected ? 'true' : 'false'}
      data-tail={tailVariant}
      className="thought-bubble-card group relative overflow-visible"
      style={{ '--card-color': palette.stroke }}
    >
      {/* Cloud silhouette — absolute-positioned, stretches to fill
          the card. Sits BEHIND the summary content (z-0 vs z-10). */}
      <CloudOutline color={strokeColor} fillTint={fillTint} />

      {/* Two tail dots below the card, varied per bubbleKey. */}
      <span aria-hidden="true" className="thought-bubble-card-tail thought-bubble-card-tail-1" />
      <span aria-hidden="true" className="thought-bubble-card-tail thought-bubble-card-tail-2" />

      <summary
        onClick={handleSummaryClick}
        aria-expanded={expanded}
        className="relative z-10 flex flex-col items-center justify-center gap-3 px-5 pt-7 pb-5 cursor-pointer select-none list-none focus:outline-none min-h-[180px] sm:min-h-[210px]"
        style={{ listStyle: 'none' }}
      >
        {/* Selected check — top-right corner. Replaces the in-line
            +/✓ pill from the prior layout so the title can own the
            horizontal axis. */}
        <span
          aria-hidden="true"
          className={`absolute top-3 right-3 w-6 h-6 rounded-full border flex items-center justify-center text-[12px] font-bold leading-none transition-colors ${
            selected
              ? 'border-emerald-300 bg-emerald-400/25 text-emerald-100'
              : 'border-white/15 text-white/35'
          }`}
        >
          {selected ? '✓' : '+'}
        </span>

        {/* Title — big + bold, centered on top of the icon. */}
        <h3
          className="thought-bubble-card-title text-base sm:text-lg font-bold text-center leading-tight"
          style={{ color: selected ? '#a7f3d0' : palette.text }}
        >
          {label}
        </h3>

        {/* Big colored icon — closed state only. Disappears on expand
            so the sub-view chips have room. Color matches the cloud
            outline. */}
        {!expanded && HeaderIcon && (
          <span
            aria-hidden="true"
            className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 transition-opacity duration-200"
            style={{ color: selected ? '#6ee7b7' : palette.stroke }}
          >
            <HeaderIcon className="w-full h-full" />
          </span>
        )}

        {/* Closed-state selection summary (e.g., "Italian", "summer")
            — appears beneath the icon when the card has a value. */}
        {!expanded && selected && summaryChip && (
          <span
            className="inline-flex flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/25 text-emerald-100 border border-emerald-400/40 max-w-[200px] truncate"
            title={summaryChip}
          >
            {summaryChip}
          </span>
        )}

        {/* Chevron — bottom center. Rotates 180° when expanded. */}
        <svg
          aria-hidden="true"
          className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 text-white/40 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </summary>

      {/* Sub-view children — visible only when expanded. Sits BELOW
          the summary in the DOM; the <details> browser semantics
          handle visibility. Extra horizontal padding keeps chips
          away from the cloud's bumpy edges (user feedback: chips
          were overflowing the visible cloud interior). */}
      <div className="relative z-10 px-6 sm:px-8 pb-7 -mt-1">
        {children}
      </div>
    </details>
  );
}
