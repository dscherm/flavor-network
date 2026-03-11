import { useMemo } from 'react';

/**
 * Comparison panel — shows shared and unique pairings between two ingredients.
 * Props: node1, node2, sharedPairings, neighbors1, neighbors2, onClose
 */
export default function ComparePanel({ node1, node2, sharedPairings, neighbors1, neighbors2, onClose }) {
  if (!node1 || !node2) return null;

  const unique1 = useMemo(() => {
    const shared = new Set(sharedPairings);
    return neighbors1.filter(n => !shared.has(n.name)).slice(0, 10);
  }, [neighbors1, sharedPairings]);

  const unique2 = useMemo(() => {
    const shared = new Set(sharedPairings);
    return neighbors2.filter(n => !shared.has(n.name)).slice(0, 10);
  }, [neighbors2, sharedPairings]);

  return (
    <div className="fixed left-1/2 -translate-x-1/2 top-16 z-50 w-[520px] max-h-[70vh] overflow-y-auto bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-neural-text">
          Comparing{' '}
          <span className="text-[#4f8fff]">{node1.name}</span>
          {' vs '}
          <span className="text-[#9b59b6]">{node2.name}</span>
        </h2>
        <button
          onClick={onClose}
          className="text-neural-muted hover:text-neural-text text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Shared pairings */}
      <div className="mb-3">
        <h3 className="text-xs text-neural-muted mb-1">
          Shared Pairings ({sharedPairings.length})
        </h3>
        {sharedPairings.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sharedPairings.map(name => (
              <span
                key={name}
                className="px-2 py-0.5 text-xs rounded bg-[#4f8fff]/20 text-[#4f8fff] border border-[#4f8fff]/30"
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neural-muted italic">No shared pairings</p>
        )}
      </div>

      {/* Unique columns */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <h3 className="text-xs text-neural-muted mb-1">
            Unique to <span className="text-[#4f8fff]">{node1.name}</span>
          </h3>
          <div className="space-y-0.5">
            {unique1.map(n => (
              <div key={n.name} className="text-xs text-neural-text/70">{n.name}</div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs text-neural-muted mb-1">
            Unique to <span className="text-[#9b59b6]">{node2.name}</span>
          </h3>
          <div className="space-y-0.5">
            {unique2.map(n => (
              <div key={n.name} className="text-xs text-neural-text/70">{n.name}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
