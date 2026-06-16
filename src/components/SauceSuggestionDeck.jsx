/**
 * SauceSuggestionDeck — aroma-matched sauces for a recipe, shown as a
 * full-screen swipeable chalkboard card deck (one card per matched sauce).
 *
 * Mirrors SuggestionCardDeck's shell (dark chalkboard container, ← Back +
 * title + ×, Escape-to-close, pointer/touch swipe + ◀▶ prev/next + "N / total",
 * peek-stack). Each card shows that sauce's OWN flavor radar as a SINGLE series
 * (the sauce's profile), not a before→after delta: it reuses the named
 * BeforeAfterRadar export with `delta={}` so only the "before" polygon draws.
 *
 * Props:
 *   items          [{ item:{name,ingredients[]}, similarity, matchedAromas[] }]
 *   recipeName     string   the recipe these sauces are matched to
 *   nodes          Map      graph nodes carrying gnnProbs (fullData.graph.nodes)
 *   onSelectSauce  (name) => void   open a sauce's detail
 *   onBackToRecipe () => void       return to the recipe surface
 *   onClose        () => void       exit matches / browse all sauces
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { recipeAxisProfile, TASTE_AXES, AROMA_AXES } from '../data/recipeProfileAnalysis.js';
import { BeforeAfterRadar } from './IngredientProfileCard.jsx';

const FONT_HAND = 'Caveat, cursive';
const SWIPE_THRESHOLD = 50; // px — mirror SuggestionCardDeck / PairingMode

// ── Chalkboard palette (copied from IngredientProfileCard) ─────────
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

const EMPTY_DELTA = {}; // single-series radar → no "after" polygon

function formatAromaKey(key) {
  return String(key || '').replace(/^odor_/, '').replace(/_/g, ' ');
}

/** A captioned single-series radar (sauce profile). Responsive/clamped like
 *  IngredientProfileCard's LabeledRadar so both wheels fit side-by-side. */
function LabeledRadar({ label, profile, axes, testId }) {
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
      <BeforeAfterRadar before={profile} delta={EMPTY_DELTA} axes={axes} size={186} testId={testId} />
    </div>
  );
}

/** One sauce card: name, "matches {recipe}" / similarity %, taste + aroma
 *  radars, optional matched-aroma chips, and a chalk-green "View sauce" pill. */
function SauceCard({ name, profile, recipeName, similarity, matchedAromas, onView }) {
  const pct = typeof similarity === 'number' ? Math.round(similarity * 100) : null;
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
      data-testid="sauce-card"
      data-sauce={name}
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
        data-testid="sauce-card-name"
      >
        {name}
      </h3>

      <p
        className="text-center"
        style={{ color: CHALK_DIM, fontFamily: FONT_HAND, fontSize: 'clamp(13px, 2.8vw, 18px)', textShadow: CHALK_TEXT_SHADOW }}
      >
        matches {recipeName}{pct !== null ? ` · ${pct}%` : ''}
      </p>

      {/* Single-series flavor radars — taste + aroma shown separately. */}
      <div className="w-full flex flex-wrap justify-center items-start gap-x-3 gap-y-2">
        <LabeledRadar label="Taste" profile={profile} axes={TASTE_AXES} testId="sauce-card-radar-taste" />
        <LabeledRadar label="Aroma" profile={profile} axes={AROMA_AXES} testId="sauce-card-radar-aroma" />
      </div>

      {Array.isArray(matchedAromas) && matchedAromas.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-center">
          {matchedAromas.map((a) => (
            <span
              key={a}
              className="px-2 py-px rounded-full border"
              style={{ borderColor: CHALK_SUB, color: CHALK_DIM, fontFamily: FONT_HAND, fontSize: 'clamp(11px, 2.4vw, 14px)' }}
            >
              {formatAromaKey(a)}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={onView}
        data-testid="sauce-card-view"
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
        View sauce
      </button>
    </div>
  );
}

export default function SauceSuggestionDeck({
  items = [], recipeName = 'your recipe', nodes,
  onSelectSauce, onBackToRecipe, onClose,
}) {
  // Precompute each sauce's single-series profile from its ingredient names.
  // recipeAxisProfile already skips names without gnnProbs.
  const cards = useMemo(() => {
    return (Array.isArray(items) ? items : []).map(({ item, similarity, matchedAromas }) => ({
      name: item?.name,
      profile: recipeAxisProfile(item?.ingredients || [], nodes).scores,
      similarity,
      matchedAromas: matchedAromas || [],
    })).filter((c) => c.name);
  }, [items, nodes]);

  const [cardIdx, setCardIdx] = useState(0);
  useEffect(() => { setCardIdx(0); }, [cards]);

  const nextCard = useCallback(() => {
    setCardIdx((idx) => (idx + 1 < cards.length ? idx + 1 : idx));
  }, [cards.length]);
  const prevCard = useCallback(() => {
    setCardIdx((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);

  // Unified pointer handler (touch + mouse drag), mirroring SuggestionCardDeck.
  const dragStartRef = useRef(null);
  const dispatchSwipe = useCallback((dx, dy) => {
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) nextCard(); else prevCard();
  }, [nextCard, prevCard]);
  const onTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    dragStartRef.current = { x: t.clientX, y: t.clientY, kind: 'touch' };
  };
  const onTouchEnd = (e) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.kind !== 'touch') return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    dispatchSwipe(t.clientX - start.x, t.clientY - start.y);
  };
  const onMouseDown = (e) => {
    if (e.target?.closest?.('button')) return; // let buttons act normally
    dragStartRef.current = { x: e.clientX, y: e.clientY, kind: 'mouse' };
  };
  const onMouseUp = (e) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start || start.kind !== 'mouse') return;
    dispatchSwipe(e.clientX - start.x, e.clientY - start.y);
  };

  // Esc closes the deck.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const card = cards[cardIdx] || null;
  const peek = cards.slice(cardIdx + 1, cardIdx + 3);

  return (
    <div
      className="w-full h-full shadow-2xl"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(ellipse at center, #161616 0%, #0a0a0a 80%, #050505 100%), #0a0a0a',
      }}
      data-testid="sauce-suggestion-deck"
      data-card-idx={cardIdx}
      data-stack-size={cards.length}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1 flex-shrink-0">
        <button
          onClick={onBackToRecipe}
          data-testid="sauce-deck-back"
          aria-label="Back to recipe"
          className="min-h-[44px] px-3 rounded-lg border border-[#3a3a3a] text-[#bdb6a3] hover:text-[#f5efde] hover:bg-white/5"
          style={{ fontFamily: FONT_HAND, fontSize: 17 }}
        >
          ← Back
        </button>
        <span className="text-[13px] uppercase tracking-wider text-[#bdb6a3] text-center flex-1 px-2" style={{ fontFamily: FONT_HAND }}>
          🥣 Sauces for {recipeName}
        </span>
        <button onClick={onClose} aria-label="Close" className="min-h-[44px] text-[#8a8478] hover:text-[#f5efde] px-2 text-2xl">×</button>
      </div>

      <div className="flex flex-col items-center justify-center overflow-y-auto px-3 py-3" style={{ flex: 1 }}>
        {cards.length === 0 && (
          <p className="text-center text-base text-[#8a8478] py-6" style={{ fontFamily: FONT_HAND }}>No matched sauces to show.</p>
        )}

        {card && (
          <div className="relative flex justify-center" data-testid="sauce-card-stack">
            {peek.map((p, i) => (
              <div
                key={`peek-${p.name}`}
                aria-hidden="true"
                className="absolute top-0 w-[min(26rem,92vw)] rounded-2xl"
                style={{
                  height: '100%',
                  background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%), #0a0a0a',
                  border: '2px double #4a4a4a',
                  transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.03})`,
                  opacity: 0.5 - i * 0.15,
                  zIndex: 0,
                }}
              />
            ))}
            <div key={card.name} className="relative" style={{ zIndex: 1 }}>
              <SauceCard
                name={card.name}
                profile={card.profile}
                recipeName={recipeName}
                similarity={card.similarity}
                matchedAromas={card.matchedAromas}
                onView={() => onSelectSauce?.(card.name)}
              />
            </div>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div className="flex items-center justify-between px-4 pb-3 pt-1 flex-shrink-0 border-t border-[#3a3a3a]">
          <button
            onClick={prevCard}
            disabled={cardIdx === 0}
            data-testid="sauce-deck-prev"
            className="min-h-[44px] px-4 text-[#bdb6a3] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous sauce"
          >
            ◀
          </button>
          <span className="text-xs text-[#8a8478]">{Math.min(cardIdx + 1, cards.length)} / {cards.length}</span>
          <button
            onClick={nextCard}
            disabled={cardIdx + 1 >= cards.length}
            data-testid="sauce-deck-next"
            className="min-h-[44px] px-4 text-[#bdb6a3] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next sauce"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
