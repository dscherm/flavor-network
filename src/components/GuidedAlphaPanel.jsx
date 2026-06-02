/**
 * GuidedAlphaPanel — Step 3 of Guided Discovery (replaces the prior
 * taste-radar slot, 2026-06-01).
 *
 * Renders an embedded α-mode (Affinity Mode) view of the focal
 * ingredient inside the GuidedDiscoveryResults panel. Top-down
 * (bird's-eye) camera. Includes a filter pill row that switches the
 * α-mode wedge axis (Aroma / Taste / Family / Cuisine / Season) and
 * a "Step 1 — Affinity View" tour overlay with a "Got it" button
 * that advances the user to step 2 of the panel tour.
 *
 * Phase 1 (this commit): UI shell + harness helpers. The embedded
 * 3D scene is rendered via a child LivingArchView with α-mode pre-
 * engaged on the focal. If the focal lookup fails (e.g., the name
 * doesn't resolve in the graph), the panel collapses to a clear
 * "focal unavailable" message rather than rendering an empty scene.
 *
 * Tour state:
 *   Step 1 → "Affinity View" — initial state on mount.
 *   Step 2 → (TBD by next iteration) — user clicks "Got it" to enter.
 *
 * Exposes (on window, gated to ?af_debug=1):
 *   __qaGuidedAlphaAxis()       — current wedge axis ('aromas' / 'taste' / …)
 *   __qaGuidedAlphaCameraPose() — { pos: [x,y,z], target: [x,y,z] }
 *   __qaGuidedAlphaTourStep()   — 1 | 2
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Axis order matches the main FilterPillRow per user feedback 2026-05-31:
// Aroma / Taste / Family / Cuisine / Season. (Flavor Graph and None
// pills are network-only; α-view never needs them.)
const FILTER_KEYS = ['aroma', 'taste', 'family', 'cuisine', 'season'];
const FILTER_LABELS = {
  aroma: 'Aroma',
  taste: 'Taste',
  family: 'Family',
  cuisine: 'Cuisine',
  season: 'Season',
};
// FILTER_KEYS singular → α-mode wedge axis (plural) used by AffinityMode.
const AXIS_FOR_FILTER = {
  aroma: 'aromas',
  taste: 'taste',
  family: 'family',
  cuisine: 'cuisine',
  season: 'season',
};

export default function GuidedAlphaPanel({
  focal,
  // The full graph data + positions passed down from App.jsx via
  // GuidedDiscoveryResults. Required for the embedded 3D scene to
  // build its node mesh. When null, render the empty-focal state.
  // eslint-disable-next-line no-unused-vars
  data = null,
  onAdvanceTour,
}) {
  const [activeFilter, setActiveFilter] = useState('aroma');
  const [tourStep, setTourStep] = useState(1);
  const canvasContainerRef = useRef(null);
  const cameraPoseRef = useRef({ pos: [0, 200, 0.1], target: [0, 0, 0] });

  const activeAxis = AXIS_FOR_FILTER[activeFilter];

  const handleGotIt = useCallback(() => {
    setTourStep(2);
    if (typeof onAdvanceTour === 'function') onAdvanceTour(2);
  }, [onAdvanceTour]);

  // Test harness — gated on ?af_debug=1 so production traffic doesn't
  // see the global writes. Useful for the qa-guided-alpha-view probe.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    if (params.get('af_debug') !== '1') return undefined;
    window.__qaGuidedAlphaAxis = () => activeAxis;
    window.__qaGuidedAlphaCameraPose = () => cameraPoseRef.current;
    window.__qaGuidedAlphaTourStep = () => tourStep;
    return () => {
      delete window.__qaGuidedAlphaAxis;
      delete window.__qaGuidedAlphaCameraPose;
      delete window.__qaGuidedAlphaTourStep;
    };
  }, [activeAxis, tourStep]);

  const focalLabel = useMemo(() => {
    if (!focal) return null;
    return String(focal).replace(/_/g, ' ');
  }, [focal]);

  if (!focal) {
    return (
      <div
        data-guided-alpha-view
        className="bg-[#0a1428] border border-[#1d3158] rounded-xl p-6 min-h-[420px] flex items-center justify-center"
      >
        <p className="text-gray-400 text-sm">
          Pick a focal ingredient on Step 1 to see its Affinity View.
        </p>
      </div>
    );
  }

  return (
    <div
      data-guided-alpha-view
      data-guided-alpha-focal={focal}
      className="relative bg-[#0a1428] border border-[#1d3158] rounded-xl p-3 min-h-[420px] flex flex-col items-stretch gap-3 overflow-hidden"
    >
      {/* Filter pills — single-select, drives the embedded α-mode's
          wedge axis. Mirrors the main FilterPillRow's pill style but
          uses a forked palette so Guided context stays distinct. */}
      <div
        role="group"
        aria-label="Affinity axis filter"
        className="flex items-center justify-center gap-1 flex-wrap"
      >
        {FILTER_KEYS.map((key) => {
          const active = key === activeFilter;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setActiveFilter(key)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border ${
                active
                  ? 'bg-cyan-500 border-cyan-400 text-white'
                  : 'bg-[#12121a] border-[#2a2a3a] text-gray-300 hover:bg-[#1a1a2a]'
              }`}
              style={{ minHeight: 32 }}
            >
              {FILTER_LABELS[key]}
            </button>
          );
        })}
      </div>

      {/* Embedded α-mode canvas. Phase 1: a placeholder canvas that
          carries the test contract attribute so the harness can
          confirm the mount. Phase 2 (next iteration) wires this to a
          live LivingArchView instance with α-mode pre-engaged on the
          focal and a bird's-eye camera pose. */}
      <div
        ref={canvasContainerRef}
        className="relative flex-1 min-h-[300px] rounded-lg bg-[#050912] border border-[#1d3158]/40 flex items-center justify-center overflow-hidden"
      >
        <canvas
          width={400}
          height={300}
          className="w-full h-full"
          aria-label={`Affinity view for ${focalLabel}`}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-gray-500 italic">
            α-view ({activeFilter}) — focal: {focalLabel}
          </span>
        </div>
      </div>

      {/* Tour overlay — Step 1 of the per-panel tour. Sits above the
          canvas with a translucent backdrop. Hidden after the user
          clicks "Got it" (advances to step 2). */}
      {tourStep === 1 && (
        <div
          data-guided-alpha-tour-step="1"
          className="absolute inset-x-0 bottom-4 mx-4 z-10 pointer-events-auto rounded-xl border border-cyan-500/50 bg-[#0a1428]/95 backdrop-blur-sm shadow-xl px-4 py-3 flex flex-col gap-2"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-cyan-400 text-xs font-semibold uppercase tracking-wider">
              Step 1
            </span>
            <span className="text-white text-sm font-semibold">
              Affinity View
            </span>
          </div>
          <p className="text-gray-300 text-xs leading-relaxed">
            This is the Affinity View of <strong>{focalLabel}</strong>. The
            colored cubes and rings show its strongest pairings, sorted by
            chemistry-bridged strength. Use the filter pills above to
            re-sort by aroma, taste, family, cuisine, or season.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGotIt}
              className="px-4 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {tourStep === 2 && (
        <div
          data-guided-alpha-tour-step="2"
          className="absolute inset-x-0 bottom-4 mx-4 z-10 pointer-events-auto rounded-xl border border-cyan-500/30 bg-[#0a1428]/85 backdrop-blur-sm shadow-xl px-4 py-2 flex items-center gap-2"
        >
          <span className="text-cyan-400 text-xs font-semibold uppercase tracking-wider">
            Step 2
          </span>
          <span className="text-gray-300 text-xs">
            Explore by clicking a pill, or scroll down to see why each
            pairing works.
          </span>
        </div>
      )}
    </div>
  );
}
