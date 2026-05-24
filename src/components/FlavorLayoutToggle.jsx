import { useState } from 'react';

// Small floating toggle button to A/B between the encoded and GNN
// flavor-layout variants. Reads localStorage.FN_FLAVOR_LAYOUT to know
// the current mode, writes the swapped value, then reloads. Reload
// is required because useProData reads the flag at hook init and
// caches the fetched JSONs in state.
//
// Temporary chef-facing toggle for the 2026-05-24 A/B; remove after
// chef picks the winner and we promote it as the default.

function getMode() {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('FN_FLAVOR_LAYOUT') === 'gnn' ? 'gnn' : 'encoded';
    }
  } catch {/* localStorage blocked */}
  return 'encoded';
}

export default function FlavorLayoutToggle() {
  const [mode, setMode] = useState(getMode());
  const swap = () => {
    const next = mode === 'gnn' ? 'encoded' : 'gnn';
    try {
      localStorage.setItem('FN_FLAVOR_LAYOUT', next);
    } catch {/* localStorage blocked */}
    setMode(next);
    location.reload();
  };
  const isGnn = mode === 'gnn';
  return (
    <button
      type="button"
      onClick={swap}
      title="A/B toggle: encoded (deterministic) vs gnn (learned). Reloads on click."
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 999,
        padding: '6px 12px',
        borderRadius: 14,
        border: `1px solid ${isGnn ? '#06b6d4' : '#facc15'}`,
        background: 'rgba(20, 20, 28, 0.85)',
        color: isGnn ? '#06b6d4' : '#facc15',
        font: '600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: 0.5,
        cursor: 'pointer',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      Layout: {isGnn ? 'GNN' : 'ENCODED'} <span style={{ opacity: 0.6 }}>·</span> swap
    </button>
  );
}
