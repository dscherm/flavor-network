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
 * When profile.drawn is false (and the list is not empty) only the plain line (profile.summary) shows, in {p}-empty.
 * Test ids: {p} root, {p}-bar-{axis} (aria-label "Sweet 42 percent"), {p}-summary, {p}-uncounted, {p}-note, {p}-empty.
 */
import { heading, small, SANS, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from './inventUi.jsx';

export default function InventFlavorProfile({ profile, title = 'Flavor profile', labels = {}, testidPrefix = 'profile' }) {
  const L = {
    empty: 'Add ingredients with flavor data to see a profile.',
    uncounted: 'Not counted (no flavor data)',
    note: 'A rough guide drawn from flavor-compound data, not how it will taste.',
    ...labels,
  };
  const p = testidPrefix;
  const bars = profile?.bars || [];
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
  const max = bars.reduce((m, b) => Math.max(m, b.score), 0) || 1;
  return (
    <div data-testid={p} className="min-w-0">
      <p className="mb-1" style={heading}>{title}</p>
      {bars.length === 0
        ? <p className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-empty`}>{L.empty}</p>
        : (
          <ul className="flex flex-col gap-1" role="list">
            {bars.map((b) => {
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
        )}
      {profile?.summary ? <p className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid={`${p}-summary`}>{profile.summary}</p> : null}
      {uncounted.length > 0 && (
        <p className="mt-1 text-[12px]" style={small} data-testid={`${p}-uncounted`}>{L.uncounted}: {uncounted.join(', ')}</p>
      )}
      <p className="mt-1 text-[12px]" style={small} data-testid={`${p}-note`}>{L.note}</p>
    </div>
  );
}
