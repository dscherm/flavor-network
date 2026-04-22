export default function ErrorCard({ onRetry, onStartOver }) {
  return (
    <div className="flex items-center justify-center w-full h-full bg-neural-bg px-4">
      <div className="text-center panel p-8 max-w-md">
        <div className="mx-auto mb-5 w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-neural-text text-base mb-6">Couldn't load the flavor network.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onStartOver}
            className="px-4 py-2 rounded-md border border-[#2a2a3a] text-neural-muted text-sm font-medium hover:text-neural-text hover:border-[#3a3a4a] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-colors"
          >
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
