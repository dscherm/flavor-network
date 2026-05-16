import { useState } from 'react';
import { MODE_CYCLE, MODE_LABELS } from '../data/networkModes.js';

/**
 * MobileTabBar — bottom-of-viewport nav mirroring desktop primary nav.
 *
 * Spec §1.G: 3 primary tabs (Explore / Guided / Build) + Profile.
 * The Explore tab opens a sub-menu when already active so the user
 * can reach Cocktail Lab / Sauce Lab / Recipes / network mode without
 * needing an on-canvas overlay.
 */
export default function MobileTabBar({
  activeTab,
  onTabChange,
  networkMode = '3D',
  onNetworkModeChange,
  onOpenProfile,
}) {
  const [exploreOpen, setExploreOpen] = useState(false);

  // Explore tab is "active" for the network view + any of its sub-tabs.
  const isExploreActive = ['network', 'cocktail', 'sauce', 'recipe', 'recipes-3d'].includes(activeTab);
  const isGuidedActive = ['guided', 'guided-results'].includes(activeTab);
  const isBuildActive = ['build', 'build-results'].includes(activeTab);

  const closeAll = () => setExploreOpen(false);

  return (
    <>
      {exploreOpen && (
        <div className="fixed inset-0 z-[99]" onClick={closeAll} />
      )}

      <div
        data-testid="mobile-tab-bar"
        className="fixed bottom-0 inset-x-0 z-[100] sm:hidden bg-[#0a0a12]/95 backdrop-blur-md border-t border-[#1e1e2e]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14">
          {/* Explore — tap when inactive switches to network; tap when
              active opens a sub-menu for network mode + lab sublistings. */}
          <div className="relative">
            <button
              onClick={() => {
                if (isExploreActive) {
                  setExploreOpen((v) => !v);
                } else {
                  onTabChange('network');
                  setExploreOpen(false);
                }
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isExploreActive ? 'text-cyan-400' : 'text-gray-500'
              }`}
              aria-label="Explore"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span className="text-[10px]">Explore</span>
            </button>
            {exploreOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[101] overflow-hidden">
                {/* Sublistings — mirror desktop secondary nav. */}
                <button
                  onClick={() => { onTabChange('network'); closeAll(); }}
                  className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                    activeTab === 'network'
                      ? 'text-cyan-300 bg-cyan-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                  }`}
                >
                  Network
                </button>
                <button
                  onClick={() => { onTabChange('cocktail'); closeAll(); }}
                  className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                    activeTab === 'cocktail'
                      ? 'text-amber-300 bg-amber-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                  }`}
                >
                  Cocktail Lab
                </button>
                <button
                  onClick={() => { onTabChange('sauce'); closeAll(); }}
                  className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                    activeTab === 'sauce'
                      ? 'text-orange-300 bg-orange-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                  }`}
                >
                  Sauce Lab
                </button>
                <button
                  onClick={() => { onTabChange('recipes-3d'); closeAll(); }}
                  className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                    activeTab === 'recipes-3d'
                      ? 'text-pink-300 bg-pink-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                  }`}
                >
                  Recipes
                </button>
                <button
                  onClick={() => { onTabChange('recipe'); closeAll(); }}
                  className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                    activeTab === 'recipe'
                      ? 'text-emerald-300 bg-emerald-500/10'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                  }`}
                >
                  Notebook
                </button>
                {/* Mode switcher — only when currently on network. */}
                {activeTab === 'network' && (
                  <>
                    <div className="border-t border-[#2a2a3a] mt-1 pt-1">
                      <span className="block px-3 py-1 text-[9px] uppercase tracking-widest text-gray-600">
                        Network mode
                      </span>
                      {MODE_CYCLE.map((m) => (
                        <button
                          key={m}
                          onClick={() => { onNetworkModeChange?.(m); closeAll(); }}
                          className={`w-full text-left px-3 py-2 min-h-[40px] text-xs font-medium transition-colors ${
                            networkMode === m
                              ? 'text-cyan-300 bg-cyan-500/10'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                          }`}
                        >
                          {MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Guided */}
          <button
            onClick={() => { onTabChange('guided'); closeAll(); }}
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

          {/* Build */}
          <button
            onClick={() => { onTabChange('build'); closeAll(); }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              isBuildActive ? 'text-emerald-400' : 'text-gray-500'
            }`}
            aria-label="Build"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[10px]">Build</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => { onOpenProfile(); closeAll(); }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              activeTab === 'profile' ? 'text-pink-400' : 'text-gray-500'
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
