import React, { useState } from 'react';

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

function Slider({ label, value, onChange, min = 0, max = 2, step = 0.05 }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-[10px] text-gray-500 tabular-nums">{pct}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
          [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-colors"
      />
    </div>
  );
}

function Controls({
  showEdges,
  showParticles,
  onToggleEdges,
  onToggleParticles,
  edgeBrightness = 1.0,
  particleBrightness = 1.0,
  onEdgeBrightnessChange,
  onParticleBrightnessChange,
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
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Controls</h3>

        <div className="space-y-2">
          <Toggle label="Edges" checked={showEdges} onChange={onToggleEdges} />
          {showEdges && (
            <Slider label="Edge Brightness" value={edgeBrightness} onChange={onEdgeBrightnessChange} />
          )}
          <Toggle label="Particles" checked={showParticles} onChange={onToggleParticles} />
          {showParticles && (
            <Slider label="Particle Brightness" value={particleBrightness} onChange={onParticleBrightnessChange} />
          )}
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
