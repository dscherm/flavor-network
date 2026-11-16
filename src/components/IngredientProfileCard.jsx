/**
 * IngredientProfileCard — dark chalkboard Tinder card for a single recipe
 * suggestion (add) or substitution (replace).
 *
 * Aesthetic matches PairingModeCard: near-black slate chalkboard wash, double
 * chalk-rail border, cream-chalk Caveat text. The HERO element is a large
 * pair of fixed flavor grids (CHART-6): the recipe now, and with this candidate
 * added/swapped, on one shared scale, with the notes that change marked and one
 * line naming the two that move most ("More creamy, less sour"). A chalk-green
 * Add/Swap pill completes the card. BeforeAfterRadar is still exported for
 * SauceSuggestionDeck.
 *
 * Pure/presentational — all data/ranking lives in SuggestionCardDeck.
 *
 * Props:
 *   name    string                       candidate ingredient name
 *   before  Record<axis, number>         recipe's current 12-axis profile
 *   delta   Record<axis, number>         per-axis shift this candidate causes
 *   movers  [{ axis, delta }]            (used by BeforeAfterRadar only)
 *   mode    'add' | 'replace'
 *   replacing string | null              swap mode: the ingredient being replaced
 *   onCommit () => void                  add/swap action
 */
import { AXES, axisColor, axisLabel } from '../data/recipeProfileAnalysis.js';
import { profilePair } from '../data/profileGridPair.js';
import FlavorGrid from './FlavorGrid.jsx';

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
 * bright accent outline) over the 12 axes, with grid rings, axis spokes,
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
  const N = axes.length;
  // AROMA-3: eleven aroma spokes. A smaller disc and label size keep the side labels (savory, toasty) inside the box.
  const radius = size * (N > 8 ? 0.26 : 0.30);
  const labelOffset = size * 0.075;
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
  const fontSize = N > 8 ? 11 : 14;
  // Side room for the longest labels (earthy, woody, savory) once there are eleven aroma spokes.
  const sidePad = N > 8 ? 22 : 0;

  return (
    <svg
      width="100%"
      viewBox={`${-sidePad} 0 ${size + 2 * sidePad} ${size}`}
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

/** One grid of the before/after pair, with a heading ("Now" / "With cinnamon"). */
function PairGrid({ title, grid, marks, labelled, testId }) {
  return (
    <div className="flex-1 min-w-0">
      <FlavorGrid title={title} grid={grid} marks={marks} showLabels={labelled} testId={testId} />
    </div>
  );
}

export default function IngredientProfileCard({
  name,
  before = {},
  delta = {},
  movers = [],
  mode = 'add',
  replacing = null,
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

  const pair = profilePair(before, delta);
  const afterTitle = mode === 'replace' && replacing ? `With ${name} for ${replacing}` : `With ${name}`;

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

      {/* HERO before/after: two fixed grids on ONE scale, so an unchanged note is the same size in both and a dot
          that grows really is stronger. Only the "With" grid carries marks: cells that change by more than MARK_THRESHOLD get a ring and a caret. */}
      <figure className="w-full m-0" aria-labelledby="ingredient-card-caption" data-testid="ingredient-card-pair">
        <div className="w-full flex items-start gap-x-3">
          <PairGrid title="Now" grid={pair.before} marks={null} labelled={pair.labelled} testId="ingredient-card-grid-before" />
          <PairGrid title={afterTitle} grid={pair.after} marks={pair.marks} labelled={pair.labelledAfter} testId="ingredient-card-grid-after" />
        </div>
        <figcaption
          id="ingredient-card-caption"
          data-testid="ingredient-card-caption"
          className="text-center mt-2"
          style={{ fontFamily: FONT_HAND, fontSize: 'clamp(17px, 3.4vw, 24px)', color: CHALK_CREAM, textShadow: CHALK_TEXT_SHADOW }}
        >
          {pair.text}
        </figcaption>
      </figure>

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
