/**
 * TierBadge — disambiguates a flavor-graph term that appears at more than
 * one tier. Currently only "pungent" carries this dual-tier risk:
 *   - Tier-2 taste  = chemoreceptor activation (chili / mustard).
 *   - Tier-3 mouthfeel = lingering nasal/cavity sensation (menthol).
 *
 * The badge is always paired with the term it qualifies. Two visual
 * modes — `superscript` (compact, for chip text) and `pill` (standalone).
 * Accessible name reads as "Tier-2 taste" / "Tier-3 mouthfeel" so a
 * screen reader can disambiguate without sighted-only color cues.
 */
const TIER_META = {
  2: { label: 'Tier-2 taste',     compact: '²' },
  3: { label: 'Tier-3 mouthfeel', compact: '³' },
};

export default function TierBadge({ tier, variant = 'superscript' }) {
  const meta = TIER_META[tier];
  if (!meta) return null;
  if (variant === 'pill') {
    return (
      <span
        aria-label={meta.label}
        className="inline-flex items-center px-1.5 py-px ml-1 text-[9px] uppercase tracking-wider font-semibold rounded bg-gray-700/60 text-gray-300"
      >
        {`T${tier}`}
      </span>
    );
  }
  return (
    <sup
      aria-label={meta.label}
      className="ml-0.5 text-[8px] font-semibold text-gray-400 select-none"
    >
      {meta.compact}
    </sup>
  );
}
