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

export default function HowItWorks() {
  const [open, setOpen] = useState(false);

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
                   are placed near each other — we analyzed <strong>2.2 million recipes</strong> to
                   learn these patterns. Colors show taste profiles:</p>
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
                <p>A <strong>graph neural network</strong> (GNN) reads the molecular structure of
                   flavor compounds — the actual atoms and bonds — and predicts what they
                   taste and smell like. It learned from 4,000+ real molecules across
                   5 taste databases.</p>
                <p className="mt-1 text-gray-400 text-xs">Think of it as teaching a computer to
                   "taste" a molecule by looking at its shape, just like your tongue's
                   receptors do.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Clusters</h3>
                <p>Ingredients naturally group into clusters — baking staples, Asian
                   aromatics, Mediterranean herbs, etc. These clusters emerge from
                   how ingredients are actually used together, not from arbitrary
                   categories.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">Molecular Profile</h3>
                <p>When you select an ingredient, the "Why it tastes this way" section
                   shows which flavor compounds it contains and what the AI predicts
                   about their taste and aroma. In the Molecule Lab, you can see 3D
                   molecular structures and tap atoms to learn about functional groups.</p>
              </section>

              <section>
                <h3 className="text-cyan-300 font-semibold mb-1">What's Reliable</h3>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <p><strong className="text-green-400">Strong:</strong> Bitter (F1: 0.74), Sweet (F1: 0.53), Fruity aroma (F1: 0.52)</p>
                  <p><strong className="text-yellow-400">Moderate:</strong> Green, Woody, Fatty aromas (F1: 0.36-0.45)</p>
                  <p><strong className="text-red-400">Limited data:</strong> Umami, Salty, Sour (need more training examples)</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
