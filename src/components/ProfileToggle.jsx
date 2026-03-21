import { useMemo } from 'react';

export default function ProfileToggle({
  profileMode,
  onToggleMode,
  profileStats,
}) {
  const hasProfile = useMemo(
    () => profileStats && profileStats.totalItems > 0,
    [profileStats]
  );

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
    </div>
  );
}
