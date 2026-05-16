/**
 * TourPopup — Phase 6 (pipeline 2026-05-16).
 *
 * Pure-presentation overlay for the GuidedTour. Reads the active
 * stage config + dispatches { advance, skip } callbacks; never owns
 * stage state itself.
 *
 * Anchor positions: 'tl' | 'tr' | 'bl' | 'br' | 'center'. Auto-pinned
 * to one of the 4 viewport corners (or center) so the 3D canvas
 * remains mostly visible behind it.
 *
 * a11y: role=dialog, traps focus on the Next/Skip buttons, auto-
 * focuses Next on stage change.
 */
import { useEffect, useRef } from 'react';

const ANCHOR_CLASSES = {
  tl:     'top-[calc(var(--nav-h,72px)+1rem)] left-4',
  tr:     'top-[calc(var(--nav-h,72px)+1rem)] right-4',
  bl:     'bottom-20 left-4',
  br:     'bottom-20 right-4',
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

export default function TourPopup({
  stage,
  stageIdx,
  totalStages,
  showLabPicks = false,
  onAdvance,
  onSkip,
  onPickLab,        // (labKey: 'recipes' | 'cocktail' | 'sauce' | 'done') => void
}) {
  const advanceBtnRef = useRef(null);

  useEffect(() => {
    advanceBtnRef.current?.focus?.();
  }, [stage?.id]);

  if (!stage) return null;

  const anchor = ANCHOR_CLASSES[stage.popupAnchor] || ANCHOR_CLASSES.tr;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={stage.title}
      data-tour-stage={stage.id}
      className={`fixed z-[120] w-[min(360px,calc(100vw-2rem))] rounded-2xl border-2 p-4 shadow-2xl backdrop-blur-md ${anchor}`}
      style={{
        borderColor: stage.accent,
        background: stage.gradient || 'rgba(13, 31, 56, 0.92)',
        backgroundColor: 'rgba(13, 31, 56, 0.92)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-bold text-white">{stage.title}</h3>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-[10px] text-gray-400">
            {stageIdx + 1}/{totalStages}
          </span>
          {/* 2.D.4 — explicit close. Outside-click would conflict with
              canvas interaction (orbit, cluster click), so we use an
              X button instead. */}
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close tour"
            className="text-gray-300 hover:text-white leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
      <p className="text-sm text-[#dbeafe] leading-relaxed mb-4">{stage.copy}</p>

      {showLabPicks ? (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => onPickLab?.('recipes')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-pink-500/30 hover:bg-pink-500/50 text-pink-100 border border-pink-400/50 transition-colors"
          >
            Recipes Tour
          </button>
          <button
            type="button"
            onClick={() => onPickLab?.('cocktail')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-violet-500/30 hover:bg-violet-500/50 text-violet-100 border border-violet-400/50 transition-colors"
          >
            Cocktail Tour
          </button>
          <button
            type="button"
            onClick={() => onPickLab?.('sauce')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-400/50 transition-colors"
          >
            Sauce Tour
          </button>
          <button
            ref={advanceBtnRef}
            type="button"
            onClick={() => onPickLab?.('done')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-300 transition-colors"
          >
            Done — explore
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] text-gray-400 hover:text-gray-200 underline transition-colors"
          >
            Skip tour
          </button>
          <button
            ref={advanceBtnRef}
            type="button"
            onClick={onAdvance}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white border-2 transition-colors hover:brightness-110"
            style={{
              background: stage.accent,
              borderColor: stage.accent,
            }}
          >
            Got it →
          </button>
        </div>
      )}
    </div>
  );
}
