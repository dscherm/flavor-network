/**
 * GuidedDiscoveryStart — Screen 1 of Guided Discovery (Phase 3 of the
 * consensus plan).
 *
 * Architecture / Constraint #4: bubbleStack is LOCAL state. We NEVER
 * call setFilterStack from this component. The only way bubbles flow
 * into App.jsx's network filterStack is via the `onShowPairings` CTA
 * callback — App.jsx threads the resulting bubbleStack into
 * GuidedDiscoveryResults, which (via its "Explore in the network" CTA)
 * is the canonical bridge to setFilterStack.
 *
 * Layout: sentence starter on top → stack chips (tap to remove) →
 * 8-bubble grid (each bubble wraps an EXISTING primitive: SearchBar /
 * FilterPillRow / inline chips / boolean toggle) → CTA button.
 *
 * Per Round 4 spec revision: the ingredient-search bubble keeps the
 * user on the grid after a selection. Other bubbles auto-collapse so
 * the grid stays scannable.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  BUBBLE_REGISTRY,
  SEASON_VALUES,
  MEAT_VALUES,
} from '../data/guidedDiscovery.js';
import ThoughtBubbleCard from './ThoughtBubbleCard.jsx';
import SearchBar from './SearchBar.jsx';
import { CATEGORICAL_AXES } from '../data/categoricalAxes.js';

// Inline bucket chips for the cuisine/aroma bubbles. The cuisine and
// aroma "axis" filters in the Network tab toggle which dimension is
// active; inside a bubble that has already declared the axis, the user
// needs to pick a SPECIFIC bucket value (e.g. "European", "Fruity"),
// not toggle the axis itself. Bucket labels come from
// CATEGORICAL_AXES so the cuisine/aroma chip palettes match the wheel
// + ClusterJoystick exactly.
const CUISINE_BUCKET_LABELS = CATEGORICAL_AXES.cuisine.labels;
const AROMA_BUCKET_LABELS = CATEGORICAL_AXES.aromas.labels;

// Pretty-print a bubbleStack entry's `value` for the chip strip + the
// closed-state summary chip on the disclosure card.
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

export default function GuidedDiscoveryStart({
  ingredients = [],
  onShowPairings,
}) {
  // LOCAL bubbleStack — never escapes this component except via the
  // onShowPairings callback. Constraint #4: do NOT mutate App.jsx's
  // network filterStack from here.
  const [bubbleStack, setBubbleStack] = useState([]);
  const [openBubble, setOpenBubble] = useState(null);
  // SR announcement string — reset on each mutation so the announcer
  // re-fires even when the same bubble is re-toggled.
  const [announcement, setAnnouncement] = useState('');

  const findIndex = useCallback(
    (key) => bubbleStack.findIndex((b) => b.key === key),
    [bubbleStack],
  );

  const announce = useCallback((msg) => {
    // Force a microtask change so the live region re-fires even when
    // the new announcement string matches a previous one.
    setAnnouncement('');
    setTimeout(() => setAnnouncement(msg), 0);
  }, []);

  // ---- Stack mutations ----------------------------------------------
  const addBubble = useCallback(
    (bubbleConfig, value) => {
      setBubbleStack((prev) => {
        const idx = prev.findIndex((b) => b.key === bubbleConfig.key);
        const next = idx >= 0
          ? prev.map((b, i) => (i === idx ? { ...b, value } : b))
          : [
              ...prev,
              {
                key: bubbleConfig.key,
                label: bubbleConfig.label,
                value,
                axisHint: bubbleConfig.axisHint,
              },
            ];
        announce(`Added: ${bubbleConfig.label}. ${next.length} selection${next.length === 1 ? '' : 's'}.`);
        return next;
      });
    },
    [announce],
  );

  const removeBubbleByKey = useCallback(
    (key) => {
      setBubbleStack((prev) => {
        const next = prev.filter((b) => b.key !== key);
        announce(`Removed selection. ${next.length} selection${next.length === 1 ? '' : 's'}.`);
        return next;
      });
    },
    [announce],
  );

  const toggleOpen = useCallback(
    (key) => setOpenBubble((prev) => (prev === key ? null : key)),
    [],
  );

  // ---- Per-bubble primitive renderers ------------------------------
  const renderIngredientSearch = useCallback(
    (bubbleConfig) => (
      <div className="pt-2">
        <p className="text-[11px] text-gray-400 mb-2">
          Pick one — we'll start the wheel from here.
        </p>
        <div className="relative">
          {/*
            SearchBar is a fixed-position component (top-of-screen
            absolute). Inside the bubble we wrap it in a non-fixed
            container that visually anchors the autocomplete list.
            The component itself is unchanged — we just override its
            "fixed" placement by overlaying it inline via a wrapper
            with relative positioning.
          */}
          <div className="guided-search-inline">
            <SearchBar
              ingredients={ingredients}
              onSelect={(name) => {
                addBubble(bubbleConfig, { ingredient: name });
                // Round 4 revision: keep the user on the grid after
                // an ingredient selection so they can stack more
                // context before tapping the CTA.
              }}
            />
          </div>
        </div>
        <style>{`
          .guided-search-inline > div { position: static !important; width: 100% !important; transform: none !important; left: auto !important; top: auto !important; z-index: auto !important; }
        `}</style>
      </div>
    ),
    [ingredients, addBubble],
  );

  const renderSeasonChips = useCallback(
    (bubbleConfig) => {
      const current = bubbleStack.find((b) => b.key === bubbleConfig.key)?.value || null;
      return (
        <div className="flex flex-wrap gap-2 pt-2">
          {SEASON_VALUES.map((s) => {
            const active = current === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  addBubble(bubbleConfig, s);
                  setOpenBubble(null);
                }}
                aria-pressed={active}
                className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full border capitalize transition-colors ${
                  active
                    ? 'bg-emerald-500 text-white border-emerald-400'
                    : 'bg-[#0a1428]/60 text-gray-300 border-[#2a2a3a] hover:bg-[#16284a]'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      );
    },
    [bubbleStack, addBubble],
  );

  const renderMeatChips = useCallback(
    (bubbleConfig) => {
      const current = bubbleStack.find((b) => b.key === bubbleConfig.key)?.value || null;
      return (
        <div className="flex flex-wrap gap-2 pt-2">
          {MEAT_VALUES.map((m) => {
            const active = current === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  addBubble(bubbleConfig, m);
                  setOpenBubble(null);
                }}
                aria-pressed={active}
                className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full border capitalize transition-colors ${
                  active
                    ? 'bg-emerald-500 text-white border-emerald-400'
                    : 'bg-[#0a1428]/60 text-gray-300 border-[#2a2a3a] hover:bg-[#16284a]'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      );
    },
    [bubbleStack, addBubble],
  );

  // Render inline bucket chips for the cuisine bubble. The user picks
  // a specific cuisine bucket (Italian / European / East Asian / …);
  // the resulting bubble carries `{cuisineBucket: '<label>'}` so the
  // results screen + the network-filter bridge can read it back.
  const renderCuisineChips = useCallback(
    (bubbleConfig) => {
      const current = bubbleStack.find((b) => b.key === bubbleConfig.key)?.value?.cuisineBucket || null;
      return (
        <div className="pt-2">
          <p className="text-[11px] text-gray-400 mb-2">Pick a cuisine:</p>
          <div className="flex flex-wrap gap-2">
            {CUISINE_BUCKET_LABELS.map((label) => {
              const active = current === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    addBubble(bubbleConfig, { cuisineBucket: label });
                    setOpenBubble(null);
                  }}
                  aria-pressed={active}
                  className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full border transition-colors ${
                    active
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-[#0a1428]/60 text-gray-300 border-[#2a2a3a] hover:bg-[#16284a]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      );
    },
    [bubbleStack, addBubble],
  );

  // Render inline bucket chips for the aroma bubble. Bucket labels come
  // from CATEGORICAL_AXES.aromas so the chip set matches the wheel
  // exactly (Fruity / Floral / Green / Woody / Spicy / Fatty).
  const renderAromaChips = useCallback(
    (bubbleConfig) => {
      const current = bubbleStack.find((b) => b.key === bubbleConfig.key)?.value?.aromaBucket || null;
      return (
        <div className="pt-2">
          <p className="text-[11px] text-gray-400 mb-2">Pick an aroma family:</p>
          <div className="flex flex-wrap gap-2">
            {AROMA_BUCKET_LABELS.map((label) => {
              const active = current === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    addBubble(bubbleConfig, { aromaBucket: label });
                    setOpenBubble(null);
                  }}
                  aria-pressed={active}
                  className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full border transition-colors ${
                    active
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-[#0a1428]/60 text-gray-300 border-[#2a2a3a] hover:bg-[#16284a]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      );
    },
    [bubbleStack, addBubble],
  );

  const renderScopeToggle = useCallback(
    (bubbleConfig) => {
      const isOn = bubbleStack.some((b) => b.key === bubbleConfig.key);
      return (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (isOn) {
                removeBubbleByKey(bubbleConfig.key);
              } else {
                addBubble(bubbleConfig, true);
                setOpenBubble(null);
              }
            }}
            aria-pressed={isOn}
            className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full border transition-colors ${
              isOn
                ? 'bg-emerald-500 text-white border-emerald-400'
                : 'bg-[#0a1428]/60 text-gray-300 border-[#2a2a3a] hover:bg-[#16284a]'
            }`}
          >
            {isOn ? 'On — tap to remove' : `Limit to ${bubbleConfig.key}-friendly ingredients`}
          </button>
        </div>
      );
    },
    [bubbleStack, addBubble, removeBubbleByKey],
  );

  const renderFlagToggle = useCallback(
    (bubbleConfig) => {
      const isOn = bubbleStack.some((b) => b.key === bubbleConfig.key);
      return (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (isOn) {
                removeBubbleByKey(bubbleConfig.key);
              } else {
                addBubble(bubbleConfig, true);
                setOpenBubble(null);
              }
            }}
            aria-pressed={isOn}
            className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full border transition-colors ${
              isOn
                ? 'bg-emerald-500 text-white border-emerald-400'
                : 'bg-[#0a1428]/60 text-gray-300 border-[#2a2a3a] hover:bg-[#16284a]'
            }`}
          >
            {isOn ? 'On — tap to remove' : 'Yes, this is for dessert'}
          </button>
        </div>
      );
    },
    [bubbleStack, addBubble, removeBubbleByKey],
  );

  // Map a bubble's subUI key to the renderer above.
  const renderSubUI = useCallback(
    (bubbleConfig) => {
      switch (bubbleConfig.subUI) {
        case 'ingredient-search':
          return renderIngredientSearch(bubbleConfig);
        case 'season-chips':
          return renderSeasonChips(bubbleConfig);
        case 'meat-chips':
          return renderMeatChips(bubbleConfig);
        case 'cuisine-pills':
          return renderCuisineChips(bubbleConfig);
        case 'aroma-pills':
          return renderAromaChips(bubbleConfig);
        case 'scope-toggle':
          return renderScopeToggle(bubbleConfig);
        case 'flag-toggle':
          return renderFlagToggle(bubbleConfig);
        default:
          return null;
      }
    },
    [
      renderIngredientSearch,
      renderSeasonChips,
      renderMeatChips,
      renderCuisineChips,
      renderAromaChips,
      renderScopeToggle,
      renderFlagToggle,
    ],
  );

  // ---- Stack chips (header strip) ----------------------------------
  const stackChips = useMemo(
    () =>
      bubbleStack.map((b) => ({
        key: b.key,
        label: b.label,
        summary: summarizeBubble(b),
      })),
    [bubbleStack],
  );

  const ctaDisabled = bubbleStack.length === 0;

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-8 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="guided-discovery-start"
    >
      {/* aria-live announcer (visually hidden) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="guided-aria-live"
      >
        {announcement}
      </div>

      <div className="w-full max-w-3xl">
        <h1
          id="guided-sentence-starter"
          className="text-xl sm:text-2xl text-white text-center font-light mb-4"
        >
          I'm thinking about pairing that…
        </h1>

        {/* Stack chips — tap to remove */}
        <div
          className="flex flex-wrap justify-center gap-2 mb-6 min-h-[2rem]"
          aria-label="Selected bubbles"
        >
          {stackChips.length === 0 ? (
            <span className="text-[11px] text-gray-500 italic">
              (pick one or more bubbles below)
            </span>
          ) : (
            stackChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => removeBubbleByKey(c.key)}
                aria-label={`Remove ${c.label}`}
                data-testid={`guided-stack-chip-${c.key}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 hover:bg-emerald-500/30 transition-colors min-h-[32px]"
              >
                <span className="truncate max-w-[180px]">
                  {c.label}{c.summary ? `: ${c.summary}` : ''}
                </span>
                <span aria-hidden="true" className="text-emerald-300">×</span>
              </button>
            ))
          )}
        </div>

        {/* Bubble grid — 1 col on mobile, 2 on tablet+. */}
        <div
          role="group"
          aria-labelledby="guided-sentence-starter"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8"
        >
          {BUBBLE_REGISTRY.map((bubble) => {
            const selectedItem = bubbleStack.find((b) => b.key === bubble.key);
            return (
              <ThoughtBubbleCard
                key={bubble.key}
                bubbleKey={bubble.key}
                label={bubble.label}
                selected={!!selectedItem}
                summaryChip={selectedItem ? summarizeBubble(selectedItem) : null}
                expanded={openBubble === bubble.key}
                onToggleExpand={() => toggleOpen(bubble.key)}
              >
                {renderSubUI(bubble)}
              </ThoughtBubbleCard>
            );
          })}
        </div>

        {/* CTA — disabled until bubbleStack has at least one entry. */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              // Constraint #4: forwards the local bubbleStack via the
              // callback only. Does NOT call setFilterStack here.
              // setFilterStack invocation lives in App.jsx's
              // onExploreInNetwork handler — the canonical bridge.
              if (ctaDisabled) return;
              onShowPairings?.(bubbleStack);
            }}
            disabled={ctaDisabled}
            aria-disabled={ctaDisabled}
            data-testid="guided-cta-show-pairings"
            className={`px-5 py-2.5 min-h-[44px] rounded-lg font-medium transition-colors ${
              ctaDisabled
                ? 'bg-[#1a2a4a] text-gray-500 cursor-not-allowed border border-[#1d3158]'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
            }`}
          >
            Show me pairings →
          </button>
        </div>
      </div>
    </div>
  );
}
