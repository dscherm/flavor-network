export default function ErrorCard({ onRetry, onStartOver }) {
  return (
    <div className="flex items-center justify-center w-full h-full bg-neural-bg px-4">
      <div className="text-center panel p-8 max-w-md">
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
