import { useEffect, useState } from 'react';
import { MODE_CYCLE, MODE_LABELS } from '../data/networkModes.js';

const LABS = [
  { id: 'cookbook', label: 'Cookbook',         desc: 'Browse saved recipes' },
  { id: 'cocktail', label: 'Cocktail Lab',     desc: 'Mix a drink' },
  { id: 'sauce',    label: 'Sauce Lab',        desc: 'Build a sauce' },
  { id: 'recipe',   label: 'Recipe Notebook',  desc: 'Handwritten notebook' },
  { id: 'molecule', label: 'Molecule Lab',     desc: 'Inspect a compound' },
  { id: 'profile',  label: 'Profile',          desc: 'Saved recipes & insights' },
];

/**
 * MobileTabBar — bottom-of-viewport nav. B-version rev (2026-06-03):
 *   - Tab order: Guided → Make → Model → Profile (was Explore/Guided/
 *     Make/Profile with Explore first).
 *   - "Explore" renamed to "Model"; tap-when-active dropdown is now
 *     restricted to 3D Network / 2D Network sub-options only (Cocktail
 *     Lab / Sauce Lab / Cookbook / Recipes Notebook are reachable via
 *     the floating Labs FAB instead).
 *   - Bar shows on both mobile AND desktop (the desktop top nav is
 *     retired in this rev — see App.jsx).
 */
export default function MobileTabBar({
  activeTab,
  onTabChange,
  networkMode = '3D',
  onNetworkModeChange,
  onSelectLab,
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);

  const isGuidedActive = ['guided', 'guided-results', 'guided-pairing'].includes(activeTab);
  const isMakeActive = activeTab === 'make';
  // The Model pillar is the network surface (3D / 2D variants).
  const isModelActive = activeTab === 'network';
  const isLabsActive = ['cookbook', 'cocktail', 'sauce', 'recipe', 'profile'].includes(activeTab);

  const closeAll = () => { setModelOpen(false); setLabsOpen(false); };

  useEffect(() => {
    if (!modelOpen && !labsOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeAll(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modelOpen, labsOpen]);

  return (
    <>
      {(modelOpen || labsOpen) && (
        <div className="fixed inset-0 z-[99]" onClick={closeAll} />
      )}

      <div
        data-testid="mobile-tab-bar"
        className="fixed bottom-0 inset-x-0 z-[100] bg-[#0a0a12]/95 backdrop-blur-md border-t border-[#1e1e2e]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14">
          {/* Guided */}
          <button
            onClick={() => { onTabChange('guided'); closeAll(); }}
            data-testid="tabbar-guided"
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

          {/* Make */}
          <button
            onClick={() => { onTabChange('make'); closeAll(); }}
            data-testid="tabbar-make"
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              isMakeActive ? 'text-pink-400' : 'text-gray-500'
            }`}
            aria-label="Make"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px]">Make</span>
          </button>

          {/* Model — was "Explore". Tap-when-active opens a 3D/2D
              sub-menu; tap-when-inactive jumps to the network tab. */}
          <div className="relative">
            <button
              onClick={() => {
                if (isModelActive) {
                  setModelOpen((v) => !v);
                } else {
                  onTabChange('network');
                  setModelOpen(false);
                }
              }}
              data-testid="tabbar-model"
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isModelActive ? 'text-cyan-400' : 'text-gray-500'
              }`}
              aria-label="Model"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span className="text-[10px]">Model</span>
            </button>
            {modelOpen && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[101] overflow-hidden"
                data-testid="tabbar-model-menu"
              >
                <span className="block px-3 py-1 text-[9px] uppercase tracking-widest text-gray-600 border-b border-[#2a2a3a]">
                  Network mode
                </span>
                {MODE_CYCLE.map((m) => (
                  <button
                    key={m}
                    onClick={() => { onNetworkModeChange?.(m); closeAll(); }}
                    data-testid={`tabbar-model-mode-${m}`}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] text-xs font-medium transition-colors ${
                      networkMode === m
                        ? 'text-cyan-300 bg-cyan-500/10'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a2a]'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Labs — popover entry to every lab + Recipe Notebook + Profile.
              Replaces both the previous Profile slot and the floating
              LabsFab; bottom-bar Labs is the single nav surface for
              the secondary destinations now. */}
          <div className="relative">
            <button
              onClick={() => {
                setLabsOpen((v) => !v);
                setModelOpen(false);
              }}
              data-testid="tabbar-labs"
              aria-expanded={labsOpen ? 'true' : 'false'}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isLabsActive ? 'text-emerald-300' : 'text-gray-500'
              }`}
              aria-label="Labs"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v6.5L4.5 18.5A2 2 0 006.25 21.5h11.5A2 2 0 0019.5 18.5L14 9.5V3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6" />
              </svg>
              <span className="text-[10px]">Labs</span>
            </button>
            {labsOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 w-56 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-xl z-[101] overflow-hidden"
                data-testid="tabbar-labs-menu"
              >
                {LABS.map((lab) => (
                  <button
                    key={lab.id}
                    onClick={() => {
                      closeAll();
                      if (onSelectLab) onSelectLab(lab.id);
                      else onTabChange(lab.id);
                    }}
                    data-testid={`tabbar-labs-item-${lab.id}`}
                    className="w-full text-left px-3 py-2 min-h-[44px] hover:bg-white/5 flex flex-col"
                  >
                    <span className="text-[13px] text-gray-100 leading-tight">{lab.label}</span>
                    <span className="text-[11px] text-gray-500 leading-tight">{lab.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
