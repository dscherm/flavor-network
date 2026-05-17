/**
 * CuisineChip — Stage 3 of the cuisine-pairings ingestion.
 *
 * Tiny inline chip that surfaces the cuisine attribution for a
 * cuisine-anchored pair. Renders next to the existing affinity tier
 * badge so the user understands why a "Surprising" pair is in fact
 * a chef-validated combo.
 *
 * Props:
 *   - record  cuisine-pair record (see src/data/cuisinePairings.js)
 *   - compact boolean — true for narrow surfaces; hides the count
 */
import { cuisineColor, displayableCuisine } from '../data/cuisinePairings.js';

export default function CuisineChip({ record, compact = false }) {
  if (!record) return null;
  const cui = displayableCuisine(record);
  if (!cui) return null;
  const color = cuisineColor(cui);
  const primary = record.evidence[0];
  const tooltip = `Foundational in ${cui} cooking — appears in ${primary.count.toLocaleString()} tagged ${cui} recipes (${Math.round(primary.recipePct * 100)}% of the corpus).`;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
      style={{
        color,
        background: `${color}22`,
        border: `1px solid ${color}66`,
      }}
      title={tooltip}
      data-cuisine-chip={cui}
    >
      <span
        aria-hidden="true"
        className="inline-block rounded-full"
        style={{ width: 5, height: 5, background: color }}
      />
      {cui}
      {!compact && <span className="opacity-70">· {primary.count.toLocaleString()}</span>}
    </span>
  );
}
