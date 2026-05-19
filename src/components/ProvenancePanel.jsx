/**
 * ProvenancePanel — Phase 4 (ralplan track-3-guided-overhaul).
 *
 * Static modal explaining where Guided Discovery's data comes from.
 * Opened by the "Show me where this data comes from" button on the
 * Guided Results page (wired in P6 — not handled here).
 *
 * ADR-4: replaces GuidedTour for the Guided Results surface.
 * GuidedTour.jsx is left untouched (Risk #3 mitigation).
 */
import { useEffect } from 'react';

const SOURCES = [
  {
    name: 'RecipeNLG',
    detail: '2.2M recipes → ingredient co-occurrence + PMI (40% weight)',
  },
  {
    name: 'TheMealDB',
    detail: '595 meals → co-occurrence (15% weight)',
  },
  {
    name: 'TheCocktailDB',
    detail: '426 drinks → co-occurrence (15% weight)',
  },
  {
    name: 'FlavorDB',
    detail: 'Chemical compound overlap (30% weight)',
  },
  {
    name: 'GNN',
    detail:
      'Multi-task taste + aroma classifier — 19,902 unique-SMILES compounds, 5-fold CV, 11 heads (sweet / sour / bitter / umami + 6 aroma)',
  },
  {
    name: 'ChemTastesDB v2.1',
    detail: '3,849 sweet / sour / bitter / umami / salty compounds (Zenodo 15051366)',
  },
  {
    name: 'Ground truth',
    detail:
      'Briscione palette — curated taste + aroma axes from chef-user interviews; defines the 8 taste and 6 aroma sectors used throughout the app',
  },
];

export default function ProvenancePanel({ open, onClose }) {
  // Escape key closes
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-hidden="false"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="provenance-panel-title"
        className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-[#12121a] border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/10">
          <h2
            id="provenance-panel-title"
            className="text-white font-semibold text-lg leading-snug"
          >
            Where does this data come from?
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 flex-shrink-0 text-white/50 hover:text-white transition-colors rounded-lg p-1 -mr-1"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Source list */}
        <ul className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {SOURCES.map(({ name, detail }) => (
            <li key={name} className="flex gap-3">
              <span className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full bg-amber-400/80 self-start translate-y-1.5" />
              <span className="text-sm text-white/80 leading-relaxed">
                <span className="font-medium text-white">{name}</span>
                {' — '}
                {detail}
              </span>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 flex justify-end border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
