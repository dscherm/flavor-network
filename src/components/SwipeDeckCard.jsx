/**
 * SwipeDeckCard — Tinder-style centered card with Yes/No buttons.
 * Pipeline Phase 2 (2026-05-16).
 *
 * Renders ONE card at a time from `cards[]`. User taps Yes (✓) or
 * No (×) to advance. Yes appends the card's payload to a running
 * stack; No skips. Some cards can be marked `required: true` — they
 * have no No button and the user must answer Yes (or use the
 * "Suggest one" fallback if `suggestFallback` is provided).
 *
 * Pure presentational + state-management container. Sub-view content
 * (chips, ingredient search, etc.) is rendered as `card.body`.
 *
 * a11y: aria-live announces each card change; advance/skip both move
 * the focus to the new card heading.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export default function SwipeDeckCard({
  cards = [],
  onComplete,
  onAdvanceIndex,        // optional (idx, total) emitter for progress UI
  className = '',
}) {
  const [idx, setIdx] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [exitDir, setExitDir] = useState(null);   // 'yes' | 'no' | null
  const headingRef = useRef(null);
  const [announcement, setAnnouncement] = useState('');

  const total = cards.length;
  const current = cards[idx] || null;

  // Reset focus + announce when card changes.
  useEffect(() => {
    if (!current) return;
    headingRef.current?.focus?.();
    setAnnouncement(`${current.title || 'Card'}, ${idx + 1} of ${total}`);
    onAdvanceIndex?.(idx, total);
  }, [idx, current, total, onAdvanceIndex]);

  const goNext = useCallback(() => {
    if (idx + 1 >= total) {
      onComplete?.();
    } else {
      setIdx((i) => i + 1);
    }
    setExitDir(null);
    setTransitioning(false);
  }, [idx, total, onComplete]);

  const animateExit = useCallback((dir) => {
    setExitDir(dir);
    setTransitioning(true);
    setTimeout(goNext, 220);
  }, [goNext]);

  const handleYes = useCallback(() => {
    if (!current || transitioning) return;
    current.onYes?.();
    animateExit('yes');
  }, [current, transitioning, animateExit]);

  const handleNo = useCallback(() => {
    if (!current || transitioning || current.required) return;
    current.onNo?.();
    animateExit('no');
  }, [current, transitioning, animateExit]);

  if (!current) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[60vh] ${className}`}>
        <p className="text-sm text-gray-400">No cards available.</p>
      </div>
    );
  }

  const exitClass = exitDir === 'yes'
    ? 'translate-x-0 -translate-y-12 opacity-0'
    : exitDir === 'no'
      ? 'translate-x-24 opacity-0'
      : '';

  return (
    <div className={`relative flex flex-col items-center w-full ${className}`}>
      {/* aria-live announcer */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-1.5 mb-4" aria-hidden="true">
        {cards.map((c, i) => (
          <span
            key={c.key}
            className={`h-1 rounded-full transition-all ${
              i === idx ? 'w-6 bg-cyan-300' : i < idx ? 'w-3 bg-cyan-500/40' : 'w-3 bg-gray-700'
            }`}
          />
        ))}
      </div>
      <span className="text-[11px] text-gray-500 mb-4">{idx + 1} of {total}</span>

      {/* Card body */}
      <div
        className={`w-full max-w-xl transition-all duration-200 ease-out ${exitClass}`}
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg sm:text-xl font-bold text-white text-center mb-4 focus:outline-none"
        >
          {current.title}
        </h2>
        <div className="rounded-xl border border-cyan-400/40 bg-[#12203b] p-5 sm:p-6 shadow-[0_0_24px_-8px_rgba(34,211,238,0.35)]">
          {current.body}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-center gap-4 mt-6">
        {!current.required && (
          <button
            type="button"
            onClick={handleNo}
            disabled={transitioning}
            data-testid={`swipe-deck-no-${current.key}`}
            aria-label="No, skip this card"
            className="flex items-center justify-center w-16 h-16 rounded-full bg-[#1a2a4a] hover:bg-[#22345a] text-rose-300 border-2 border-rose-400/50 transition-colors disabled:opacity-50"
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={handleYes}
          disabled={transitioning || (current.required && current.canAdvance === false)}
          data-testid={`swipe-deck-yes-${current.key}`}
          aria-label={current.required ? 'Next card' : 'Yes, add this'}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white border-2 border-emerald-300 transition-colors shadow-[0_0_20px_rgba(52,211,153,0.5)] disabled:opacity-50 disabled:bg-emerald-700 disabled:shadow-none"
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-3 text-center">
        {current.required ? 'Tap ✓ when ready' : 'Yes adds it · No skips'}
      </p>
    </div>
  );
}
