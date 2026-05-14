/**
 * StoryPanel — Phase 4 honest dual-sentence story renderer.
 *
 * Renders the output of `whyThisWorks(pair, runtime, ctx)` in the
 * shape Critic-imposed Constraint #5 demands:
 *   1. causalSentence (always rendered, prominent)
 *   2. annotativeSentence (muted, "supporting context" label)
 *   3. disclaimer chip when isAnnotativeCompoundUsedByRuntime === false
 *      and an annotativeSentence exists (so we never lie about chemistry)
 *   4. citation chips (ground_truth refs, open URL in new tab)
 *   5. surprise badges (axes that fired from chemDataset/validation)
 *
 * aria-live="polite" announces story changes to screen readers per AC.
 */

import React from 'react';

const SURPRISE_LABELS = {
  'chem-bridged-rare': 'rare chemistry bridge',
  'absent-from-books': 'beyond the book',
  'cross-cuisine': 'cross-cuisine',
  'cross-aroma': 'cross-aroma',
};

function CitationChip({ citation }) {
  if (!citation || !citation.ref) return null;
  const ref = citation.ref;
  const url = citation.url || null;
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-900/30 text-amber-200 border border-amber-700/40 hover:bg-amber-900/50 transition-colors"
        data-testid="story-citation-chip"
      >
        <span aria-hidden="true">cite</span>
        <span className="truncate max-w-[260px]">{ref}</span>
      </a>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-900/30 text-amber-200 border border-amber-700/40"
      data-testid="story-citation-chip"
    >
      <span aria-hidden="true">cite</span>
      <span className="truncate max-w-[260px]">{ref}</span>
    </span>
  );
}

function SurpriseBadge({ axis }) {
  const label = SURPRISE_LABELS[axis] || axis;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold bg-fuchsia-900/30 text-fuchsia-200 border border-fuchsia-600/40"
      data-testid={`story-surprise-${axis}`}
    >
      {label}
    </span>
  );
}

export default function StoryPanel({ story, pair, className = '' }) {
  if (!story || typeof story !== 'object') return null;
  const {
    causalSentence,
    annotativeSentence,
    isAnnotativeCompoundUsedByRuntime,
    citationsIfAny = [],
    surpriseAxesMatched = [],
  } = story;

  const a = pair?.ingredientA || pair?.a || null;
  const b = pair?.ingredientB || pair?.b || null;
  const pairLabel = a && b ? `${a} + ${b}` : null;

  return (
    <div
      className={`bg-[#0f1d33] border border-[#1d3158] rounded-xl p-4 sm:p-5 ${className}`}
      role="region"
      aria-label={pairLabel ? `Story for ${pairLabel}` : 'Pairing story'}
      aria-live="polite"
      data-testid="story-panel"
    >
      {pairLabel && (
        <div className="text-[11px] uppercase tracking-wide text-cyan-300/80 mb-2">
          {pairLabel}
        </div>
      )}

      {/* 1. Causal sentence — always present, prominent. */}
      <p
        className="text-base text-white font-normal leading-snug"
        data-testid="story-causal"
      >
        {causalSentence}
      </p>

      {/* 2. Annotative sentence + (3) disclaimer chip. */}
      {annotativeSentence && (
        <div className="mt-3 space-y-2">
          <span className="block text-[10px] uppercase tracking-wide opacity-60 text-gray-300">
            supporting context
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="text-sm text-gray-400 leading-snug"
              data-testid="story-annotative"
            >
              {annotativeSentence}
            </p>
            {isAnnotativeCompoundUsedByRuntime === false && (
              <span
                className="text-[10px] px-2 py-0.5 rounded bg-amber-900/40 text-amber-200 border border-amber-700/40"
                data-testid="story-annotation-disclaimer"
              >
                annotation only — not used in ranking
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. Citation chips — ground_truth refs. */}
      {citationsIfAny.length > 0 && (
        <div
          className="mt-3 flex flex-wrap gap-2"
          data-testid="story-citations"
        >
          {citationsIfAny.map((c, i) => (
            <CitationChip key={`cite-${i}`} citation={c} />
          ))}
        </div>
      )}

      {/* 5. Surprise badges — Phase 1 axis classifiers that fired. */}
      {surpriseAxesMatched.length > 0 && (
        <div
          className="mt-3 flex flex-wrap gap-2"
          data-testid="story-surprise"
        >
          {surpriseAxesMatched.map((axis) => (
            <SurpriseBadge key={axis} axis={axis} />
          ))}
        </div>
      )}
    </div>
  );
}

export { SURPRISE_LABELS };
