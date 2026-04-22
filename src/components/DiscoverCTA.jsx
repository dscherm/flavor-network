import { useMemo, useState, useRef, useEffect } from 'react';
import { pickPairing } from '../utils/discoverPick.js';

const TASTE_OPTIONS = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'pungent', 'spicy', 'astringent'];
const DISMISS_KEY = 'fn.discover.dismissed';
const LAST_SEED_KEY = 'fn.discover.seed';

function dismissActiveToday() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const { date } = JSON.parse(raw);
    return date === new Date().toISOString().slice(0, 10);
  } catch { return false; }
}

function pickRandomSeed(list) {
  if (!list || list.length === 0) return '';
  return list[Math.floor(Math.random() * list.length)];
}

export default function DiscoverCTA({ edges, nodes, ingredientList, onPickPair }) {
  const [dismissed, setDismissed] = useState(() => dismissActiveToday());

  // User-seeded: the ingredient the user provides. Discover finds the
  // best partner for THIS ingredient. Persists across session in localStorage.
  const [seed, setSeed] = useState(() => {
    try { return localStorage.getItem(LAST_SEED_KEY) || ''; } catch { return ''; }
  });
  const [seedInput, setSeedInput] = useState(seed);
  const [seedResults, setSeedResults] = useState([]);
  const [seedOpen, setSeedOpen] = useState(false);
  const seedRef = useRef(null);

  // Filter kind for the partner: any | taste:X | cuisine:Y
  const [kind, setKind] = useState('any');
  const [tasteValue, setTasteValue] = useState('sweet');
  const [cuisineValue, setCuisineValue] = useState('italian');

  // Regenerate counter — increments on ↻ to pick a different partner
  const [salt, setSalt] = useState(0);

  const cuisineOptions = useMemo(() => {
    if (!nodes) return [];
    const set = new Set();
    for (const node of nodes.values()) {
      for (const c of node.cuisines || []) set.add(String(c).toLowerCase());
    }
    return [...set].sort();
  }, [nodes]);

  const filter = useMemo(() => {
    if (kind === 'taste') return { kind: 'taste', value: tasteValue };
    if (kind === 'cuisine') return { kind: 'cuisine', value: cuisineValue };
    return { kind: 'surprise' };
  }, [kind, tasteValue, cuisineValue]);

  // When seed is set, filter edges to only those involving the seed, then
  // apply the user's filter. When seed is empty, fall back to unrestricted
  // surprise mode across all strong pairings.
  const partner = useMemo(() => {
    if (!edges || !nodes) return null;
    let pool = edges;
    if (seed) {
      pool = edges.filter(e => e.source === seed || e.target === seed);
      if (pool.length === 0) return null;
    }
    const pick = pickPairing(pool, nodes, filter, salt);
    return pick;
  }, [edges, nodes, filter, salt, seed]);

  // Seed autocomplete — fuzzy-ish substring, capped at 8 results
  useEffect(() => {
    if (!seedInput || !ingredientList) { setSeedResults([]); return; }
    const q = seedInput.toLowerCase().trim();
    if (q.length < 2) { setSeedResults([]); return; }
    const matches = [];
    for (const name of ingredientList) {
      if (name.toLowerCase().includes(q)) matches.push(name);
      if (matches.length >= 8) break;
    }
    setSeedResults(matches);
  }, [seedInput, ingredientList]);

  // Click-outside to close suggestions
  useEffect(() => {
    function onClick(e) {
      if (seedRef.current && !seedRef.current.contains(e.target)) setSeedOpen(false);
    }
    if (seedOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [seedOpen]);

  if (dismissed) return null;
  if (!edges || !nodes) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10) })); } catch { /* ignore */ }
    setDismissed(true);
  };

  const handleSetSeed = (name) => {
    setSeed(name);
    setSeedInput(name);
    setSeedOpen(false);
    setSalt(0);
    try { localStorage.setItem(LAST_SEED_KEY, name); } catch { /* ignore */ }
  };

  const handleClearSeed = () => {
    setSeed('');
    setSeedInput('');
    setSalt(0);
    try { localStorage.removeItem(LAST_SEED_KEY); } catch { /* ignore */ }
  };

  const handleRandomSeed = () => {
    const name = pickRandomSeed(ingredientList);
    if (name) handleSetSeed(name);
  };

  const handleOpen = () => {
    if (partner && onPickPair) onPickPair([partner.source, partner.target]);
  };

  const partnerName = partner
    ? (seed
        ? (partner.source === seed ? partner.target : partner.source)
        : `${partner.source} + ${partner.target}`)
    : null;

  return (
    <div
      className="fixed left-2 right-2 sm:left-4 sm:right-auto sm:w-80 z-40 bg-[#0d0d16]/95 border border-cyan-500/40 rounded-lg shadow-xl backdrop-blur-sm"
      style={{ bottom: 'calc(var(--mobile-nav-h, 3.5rem) + env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
    >
      <div className="flex justify-between items-start p-3 border-b border-[#2a2a3a]">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-cyan-400">Pair with…</div>
          <div className="text-[10px] text-gray-500">Start with an ingredient, we find the match</div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1"
          aria-label="Dismiss"
        >×</button>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Seed ingredient input */}
        <div ref={seedRef} className="relative">
          <div className="flex gap-1">
            <input
              type="text"
              value={seedInput}
              onChange={(e) => { setSeedInput(e.target.value); setSeedOpen(true); }}
              onFocus={() => setSeedOpen(true)}
              placeholder="Type an ingredient..."
              className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] rounded px-2 py-1 text-[11px] text-white placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
            />
            <button
              onClick={handleRandomSeed}
              className="px-2 py-1 bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a3a] rounded text-[10px] text-gray-400"
              title="Random ingredient"
            >🎲</button>
            {seed && (
              <button
                onClick={handleClearSeed}
                className="px-2 py-1 bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a3a] rounded text-[10px] text-gray-400"
                title="Clear"
              >×</button>
            )}
          </div>
          {seedOpen && seedResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d16] border border-[#2a2a3a] rounded shadow-lg z-50 max-h-40 overflow-y-auto">
              {seedResults.map(name => (
                <button
                  key={name}
                  onClick={() => handleSetSeed(name)}
                  className="w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-300"
                >{name}</button>
              ))}
            </div>
          )}
        </div>

        {/* Partner filter */}
        <div className="flex flex-wrap gap-1">
          {[
            { k: 'any', label: 'Any' },
            { k: 'taste', label: 'By taste' },
            { k: 'cuisine', label: 'By cuisine' },
          ].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => { setKind(k); setSalt(0); }}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                kind === k
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'text-gray-400 border-[#2a2a3a] hover:border-cyan-500/30'
              }`}
            >{label}</button>
          ))}
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

        {kind === 'cuisine' && cuisineOptions.length > 0 && (
          <select
            value={cuisineValue}
            onChange={(e) => { setCuisineValue(e.target.value); setSalt(0); }}
            className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded px-2 py-1 text-[11px] text-amber-300 focus:border-amber-500/50 focus:outline-none capitalize"
          >
            {cuisineOptions.map(c => (
              <option key={c} value={c} className="capitalize bg-[#0d0d16]">{c}</option>
            ))}
          </select>
        )}

        {/* Result */}
        <div className="min-h-[48px] flex items-center justify-center rounded bg-[#1a1a24] border border-[#2a2a3a] px-2 py-1.5">
          {partner ? (
            <div className="text-center w-full">
              {seed ? (
                <>
                  <div className="text-[9px] text-gray-500 mb-0.5">
                    {seed} pairs with
                  </div>
                  <div className="text-xs text-white font-medium leading-tight">
                    {partnerName}
                  </div>
                </>
              ) : (
                <div className="text-xs text-white font-medium leading-tight">
                  {partnerName}
                </div>
              )}
              <div className="text-[9px] text-gray-500 mt-1">
                strength {(partner.strength * 100).toFixed(0)}%
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-500">
              {seed ? `No ${kind === 'any' ? 'strong' : kind} pairings for ${seed}.` : 'Pick an ingredient above.'}
            </div>
          )}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={handleOpen}
            disabled={!partner}
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
