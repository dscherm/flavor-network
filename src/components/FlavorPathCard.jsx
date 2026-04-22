import { useState } from 'react';

/**
 * FlavorPathCard — inline rendering of a multi-step flavor bridge path
 * with optional per-segment molecular chemistry drilldown.
 *
 * R13 Phase 2b: folds the FlavorBridge modal's "Connection Path" section
 * into IngredientPanel so users see the path AND the chemistry without
 * navigating away.
 *
 * Props:
 *   path: string[] — e.g. ['lemon', 'ginger', 'chocolate']
 *   bridgeCompounds: bridge_compounds.json object
 *   selectedNodes: string[] — to highlight endpoints
 *   onSelectIngredient: (name) => void — for clicking chips
 */

const TAG_COLORS = {
  citrus: '#facc15', fruity: '#f472b6', floral: '#c084fc', green: '#4ade80',
  minty: '#5eead4', mint: '#5eead4', woody: '#b48366', spicy: '#f87171',
  sweet: '#fda4af', sour: '#22d3ee', nutty: '#d6a875', smoky: '#a1a1aa',
  bitter: '#9d4edd', fatty: '#fed7aa', caramel: '#fbbf24',
};

function SegmentChemistry({ a, b, bridgeCompounds }) {
  const entry = bridgeCompounds?.[`${a}|${b}`] || bridgeCompounds?.[`${b}|${a}`];
  if (!entry?.bridges?.length) {
    return (
      <p className="text-[10px] text-gray-600 italic px-2 py-1">
        No molecular data for this segment.
      </p>
    );
  }
  const top = entry.bridges.slice(0, 3);
  return (
    <div className="px-2 py-1 space-y-1">
      {entry.narrative && (
        <p className="text-[10px] text-gray-400 italic">{entry.narrative}</p>
      )}
      {top.map((br, i) => (
        <div key={br.name || i} className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-cyan-300 font-medium">{br.name}</span>
          {(br.tags || []).slice(0, 3).map(t => {
            const c = TAG_COLORS[t] || '#a5b4fc';
            return (
              <span
                key={t}
                className="text-[9px] px-1 rounded"
                style={{ color: c, background: `${c}15`, border: `1px solid ${c}33` }}
              >{t}</span>
            );
          })}
        </div>
      ))}
      {entry.bridges.length > 3 && (
        <p className="text-[9px] text-gray-500">+ {entry.bridges.length - 3} more shared compound{entry.bridges.length - 3 > 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

export default function FlavorPathCard({ path, bridgeCompounds, selectedNodes = [], onSelectIngredient }) {
  const [showChemistry, setShowChemistry] = useState(false);

  if (!path || path.length < 3) return null;
  const bridgeCount = path.length - 2;

  return (
    <div>
      <p className="text-[10px] text-gray-500 mb-1.5">Strongest connection between your two ingredients:</p>

      <div className="flex items-center flex-wrap gap-1">
        {path.map((name, i) => (
          <span key={name} className="flex items-center gap-1">
            <button
              onClick={() => onSelectIngredient?.(name)}
              className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
                selectedNodes.includes(name)
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-gray-800/60 text-gray-300 hover:text-cyan-300'
              }`}
            >{name}</button>
            {i < path.length - 1 && <span className="text-gray-600 text-[10px]">→</span>}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[10px] text-gray-500">
          {bridgeCount} ingredient{bridgeCount !== 1 ? 's' : ''} bridge these flavors
        </p>
        {bridgeCompounds && (
          <button
            onClick={() => setShowChemistry(v => !v)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300"
          >{showChemistry ? 'Hide chemistry' : 'Show chemistry ↓'}</button>
        )}
      </div>

      {showChemistry && bridgeCompounds && (
        <div className="mt-2 space-y-2 border-l-2 border-cyan-500/20 pl-2">
          {path.slice(0, -1).map((name, i) => {
            const next = path[i + 1];
            return (
              <div key={`seg-${i}`}>
                <p className="text-[9px] uppercase tracking-wider text-gray-500">
                  {name} → {next}
                </p>
                <SegmentChemistry a={name} b={next} bridgeCompounds={bridgeCompounds} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
