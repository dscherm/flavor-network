import { useMemo, useState } from 'react';

export default function ProfileToggle({
  profileMode,
  onToggleMode,
  onOpenPanel,
  onOpenInsights,
  onOpenGlobalInsights,
  onOpenProfileTree,
  onOpenTreeExplorer,
  showTreeExplorer,
  onOpenBridge,
  showBridge,
  profileStats,
  user,
  onLogin,
  onLogout,
}) {
  const hasProfile = useMemo(
    () => profileStats && profileStats.totalItems > 0,
    [profileStats]
  );
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <div className="fixed left-4 z-50 hidden sm:flex items-center gap-1.5" style={{ top: 'var(--nav-h)' }}>
      {/* View mode toggle */}
      <div className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg flex overflow-hidden">
        <button
          onClick={() => profileMode && onToggleMode()}
          className={`px-2.5 py-1.5 text-[11px] transition-colors select-none ${
            !profileMode
              ? 'bg-blue-500/20 text-blue-400 border-r border-[#1e1e2e]'
              : 'text-gray-500 hover:text-gray-300 border-r border-[#1e1e2e]'
          }`}
          aria-label="Global view"
        >
          Global
        </button>
        <button
          onClick={() => !profileMode && onToggleMode()}
          className={`px-2.5 py-1.5 text-[11px] transition-colors select-none flex items-center gap-1 ${
            profileMode
              ? 'bg-purple-500/20 text-purple-400'
              : hasProfile
                ? 'text-gray-500 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-400'
          }`}
          aria-label="Profile view"
        >
          Profile
          {hasProfile && (
            <span className={`inline-flex items-center justify-center min-w-[14px] h-3.5 rounded-full text-[9px] font-medium px-0.5 ${
              profileMode ? 'bg-purple-500/30 text-purple-300' : 'bg-gray-600/50 text-gray-400'
            }`}>
              {profileStats.totalItems}
            </span>
          )}
        </button>
      </div>

      {/* Tools dropdown — consolidates all tool buttons into one menu */}
      <div className="relative">
        <button
          onClick={() => setToolsOpen(v => !v)}
          className={`bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-2 py-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors select-none flex items-center gap-1 ${
            toolsOpen ? 'text-gray-300 border-gray-500' : ''
          }`}
          title="Tools"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Tools
        </button>
        {toolsOpen && (
          <>
            <div className="fixed inset-0 z-[59]" onClick={() => setToolsOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-44 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[61] overflow-hidden">
              <button
                onClick={() => { onOpenPanel(); setToolsOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Profile
              </button>
              <button
                onClick={() => { onOpenGlobalInsights(); setToolsOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                </svg>
                Network Insights
              </button>
              {hasProfile && (
                <>
                  <button
                    onClick={() => { onOpenInsights(); setToolsOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Profile Insights
                  </button>
                  {onOpenProfileTree && (
                    <button
                      onClick={() => { onOpenProfileTree(); setToolsOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
                      </svg>
                      My Flavor Tree
                    </button>
                  )}
                </>
              )}
              <div className="border-t border-[#2a2a3a]" />
              <button
                onClick={() => { onOpenTreeExplorer(); setToolsOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  showTreeExplorer ? 'text-neural-glow bg-neural-glow/10' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                Flavor Trees
              </button>
              <button
                onClick={() => { onOpenBridge(); setToolsOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  showBridge ? 'text-neural-glow bg-neural-glow/10' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Flavor Bridge
              </button>
              <div className="border-t border-[#2a2a3a]" />
              {user ? (
                <button
                  onClick={() => { onLogout(); setToolsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a] transition-colors"
                >
                  <img src={user.photoURL || ''} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => { onLogin(); setToolsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-[#1a1a2a] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign In
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
