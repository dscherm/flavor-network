import { useState } from 'react';
import { MODE_CYCLE, MODE_LABELS } from '../data/networkModes.js';

/**
 * MobileTabBar — bottom-of-viewport nav. B-version rev (2026-06-03):
 *   - Tab order: Guided → Make → Model → Profile (was Explore/Guided/
 *     Make/Profile with Explore first).
 *   - "Explore" renamed to "Model"; tap-when-active dropdown is now
 *     restricted to 3D Network / 2D Network sub-options only (Cocktail
 *     Lab / Sauce Lab / Cookbook / Recipes Notebook are reachable via
 *     the floating Labs FAB instead).
 *   - Bar shows on both mobile AND desktop (the desktop top nav is
 *     retired in this rev — see App.jsx).
 */
export default function MobileTabBar({
  activeTab,
  onTabChange,
  networkMode = '3D',
  onNetworkModeChange,
  onOpenProfile,
}) {
  const [modelOpen, setModelOpen] = useState(false);

  const isGuidedActive = ['guided', 'guided-results', 'guided-pairing'].includes(activeTab);
  const isMakeActive = activeTab === 'make';
  // The Model pillar is the network surface (3D / 2D variants). Cocktail/
  // sauce/recipe/cookbook are now reached via LabsFab; they don't
  // highlight the Model tab.
  const isModelActive = activeTab === 'network';
  const isProfileActive = activeTab === 'profile';

  const closeAll = () => setModelOpen(false);

  return (
    <>
      {modelOpen && (
        <div className="fixed inset-0 z-[99]" onClick={closeAll} />
      )}

      <div
        data-testid="mobile-tab-bar"
        className="fixed bottom-0 inset-x-0 z-[100] bg-[#0a0a12]/95 backdrop-blur-md border-t border-[#1e1e2e]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14">
          {/* Guided */}
          <button
            onClick={() => { onTabChange('guided'); closeAll(); }}
            data-testid="tabbar-guided"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              isGuidedActive ? 'text-violet-400' : 'text-gray-500'
            }`}
            aria-label="Guided"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-[10px]">Guided</span>
          </button>

          {/* Make */}
          <button
            onClick={() => { onTabChange('make'); closeAll(); }}
            data-testid="tabbar-make"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              isMakeActive ? 'text-pink-400' : 'text-gray-500'
            }`}
            aria-label="Make"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px]">Make</span>
          </button>

          {/* Model — was "Explore". Tap-when-active opens a 3D/2D
              sub-menu; tap-when-inactive jumps to the network tab. */}
          <div className="relative">
            <button
              onClick={() => {
                if (isModelActive) {
                  setModelOpen((v) => !v);
                } else {
                  onTabChange('network');
                  setModelOpen(false);
                }
              }}
              data-testid="tabbar-model"
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isModelActive ? 'text-cyan-400' : 'text-gray-500'
              }`}
              aria-label="Model"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span className="text-[10px]">Model</span>
            </button>
            {modelOpen && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[101] overflow-hidden"
                data-testid="tabbar-model-menu"
              >
                <span className="block px-3 py-1 text-[9px] uppercase tracking-widest text-gray-600 border-b border-[#2a2a3a]">
                  Network mode
                </span>
                {MODE_CYCLE.map((m) => (
                  <button
                    key={m}
                    onClick={() => { onNetworkModeChange?.(m); closeAll(); }}
                    data-testid={`tabbar-model-mode-${m}`}
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

          {/* Profile */}
          <button
            onClick={() => { onOpenProfile(); closeAll(); }}
            data-testid="tabbar-profile"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              isProfileActive ? 'text-pink-400' : 'text-gray-500'
            }`}
            aria-label="Profile"
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
