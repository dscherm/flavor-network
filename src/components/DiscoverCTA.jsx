import { useMemo, useState } from 'react';
import { pickPairing } from '../utils/discoverPick.js';

const TASTE_OPTIONS = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'pungent', 'spicy', 'astringent'];

const DISMISS_KEY = 'fn.discover.dismissed';

function dismissActiveToday() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const { date } = JSON.parse(raw);
    return date === new Date().toISOString().slice(0, 10);
  } catch { return false; }
}

export default function DiscoverCTA({ edges, nodes, onPickPair }) {
  const [dismissed, setDismissed] = useState(() => dismissActiveToday());
  const [kind, setKind] = useState('surprise');
  const [tasteValue, setTasteValue] = useState('sweet');
  const [salt, setSalt] = useState(0);

  const filter = useMemo(() => {
    if (kind === 'taste') return { kind: 'taste', value: tasteValue };
    return { kind: 'surprise' };
  }, [kind, tasteValue]);

  const picked = useMemo(() => {
    if (!edges || !nodes) return null;
    return pickPairing(edges, nodes, filter, salt);
  }, [edges, nodes, filter, salt]);

  if (dismissed) return null;
  if (!edges || !nodes) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10) })); } catch { /* ignore */ }
    setDismissed(true);
  };

  const handleOpen = () => {
    if (picked && onPickPair) onPickPair([picked.source, picked.target]);
  };

  return (
    <div className="fixed bottom-4 left-4 w-80 z-40 bg-[#0d0d16]/95 border border-cyan-500/40 rounded-lg shadow-xl backdrop-blur-sm">
      <div className="flex justify-between items-start p-3 border-b border-[#2a2a3a]">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-400">Today's Pairing</div>
          <div className="text-[10px] text-gray-500">Pick a direction</div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1"
          aria-label="Dismiss"
        >×</button>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => { setKind('surprise'); setSalt(0); }}
            className={`px-2 py-1 rounded text-[10px] border transition-colors ${
              kind === 'surprise'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'text-gray-400 border-[#2a2a3a] hover:border-cyan-500/30'
            }`}
          >Surprise</button>
          <button
            onClick={() => { setKind('taste'); setSalt(0); }}
            className={`px-2 py-1 rounded text-[10px] border transition-colors ${
              kind === 'taste'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'text-gray-400 border-[#2a2a3a] hover:border-cyan-500/30'
            }`}
          >By taste</button>
        </div>

        {kind === 'taste' && (
          <div className="flex flex-wrap gap-1">
            {TASTE_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => { setTasteValue(t); setSalt(0); }}
                className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                  tasteValue === t
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : 'text-gray-500 border-[#2a2a3a] hover:border-purple-500/30'
                }`}
              >{t}</button>
            ))}
          </div>
        )}

        <div className="min-h-[48px] flex items-center justify-center rounded bg-[#1a1a24] border border-[#2a2a3a] px-2 py-1.5">
          {picked ? (
            <div className="text-center w-full">
              <div className="text-xs text-white font-medium leading-tight">
                {picked.source}
                <span className="text-gray-500 mx-1.5">+</span>
                {picked.target}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">
                strength {(picked.strength * 100).toFixed(0)}%
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-500">No pairing matches this filter.</div>
          )}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={handleOpen}
            disabled={!picked}
            className="flex-1 px-3 py-1.5 bg-cyan-700/40 hover:bg-cyan-600/50 disabled:opacity-40 disabled:cursor-not-allowed border border-cyan-500/40 rounded text-xs text-cyan-100 transition-colors"
          >Open pair →</button>
          <button
            onClick={() => setSalt(s => s + 1)}
            className="px-3 py-1.5 bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a3a] rounded text-xs text-gray-400 transition-colors"
            title="Pick another"
          >↻</button>
        </div>
      </div>
    </div>
  );
}
