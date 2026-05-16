/**
 * BuildRecipeStart — Phase 5 (pipeline 2026-05-16).
 *
 * Same SwipeDeckCard flow as GuidedDiscoverySwipe with three key
 * differences:
 *   1. ALL 9 bubble cards (incl. cocktail + sauce, which Guided
 *      filters out).
 *   2. Ingredient card supports MULTI-SELECT (chips accumulate, user
 *      taps "Add another" to keep stacking, then ✓ to advance).
 *   3. Picking the cocktail or sauce card sets a routing hint that
 *      BuildRecipeResults consumes to skip directly to that lab.
 *
 * Output: `bubbleStack` with one of:
 *   - { key: 'ingredients', value: { ingredients: string[] } }
 *   - { key: 'cocktail', value: true }    (routing hint)
 *   - { key: 'sauce', value: true }       (routing hint)
 *   - plus the usual season/cuisine/aroma/meat/dessert/dietary bubbles
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUBBLE_REGISTRY, SEASON_VALUES, MEAT_VALUES } from '../data/guidedDiscovery.js';
import { DIETARY_RESTRICTIONS } from '../data/dietaryFilters.js';
import { CATEGORICAL_AXES } from '../data/categoricalAxes.js';
import {
  SEASON_ICON_BY_KEY,
  MEAT_ICON_BY_KEY,
  CUISINE_ICON_BY_LABEL,
  AROMA_ICON_BY_LABEL,
  DIETARY_ICON_BY_KEY,
  CocktailHeaderIcon,
  SauceHeaderIcon,
  SEASON_CHIP_COLOR,
  MEAT_CHIP_COLOR,
  AROMA_CHIP_COLOR,
  CUISINE_CHIP_COLOR,
  DIETARY_CHIP_COLOR,
} from './guidedIcons.jsx';
import SearchBar from './SearchBar.jsx';
import SwipeDeckCard from './SwipeDeckCard.jsx';

const CUISINE_BUCKET_LABELS = CATEGORICAL_AXES.cuisine.labels;
const AROMA_BUCKET_LABELS = CATEGORICAL_AXES.aromas.labels;

// First-card category options. 'sauce' and 'cocktail' short-circuit
// the rest of the deck and route the user directly into the matching
// lab. 'meal' and 'dessert' continue through the deck.
const CATEGORY_OPTIONS = [
  { key: 'meal',     label: 'Meal',     color: '#22c55e' },
  { key: 'dessert',  label: 'Dessert',  color: '#ec4899' },
  { key: 'sauce',    label: 'Sauce',    color: '#fbbf24' },
  { key: 'cocktail', label: 'Cocktail', color: '#a78bfa' },
];

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

export default function BuildRecipeStart({ ingredients = [], onComplete }) {
  const [bubbleStack, setBubbleStack] = useState([]);
  // Latch so the sauce/cocktail short-circuit effect only fires once.
  const shortCircuitedRef = useRef(false);

  const setBubbleValue = useCallback((key, value, label, axisHint) => {
    setBubbleStack((prev) => {
      const idx = prev.findIndex((b) => b.key === key);
      if (idx >= 0) {
        return prev.map((b, i) => (i === idx ? { ...b, value } : b));
      }
      return [...prev, { key, label, value, axisHint }];
    });
  }, []);

  const removeBubble = useCallback((key) => {
    setBubbleStack((prev) => prev.filter((b) => b.key !== key));
  }, []);

  // Set the category bubble — if sauce/cocktail, also set the
  // matching routing bubble so BuildRecipeResults short-circuits to
  // the right lab.
  const pickCategory = useCallback((catKey) => {
    setBubbleStack((prev) => {
      // Drop any prior category + routing bubbles so re-picking
      // doesn't accumulate stale state.
      const cleaned = prev.filter((b) => !['category', 'cocktail', 'sauce', 'dessert'].includes(b.key));
      const next = [...cleaned, {
        key: 'category',
        label: 'Making',
        value: catKey,
        axisHint: null,
      }];
      if (catKey === 'sauce') {
        next.push({ key: 'sauce', label: 'Is for a sauce', value: true, axisHint: 'sauce-scope' });
      } else if (catKey === 'cocktail') {
        next.push({ key: 'cocktail', label: 'Is for a cocktail', value: true, axisHint: 'cocktail-scope' });
      } else if (catKey === 'dessert') {
        next.push({ key: 'dessert', label: 'Is for a dessert', value: true, axisHint: null });
      }
      return next;
    });
  }, []);

  const categoryPick = useMemo(
    () => bubbleStack.find((b) => b.key === 'category')?.value || null,
    [bubbleStack],
  );

  // Sauce or cocktail picks short-circuit straight to the results
  // page (which then routes to the right lab). One-shot via ref.
  useEffect(() => {
    if (shortCircuitedRef.current) return;
    if (categoryPick === 'sauce' || categoryPick === 'cocktail') {
      shortCircuitedRef.current = true;
      // Defer to the next tick so the bubble-set commit lands first.
      const t = setTimeout(() => onComplete?.(bubbleStack), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [categoryPick, bubbleStack, onComplete]);

  const ingredientList = useMemo(
    () => bubbleStack.find((b) => b.key === 'ingredient')?.value?.ingredients || [],
    [bubbleStack],
  );

  const addIngredient = useCallback((name) => {
    setBubbleStack((prev) => {
      const idx = prev.findIndex((b) => b.key === 'ingredient');
      const cur = idx >= 0 ? prev[idx].value?.ingredients || [] : [];
      if (cur.includes(name)) return prev;
      const next = [...cur, name];
      const entry = {
        key: 'ingredient',
        label: 'Starts with specific ingredients',
        value: { ingredients: next },
        axisHint: null,
      };
      if (idx >= 0) return prev.map((b, i) => (i === idx ? entry : b));
      return [...prev, entry];
    });
  }, []);

  const removeIngredient = useCallback((name) => {
    setBubbleStack((prev) => {
      const idx = prev.findIndex((b) => b.key === 'ingredient');
      if (idx < 0) return prev;
      const next = (prev[idx].value?.ingredients || []).filter((n) => n !== name);
      if (next.length === 0) return prev.filter((b) => b.key !== 'ingredient');
      return prev.map((b, i) => (i === idx ? { ...b, value: { ingredients: next } } : b));
    });
  }, []);

  const cards = useMemo(() => {
    // Spec-driven card order: category first (with sauce/cocktail
    // short-circuit), then optional shape-the-recipe filters, then
    // ingredient picker LAST. cocktail+sauce bubbles are excluded
    // because the category card handles their routing.
    const SKIP_KEYS = new Set(['cocktail', 'sauce']);
    const FILTER_ORDER = ['season', 'cuisine', 'meat', 'aroma', 'dessert', 'dietary'];
    const byKey = new Map(BUBBLE_REGISTRY.filter((b) => !SKIP_KEYS.has(b.key)).map((b) => [b.key, b]));
    const ordered = [];
    // 1. Category card (synthetic — not in BUBBLE_REGISTRY).
    ordered.push({
      key: 'category',
      title: "Are you thinking about making a…",
      required: true,
      canAdvance: !!categoryPick,
      onYes: () => {},
      onNo: () => {},
      body: (
        <div>
          <p className="text-xs text-gray-400 mb-3 text-center">
            Pick one. Sauce or Cocktail jumps straight to its lab.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <ChipButton
                key={opt.key}
                label={opt.label}
                active={categoryPick === opt.key}
                color={opt.color}
                Icon={null}
                onClick={() => pickCategory(opt.key)}
                capitalize={false}
              />
            ))}
          </div>
        </div>
      ),
    });
    // 2. Shape-the-recipe filters in spec order (dessert flag is
    // already set if category=dessert; user can still toggle others).
    for (const key of FILTER_ORDER) {
      const bubble = byKey.get(key);
      if (!bubble) continue;
      ordered.push(buildBubbleCard(bubble));
    }
    // 3. Ingredient picker LAST.
    const ingredientBubble = byKey.get('ingredient');
    if (ingredientBubble) ordered.push(buildBubbleCard(ingredientBubble));
    return ordered;

    function buildBubbleCard(bubble) {
      const item = bubbleStack.find((b) => b.key === bubble.key);
      const card = {
        key: bubble.key,
        title: bubble.label,
        required: bubble.key === 'ingredient',
        canAdvance: bubble.key === 'ingredient' ? ingredientList.length > 0 : true,
        onYes: () => {},
        onNo: () => removeBubble(bubble.key),
        body: null,
      };

      switch (bubble.subUI) {
        case 'ingredient-search':
          card.title = 'Which ingredients?';
          card.body = (
            <div>
              <p className="text-xs text-gray-400 mb-3 text-center">
                Add as many as you like — we'll find pairings across them.
              </p>
              <div className="guided-search-inline relative mb-3">
                <SearchBar
                  ingredients={ingredients}
                  onSelect={(name) => addIngredient(name)}
                />
              </div>
              {ingredientList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center mb-2">
                  {ingredientList.map((ing) => (
                    <span
                      key={ing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-400/40"
                    >
                      {ing}
                      <button
                        type="button"
                        onClick={() => removeIngredient(ing)}
                        aria-label={`Remove ${ing}`}
                        className="text-emerald-300 hover:text-rose-300 leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-500 text-center">
                {ingredientList.length === 0
                  ? 'Pick at least one ingredient to continue.'
                  : `${ingredientList.length} ingredient${ingredientList.length === 1 ? '' : 's'} selected — tap ✓ when done.`}
              </p>
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
                  isOn ? removeBubble(bubble.key) : setBubbleValue(bubble.key, true, bubble.label, null)
                }
                capitalize={false}
              />
            </div>
          );
          break;
        }
        case 'scope-toggle': {
          // Cocktail / Sauce — routing hint card.
          const isOn = !!item;
          const isCocktail = bubble.key === 'cocktail';
          const Icon = isCocktail ? CocktailHeaderIcon : SauceHeaderIcon;
          const color = isCocktail ? '#a78bfa' : '#fbbf24';
          card.body = (
            <div className="flex flex-col items-center gap-3">
              <div style={{ color }}>
                <Icon className="w-20 h-20" />
              </div>
              <p className="text-xs text-gray-400 text-center max-w-sm">
                {isCocktail
                  ? "Tap ✓ to skip the radar and jump straight into the Cocktail Lab with your filters applied."
                  : "Tap ✓ to skip the radar and jump straight into the Sauce Lab with your filters applied."}
              </p>
              <ChipButton
                label={isOn ? 'Selected — tap ✓ to continue' : `Build a ${isCocktail ? 'cocktail' : 'sauce'}`}
                active={isOn}
                color={color}
                Icon={null}
                onClick={() =>
                  isOn ? removeBubble(bubble.key) : setBubbleValue(bubble.key, true, bubble.label, null)
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
            if (next.length === 0) removeBubble(bubble.key);
            else setBubbleValue(bubble.key, { dietary: next }, bubble.label, null);
          };
          card.body = (
            <div>
              <p className="text-xs text-gray-400 mb-3 text-center">Pick one or more.</p>
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
          card.body = <p className="text-xs text-gray-500 text-center">No sub-view.</p>;
      }
      return card;
    }
  }, [bubbleStack, ingredients, ingredientList, categoryPick, pickCategory, addIngredient, removeIngredient, setBubbleValue, removeBubble]);

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-8 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="build-recipe-start"
    >
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl sm:text-3xl text-white text-center font-bold tracking-tight mb-2">
          Tell us what you're building.
        </h1>
        <p className="text-sm text-[#9bb6da] text-center mb-6">
          Stack as many filters as you like. ✓ keeps, ✗ skips.
        </p>
        <SwipeDeckCard
          cards={cards}
          onComplete={() => onComplete?.(bubbleStack)}
        />
      </div>
    </div>
  );
}
