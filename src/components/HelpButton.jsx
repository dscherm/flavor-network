function HelpButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Show guided tour"
      title="Show guided tour"
      style={{ top: 'var(--nav-h)' }}
      className={
        'fixed left-4 z-50 w-8 h-8 hidden sm:flex items-center justify-center ' +
        'rounded-full bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] ' +
        'text-gray-400 text-sm font-bold ' +
        'transition-all duration-200 ' +
        'hover:text-cyan-300 hover:border-cyan-500/40 ' +
        'hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] ' +
        'focus:outline-none focus:ring-1 focus:ring-cyan-500'
      }
    >
      ?
    </button>
  );
}

export default HelpButton;
