import { useMemo } from 'react';

/**
 * ProfileToggle — switch between Global View and My Profile view mode.
 * Also opens the profile panel for editing preferences.
 */
export default function ProfileToggle({
  profileMode,
  onToggleMode,
  onOpenPanel,
  profileStats,
}) {
  const hasProfile = useMemo(
    () => profileStats && profileStats.totalItems > 0,
    [profileStats]
  );

  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2">
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
    </div>
  );
}
