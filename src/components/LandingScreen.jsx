import AnimatedLogo from './AnimatedLogo.jsx';
import { hapticMedium } from '../utils/native.js';
import { ChalkLoader, LabArt } from './chalkArt.jsx';

/**
 * LandingScreen — the front page: the chalk logo (about half the screen),
 * a tagline, then a tile for each lab (Recipe Lab first). Tapping a tile
 * opens that lab.
 *
 * Doubles as the loading surface: when `isLoading` is true after the
 * user has tapped a tile, the picked tile shows a shimmer; the others
 * dim. The logo keeps running.
 */

// The labs, straight from the landing page (2026-11-07): the Recipe Lab
// (what's in your kitchen → cook or invent) leads; the rest follow. The
// separate "Make a recipe" path and the "The Labs" menu tile are gone.
// `art` is the chalkArt LabArt id.
export const LAB_TILES = [
  { id: 'make',     label: 'Recipe Lab',   subheadline: 'Cook from your kitchen, or invent', accent: '#34d399', art: 'recipe' },
  { id: 'cocktail', label: 'Cocktail Lab', subheadline: 'Mix, riff or invent a drink',       accent: '#f59e0b', art: 'cocktail' },
  { id: 'sauce',    label: 'Sauce Lab',    subheadline: 'The mother sauces and beyond',      accent: '#fb923c', art: 'sauce' },
  { id: 'wine',     label: 'Wine Lab',     subheadline: 'A wine for any dish',               accent: '#e11d48', art: 'wine' },
  { id: 'cookbook', label: 'Cookbook',     subheadline: '83 dishes, start to finish',        accent: '#ec4899', art: 'cookbook' },
  { id: 'pairing',  label: 'Pairing Lab',  subheadline: 'What goes with what',               accent: '#22d3ee', art: 'pairing' },
];
const TILES = LAB_TILES;

export default function LandingScreen({ onModeSelect, isLoading = false, picked = null }) {
  const handleTile = (id) => {
    if (isLoading) return;
    hapticMedium();
    onModeSelect?.(id);
  };

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen max-h-screen px-4 pb-4 sm:pb-8 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fn-landing-title"
      style={{
        // B-version P5 — chalkboard chrome (near-black slate radial wash).
        background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%), #0a0a0a',
      }}
      data-testid="landing-screen"
    >
      <h1 id="fn-landing-title" className="sr-only">Neural Flavor</h1>

      {/* Top — the logo, the largest thing on the page (about half the screen
          on phones; DESIGN-5). Was 32vh (B-version, 2026-06-03): shrunk to 32vh
          on small viewports + flex-shrink so the 3 tile buttons
          guaranteed-fit beneath the logo on iOS portrait. */}
      <div className="w-full flex items-center justify-center pt-[max(env(safe-area-inset-top),0.5rem)] h-[48vh] sm:h-[56vh] flex-shrink-0">
        <AnimatedLogo className="h-full w-auto max-w-full" />
      </div>

      {/* Tagline directly below the logo; while the data loads, a chalk
          glass filling up takes its place (DESIGN-1). */}
      {isLoading ? (
        <div className="mt-1 sm:mt-2 mb-2 sm:mb-6 flex-shrink-0">
          <ChalkLoader compact label="Setting the table…" color={TILES.find((t) => t.id === picked)?.accent} />
        </div>
      ) : (
        <p
          className="text-center text-sm sm:text-xl max-w-xl mt-1 sm:mt-2 mb-2 sm:mb-6 leading-snug flex-shrink-0"
          style={{
            color: '#bdb6a3',
            fontFamily: 'Caveat, cursive',
            textShadow: '0 0 1px rgba(245,239,222,0.45), 0 0 3px rgba(245,239,222,0.18)',
          }}
        >
          Built on 2.2M recipes, 68,417 pairings, and real molecular chemistry.
        </p>
      )}

      {/* The labs: two columns on phones, three on wider screens. Each tile
          is the lab's chalk drawing over its name. */}
      <div className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 flex-1 min-h-0 auto-rows-fr pb-[env(safe-area-inset-bottom,0px)]">
        {TILES.map((tile) => {
          const isPicked = picked === tile.id;
          const dimmed = isLoading && !isPicked;
          return (
            <button
              key={tile.id}
              onClick={() => handleTile(tile.id)}
              disabled={isLoading}
              data-mode={tile.id}
              aria-label={`${tile.label}. ${tile.subheadline}`}
              className={`group relative flex flex-col items-center justify-center text-center gap-0.5 rounded-xl px-2 py-1.5 min-h-[72px] transition-all overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5efde]
                ${dimmed ? 'opacity-40 cursor-wait' : 'hover:brightness-110'}
              `}
              style={{
                background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0e0e0e 100%)',
                border: `2px double ${isPicked ? tile.accent : '#4a4a4a'}`,
                boxShadow: isPicked
                  ? `inset 0 0 0 1px #6a6a6a55, 0 0 24px ${tile.accent}55`
                  : 'inset 0 0 0 1px #6a6a6a55, 0 8px 24px rgba(0,0,0,0.55)',
              }}
              data-testid={`landing-tile-${tile.id}`}
            >
              <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: tile.accent }} aria-hidden="true" />
              <span className="flex items-center justify-center flex-shrink min-h-0" aria-hidden="true" style={{ maxHeight: '58%' }}>
                <LabArt id={tile.art} accent={tile.accent} size={52} />
              </span>
              <span
                className="block text-xl sm:text-2xl leading-none"
                style={{
                  color: '#f5efde',
                  fontFamily: 'Caveat, cursive',
                  textShadow: '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)',
                }}
              >
                {tile.label}
              </span>
              <span
                className="hidden sm:block text-sm leading-snug"
                style={{ color: '#bdb6a3', fontFamily: 'Caveat, cursive' }}
              >
                {tile.subheadline}
              </span>
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

      <style>{`
        @keyframes fn-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
