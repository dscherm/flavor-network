import { useEffect, useState } from 'react';

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
          className="fixed top-[calc(var(--nav-h)+0.5rem)] right-4 sm:top-auto sm:bottom-6 sm:right-4 z-[55] w-8 h-8 rounded-full bg-[#0a0a12]/90 backdrop-blur-md border border-[#2a2a3a] text-gray-500 hover:text-cyan-300 text-sm font-bold transition-colors"
          title="How does this work?"
          aria-label="How does the AI work"
        >
          ?
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0d0d16] border border-[#2a2a3a] rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-[#2a2a3a]">
              <h2 className="text-lg font-bold text-white">How the Flavor Network Works</h2>
              <button onClick={close} className="text-gray-500 hover:text-gray-300 text-xl">×</button>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-300">
              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">The Network</h3>
                <p>Each dot is an ingredient. Ingredients that appear together in recipes
                   are placed near each other — we analyzed <strong>2.2 million recipes</strong> from
                   RecipeNLG, plus TheMealDB and TheCocktailDB, to position
                   <strong> 3,913 ingredients</strong> with <strong>72,521 pairings</strong> between
                   them.</p>
                <p className="mt-2"><strong>What the colors mean depends on what you're looking at.</strong> With
                   no filter active, color shows the recipe cluster an ingredient lives in
                   (Baking, Italian, East Asian, etc.). When you tap a filter pill — Aroma,
                   Cuisine, Season, Family, or Taste — colors switch to that filter's buckets.
                   The chip at the top-left of the scene tells you which is active. The
                   3D scene morphs into wedge-shaped flavor poles when an axis is engaged —
                   each pole groups its bucket's ingredients into a vertical wedge so you
                   can fly to "all fruity ingredients" or "all spring ingredients" as one
                   spatial cluster.</p>
                <p className="mt-2 text-xs text-gray-400">Taste palette (visible when the Taste filter is active):</p>
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
                <h3 className="text-cyan-300 font-semibold mb-1">The AI Behind It</h3>
                <p>A <strong>graph neural network</strong> (GINEConv, 3 layers) reads the
                   molecular structure of flavor compounds — the actual atoms and bonds —
                   and predicts taste and aroma. It learned from
                   <strong> 19,902 unique molecules</strong> drawn from FooDB, FlavorDB,
                   ChemTastesDB v2.1, BitterDB, SuperSweetDB, FlavorNet, and FartDB,
                   trained with per-task label masking so each source only contributes
                   signal where it actually has measurements.</p>
                <p className="mt-1 text-gray-400 text-xs">Think of it as teaching a computer to
                   "taste" a molecule by looking at its shape, the way your tongue's
                   receptors do.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Clusters</h3>
                <p>Ingredients naturally group into clusters — baking staples, Asian
                   aromatics, Mediterranean herbs, etc. These clusters emerge from
                   how ingredients are actually used together, not from arbitrary
                   categories. Use the bottom fly-wheel to fly the camera to a
                   cluster and orbit it.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Affinity Rings</h3>
                <p>Click any ingredient and the camera flies in to orbit a 60° angled
                   bird's-eye view. Around the focal you'll see 30+ chemistry-matched
                   ingredients laid out in a tier-stratified pyramid, ranked by
                   paired-recipe strength and shared flavor compounds:</p>
                <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                  <p>★★★ — top 5, strongest pairings (closest tier)</p>
                  <p>★★ — next 10 (middle tier)</p>
                  <p>★ — next 15 (outer tier)</p>
                  <p>Surprising — chem-bridged pairings absent from cookbooks</p>
                </div>
                <p className="mt-1 text-xs text-gray-400">Each tier has its own silhouette
                   shape (bipyramid / cylinder / sphere / star) so rank reads at a glance.
                   Cones radiate from the focal to each affinity, color-coded by the active
                   aroma / cuisine / taste bucket, with a small fan offset for same-bucket
                   accents so they don't sit on the same plane. Click any apex to repivot.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Recipe Lab</h3>
                <p>The Labs dropdown opens a notebook-style recipe builder. Build a
                   dish from the selected ingredients and a dynamic profile radar
                   visualizes the dish across one of five axes — taste, aroma, season,
                   cuisine, or method — switchable from chips at the top. Lets you
                   answer "is this dish leaning summery, woody, or umami-heavy?" at a
                   glance. Tap "Build a recipe" from the Details panel to hand off
                   your selection.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Cocktail &amp; Sauce Labs</h3>
                <p>The Labs dropdown opens specialized 3D networks for
                   <strong> 426 cocktails</strong> and <strong>69 sauces</strong>, organized
                   by family (mother sauces, cocktail families). Each dot is shaped by
                   its family / cuisine — clusters of similar drinks or sauces emerge
                   directly from their ingredient overlaps.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Guided Discovery</h3>
                <p>Don't know where to start? The Guided tab walks you through a
                   thought-bubble grid — "I'm thinking about pairing that…" — where you
                   stack what you know (an ingredient, a season, a cuisine, dietary
                   restrictions). It then surfaces 5–10 hero pairings on a curated wheel
                   with a per-pair story explaining whether the engine ranked it from
                   recipe co-occurrence, shared compounds, or both.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Molecular Profile</h3>
                <p>The Details panel shows the flavor compounds an ingredient contains
                   and the AI's calibrated taste/aroma predictions. For
                   <strong> compound foods</strong> like mayonnaise or BBQ sauce — which aren't
                   single molecules — the profile is synthesized from constituent
                   ingredients and surfaced with a "Predicted from components" badge.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">What the spatial layout means</h3>
                <p className="text-xs text-gray-400 mb-2">The 3D positions came from a graph
                   network trained on the pairing data — they aren't arbitrary, and they aren't
                   labels we typed in. Four things you can read off the layout:</p>
                <div className="space-y-2">
                  <div className="bg-[#12121a]/60 border border-[#2a2a3a] rounded p-2">
                    <p className="text-xs"><strong className="text-cyan-200">1. Clusters land in distinct neighborhoods.</strong>
                       {' '}The seven kitchen-station clusters (Beef Station, Sweet Dairy &amp; Chocolate,
                       Cocktail Bar, Chili &amp; Heat, Baking Pantry, Baking &amp; Frosting, Savory Sauces)
                       end up in spatially separated corners — not piled at the center like the prior layout.</p>
                  </div>
                  <div className="bg-[#12121a]/60 border border-[#2a2a3a] rounded p-2">
                    <p className="text-xs"><strong className="text-cyan-200">2. The shape encodes flavor.</strong>
                       {' '}After the fact, the three axes track recognizable taste/aroma gradients:
                       savory↔sweet, heavy↔bright, cooked↔fresh. The model didn't aim for these;
                       they emerged because pairing patterns and flavor patterns rhyme.</p>
                  </div>
                  <div className="bg-[#12121a]/60 border border-[#2a2a3a] rounded p-2">
                    <p className="text-xs"><strong className="text-cyan-200">3. The shape encodes pairing.</strong>
                       {' '}The network's training objective was "predict which ingredients pair." So
                       ingredients that pair well are placed close together — distance in this space
                       <em> is</em> a pairing-affinity signal you can read with your eye.</p>
                  </div>
                  <div className="bg-[#12121a]/60 border border-[#2a2a3a] rounded p-2">
                    <p className="text-xs"><strong className="text-cyan-200">4. The shape encodes purpose.</strong>
                       {' '}Cluster names are verb-led (Smooths &amp; Sweetens, Salts &amp; Ferments,
                       Roasts &amp; Anchors) because the regions correspond to kitchen <em>actions</em>,
                       not just ingredient categories.</p>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="text-[10px] uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-300">
                    Caveats &amp; technical notes
                  </summary>
                  <div className="text-xs text-gray-400 space-y-1 mt-1 pl-2 border-l border-[#2a2a3a]">
                    <p><strong>Cluster names are post-hoc handles.</strong> The model produced
                       the partition; the names are human-written labels for what each cluster
                       contains. They're useful narrative, not ground truth.</p>
                    <p><strong>Axis labels are post-hoc interpretations.</strong> Pearson
                       correlations were computed against 64 ingredient features after training
                       (X≈savory↔sweet r=0.65, Y≈heavy↔bright r=0.54, Z≈cooked↔fresh r=0.50).
                       The axes weren't axes-of-flavor by design — they happened to align.</p>
                    <p><strong>Stability is method-specific.</strong> KMeans on these embeddings
                       is deterministic (Jaccard 0.974 across seeds). Leiden on the same
                       embeddings caps at ~0.50 Jaccard — the graph has multiple equally-valid
                       community structures, so a different clustering algorithm would surface
                       a different (but also reasonable) partition.</p>
                    <p><strong>Where the model is weakest.</strong> Salty and spicy aren't
                       surfaced anywhere because their molecular signal is unreliable — see
                       "What's Reliable" below for the per-task F1 numbers.</p>
                  </div>
                </details>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">What's Reliable</h3>
                <p className="text-xs text-gray-400 mb-1">v3 calibrated F1 (5-fold CV,
                   per-task threshold tuned). 9 of 11 heads beat the prior baseline.</p>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <p><strong className="text-green-400">Excellent:</strong> Sweet (0.90),
                     Sour (0.82), Bitter (0.80), Umami (0.73)</p>
                  <p><strong className="text-green-400">Strong:</strong> Fruity (0.72),
                     Creamy (0.62), Green (0.61)</p>
                  <p><strong className="text-yellow-400">Moderate:</strong> Woody (0.54),
                     Floral (0.52)</p>
                  <p><strong className="text-red-400">Not surfaced:</strong> Salty (0.33)
                     and Spicy (0.33) — these depend on ionic / TRPV1 mechanisms that
                     aren't fully captured by molecular structure alone, so we hide
                     them rather than show low-confidence guesses.</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
