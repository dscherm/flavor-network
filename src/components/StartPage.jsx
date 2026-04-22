import { useRef, useEffect } from 'react';

const MODES = [
  {
    id: 'discover',
    label: 'Discover ingredients',
    description: 'Explore a 3D network of 3,913 ingredients grouped by shared chemistry.',
  },
  {
    id: 'build',
    label: 'Build a recipe',
    description: 'Start with an ingredient, get pairings that balance sweet, sour, bitter, salty, umami.',
  },
  {
    id: 'learn',
    label: 'Learn the science',
    description: 'See the molecules, the model, and why basil tastes like strawberry.',
  },
];

function DiscoverVisual() {
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

function BuildVisual() {
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20" aria-hidden="true">
      {/* Recipe list (lines) */}
      <rect x="10" y="18" width="30" height="4" rx="1" fill="rgba(236,72,153,0.7)" />
      <rect x="10" y="28" width="24" height="3" rx="1" fill="rgba(236,72,153,0.5)" />
      <rect x="10" y="36" width="28" height="3" rx="1" fill="rgba(236,72,153,0.5)" />
      <rect x="10" y="44" width="20" height="3" rx="1" fill="rgba(236,72,153,0.5)" />
      {/* Cocktail glass */}
      <path
        d="M 55 20 L 85 20 L 72 48 L 68 48 Z"
        fill="none" stroke="rgb(34,211,238)" strokeWidth="1.8"
      />
      <line x1="70" y1="48" x2="70" y2="62" stroke="rgb(34,211,238)" strokeWidth="1.8" />
      <line x1="62" y1="62" x2="78" y2="62" stroke="rgb(34,211,238)" strokeWidth="1.8" />
      {/* Sauce bowl */}
      <ellipse cx="50" cy="82" rx="22" ry="5" fill="none" stroke="rgb(251,191,36)" strokeWidth="1.8" />
      <path
        d="M 28 82 Q 28 94 50 94 Q 72 94 72 82"
        fill="rgba(251,191,36,0.15)" stroke="rgb(251,191,36)" strokeWidth="1.8"
      />
    </svg>
  );
}

function LearnVisual() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-20 h-20 motion-safe:[animation:fn-spin_10s_linear_infinite]"
      aria-hidden="true"
    >
      {/* Caffeine-ish skeleton: purine ring schematic */}
      <g>
        {/* Hexagon (pyrimidine) */}
        <polygon
          points="30,30 50,22 70,30 70,50 50,58 30,50"
          fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="1.6"
        />
        {/* Imidazole-ish pentagon */}
        <polygon
          points="70,50 84,46 88,60 78,70 66,62"
          fill="none" stroke="rgba(34,211,238,0.8)" strokeWidth="1.6"
        />
        {/* Atoms */}
        <circle cx="30" cy="30" r="4" fill="rgb(167,139,250)" />
        <circle cx="70" cy="30" r="4" fill="rgb(167,139,250)" />
        <circle cx="30" cy="50" r="4" fill="rgb(34,211,238)" />
        <circle cx="70" cy="50" r="4" fill="rgb(167,139,250)" />
        <circle cx="50" cy="22" r="3" fill="rgb(251,191,36)" />
        <circle cx="50" cy="58" r="3" fill="rgb(251,191,36)" />
        <circle cx="84" cy="46" r="3" fill="rgb(34,211,238)" />
        <circle cx="88" cy="60" r="3" fill="rgb(34,211,238)" />
        <circle cx="78" cy="70" r="3" fill="rgb(251,191,36)" />
      </g>
    </svg>
  );
}

const VISUALS = {
  discover: DiscoverVisual,
  build: BuildVisual,
  learn: LearnVisual,
};

export default function StartPage({ onModeSelect }) {
  const firstBtnRef = useRef(null);

  useEffect(() => {
    firstBtnRef.current?.focus();
  }, []);

  const handleSelect = (id) => {
    try {
      localStorage.setItem('fn-start-seen', '1');
    } catch {
      // Private-mode Safari silently fails; fall through — user still enters app.
    }
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
            Built on 2.2M recipes, 48,588 pairings, and real molecular chemistry. Pick a mode to start.
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

        <p className="text-center text-[11px] text-neural-muted/60 mt-8">
          You can revisit this later with <code className="text-cyan-400/70">?reset=start</code>
        </p>
      </div>
    </div>
  );
}
