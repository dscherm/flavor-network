/**
 * ClusterJoystick — bottom-center pill strip for navigating the 3D
 * scene. Tap a pill to fly the camera to that target.
 *
 * Mode-aware contents:
 *   ml / ml2d (Network views)   → 10 cluster pills (Baked / Protein / …)
 *   neural / taste2d (Taste views) → 8 taste pills (sweet / sour / …)
 */

import { useState, useRef } from 'react';

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

// Cluster palette — mirrors CLUSTER_HEX in LivingArchView.jsx so pill
// color matches the ingredient-ball color for each cluster.
const CLUSTER_HEX = ['#f472b6', '#ea580c', '#22c55e', '#dc2626', '#facc15',
                     '#a855f7', '#84cc16', '#b45309', '#78350f', '#64748b'];

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

export default function ClusterJoystick({ clusters, mode, onFlyTo, focusedClusterId = null, onClusterFocus }) {
  const [active, setActive] = useState(null);
  // iOS dispatches a synthesized click ~300ms after touchstart. Without
  // this debounce, each tap on a cluster pill toggles focus twice (on
  // then back off), leaving the user unable to enter cluster-focus
  // mode at all. Coalesce both events into a single handleTap.
  const lastFireRef = useRef(0);
  const isTasteMode = mode === 'neural' || mode === 'taste2d';

  const items = isTasteMode
    ? TASTE_ORDER.map(t => ({
        id: `taste:${t}`,
        label: t,
        color: TASTE_COLORS[t],
        // Pass `taste` so LivingArchView can resolve the LIVE taste label
        // sprite + compute the actual centroid of ingredients with this
        // taste. The static TASTE_TARGETS position is a fallback only.
        target: { position: TASTE_TARGETS[t], taste: t, ts: 0 },
      }))
    : (clusters || []).map(cl => ({
        id: `cluster:${cl.id}`,
        // Codex labs pass `name`; Network passes `label`. Accept both
        // so this joystick can be reused across surfaces.
        label: cl.label || cl.name || `cluster ${cl.id}`,
        // Prefer cluster.color when the caller provides one (the
        // Cocktail / Sauce codex families ship their own palette);
        // fall back to the Network's CLUSTER_HEX index for the
        // 10-cluster ML view.
        color: cl.color || CLUSTER_HEX[cl.id] || '#aaaaaa',
        cluster: cl,
      }));

  if (items.length === 0) return null;

  const handleTap = (item) => {
    const now = Date.now();
    if (now - lastFireRef.current < 500) return;
    lastFireRef.current = now;
    setActive(item.id);
    setTimeout(() => setActive(null), 500);
    if (item.cluster) {
      onFlyTo?.(item.cluster);
      // Cluster focus: re-tap same pill clears focus, else enter focus
      // on that cluster. Parent owns the state; we just toggle.
      if (onClusterFocus) {
        if (focusedClusterId === item.cluster.id) {
          onClusterFocus(null);
        } else {
          onClusterFocus(item.cluster.id);
        }
      }
    } else if (item.target) {
      onFlyTo?.({ ...item.target, ts: Date.now() });
    }
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-30 select-none pointer-events-none top-[calc(var(--nav-h)+3.5rem)] sm:top-auto sm:bottom-20"
      style={{ maxWidth: 'calc(100vw - 1rem)' }}
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
          <span className="text-[10px] sm:text-[9px] uppercase tracking-wider text-gray-500 pr-1 whitespace-nowrap flex-shrink-0">Fly to</span>
          {items.map(item => {
            const isActive = active === item.id;
            const isFocused = item.cluster && focusedClusterId === item.cluster.id;
            const c = item.color;
            const bgAlpha = isFocused ? '55' : isActive ? '40' : '14';
            const borderAlpha = isFocused ? 'ff' : isActive ? 'aa' : '44';
            return (
              <button
                key={item.id}
                onClick={() => handleTap(item)}
                onTouchStart={(e) => { e.preventDefault(); handleTap(item); }}
                title={isFocused ? `Exit ${item.label} focus` : `Focus on ${item.label}`}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-full text-[11px] sm:text-[10px] whitespace-nowrap transition-colors flex-shrink-0 capitalize"
                style={{
                  color: c,
                  background: `${c}${bgAlpha}`,
                  border: `1px solid ${c}${borderAlpha}`,
                  // 32px tall on mobile for comfortable touch targets,
                  // 26px on desktop to keep the bar compact.
                  minHeight: 32,
                  boxShadow: isFocused ? `0 0 6px ${c}88` : undefined,
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
