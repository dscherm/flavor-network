import { useState } from 'react';

/**
 * HowItWorks — modal explaining how the AI flavor network works.
 * Replaces the Training Trace tab with an accessible "?" button
 * that opens a brief, visual explanation.
 */

const TASTE_COLORS = {
  sweet: '#ff4fb8', bitter: '#9d4edd', umami: '#ffd700',
  salty: '#4f9eff', sour: '#00ffd0',
};

export default function HowItWorks({ initialOpen = false } = {}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 sm:bottom-6 right-4 z-[55] w-8 h-8 rounded-full bg-[#0a0a12]/90 backdrop-blur-md border border-[#2a2a3a] text-gray-500 hover:text-cyan-300 text-sm font-bold transition-colors"
        title="How does this work?"
        aria-label="How does the AI work"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0d0d16] border border-[#2a2a3a] rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-[#2a2a3a]">
              <h2 className="text-lg font-bold text-white">How the Flavor Network Works</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-xl">×</button>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-300">
              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">The Network</h3>
                <p>Each dot is an ingredient. Ingredients that appear together in recipes
                   are placed near each other — we analyzed <strong>2.2 million recipes</strong> from
                   RecipeNLG, plus TheMealDB and TheCocktailDB, to position
                   <strong> 3,913 ingredients</strong> with <strong>48,588 pairings</strong> between
                   them. Colors show taste profiles:</p>
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
                   bird's-eye view. Around the focal you'll see 30 chemistry-matched
                   ingredients laid out in three tiers, ranked by paired-recipe strength
                   and shared flavor compounds:</p>
                <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                  <p>★★★ — top 5, strongest pairings (closest ring)</p>
                  <p>★★ — next 10 (middle ring)</p>
                  <p>★ — next 15 (outer ring)</p>
                </div>
                <p className="mt-1 text-xs text-gray-400">Each tier has its own silhouette
                   shape so rank reads at a glance. Click any ring sphere to repivot.</p>
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
                <h3 className="text-cyan-300 font-semibold mb-1">Molecular Profile</h3>
                <p>The Details panel shows the flavor compounds an ingredient contains
                   and the AI's calibrated taste/aroma predictions. For
                   <strong> compound foods</strong> like mayonnaise or BBQ sauce — which aren't
                   single molecules — the profile is synthesized from constituent
                   ingredients and surfaced with a "Predicted from components" badge.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">What's Reliable</h3>
                <p className="text-xs text-gray-400 mb-1">v3 calibrated F1 (5-fold CV,
                   per-task threshold tuned). 9 of 11 heads beat the prior baseline.</p>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <p><strong className="text-green-400">Excellent:</strong> Sweet (0.90),
                     Sour (0.82), Bitter (0.80), Umami (0.73)</p>
                  <p><strong className="text-green-400">Strong:</strong> Fruity (0.72),
                     Fatty (0.62), Green (0.61)</p>
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
