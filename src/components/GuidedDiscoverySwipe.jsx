/**
 * GuidedDiscoverySwipe — Phase 2 (pipeline 2026-05-16).
 *
 * Tinder-style Yes/No card flow that replaces the grid-of-bubbles
 * layout in `GuidedDiscoveryStart.jsx` for the Guided Discovery
 * path. Reuses `SwipeDeckCard` + the same chip-rendering primitives
 * the legacy grid uses.
 *
 * Differences from the legacy grid:
 *   - Cards appear one-at-a-time, centered, with Yes/No buttons.
 *   - `cocktail` + `sauce` bubbles are FILTERED OUT (per spec §2A:
 *     Guided doesn't surface lab-routing cards; those live in Build).
 *   - Ingredient card is REQUIRED — no No button. User can type
 *     their own (SearchBar) OR tap "Suggest one" to populate with
 *     one of [chicken, onion, basil, vanilla] at random.
 *   - When the deck completes, `onComplete(bubbleStack)` fires the
 *     same way the legacy "Show me pairings" CTA did.
 *
 * Constraint #4: bubbleStack is LOCAL state. Never call setFilterStack
 * from here. The only escape is `onComplete` → parent's hand-off
 * into GuidedDiscoveryResults.
 */
import { useCallback, useMemo, useState } from 'react';
import { BUBBLE_REGISTRY, SEASON_VALUES, MEAT_VALUES } from '../data/guidedDiscovery.js';
import { DIETARY_RESTRICTIONS } from '../data/dietaryFilters.js';
import { CATEGORICAL_AXES } from '../data/categoricalAxes.js';
import {
  SEASON_ICON_BY_KEY,
  MEAT_ICON_BY_KEY,
  CUISINE_ICON_BY_LABEL,
  AROMA_ICON_BY_LABEL,
  DIETARY_ICON_BY_KEY,
  SEASON_CHIP_COLOR,
  MEAT_CHIP_COLOR,
  AROMA_CHIP_COLOR,
  CUISINE_CHIP_COLOR,
  DIETARY_CHIP_COLOR,
} from './guidedIcons.jsx';
import SearchBar from './SearchBar.jsx';
import SwipeDeckCard from './SwipeDeckCard.jsx';

const SUGGESTION_POOL = ['chicken', 'onion', 'basil', 'vanilla'];

// Cards EXCLUDED from the Guided deck (spec §2A — these only show in
// the Build path).
const GUIDED_EXCLUDED_KEYS = new Set(['cocktail', 'sauce']);

const CUISINE_BUCKET_LABELS = CATEGORICAL_AXES.cuisine.labels;
const AROMA_BUCKET_LABELS = CATEGORICAL_AXES.aromas.labels;

function ChipButton({ label, active, color, Icon, onClick, capitalize = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 pl-2.5 pr-4 py-2 min-h-[44px] text-sm font-medium rounded-full border transition-colors ${capitalize ? 'capitalize' : ''}`}
      style={{
        background: active ? `${color}33` : 'rgba(10, 20, 40, 0.6)',
        borderColor: active ? color : 'rgba(42, 42, 58, 1)',
        color: active ? '#fff' : '#d1d5db',
      }}
    >
      {Icon && <Icon className="w-7 h-7 flex-shrink-0" style={{ color }} />}
      {label}
    </button>
  );
}

export default function GuidedDiscoverySwipe({ ingredients = [], onComplete }) {
  const [bubbleStack, setBubbleStack] = useState([]);

  const setBubbleValue = useCallback((key, value, label, axisHint) => {
    setBubbleStack((prev) => {
      const idx = prev.findIndex((b) => b.key === key);
      if (idx >= 0) {
        return prev.map((b, i) => (i === idx ? { ...b, value } : b));
      }
      return [...prev, { key, label, value, axisHint }];
    });
  }, []);

  const ingredientPick = useMemo(
    () => bubbleStack.find((b) => b.key === 'ingredient')?.value?.ingredient || null,
    [bubbleStack],
  );

  // Track which optional cards were said Yes-to vs No-to so the user
  // can re-open the Yes-set in a summary chip strip on completion.
  const handleSuggestRandom = useCallback(() => {
    const pick = SUGGESTION_POOL[Math.floor(Math.random() * SUGGESTION_POOL.length)];
    setBubbleValue('ingredient', { ingredient: pick }, 'Starts with a specific ingredient', null);
  }, [setBubbleValue]);

  // Build the SwipeDeckCard array from the filtered registry.
  const cards = useMemo(() => {
    const filtered = BUBBLE_REGISTRY.filter((b) => !GUIDED_EXCLUDED_KEYS.has(b.key));
    return filtered.map((bubble) => {
      const item = bubbleStack.find((b) => b.key === bubble.key);
      const card = {
        key: bubble.key,
        title: bubble.label,
        required: bubble.key === 'ingredient',
        onYes: () => {
          // For required cards (ingredient), Yes is just "next" — the
          // value is already set via the sub-view. For optional cards
          // that ARE selected, Yes is "keep". For optional cards that
          // aren't selected yet, Yes still needs a value — we leave
          // the bubble unset so the user can't "advance with Yes
          // without a value". Action is no-op here; the deck just
          // advances on the next render.
        },
        onNo: () => {
          // Remove the bubble if it was previously selected (user
          // changed their mind).
          setBubbleStack((prev) => prev.filter((b) => b.key !== bubble.key));
        },
        canAdvance: bubble.key === 'ingredient' ? !!ingredientPick : true,
        body: null,
      };

      switch (bubble.subUI) {
        case 'ingredient-search':
          card.body = (
            <div>
              <p className="text-xs text-gray-400 mb-3 text-center">
                Pick one — we'll start the wheel from here.
              </p>
              <div className="guided-search-inline relative mb-3">
                <SearchBar
                  ingredients={ingredients}
                  onSelect={(name) =>
                    setBubbleValue('ingredient', { ingredient: name }, bubble.label, null)
                  }
                />
              </div>
              <div className="flex items-center gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleSuggestRandom}
                  className="px-4 py-2 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500/30 transition-colors"
                >
                  Suggest one for me
                </button>
                {ingredientPick && (
                  <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
                    ✓ Picked <strong className="text-emerald-200">{ingredientPick}</strong>
                  </span>
                )}
              </div>
              <style>{`
                .guided-search-inline > div { position: static !important; width: 100% !important; transform: none !important; left: auto !important; top: auto !important; z-index: auto !important; }
              `}</style>
            </div>
          );
          break;
        case 'season-chips': {
          const cur = item?.value || null;
          card.body = (
            <div className="flex flex-wrap justify-center gap-2">
              {SEASON_VALUES.map((s) => (
                <ChipButton
                  key={s}
                  label={s}
                  active={cur === s}
                  color={SEASON_CHIP_COLOR[s]}
                  Icon={SEASON_ICON_BY_KEY[s]}
                  onClick={() => setBubbleValue(bubble.key, s, bubble.label, bubble.axisHint)}
                />
              ))}
            </div>
          );
          break;
        }
        case 'meat-chips': {
          const cur = item?.value || null;
          card.body = (
            <div className="flex flex-wrap justify-center gap-2">
              {MEAT_VALUES.map((m) => (
                <ChipButton
                  key={m}
                  label={m}
                  active={cur === m}
                  color={MEAT_CHIP_COLOR[m]}
                  Icon={MEAT_ICON_BY_KEY[m]}
                  onClick={() => setBubbleValue(bubble.key, m, bubble.label, bubble.axisHint)}
                />
              ))}
            </div>
          );
          break;
        }
        case 'cuisine-pills': {
          const cur = item?.value?.cuisineBucket || null;
          card.body = (
            <div className="flex flex-wrap justify-center gap-2">
              {CUISINE_BUCKET_LABELS.map((label) => (
                <ChipButton
                  key={label}
                  label={label}
                  active={cur === label}
                  color={CUISINE_CHIP_COLOR[label]}
                  Icon={CUISINE_ICON_BY_LABEL[label]}
                  capitalize={false}
                  onClick={() =>
                    setBubbleValue(bubble.key, { cuisineBucket: label }, bubble.label, bubble.axisHint)
                  }
                />
              ))}
            </div>
          );
          break;
        }
        case 'aroma-pills': {
          const cur = item?.value?.aromaBucket || null;
          card.body = (
            <div className="flex flex-wrap justify-center gap-2">
              {AROMA_BUCKET_LABELS.map((label) => (
                <ChipButton
                  key={label}
                  label={label}
                  active={cur === label}
                  color={AROMA_CHIP_COLOR[label]}
                  Icon={AROMA_ICON_BY_LABEL[label]}
                  capitalize={false}
                  onClick={() =>
                    setBubbleValue(bubble.key, { aromaBucket: label }, bubble.label, bubble.axisHint)
                  }
                />
              ))}
            </div>
          );
          break;
        }
        case 'flag-toggle': {
          const isOn = !!item;
          card.body = (
            <div className="flex justify-center">
              <ChipButton
                label={isOn ? 'Yes, dessert' : 'Mark as dessert'}
                active={isOn}
                color={DIETARY_CHIP_COLOR.vegetarian}
                Icon={null}
                onClick={() =>
                  isOn
                    ? setBubbleStack((prev) => prev.filter((b) => b.key !== bubble.key))
                    : setBubbleValue(bubble.key, true, bubble.label, null)
                }
                capitalize={false}
              />
            </div>
          );
          break;
        }
        case 'dietary-chips': {
          const cur = item?.value?.dietary || [];
          const toggle = (label) => {
            const next = cur.includes(label) ? cur.filter((r) => r !== label) : [...cur, label];
            if (next.length === 0) {
              setBubbleStack((prev) => prev.filter((b) => b.key !== bubble.key));
            } else {
              setBubbleValue(bubble.key, { dietary: next }, bubble.label, null);
            }
          };
          card.body = (
            <div>
              <p className="text-xs text-gray-400 mb-3 text-center">
                Pick one or more — combines with everything else.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {DIETARY_RESTRICTIONS.map((label) => (
                  <ChipButton
                    key={label}
                    label={label}
                    active={cur.includes(label)}
                    color={DIETARY_CHIP_COLOR[label]}
                    Icon={DIETARY_ICON_BY_KEY[label]}
                    capitalize={false}
                    onClick={() => toggle(label)}
                  />
                ))}
              </div>
            </div>
          );
          break;
        }
        default:
          card.body = (
            <p className="text-xs text-gray-500 text-center">No sub-view for this card.</p>
          );
      }
      return card;
    });
  }, [bubbleStack, ingredients, handleSuggestRandom, ingredientPick, setBubbleValue]);

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-8 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="guided-discovery-swipe"
    >
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl sm:text-3xl text-white text-center font-bold tracking-tight mb-2">
          I'm thinking about pairing that…
        </h1>
        <p className="text-sm text-[#9bb6da] text-center mb-6">
          Tap ✓ to add a card, ✗ to skip. Some you have to fill in.
        </p>
        <SwipeDeckCard
          cards={cards}
          onComplete={() => onComplete?.(bubbleStack)}
        />
      </div>
    </div>
  );
}
