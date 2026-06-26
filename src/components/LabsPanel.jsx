/**
 * LabsPanel.jsx — the "Labs" start surface (replaces the Guided start
 * tile). A chalk card panel: one icon'd card per lab. Tapping a card
 * routes to that lab via onPick(id).
 */
import { FONT, CHALK_CREAM, CHALK_SUB, chalkSurfaceStyle } from '../data/chalkTheme.js';

// ── per-lab chalk line-art icons (viewBox 0 0 100 100, stroke = accent) ──
function CocktailIcon({ c }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <path d="M22 28 L78 28 L52 58 L52 78 M38 78 L66 78 M52 58 L52 78" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="62" cy="36" r="3" fill={c} />
    </svg>
  );
}
function SauceIcon({ c }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <path d="M26 44 L74 44 L70 78 Q70 82 66 82 L34 82 Q30 82 30 78 Z" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" />
      <path d="M74 50 L88 50 L88 58 L74 58" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" />
      <path d="M40 36 Q44 28 48 36 M52 34 Q56 26 60 34" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function CookbookIcon({ c }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <path d="M28 24 L66 24 Q74 24 74 32 L74 80 L36 80 Q28 80 28 72 Z" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" />
      <path d="M36 80 Q28 80 28 72 Q28 78 36 76 L74 76" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" />
      <line x1="40" y1="38" x2="64" y2="38" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="48" x2="60" y2="48" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function PairingIcon({ c }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <line x1="50" y1="50" x2="26" y2="30" stroke={c} strokeWidth="2.5" />
      <line x1="50" y1="50" x2="76" y2="32" stroke={c} strokeWidth="2.5" />
      <line x1="50" y1="50" x2="30" y2="74" stroke={c} strokeWidth="2.5" />
      <line x1="50" y1="50" x2="72" y2="72" stroke={c} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="9" fill="none" stroke={c} strokeWidth="3" />
      <circle cx="26" cy="30" r="5" fill={c} />
      <circle cx="76" cy="32" r="5" fill={c} />
      <circle cx="30" cy="74" r="5" fill={c} />
      <circle cx="72" cy="72" r="5" fill={c} />
    </svg>
  );
}
function NotebookIcon({ c }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <rect x="28" y="22" width="44" height="56" rx="3" fill="none" stroke={c} strokeWidth="3" />
      <line x1="38" y1="34" x2="62" y2="34" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="38" y1="44" x2="62" y2="44" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M58 70 L70 58 L78 66 L66 78 Z" fill="none" stroke={c} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

const LAB_CARDS = [
  { id: 'cocktail', label: 'Cocktail Lab',    desc: 'Mix a drink by family + spirit',  accent: '#f59e0b', Icon: CocktailIcon },
  { id: 'sauce',    label: 'Sauce Lab',       desc: 'Build a sauce from the mothers',  accent: '#fb923c', Icon: SauceIcon },
  { id: 'cookbook', label: 'Cookbook',        desc: 'Browse curated dishes',           accent: '#ec4899', Icon: CookbookIcon },
  { id: 'pairing',  label: 'Pairing Lab',     desc: 'Explore how ingredients pair',    accent: '#22d3ee', Icon: PairingIcon },
  { id: 'recipe',   label: 'Recipe Notebook', desc: 'Write a recipe by hand',          accent: '#34d399', Icon: NotebookIcon },
];

export default function LabsPanel({ onPick }) {
  return (
    <div
      data-testid="labs-panel"
      className="fixed inset-0 overflow-y-auto flex flex-col items-center"
      style={{ ...chalkSurfaceStyle(), paddingTop: 'calc(var(--nav-h) + 1rem)', color: CHALK_CREAM }}
    >
      <div style={{ fontFamily: FONT, fontSize: 34, lineHeight: 1 }}>The Labs</div>
      <div style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: 13, color: CHALK_SUB, marginTop: 4, marginBottom: 16, padding: '0 24px', textAlign: 'center' }}>
        Pick a kitchen to work in.
      </div>
      <div className="w-full max-w-md grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pb-24">
        {LAB_CARDS.map(({ id, label, desc, accent, Icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`labs-card-${id}`}
            onClick={() => onPick?.(id)}
            className="flex items-center gap-3 rounded-xl p-4 text-left transition-transform active:scale-[0.98]"
            style={{ background: 'rgba(10,10,10,0.55)', border: `2px double ${accent}`, boxShadow: `inset 0 0 0 1px #6a6a6a33, 0 0 18px ${accent}33` }}
            aria-label={`${label} — ${desc}`}
          >
            <div style={{ width: 44, height: 44, flexShrink: 0 }}><Icon c={accent} /></div>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 22, lineHeight: 1, color: accent }}>{label}</div>
              <div style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontSize: 12, color: CHALK_SUB, marginTop: 3 }}>{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
