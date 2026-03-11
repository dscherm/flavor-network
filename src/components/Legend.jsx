import React from 'react';

const TASTE_COLORS = [
  { label: 'Sweet', color: '#ff6b9d' },
  { label: 'Sour', color: '#4ecdc4' },
  { label: 'Bitter', color: '#9b59b6' },
  { label: 'Umami', color: '#f39c12' },
  { label: 'Spicy', color: '#e74c3c' },
  { label: 'Default', color: '#4f8fff' },
];

function Legend() {
  return (
    <div className="fixed bottom-4 left-4 z-40 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-3 select-none">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Legend</h3>
      <div className="space-y-1.5">
        {TASTE_COLORS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <span className="text-xs text-gray-300">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-[#1e1e2e]">
        <p className="text-xs text-gray-500">Size = number of pairings</p>
      </div>
    </div>
  );
}

export default Legend;
