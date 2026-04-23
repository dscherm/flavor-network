/**
 * ClusterJoystick — bottom-center pill strip for navigating the 3D
 * scene. Tap a pill to fly the camera to that target.
 *
 * Mode-aware contents:
 *   ml / ml2d (Network views)   → 10 cluster pills (Baked / Protein / …)
 *   neural / taste2d (Taste views) → 8 taste pills (sweet / sour / …)
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

const TASTE_ORDER = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent'];

// Rough 3D positions per taste matching livingArchTaste TASTE_AXES.
const TASTE_TARGETS = {
  sweet:      [0, 60, 0],
  sour:       [42, 0, 42],
  bitter:     [-42, 0, 42],
  salty:      [-42, 0, -42],
  umami:      [42, 0, -42],
  spicy:      [60, 0, 0],
  pungent:    [-60, 0, 0],
  astringent: [0, -60, 0],
};

export default function ClusterJoystick({ clusters, mode, onFlyTo }) {
  const [active, setActive] = useState(null);
  const isTasteMode = mode === 'neural' || mode === 'taste2d';

  const items = isTasteMode
    ? TASTE_ORDER.map(t => ({
        id: `taste:${t}`,
        label: t,
        color: TASTE_COLORS[t],
        target: { position: TASTE_TARGETS[t], ts: 0 },
      }))
    : (clusters || []).map(cl => ({
        id: `cluster:${cl.id}`,
        label: cl.label,
        color: TASTE_COLORS[cl.dominant_taste] || '#aaaaaa',
        cluster: cl,
      }));

  if (items.length === 0) return null;

  const handleTap = (item) => {
    setActive(item.id);
    setTimeout(() => setActive(null), 500);
    if (item.cluster) {
      onFlyTo?.(item.cluster);
    } else if (item.target) {
      onFlyTo?.({ ...item.target, ts: Date.now() });
    }
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-30 select-none pointer-events-none"
      style={{
        // Raise 5vh (~5% of viewport) above the mode selector + tab bar
        // per iOS feedback: was too low for one-thumb reach.
        bottom: 'calc(var(--mobile-nav-h, 3.5rem) + env(safe-area-inset-bottom, 0px) + 4.5rem + 5vh)',
        maxWidth: 'calc(100vw - 1rem)',
      }}
      aria-label={isTasteMode ? 'Fly to taste region' : 'Fly to cluster'}
    >
      <div
        className="bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] px-2 py-1 shadow-lg pointer-events-auto overflow-x-auto"
        style={{
          scrollbarWidth: 'none',
          // Proportional pill-frame: corner radius scales with height
          // (14px content + 2×4px pad → 22px radius) rather than fully
          // rounded. Prevents the outer frame looking taller than its
          // inner buttons on wide viewports.
          borderRadius: 18,
        }}
      >
        <div className="flex items-center gap-1 flex-nowrap">
          <span className="text-[9px] uppercase tracking-wider text-gray-500 pr-1 whitespace-nowrap flex-shrink-0">Fly to</span>
          {items.map(item => {
            const isActive = active === item.id;
            const c = item.color;
            return (
              <button
                key={item.id}
                onClick={() => handleTap(item)}
                onTouchStart={(e) => { e.preventDefault(); handleTap(item); }}
                title={`Fly to ${item.label}`}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] whitespace-nowrap transition-colors flex-shrink-0 capitalize"
                style={{
                  color: c,
                  background: isActive ? `${c}40` : `${c}14`,
                  border: `1px solid ${c}${isActive ? 'aa' : '44'}`,
                  minHeight: 26,
                }}
              >
                <span
                  className="inline-block rounded-full flex-shrink-0"
                  style={{ width: 5, height: 5, background: c, boxShadow: `0 0 3px ${c}` }}
                />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
