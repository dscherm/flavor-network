/**
 * GuidedResultsFilterPills — single-select pill row for the Guided
 * Results page. Shows 4 filter types: Taste, Aroma, Season, Region.
 *
 * ADR-5 (ralplan-track-3-guided-overhaul): FORK of FilterPillRow.jsx.
 * FilterPillRow is a multi-select checkbox group on the live network
 * surface. This component is a single-select radio group for Guided
 * Results only. Forked to avoid a role-flip on a hot-path component.
 * Do NOT modify FilterPillRow.jsx for Guided purposes.
 *
 * Props:
 *   current  — 'taste' | 'aroma' | 'season' | 'cuisine'
 *   onSelect — (nextType: string) => void
 *   className — optional extra classes on the wrapper div
 */

import {
  AromaHeaderIcon,
  SeasonHeaderIcon,
  CuisineHeaderIcon,
} from './guidedIcons.jsx';
import { FONT, CHALK_CREAM, CHALK_RAIL } from '../data/chalkTheme.js';

// TasteIcon: tongue / taste-bud silhouette (inline — Guided-only, no
// existing taste header icon in guidedIcons.jsx).
function TasteIcon({ className = 'w-4 h-4 flex-shrink-0' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3C7 3 4 7 4 11c0 5 3 8 8 10 5-2 8-5 8-10 0-4-3-8-8-8z" />
      <path d="M9 14c0-2 1-3 3-3s3 1 3 3" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const PILLS = [
  { type: 'taste',   label: 'Taste',  Icon: TasteIcon },
  { type: 'aroma',   label: 'Aroma',  Icon: AromaHeaderIcon },
  { type: 'season',  label: 'Season', Icon: SeasonHeaderIcon },
  { type: 'cuisine', label: 'Region', Icon: CuisineHeaderIcon },
];

export default function GuidedResultsFilterPills({
  current,
  onSelect,
  className = '',
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Result filter type"
      className={`flex items-center gap-2 px-2 py-1 overflow-x-auto ${className}`}
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}
    >
      {PILLS.map(({ type, label, Icon }) => {
        const isActive = current === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => {
              if (!isActive) onSelect?.(type);
            }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 text-sm rounded-full transition-colors whitespace-nowrap border"
            style={{
              minHeight: 38,
              fontFamily: FONT,
              color: isActive ? '#0a0a0a' : CHALK_CREAM,
              background: isActive ? CHALK_CREAM : 'rgba(255,255,255,0.04)',
              borderColor: isActive ? CHALK_CREAM : `${CHALK_RAIL}99`,
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
