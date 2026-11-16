/**
 * InventFlavorProfile — the taste and aroma profile of the list as a compact bar
 * chart of the firing axes in their axis colours, a one-line summary, the
 * ingredients that had no data, and a note that it is a visual guide.
 * Lab-agnostic: takes the object from inventProfile.buildFlavorProfile.
 *
 * (The recipe creator's chart components are tied to its card and the recipe
 * lab, so this draws its own small accessible bars from `profile.bars`.)
 *
 * Props
 *   profile       { bars: [{ axis, label, color, score }], summary, uncounted: [key], counted? }
 *   title         string, default "Flavor profile"
 *   labels        { empty, uncounted, note }
 *   testidPrefix  default 'profile'
 *   surface       flavorDisplay surface, default 'compact' (4 tastes + 4 aromas, "show all")
 * When profile.drawn is false (and the list is not empty) only the plain line (profile.summary) shows, in {p}-empty.
 * AROMA-4: shows the display rule (flavorDisplay.js): Taste and Aroma groups under headings, strongest first, at most the
 * surface's maximum per group, then "+N fainter notes" and a show-all toggle. Test ids add {p}-group-taste|aroma, {p}-hidden, {p}-showall.
 * Test ids: {p} root, {p}-bar-{axis} (aria-label "Sweet 42 percent"), {p}-summary, {p}-uncounted, {p}-note, {p}-empty.
 */
import { useState } from 'react';
import { groupBars, hiddenLine } from '../data/flavorDisplay.js';
import { heading, small, SANS, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from './inventUi.jsx';

export default function InventFlavorProfile({ profile, title = 'Flavor profile', labels = {}, testidPrefix = 'profile', surface = 'compact' }) {
  const [all, setAll] = useState(false);
  const L = {
    empty: 'Add ingredients with flavor data to see a profile.',
    uncounted: 'Not counted (no flavor data)',
    note: 'Built from taste labels and aroma notes for each ingredient, weighted by amount. A guide, not a taste test.',
    ...labels,
  };
  const p = testidPrefix;
  const shown = groupBars(profile?.bars || [], surface, { all });
  const bars = shown.bars;
  const uncounted = profile?.uncounted || [];
  // The draw rule said no chart (too few ingredients with real flavor values): one plain line, no bars.
  const noChart = profile?.drawn === false && (profile.counted?.length || 0) + uncounted.length > 0;
  if (noChart) {
    return (
      <div data-testid={p} className="min-w-0">
        <p className="mb-1" style={heading}>{title}</p>
        <p className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-empty`}>{profile.summary || 'Not enough flavor data for a chart yet.'}</p>
      </div>
    );
  }
  const max = (profile?.bars || []).reduce((m, b) => Math.max(m, b.score), 0) || 1;
  return (
    <div data-testid={p} className="min-w-0">
      <p className="mb-1" style={heading}>{title}</p>
      {bars.length === 0
        ? <p className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-empty`}>{L.empty}</p>
        : (
          <div className="flex flex-col gap-2">
            {shown.groups.map((g) => (
              <div key={g.id} data-testid={`${p}-group-${g.id}`}>
                <p className="mb-0.5 text-[11px] uppercase tracking-wider" style={{ fontFamily: SANS, color: CHALK_SUB }}>{g.title}</p>
                <ul className="flex flex-col gap-1" role="list">
                  {g.bars.map((b) => {
                    const pct = Math.round(Math.min(1, b.score) * 100);
                    return (
                      <li key={b.axis} role="listitem" aria-label={`${b.label} ${pct} percent`} data-testid={`${p}-bar-${b.axis}`} className="flex items-center gap-2 min-w-0">
                        <span className="w-20 flex-shrink-0 text-[13px] truncate" style={{ fontFamily: SANS, color: CHALK_CREAM }}>{b.label}</span>
                        <span className="flex-1 min-w-0 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${CHALK_RAIL}` }}>
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(3, (b.score / max) * 100)}%`, background: b.color }} />
                        </span>
                        <span className="w-10 flex-shrink-0 text-right text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {(shown.hidden > 0 || all) && (
              <p className="text-[12px] flex items-center gap-2" style={small}>
                {shown.hidden > 0 && <span data-testid={`${p}-hidden`}>{hiddenLine(shown.hidden)}</span>}
                {(shown.canShowAll || all) && (
                  <button type="button" className="underline min-h-[44px] px-2" style={{ color: CHALK_DIM }} data-testid={`${p}-showall`} aria-pressed={all} onClick={() => setAll((v) => !v)}>
                    {all ? 'show fewer' : 'show all'}
                  </button>
                )}
              </p>
            )}
          </div>
        )}
      {profile?.summary ? <p className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid={`${p}-summary`}>{profile.summary}</p> : null}
      {uncounted.length > 0 && (
        <p className="mt-1 text-[12px]" style={small} data-testid={`${p}-uncounted`}>{L.uncounted}: {uncounted.join(', ')}</p>
      )}
      <p className="mt-1 text-[12px]" style={small} data-testid={`${p}-note`}>{L.note}</p>
    </div>
  );
}
