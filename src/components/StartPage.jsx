import { useRef, useEffect } from 'react';
import { hapticMedium } from '../utils/native.js';

const MODES = [
  {
    id: 'pairing',
    label: 'Explore Pairing Model',
    description: 'A 3D network of 3,913 ingredients clustered by shared chemistry and 48,588 pairings.',
  },
  {
    id: 'cocktail',
    label: 'Explore Cocktail Model',
    description: '172 cocktails grouped into the 7 Codex super-clusters — Old-Fashioned, Martini, Daiquiri, and more.',
  },
  {
    id: 'sauce',
    label: 'Explore Sauce Model',
    description: '77 sauces grouped into the 10 mother families — Béchamel, Velouté, Hollandaise, Curry, Mole, and more.',
  },
];

function PairingVisual() {
  const dots = [
    { x: 50, y: 12, d: 0 },
    { x: 14, y: 36, d: 0.3 },
    { x: 86, y: 36, d: 0.6 },
    { x: 50, y: 50, d: 0.15 },
    { x: 24, y: 78, d: 0.45 },
    { x: 76, y: 78, d: 0.75 },
    { x: 50, y: 90, d: 0.9 },
  ];
  const edges = [
    [0, 3], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [1, 4], [2, 5],
  ];
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={dots[a].x} y1={dots[a].y} x2={dots[b].x} y2={dots[b].y}
          stroke="rgba(79,143,255,0.3)" strokeWidth="0.7"
        />
      ))}
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x} cy={dot.y} r="3.5"
          fill="rgb(79,143,255)"
          className="motion-safe:animate-pulse"
          style={{
            filter: 'drop-shadow(0 0 3px rgba(79,143,255,0.9))',
            animationDelay: `${dot.d}s`,
            animationDuration: '2.4s',
          }}
        />
      ))}
    </svg>
  );
}

function CocktailVisual() {
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
      {/* Martini glass — codex of cocktails */}
      <path
        d="M 22 22 L 78 22 L 54 56 L 46 56 Z"
        fill="rgba(167,139,250,0.15)" stroke="rgb(167,139,250)" strokeWidth="2"
      />
      <line x1="50" y1="56" x2="50" y2="80" stroke="rgb(167,139,250)" strokeWidth="2" />
      <line x1="34" y1="80" x2="66" y2="80" stroke="rgb(167,139,250)" strokeWidth="2" />
      {/* Olive */}
      <circle cx="44" cy="44" r="3.5" fill="rgb(125,186,94)"
        style={{ filter: 'drop-shadow(0 0 4px rgba(125,186,94,0.8))' }}
      />
      {/* Surface ripple — implies "cocktails clustering" */}
      <line x1="28" y1="30" x2="72" y2="30" stroke="rgba(167,139,250,0.4)" strokeWidth="1" />
    </svg>
  );
}

function SauceVisual() {
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
      {/* Sauce pan with handle */}
      <path
        d="M 22 38 L 78 38 L 74 76 Q 74 84 66 84 L 34 84 Q 26 84 26 76 Z"
        fill="rgba(251,191,36,0.18)" stroke="rgb(251,191,36)" strokeWidth="2"
      />
      <rect x="78" y="44" width="14" height="4" rx="1.5" fill="rgb(251,191,36)" />
      {/* Sauce surface — three swirls suggesting mother sauces */}
      <ellipse cx="50" cy="42" rx="26" ry="3.5" fill="rgba(217,74,61,0.6)" />
      <path
        d="M 36 42 Q 42 40 50 42 Q 58 44 64 42"
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8"
      />
      {/* Steam */}
      <path
        d="M 40 22 Q 44 18 40 14 Q 36 10 40 6"
        fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="1.4"
        className="motion-safe:animate-pulse"
        style={{ animationDuration: '3s' }}
      />
      <path
        d="M 56 22 Q 60 18 56 14 Q 52 10 56 6"
        fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="1.4"
        className="motion-safe:animate-pulse"
        style={{ animationDuration: '3s', animationDelay: '0.8s' }}
      />
    </svg>
  );
}

const VISUALS = {
  pairing: PairingVisual,
  cocktail: CocktailVisual,
  sauce: SauceVisual,
};

export default function StartPage({ onModeSelect }) {
  const firstBtnRef = useRef(null);

  useEffect(() => {
    firstBtnRef.current?.focus();
  }, []);

  const handleSelect = (id) => {
    hapticMedium();
    onModeSelect?.(id);
  };

  return (
    <div
      className="flex items-center justify-center w-full min-h-screen bg-neural-bg px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fn-start-title"
    >
      <style>{`@keyframes fn-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="w-full max-w-4xl">
        <header className="text-center mb-8 sm:mb-10">
          <h1
            id="fn-start-title"
            className="text-2xl sm:text-4xl font-light text-neural-text tracking-wide mb-3"
            style={{ textShadow: '0 0 20px rgba(79,143,255,0.4)' }}
          >
            Find flavors that work together.
          </h1>
          <p className="text-sm sm:text-base text-neural-muted max-w-2xl mx-auto leading-relaxed">
            Built on 2.2M recipes, 48,588 pairings, and real molecular chemistry. Pick a model to explore.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {MODES.map((mode, idx) => {
            const Visual = VISUALS[mode.id];
            return (
              <button
                key={mode.id}
                ref={idx === 0 ? firstBtnRef : null}
                onClick={() => handleSelect(mode.id)}
                className="group relative flex flex-col items-center text-center gap-4 rounded-xl border border-[#2a2a3a] bg-[#12121a] hover:border-cyan-500/50 hover:bg-[#161622] focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all p-6 sm:p-7"
                data-mode={mode.id}
                aria-label={`${mode.label}. ${mode.description}`}
              >
                <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-[#0a0a12]/60 border border-[#1e1e2e] group-hover:border-cyan-500/30 transition-colors">
                  <Visual />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-medium text-neural-text mb-1.5 group-hover:text-cyan-300 transition-colors">
                    {mode.label}
                  </h2>
                  <p className="text-xs sm:text-sm text-neural-muted leading-relaxed">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
