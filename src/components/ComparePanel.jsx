import { useMemo, useState, useEffect } from 'react';
import { getNeighbors } from '../data/graph.js';

const INGREDIENT_COLORS = [
  { bg: 'bg-[#4f8fff]/20', text: 'text-[#4f8fff]', border: 'border-[#4f8fff]/30', dot: '#4f8fff' },
  { bg: 'bg-[#9b59b6]/20', text: 'text-[#9b59b6]', border: 'border-[#9b59b6]/30', dot: '#9b59b6' },
  { bg: 'bg-[#2ecc71]/20', text: 'text-[#2ecc71]', border: 'border-[#2ecc71]/30', dot: '#2ecc71' },
  { bg: 'bg-[#e67e22]/20', text: 'text-[#e67e22]', border: 'border-[#e67e22]/30', dot: '#e67e22' },
  { bg: 'bg-[#e74c3c]/20', text: 'text-[#e74c3c]', border: 'border-[#e74c3c]/30', dot: '#e74c3c' },
  { bg: 'bg-[#1abc9c]/20', text: 'text-[#1abc9c]', border: 'border-[#1abc9c]/30', dot: '#1abc9c' },
  { bg: 'bg-[#f39c12]/20', text: 'text-[#f39c12]', border: 'border-[#f39c12]/30', dot: '#f39c12' },
  { bg: 'bg-[#e84393]/20', text: 'text-[#e84393]', border: 'border-[#e84393]/30', dot: '#e84393' },
];

function getColor(index) {
  return INGREDIENT_COLORS[index % INGREDIENT_COLORS.length];
}

export default function ComparePanel({ selectedNames, nodes, edges, onRemove, onClose, embedded = false }) {
  const [collapsed, setCollapsed] = useState(false);

  // Auto-expand when selection changes
  useEffect(() => {
    if (selectedNames && selectedNames.length >= 2) {
      setCollapsed(false);
    }
  }, [selectedNames]);

  if (!selectedNames || selectedNames.length < 2) return null;

  const neighborSets = useMemo(() => {
    return selectedNames.map((name) => {
      const neighbors = getNeighbors(name, edges);
      return {
        name,
        neighborMap: new Map(neighbors.map((n) => [n.name, n.strength])),
        neighborSet: new Set(neighbors.map((n) => n.name)),
      };
    });
  }, [selectedNames, edges]);

  const sharedByAll = useMemo(() => {
    if (neighborSets.length === 0) return [];
    let common = new Set(neighborSets[0].neighborSet);
    for (let i = 1; i < neighborSets.length; i++) {
      common = new Set([...common].filter((n) => neighborSets[i].neighborSet.has(n)));
    }
    const selectedSet = new Set(selectedNames);
    return [...common]
      .filter((n) => !selectedSet.has(n))
      .sort((a, b) => {
        const avgA = neighborSets.reduce((sum, ns) => sum + (ns.neighborMap.get(a) || 0), 0) / neighborSets.length;
        const avgB = neighborSets.reduce((sum, ns) => sum + (ns.neighborMap.get(b) || 0), 0) / neighborSets.length;
        return avgB - avgA;
      });
  }, [neighborSets, selectedNames]);

  const uniquePairings = useMemo(() => {
    const selectedSet = new Set(selectedNames);
    return neighborSets.map((ns, i) => {
      const otherSets = neighborSets.filter((_, j) => j !== i);
      const unique = [...ns.neighborSet].filter(
        (n) => !selectedSet.has(n) && otherSets.every((other) => !other.neighborSet.has(n))
      );
      return unique
        .sort((a, b) => (ns.neighborMap.get(b) || 0) - (ns.neighborMap.get(a) || 0))
        .slice(0, 8);
    });
  }, [neighborSets, selectedNames]);

  const directConnections = useMemo(() => {
    const connections = [];
    for (let i = 0; i < selectedNames.length; i++) {
      for (let j = i + 1; j < selectedNames.length; j++) {
        const strength = neighborSets[i].neighborMap.get(selectedNames[j]);
        if (strength != null) {
          connections.push({ a: selectedNames[i], b: selectedNames[j], strength });
        }
      }
    }
    return connections.sort((a, b) => b.strength - a.strength);
  }, [selectedNames, neighborSets]);

  // Embedded content for bottom sheet
  const embeddedContent = (
    <>
      {/* Selected ingredients as removable tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {selectedNames.map((name, i) => {
          const c = getColor(i);
          return (
            <span key={name} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${c.bg} ${c.text} ${c.border}`}>
              {name}
              <button onClick={() => onRemove(name)} className="ml-0.5 hover:opacity-70 text-current" aria-label={`Remove ${name}`}>&times;</button>
            </span>
          );
        })}
      </div>
      {directConnections.length > 0 && (
        <section className="mb-4">
          <h3 className="text-xs text-neural-muted uppercase tracking-wider mb-2">Direct Connections</h3>
          <div className="space-y-1.5">
            {directConnections.map(({ a, b, strength }) => {
              const idxA = selectedNames.indexOf(a);
              const idxB = selectedNames.indexOf(b);
              return (
                <div key={`${a}-${b}`} className="flex items-center gap-2 text-xs">
                  <span style={{ color: getColor(idxA).dot }}>{a}</span>
                  <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" style={{ width: `${Math.round(strength * 100)}%` }} />
                  </div>
                  <span style={{ color: getColor(idxB).dot }}>{b}</span>
                  <span className="text-gray-500 tabular-nums w-8 text-right">{Math.round(strength * 100)}%</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="mb-4">
        <h3 className="text-xs text-neural-muted uppercase tracking-wider mb-2">Shared by All ({sharedByAll.length})</h3>
        {sharedByAll.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sharedByAll.slice(0, 20).map((name) => (
              <span key={name} className="px-2 py-0.5 text-xs rounded bg-white/10 text-neural-text border border-white/10">{name}</span>
            ))}
            {sharedByAll.length > 20 && <span className="px-2 py-0.5 text-xs text-neural-muted">+{sharedByAll.length - 20} more</span>}
          </div>
        ) : (
          <p className="text-xs text-neural-muted italic">No pairings shared by all</p>
        )}
      </section>
      <section>
        <h3 className="text-xs text-neural-muted uppercase tracking-wider mb-2">Unique Pairings</h3>
        <div className="space-y-3">
          {selectedNames.map((name, i) => {
            const c = getColor(i);
            const unique = uniquePairings[i];
            return (
              <div key={name}>
                <h4 className={`text-xs font-medium mb-1 ${c.text}`}>{name}<span className="text-neural-muted font-normal ml-1">({unique.length})</span></h4>
                {unique.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {unique.map((n) => <span key={n} className={`px-1.5 py-0.5 text-[11px] rounded ${c.bg} ${c.text} border ${c.border}`}>{n}</span>)}
                  </div>
                ) : (
                  <p className="text-[11px] text-neural-muted italic">No unique pairings</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );

  if (embedded) return <div>{embeddedContent}</div>;

  return (
    <div className="fixed right-0 z-40 flex items-stretch select-none" style={{ top: 'var(--nav-h)', bottom: 'var(--bottom-safe)' }}>
      {/* Tab */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className={`self-start mt-8 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] border-r-0 rounded-l-lg px-1.5 py-3 transition-colors ${
          collapsed ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
        }`}
        aria-label={collapsed ? 'Show comparison' : 'Hide comparison'}
        title="Compare"
      >
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ writingMode: 'vertical-rl' }}>
          Compare
        </span>
      </button>

      {/* Panel */}
      <div
        className={`w-96 overflow-y-auto bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-4 focus:outline-none transition-transform duration-300 ease-in-out ${
          collapsed ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neural-text">
            Comparing {selectedNames.length} Ingredients
          </h2>
          <button
            onClick={onClose}
            className="text-neural-muted hover:text-neural-text text-lg leading-none"
            aria-label="Close comparison"
          >
            &times;
          </button>
        </div>

        {/* Selected ingredients as removable tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {selectedNames.map((name, i) => {
            const c = getColor(i);
            return (
              <span
                key={name}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${c.bg} ${c.text} ${c.border}`}
              >
                {name}
                <button
                  onClick={() => onRemove(name)}
                  className="ml-0.5 hover:opacity-70 text-current"
                  aria-label={`Remove ${name}`}
                >
                  &times;
                </button>
              </span>
            );
          })}
        </div>

        {/* Direct connections */}
        {directConnections.length > 0 && (
          <section className="mb-4">
            <h3 className="text-xs text-neural-muted uppercase tracking-wider mb-2">
              Direct Connections
            </h3>
            <div className="space-y-1.5">
              {directConnections.map(({ a, b, strength }) => {
                const idxA = selectedNames.indexOf(a);
                const idxB = selectedNames.indexOf(b);
                return (
                  <div key={`${a}-${b}`} className="flex items-center gap-2 text-xs">
                    <span style={{ color: getColor(idxA).dot }}>{a}</span>
                    <div className="flex-1 h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                        style={{ width: `${Math.round(strength * 100)}%` }}
                      />
                    </div>
                    <span style={{ color: getColor(idxB).dot }}>{b}</span>
                    <span className="text-gray-500 tabular-nums w-8 text-right">
                      {Math.round(strength * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Shared by all */}
        <section className="mb-4">
          <h3 className="text-xs text-neural-muted uppercase tracking-wider mb-2">
            Shared by All ({sharedByAll.length})
          </h3>
          {sharedByAll.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {sharedByAll.slice(0, 20).map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 text-xs rounded bg-white/10 text-neural-text border border-white/10"
                >
                  {name}
                </span>
              ))}
              {sharedByAll.length > 20 && (
                <span className="px-2 py-0.5 text-xs text-neural-muted">
                  +{sharedByAll.length - 20} more
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-neural-muted italic">No pairings shared by all</p>
          )}
        </section>

        {/* Unique pairings per ingredient */}
        <section>
          <h3 className="text-xs text-neural-muted uppercase tracking-wider mb-2">
            Unique Pairings
          </h3>
          <div className="space-y-3">
            {selectedNames.map((name, i) => {
              const c = getColor(i);
              const unique = uniquePairings[i];
              return (
                <div key={name}>
                  <h4 className={`text-xs font-medium mb-1 ${c.text}`}>
                    {name}
                    <span className="text-neural-muted font-normal ml-1">({unique.length})</span>
                  </h4>
                  {unique.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {unique.map((n) => (
                        <span
                          key={n}
                          className={`px-1.5 py-0.5 text-[11px] rounded ${c.bg} ${c.text} border ${c.border}`}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-neural-muted italic">No unique pairings</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
