import React from 'react';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-[#12121a] ${
          checked ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </label>
  );
}

function Controls({
  showEdges,
  showParticles,
  onToggleEdges,
  onToggleParticles,
  cuisines,
  selectedCuisine,
  onCuisineFilter,
  tastes,
  selectedTaste,
  onTasteFilter,
}) {
  const selectClasses =
    'w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer';

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-3 w-52 select-none">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Controls</h3>

      <div className="space-y-2">
        <Toggle label="Edges" checked={showEdges} onChange={onToggleEdges} />
        <Toggle label="Particles" checked={showParticles} onChange={onToggleParticles} />
      </div>

      <div className="mt-3 pt-2 border-t border-[#1e1e2e] space-y-2">
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
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default Controls;
