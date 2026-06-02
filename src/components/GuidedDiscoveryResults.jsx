/**
 * GuidedDiscoveryResults — Phase 6 (Track 3 — Guided Overhaul).
 *
 * Replaces the Phase 4 composition (legacy radial wheel + multi-axis
 * radar stack) with the new per-pairing GuidedProfileRadar +
 * GuidedResultsFilterPills row + ProvenancePanel "Where this data
 * comes from" panel.
 *
 * Composition:
 *   - top: bubble-stack chip strip (re-uses the GuidedDiscoveryStart
 *     chip styling; tap-to-remove forwards to the parent so the
 *     bubbleStack can be repaired without bouncing back to Screen 1)
 *   - chemistry banner (Constraint #5b, OQ4 closure): single banner
 *     ABOVE the radar (was above the wheel pre-P6) when ≥50% of
 *     hero pairings have breakdown.x3 === 0.5. As of 2026-05-30
 *     (GD-RADAR-AFFINITY-COHERENCE) hero pairings are sourced from
 *     getNeighborsEnriched — the same set α-mode uses — so the radar
 *     dots and the network's α-mode highlights are the same
 *     ingredients.
 *   - GuidedResultsFilterPills row (P3 component, single-select)
 *   - GuidedProfileRadar (P2 component, per-pairing dot scatter)
 *   - StoryPanel (Phase 4) for the user-selected hero pairing
 *   - "Show me where this data comes from" button → ProvenancePanel
 *   - bottom CTAs: "Back to bubbles" + "Explore in the network →"
 *
 * Constraint #4: this component MUST NOT call setFilterStack itself.
 * The onExploreInNetwork callback is the bridge owned by App.jsx.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { getNeighborsEnriched } from '../data/graph.js';
import { passesDietaryFilters } from '../data/dietaryFilters.js';
import { getAxesFor, pairingMatchesAxis } from '../data/guidedRadarAxes.js';
import StoryPanel from './StoryPanel.jsx';
import GuidedProfileRadar from './GuidedProfileRadar.jsx';
import GuidedResultsFilterPills from './GuidedResultsFilterPills.jsx';
import GuidedAlphaPanel from './GuidedAlphaPanel.jsx';
import ProvenancePanel from './ProvenancePanel.jsx';
import { whyThisWorks } from '../data/whyThisWorks.js';

// User audit 2026-05-16: the prior copy blamed "FlavorDB API down" which
// is misleading — the pipeline is ProData (RecipeNLG + TheMealDB +
// TheCocktailDB co-occurrence), not a live FlavorDB call. An x3 === 0.5
// breakdown means the chem-bridge pass found no shared compounds for
// that specific pair, not that an upstream API is offline. We also
// tightened the predicate (in showChemistryBanner below) to fire only
// when the MAJORITY of hero pairs lack chemistry signal — previously
// `any pair at 0.5` was tripping it almost universally (18% of all
// 72,521 pairings in the live corpus have x3 === 0.5).
const CHEMISTRY_BANNER_COPY =
  'Several pairings on this wheel rank on recipe co-occurrence alone — our chemistry bridge found no shared aroma compounds for those specific pairs. The story for each pair will say which signal it leans on.';

function summarizeBubble(b) {
  if (!b) return '';
  const v = b.value;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    if (v.ingredient) return v.ingredient;
    if (v.cuisineBucket) return v.cuisineBucket;
    if (v.aromaBucket) return v.aromaBucket;
    if (Array.isArray(v.dietary) && v.dietary.length > 0) return v.dietary.join(', ');
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

/** Pull dietary restrictions out of the bubbleStack (added 2026-05-16). */
function dietaryFromStack(bubbleStack) {
  if (!Array.isArray(bubbleStack)) return [];
  for (const b of bubbleStack) {
    if (b?.key === 'dietary' && Array.isArray(b?.value?.dietary)) {
      return b.value.dietary;
    }
  }
  return [];
}

/** Map the bubbleStack's most-recent axis-hint bubble back to a filter
 *  type, used to seed the radar's filterType when the parent didn't
 *  pass an `initialFilterType` prop. Default 'taste' — every node
 *  carries a taste field; aroma needs gnnEntropy which is sparse.
 */
function filterTypeFromStack(bubbleStack, fallback = 'taste') {
  if (!Array.isArray(bubbleStack)) return fallback;
  for (let i = bubbleStack.length - 1; i >= 0; i--) {
    const b = bubbleStack[i];
    if (!b?.axisHint) continue;
    if (b.axisHint === 'aroma' || b.axisHint === 'cuisine' ||
        b.axisHint === 'season' || b.axisHint === 'taste') {
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

/** Hydrate a hero pairing (minimal {name, strength}) into a richer
 *  node-shape pulled from ctx.graph.nodes so the radar's predicates
 *  (taste / aroma / season / cuisine) have something to read.
 */
function hydratePairing(neighbor, ctx) {
  if (!neighbor || !neighbor.name) return neighbor;
  const node = ctx?.graph?.nodes?.get?.(neighbor.name);
  if (!node) return neighbor;
  return {
    ...neighbor,
    taste: node.taste ?? neighbor.taste,
    season: node.season ?? neighbor.season,
    cuisines: node.cuisines ?? neighbor.cuisines,
    gnnProbs: node.gnnProbs ?? neighbor.gnnProbs,
  };
}

export default function GuidedDiscoveryResults({
  bubbleStack = [],
  initialFilterType = null,         // P6 — new prop from P5 payload
  onBackToBubbles,
  onExploreInNetwork,
  onAxisSelect,                     // legacy hook (now driven by radar tap)
  // Optional injection points (used by tests + the App.jsx wrapper):
  ctx = null,
  runtimeData = null,
  odorThresholds = null,
}) {
  const [selectedPair, setSelectedPair] = useState(null);
  const [provenancePanelOpen, setProvenancePanelOpen] = useState(false);

  const focalName = useMemo(() => focalFromStack(bubbleStack), [bubbleStack]);
  const dietary = useMemo(() => dietaryFromStack(bubbleStack), [bubbleStack]);
  const focal = useMemo(
    () => (focalName ? { name: focalName } : null),
    [focalName],
  );

  // P6 — filter type is now local state on the Results page (set by the
  // pill row). Seeded from initialFilterType (P5 payload) when provided,
  // else inferred from the bubbleStack's latest axis-hint bubble.
  const seededFilterType = useMemo(
    () => initialFilterType || filterTypeFromStack(bubbleStack),
    [initialFilterType, bubbleStack],
  );
  const [filterType, setFilterType] = useState(seededFilterType);
  const [chosenValue, setChosenValue] = useState(null);

  // If the parent swaps initialFilterType (e.g. new flow), follow.
  useEffect(() => {
    setFilterType(seededFilterType);
    setChosenValue(null);
  }, [seededFilterType]);

  // Hero pairings — GD-RADAR-AFFINITY-COHERENCE (2026-05-30): switched
  // from selectCuratedPairings to getNeighborsEnriched so the dots a
  // user sees on this radar are the SAME ingredients α-mode arranges
  // around the focal once the tour activates.
  //
  // GD-RADAR-NEIGHBOR-DIVERSITY (2026-05-30): the strict top-10 by
  // NPMI strength clusters around similar profiles — tapping a
  // low-coverage axis (e.g. salty on a tomato focal) often highlighted
  // ZERO dots. Pad the top-10 base with axis-coverage picks: for each
  // filterType (taste / aroma / season / cuisine), if no top-10
  // neighbor matches a given axis, pull the highest-strength
  // sub-MAX_POOL candidate that does. Cap at MAX_POOL.
  const heroPairings = useMemo(() => {
    if (!focalName || !ctx?.graph?.edges) return [];
    const BASE_TOP = 10;
    const MAX_POOL = 20;
    const FILTERTYPES = ['taste', 'aroma', 'season', 'cuisine'];
    try {
      const all = getNeighborsEnriched(
        focalName,
        ctx.graph.edges,
        ctx.cuisineNeighborIndex,
      );
      const dietaryActive = Array.isArray(dietary) && dietary.length > 0;
      const filtered = dietaryActive
        ? all.filter((n) => {
            const node = ctx?.graph?.nodes?.get?.(n.name) || { name: n.name };
            return passesDietaryFilters(n.name, node, dietary);
          })
        : all;
      const base = filtered.slice(0, BASE_TOP);
      const baseNames = new Set(base.map((n) => n.name));
      const hydrateLite = (n) => hydratePairing(n, ctx);
      // Walk each filterType / each of its axes. When the base has
      // zero matches on (ft, axisKey), scan past BASE_TOP for the
      // highest-strength candidate that matches and add it once.
      for (const ft of FILTERTYPES) {
        const axes = getAxesFor(ft);
        for (const axisKey of axes) {
          if (base.length >= MAX_POOL) break;
          const baseHasMatch = base.some((p) => pairingMatchesAxis(hydrateLite(p), ft, axisKey, odorThresholds));
          if (baseHasMatch) continue;
          for (let i = BASE_TOP; i < filtered.length && base.length < MAX_POOL; i += 1) {
            const cand = filtered[i];
            if (baseNames.has(cand.name)) continue;
            if (pairingMatchesAxis(hydrateLite(cand), ft, axisKey, odorThresholds)) {
              base.push(cand);
              baseNames.add(cand.name);
              break;
            }
          }
        }
      }
      return base;
    } catch {
      return [];
    }
  }, [focalName, ctx, dietary, odorThresholds]);

  // Hydrate hero pairings with node fields so the radar's predicates
  // (taste / aroma / season / cuisine) have something to read off.
  const radarPairings = useMemo(
    () => heroPairings.map((n) => hydratePairing(n, ctx)),
    [heroPairings, ctx],
  );

  // Chemistry banner predicate — Constraint #5b: single banner not
  // per-pair chips. OQ4 closure: predicate input is unchanged
  // (selectCuratedPairings stays imported solely for this).
  const showChemistryBanner = useMemo(() => {
    if (heroPairings.length === 0) return false;
    let missing = 0;
    for (const n of heroPairings) {
      const pair = normalizePair(focal, n, ctx);
      if (pair?.breakdown?.x3 === 0.5) missing += 1;
    }
    return missing / heroPairings.length >= 0.5;
  }, [heroPairings, focal, ctx]);

  // Reset the selected pair when the focal changes.
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

  // Two-step commit gesture (DOCS-GD-TWO-TAP, spec §11 O-2):
  //   1. First tap on axis X   → arm chosenValue = X (wedge fill only).
  //   2. Second tap on same X  → commit: fire onAxisSelect(filterType)
  //                              so App.jsx maps axis → filterStack +
  //                              activates GuidedTour, jumping to network.
  //   3. Tap on different axis → re-arm to that axis (no commit).
  // Eliminates surface-bounce on incidental taps and lets the user
  // compare wedge fills across axes without losing the Results page.
  const handleAxisTap = (axisKey) => {
    if (chosenValue === axisKey) {
      if (typeof onAxisSelect === 'function') {
        // GD-TOUR-AXIS-INTENT-CARRY (2026-05-30): pass the tapped
        // axisKey alongside filterType so App.jsx can surface the
        // intent context on the GuidedTour Step 1 popup.
        onAxisSelect(filterType, axisKey);
      }
      return;
    }
    setChosenValue(axisKey);
  };

  const handlePillSelect = (next) => {
    setFilterType(next);
    // Switching the filter-type pill resets chosenValue to null
    // (asserted by the P6 integration test "pill switch" spec).
    setChosenValue(null);
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

        {/* Chemistry banner (Constraint #5b — OQ4 closure: now ABOVE the
            radar, not above the wheel; predicate input unchanged). */}
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

        {/* 2026-06-01 user-iter: the prior taste-radar slot is replaced
            by GuidedAlphaPanel — an embedded α-mode view of the focal
            inside the Guided panel. Filter pills (Aroma / Taste /
            Family / Cuisine / Season) live inside the new panel; the
            forked single-select GuidedResultsFilterPills row is no
            longer rendered on this screen. */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
          <div className="flex flex-col gap-2">
            {focal && ctx ? (
              <GuidedAlphaPanel focal={focal?.name} data={ctx} />
            ) : focal && !ctx ? (
              <div
                className="bg-[#0a1428] border border-[#1d3158] rounded-xl text-center text-sm text-gray-400 px-6 py-12 max-w-sm"
                data-testid="guided-results-loading-state"
              >
                <p className="text-gray-300 mb-2">Loading affinity data…</p>
                <p className="text-xs text-gray-500">
                  Fetching pairing strengths for {focal.name}. If this
                  persists, the dataset failed to load — try refreshing.
                </p>
              </div>
            ) : (
              <div
                className="bg-[#0a1428] border border-[#1d3158] rounded-xl text-center text-sm text-gray-400 px-6 py-12 max-w-sm"
                data-testid="guided-results-empty-state"
              >
                <p className="text-gray-300 mb-2">
                  Pick a specific ingredient bubble to see the pairing radar.
                </p>
                <p className="text-xs text-gray-500">
                  The radar needs a focal ingredient. Tap "Back to bubbles"
                  and expand "Starts with a specific ingredient".
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setProvenancePanelOpen(true)}
              data-testid="guided-results-provenance-button"
              className="self-start mt-1 text-xs text-cyan-300/80 hover:text-cyan-200 underline underline-offset-2 transition-colors"
            >
              Show me where this data comes from
            </button>
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
                  ? 'Tap an axis on the radar to highlight pairings, or tap a dot to read the story.'
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
            onClick={() => onExploreInNetwork?.({ chosenValue, filterType })}
            data-testid="guided-results-explore"
            className="px-5 py-2.5 min-h-[44px] rounded-lg font-medium bg-cyan-500 hover:bg-cyan-400 text-white border border-cyan-300 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-colors"
          >
            Explore in the network →
          </button>
        </div>
      </div>

      <ProvenancePanel
        open={provenancePanelOpen}
        onClose={() => setProvenancePanelOpen(false)}
      />
    </div>
  );
}

export { CHEMISTRY_BANNER_COPY, focalFromStack, filterTypeFromStack, normalizePair };
