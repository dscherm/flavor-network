import { useState } from 'react';

export default function MobileTabBar({
  activeTab,
  onTabChange,
  onOpenProfile,
  onOpenInsights,
  onOpenGlobalInsights,
  onOpenProfileTree,
  onOpenTreeExplorer,
  onOpenBridge,
  onOpenHelp,
  profileMode,
  onToggleProfileMode,
  user,
  onLogin,
  onLogout,
}) {
  const [labsOpen, setLabsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isLabActive = activeTab !== 'network';

  return (
    <>
      {/* Backdrop for popovers */}
      {(labsOpen || moreOpen) && (
        <div className="fixed inset-0 z-[69]" onClick={() => { setLabsOpen(false); setMoreOpen(false); }} />
      )}

      <div
        className="fixed bottom-0 inset-x-0 z-[70] sm:hidden bg-[#0a0a12]/95 backdrop-blur-md border-t border-[#1e1e2e]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14">
          {/* Network */}
          <button
            onClick={() => { onTabChange('network'); setLabsOpen(false); setMoreOpen(false); }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              activeTab === 'network' ? 'text-cyan-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
            <span className="text-[10px]">Network</span>
          </button>

          {/* Labs */}
          <div className="relative">
            <button
              onClick={() => { setLabsOpen(v => !v); setMoreOpen(false); }}
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
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[71] overflow-hidden">
                {[
                  { key: 'recipe', label: 'Recipe Lab' },
                  { key: 'sauce', label: 'Sauce Lab' },
                  { key: 'recipe-sauce', label: 'Sauce Recipe' },
                  { key: 'cocktail', label: 'Cocktail Lab' },
                  { key: 'recipe-cocktail', label: 'Cocktail Recipe' },
                ].map(lab => (
                  <button
                    key={lab.key}
                    onClick={() => { onTabChange(lab.key); setLabsOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors ${
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

          {/* Profile */}
          <button
            onClick={() => { onOpenProfile(); setLabsOpen(false); setMoreOpen(false); }}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px]">Profile</span>
          </button>

          {/* More */}
          <div className="relative">
            <button
              onClick={() => { setMoreOpen(v => !v); setLabsOpen(false); }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                moreOpen ? 'text-cyan-400' : 'text-gray-500'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
              <span className="text-[10px]">More</span>
            </button>
            {moreOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[71] overflow-hidden">
                <button
                  onClick={() => { onOpenGlobalInsights(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                >
                  Network Insights
                </button>
                <button
                  onClick={() => { onOpenInsights(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                >
                  Profile Insights
                </button>
                <button
                  onClick={() => { onOpenProfileTree(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                >
                  My Flavor Tree
                </button>
                <button
                  onClick={() => { onOpenTreeExplorer(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                >
                  Flavor Trees
                </button>
                <button
                  onClick={() => { onOpenBridge(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                >
                  Flavor Bridge
                </button>
                <button
                  onClick={() => { onOpenHelp(); setMoreOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                >
                  Guided Tour
                </button>
                <div className="border-t border-[#2a2a3a]">
                  <button
                    onClick={() => { onToggleProfileMode(); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                  >
                    {profileMode ? 'Switch to Global View' : 'Switch to Profile View'}
                  </button>
                </div>
                <div className="border-t border-[#2a2a3a]">
                  {user ? (
                    <button
                      onClick={() => { onLogout(); setMoreOpen(false); }}
                      className="w-full text-left px-3 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                    >
                      Sign Out
                    </button>
                  ) : (
                    <button
                      onClick={() => { onLogin(); setMoreOpen(false); }}
                      className="w-full text-left px-3 py-2.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-[#1a1a2a] transition-colors"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
