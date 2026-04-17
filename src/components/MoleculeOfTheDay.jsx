import { useEffect, useState } from 'react';

/**
 * MoleculeOfTheDay — dismissible landing card that rotates daily.
 *
 * Picks a preset from public/models/preset_predictions.json using a seed
 * derived from today's date (so everyone sees the same molecule on the same
 * day). Dismissal is remembered in localStorage for 24 hours.
 *
 * Onclick, jumps the user into the Molecule Lab with that preset selected.
 */

const TASTE_COLORS = {
  sweet: '#ff4fb8',
  bitter: '#9d4edd',
  umami: '#ffd700',
  salty: '#4f9eff',
  sour: '#00ffd0',
};

const DISMISS_KEY = 'fn.motd.dismissed';

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

export default function MoleculeOfTheDay({ onOpen }) {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(() => dismissActive());

  useEffect(() => {
    if (dismissed) return;
    fetch('/models/preset_predictions.json')
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, [dismissed]);

  if (dismissed || !data?.presets?.length) return null;

  const idx = hashToIndex(todayKey(), data.presets.length);
  const preset = data.presets[idx];
  const top = [...Object.entries(preset.predictions)].sort((a, b) => b[1] - a[1]).slice(0, 2);

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: todayKey() })); } catch {}
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 z-40 bg-[#0d0d16]/95 border border-purple-500/40 rounded-lg shadow-xl backdrop-blur-sm">
      <div className="flex justify-between items-start p-3 border-b border-[#2a2a3a]">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-purple-400">Molecule of the Day</div>
          <div className="text-sm font-semibold text-white">{preset.name}</div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1"
          aria-label="Dismiss"
        >×</button>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-xs text-gray-400">{preset.intuition}</div>
        <div className="space-y-1">
          {top.map(([t, p]) => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-12 text-[10px] uppercase text-gray-500">{t}</div>
              <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: `${p * 100}%`, background: TASTE_COLORS[t], boxShadow: `0 0 6px ${TASTE_COLORS[t]}` }}
                />
              </div>
              <div className="w-8 text-right text-[10px] text-gray-400 tabular-nums">
                {(p * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => onOpen?.(preset)}
          className="w-full mt-2 px-3 py-1.5 bg-purple-700/40 hover:bg-purple-600/50 border border-purple-500/40 rounded text-xs text-purple-100 transition-colors"
        >
          Open in Molecule Lab →
        </button>
      </div>
    </div>
  );
}
