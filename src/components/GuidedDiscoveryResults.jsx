// TODO Phase 4: full implementation — replace this stub with the
// curated wheel + StoryPanel composition (CuratedWheel + whyThisWorks).
//
// For Phase 3 we only need end-to-end routing wired:
//   - back-to-bubbles → App.jsx flips activeTab back to 'guided'
//   - explore-in-network → App.jsx calls deriveFilterStackFromBubbles
//     and setFilterStack, then flips activeTab to 'network'
//
// Constraint #4: this component MUST NOT call setFilterStack itself.
// The onExploreInNetwork callback is the bridge owned by App.jsx.

export default function GuidedDiscoveryResults({
  bubbleStack = [],
  onBackToBubbles,
  onExploreInNetwork,
}) {
  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-10 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="guided-discovery-results"
    >
      <div className="w-full max-w-3xl">
        <h1 className="text-xl sm:text-2xl text-white text-center font-light mb-2">
          Guided Discovery — Results
        </h1>
        <p className="text-center text-sm text-[#a8c4e8] mb-6">
          Phase 4 stub: full curated wheel + story panel coming next.
        </p>

        <div className="bg-[#12203b] border border-[#1d3158] rounded-xl p-5 mb-6">
          <p className="text-sm text-gray-300 mb-3">
            Selected: <span className="text-emerald-300 font-medium">{bubbleStack.length}</span> bubble{bubbleStack.length === 1 ? '' : 's'}.
          </p>
          <ul className="space-y-1.5 text-sm text-gray-200">
            {bubbleStack.map((b) => (
              <li key={b.key} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span>
                  <span className="text-gray-400">{b.label}:</span>{' '}
                  <span className="text-white">{JSON.stringify(b.value)}</span>
                </span>
              </li>
            ))}
            {bubbleStack.length === 0 && (
              <li className="text-gray-500 italic">No bubbles selected.</li>
            )}
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <button
            type="button"
            onClick={() => onBackToBubbles?.()}
            data-testid="guided-results-back"
            className="px-5 py-2.5 min-h-[44px] rounded-lg font-medium bg-[#1a2a4a] hover:bg-[#22345a] text-gray-200 border border-[#2c4470] transition-colors"
          >
            ← Back to bubbles
          </button>
          <button
            type="button"
            onClick={() => onExploreInNetwork?.()}
            data-testid="guided-results-explore"
            className="px-5 py-2.5 min-h-[44px] rounded-lg font-medium bg-cyan-500 hover:bg-cyan-400 text-white border border-cyan-300 shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-colors"
          >
            Explore in the network →
          </button>
        </div>
      </div>
    </div>
  );
}
