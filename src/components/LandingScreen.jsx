import { useState } from 'react';
import AnimatedLogo from './AnimatedLogo.jsx';
import { hapticMedium } from '../utils/native.js';

const TILES = [
  {
    id: 'pairing',
    label: 'Network',
    description: '3,913 ingredients · 48,588 pairings, clustered by chemistry.',
    accent: '#4f8fff',
  },
  {
    id: 'cocktail',
    label: 'Cocktail Lab',
    description: '441 cocktails across the 6 Codex families.',
    accent: '#a78bfa',
  },
  {
    id: 'sauce',
    label: 'Sauce Lab',
    description: '77 sauces across the 10 mother families.',
    accent: '#fbbf24',
  },
];

const SECONDARY_LABS = [
  { id: 'recipe', label: 'Recipe Lab' },
  { id: 'molecule', label: 'Molecule Lab' },
];

/**
 * LandingScreen — permanent landing surface. Animated brand logo on top
 * (~33vh mobile, ~50vh desktop), three large mode tiles below, and a
 * "More labs" pill that opens a small menu for Recipe Lab + Molecule
 * Lab so the labs not on the primary landing remain reachable.
 *
 * Doubles as the loading surface: when `isLoading` is true after the
 * user has tapped a tile, the picked tile shows a shimmer; the others
 * dim. The animated logo keeps running.
 */
export default function LandingScreen({ onModeSelect, onSecondarySelect, isLoading = false, picked = null }) {
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const handleTile = (id) => {
    if (isLoading) return;
    hapticMedium();
    onModeSelect?.(id);
  };

  const handleSecondary = (id) => {
    hapticMedium();
    setSecondaryOpen(false);
    onSecondarySelect?.(id);
  };

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fn-landing-title"
      style={{ backgroundColor: '#0d1f38' }}
    >
      <h1 id="fn-landing-title" className="sr-only">Neural Flavor</h1>

      {/* Top brand region: 33vh on mobile, 50vh on md+ */}
      <div className="w-full flex items-center justify-center pt-[max(env(safe-area-inset-top),1rem)] h-[33vh] md:h-[50vh]">
        <AnimatedLogo className="h-full w-auto max-w-full" />
      </div>

      {/* Tagline */}
      <p className="text-center text-sm sm:text-base text-[#a8c4e8] max-w-xl mt-2 mb-6 leading-relaxed">
        Built on 2.2M recipes, 48,588 pairings, and real molecular chemistry.
      </p>

      {/* Three primary tiles */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {TILES.map((tile) => {
          const isPicked = picked === tile.id;
          const dimmed = isLoading && !isPicked;
          return (
            <button
              key={tile.id}
              onClick={() => handleTile(tile.id)}
              disabled={isLoading}
              data-mode={tile.id}
              aria-label={`${tile.label}. ${tile.description}`}
              className={`group relative flex flex-col items-start text-left gap-2 rounded-xl border bg-[#12203b] p-5 sm:p-6 min-h-[44px] transition-all overflow-hidden focus:outline-none
                ${dimmed ? 'opacity-40 cursor-wait' : 'hover:bg-[#16284a]'}
                ${isPicked ? 'border-cyan-400/80' : 'border-[#1d3158]'}
              `}
              style={isPicked ? { boxShadow: `0 0 24px ${tile.accent}55` } : undefined}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: tile.accent }}
                aria-hidden="true"
              />
              <span className="text-base sm:text-lg font-medium text-white">{tile.label}</span>
              <span className="text-xs sm:text-sm text-[#9bb6da] leading-relaxed">{tile.description}</span>
              {isPicked && isLoading && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
                  <span
                    className="block h-full w-1/3 animate-[fn-shimmer_1.4s_ease-in-out_infinite]"
                    style={{ background: tile.accent }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* "More labs" pill */}
      <div className="relative mt-5">
        <button
          onClick={() => setSecondaryOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={secondaryOpen}
          className="text-xs text-[#9bb6da] hover:text-white border border-[#1d3158] hover:border-cyan-400/40 rounded-full px-3 py-1.5 transition-colors"
        >
          More labs &middot;{' '}
          <span className="inline-block transition-transform" style={{ transform: secondaryOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </button>
        {secondaryOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setSecondaryOpen(false)}
            />
            <div
              role="menu"
              aria-label="Other labs"
              className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 w-44 rounded-lg border border-[#1d3158] bg-[#0f1d36] shadow-xl overflow-hidden"
            >
              {SECONDARY_LABS.map((lab) => (
                <button
                  key={lab.id}
                  role="menuitem"
                  onClick={() => handleSecondary(lab.id)}
                  className="w-full text-left px-3 py-2.5 text-xs text-[#cfe0f5] hover:text-white hover:bg-[#16284a] transition-colors"
                >
                  {lab.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fn-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
