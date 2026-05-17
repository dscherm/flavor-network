/**
 * CuisineFilterPills — Stage 5.
 *
 * Renders a row of cuisine pills derived from the focal's
 * cuisine-anchored pairings. Tapping a pill toggles a filter that
 * restricts the visible pair list to that cuisine's anchored pairs.
 * "All" clears the filter.
 *
 * Props:
 *   - neighbors:     Array<{ name, strength }>
 *   - focalName:     string
 *   - cuisinePairLookup:  Map (from useProData → ctx.cuisinePairLookup)
 *   - active:        currently-active cuisine string | null
 *   - onChange:      (cuisine|null) => void
 */
import { useMemo } from 'react';
import { getCuisinePair, displayableCuisine, cuisineColor } from '../data/cuisinePairings.js';

export default function CuisineFilterPills({ neighbors, focalName, cuisinePairLookup, active, onChange }) {
  const cuisines = useMemo(() => {
    if (!cuisinePairLookup || !neighbors || !focalName) return [];
    const counts = new Map();
    for (const n of neighbors) {
      const rec = getCuisinePair(cuisinePairLookup, focalName, n.name);
      const cui = displayableCuisine(rec);
      if (!cui) continue;
      counts.set(cui, (counts.get(cui) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cuisine, count]) => ({ cuisine, count }));
  }, [neighbors, focalName, cuisinePairLookup]);

  if (cuisines.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-gray-700/30"
      data-testid="cuisine-filter-pills"
    >
      <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-1">
        Cuisine
      </span>
      <button
        type="button"
        onClick={() => onChange?.(null)}
        className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
          active === null
            ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
            : 'bg-gray-800/40 text-gray-400 border-gray-700/40 hover:bg-gray-700/40'
        }`}
      >
        All
      </button>
      {cuisines.map(({ cuisine, count }) => {
        const isActive = active === cuisine;
        const color = cuisineColor(cuisine);
        return (
          <button
            key={cuisine}
            type="button"
            onClick={() => onChange?.(isActive ? null : cuisine)}
            className="px-2 py-0.5 text-[10px] rounded-full border transition-colors inline-flex items-center gap-1"
            style={{
              color: isActive ? '#fff' : color,
              background: isActive ? `${color}55` : `${color}1a`,
              borderColor: isActive ? color : `${color}55`,
            }}
            title={`${count} pairing${count === 1 ? '' : 's'} anchored in ${cuisine}`}
          >
            <span
              aria-hidden="true"
              className="inline-block rounded-full"
              style={{ width: 4, height: 4, background: color }}
            />
            {cuisine}
            <span className="opacity-60">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
