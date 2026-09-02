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
  onExploreNetwork,
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
        <div data-testid="howitworks-overlay" className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ zIndex: 200 }}>
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
                <p className="mt-2"><strong className="text-[#f5efde]">The Labs</strong> —
                   explore: open the Cocktail, Sauce, Cookbook, Recipe-Notebook, and
                   <em> Pairing</em> labs and roam how ingredients fit together.</p>
                <p className="mt-1"><strong className="text-[#f5efde]">Make a recipe</strong> —
                   you already have a dish in mind and want to build it, see its flavor profile,
                   and get smart additions.</p>
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
                <p className="text-xs text-[#bdb6a3] mb-2">The flavor network — open it from the
                   card below, or "See in the network →" inside the Pairing Lab — is a 3D map
                   where each dot is an ingredient and dots that pair often sit close together.
                   <strong className="text-[#f5efde]"> Getting around</strong> — a few gestures
                   that aren't shown on screen:</p>
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
                   TheCocktailDB into <strong>3,891 ingredients</strong> and tens of thousands of
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
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>The Labs</h3>
                <p>The <strong className="text-[#f5efde]">Labs</strong> tile opens a panel of
                   kitchens. <strong>Cocktail</strong> (<strong>426 drinks</strong>) groups by
                   family with a back-bar of signature glasses and spirit bottles;
                   <strong> Sauce</strong> lays out the mother-sauce families as a specials board
                   of vessels; the <strong>Cookbook</strong> is a shelf of curated dishes; and the
                   <strong> Recipe Notebook</strong> is the hand-built recipe surface (also reached
                   from "Make a recipe"). Tap any card for its ingredients, method, and pairings.</p>
                <p className="mt-2"><strong className="text-[#f5efde]">Pairing Lab</strong> — stand
                   on one ingredient and see its strongest partners as a little map. Twist the
                   <em> lens</em> (Aroma · Taste · Cuisine · Season) and the same partners regroup
                   and recolor; line thickness shows pairing strength, and solid vs. dashed shows
                   whether it comes from shared chemistry or culinary tradition. Tap a partner to
                   re-center on it, or press-and-hold any node (or the center) for its full card —
                   pair strength, the shared aroma compounds, and a flavor radar. 🎲 Surprise swaps
                   in cross-family partners, and "See in the network →" zooms out to the full 3D map.</p>
              </section>

              <section>
                <h3 className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Explore the flavor network</h3>
                <p>Everything above is built on one map: a network of every ingredient, linked by
                   how often they meet in real recipes and the flavor compounds they share. Open it
                   to roam the whole graph.</p>
                <button
                  type="button"
                  data-testid="howitworks-explore-network"
                  onClick={() => { close(); onExploreNetwork?.(); }}
                  className="mt-2 w-full rounded-lg overflow-hidden border text-left transition-colors hover:bg-white/5"
                  style={{ borderColor: CHALK_RAIL, background: 'rgba(10,10,10,0.5)' }}
                  aria-label="Open the flavor network"
                >
                  <svg viewBox="0 0 320 92" className="w-full block" style={{ height: 'auto' }} aria-hidden="true">
                    {(() => {
                      const nodes = [
                        [40, 50, '#ff4fb8'], [95, 26, '#00ffd0'], [120, 66, '#ffd700'],
                        [170, 40, '#4f9eff'], [210, 70, '#9d4edd'], [250, 30, '#ff8c42'],
                        [288, 56, '#6bcb77'],
                      ];
                      const links = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [5, 6], [4, 6]];
                      return (
                        <>
                          {links.map(([a, b], i) => (
                            <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
                              stroke="rgba(245,239,222,0.28)" strokeWidth="1" />
                          ))}
                          {nodes.map(([x, y, c], i) => (
                            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 6 : 4.5} fill={c}
                              stroke="rgba(245,239,222,0.6)" strokeWidth="1" />
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span style={{ fontFamily: FONT, color: CHALK_CREAM, fontSize: 18 }}>Open the flavor network</span>
                    <span style={{ color: '#bdb6a3' }}>→</span>
                  </div>
                </button>
              </section>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
