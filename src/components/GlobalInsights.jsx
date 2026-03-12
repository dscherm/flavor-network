import { useMemo, useState } from 'react';
import { buildAdjacencyList } from '../data/graph.js';
import { TASTE_COLORS, colorForCuisine } from '../utils/color.js';
import { tasteMatches } from '../three/NodeMesh.js';

/**
 * Compute 5 data-science-style insights from the graph, respecting active filters.
 * When a filter is active, includes all ingredients connected to the filtered set.
 */
function computeInsights(nodes, edges, filterCuisine, filterTaste) {
  // Determine core filtered nodes
  const coreNodes = new Map();
  for (const [name, node] of nodes) {
    if (filterCuisine && !node.cuisines.some((c) => c.toLowerCase().includes(filterCuisine.toLowerCase()))) continue;
    if (filterTaste && !tasteMatches(node.taste, filterTaste)) continue;
    coreNodes.set(name, node);
  }

  // If a filter is active, expand to include all connected ingredients
  const activeNodes = new Map(coreNodes);
  if (filterCuisine || filterTaste) {
    const coreSet = new Set(coreNodes.keys());
    for (const edge of edges) {
      if (coreSet.has(edge.source) && !activeNodes.has(edge.target)) {
        const node = nodes.get(edge.target);
        if (node) activeNodes.set(edge.target, node);
      }
      if (coreSet.has(edge.target) && !activeNodes.has(edge.source)) {
        const node = nodes.get(edge.source);
        if (node) activeNodes.set(edge.source, node);
      }
    }
  }

  const activeSet = new Set(activeNodes.keys());
  // Include edges where at least one endpoint is in the core filtered set
  const coreSet = new Set(coreNodes.keys());
  const activeEdges = (filterCuisine || filterTaste)
    ? edges.filter((e) => (coreSet.has(e.source) || coreSet.has(e.target)) && activeSet.has(e.source) && activeSet.has(e.target))
    : edges.filter((e) => activeSet.has(e.source) && activeSet.has(e.target));

  const insights = [];
  const filterLabel = filterCuisine
    ? filterCuisine.replace(' cuisine', '')
    : filterTaste
      ? filterTaste
      : null;
  const scope = filterLabel
    ? `among ${filterLabel} ingredients and their connections`
    : 'across the network';
  const coreCount = coreNodes.size;
  const connectedCount = activeNodes.size - coreNodes.size;

  // 1. Hub Analysis — most connected ingredient
  const adj = buildAdjacencyList(activeEdges);
  let hubName = null;
  let hubDegree = 0;
  let avgDegree = 0;
  for (const [name, neighbors] of adj) {
    if (neighbors.length > hubDegree) {
      hubDegree = neighbors.length;
      hubName = name;
    }
    avgDegree += neighbors.length;
  }
  avgDegree = adj.size > 0 ? (avgDegree / adj.size) : 0;

  if (hubName) {
    const hubNode = activeNodes.get(hubName);
    const ratio = avgDegree > 0 ? (hubDegree / avgDegree).toFixed(1) : '?';
    insights.push({
      icon: 'hub',
      title: 'Network Hub',
      body: `**${hubName}** is the most connected ingredient ${scope} with ${hubDegree} pairings — ${ratio}x the average (${avgDegree.toFixed(1)}).`,
      detail: hubNode?.taste
        ? `Its ${hubNode.taste} profile makes it a versatile bridge across flavor families.`
        : `This suggests it acts as a universal connector in recipes.`,
      color: '#4f8fff',
    });
  }

  // 2. Strongest Bond — highest-strength edge
  let strongest = null;
  for (const e of activeEdges) {
    if (!strongest || e.strength > strongest.strength) strongest = e;
  }
  if (strongest) {
    const srcNode = activeNodes.get(strongest.source);
    const tgtNode = activeNodes.get(strongest.target);
    const sameTaste = srcNode?.taste && tgtNode?.taste && srcNode.taste === tgtNode.taste;
    insights.push({
      icon: 'bond',
      title: 'Strongest Bond',
      body: `**${strongest.source}** and **${strongest.target}** share the strongest pairing ${scope} at ${Math.round(strongest.strength * 100)}% strength.`,
      detail: sameTaste
        ? `Both are ${srcNode.taste} — similar taste profiles tend to form the strongest bonds.`
        : `Despite different taste profiles (${srcNode?.taste || '?'} vs ${tgtNode?.taste || '?'}), they are complementary.`,
      color: '#2ecc71',
    });
  }

  // 3. Taste Distribution — what dominates
  const tasteCounts = {};
  let tasteTotal = 0;
  for (const [, node] of activeNodes) {
    if (node.taste) {
      const t = node.taste.toLowerCase();
      tasteCounts[t] = (tasteCounts[t] || 0) + 1;
      tasteTotal++;
    }
  }
  const sortedTastes = Object.entries(tasteCounts).sort((a, b) => b[1] - a[1]);
  if (sortedTastes.length >= 2) {
    const [topTaste, topCount] = sortedTastes[0];
    const topPct = tasteTotal > 0 ? Math.round((topCount / tasteTotal) * 100) : 0;
    const [secondTaste] = sortedTastes[1];
    const leastTaste = sortedTastes[sortedTastes.length - 1][0];
    insights.push({
      icon: 'taste',
      title: 'Taste Landscape',
      body: `**${topTaste}** dominates ${scope}, representing ${topPct}% of ingredients with known taste profiles, followed by **${secondTaste}**.`,
      detail: `**${leastTaste}** is the rarest taste — ingredients with this profile may offer the most novel pairings.`,
      color: TASTE_COLORS[topTaste] || '#4f8fff',
      bars: sortedTastes.slice(0, 5).map(([taste, count]) => ({
        label: taste,
        value: tasteTotal > 0 ? count / tasteTotal : 0,
        color: TASTE_COLORS[taste] || TASTE_COLORS.default,
      })),
    });
  }

  // 4. Cuisine Crossover — ingredients spanning the most cuisines
  let maxCuisines = 0;
  let bridgeIngredient = null;
  const cuisinePresence = {};
  for (const [name, node] of activeNodes) {
    if (node.cuisines.length > maxCuisines) {
      maxCuisines = node.cuisines.length;
      bridgeIngredient = name;
    }
    for (const c of node.cuisines) {
      cuisinePresence[c] = (cuisinePresence[c] || 0) + 1;
    }
  }
  const sortedCuisines = Object.entries(cuisinePresence).sort((a, b) => b[1] - a[1]);
  if (bridgeIngredient && maxCuisines > 1) {
    const topCuisine = sortedCuisines[0];
    insights.push({
      icon: 'bridge',
      title: 'Cultural Bridge',
      body: `**${bridgeIngredient}** appears in ${maxCuisines} different cuisines — the most versatile ingredient ${scope}.`,
      detail: topCuisine
        ? `**${topCuisine[0]}** has the largest ingredient pool (${topCuisine[1]} ingredients), suggesting it's the most represented tradition.`
        : '',
      color: '#e67e22',
      bars: sortedCuisines.slice(0, 5).map(([cuisine, count]) => ({
        label: cuisine.replace(' cuisine', ''),
        value: activeNodes.size > 0 ? count / activeNodes.size : 0,
        color: colorForCuisine(cuisine),
      })),
    });
  }

  // 5. Network Density & Small World — how interconnected is the network
  const maxPossibleEdges = (activeNodes.size * (activeNodes.size - 1)) / 2;
  const density = maxPossibleEdges > 0 ? activeEdges.length / maxPossibleEdges : 0;
  const avgStrength = activeEdges.length > 0
    ? activeEdges.reduce((s, e) => s + e.strength, 0) / activeEdges.length
    : 0;
  // Find isolated nodes (no connections)
  const connectedNodes = new Set();
  for (const e of activeEdges) {
    connectedNodes.add(e.source);
    connectedNodes.add(e.target);
  }
  const isolatedCount = activeNodes.size - connectedNodes.size;

  const structureBody = (filterCuisine || filterTaste)
    ? `**${coreCount}** filtered ingredients plus **${connectedCount}** connected neighbors, linked by ${activeEdges.length} pairings. Network density: ${(density * 100).toFixed(1)}%.`
    : `${activeNodes.size} ingredients connected by ${activeEdges.length} pairings ${scope}. Network density: ${(density * 100).toFixed(1)}%.`;

  const structureStats = (filterCuisine || filterTaste)
    ? [
        { label: 'Core', value: coreCount },
        { label: 'Connected', value: connectedCount },
        { label: 'Edges', value: activeEdges.length },
        { label: 'Avg Strength', value: `${Math.round(avgStrength * 100)}%` },
      ]
    : [
        { label: 'Nodes', value: activeNodes.size },
        { label: 'Edges', value: activeEdges.length },
        { label: 'Density', value: `${(density * 100).toFixed(1)}%` },
        { label: 'Avg Strength', value: `${Math.round(avgStrength * 100)}%` },
      ];

  insights.push({
    icon: 'density',
    title: 'Network Structure',
    body: structureBody,
    detail: isolatedCount > 0
      ? `${isolatedCount} ingredient${isolatedCount > 1 ? 's have' : ' has'} no pairings — potential opportunities for novel flavor exploration. Average pairing strength: ${Math.round(avgStrength * 100)}%.`
      : `Every ingredient has at least one pairing. Average connection strength: ${Math.round(avgStrength * 100)}%.`,
    color: '#9b59b6',
    stats: structureStats,
  });

  return insights;
}

const ICONS = {
  hub: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0l-2.83-2.83M9.76 9.76L6.93 6.93" />
    </svg>
  ),
  bond: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  taste: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
  bridge: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  density: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  ),
};

function renderMarkdown(text) {
  // Simple bold markdown rendering
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function GlobalInsights({ nodes, edges, filterCuisine, filterTaste, isOpen, onClose }) {
  const [collapsed, setCollapsed] = useState(false);

  const insights = useMemo(() => {
    if (!nodes || !edges) return [];
    return computeInsights(nodes, edges, filterCuisine, filterTaste);
  }, [nodes, edges, filterCuisine, filterTaste]);

  return (
    <div className={`fixed top-4 right-0 bottom-4 z-40 flex items-stretch select-none ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Tab */}
      <button
        onClick={() => {
          if (isOpen) setCollapsed((v) => !v);
        }}
        className={`self-start mt-8 bg-[#0a1628]/90 backdrop-blur-md border border-cyan-900/40 border-r-0 rounded-l-lg px-1.5 py-3 transition-all duration-300 ${
          isOpen
            ? collapsed
              ? 'text-cyan-400 pointer-events-auto'
              : 'text-cyan-600 hover:text-cyan-400 pointer-events-auto'
            : 'text-gray-500 translate-x-full opacity-0'
        }`}
        aria-label={collapsed ? 'Show insights' : 'Hide insights'}
        title="Network Insights"
      >
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ writingMode: 'vertical-rl' }}>
          Insights
        </span>
      </button>

      {/* Panel */}
      <div className={`w-[340px] overflow-y-auto bg-[#0a1628]/95 backdrop-blur-md border border-cyan-900/30 rounded-lg shadow-[0_0_30px_rgba(0,180,255,0.08)] transition-transform duration-300 ease-in-out ${
        isOpen && !collapsed ? 'translate-x-0' : 'translate-x-[calc(100%+4px)]'
      }`}>
        {/* Header */}
        <div className="sticky top-0 bg-[#0a1628]/95 backdrop-blur-md p-4 pb-3 border-b border-cyan-900/20 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-cyan-100 font-semibold text-sm tracking-wide font-mono">Network Analysis</h2>
          </div>
          <button
            onClick={onClose}
            className="text-cyan-800 hover:text-cyan-400 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Filter indicator */}
        {(filterCuisine || filterTaste) && (
          <div className="mx-4 mt-3 px-2.5 py-1.5 rounded border border-cyan-800/30 bg-cyan-900/20 flex items-center gap-2">
            <svg className="w-3 h-3 text-cyan-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-[11px] text-cyan-300">
              Filtered: <span className="font-medium">{filterCuisine || filterTaste}</span>
            </span>
          </div>
        )}

        {/* Insights */}
        <div className="p-4 space-y-4">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="rounded-lg border border-cyan-900/25 bg-[#0d1f38]/80 overflow-hidden"
            >
              {/* Insight header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-900/15">
                <span style={{ color: insight.color }}>{ICONS[insight.icon]}</span>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider" style={{ color: insight.color }}>
                  {insight.title}
                </span>
                <span className="ml-auto text-[9px] text-cyan-800 font-mono">#{i + 1}</span>
              </div>

              {/* Insight body */}
              <div className="px-3 py-2.5 space-y-2">
                <p className="text-[12px] text-cyan-200/80 leading-relaxed">
                  {renderMarkdown(insight.body)}
                </p>
                {insight.detail && (
                  <p className="text-[11px] text-cyan-400/50 leading-relaxed italic">
                    {renderMarkdown(insight.detail)}
                  </p>
                )}

                {/* Mini bar chart */}
                {insight.bars && (
                  <div className="mt-2 space-y-1">
                    {insight.bars.map((bar) => (
                      <div key={bar.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-cyan-300/50 w-16 text-right truncate capitalize font-mono">
                          {bar.label}
                        </span>
                        <div className="flex-1 h-1.5 bg-cyan-950/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.round(bar.value * 100)}%`,
                              background: bar.color,
                              boxShadow: `0 0 4px ${bar.color}40`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] text-cyan-600 font-mono w-7 text-right">
                          {Math.round(bar.value * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats row */}
                {insight.stats && (
                  <div className="flex gap-1 mt-2">
                    {insight.stats.map((stat) => (
                      <div key={stat.label} className="flex-1 text-center px-1 py-1.5 rounded bg-cyan-950/40 border border-cyan-900/20">
                        <div className="text-[10px] text-cyan-100 font-mono font-semibold">{stat.value}</div>
                        <div className="text-[8px] text-cyan-600 uppercase tracking-wider">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 pt-1">
          <p className="text-[9px] text-cyan-900 font-mono text-center">
            Computed from {nodes?.size || 0} ingredients / {edges?.length || 0} pairings
          </p>
        </div>
      </div>
    </div>
  );
}
