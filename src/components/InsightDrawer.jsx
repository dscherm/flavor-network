/**
 * InsightDrawer — opt-in right-side panel summarizing what the current
 * (filterStack × pullStrength) layout means.
 *
 * R19 Phase 4 (Tier E). Five sections:
 *   1. Composition       — filter chain + visible-count.
 *   2. Bucket sparkline  — inline SVG bars per axis bucket.
 *   3. Pull explanation  — pull-range sentence + top 3 bridges.
 *   4. Cluster overlap   — ML cluster × bucket matrix.
 *   5. Suggested next    — heuristic for the next filter to add.
 *
 * Toggled via a `?` button rendered by App.jsx next to the FilterPillRow.
 * Hidden when filterStack is empty (renders a stub line).
 */

import { FILTER_LABELS } from '../data/networkModes.js';

const FILTER_AVAILABLE = ['aroma', 'cuisine', 'season', 'family', 'taste'];

export function suggestedMove({ filterStack, visibleCount }) {
  if (!filterStack || filterStack.length === 0) return null;
  if (visibleCount === 0) return 'The intersection is empty — pop the most recent filter.';
  const usedFilters = new Set(filterStack);
  const remaining = FILTER_AVAILABLE.filter((f) => !usedFilters.has(f));
  if (remaining.length === 0) return 'Every primary axis is already in the stack.';
  const next = remaining[0];
  return `Add a ${FILTER_LABELS[next] || next} filter to narrow further.`;
}

export function pullExplanation(pull) {
  const p = typeof pull === 'number' ? pull : 0;
  if (p < 0.25) return 'Layout is cooccurrence-dominant — buckets are still gentle nudges.';
  if (p < 0.50) return 'Layout leans toward cooccurrence but bucket structure is emerging.';
  if (p < 0.75) return 'Layout is balanced — strong pairings resist the bucket pull.';
  return 'Layout is bucket-dominant — only the strongest cross-bucket pairings hold their ground.';
}

function BucketSparkline({ bucketCounts, bucketColorMap }) {
  const buckets = bucketCounts ? Object.keys(bucketCounts) : [];
  if (buckets.length === 0) return null;
  const max = Math.max(1, ...buckets.map((b) => bucketCounts[b] || 0));
  const BAR_H = 36;
  const BAR_W = 14;
  const GAP = 4;
  const TEXT_H = 14;
  const SVG_W = buckets.length * (BAR_W + GAP);
  return (
    <svg
      width={SVG_W}
      height={BAR_H + TEXT_H}
      role="img"
      aria-label="Bucket distribution sparkline"
      data-testid="bucket-sparkline"
    >
      {buckets.map((label, i) => {
        const v = bucketCounts[label] || 0;
        const h = (v / max) * BAR_H;
        const fill = bucketColorMap?.[label] || '#22d3ee';
        return (
          <g key={label}>
            <title>{`${label}: ${v}`}</title>
            <rect
              x={i * (BAR_W + GAP)}
              y={BAR_H - h}
              width={BAR_W}
              height={Math.max(0, h)}
              fill={fill}
              opacity={v === 0 ? 0.2 : 0.85}
            />
            <text
              x={i * (BAR_W + GAP) + BAR_W / 2}
              y={BAR_H + 11}
              fontSize={8}
              textAnchor="middle"
              fill="#9ca3af"
            >
              {label.slice(0, 3)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BridgeList({ bridges }) {
  if (!Array.isArray(bridges) || bridges.length === 0) return null;
  return (
    <ul className="text-[11px] text-gray-400 space-y-0.5 mt-2" data-testid="bridge-list">
      {bridges.slice(0, 3).map((b) => (
        <li key={b.name}>
          <span className="text-cyan-300">{b.name}</span>
          <span className="text-gray-500"> ({b.bucket}) ↔ </span>
          <span className="text-cyan-200">{b.topPeer}</span>
          <span className="text-gray-500"> ({b.otherBucket})</span>
        </li>
      ))}
    </ul>
  );
}

function ClusterMatrix({ clusterOverlap, bucketColorMap }) {
  if (!clusterOverlap || clusterOverlap.clusters.length === 0) {
    return <p className="text-gray-500 text-[11px]">No cluster overlap data.</p>;
  }
  const { clusters, buckets, counts } = clusterOverlap;
  return (
    <div className="max-h-48 overflow-y-auto -mx-3 px-3" data-testid="cluster-matrix">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left py-0.5 pr-2 sticky left-0 bg-[#0a0a12]">Cluster</th>
            {buckets.map((b) => (
              <th
                key={b}
                className="text-center px-0.5 font-normal"
                style={{ color: bucketColorMap?.[b] || '#9ca3af' }}
              >
                {b.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clusters.map((c) => (
            <tr key={c.id} className="border-t border-[#1e1e2e]">
              <td className="py-1 pr-2 text-gray-300 truncate max-w-[10ch]" title={c.label}>
                {c.label}
              </td>
              {buckets.map((b) => {
                const v = counts[c.id]?.[b] || 0;
                return (
                  <td
                    key={b}
                    className={`text-center px-0.5 ${v === 0 ? 'text-gray-600' : 'text-cyan-300'}`}
                  >
                    {v || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrawerBody({
  filterStack,
  pullStrength,
  visibleCount,
  morphAxis,
  bucketCounts,
  bucketColorMap,
  bridges,
  clusterOverlap,
}) {
  const empty = !filterStack || filterStack.length === 0;
  if (empty) {
    return (
      <p className="text-gray-400" data-testid="insight-empty">
        Apply a filter to see the narrative.
      </p>
    );
  }
  return (
    <>
      <section data-testid="section-composition">
        <h3 className="text-gray-500 uppercase tracking-wider text-[9px] mb-1">
          Composition
        </h3>
        <p className="text-gray-200">
          {visibleCount != null ? visibleCount : '?'} ingredient
          {visibleCount === 1 ? '' : 's'} matching{' '}
          <span className="text-cyan-200">
            {filterStack.map((f) => FILTER_LABELS[f] || f).join(' × ')}
          </span>
          .
        </p>
      </section>

      {bucketCounts && morphAxis && (
        <section data-testid="section-bucket-dist">
          <h3 className="text-gray-500 uppercase tracking-wider text-[9px] mb-1">
            Bucket distribution
          </h3>
          <BucketSparkline bucketCounts={bucketCounts} bucketColorMap={bucketColorMap} />
        </section>
      )}

      <section data-testid="section-pull">
        <h3 className="text-gray-500 uppercase tracking-wider text-[9px] mb-1">
          Pull · {Math.round((pullStrength || 0) * 100)}%
        </h3>
        <p className="text-gray-300">{pullExplanation(pullStrength)}</p>
        <BridgeList bridges={bridges} />
      </section>

      {clusterOverlap && (
        <section data-testid="section-cluster-matrix">
          <h3 className="text-gray-500 uppercase tracking-wider text-[9px] mb-1">
            Cluster × bucket overlap
          </h3>
          <ClusterMatrix clusterOverlap={clusterOverlap} bucketColorMap={bucketColorMap} />
        </section>
      )}

      <section data-testid="section-suggested">
        <h3 className="text-gray-500 uppercase tracking-wider text-[9px] mb-1">
          Suggested next
        </h3>
        <p className="text-gray-300">
          {suggestedMove({ filterStack, visibleCount }) || 'Layout looks well-explored.'}
        </p>
      </section>
    </>
  );
}

export default function InsightDrawer({
  isOpen = false,
  onClose,
  isMobile = false,
  filterStack = [],
  pullStrength = 0,
  visibleCount = null,
  morphAxis = null,
  bucketCounts = null,
  bucketColorMap = null,
  bridges = null,
  clusterOverlap = null,
}) {
  if (!isOpen) return null;

  const bodyProps = {
    filterStack,
    pullStrength,
    visibleCount,
    morphAxis,
    bucketCounts,
    bucketColorMap,
    bridges,
    clusterOverlap,
  };

  // iOS / mobile — full-screen overlay with grab-handle close affordance.
  // Tapping the handle (button) OR the backdrop OR the × in the header
  // dismisses the drawer. No swipe-down gesture yet; the explicit
  // close targets are big enough (≥44px) to be discoverable.
  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Layout insight drawer"
        data-testid="insight-drawer"
        className="fixed inset-0 z-[80] bg-[#0a0a12]/97 backdrop-blur-lg flex flex-col text-xs pointer-events-auto"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex flex-col items-center pt-2">
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close insight drawer"
            data-testid="insight-drawer-handle"
            className="w-14 h-1.5 rounded-full bg-gray-500 active:bg-gray-300 transition-colors my-2"
          />
        </div>
        <header className="flex items-center justify-between px-4 pb-2">
          <span className="font-medium text-cyan-200 uppercase tracking-wider text-[11px]">
            Layout insight
          </span>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close insight drawer"
            className="text-gray-400 hover:text-gray-200 text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
          <DrawerBody {...bodyProps} />
        </div>
      </div>
    );
  }

  // Desktop — right-anchored card. Compact + non-modal so the user can
  // still drag the slider or hover bridges underneath.
  return (
    <aside
      role="region"
      aria-label="Layout insight drawer"
      data-testid="insight-drawer"
      className="fixed right-4 top-32 z-[69] w-[340px] max-h-[70vh] bg-[#0a0a12]/95 backdrop-blur-lg border border-[#1e1e2e] rounded-lg shadow-2xl text-xs overflow-hidden flex flex-col pointer-events-auto"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e]">
        <span className="font-medium text-cyan-200 uppercase tracking-wider text-[10px]">
          Layout insight
        </span>
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close insight drawer"
          className="text-gray-500 hover:text-gray-200 text-sm leading-none"
        >
          ×
        </button>
      </header>
      <div className="px-3 py-3 overflow-y-auto space-y-4">
        <DrawerBody {...bodyProps} />
      </div>
    </aside>
  );
}
