/**
 * InsightChip — single-line floating chip surfaced under the filter
 * control stack, narrating what the current (filterStack, pullStrength,
 * visibleCount) layout means.
 *
 * R19 Phase 1A — Tier A from .omc/drafts/r19-narrative-insights-brainstorm.md.
 * Pure derived state, no LLM, no new data sources. Templates rotate
 * by pull range when one filter is active:
 *   pull <  0.30        → cooccurrence-dominant
 *   0.30 ≤ pull ≤ 0.70  → tension layout
 *   pull >  0.70        → bucket-dominant, names the largest bucket
 * Multi-filter overrides the pull split and surfaces intersection
 * cardinality + densest bucket instead.
 *
 * Hidden when filterStack is empty.
 */

import { FILTER_LABELS } from '../data/networkModes.js';

const AXIS_NICE_LABEL = {
  aromas: 'aroma',
  cuisine: 'cuisine',
  season: 'season',
  family: 'family',
  taste: 'taste',
};

function pluralizeIngredients(n) {
  return `${n} ingredient${n === 1 ? '' : 's'}`;
}

function topBucket(bucketCounts) {
  if (!bucketCounts) return null;
  let bestLabel = null;
  let bestCount = -1;
  for (const label of Object.keys(bucketCounts)) {
    const c = bucketCounts[label];
    if (c > bestCount) { bestLabel = label; bestCount = c; }
  }
  if (bestCount <= 0) return null;
  return { label: bestLabel, count: bestCount };
}

function nonEmptyBucketCount(bucketCounts) {
  if (!bucketCounts) return 0;
  let n = 0;
  for (const k of Object.keys(bucketCounts)) {
    if (bucketCounts[k] > 0) n++;
  }
  return n;
}

/**
 * Pure derivation of the sentence shown by the chip. Exported so each
 * template branch can be unit-tested without rendering.
 */
export function insightSentence({
  filterStack = [],
  pullStrength = 0,
  visibleCount = null,
  morphAxis = null,
  bucketCounts = null,
}) {
  if (!filterStack || filterStack.length === 0) return null;

  if (filterStack.length > 1) {
    const chain = filterStack.map((f) => FILTER_LABELS[f] || f).join(' × ');
    const count = visibleCount != null ? visibleCount : 0;
    const verb = count === 1 ? 'matches' : 'match';
    const top = topBucket(bucketCounts);
    const densePart = top ? ` Densest: ${top.label} (${top.count}).` : '';
    return `${pluralizeIngredients(count)} ${verb} ${chain}.${densePart}`;
  }

  const axisLabel = morphAxis ? (AXIS_NICE_LABEL[morphAxis] || morphAxis) : null;
  const pull = typeof pullStrength === 'number' ? pullStrength : 0;
  const ingN = visibleCount != null ? visibleCount : 0;

  if (pull < 0.30) {
    if (!axisLabel) {
      return `Layout shows cooccurrence pairings. ${pluralizeIngredients(ingN)}.`;
    }
    const bucketN = nonEmptyBucketCount(bucketCounts);
    return `Layout shows cooccurrence pairings within ${axisLabel} buckets. ${bucketN} bucket${bucketN === 1 ? '' : 's'}, ${pluralizeIngredients(ingN)}.`;
  }

  if (pull <= 0.70) {
    return 'Tension layout — strong pairings resist the pull.';
  }

  const top = topBucket(bucketCounts);
  if (!axisLabel || !top) {
    return 'Layout shows bucket structure.';
  }
  return `Layout shows ${axisLabel} bucket structure. Largest: ${top.label} (${top.count}).`;
}

export default function InsightChip({
  filterStack = [],
  pullStrength = 0,
  visibleCount = null,
  morphAxis = null,
  bucketCounts = null,
}) {
  const sentence = insightSentence({ filterStack, pullStrength, visibleCount, morphAxis, bucketCounts });
  if (!sentence) return null;

  return (
    <div
      role="note"
      aria-label="Layout insight"
      className="px-3 py-1 text-[11px] text-cyan-200/90 bg-[#0a0a12]/85 backdrop-blur-md border border-[#1e1e2e] rounded-full shadow-lg max-w-[480px] truncate"
    >
      {sentence}
    </div>
  );
}
