import { useState } from 'react';
import { MODE_CYCLE, MODE_LABELS } from '../data/networkModes.js';

export default function MobileTabBar({
  activeTab,
  onTabChange,
  networkMode = 'ml',
  onNetworkModeChange,
  onOpenProfile,
  onOpenTreeExplorer,
}) {
  const [labsOpen, setLabsOpen] = useState(false);
  // Network-button popover. When activeTab !== 'network', tapping
  // Network just switches tabs (existing behavior). When already on
  // Network, tapping toggles a 4-way mode dropdown so the user can
  // switch between 3D/2D Pairings + 3D/2D Flavors without an
  // on-canvas pill cluttering the view.
  const [networkOpen, setNetworkOpen] = useState(false);
  // exploreOpen kept as a no-op state so the inline `setExploreOpen(false)`
  // calls below still resolve — Explore is a direct trigger now, not a
  // dropdown, but we leave the setter wired in case the dropdown comes
  // back. Removing it would require touching every Explore button site.
  const setExploreOpen = () => {};

  const isLabActive = activeTab !== 'network';

  return (
    <>
      {/* Backdrop for the Labs popover. z-[99] sits above the cluster
          joystick (z-20) and any in-lab overlays so taps outside the
          popover dismiss it rather than landing on the joystick pills. */}
      {labsOpen && (
        <div className="fixed inset-0 z-[99]" onClick={() => { setLabsOpen(false); }} />
      )}
      {networkOpen && (
        <div className="fixed inset-0 z-[99]" onClick={() => { setNetworkOpen(false); }} />
      )}

      <div
        className="fixed bottom-0 inset-x-0 z-[100] sm:hidden bg-[#0a0a12]/95 backdrop-blur-md border-t border-[#1e1e2e]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14">
          {/* Network — when already on network tab, tapping opens a
              4-way mode dropdown (3D/2D Pairings, 3D/2D Flavors).
              Otherwise tap switches to network with the last-used
              mode preserved. */}
          <div className="relative">
            <button
              onClick={() => {
                if (activeTab === 'network') {
                  setNetworkOpen(v => !v);
                } else {
                  onTabChange('network');
                  setNetworkOpen(false);
                }
                setLabsOpen(false);
                setExploreOpen(false);
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                activeTab === 'network' ? 'text-cyan-400' : 'text-gray-500'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              <span className="text-[10px]">{activeTab === 'network' ? MODE_LABELS[networkMode] : 'Network'}</span>
            </button>
            {networkOpen && activeTab === 'network' && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[101] overflow-hidden">
                {MODE_CYCLE.map((m) => (
                  <button
                    key={m}
                    onClick={() => { onNetworkModeChange?.(m); setNetworkOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                      networkMode === m
                        ? 'text-cyan-300 bg-cyan-500/10'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Labs */}
          <div className="relative">
            <button
              onClick={() => { setLabsOpen(v => !v); setExploreOpen(false); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isLabActive ? 'text-cyan-400' : 'text-gray-500'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 11.33L18 2l-1.73-1-5.27 9.33L5.73 1 4 2l5 9.33V19H6v2h12v-2h-3v-7.67z" />
              </svg>
              <span className="text-[10px]">Labs</span>
            </button>
            {labsOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[101] overflow-hidden">
                {[
                  { key: 'recipe', label: 'Recipe Lab' },
                  { key: 'cocktail', label: 'Cocktail Lab' },
                  { key: 'sauce', label: 'Sauce Lab' },
                ].map(lab => (
                  <button
                    key={lab.key}
                    onClick={() => { onTabChange(lab.key); setLabsOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                      activeTab === lab.key
                        ? 'text-cyan-300 bg-cyan-500/10'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                    }`}
                  >
                    {lab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Explore — single-button shortcut to Flavor Trees now that
              Flavor Bridge is gone and Network Insights is hidden from
              shipping surface. Dropdown collapsed to a direct trigger. */}
          <button
            onClick={() => { onOpenTreeExplorer(); setLabsOpen(false); setExploreOpen(false); }}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="text-[10px]">Explore</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => { onOpenProfile(); setLabsOpen(false); setExploreOpen(false); }}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px]">Profile</span>
          </button>
        </div>
      </div>
    </>
  );
}
