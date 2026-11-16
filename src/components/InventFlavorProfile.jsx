/**
 * InventFlavorProfile — the taste and aroma profile of a recipe or list: CHART-3's FlavorSwipe (a tasting-note sentence
 * with Taste and Aroma strips, swipe to a fixed seventeen-wedge wheel), a one-line summary, the ingredients that had no
 * data, and a note that it is a visual guide. Shared by the three invent panels, the shared recipe page and the
 * "Flavor profile" button on recipe cards. Lab-agnostic: takes the object from inventProfile.buildFlavorProfile.
 *
 * Props
 *   profile       { bars: [{ axis, label, color, score }], summary, uncounted: [key], counted?, drawn? }
 *   title         string, default "Flavor profile"
 *   labels        { empty, uncounted, note }
 *   testidPrefix  default 'profile'
 *   surface       flavorDisplay surface (kept for callers; the chart no longer caps notes, so it has no effect)
 * When profile.drawn is false (and the list is not empty) only the plain line (profile.summary) shows, in {p}-empty.
 * The one-line summary shows only where no tasting-note sentence is drawn (it would repeat it).
 * CHART-3 replaced the capped bar groups and the "show all" toggle: every note above the floor is in the sentence/strips,
 * the wheel and a visually hidden ranked list. Test ids: {p} root, {p}-bar-{axis} (hidden list, aria-label "Sweet 42
 * percent"), {p}-sentence, {p}-swipe, {p}-dot-note|wheel, {p}-summary, {p}-uncounted, {p}-note, {p}-empty.
 */
import FlavorSwipe from './FlavorSwipe.jsx';
import { groupBars } from '../data/flavorDisplay.js';
import { heading, small, SANS, CHALK_CREAM, CHALK_SUB } from './inventUi.jsx';

export default function InventFlavorProfile({ profile, title = 'Flavor profile', labels = {}, testidPrefix = 'profile', surface = 'compact' }) {
  const L = {
    empty: 'Add ingredients with flavor data to see a profile.',
    uncounted: 'Not counted (no flavor data)',
    note: 'Built from taste labels and aroma notes for each ingredient, weighted by amount. A guide, not a taste test.',
    ...labels,
  };
  const p = testidPrefix;
  const bars = groupBars(profile?.bars || [], surface, { all: true }).bars;
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
  return (
    <div data-testid={p} className="min-w-0">
      <p className="mb-1" style={heading}>{title}</p>
      {bars.length === 0
        ? <p className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-empty`}>{L.empty}</p>
        : (
          <FlavorSwipe bars={profile.bars} testidPrefix={p} />
        )}
      {bars.length === 0 && profile?.summary ? <p className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }} data-testid={`${p}-summary`}>{profile.summary}</p> : null}
      {uncounted.length > 0 && (
        <p className="mt-1 text-[12px]" style={small} data-testid={`${p}-uncounted`}>{L.uncounted}: {uncounted.join(', ')}</p>
      )}
      <p className="mt-1 text-[12px]" style={small} data-testid={`${p}-note`}>{L.note}</p>
    </div>
  );
}
