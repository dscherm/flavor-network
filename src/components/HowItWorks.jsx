import { useEffect, useState } from 'react';
import { FONT, CHALK_CREAM, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';

/**
 * HowItWorks — modal explaining how the AI flavor network works.
 *
 * Hybrid uncontrolled/controlled: pass `isOpen` + `onClose` for full
 * control (R20.1 — App.jsx hoists the state so the Network-tab
 * dropdown can open the modal without duplicating the floating "?"
 * button). When `isOpen` is undefined the legacy uncontrolled mode
 * stays — the floating button toggles internal state. `showButton`
 * (default true) hides the floating "?" when the parent renders its
 * own trigger (e.g. inside the Network dropdown).
 */

const TASTE_COLORS = {
  sweet: '#fb92b4', bitter: '#a78bfa', umami: '#f9a870',
  salty: '#93c5fd', sour: '#c9a330',
};

export default function HowItWorks({
  initialOpen = false,
  isOpen,
  onRequestOpen,
  onClose,
  showButton = true,
} = {}) {
  const [internalOpen, setInternalOpen] = useState(initialOpen);
  const controlled = typeof isOpen === 'boolean';
  const open = controlled ? isOpen : internalOpen;

  // Allow late initialOpen toggles to reopen the dialog when running
  // uncontrolled (App.jsx flips the flag from a menu click).
  useEffect(() => {
    if (controlled) return;
    if (initialOpen) setInternalOpen(true);
  }, [controlled, initialOpen]);

  const close = () => {
    if (controlled) onClose?.();
    else setInternalOpen(false);
  };
  const requestOpen = () => {
    if (controlled) onRequestOpen?.();
    else setInternalOpen(true);
  };

  return (
    <>
      {showButton && (
        <button
          onClick={requestOpen}
          className="fixed top-[calc(var(--nav-h)+0.5rem)] right-4 sm:top-auto sm:bottom-6 sm:right-4 z-[55] w-8 h-8 rounded-full bg-[#121212]/90 backdrop-blur-md border border-[#4a4a4a] text-[#bdb6a3] hover:text-[#f5efde] text-sm font-bold transition-colors"
          title="How does this work?"
          aria-label="How does the AI work"
        >
          ?
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" style={{ ...chalkSurfaceStyle(), border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}>
            <div className="flex justify-between items-center p-4 border-b border-[#4a4a4a]">
              <h2 className="text-2xl" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>How NeuFlavor works</h2>
              <button onClick={close} className="text-[#8a8478] hover:text-[#f5efde] text-xl">×</button>
            </div>
            <div className="p-4 space-y-4 text-sm text-[#e8e2d0]">
              <section>
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Two ways to start</h3>
                <p>A cooking companion built on real recipe data. From the opening screen you
                   pick how you want to work:</p>
                <p className="mt-2"><strong className="text-[#f5efde]">Guided Discovery</strong> —
                   you have an ingredient (or a season, cuisine, or craving) and want ideas for
                   what pairs with it, and <em>why</em>.</p>
                <p className="mt-1"><strong className="text-[#f5efde]">Make a recipe</strong> —
                   you already have a dish in mind and want to build it, see its flavor profile,
                   and get smart additions.</p>
              </section>

              <section>
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Guided Discovery</h3>
                <p>Stack what you know on a thought-bubble grid — "I'm thinking about pairing
                   that…" — an ingredient plus any of season, cuisine, aroma, or dietary needs.
                   The app surfaces hero pairings on a per-axis radar, each with a short story
                   explaining whether it ranked from <strong>recipe co-occurrence</strong>,
                   <strong> shared flavor compounds</strong>, or both. "Explore in the network →"
                   opens the full pairing map seeded with your picks.</p>
              </section>

              <section>
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Make a recipe</h3>
                <p>Start four ways: <strong className="text-[#f5efde]">from scratch</strong>,
                   <strong className="text-[#f5efde]"> from a photo</strong>,
                   <strong className="text-[#f5efde]"> from a web link</strong> (we read the page
                   and match its ingredients), or <strong className="text-[#f5efde]">from a saved
                   Cookbook recipe</strong>. Any path opens the Recipe Lab with your bowl ready
                   to build on.</p>
              </section>

              <section data-testid="howitworks-gestures">
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Explore the pairing map</h3>
                <p className="text-xs text-[#bdb6a3] mb-2">Guided's "Explore in the network →"
                   opens a 3D map where each dot is an ingredient and dots that pair often sit
                   close together. <strong className="text-[#f5efde]">Getting around</strong> — a few
                   gestures that aren't shown on screen:</p>
                <div className="text-xs text-[#bdb6a3] space-y-0.5">
                  <p><strong className="text-[#f5efde]">Drag</strong> to orbit · <strong className="text-[#f5efde]">scroll / pinch</strong> to zoom · <strong className="text-[#f5efde]">two-finger drag</strong> to pan</p>
                  <p><strong className="text-[#f5efde]">Tap a dot</strong> for its details · <strong className="text-[#f5efde]">press &amp; hold</strong> a dot to focus its pairings</p>
                  <p><strong className="text-[#f5efde]">Tap empty space</strong> (or press <strong className="text-[#f5efde]">Esc</strong>) to reset · on a keyboard, <strong className="text-[#e8e2d0]">arrow keys</strong> walk between related ingredients</p>
                </div>
                <p className="mt-2 text-xs text-[#bdb6a3]">Filter pills (Aroma, Cuisine, Season,
                   Family, Taste) <strong className="text-[#f5efde]">stack</strong> — a dot must
                   satisfy all of them to stay lit — and the <strong className="text-[#f5efde]">pull-strength</strong>
                   slider morphs the layout toward flavor poles. The <strong className="text-[#f5efde]">Particles</strong>
                   pill toggles the flowing-particle effect only.</p>
                <p className="mt-2 text-xs text-[#bdb6a3]">Taste palette:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(TASTE_COLORS).map(([t, c]) => (
                    <span key={t} className="flex items-center gap-1 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                      {t}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Where the data comes from</h3>
                <p>Pairings come from how ingredients are actually used together — we analyzed
                   <strong> 2.2 million recipes</strong> (RecipeNLG) plus TheMealDB and
                   TheCocktailDB into <strong>3,913 ingredients</strong> and tens of thousands of
                   co-occurrence pairings. A separate <strong>graph neural network</strong> reads
                   each flavor compound's molecular structure to predict <strong>taste and
                   aroma</strong> — that's what powers the flavor-profile radars (and the
                   "Predicted from components" profile on compound foods like mayonnaise).</p>
                <p className="mt-1 text-[#bdb6a3] text-xs">Honest note: the taste/aroma model is
                   reliable on sweet, sour, bitter, umami and the main aromas; salty and spicy
                   depend on mechanisms molecular structure doesn't capture well, so we leave
                   them out rather than guess.</p>
              </section>

              <section>
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Recipe Lab</h3>
                <p>A notebook where you build a dish ingredient by ingredient. The
                   <strong> Flavor Profiles</strong> card is a swipeable per-axis carousel —
                   one page per taste (sweet/sour/bitter/salty/umami) and aroma
                   (fruity/floral/green/woody/spicy/fatty) — showing the dish's score on that
                   axis, the ingredients driving it, and one-tap <strong>boost</strong> /
                   <strong> temper</strong> suggestions. <strong>✨ Suggest</strong> and
                   <strong> Smart swaps</strong> propose additions and substitutions as cards
                   with a before→after profile; a final page lists matching cocktails, sauces,
                   and similar dishes.</p>
              </section>

              <section>
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>The Labs — Cocktail, Sauce, Cookbook</h3>
                <p>Bistro-chalkboard menus. <strong>Cocktail</strong> (<strong>426 drinks</strong>)
                   groups by family with a back-bar of signature glasses and spirit bottles;
                   <strong> Sauce</strong> lays out the mother-sauce families as a specials board
                   of vessels; the <strong>Cookbook</strong> is a shelf of curated dishes. Tap
                   any card for its ingredients, method, and what it pairs with.</p>
              </section>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
