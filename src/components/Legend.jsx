import React, { useState } from 'react';

const TASTE_COLORS = [
  { label: 'Sweet', key: 'sweet', color: '#fb92b4' },
  { label: 'Sour', key: 'sour', color: '#c9a330' },
  { label: 'Bitter', key: 'bitter', color: '#a78bfa' },
  { label: 'Salty', key: 'salty', color: '#93c5fd' },
  { label: 'Umami', key: 'umami', color: '#f9a870' },
  { label: 'Spicy / Hot', key: 'spicy', color: '#f87171' },
  { label: 'Pungent', key: 'pungent', color: '#b48c64' },
  { label: 'Astringent', key: 'astringent', color: '#4ade80' },
  { label: 'Default', key: '', color: '#4f8fff' },
];

function Legend({ selectedTaste, onTasteFilter }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed left-0 z-40 hidden sm:flex items-end select-none transition-transform duration-300 ease-in-out"
      style={{ bottom: 'var(--bottom-safe)', transform: open ? 'translateX(0)' : 'translateX(calc(-100% + 28px))' }}
    >
      {/* Panel */}
      <div className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-r-lg p-3 border-r-0">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Legend</h3>
        <div className="space-y-1">
          {TASTE_COLORS.map(({ label, key, color }) => {
            const isActive = key && selectedTaste === key;
            return (
              <button
                key={label}
                onClick={() => {
                  if (!key) return;
                  if (onTasteFilter) {
                    onTasteFilter(isActive ? '' : key);
                  }
                }}
                className={`flex items-center gap-2 w-full px-1.5 py-1 rounded transition-colors text-left ${
                  key
                    ? isActive
                      ? 'bg-white/10 ring-1 ring-white/20'
                      : 'hover:bg-white/5 cursor-pointer'
                    : 'cursor-default opacity-60'
                }`}
                title={key ? (isActive ? `Clear ${label} filter` : `Show only ${label}`) : ''}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-shadow"
                  style={{
                    backgroundColor: color,
                    boxShadow: isActive ? `0 0 8px ${color}` : 'none',
                  }}
                  aria-hidden="true"
                />
                <span className={`text-xs ${isActive ? 'text-white font-medium' : 'text-gray-300'}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-[#1e1e2e]">
          <p className="text-xs text-gray-500">Size = number of pairings</p>
          {selectedTaste && (
            <button
              onClick={() => onTasteFilter?.('')}
              className="mt-1 text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      {/* Tab */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] border-l-0 rounded-r-lg px-1.5 py-3 transition-colors shrink-0 ${
          open ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
        }`}
        aria-label={open ? 'Hide legend' : 'Show legend'}
        title="Legend"
      >
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ writingMode: 'vertical-rl' }}>
          Legend
        </span>
      </button>
    </div>
  );
}

export default React.memo(Legend);
