/**
 * CookbookLab — Phase 4 + F-6 (pipeline 2026-05-16).
 *
 * Renamed from RecipesLab 2026-05-29 (DOCS-RL-COOKBOOK-RENAME) to
 * disambiguate from Recipes Notebook (the authoring surface in
 * RecipeLabMobile). The shipped behavior is unchanged — just the
 * file/export/labKey/URL identity is the new canonical name.
 *
 * Two-mode browseable surface for the 15 hand-curated seed recipes:
 *   - Explore (default): 3D NetworkScene with one sphere per recipe,
 *     anchored by `position3D` on cuisine-quadrant directions. Colors
 *     are keyed by cuisine via CUISINE_COLOR. Mirrors the Cocktail
 *     and Sauce labs.
 *   - Browse: filterable card grid (v1).
 *
 * Filters: cuisine / cluster / single-ingredient search box.
 * `externalFilter` prop (from Phase 5 Build → Recipes bridge)
 * pre-selects filters on mount.
 */
import { useEffect, useMemo, useState } from 'react';
import MultiAxisRadarStack from './MultiAxisRadarStack.jsx';
import { SEED_RECIPES, CUISINE_COLOR, userRecipeToSeed } from '../data/seedRecipes.js';
import {
  FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle,
  CARD_CREAM, CARD_CREAM_EDGE, CARD_INK, CARD_INK_SUB,
} from '../data/chalkTheme.js';

// ── Kitchen line-art icons (cuisine + dish-type) ──────────────────────
function cuisineIconKind(cuisine = '') {
  const c = cuisine.toLowerCase();
  if (/italian/.test(c)) return 'leaf';
  if (/french/.test(c)) return 'whisk';
  if (/mexican/.test(c)) return 'pepper';
  if (/south asian|indian|middle eastern/.test(c)) return 'spice';
  if (/se asian|east asian|asian|thai|chinese|japanese|korean/.test(c)) return 'bowl';
  if (/personal/.test(c)) return 'heart';
  return 'fork';
}
function typeIconKind(cluster = '') {
  const c = cluster.toLowerCase();
  if (/savory|savoury/.test(c)) return 'pan';
  if (/vegetable|veg/.test(c)) return 'carrot';
  if (/bak/.test(c)) return 'bread';
  if (/seafood|fish/.test(c)) return 'fish';
  if (/personal/.test(c)) return 'heart';
  return 'dot';
}
/** Small kitchen glyph, stroked in `color`. */
function KitchenIcon({ kind, color, size = 18 }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  let inner;
  switch (kind) {
    case 'leaf': inner = (<><path d="M9 3 C4 5 4 12 9 16 C14 12 14 5 9 3 Z" {...s} /><path d="M9 4 L9 15" {...s} /></>); break;
    case 'whisk': inner = (<><path d="M9 2 L9 9" {...s} /><path d="M9 9 C5 10 5 16 9 16 C13 16 13 10 9 9" {...s} /><path d="M6.6 10.5 L7.6 15.4 M11.4 10.5 L10.4 15.4" {...s} /></>); break;
    case 'spice': inner = (<><path d="M9 2 L9 16 M2 9 L16 9 M4 4 L14 14 M14 4 L4 14" {...s} /></>); break;
    case 'bowl': inner = (<><path d="M3 8 Q9 16 15 8 Z" {...s} /><path d="M2.5 8 L15.5 8" {...s} /><path d="M11 2 L13 7.5 M13.2 2 L14.6 7.6" {...s} /></>); break;
    case 'pepper': inner = (<><path d="M6.5 4.5 C6.5 2.5 9.5 2.5 9.5 4.5" {...s} /><path d="M9.5 4.5 C13.5 5.5 14 10.5 10 14.5 C7 16.5 4 14 5 11 C6 8 7.5 6 9.5 4.5 Z" {...s} /></>); break;
    case 'heart': inner = (<path d="M9 15.5 C2 10.5 3 4 6.6 4 C8.2 4 9 5.6 9 5.6 C9 5.6 9.8 4 11.4 4 C15 4 16 10.5 9 15.5 Z" {...s} />); break;
    case 'pan': inner = (<><path d="M3 9 Q3 13.5 8 13.5 Q13 13.5 13 9 Z" {...s} /><path d="M2.5 9 L13.5 9" {...s} /><path d="M13 8.6 L17 7.6" {...s} /></>); break;
    case 'carrot': inner = (<><path d="M6 8 L10.5 16 L12.5 14 L8 6 Z" {...s} /><path d="M8 6 L6 3 M8 6 L9.2 2.4 M8 6 L11 3.8" {...s} /></>); break;
    case 'bread': inner = (<><path d="M3 12 Q3 7 9 7 Q15 7 15 12 Z" {...s} /><path d="M2.5 12 L15.5 12" {...s} /><path d="M6 9 L7 11 M9 8.6 L10 11 M12 9 L13 11" {...s} /></>); break;
    case 'fish': inner = (<><path d="M3 9 Q8 4 13 9 Q8 14 3 9 Z" {...s} /><path d="M13 9 L16.5 6 M13 9 L16.5 12" {...s} /><circle cx="6" cy="8.4" r="0.8" fill={color} stroke="none" /></>); break;
    case 'book': inner = (<><path d="M3 4 L9 4 L9 15 L3 15 Z" {...s} /><path d="M9 4 L15 4 L15 15 L9 15 Z" {...s} /><path d="M9 4 L9 15" {...s} /></>); break;
    case 'fork': inner = (<><path d="M6 16 L6 8 M4.6 2 L4.6 7 M6 2 L6 7 M7.4 2 L7.4 7 M4.6 7 Q6 8.4 7.4 7" {...s} /><path d="M12 16 L12 2 C14.2 4 14.2 8.4 12 9.2" {...s} /></>); break;
    case 'dot':
    default: inner = (<circle cx="9" cy="9" r="3.2" {...s} />); break;
  }
  return (<svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>{inner}</svg>);
}

// A recipe-box card: cream stock, ink handwriting, a cuisine color spine.
function RecipeCard({ recipe, onClick }) {
  const color = CUISINE_COLOR[recipe.cuisine] || '#94a3b8';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-stretch text-left rounded-lg p-4 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      style={{
        background: CARD_CREAM,
        backgroundImage: `linear-gradient(135deg, ${color}3a, ${color}12)`,
        border: `1px solid ${color}66`,
        boxShadow: '0 1px 2px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.25)',
      }}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg"
        style={{ background: color }}
        aria-hidden="true"
      />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-[22px] leading-tight" style={{ fontFamily: FONT, color: CARD_INK }}>{recipe.name}</h3>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ color, borderColor: `${color}99`, background: `${color}1a` }}
          >
            {recipe.cuisine}
          </span>
        </div>
        <p className="text-[13px] leading-snug mb-2" style={{ color: CARD_INK_SUB }}>{recipe.description}</p>
        <div className="flex flex-wrap gap-1">
          {recipe.ingredients.slice(0, 5).map((ing) => (
            <span
              key={ing}
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.5)', color: CARD_INK_SUB, border: `1px solid ${CARD_CREAM_EDGE}` }}
            >
              {ing}
            </span>
          ))}
          {recipe.ingredients.length > 5 && (
            <span className="text-[11px]" style={{ color: CARD_INK_SUB }}>+{recipe.ingredients.length - 5} more</span>
          )}
        </div>
      </div>
    </button>
  );
}

function RecipeDetail({ recipe, ctx, onClose, onOpenInNetwork, onOpenRecipeLab }) {
  const color = CUISINE_COLOR[recipe.cuisine] || '#94a3b8';
  const nodes = ctx?.graph?.nodes;
  // Match recipe ingredient strings to actual nodes in the ingredient
  // graph so the radar has real taste/aroma/season/etc. data to plot.
  // Only ingredients that resolve get a chip in the "matched" row;
  // unmatched ones fall to the "raw" row so the user still sees them.
  const { matched, unmatched } = useMemo(() => {
    if (!nodes) return { matched: [], unmatched: recipe.ingredients };
    const ok = [];
    const miss = [];
    for (const ing of recipe.ingredients) {
      const key = ing.toLowerCase();
      if (nodes.get(key) || nodes.get(ing)) ok.push(ing);
      else miss.push(ing);
    }
    return { matched: ok, unmatched: miss };
  }, [recipe.ingredients, nodes]);

  // Focal = first matched ingredient. The radar averages across all
  // matched ingredients so the chart reflects the whole recipe.
  const focalName = matched[0] || null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-label={`${recipe.name} details`}
    >
      <div
        className="w-full max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto"
        style={{ ...chalkSurfaceStyle(), border: `2px double ${CHALK_RAIL}`, boxShadow: `inset 0 0 0 1px ${color}33, 0 8px 24px rgba(0,0,0,0.55)`, color: CHALK_CREAM }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4" style={{ borderBottom: `1.5px solid ${color}55` }}>
          <div>
            <h2 className="text-[34px] leading-none mb-1.5" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>{recipe.name}</h2>
            <span
              className="text-[14px] px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5"
              style={{ fontFamily: FONT, color: CHALK_CREAM, borderColor: `${color}99`, background: `${color}22` }}
            >
              <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: color }} aria-hidden="true" />
              {recipe.cuisine}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none p-1"
            style={{ color: CHALK_SUB }}
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p style={{ fontFamily: FONT, fontSize: '20px', color: CHALK_DIM, lineHeight: 1.4 }}>{recipe.description}</p>

          <div>
            <div className="uppercase tracking-[0.16em] mb-2" style={{ fontFamily: FONT, fontSize: '15px', color: CHALK_DIM, textShadow: CHALK_SHADOW }}>
              Ingredients ({recipe.ingredients.length})
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1">
              {[...matched.map((n) => ({ n, ok: true })), ...unmatched.map((n) => ({ n, ok: false }))].map(({ n, ok }) => (
                <li
                  key={n}
                  className="flex items-baseline gap-2"
                  style={{ fontFamily: FONT, fontSize: '20px', color: ok ? CHALK_CREAM : CHALK_SUB }}
                  title={ok ? 'matched in the ingredient graph' : 'not found in the ingredient graph'}
                >
                  <span className="flex-shrink-0" style={{ color }}>→</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Flavor / taste / aroma / season / cuisine / method radar.
              Averaged across all matched ingredients so the chart
              reads as the recipe's profile, not just one ingredient. */}
          {focalName && nodes ? (
            <div>
              <div className="uppercase tracking-[0.16em] mb-2" style={{ fontFamily: FONT, fontSize: '15px', color: CHALK_DIM, textShadow: CHALK_SHADOW }}>
                Flavor profile
              </div>
              <MultiAxisRadarStack
                ingredients={matched}
                nodes={nodes}
                focalName={focalName}
              />
            </div>
          ) : (
            <p className="italic" style={{ fontFamily: FONT, fontSize: '16px', color: CHALK_SUB }}>
              No matched ingredients — radar unavailable.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {onOpenRecipeLab && (
              <button
                type="button"
                onClick={() => onOpenRecipeLab('recipe', recipe.ingredients)}
                className="px-4 py-2.5 rounded-lg transition-colors"
                style={{ fontFamily: FONT, fontSize: '18px', color: '#0a0a0a', background: CHALK_CREAM, border: `1px solid ${CHALK_CREAM}` }}
              >
                Open in Recipe Notebook →
              </button>
            )}
            {onOpenInNetwork && (
              <button
                type="button"
                onClick={() => onOpenInNetwork(matched[0] || recipe.ingredients[0])}
                className="px-4 py-2.5 rounded-lg transition-colors"
                style={{ fontFamily: FONT, fontSize: '18px', color: CHALK_CREAM, background: `${color}22`, border: `1px solid ${color}88` }}
              >
                Explore in Network →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Default flavor-axis filter. The "cluster" field on each recipe IS
// the flavor signal (savory / baking / seafood / vegetable). Spec §4A
// asked for a default flavor filter so the lab opens with a focused
// view, not an undifferentiated grid. "savory" wins by recipe count.
const DEFAULT_CLUSTER_FILTER = 'savory';

export default function CookbookLab({
  externalFilter = null,
  onOpenInNetwork,
  onOpenRecipeLab,
  ctx = null,
  pickerMode = null,
  onExitPickerMode,
  userRecipes = [],
}) {
  // B-version (2026-06-03): user-saved recipes appear inside the
  // cookbook as additional 3D books, normalized into SEED_RECIPES
  // shape via userRecipeToSeed. Cuisine = 'Personal' so they live in
  // their own quadrant.
  const userRecipeSeeds = useMemo(
    () => (Array.isArray(userRecipes) ? userRecipes : [])
      .map((r, i) => userRecipeToSeed(r, i)),
    [userRecipes],
  );
  const allRecipes = useMemo(
    () => [...SEED_RECIPES, ...userRecipeSeeds],
    [userRecipeSeeds],
  );
  const isMakePicker = pickerMode === 'make';
  const [cuisineFilter, setCuisineFilter] = useState(null);
  const [clusterFilter, setClusterFilter] = useState(DEFAULT_CLUSTER_FILTER);
  const [selected, setSelected] = useState(null);

  // Apply external filter on mount (Phase 5 Build → Recipes bridge).
  // When the user arrived via Build, their explicit cuisine pick is a
  // stronger signal than the default flavor filter — clear the
  // cluster default so their cuisine pick isn't intersected with it.
  useEffect(() => {
    if (isMakePicker) return;
    if (!externalFilter) return;
    if (externalFilter.cuisine) {
      setCuisineFilter(externalFilter.cuisine);
      setClusterFilter(null);
    }
    if (externalFilter.cluster) setClusterFilter(externalFilter.cluster);
  }, [externalFilter, isMakePicker]);

  const cuisines = useMemo(
    () => [...new Set(allRecipes.map((r) => r.cuisine))].sort(),
    [allRecipes],
  );
  const clusters = useMemo(
    () => [...new Set(allRecipes.map((r) => r.cluster))].sort(),
    [allRecipes],
  );

  const filtered = useMemo(
    () =>
      allRecipes.filter((r) => {
        if (cuisineFilter && r.cuisine !== cuisineFilter) return false;
        if (clusterFilter && r.cluster !== clusterFilter) return false;
        if (!isMakePicker && externalFilter?.ingredients?.length) {
          const reqs = externalFilter.ingredients.map((s) => s.toLowerCase());
          const has = r.ingredients.map((s) => s.toLowerCase());
          if (!reqs.every((req) => has.some((h) => h.includes(req) || req.includes(h)))) return false;
        }
        return true;
      }),
    [allRecipes, cuisineFilter, clusterFilter, externalFilter, isMakePicker],
  );

  // Branch on pickerMode. In Make-picker mode, card / sphere tap emits
  // a recipeHandoff per MAKE-MODE-SPEC §3.2 instead of opening the
  // detail modal. Default mode preserves the existing detail-modal flow.
  const handlePickRecipe = (r) => {
    if (!r) return;
    if (isMakePicker) {
      onOpenRecipeLab?.('recipe', r.ingredients, {
        source: 'make-cookbook',
        recipeType: r.cluster,
        title: r.name,
      });
    } else {
      setSelected(r);
    }
  };

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-6 pb-12"
      style={{ ...chalkSurfaceStyle(), color: CHALK_CREAM }}
      data-testid="recipes-lab"
    >
      <div className="w-full max-w-5xl">
        {isMakePicker && (
          <button
            type="button"
            onClick={() => onExitPickerMode?.()}
            aria-label="Back to Make"
            data-testid="cookbook-picker-breadcrumb"
            className="mb-3 inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full transition-colors"
            style={{ fontFamily: FONT, border: `1px solid ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.04)', color: CHALK_DIM }}
          >
            ← Make → Pick a recipe
          </button>
        )}
        <div className="mb-1">
          <h1 className="text-4xl sm:text-5xl text-center" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>
            Cookbook
          </h1>
        </div>
        <p className="text-center text-base mb-6" style={{ fontFamily: FONT, color: CHALK_SUB }}>
          {isMakePicker
            ? 'Pick one to start cooking'
            : '15 hand-curated dishes spanning 6 culinary traditions'}
        </p>

        {/* Filters — cuisines as cookbooks on a shelf, types as icon pills */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Cuisine cookbook shelf */}
          <div>
            <span className="text-[11px] uppercase tracking-wider" style={{ color: CHALK_SUB }}>Cuisines · swipe →</span>
            {(() => {
              const books = [{ key: null, label: 'All' }, ...cuisines.map((c) => ({ key: c, label: c }))];
              const SLOT = 88;
              const SHELF_Y = 156;
              return (
                <div className="overflow-x-auto pb-1">
                <svg viewBox={`0 -12 ${books.length * SLOT} 186`} height={176} width={Math.round(books.length * SLOT * 176 / 186)} style={{ maxWidth: 'none', display: 'block', margin: '0 auto' }} role="img" aria-label="Cuisines — cookbook shelf">
                  <title>Cuisines</title>
                  <line x1="8" y1={SHELF_Y} x2={books.length * SLOT - 8} y2={SHELF_Y} stroke={`${CHALK_DIM}cc`} strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="8" y1={SHELF_Y + 5} x2={books.length * SLOT - 8} y2={SHELF_Y + 5} stroke={`${CHALK_RAIL}99`} strokeWidth="2" strokeLinecap="round" />
                  {books.map((b, i) => {
                    const cx = 46 + i * SLOT;
                    const h = 116 + (i % 3) * 12;
                    const top = SHELF_Y - h;
                    const mid = (top + SHELF_Y) / 2;
                    const active = cuisineFilter === b.key;
                    const dim = cuisineFilter != null && !active;
                    const color = b.key ? (CUISINE_COLOR[b.key] || '#cdbf9a') : CHALK_CREAM;
                    const stroke = active ? CHALK_CREAM : color;
                    const iconKind = b.key ? cuisineIconKind(b.key) : 'book';
                    return (
                      <g key={String(b.key)} onClick={() => setCuisineFilter(active ? null : b.key)} style={{ cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity .15s' }} role="button" aria-label={b.key ? `${b.label} cuisine` : 'All cuisines'}>
                        <rect x={cx - 44} y="-12" width="88" height="180" fill="transparent" />
                        <rect x={cx - 19} y={top} width="38" height={h} rx="3" fill={color} fillOpacity={active ? 0.5 : 0.26} stroke={stroke} strokeWidth={active ? 2.6 : 1.8} strokeDasharray={active ? '0' : '5 3'} />
                        <line x1={cx - 19} y1={top + 13} x2={cx + 19} y2={top + 13} stroke={stroke} strokeWidth="1.4" strokeOpacity="0.8" />
                        <line x1={cx - 19} y1={SHELF_Y - 13} x2={cx + 19} y2={SHELF_Y - 13} stroke={stroke} strokeWidth="1.4" strokeOpacity="0.8" />
                        <g transform={`translate(${cx - 13} ${top + 6})`} pointerEvents="none"><KitchenIcon kind={iconKind} color={stroke} size={26} /></g>
                        <text transform={`rotate(-90 ${cx} ${mid + 12})`} x={cx} y={mid + 12} textAnchor="middle" fontSize="20" fontFamily="Caveat, cursive" fontWeight="700" fill={active ? CHALK_CREAM : color} textLength={h - 66} lengthAdjust="spacingAndGlyphs" pointerEvents="none">{b.label}</text>
                      </g>
                    );
                  })}
                </svg>
                </div>
              );
            })()}
          </div>
          {/* Dish-type — icon-only (no bubbles), label underneath */}
          <div>
            <span className="text-[11px] uppercase tracking-wider block text-center" style={{ color: CHALK_SUB }}>Type</span>
            <div className="flex flex-wrap items-end justify-center gap-6 mt-2">
              {[{ key: null, label: 'All', kind: 'dot' }, ...clusters.map((c) => ({ key: c, label: c, kind: typeIconKind(c) }))].map((t) => {
                const active = t.key === null ? !clusterFilter : clusterFilter === t.key;
                const color = active ? CHALK_CREAM : CHALK_DIM;
                return (
                  <button
                    key={String(t.key)}
                    type="button"
                    onClick={() => setClusterFilter(t.key)}
                    className="flex flex-col items-center gap-1 transition-opacity"
                    style={{ opacity: active ? 1 : 0.6 }}
                    aria-label={t.key ? `${t.label} dishes` : 'All types'}
                    aria-pressed={active}
                  >
                    <KitchenIcon kind={t.kind} color={color} size={84} />
                    <span
                      className="text-[19px] capitalize leading-none pb-0.5"
                      style={{ fontFamily: FONT, color, borderBottom: active ? `2px solid ${CHALK_CREAM}` : '2px solid transparent' }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-base py-12" style={{ fontFamily: FONT, color: CHALK_SUB }}>
            No recipes match your filters.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r) => (
              <RecipeCard key={r.id} recipe={r} onClick={() => handlePickRecipe(r)} />
            ))}
          </div>
        )}

        <p className="text-center text-[13px] mt-3" style={{ fontFamily: FONT, color: CHALK_SUB }}>
          Tap a card for the full recipe.
        </p>
      </div>

      {selected && (
        <RecipeDetail
          recipe={selected}
          ctx={ctx}
          onClose={() => setSelected(null)}
          onOpenInNetwork={onOpenInNetwork}
          onOpenRecipeLab={onOpenRecipeLab}
        />
      )}
    </div>
  );
}
