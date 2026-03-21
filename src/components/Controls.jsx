import React, { useState } from 'react';

function Controls({
  cuisines,
  selectedCuisine,
  onCuisineFilter,
  tastes,
  selectedTaste,
  onTasteFilter,
}) {
  const [open, setOpen] = useState(false);

  const selectClasses =
    'w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer';

  return (
    <div
      className="fixed right-0 z-40 hidden sm:flex items-end select-none transition-transform duration-300 ease-in-out"
      style={{ bottom: 'var(--bottom-safe)', transform: open ? 'translateX(0)' : 'translateX(calc(100% - 28px))' }}
    >
      {/* Tab */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] border-r-0 rounded-l-lg px-1.5 py-3 transition-colors shrink-0 ${
          open ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
        }`}
        aria-label={open ? 'Hide controls' : 'Show controls'}
        title="Controls"
      >
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ writingMode: 'vertical-rl' }}>
          Controls
        </span>
      </button>

      {/* Panel */}
      <div className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-l-lg p-3 w-52 border-l-0">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Filters</h3>

        <div className="space-y-2">
          <div>
            <label htmlFor="cuisine-filter" className="block text-xs text-gray-500 mb-1">
              Cuisine
            </label>
            <select
              id="cuisine-filter"
              className={selectClasses}
              value={selectedCuisine}
              onChange={(e) => onCuisineFilter(e.target.value)}
            >
              <option value="">All</option>
              {cuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="taste-filter" className="block text-xs text-gray-500 mb-1">
              Taste
            </label>
            <select
              id="taste-filter"
              className={selectClasses}
              value={selectedTaste}
              onChange={(e) => onTasteFilter(e.target.value)}
            >
              <option value="">All</option>
              {tastes.map((t) => (
                <option key={t} value={t}>
                  {t === 'spicy' ? 'Spicy / Hot' : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Controls;
