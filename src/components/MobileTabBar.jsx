import { useEffect, useState } from 'react';

// Labs popover destinations. The Flavor Network (the 3D pairing map) is
// surfaced here again (2026-06-25) now that the Pairing Lab gives it a
// clear purpose + an on-ramp; the "Molecule Lab" compound inspector
// remains retired.
const LABS = [
  { id: 'cookbook', label: 'Cookbook',         desc: 'Browse saved recipes' },
  { id: 'cocktail', label: 'Cocktail Lab',     desc: 'Mix a drink' },
  { id: 'sauce',    label: 'Sauce Lab',        desc: 'Build a sauce' },
  { id: 'pairing',  label: 'Pairing Lab',      desc: 'Explore flavor pairings' },
  { id: 'network',  label: 'Flavor Network',   desc: 'The full 3D pairing map' },
  { id: 'recipe',   label: 'Recipe Notebook',  desc: 'Handwritten notebook' },
  { id: 'profile',  label: 'Profile',          desc: 'Saved recipes & insights' },
];

/**
 * MobileTabBar — bottom-of-viewport nav: Guided · Make · Labs.
 *
 * The molecular lab (network "Model" tab + its 3D/2D modes + the Molecule
 * Lab compound inspector) is hidden for now — the kitchen flows are the
 * product. "How it works" moved into the Labs popover since its old home
 * (the network dropdown) went with the network. Shows on mobile + desktop.
 */
export default function MobileTabBar({
  activeTab,
  onTabChange,
  onSelectLab,
  onOpenHowItWorks,
}) {
  const [labsOpen, setLabsOpen] = useState(false);

  const isGuidedActive = ['guided', 'guided-results', 'guided-pairing', 'guided-details'].includes(activeTab);
  const isMakeActive = activeTab === 'make';
  const isLabsActive = ['cookbook', 'cocktail', 'sauce', 'recipe', 'profile'].includes(activeTab);

  const closeAll = () => setLabsOpen(false);

  useEffect(() => {
    if (!labsOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeAll(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [labsOpen]);

  return (
    <>
      {labsOpen && (
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

          {/* Labs — popover to every lab + Recipe Notebook + Profile, plus
              the rehomed "How it works" explainer. */}
          <div className="relative">
            <button
              onClick={() => setLabsOpen((v) => !v)}
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
                {onOpenHowItWorks && (
                  <button
                    onClick={() => { closeAll(); onOpenHowItWorks(); }}
                    data-testid="tabbar-labs-item-how-it-works"
                    className="w-full text-left px-3 py-2 min-h-[44px] hover:bg-white/5 flex items-center gap-2 border-t border-[#2a2a3a]"
                  >
                    <span className="w-4 h-4 rounded-full border border-gray-500 text-gray-400 flex items-center justify-center text-[10px] font-bold leading-none">?</span>
                    <span className="text-[13px] text-gray-300 leading-tight">How it works</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
