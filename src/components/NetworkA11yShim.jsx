import { useMemo, useCallback } from 'react';

/**
 * R6-37 — screen-reader / keyboard-discovery shim for the WebGL network.
 *
 * WebGL nodes aren't natural keyboard targets. This component renders
 * a visually-hidden ordered list of focusable buttons mirroring the
 * top-50 nodes (or the selected node + its strongest pairings when a
 * selection exists). Each button calls onNodeClick exactly like a 3D
 * tap, so downstream selection logic is unchanged.
 *
 * Also renders an aria-live region announcing the current selection.
 *
 * Render this as a sibling of the canvas containerRef inside the
 * scene's wrapper div. The wrapper handles canvas-level keyboard
 * shortcuts (Escape, slash) — see NetworkScene / LivingArchView.
 */
function NetworkA11yShim({ data, selectedNode, onNodeClick, listLabel = 'Network ingredients' }) {
  const a11yNodes = useMemo(() => {
    const raw = data?.graph?.nodes;
    if (!raw) return [];
    // useProData stores nodes as Map<name, node>; tests pass an Array.
    // Coerce both to a flat array + a name->node lookup so downstream
    // code is uniform.
    const allArray = raw instanceof Map ? [...raw.values()] : raw;
    if (allArray.length === 0) return [];
    const byName = raw instanceof Map ? raw : new Map(allArray.map((n) => [n.name, n]));
    if (selectedNode) {
      const selectedObj = byName.get(selectedNode);
      const edges = data?.graph?.edges || [];
      const pairs = edges
        .filter((e) => e.source === selectedNode || e.target === selectedNode)
        .map((e) => ({
          name: e.source === selectedNode ? e.target : e.source,
          strength: e.strength || 0,
        }))
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 49);
      const out = selectedObj ? [selectedObj] : [];
      for (const p of pairs) {
        const node = byName.get(p.name);
        if (node) out.push(node);
      }
      return out;
    }
    return [...allArray]
      .sort((a, b) => (b.pairingCount || 0) - (a.pairingCount || 0))
      .slice(0, 50);
  }, [data, selectedNode]);

  const handleActivate = useCallback(
    (node) => {
      if (onNodeClick) onNodeClick(node);
    },
    [onNodeClick],
  );

  return (
    <>
      <ul
        className="sr-only"
        aria-label={selectedNode ? `Pairings of ${selectedNode}` : listLabel}
      >
        {a11yNodes.map((node) => {
          const isSelected = node.name === selectedNode;
          return (
            <li key={node.name}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${node.name}, ${node.pairingCount || 0} pairings${isSelected ? ', selected' : ''}`}
                onClick={() => handleActivate(node)}
              >
                {node.name}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sr-only" role="status" aria-live="polite">
        {selectedNode ? `Selected: ${selectedNode}` : ''}
      </div>
    </>
  );
}

export default NetworkA11yShim;
