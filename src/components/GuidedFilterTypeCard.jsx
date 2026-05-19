/**
 * GuidedFilterTypeCard — Screen 2 of the Guided Discovery 3-screen flow.
 *
 * After the user picks an ingredient (Screen 1), they land here to choose
 * WHAT kind of pairing filter to apply before the results screen.
 *
 * Props:
 *   onCommit(filterType: 'taste' | 'aroma' | 'season' | 'cuisine') — fires
 *     exactly once when the user confirms their selection via "Got it".
 *   className? — additional Tailwind classes for the outer wrapper.
 *
 * Behavior:
 *   - Single-select: one pill highlighted at a time.
 *   - "Got it" button is disabled until a pill is chosen.
 *   - No auto-advance — card stays mounted until "Got it" fires.
 *   - aria-live="polite" announces the chosen type on selection.
 */
import { useState, useRef } from 'react';
import {
  AromaHeaderIcon,
  SeasonHeaderIcon,
  CuisineHeaderIcon,
} from './guidedIcons.jsx';

// Taste icon — inline since guidedIcons doesn't export a standalone TasteIcon.
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
      {/* tongue with taste buds — universal "taste" cue */}
      <path d="M12 3C7 3 4 7 4 11c0 5 4 10 8 10s8-5 8-10c0-4-3-8-8-8z" />
      <circle cx="9"  cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const PILLS = [
  {
    key: 'taste',
    label: 'a taste',
    Icon: TasteIcon,
    color: '#f9a8d4', // pink-300
    activeColor: '#ec4899',
  },
  {
    key: 'aroma',
    label: 'an aroma',
    Icon: AromaHeaderIcon,
    color: '#c4b5fd', // violet-300
    activeColor: '#a78bfa',
  },
  {
    key: 'season',
    label: 'in season',
    Icon: SeasonHeaderIcon,
    color: '#6ee7b7', // emerald-300
    activeColor: '#34d399',
  },
  {
    key: 'cuisine',
    label: 'from a region',
    Icon: CuisineHeaderIcon,
    color: '#93c5fd', // sky-300
    activeColor: '#60a5fa',
  },
];

export default function GuidedFilterTypeCard({ onCommit, className = '' }) {
  const [chosen, setChosen] = useState(null);
  const announcerRef = useRef(null);

  function handlePillClick(key) {
    setChosen(key);
    if (announcerRef.current) {
      const pill = PILLS.find((p) => p.key === key);
      announcerRef.current.textContent = '';
      // Force re-announce even if same value by toggling
      requestAnimationFrame(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = `Filtering by ${pill.label}`;
        }
      });
    }
  }

  function handleCommit() {
    if (chosen) {
      onCommit(chosen);
    }
  }

  return (
    <div
      data-testid="guided-filter-type-card"
      className={`flex flex-col items-center gap-6 px-6 py-8 bg-[#0a0a0f] text-white ${className}`}
    >
      {/* aria-live region for screen readers */}
      <div
        ref={announcerRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      />

      <h2 className="text-xl font-semibold text-center leading-snug">
        Discover pairings that are&hellip;
      </h2>

      {/* Pill group */}
      <div
        role="radiogroup"
        aria-label="Filter type"
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        {PILLS.map(({ key, label, Icon, color, activeColor }) => {
          const isActive = chosen === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => handlePillClick(key)}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-colors text-left"
              style={{
                borderColor: isActive ? activeColor : 'rgba(42, 42, 58, 1)',
                background: isActive
                  ? `${activeColor}22`
                  : 'rgba(10, 20, 40, 0.6)',
                color: isActive ? activeColor : color,
              }}
            >
              <span
                data-filter-icon={key}
                style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <Icon className="w-12 h-12 flex-shrink-0" />
              </span>
              <span className="text-base font-medium capitalize">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Got it button */}
      <button
        type="button"
        onClick={handleCommit}
        disabled={!chosen}
        aria-disabled={!chosen ? 'true' : 'false'}
        className="mt-2 px-8 py-3 rounded-full font-semibold text-sm transition-colors"
        style={{
          background: chosen ? '#60a5fa' : 'rgba(42, 42, 58, 1)',
          color: chosen ? '#0a0a0f' : 'rgba(100, 100, 120, 1)',
          cursor: chosen ? 'pointer' : 'not-allowed',
        }}
      >
        Got it
      </button>
    </div>
  );
}
