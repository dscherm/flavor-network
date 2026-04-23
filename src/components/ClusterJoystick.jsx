/**
 * ClusterJoystick — compact grid of cluster pills pinned to the Network
 * view. Tap a cluster pill → camera flies to that cluster's label
 * anchor. Addresses user A1: "navigate the network to the specified
 * cluster."
 *
 * Renamed from TasteJoystick after user feedback that cluster names
 * are more useful than 8 taste wedges (clusters are the unit the user
 * reasons about: "take me to Condiments" or "Sweeteners").
 */

import { useState } from 'react';

const TASTE_COLORS = {
  sweet: '#ff4fb8',
  sour: '#00ffd0',
  bitter: '#9d4edd',
  salty: '#4f9eff',
  umami: '#ffd700',
  spicy: '#ff4444',
  pungent: '#ff8c42',
  astringent: '#6bcb77',
};

export default function ClusterJoystick({ clusters, onFlyTo }) {
  const [active, setActive] = useState(null);
  if (!clusters || clusters.length === 0) return null;

  const handleTap = (cluster) => {
    setActive(cluster.id);
    setTimeout(() => setActive(null), 500);
    onFlyTo?.(cluster);
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-30 select-none pointer-events-none"
      style={{
        // Stack above the bottom mode-selector bar and mobile tab bar.
        bottom: 'calc(var(--mobile-nav-h, 3.5rem) + env(safe-area-inset-bottom, 0px) + 4.5rem)',
        maxWidth: 'calc(100vw - 1rem)',
      }}
      aria-label="Fly to cluster"
    >
      <div className="rounded-full bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] px-2 py-1 shadow-lg pointer-events-auto overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-center gap-1 flex-nowrap">
          <span className="text-[9px] uppercase tracking-wider text-gray-500 pr-1 whitespace-nowrap flex-shrink-0">Fly to</span>
          {clusters.map(cl => {
            const color = TASTE_COLORS[cl.dominant_taste] || '#aaaaaa';
            const isActive = active === cl.id;
            return (
              <button
                key={cl.id}
                onClick={() => handleTap(cl)}
                onTouchStart={(e) => { e.preventDefault(); handleTap(cl); }}
                title={`Fly to ${cl.label} (${cl.anchor_ingredient || cl.top_ingredients?.[0] || 'cluster'})`}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] whitespace-nowrap transition-colors flex-shrink-0 min-h-[28px]"
                style={{
                  color,
                  background: isActive ? `${color}40` : `${color}14`,
                  border: `1px solid ${color}${isActive ? 'aa' : '44'}`,
                }}
              >
                <span
                  className="inline-block rounded-full flex-shrink-0"
                  style={{ width: 5, height: 5, background: color, boxShadow: `0 0 3px ${color}` }}
                />
                {cl.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
