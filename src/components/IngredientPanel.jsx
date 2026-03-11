import { useCallback, useRef, useEffect } from 'react';

const TASTE_COLORS = {
  sweet: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  sour: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  salty: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  bitter: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  umami: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  pungent: 'bg-red-500/20 text-red-300 border-red-500/30',
  spicy: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  hot: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  mild: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  neutral: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const PROPERTY_BADGE = 'bg-gray-700/40 text-gray-300 border-gray-600/30';

function getTasteBadgeClass(taste) {
  if (!taste) return PROPERTY_BADGE;
  const key = taste.toLowerCase().trim();
  return TASTE_COLORS[key] || PROPERTY_BADGE;
}

function PropertyBadge({ label, value, isTaste }) {
  if (!value) return null;
  const colorClass = isTaste ? getTasteBadgeClass(value) : PROPERTY_BADGE;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${colorClass}`}
    >
      <span className="text-gray-500 uppercase tracking-wider text-[10px]">{label}</span>
      {value}
    </span>
  );
}

function StrengthBar({ strength }) {
  const pct = Math.round(Math.max(0, Math.min(1, strength)) * 100);
  return (
    <div className="flex-1 h-1.5 rounded-full bg-gray-700/50 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold mb-2 mt-5 first:mt-0">
      {children}
    </h3>
  );
}

export default function IngredientPanel({ node, neighbors, onClose, onSelectIngredient }) {
  const panelRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (node && panelRef.current) {
      panelRef.current.focus();
    }
  }, [node]);

  if (!node) return null;

  const { name, cuisines, taste, weight, volume, season, tips, pairingCount, affinities } = node;

  const sortedNeighbors = neighbors
    ? [...neighbors].sort((a, b) => b.strength - a.strength)
    : [];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Details for ${name}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed right-4 top-4 bottom-4 w-80 z-40 overflow-y-auto bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-4 focus:outline-none"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close panel"
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>

      {/* Ingredient name */}
      <h2
        className="text-2xl font-bold text-gray-100 pr-8 mb-1"
        style={{
          textShadow: '0 0 20px rgba(56, 189, 248, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)',
        }}
      >
        {name}
      </h2>

      {pairingCount != null && (
        <p className="text-xs text-gray-500 mb-3">
          {pairingCount} pairing{pairingCount !== 1 ? 's' : ''}
        </p>
      )}

      {/* Properties */}
      {(taste || weight || volume || season) && (
        <section>
          <SectionHeading>Properties</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            <PropertyBadge label="taste" value={taste} isTaste />
            <PropertyBadge label="weight" value={weight} />
            <PropertyBadge label="volume" value={volume} />
            <PropertyBadge label="season" value={season} />
          </div>
        </section>
      )}

      {/* Cuisines */}
      {cuisines && cuisines.length > 0 && (
        <section>
          <SectionHeading>Cuisines</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {cuisines.map((cuisine) => (
              <span
                key={cuisine}
                className="inline-block px-2 py-0.5 rounded border text-xs font-medium bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
              >
                {cuisine}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Top Pairings */}
      {sortedNeighbors.length > 0 && (
        <section>
          <SectionHeading>Top Pairings</SectionHeading>
          <ul className="space-y-1.5">
            {sortedNeighbors.map((neighbor) => (
              <li key={neighbor.name}>
                <button
                  onClick={() => onSelectIngredient && onSelectIngredient(neighbor.name)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-gray-200 hover:bg-gray-700/40 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 group"
                >
                  <span className="truncate flex-shrink-0 min-w-0 max-w-[45%] group-hover:text-cyan-300 transition-colors">
                    {neighbor.name}
                  </span>
                  <StrengthBar strength={neighbor.strength} />
                  <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 w-8 text-right">
                    {Math.round(neighbor.strength * 100)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Affinities */}
      {affinities && affinities.length > 0 && (
        <section>
          <SectionHeading>Affinities</SectionHeading>
          <div className="space-y-1.5">
            {affinities.map((combo, idx) => {
              const display = Array.isArray(combo) ? combo.join(' + ') : String(combo);
              return (
                <div
                  key={idx}
                  className="px-2 py-1.5 rounded-md bg-gray-800/40 border border-gray-700/30 text-sm text-gray-300"
                >
                  {display}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tips */}
      {tips && tips.length > 0 && (
        <section>
          <SectionHeading>Tips</SectionHeading>
          {Array.isArray(tips) ? (
            <ul className="space-y-1.5 text-sm text-gray-400 list-disc list-inside">
              {tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">{tips}</p>
          )}
        </section>
      )}
    </div>
  );
}
