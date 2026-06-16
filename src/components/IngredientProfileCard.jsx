/**
 * IngredientProfileCard — dark chalkboard Tinder card for a single recipe
 * suggestion (add) or substitution (replace).
 *
 * Aesthetic matches PairingModeCard: near-black slate chalkboard wash, double
 * chalk-rail border, cream-chalk Caveat text. The HERO element is a large
 * BEFORE→AFTER flavor radar over the 11 taste+aroma axes: the recipe's current
 * profile (faint cream fill) vs. the profile WITH this candidate added/swapped
 * (bright accent outline). A one-line delta caption ("adds sweet ▲ · tempers
 * green ▼") and a chalk-green Add/Swap pill complete the card.
 *
 * Pure/presentational — all data/ranking lives in SuggestionCardDeck.
 *
 * Props:
 *   name    string                       candidate ingredient name
 *   before  Record<axis, number>         recipe's current 11-axis profile
 *   delta   Record<axis, number>         per-axis shift this candidate causes
 *   movers  [{ axis, delta }]            the axes that move most (for caption + dots)
 *   mode    'add' | 'replace'
 *   onCommit () => void                  add/swap action
 */
import { AXES, TASTE_AXES, AROMA_AXES, axisLabel, axisColor } from '../data/recipeProfileAnalysis.js';

const FONT_HAND = 'Caveat, cursive';

// ── Chalkboard palette (copied from PairingModeCard) ───────────────
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

// Accent for the "after" polygon — chalk-green, the same family as the Add pill.
const AFTER_STROKE = '#6ee7b7';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function axisAngle(i, n) {
  return (Math.PI * 2 * i) / n - Math.PI / 2;
}

/**
 * BeforeAfterRadar — two overlaid polygons (before = faint cream fill, after =
 * bright accent outline) over the 11 axes, with grid rings, axis spokes,
 * colored axis labels (dynamic textAnchor so long words don't clip), and dots
 * on the axes that moved most.
 */
function BeforeAfterRadar({
  before = {},
  delta = {},
  movers = [],
  axes = AXES,
  size = 220,
  testId = 'ingredient-card-radar',
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.30;
  const labelOffset = size * 0.075;
  const N = axes.length;
  const gridLevels = [0.33, 0.66, 1.0];

  const after = {};
  for (const a of axes) after[a] = clamp01((before[a] || 0) + (delta?.[a] || 0));

  const polyPoints = (vals) =>
    axes.map((a, i) => {
      const ang = axisAngle(i, N);
      const r = clamp01(vals[a] || 0) * radius;
      return `${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`;
    }).join(' ');

  const gridPoints = (level) =>
    axes.map((_, i) => {
      const ang = axisAngle(i, N);
      const r = level * radius;
      return `${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`;
    }).join(' ');

  const moverSet = new Set((movers || []).map((m) => m.axis));
  const fontSize = N > 8 ? 12 : 14;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', height: 'auto', width: '100%' }}
      role="img"
      aria-label="Flavor profile change"
      data-testid={testId}
    >
      {/* grid rings */}
      {gridLevels.map((level) => (
        <polygon
          key={`g-${level}`}
          points={gridPoints(level)}
          fill="none"
          stroke={CHALK_BORDER_INNER + '88'}
          strokeWidth={level === 1.0 ? 1 : 0.5}
        />
      ))}
      {/* axis spokes */}
      {axes.map((a, i) => {
        const ang = axisAngle(i, N);
        return (
          <line
            key={`spoke-${a}`}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(ang)}
            y2={cy + radius * Math.sin(ang)}
            stroke={CHALK_BORDER_INNER + '66'}
            strokeWidth={0.5}
          />
        );
      })}
      {/* before — faint cream fill */}
      <polygon
        points={polyPoints(before)}
        fill={CHALK_CREAM}
        fillOpacity={0.12}
        stroke={CHALK_DIM}
        strokeWidth={1}
        data-testid={`${testId}-before`}
      />
      {/* after — bright accent outline */}
      <polygon
        points={polyPoints(after)}
        fill="none"
        stroke={AFTER_STROKE}
        strokeWidth={2}
        data-testid={`${testId}-after`}
      />
      {/* dots on the axes that moved most */}
      {axes.map((a, i) => {
        if (!moverSet.has(a)) return null;
        const ang = axisAngle(i, N);
        const r = after[a] * radius;
        return (
          <circle
            key={`dot-${a}`}
            cx={cx + r * Math.cos(ang)}
            cy={cy + r * Math.sin(ang)}
            r={3}
            fill={axisColor(a)}
            stroke="#0a0a0f"
            strokeWidth={1}
          />
        );
      })}
      {/* colored axis labels with dynamic textAnchor (grow outward) */}
      {axes.map((a, i) => {
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
            fontWeight={moverSet.has(a) ? 700 : 600}
            fill={axisColor(a)}
            style={{ fontFamily: FONT_HAND, letterSpacing: '0.04em' }}
          >
            {axisLabel(a).toLowerCase()}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * A captioned radar (small chalk-caps label above the wheel). The radar is
 * sized responsively — capped by BOTH the card width (47%) AND viewport height
 * (30vh) so two wheels always sit side-by-side and fit the screen without
 * scrolling. The SVG scales with its box (viewBox), so labels scale too.
 */
function LabeledRadar({ label, before, delta, movers, axes, testId }) {
  return (
    <div
      className="flex flex-col items-center gap-0.5"
      style={{ width: 'min(46%, 44vh)', minWidth: 130 }}
    >
      <span
        className="uppercase tracking-[0.18em]"
        style={{ color: CHALK_DIM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW, fontSize: 'clamp(9px, 2.6vw, 11px)' }}
      >
        {label}
      </span>
      <BeforeAfterRadar before={before} delta={delta} movers={movers} axes={axes} size={186} testId={testId} />
    </div>
  );
}

/** One-line delta caption: "adds sweet ▲ · tempers green ▼" from movers. */
function DeltaCaption({ movers = [] }) {
  if (!Array.isArray(movers) || movers.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-x-2 gap-y-0.5 justify-center text-center"
      data-testid="ingredient-card-caption"
    >
      {movers.map((m, i) => {
        const up = m.delta >= 0;
        return (
          <span
            key={m.axis}
            className="inline-flex items-center gap-1"
            style={{ fontFamily: FONT_HAND, fontSize: 'clamp(15px, 3vw, 22px)', textShadow: CHALK_TEXT_SHADOW }}
          >
            <span style={{ color: CHALK_DIM }}>{up ? 'adds' : 'tempers'}</span>
            <span style={{ color: axisColor(m.axis) }}>
              {axisLabel(m.axis).toLowerCase()} {up ? '▲' : '▼'}
            </span>
            {i < movers.length - 1 && <span style={{ color: CHALK_SUB }}>·</span>}
          </span>
        );
      })}
    </div>
  );
}

export default function IngredientProfileCard({
  name,
  before = {},
  delta = {},
  movers = [],
  mode = 'add',
  onCommit,
}) {
  if (!name) {
    return (
      <div
        className="w-[min(26rem,92vw)] rounded-2xl flex items-center justify-center py-10"
        style={{ background: CHALK_BG, border: `2px double ${CHALK_BORDER_OUTER}` }}
        data-testid="ingredient-card-empty"
      >
        <span style={{ color: CHALK_SUB, fontFamily: FONT_HAND }} className="text-base">
          No suggestion
        </span>
      </div>
    );
  }

  return (
    <div
      className="w-[min(40rem,94vw)] rounded-2xl overflow-hidden flex flex-col items-center"
      style={{
        background: CHALK_BG,
        border: `2px double ${CHALK_BORDER_OUTER}`,
        boxShadow: `inset 0 0 0 1px ${CHALK_BORDER_INNER}55, 0 8px 24px rgba(0,0,0,0.55)`,
        maxHeight: '100%',
        padding: 'clamp(12px, 2.5vw, 22px)',
        gap: 'clamp(8px, 2vw, 16px)',
      }}
      data-testid="ingredient-card"
      data-ingredient={name}
      data-mode={mode}
    >
      <h3
        className="text-center leading-none"
        style={{
          color: CHALK_CREAM,
          fontFamily: FONT_HAND,
          fontSize: 'clamp(22px, 4.5vw, 38px)',
          textShadow: CHALK_TEXT_SHADOW,
          letterSpacing: '0.01em',
        }}
        data-testid="ingredient-card-name"
      >
        {name}
      </h3>

      <DeltaCaption movers={movers} />

      {/* HERO before→after radars — taste + aroma shown separately so each
          is readable (5 GNN tastes / 6 GNN aroma heads). */}
      <div className="w-full flex flex-wrap justify-center items-start gap-x-3 gap-y-2">
        <LabeledRadar
          label="Taste"
          before={before}
          delta={delta}
          movers={movers}
          axes={TASTE_AXES}
          testId="ingredient-card-radar-taste"
        />
        <LabeledRadar
          label="Aroma"
          before={before}
          delta={delta}
          movers={movers}
          axes={AROMA_AXES}
          testId="ingredient-card-radar-aroma"
        />
      </div>

      <button
        onClick={onCommit}
        data-testid="deck-commit"
        className="rounded-full border flex-shrink-0"
        style={{
          backgroundColor: 'rgba(16,78,51,0.55)',
          borderColor: 'rgba(110,231,183,0.45)',
          color: '#bbf7d0',
          fontFamily: FONT_HAND,
          fontSize: 'clamp(16px, 3.2vw, 22px)',
          textShadow: CHALK_TEXT_SHADOW,
          minHeight: 48,
          padding: '0 clamp(22px, 6vw, 36px)',
        }}
      >
        {mode === 'replace' ? 'Swap' : '+ Add'}
      </button>
    </div>
  );
}

export { BeforeAfterRadar };
