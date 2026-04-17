import { useEffect, useState } from 'react';

/**
 * DiscoverPatterns — replaces Molecule of the Day with a cluster-pair
 * molecular pattern discovery card. Shows a random pair of adjacent
 * flavor clusters and explains what molecular patterns they share.
 *
 * Rotates daily (same seed as MoleculeOfTheDay used).
 */

const DISMISS_KEY = 'fn.patterns.dismissed';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dismissActive() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const { date } = JSON.parse(raw);
    return date === todayKey();
  } catch { return false; }
}

function hashToIndex(seed, n) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % Math.max(1, n);
}

export default function DiscoverPatterns({ clusterExplanations, onSelectIngredient }) {
  const [dismissed, setDismissed] = useState(() => dismissActive());

  if (dismissed || !clusterExplanations?.pairs?.length) return null;

  const pairs = clusterExplanations.pairs;
  const idx = hashToIndex(todayKey(), pairs.length);
  const pair = pairs[idx];
  const clA = clusterExplanations.clusters?.[pair.cluster_a];
  const clB = clusterExplanations.clusters?.[pair.cluster_b];

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: todayKey() })); } catch {}
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 z-40 bg-[#0d0d16]/95 border border-purple-500/40 rounded-lg shadow-xl backdrop-blur-sm">
      <div className="flex justify-between items-start p-3 border-b border-[#2a2a3a]">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-purple-400">Discover Patterns</div>
          <div className="text-sm font-semibold text-white">
            {clA?.label || '?'} + {clB?.label || '?'}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1"
          aria-label="Dismiss"
        >×</button>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-xs text-gray-300">{pair.explanation}</p>
        {pair.shared_compounds?.length > 0 && (
          <div className="space-y-1">
            {pair.shared_compounds.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="text-cyan-300 font-medium">{c.name}</span>
                <span className="text-gray-500">{c.tags?.slice(0, 2).join(', ')}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 text-[10px] text-gray-500 mt-1">
          <span>Try from {clA?.label}:</span>
          {(clA?.top_ingredients || []).slice(0, 2).map((n) => (
            <button
              key={n}
              onClick={() => onSelectIngredient?.(n)}
              className="text-cyan-400/70 hover:text-cyan-300 underline"
            >{n}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
