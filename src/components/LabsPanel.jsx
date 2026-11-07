/**
 * LabsPanel.jsx — the "Labs" start surface (replaces the Guided start
 * tile). A chalk card panel: one card per lab, led by a chalk drawing of
 * that lab (DESIGN-1: picture first, words second). Tapping a card routes
 * to that lab via onPick(id).
 */
import { FONT, CHALK_CREAM, CHALK_SUB, chalkSurfaceStyle } from '../data/chalkTheme.js';
import { LabArt } from './chalkArt.jsx';

const LAB_CARDS = [
  { id: 'make',     label: 'Recipe Lab',      desc: 'Cook from your kitchen, or invent', accent: '#34d399' },
  { id: 'cocktail', label: 'Cocktail Lab',    desc: 'Mix a drink by family + spirit',  accent: '#f59e0b' },
  { id: 'sauce',    label: 'Sauce Lab',       desc: 'Build a sauce from the mothers',  accent: '#fb923c' },
  { id: 'wine',     label: 'Wine Lab',        desc: 'Pair a wine with any dish',       accent: '#e11d48' },
  { id: 'cookbook', label: 'Cookbook',        desc: 'Browse curated dishes',           accent: '#ec4899' },
  { id: 'pairing',  label: 'Pairing Lab',     desc: 'Explore how ingredients pair',    accent: '#22d3ee' },
];

export default function LabsPanel({ onPick }) {
  return (
    <div
      data-testid="labs-panel"
      className="fixed inset-x-0 top-0 overflow-y-auto flex flex-col items-center"
      style={{ bottom: 'var(--tab-bar-h)',  ...chalkSurfaceStyle(), paddingTop: 'calc(var(--nav-h) + 1rem)', color: CHALK_CREAM }}
    >
      <div style={{ fontFamily: FONT, fontSize: 34, lineHeight: 1 }}>The Labs</div>
      <div style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: 13, color: CHALK_SUB, marginTop: 4, marginBottom: 16, padding: '0 24px', textAlign: 'center' }}>
        Pick a kitchen to work in.
      </div>
      <div className="w-full max-w-md grid grid-cols-2 gap-3 px-4 pb-24">
        {LAB_CARDS.map(({ id, label, desc, accent }) => (
          <button
            key={id}
            type="button"
            data-testid={`labs-card-${id}`}
            onClick={() => onPick?.(id)}
            className="flex flex-col items-center gap-1.5 rounded-xl px-2 pt-3 pb-3 text-center transition-transform active:scale-[0.98]"
            style={{ background: 'rgba(10,10,10,0.55)', border: `2px double ${accent}`, boxShadow: `inset 0 0 0 1px #6a6a6a33, 0 0 18px ${accent}33` }}
            aria-label={`${label} — ${desc}`}
          >
            <LabArt id={id} accent={accent} size={84} />
            <div style={{ fontFamily: FONT, fontSize: 24, lineHeight: 1, color: accent, marginTop: 2 }}>{label}</div>
            <div style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: 12, lineHeight: 1.3, color: CHALK_SUB }}>{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
