/**
 * SuggestionCardDeck — smart ingredient suggestions (add) / substitutions
 * (replace) for a recipe, shown as a swipeable Tinder-style card deck.
 *
 * One candidate per card, rendered as a dark chalkboard IngredientProfileCard
 * (PairingModeCard aesthetic): the candidate name, a hero before→after flavor
 * radar (the recipe's profile with this ingredient added/swapped), a one-line
 * delta caption, and an Add/Swap action. Swipe left / ◀ ▶ arrows browse the
 * deck; the swipe mechanics mirror PairingMode.jsx (unified touch + mouse drag).
 *
 * Smartness (FM-P2 set-completion model):
 *  - CUISINE-CONDITIONED — the bowl's dominant cuisine drives suggestions
 *    (pad thai → Thai → cilantro/lime/scallion, not salt/flour).
 *  - POPULARITY-DISCOUNTED — α·baseline subtraction demotes global staples.
 *  - REPLACE = same-category substitutes ranked by recipe fit (rice noodle →
 *    other noodles/rice, not condiments).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { recipeAxisProfile, profileDelta, topMovers, nodeProbs } from '../data/recipeProfileAnalysis.js';
import { deriveBowlCuisine } from '../data/deriveBowlCuisine.js';
import IngredientProfileCard from './IngredientProfileCard.jsx';
import { loadQuantityModel, predictAmountFromCtx } from '../ml/quantityRuntime.js';

const ALPHA = 0.3; // popularity-discount strength (mild — high α promotes junk)
const SWIPE_THRESHOLD = 50; // px — mirror PairingMode

let _modelPromise = null;
function getModel() {
  if (!_modelPromise) {
    _modelPromise = import('../ml/recipeRuntime.js')
      .then((m) => m.loadRecipeModel().then((model) => ({ ...m, model })))
      .catch(() => null);
  }
  return _modelPromise;
}

// Coarse cuisine regions — for replace-mode we prioritize substitutes whose
// PRIMARY cuisine matches the recipe's dominant cuisine (or its region).
// Using the primary cuisine (not the full, noisily-tagged list) keeps e.g.
// lasagna (primary Italian) out of an Asian-noodle swap even though the data
// noisily tags it Thai.
const CUISINE_REGION = {
  thai: 'asian', vietnamese: 'asian', chinese: 'asian', japanese: 'asian', korean: 'asian',
  indonesian: 'asian', malaysian: 'asian', filipino: 'asian', 'pacific islander': 'asian',
  'southeast asian': 'asian', indian: 'asian', pakistani: 'asian', 'sri lankan': 'asian',
  italian: 'european', french: 'european', spanish: 'european', greek: 'european', german: 'european',
  british: 'european', hungarian: 'european', polish: 'european', russian: 'european',
  portuguese: 'european', scandinavian: 'european',
  mexican: 'latin', 'tex-mex': 'latin', peruvian: 'latin', argentine: 'latin', brazilian: 'latin',
  caribbean: 'latin', 'cajun/creole': 'latin',
  'middle eastern': 'mideast', persian: 'mideast', lebanese: 'mideast', turkish: 'mideast',
  moroccan: 'mideast', israeli: 'mideast',
  'west african': 'african', 'south african': 'african', ethiopian: 'african', african: 'african',
  american: 'american', 'southern us': 'american', australian: 'american',
};
const cuisineRegion = (c) => CUISINE_REGION[c] || null;
function primaryCuisine(node) {
  const cs = node?.cuisines;
  if (!Array.isArray(cs) || cs.length === 0) return null;
  return (cs[0] || '').toLowerCase().replace(/ cuisine$/, '').trim() || null;
}

// Western pastas that are never sensible swaps for an Asian-style noodle.
const WRONG_FOR_NOODLE = /lasagn|macaroni|\bziti\b|rigatoni|\bpenne\b|spaghetti/i;

export default function SuggestionCardDeck({
  mode = 'add', ingredient = null, bowlNames = [], nodes, scopeFilter = null,
  candidates = null, qtyPrefill = true, headerLabel = null,
  onAdd, onSwap, onClose,
}) {
  const { scores, n } = useMemo(() => recipeAxisProfile(bowlNames, nodes), [bowlNames, nodes]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardIdx, setCardIdx] = useState(0);

  const quantityCtxRef = useRef(null);
  useEffect(() => {
    if (!qtyPrefill) return undefined;
    let c = false;
    loadQuantityModel().then((ctx) => { if (!c) quantityCtxRef.current = ctx; });
    return () => { c = true; };
  }, [qtyPrefill]);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    const bowlSet = new Set(bowlNames);

    // Injected-candidate mode: the caller (Cocktail Lab, the + Add preview)
    // supplies the candidate list, so skip the recipe set-completion model and
    // build before→after cards directly. Runs BEFORE the empty-bowl guard so
    // adding the FIRST ingredient still previews — the "before" profile is just
    // zeros, so the card shows the candidate's own profile as the "after".
    if (Array.isArray(candidates)) {
      if (!nodes) { setItems([]); setLoading(false); return () => { cancelled = true; }; }
      const out = [];
      for (const name of candidates) {
        if (bowlSet.has(name) || name === ingredient) continue;
        if (scopeFilter && !scopeFilter.has(name.toLowerCase())) continue;
        const node = nodes.get(name);
        if (!node) continue;
        let delta;
        if (mode === 'replace') {
          // Swap delta: profile with the focal removed + this candidate added.
          const observed = bowlNames.filter((x) => x !== ingredient);
          const swapped = recipeAxisProfile([...observed, name], nodes).scores;
          delta = {};
          for (const a of Object.keys(scores)) delta[a] = (swapped[a] || 0) - (scores[a] || 0);
        } else {
          delta = profileDelta(name, scores, n, nodes) || {};
        }
        out.push({ name, delta, movers: topMovers(delta, 3) });
        if (out.length >= 18) break;
      }
      setItems(out);
      setLoading(false);
      return () => { cancelled = true; };
    }

    const observed = mode === 'replace' ? bowlNames.filter((x) => x !== ingredient) : bowlNames;
    if (observed.length === 0 || !nodes) { setItems([]); setLoading(false); return undefined; }

    getModel().then((rt) => {
      if (cancelled || !rt || !rt.model) { setItems([]); setLoading(false); return undefined; }
      const cuisine = deriveBowlCuisine(bowlNames, nodes, rt.model.meta.cuisine_vocab);

      // Replace → restrict to same-category substitutes (rice noodle → grains).
      let candidateNames = null;
      if (mode === 'replace') {
        const focalCat = nodes.get(ingredient)?.category;
        if (focalCat) {
          candidateNames = [];
          for (const [nm, node] of nodes) {
            if (node?.category === focalCat && nm !== ingredient && !bowlSet.has(nm)) candidateNames.push(nm);
          }
        }
      }

      return rt.suggestIngredients(observed, { cuisine, alpha: ALPHA, k: 60, candidateNames }, rt.model)
        .then((sugg) => {
          if (cancelled) return;

          // Replace re-rank: prioritize substitutes whose primary cuisine
          // matches the recipe's dominant cuisine / region, and drop Western
          // pastas (lasagna, …) when swapping a noodle.
          let ranked = sugg;
          if (mode === 'replace') {
            const dom = (cuisine || '').toLowerCase();
            const domRegion = cuisineRegion(dom);
            const focalIsNoodle = /noodle/i.test(ingredient || '');
            ranked = sugg
              .filter((s) => !(focalIsNoodle && WRONG_FOR_NOODLE.test(s.name)))
              .map((s, idx) => {
                const pc = primaryCuisine(nodes.get(s.name));
                let aff = 0;
                if (pc && dom) {
                  if (pc === dom) aff = 2;
                  else if (domRegion && cuisineRegion(pc) === domRegion) aff = 1;
                }
                return { s, idx, aff };
              })
              .sort((a, b) => (b.aff - a.aff) || (a.idx - b.idx))
              .map((x) => x.s);
          }

          const out = [];
          for (const s of ranked) {
            if (bowlSet.has(s.name) || s.name === ingredient) continue;
            if (scopeFilter && !scopeFilter.has(s.name.toLowerCase())) continue;
            const node = nodes.get(s.name);
            if (!node) continue;
            let delta;
            if (mode === 'replace') {
              const swapped = recipeAxisProfile([...observed, s.name], nodes).scores;
              delta = {};
              for (const a of Object.keys(scores)) delta[a] = (swapped[a] || 0) - (scores[a] || 0);
            } else {
              delta = profileDelta(s.name, scores, n, nodes) || {};
            }
            out.push({ name: s.name, delta, movers: topMovers(delta, 3) });
            if (out.length >= 18) break;
          }
          setItems(out);
          setLoading(false);
        });
    }).catch(() => { if (!cancelled) { setItems([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [mode, ingredient, bowlNames, nodes, scopeFilter, candidates]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the visible card in range as the ranked deck (re)loads.
  useEffect(() => { setCardIdx(0); }, [items]);

  const commit = (name) => {
    if (mode === 'replace') { onSwap?.(ingredient, name); return; }
    const amount = (qtyPrefill && quantityCtxRef.current) ? predictAmountFromCtx(name, quantityCtxRef.current) : null;
    if (amount) onAdd?.(name, amount); else onAdd?.(name);
  };

  const nextCard = useCallback(() => {
    setCardIdx((idx) => (idx + 1 < items.length ? idx + 1 : idx));
  }, [items.length]);
  const prevCard = useCallback(() => {
    setCardIdx((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);

  // Unified pointer handler (touch + mouse drag), mirroring PairingMode:
  // a horizontal drag past the threshold flips to the next/previous card.
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

  // Esc closes the deck without adding/swapping.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const card = items[cardIdx] || null;
  // Peek-stack: a couple of cards fanned behind the top one for the Tinder feel.
  const peek = items.slice(cardIdx + 1, cardIdx + 3);

  return (
    <div
      className="w-full h-full shadow-2xl"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(ellipse at center, #161616 0%, #0a0a0a 80%, #050505 100%), #0a0a0a',
      }}
      data-testid={`suggestion-deck-${mode}`}
      data-card-idx={cardIdx}
      data-stack-size={items.length}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1 flex-shrink-0">
        <button
          onClick={onClose}
          data-testid="deck-back"
          aria-label="Back without adding"
          className="min-h-[44px] px-3 rounded-lg border border-[#3a3a3a] text-[#bdb6a3] hover:text-[#f5efde] hover:bg-white/5"
          style={{ fontFamily: 'Caveat, cursive', fontSize: 17 }}
        >
          ← Back
        </button>
        <span className="text-[13px] uppercase tracking-wider text-[#bdb6a3] text-center flex-1 px-2" style={{ fontFamily: 'Caveat, cursive' }}>
          {headerLabel || (mode === 'replace' ? `⇄ Smart swaps for ${ingredient}` : '✨ Smart suggestions')}
        </span>
        <button onClick={onClose} aria-label="Close" className="min-h-[44px] text-[#8a8478] hover:text-[#f5efde] px-2 text-2xl">×</button>
      </div>

      <div className="flex flex-col items-center justify-center overflow-y-auto px-3 py-3" style={{ flex: 1 }}>
        {loading && <p className="text-center text-base text-[#8a8478] py-6" style={{ fontFamily: 'Caveat, cursive' }}>Finding smart suggestions…</p>}
        {!loading && items.length === 0 && <p className="text-center text-base text-[#8a8478] py-6" style={{ fontFamily: 'Caveat, cursive' }}>No suggestions for this recipe yet.</p>}

        {/* Per-page title (HELP-5): label each swipeable deck page by its subject
            — the candidate name — mirroring the per-page <h3> titles in the
            Flavor Profiles carousel. The dim suffix marks the page's position. */}
        {!loading && card && (
          <h3
            data-testid="deck-page-title"
            className="text-2xl text-center mb-2 flex-shrink-0"
            style={{ fontFamily: 'Caveat, cursive', color: '#f5efde', textShadow: '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)' }}
          >
            {card.name}
            <span className="text-base ml-2" style={{ color: '#8a8478' }}>{cardIdx + 1} / {items.length}</span>
          </h3>
        )}

        {!loading && card && (
          <div className="relative flex justify-center" data-testid="suggestion-card-stack">
            {/* peek-stack behind the top card (Tinder style) */}
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
            <div
              key={card.name}
              className="relative"
              style={{ zIndex: 1 }}
              data-testid="suggestion-card"
              data-ingredient={card.name}
            >
              <IngredientProfileCard
                name={card.name}
                before={scores}
                delta={card.delta}
                movers={card.movers}
                mode={mode}
                onCommit={() => commit(card.name)}
              />
            </div>
          </div>
        )}
      </div>

      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between px-4 pb-3 pt-1 flex-shrink-0 border-t border-[#3a3a3a]">
          <button
            onClick={prevCard}
            disabled={cardIdx === 0}
            data-testid="deck-prev"
            className="min-h-[44px] px-4 text-[#bdb6a3] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous suggestion"
          >
            ◀
          </button>
          <span className="text-sm text-[#8a8478]">{Math.min(cardIdx + 1, items.length)} / {items.length}</span>
          <button
            onClick={nextCard}
            disabled={cardIdx + 1 >= items.length}
            data-testid="deck-next"
            className="min-h-[44px] px-4 text-[#bdb6a3] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next suggestion"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
