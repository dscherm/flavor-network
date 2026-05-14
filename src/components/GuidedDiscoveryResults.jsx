/**
 * GuidedDiscoveryResults — Phase 4 Screen 2.
 *
 * Replaces the Phase 3 stub. Composition:
 *   - top: bubble-stack chip strip (re-uses the GuidedDiscoveryStart
 *     chip styling; tap-to-remove forwards to the parent so the
 *     bubbleStack can be repaired without bouncing back to Screen 1)
 *   - chemistry banner (Constraint #5b): single banner above the wheel
 *     when ANY about-to-be-displayed pairing has breakdown.x3 === 0.5
 *   - CuratedWheel (Phase 2 component) when an ingredient bubble is
 *     present in the stack (focal = that ingredient)
 *   - empty-state when no ingredient bubble (the wheel needs a focal)
 *   - StoryPanel (Phase 4) for the user-selected hero pairing
 *   - bottom CTAs: "Back to bubbles" + "Explore in the network →"
 *
 * Constraint #4: this component MUST NOT call setFilterStack itself.
 * The onExploreInNetwork callback is the bridge owned by App.jsx.
 */

import React, { useEffect, useMemo, useState } from 'react';
import CuratedWheel, { selectCuratedPairings } from './CuratedWheel.jsx';
import StoryPanel from './StoryPanel.jsx';
import { whyThisWorks } from '../data/whyThisWorks.js';

const CHEMISTRY_BANNER_COPY =
  'Chemistry data partially unavailable (FlavorDB API down); chem-bridge scores fall back to a constant. See validation/reports/LATEST.md.';

function summarizeBubble(b) {
  if (!b) return '';
  const v = b.value;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    if (v.ingredient) return v.ingredient;
    if (v.cuisineBucket) return v.cuisineBucket;
    if (v.aromaBucket) return v.aromaBucket;
  }
  return v === true ? 'on' : '';
}

/** Pull the focal ingredient out of the bubbleStack (first ingredient bubble). */
function focalFromStack(bubbleStack) {
  if (!Array.isArray(bubbleStack)) return null;
  for (const b of bubbleStack) {
    if (b?.key === 'ingredient' && b?.value?.ingredient) {
      return b.value.ingredient;
    }
  }
  return null;
}

/** Decide which axis the curated wheel should bucket against.
 *  Default 'taste' — every node carries a taste field (categoricalAxes
 *  bucketOf reads node.taste directly), whereas 'aroma' depends on
 *  gnnEntropy which is missing for ~30% of ingredients. Taste is the
 *  safest default for the wheel's bucket-membership lookup.
 */
function axisFromStack(bubbleStack, fallback = 'taste') {
  if (!Array.isArray(bubbleStack)) return fallback;
  // Prefer the most-recently-added bubble that maps to a wheel axis.
  for (let i = bubbleStack.length - 1; i >= 0; i--) {
    const b = bubbleStack[i];
    if (!b?.axisHint) continue;
    if (b.axisHint === 'aroma' || b.axisHint === 'cuisine' ||
        b.axisHint === 'season' || b.axisHint === 'family' ||
        b.axisHint === 'taste') {
      return b.axisHint;
    }
  }
  return fallback;
}

/** Build the runtime + ctx objects whyThisWorks needs. */
function buildWhyThisWorksInputs({ pair, ctx, runtimeData }) {
  const pairingCount = runtimeData?.pairingCount
    ?? ctx?.metadata?.pairingCount
    ?? 50312; // sensible default matching live metadata.json
  const runtime = {
    pairingCount,
    sharedCompoundsForPair: (a, b) => {
      // Defensive — pair.sharedCompounds is the live source of truth;
      // this only fires when sharedCompounds[] is empty AND the caller
      // supplied a runtime-side overlap probe.
      const fn = runtimeData?.sharedCompoundsForPair;
      if (typeof fn === 'function') {
        try { return fn(a, b) || []; } catch { return []; }
      }
      return [];
    },
  };
  const whyCtx = {
    bridgeCompounds: ctx?.bridgeCompounds || null,
    gnnEntropy: ctx?.gnnEntropy || null,
    groundTruth: ctx?.groundTruth || null,
    ingredientMeta: ctx?.ingredientMeta || null,
  };
  return { runtime, whyCtx };
}

/**
 * Lift selected hero pairings into a normalized {ingredientA,
 * ingredientB, strength, sharedCompounds, breakdown} shape so
 * whyThisWorks can read them without caring whether they came from
 * surprisingAffinities() or topAffinities() (both omit some fields).
 */
function normalizePair(focal, neighbor, ctx) {
  const a = typeof focal === 'string' ? focal : focal?.name || '';
  const b = neighbor?.name || '';
  // Try to recover the original pairing record from ctx for breakdown
  // + sharedCompounds. We hit this path very rarely (the heroPairings
  // come straight from surprisingAffinities/topAffinities which don't
  // carry the full record), so we keep it cheap by scanning edges.
  const edges = ctx?.graph?.edges || [];
  let breakdown = null;
  let sharedCompounds = null;
  for (const e of edges) {
    const ea = e.source ?? e.ingredientA;
    const eb = e.target ?? e.ingredientB;
    if ((ea === a && eb === b) || (ea === b && eb === a)) {
      breakdown = e.breakdown || null;
      sharedCompounds = Array.isArray(e.sharedCompounds) ? e.sharedCompounds : null;
      break;
    }
  }
  return {
    ingredientA: a,
    ingredientB: b,
    strength: typeof neighbor?.strength === 'number' ? neighbor.strength : 0,
    sharedCompounds: sharedCompounds || [],
    breakdown: breakdown || { x3: 0.5 }, // honest default — most pairs land here
  };
}

export default function GuidedDiscoveryResults({
  bubbleStack = [],
  onBackToBubbles,
  onExploreInNetwork,
  // Optional injection points (used by tests + the App.jsx wrapper):
  ctx = null,
  runtimeData = null,
  // CuratedWheel viewport override.
  viewport = { width: 600, height: 600 },
}) {
  const [selectedPair, setSelectedPair] = useState(null);

  const focalName = useMemo(() => focalFromStack(bubbleStack), [bubbleStack]);
  const axis = useMemo(() => axisFromStack(bubbleStack), [bubbleStack]);
  const focal = useMemo(
    () => (focalName ? { name: focalName } : null),
    [focalName],
  );

  // Hero pairings — derived from CuratedWheel's selector when ctx is
  // available. Used for the chemistry-banner predicate (any pair with
  // x3 === 0.5 → banner).
  const heroPairings = useMemo(() => {
    if (!focal || !ctx) return [];
    try {
      return selectCuratedPairings({ focal, ctx }) || [];
    } catch {
      return [];
    }
  }, [focal, ctx]);

  // Chemistry banner predicate — Constraint #5b: single banner not
  // per-pair chips. ANY hero with x3 === 0.5 trips the banner.
  const showChemistryBanner = useMemo(() => {
    if (heroPairings.length === 0) return false;
    for (const n of heroPairings) {
      const pair = normalizePair(focal, n, ctx);
      if (pair?.breakdown?.x3 === 0.5) return true;
    }
    return false;
  }, [heroPairings, focal, ctx]);

  // Reset the selected pair when the focal changes (otherwise a stale
  // selection from a previous focal could linger).
  useEffect(() => {
    setSelectedPair(null);
  }, [focalName]);

  const story = useMemo(() => {
    if (!selectedPair) return null;
    const { runtime, whyCtx } = buildWhyThisWorksInputs({
      pair: selectedPair,
      ctx,
      runtimeData,
    });
    try {
      return whyThisWorks(selectedPair, runtime, whyCtx);
    } catch {
      return null;
    }
  }, [selectedPair, ctx, runtimeData]);

  const handleSelectNeighbor = (neighbor) => {
    if (!neighbor || !focal) return;
    setSelectedPair(normalizePair(focal, neighbor, ctx));
  };

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-8 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="guided-discovery-results"
    >
      <div className="w-full max-w-5xl">
        <h1 className="text-xl sm:text-2xl text-white text-center font-light mb-3">
          Guided Discovery — Results
        </h1>

        {/* Bubble-stack chip strip — same look as Screen 1's strip. */}
        <div
          className="flex flex-wrap justify-center gap-2 mb-4 min-h-[2rem]"
          aria-label="Selected bubbles"
          data-testid="guided-results-stack"
        >
          {bubbleStack.length === 0 ? (
            <span className="text-[11px] text-gray-500 italic">
              (no bubbles selected — return to bubbles to add some)
            </span>
          ) : (
            bubbleStack.map((b) => (
              <span
                key={b.key}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 min-h-[28px]"
                data-testid={`guided-results-chip-${b.key}`}
              >
                <span className="truncate max-w-[200px]">
                  {b.label}{summarizeBubble(b) ? `: ${summarizeBubble(b)}` : ''}
                </span>
              </span>
            ))
          )}
        </div>

        {/* Chemistry banner (Constraint #5b — single banner, not per-pair chips). */}
        {showChemistryBanner && (
          <div
            className="flex items-start gap-3 mb-4 px-4 py-3 rounded-lg bg-amber-900/40 text-amber-200 border border-amber-700/40 text-sm"
            role="status"
            data-testid="guided-results-chemistry-banner"
          >
            <span aria-hidden="true" className="text-base leading-none mt-0.5">⚠</span>
            <span className="leading-snug">{CHEMISTRY_BANNER_COPY}</span>
          </div>
        )}

        {/* Curated wheel + StoryPanel layout. */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
          <div className="bg-[#0a1428] border border-[#1d3158] rounded-xl p-3 min-h-[420px] flex items-center justify-center">
            {focal && ctx ? (
              <CuratedWheel
                focal={focal}
                ctx={ctx}
                axis={axis}
                viewport={viewport}
                onSelectPairing={handleSelectNeighbor}
                className="w-full h-auto max-h-[520px]"
              />
            ) : (
              <div
                className="text-center text-sm text-gray-400 px-6 py-12 max-w-sm"
                data-testid="guided-results-empty-state"
              >
                <p className="text-gray-300 mb-2">
                  Pick a specific ingredient bubble to see the curated wheel.
                </p>
                <p className="text-xs text-gray-500">
                  The wheel needs a focal ingredient to map shared
                  compounds + tier coloring around. Tap "Back to bubbles" and
                  expand "Starts with a specific ingredient".
                </p>
              </div>
            )}
          </div>
          <div className="min-h-[200px]">
            {story ? (
              <StoryPanel story={story} pair={selectedPair} />
            ) : (
              <div
                className="bg-[#0f1d33] border border-[#1d3158] rounded-xl p-4 sm:p-5 text-sm text-gray-400 leading-snug"
                data-testid="guided-results-story-placeholder"
              >
                {focal
                  ? 'Tap a hero pairing on the wheel to see why our engine ranked it.'
                  : 'No story yet — pick an ingredient bubble + a hero pairing.'}
              </div>
            )}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <button
            type="button"
            onClick={() => onBackToBubbles?.()}
            data-testid="guided-results-back"
            className="px-5 py-2.5 min-h-[44px] rounded-lg font-medium bg-[#1a2a4a] hover:bg-[#22345a] text-gray-200 border border-[#2c4470] transition-colors"
          >
            ← Back to bubbles
          </button>
          <button
            type="button"
            onClick={() => onExploreInNetwork?.()}
            data-testid="guided-results-explore"
            className="px-5 py-2.5 min-h-[44px] rounded-lg font-medium bg-cyan-500 hover:bg-cyan-400 text-white border border-cyan-300 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-colors"
          >
            Explore in the network →
          </button>
        </div>
      </div>
    </div>
  );
}

export { CHEMISTRY_BANNER_COPY, focalFromStack, axisFromStack, normalizePair };
