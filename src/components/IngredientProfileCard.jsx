/**
 * IngredientProfileCard — dark chalkboard Tinder card for a single recipe
 * suggestion (add) or substitution (replace).
 *
 * Aesthetic matches PairingModeCard: near-black slate chalkboard wash, double
 * chalk-rail border, cream-chalk Caveat text. The HERO element is a large
 * pair of fixed flavor grids (CHART-6): the recipe now, and with this candidate
 * added/swapped, on one shared scale, with the notes that change marked and one
 * line naming the two that move most ("More creamy, less sour"). A chalk-green
 * Add/Swap pill completes the card.
 *
 * Pure/presentational — all data/ranking lives in SuggestionCardDeck.
 *
 * Props:
 *   name    string                       candidate ingredient name
 *   before  Record<axis, number>         recipe's current 12-axis profile
 *   delta   Record<axis, number>         per-axis shift this candidate causes
 *   movers  [{ axis, delta }]            (kept for callers; the grid pair takes its own movers from the delta)
 *   mode    'add' | 'replace'
 *   replacing string | null              swap mode: the ingredient being replaced
 *   onCommit () => void                  add/swap action
 */
import { profilePair } from '../data/profileGridPair.js';
import FlavorGrid from './FlavorGrid.jsx';
import { IngredientName } from './IngredientCardProvider.jsx';


import { HAND, TEXT } from '../data/chalkTheme.js';
// ── Chalkboard palette (copied from PairingModeCard) ───────────────
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_BORDER_OUTER = '#4a4a4a';
const CHALK_BORDER_INNER = '#6a6a6a';
const CHALK_CREAM = '#f5efde';
const CHALK_SUB = '#8a8478';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

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
        <span style={{ color: CHALK_SUB, fontFamily: TEXT }} className="text-base">
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
          fontFamily: HAND,
          fontSize: 'clamp(22px, 4.5vw, 38px)',
          textShadow: CHALK_TEXT_SHADOW,
          letterSpacing: '0.01em',
        }}
        data-testid="ingredient-card-name"
      >
        <IngredientName name={name} testid="deck-card-name-link" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
          {...(mode === 'replace' ? { onSwap: onCommit, swapFor: replacing || undefined } : { onAdd: onCommit })}>
          {name}
        </IngredientName>
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
          style={{ fontFamily: TEXT, fontSize: 'clamp(17px, 3.4vw, 24px)', color: CHALK_CREAM, textShadow: CHALK_TEXT_SHADOW }}
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
          fontFamily: TEXT,
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
