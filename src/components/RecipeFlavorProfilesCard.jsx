/**
 * RecipeFlavorProfilesCard — dark chalkboard, swipeable per-axis flavor analysis
 * for a recipe.
 *
 * Page 0 is a Flavor map: a chalkboard radar over the 11 taste+aroma axes that
 * plots each bowl ingredient as a labeled dot positioned by its own flavor
 * (gnnProbs centroid), so a sweet ingredient sits toward the "sweet" axis.
 * Pages 1..axes.length are one per firing flavor axis (taste + aroma): the
 * recipe's score on that axis, what's driving it, a rule-based insight, and
 * model-ranked Boost/Temper ingredient suggestions (tap to add, quantity-
 * prefilled). A final Pairings page lists similar dishes (FM-DIR1) + routes to
 * Cocktail/Sauce Lab.
 *
 * Aesthetic matches IngredientProfileCard / PairingModeCard: near-black slate
 * chalkboard wash, double chalk-rail border, cream-chalk Caveat text.
 *
 * Degrades gracefully: the static analysis (map/score/drivers/insight) renders
 * even if the model / dish index fail to load — only Boost/Temper + dishes drop.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  recipeAxisProfile, recipeAxisProfileWeighted, describeRecipeProfile, axisInsight,
  axisLabel, axisColor, rankByAxisImpact, buildAxisEnhancements, nodeProbs, AXES,
} from '../data/recipeProfileAnalysis.js';
import { clusterColor } from './MakeRecipeCardsGrid.jsx';
import { loadDirectionsIndex, retrieveDirections, retrieveCookingMethods } from '../ml/directionsRuntime.js';
import { loadQuantityModel, predictAmountFromCtx } from '../ml/quantityRuntime.js';
import { deriveBowlCuisine } from '../data/deriveBowlCuisine.js';
import { computeRecipeAroma, rankByAromaSimilarity } from '../data/recipeAromaSimilarity.js';
import { recipeTakesSauce } from '../data/sauceRecommendation.js';
import HelpBubble from './HelpBubble.jsx';

const FONT = 'Caveat, cursive';

// ── Chalkboard palette (copied from IngredientProfileCard) ───────────
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_BORDER_OUTER = '#4a4a4a';
const CHALK_BORDER_INNER = '#6a6a6a';
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_SUB = '#8a8478';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

// Chalk-green pill (Boost/Temper chips + pairing names) — matches the Add pill.
const PILL_BG = 'rgba(16,78,51,0.55)';
const PILL_BORDER = 'rgba(110,231,183,0.45)';
const PILL_TEXT = '#bbf7d0';

let _modelPromise = null;
function getModel() {
  if (!_modelPromise) {
    _modelPromise = import('../ml/recipeRuntime.js')
      .then((m) => m.loadRecipeModel().then((model) => ({ ...m, model })))
      .catch(() => null);
  }
  return _modelPromise;
}
let _vocabPromise = null;
function loadRecipeVocab() {
  if (!_vocabPromise) {
    _vocabPromise = fetch('/models/recipe_vocab.json').then((r) => (r.ok ? r.json() : null)).then((j) => j?.vocab ?? null).catch(() => null);
  }
  return _vocabPromise;
}

// Cocktail / sauce item lists for aroma matching on the Pairings page —
// same data + normalization App.jsx uses for handleFindCocktail/Sauce.
let _cocktailItemsPromise = null;
function loadCocktailItems() {
  if (!_cocktailItemsPromise) {
    _cocktailItemsPromise = fetch(`${import.meta.env.BASE_URL}data/cocktail_codex_v2.json`)
      .then((r) => { if (!r.ok) throw new Error('cocktail fetch failed'); return r.json(); })
      .then((j) => (j?.cocktails || []).map((c) => ({
        ...c,
        ingredients: (c.ingredients_raw || []).map((r) => (typeof r === 'string' ? r : (r?.raw || r?.name || ''))).filter(Boolean),
      })))
      // Don't cache a network failure — reset so a later mount can retry.
      .catch(() => { _cocktailItemsPromise = null; return null; });
  }
  return _cocktailItemsPromise;
}
let _sauceItemsPromise = null;
function loadSauceItems() {
  if (!_sauceItemsPromise) {
    _sauceItemsPromise = fetch(`${import.meta.env.BASE_URL}data/sauce_augment.json`)
      .then((r) => { if (!r.ok) throw new Error('sauce fetch failed'); return r.json(); })
      .then((j) => (j?.sauces || []).map((s) => ({
        ...s,
        ingredients: (s.ingredients || []).map((i) => (typeof i === 'string' ? i : (i?.name || ''))).filter(Boolean),
      })))
      .catch(() => { _sauceItemsPromise = null; return null; });
  }
  return _sauceItemsPromise;
}

function axisAngle(i, n) {
  return (Math.PI * 2 * i) / n - Math.PI / 2;
}

/**
 * IngredientFlavorMap — a chalkboard radar over the 11 axes (grid rings, spokes,
 * colored axis labels) that plots each bowl ingredient as a labeled dot placed
 * by its own flavor centroid. Strongly single-flavored ingredients sit near
 * their dominant axis edge; balanced ones cluster center.
 *
 *   angle_i = 2π·i/11 − π/2
 *   vx = Σ p[axis_i]·cos(angle_i), vy = Σ p[axis_i]·sin(angle_i), mag = hypot(vx,vy)
 *   place at r = (mag/maxMag)·0.82·R in direction (vx,vy); center if mag≈0.
 */
function IngredientFlavorMap({ bowlNames = [], nodes, size = 320, testId = 'flavor-map-radar' }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.30;
  const labelOffset = size * 0.075;
  const N = AXES.length;
  const gridLevels = [0.33, 0.66, 1.0];

  const gridPoints = (level) =>
    AXES.map((_, i) => {
      const ang = axisAngle(i, N);
      const r = level * radius;
      return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
    }).join(' ');

  // Compute each ingredient's flavor-centroid vector, then normalize radii so
  // the strongest-flavored ingredient sits at 0.82·R.
  const placed = useMemo(() => {
    const out = [];
    let maxMag = 0;
    for (const name of (Array.isArray(bowlNames) ? bowlNames : [])) {
      const p = nodeProbs(name, nodes);
      if (!p) continue;
      let vx = 0;
      let vy = 0;
      let dom = AXES[0];
      let domV = -Infinity;
      for (let i = 0; i < N; i += 1) {
        const a = AXES[i];
        const v = p[a] || 0;
        const ang = axisAngle(i, N);
        vx += v * Math.cos(ang);
        vy += v * Math.sin(ang);
        if (v > domV) { domV = v; dom = a; }
      }
      const mag = Math.hypot(vx, vy);
      if (mag > maxMag) maxMag = mag;
      out.push({ name, vx, vy, mag, dom });
    }
    const denom = maxMag > 0 ? maxMag : 1;
    return out.map((d) => {
      const r = (d.mag / denom) * 0.82 * radius;
      const ux = d.mag > 1e-6 ? d.vx / d.mag : 0;
      const uy = d.mag > 1e-6 ? d.vy / d.mag : 0;
      return {
        ...d,
        x: cx + r * ux,
        y: cy + r * uy,
        r,
        // Push the label radially outward a touch so it doesn't sit on the dot.
        lx: cx + (r + 9) * ux,
        ly: cy + (r + 9) * uy,
        ux,
        uy,
      };
    });
  }, [bowlNames, nodes, radius, cx, cy, N]);

  const trunc = (s) => (s.length > 12 ? `${s.slice(0, 11)}…` : s);
  const fontSize = N > 8 ? 12 : 14;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', height: 'auto', width: '100%' }}
      role="img"
      aria-label="Ingredients placed by flavor"
      data-testid={testId}
    >
      {/* grid rings */}
      {gridLevels.map((level) => (
        <polygon
          key={`g-${level}`}
          points={gridPoints(level)}
          fill="none"
          stroke={`${CHALK_BORDER_INNER}88`}
          strokeWidth={level === 1.0 ? 1 : 0.5}
        />
      ))}
      {/* axis spokes */}
      {AXES.map((a, i) => {
        const ang = axisAngle(i, N);
        return (
          <line
            key={`spoke-${a}`}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(ang)}
            y2={cy + radius * Math.sin(ang)}
            stroke={`${CHALK_BORDER_INNER}66`}
            strokeWidth={0.5}
          />
        );
      })}
      {/* colored axis labels with dynamic textAnchor (grow outward) */}
      {AXES.map((a, i) => {
        const ang = axisAngle(i, N);
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const tx = cx + (radius + labelOffset) * cosA;
        const ty = cy + (radius + labelOffset) * sinA;
        const textAnchor = cosA > 0.15 ? 'start' : cosA < -0.15 ? 'end' : 'middle';
        const dominantBaseline = sinA > 0.55 ? 'hanging' : sinA < -0.55 ? 'auto' : 'middle';
        return (
          <text
            key={`lbl-${a}`}
            x={tx}
            y={ty}
            textAnchor={textAnchor}
            dominantBaseline={dominantBaseline}
            fontSize={fontSize}
            fontWeight={600}
            fill={axisColor(a)}
            style={{ fontFamily: FONT, letterSpacing: '0.04em' }}
          >
            {axisLabel(a).toLowerCase()}
          </text>
        );
      })}
      {/* ingredient dots + truncated labels */}
      {placed.map((d) => {
        const anchor = d.ux > 0.15 ? 'start' : d.ux < -0.15 ? 'end' : 'middle';
        return (
          <g key={`ing-${d.name}`} data-testid="flavor-map-ingredient" data-ingredient={d.name}>
            <circle cx={d.x} cy={d.y} r={4} fill={axisColor(d.dom)} stroke="#0a0a0f" strokeWidth={1} />
            <text
              x={d.lx}
              y={d.ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={11}
              fill={CHALK_CREAM}
              style={{ fontFamily: FONT, textShadow: CHALK_TEXT_SHADOW }}
            >
              {trunc(d.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Chalk-green pill: a Boost/Temper suggestion chip (tap adds, qty-prefilled). */
function Chip({ name, delta, onTap }) {
  return (
    <button
      onClick={() => onTap(name)}
      className="flex-shrink-0 inline-flex items-center gap-1 px-3 rounded-full border whitespace-nowrap"
      style={{
        minHeight: 40, paddingTop: 5, paddingBottom: 5,
        background: PILL_BG, borderColor: PILL_BORDER, color: PILL_TEXT,
        fontFamily: FONT, fontSize: 16, textShadow: CHALK_TEXT_SHADOW,
      }}
      title={`Add ${name}`}
    >
      {name}{typeof delta === 'number' ? <span className="text-[10px]" style={{ color: PILL_TEXT, opacity: 0.8 }}>+{(delta).toFixed(2)}</span> : null}
    </button>
  );
}

/**
 * EnhanceCard — a compact Make-a-Recipe-style ingredient mini-card (chalkboard
 * card + cluster-colored hero disc + Caveat name) for the Enhance page's
 * "More {axis}? Try…" / "tone down" buckets. Tap adds the ingredient
 * (quantity-prefilled by the caller).
 */
function EnhanceCard({ name, node, onTap }) {
  const ch = (name || '?').trim().charAt(0).toUpperCase();
  const fill = clusterColor(node);
  return (
    <button
      type="button"
      onClick={() => onTap(name)}
      data-testid={`enhance-card-${name}`}
      className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 hover:brightness-110 transition-all"
      style={{
        width: 96, minHeight: 104,
        background: CHALK_BG,
        border: '2px double #4a4a4a',
        boxShadow: 'inset 0 0 0 1px #6a6a6a55, 0 4px 12px rgba(0,0,0,0.45)',
      }}
      title={`Add ${name}`}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{ width: 38, height: 38, backgroundColor: fill, boxShadow: `0 0 10px ${fill}66`, color: '#0a0a0f', fontSize: 19, fontWeight: 700, fontFamily: FONT }}
        aria-hidden="true"
      >
        {ch}
      </span>
      <span
        className="text-center leading-tight"
        style={{ color: CHALK_CREAM, fontFamily: FONT, fontSize: 15, lineHeight: 1.05, textShadow: CHALK_TEXT_SHADOW }}
      >
        {name}
      </span>
    </button>
  );
}

/**
 * FlavorBarChart — Overview page: a ranked horizontal bar chart of the recipe's
 * flavor composition. `scores` are the quantity-weighted per-axis means; each
 * row's % is that axis's share of the total flavor signal, and the bar length is
 * scaled to the strongest axis so the chart fills the width. Axes that don't
 * fire are hidden to avoid a wall of empty bars.
 */
function FlavorBarChart({ scores }) {
  const rows = useMemo(() => {
    const vals = AXES.map((a) => ({ axis: a, v: Math.max(0, scores[a] || 0) }));
    const total = vals.reduce((s, r) => s + r.v, 0);
    const shown = vals.filter((r) => r.v > 0.01).sort((x, y) => y.v - x.v);
    const maxV = shown.length ? shown[0].v : 1;
    return shown.map((r) => ({
      ...r,
      share: total > 0 ? r.v / total : 0,
      width: maxV > 0 ? (r.v / maxV) * 100 : 0,
    }));
  }, [scores]);

  if (rows.length === 0) {
    return <p className="text-sm py-2" style={{ fontFamily: FONT, color: CHALK_SUB }}>No flavor signal yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2" data-testid="profiles-overview-bars">
      {rows.map((r) => (
        <div key={r.axis} className="flex items-center gap-2" data-testid="overview-bar" data-axis={r.axis}>
          <span
            className="text-base capitalize flex-shrink-0 text-right"
            style={{ fontFamily: FONT, color: axisColor(r.axis), width: 84, textShadow: CHALK_TEXT_SHADOW }}
          >
            {axisLabel(r.axis)}
          </span>
          <div className="h-3 rounded-full flex-1" style={{ background: '#222' }}>
            <div
              className="h-3 rounded-full transition-all"
              style={{ width: `${Math.max(2, r.width)}%`, background: axisColor(r.axis) }}
            />
          </div>
          <span className="text-sm flex-shrink-0 tabular-nums" style={{ fontFamily: FONT, color: CHALK_DIM, width: 36 }}>
            {Math.round(r.share * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RecipeFlavorProfilesCard({ bowlNames = [], bowlEntries = null, nodes, recipeType = null, onAdd, onFindCocktail, onFindSauce, onClose }) {
  const { scores, drivers, n } = useMemo(() => recipeAxisProfile(bowlNames, nodes), [bowlNames, nodes]);

  // Overview page: quantity-weighted flavor composition. Prefer BowlEntry[]
  // (carries entered/inferred amounts); fall back to equal-weighted names.
  const overview = useMemo(
    () => recipeAxisProfileWeighted(
      (Array.isArray(bowlEntries) && bowlEntries.length) ? bowlEntries : bowlNames,
      nodes,
    ),
    [bowlEntries, bowlNames, nodes],
  );

  // Firing axes (score above a small floor), strongest first.
  const axes = useMemo(
    () => AXES.filter((a) => scores[a] > 0.08).sort((x, y) => scores[y] - scores[x]),
    [scores],
  );

  const [candidates, setCandidates] = useState([]); // model pool that fits the recipe
  const [dishes, setDishes] = useState([]);
  const [cookingMethod, setCookingMethod] = useState(null); // dominant likely method (FP-OV-5)
  const [cocktailMatches, setCocktailMatches] = useState([]); // aroma-matched cocktail names
  const [sauceMatches, setSauceMatches] = useState([]);       // aroma-matched sauce names
  const quantityCtxRef = useRef(null);
  const swipeStartRef = useRef(null); // touch-swipe between carousel pages

  // computeRecipeAroma / rankByAromaSimilarity want a plain {name: node} lookup
  // (node.gnnProbs), but `nodes` is a Map — convert once per nodes change.
  const nodesObj = useMemo(() => (nodes ? Object.fromEntries(nodes) : null), [nodes]);

  // Rule-based, on-device chef description of the weighted profile (no LLM/API).
  // The top aroma-match (cocktail, else sauce) feeds the optional pairing line.
  const description = useMemo(() => {
    const best = cocktailMatches[0] || sauceMatches[0] || null;
    const aromaMatch = best ? { name: best.item?.name, similarity: best.similarity } : null;
    return describeRecipeProfile({ scores: overview.scores, drivers, n }, { aromaMatch, cookingMethod });
  }, [overview.scores, drivers, n, cocktailMatches, sauceMatches, cookingMethod]);

  useEffect(() => {
    let cancelled = false;
    loadQuantityModel().then((ctx) => { if (!cancelled) quantityCtxRef.current = ctx; });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (bowlNames.length === 0 || !nodes) return undefined;
    let cancelled = false;
    getModel().then((rt) => {
      if (cancelled || !rt || !rt.model) return undefined;
      const cuisine = deriveBowlCuisine(bowlNames, nodes, rt.model.meta.cuisine_vocab);
      return rt.suggestIngredients(bowlNames, { cuisine, alpha: 0.3, k: 80 }, rt.model).then((sugg) => {
        if (cancelled) return;
        const bowlSet = new Set(bowlNames);
        setCandidates(sugg.map((s) => s.name).filter((nm) => !bowlSet.has(nm) && nodes.get(nm)));
      });
    }).catch(() => {});
    // dishes
    Promise.all([loadDirectionsIndex(), loadRecipeVocab()]).then(([idx, vocab]) => {
      if (cancelled || !idx || !vocab) return;
      const recs = retrieveDirections(bowlNames, idx, vocab, { k: 4, minOverlap: 2 });
      setDishes(recs.map((r) => r.title));
      // Likely preparation method, grounded in similar-recipe directions (FP-OV-5).
      const { methods } = retrieveCookingMethods(bowlNames, idx, vocab, { k: 8, topN: 1 });
      setCookingMethod(methods[0]?.method ?? null);
    }).catch(() => {});
    // aroma-matched cocktail + sauce NAMES for the Pairings page
    const recipeVec = nodesObj ? computeRecipeAroma(bowlNames, nodesObj) : null;
    if (recipeVec) {
      loadCocktailItems().then((items) => {
        if (cancelled || !items) return;
        setCocktailMatches(rankByAromaSimilarity(recipeVec, items, nodesObj, 4));
      }).catch(() => {});
      loadSauceItems().then((items) => {
        if (cancelled || !items) return;
        setSauceMatches(rankByAromaSimilarity(recipeVec, items, nodesObj, 4));
      }).catch(() => {});
    } else {
      setCocktailMatches([]);
      setSauceMatches([]);
    }
    return () => { cancelled = true; };
  }, [bowlNames, nodes, nodesObj]);

  const [page, setPage] = useState(0);
  // Pages: 0 Overview · 1 Flavor map · 2..axes.length+1 per-axis · Enhance · Pairings.
  const totalPages = axes.length + 4;

  // First-open swipe hint (HELP-5): a one-time nudge that the card is a
  // multi-page deck. Shown until the user navigates or ~4.5s elapse; the
  // localStorage flag keeps it from reappearing on later opens.
  const [showSwipeHint, setShowSwipeHint] = useState(() => {
    try { return !localStorage.getItem('fn-fpcard-swipe-hint-seen'); } catch { return false; }
  });
  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try { localStorage.setItem('fn-fpcard-swipe-hint-seen', '1'); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (!showSwipeHint) return undefined;
    const t = setTimeout(dismissSwipeHint, 4500);
    return () => clearTimeout(t);
  }, [showSwipeHint]);
  // Any page change means they've discovered navigation — retire the hint.
  useEffect(() => { if (page !== 0) dismissSwipeHint(); }, [page]);
  const isOverview = page === 0;
  const isMap = page === 1;
  const isEnhance = page === axes.length + 2;
  const isPairings = page >= axes.length + 3;

  const addWithQty = (name) => {
    const amount = quantityCtxRef.current ? predictAmountFromCtx(name, quantityCtxRef.current) : null;
    if (amount) onAdd?.(name, amount); else onAdd?.(name);
  };

  // Per-axis pages occupy indices 2..axes.length+1 → axis = axes[page - 2].
  const axis = (!isOverview && !isMap && !isEnhance && !isPairings) ? axes[page - 2] : undefined;
  const boost = axis ? rankByAxisImpact(candidates, axis, scores, n, nodes, { mode: 'boost', topN: 4 }) : [];
  const temper = axis ? rankByAxisImpact(candidates, axis, scores, n, nodes, { mode: 'temper', topN: 3 }) : [];

  // Enhance page: per-axis "More {axis}? Try…" boost + "tone down" temper buckets
  // across every firing axis (model candidate pool; empty until the model loads).
  const enhanceRows = useMemo(
    () => (isEnhance ? buildAxisEnhancements(axes, candidates, scores, n, nodes) : []),
    [isEnhance, axes, candidates, scores, n, nodes],
  );

  // Touch-swipe between carousel pages (left = next page, right = previous).
  const goPage = (delta) => setPage((p) => Math.max(0, Math.min(totalPages - 1, p + delta)));
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (t) swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const s = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches?.[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return; // ignore vertical scrolls
    goPage(dx < 0 ? 1 : -1);
  };

  // Esc closes without changing the bowl (mirrors SuggestionCardDeck).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="w-full h-full shadow-2xl flex flex-col"
      style={{ height: '100%', background: CHALK_BG, border: `2px double ${CHALK_BORDER_OUTER}`, boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)` }}
      data-testid="flavor-profiles-card"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1 flex-shrink-0">
        <button
          onClick={onClose}
          data-testid="profiles-back"
          aria-label="Back"
          className="min-h-[44px] px-3 rounded-lg border border-[#3a3a3a] hover:bg-white/5"
          style={{ fontFamily: FONT, fontSize: 17, color: CHALK_DIM }}
        >
          ← Back
        </button>
        <span className="text-[13px] uppercase tracking-wider text-center flex-1 px-2" style={{ fontFamily: FONT, color: CHALK_DIM }}>Flavor Profiles</span>
        <div className="flex items-center gap-0.5">
          <HelpBubble
            variant="chalk"
            placement="bottom"
            testId="profiles-help"
            label="About Flavor Profiles"
            title="Flavor Profiles"
            body={[
              'Swipe left/right — or tap ◀ ▶ or the dots — to move between pages.',
              'Pages: Overview, a flavor map, one per flavor axis, Enhance, and Pairings.',
              'On the axis and Enhance pages, tap a Boost or Temper chip to add it (amount prefilled).',
            ]}
          />
          <button onClick={onClose} aria-label="Close" className="min-h-[44px] px-2 text-2xl" style={{ color: CHALK_SUB }}>×</button>
        </div>
      </div>

      <div className="px-4 pb-2 overflow-y-auto" style={{ flex: 1 }}>
        {n === 0 && <p className="text-base py-6 text-center" style={{ fontFamily: FONT, color: CHALK_SUB }}>Add ingredients with flavor data to see profiles.</p>}

        {n > 0 && isOverview && (
          <div data-testid="profiles-overview">
            <h3 className="text-2xl mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_TEXT_SHADOW }}>Overview</h3>
            <p className="text-sm mb-2" style={{ fontFamily: FONT, color: CHALK_DIM }}>
              {overview.weighted ? 'Flavor balance, weighted by amount' : 'Flavor balance — add amounts to weight it'}
            </p>
            <FlavorBarChart scores={overview.scores} />
            <p
              className="text-base mt-3"
              data-testid="profiles-description"
              style={{ fontFamily: FONT, color: CHALK_CREAM, lineHeight: 1.45, textShadow: CHALK_TEXT_SHADOW }}
            >
              {description}
            </p>
          </div>
        )}

        {n > 0 && isMap && (
          <div className="flex flex-col items-center">
            <h3 className="text-2xl self-start mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_TEXT_SHADOW }}>Flavor map</h3>
            <div style={{ width: 'min(100%, 60vh)' }}>
              <IngredientFlavorMap bowlNames={bowlNames} nodes={nodes} />
            </div>
            <p className="text-sm mt-1 text-center" style={{ fontFamily: FONT, color: CHALK_DIM }}>Each ingredient placed by its flavor</p>
          </div>
        )}

        {!isMap && !isPairings && axis && (
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl capitalize" style={{ fontFamily: FONT, color: axisColor(axis), textShadow: CHALK_TEXT_SHADOW }}>{axisLabel(axis)}</h3>
              <span className="text-sm" style={{ color: CHALK_DIM }}>{Math.round(scores[axis] * 100)}%</span>
            </div>
            {/* score bar */}
            <div className="h-2 rounded-full mt-1 mb-2" style={{ background: '#2a2a2a' }}>
              <div className="h-2 rounded-full" style={{ width: `${Math.min(100, scores[axis] * 100)}%`, background: axisColor(axis) }} />
            </div>
            {drivers[axis]?.length > 0 && (
              <p className="text-sm mb-1" style={{ fontFamily: FONT, color: CHALK_DIM }}>
                Driven by: <span style={{ color: CHALK_CREAM }}>{drivers[axis].join(', ')}</span>
              </p>
            )}
            <p className="text-base mb-2" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{axisInsight(axis, scores[axis])}</p>

            {boost.length > 0 && (
              <div className="mb-1.5">
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: CHALK_SUB }}>Boost</p>
                <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {boost.map((b) => <Chip key={`b-${b.name}`} name={b.name} delta={b.delta} onTap={addWithQty} />)}
                </div>
              </div>
            )}
            {temper.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: CHALK_SUB }}>Temper / balance</p>
                <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {temper.map((t) => <Chip key={`t-${t.name}`} name={t.name} onTap={addWithQty} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {n > 0 && isEnhance && (
          <div data-testid="profiles-enhance">
            <h3 className="text-2xl mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_TEXT_SHADOW }}>Enhance</h3>
            {enhanceRows.length === 0 ? (
              <p className="text-base py-4" style={{ fontFamily: FONT, color: CHALK_SUB }}>
                Tap-to-add suggestions appear here once the recipe model has loaded.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {enhanceRows.map(({ axis: a, boost: bst, temper: tmp }) => (
                  <div key={`enh-${a}`} data-testid="enhance-axis" data-axis={a}>
                    {bst.length > 0 && (
                      <>
                        <p className="text-base mb-1" style={{ fontFamily: FONT, color: axisColor(a), textShadow: CHALK_TEXT_SHADOW }}>
                          More {axisLabel(a).toLowerCase()}? Try…
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                          {bst.map((b) => <EnhanceCard key={`eb-${a}-${b.name}`} name={b.name} node={nodes?.get?.(b.name)} onTap={addWithQty} />)}
                        </div>
                      </>
                    )}
                    {tmp.length > 0 && (
                      <>
                        <p className="text-[11px] uppercase tracking-wider mt-1.5 mb-1" style={{ color: CHALK_SUB }}>
                          Tone down {axisLabel(a).toLowerCase()}
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                          {tmp.map((t) => <EnhanceCard key={`et-${a}-${t.name}`} name={t.name} node={nodes?.get?.(t.name)} onTap={addWithQty} />)}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isPairings && (
          <div>
            <h3 className="text-2xl mb-2" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_TEXT_SHADOW }}>Pairs well with</h3>
            {dishes.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: CHALK_SUB }}>🍽 Similar dishes</p>
                <ul className="text-base" style={{ fontFamily: FONT, color: CHALK_CREAM }}>
                  {dishes.map((d) => <li key={d}>· {d}</li>)}
                </ul>
              </div>
            )}
            {/* 🍸 Cocktails — aroma-matched names; tap deep-links to the
                Cocktail Lab. Falls back to the generic button if no matches. */}
            {onFindCocktail && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: CHALK_SUB }}>🍸 Cocktails</p>
                {cocktailMatches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="pairings-cocktail-names">
                    {cocktailMatches.map(({ item, similarity }) => (
                      <button
                        key={item.name}
                        onClick={onFindCocktail}
                        className="min-h-[40px] px-3 rounded-full border"
                        style={{ fontFamily: FONT, fontSize: 16, background: PILL_BG, borderColor: PILL_BORDER, color: PILL_TEXT, textShadow: CHALK_TEXT_SHADOW }}
                        title={`${Math.round((similarity || 0) * 100)}% aroma match — open in Cocktail Lab`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button onClick={onFindCocktail} className="min-h-[44px] px-4 rounded-full border" style={{ fontFamily: FONT, fontSize: 16, background: PILL_BG, borderColor: PILL_BORDER, color: PILL_TEXT, textShadow: CHALK_TEXT_SHADOW }}>🍸 Find cocktails</button>
                )}
              </div>
            )}

            {/* 🥣 Sauces — gated by recipeTakesSauce; aroma-matched names. */}
            {onFindSauce && recipeTakesSauce(recipeType) && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: CHALK_SUB }}>🥣 Sauces</p>
                {sauceMatches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="pairings-sauce-names">
                    {sauceMatches.map(({ item, similarity }) => (
                      <button
                        key={item.name}
                        onClick={onFindSauce}
                        className="min-h-[40px] px-3 rounded-full border"
                        style={{ fontFamily: FONT, fontSize: 16, background: PILL_BG, borderColor: PILL_BORDER, color: PILL_TEXT, textShadow: CHALK_TEXT_SHADOW }}
                        title={`${Math.round((similarity || 0) * 100)}% aroma match — open in Sauce Lab`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button onClick={onFindSauce} className="min-h-[44px] px-4 rounded-full border" style={{ fontFamily: FONT, fontSize: 16, background: PILL_BG, borderColor: PILL_BORDER, color: PILL_TEXT, textShadow: CHALK_TEXT_SHADOW }}>🥣 Find sauces</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showSwipeHint && totalPages > 1 && n > 0 && (
        <div
          data-testid="profiles-swipe-hint"
          className="text-center pb-1 flex-shrink-0 animate-pulse"
          style={{ fontFamily: FONT, fontSize: 15, color: CHALK_SUB }}
        >
          ◀ swipe or tap ▶ to explore every flavor page
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 pb-3 pt-1 flex-shrink-0 border-t border-[#3a3a3a]">
          <button onClick={() => goPage(-1)} disabled={page === 0} className="min-h-[44px] px-4 disabled:opacity-30" style={{ color: CHALK_DIM }} aria-label="Previous">◀</button>
          <div className="flex items-center gap-1.5" data-testid="profiles-page-dots" role="tablist" aria-label="Flavor Profiles pages">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                role="tab"
                aria-selected={i === page}
                aria-label={i === 0 ? 'Overview page' : i === 1 ? 'Flavor map page' : i === axes.length + 2 ? 'Enhance page' : i === axes.length + 3 ? 'Pairings page' : `Axis page ${i}`}
                className="rounded-full transition-all"
                style={{
                  width: i === page ? 9 : 7,
                  height: i === page ? 9 : 7,
                  background: i === page ? CHALK_CREAM : CHALK_BORDER_INNER,
                }}
              />
            ))}
          </div>
          <button onClick={() => goPage(1)} disabled={page >= totalPages - 1} className="min-h-[44px] px-4 disabled:opacity-30" style={{ color: CHALK_DIM }} aria-label="Next">▶</button>
        </div>
      )}
    </div>
  );
}
