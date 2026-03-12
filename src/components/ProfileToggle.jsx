import { useMemo } from 'react';

export default function ProfileToggle({
  profileMode,
  onToggleMode,
  onOpenPanel,
  onOpenInsights,
  onOpenGlobalInsights,
  profileStats,
  user,
  onLogin,
  onLogout,
}) {
  const hasProfile = useMemo(
    () => profileStats && profileStats.totalItems > 0,
    [profileStats]
  );

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2 flex-wrap">
      {/* View mode toggle */}
      <div className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg flex overflow-hidden">
        <button
          onClick={() => profileMode && onToggleMode()}
          className={`px-3 py-2 text-xs transition-colors select-none ${
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
          className={`px-3 py-2 text-xs transition-colors select-none flex items-center gap-1.5 ${
            profileMode
              ? 'bg-purple-500/20 text-purple-400'
              : hasProfile
                ? 'text-gray-500 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-400'
          }`}
          aria-label="Profile view"
          title={!hasProfile ? 'Add ingredients or cuisines to your profile first' : ''}
        >
          My Profile
          {hasProfile && (
            <span className={`inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-[10px] font-medium px-1 ${
              profileMode ? 'bg-purple-500/30 text-purple-300' : 'bg-gray-600/50 text-gray-400'
            }`}>
              {profileStats.totalItems}
            </span>
          )}
        </button>
      </div>

      {/* Edit profile button */}
      <button
        onClick={onOpenPanel}
        className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-2.5 py-2 text-xs text-gray-500 hover:text-blue-400 transition-colors select-none"
        aria-label="Edit profile"
        title="Edit flavor profile"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {/* Global Network Analysis button (Global mode) */}
      {!profileMode && (
        <button
          onClick={onOpenGlobalInsights}
          className="bg-[#0a1628]/90 backdrop-blur-md border border-cyan-900/40 rounded-lg px-2.5 py-2 text-xs text-cyan-700 hover:text-cyan-400 transition-colors select-none"
          aria-label="Network analysis"
          title="Analyze network patterns"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
        </button>
      )}

      {/* Profile Insights button (Profile mode) */}
      {hasProfile && profileMode && (
        <button
          onClick={onOpenInsights}
          className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-2.5 py-2 text-xs text-gray-500 hover:text-purple-400 transition-colors select-none"
          aria-label="Profile insights"
          title="View flavor insights"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
      )}

      {/* Auth button */}
      {user ? (
        <button
          onClick={onLogout}
          className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-2 py-1 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors select-none"
          title={`Signed in as ${user.displayName || user.email}. Click to sign out.`}
        >
          <img
            src={user.photoURL || ''}
            alt=""
            className="w-5 h-5 rounded-full"
            referrerPolicy="no-referrer"
          />
          <span className="hidden sm:inline max-w-[80px] truncate">{user.displayName?.split(' ')[0] || 'User'}</span>
          <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      ) : (
        <button
          onClick={onLogin}
          className="bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-gray-400 hover:text-blue-400 transition-colors select-none"
          title="Sign in with Google to sync your profile across devices"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="hidden sm:inline">Sign in</span>
        </button>
      )}
    </div>
  );
}
