import { useEffect, useState } from 'react';

/**
 * MessagePassingDiagram — visualizes the 3-layer GNN's per-atom activations.
 *
 * When real activation data is available (public/models/preset_activations.json),
 * each circle's radius reflects the actual L2-norm of that atom's hidden vector
 * at each GINEConv layer. When no data is available, falls back to a schematic
 * animation.
 */

const TASTE_COLORS = {
  sweet: '#ff4fb8',
  bitter: '#9d4edd',
  umami: '#ffd700',
  salty: '#4f9eff',
  sour: '#00ffd0',
};

const LAYERS = ['atom_enc', 'layer_1', 'layer_2', 'layer_3'];
const LAYER_LABELS = ['Atoms', 'GINE 1', 'GINE 2', 'GINE 3', 'Pool'];

export default function MessagePassingDiagram({ predictions, tasks, moleculeName }) {
  const [activations, setActivations] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetch('/models/preset_activations.json')
      .then((r) => r.ok ? r.json() : null)
      .then(setActivations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTick(0);
    const iv = setInterval(() => setTick((t) => (t + 1) % (LAYERS.length + 5)), 500);
    return () => clearInterval(iv);
  }, [predictions]);

  if (!predictions || !tasks) return null;

  const preset = activations?.[moleculeName];
  const isReal = !!(preset?.layers);
  const atomCount = preset?.atom_count || 8;
  const maxAtoms = Math.min(atomCount, 24); // cap rendering width

  // Compute max magnitude across all layers for normalization
  let maxMag = 1;
  if (isReal) {
    for (const key of LAYERS) {
      const mags = preset.layers[key] || [];
      for (const m of mags) { if (m > maxMag) maxMag = m; }
    }
  }

  const W = 520;
  const layerH = 45;
  const startY = 35;
  const atomSpacing = Math.min(50, (W - 100) / maxAtoms);

  return (
    <div className="mt-6 p-4 bg-[#13131a] rounded border border-[#2a2a3a]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm uppercase tracking-wider text-gray-500">
          Message passing {isReal ? '(real activations)' : '(schematic)'}
        </h4>
        <span className="text-xs text-gray-600">3 layers · 128-dim · {atomCount} atoms</span>
      </div>

      <svg viewBox={`0 0 ${W} ${(LAYERS.length + 1) * layerH + 70}`} className="w-full">
        {LAYERS.map((key, li) => {
          const y = startY + li * layerH;
          const active = tick >= li;
          const mags = isReal ? (preset.layers[key] || []) : [];
          return (
            <g key={key}>
              <text x="8" y={y + 5} style={{ font: '10px ui-monospace, monospace' }}
                    className="fill-gray-500">{LAYER_LABELS[li]}</text>
              {Array.from({ length: maxAtoms }).map((_, ai) => {
                const x = 80 + ai * atomSpacing;
                const mag = mags[ai] ?? 0;
                const normMag = isReal ? mag / maxMag : (active ? 1 : 0.3);
                const r = isReal ? 3 + normMag * 8 : (active ? 8 : 5);
                const opacity = isReal ? 0.3 + normMag * 0.7 : (active ? 0.9 : 0.4);
                const fill = isReal
                  ? `hsl(${260 + normMag * 60}, 80%, ${40 + normMag * 30}%)`
                  : (active ? '#e9d5ff' : '#2a2a3a');
                return (
                  <g key={ai}>
                    {li > 0 && (
                      <line x1={x} y1={y - layerH} x2={x} y2={y}
                            stroke={active ? '#a78bfa' : '#2a2a3a'}
                            strokeWidth="1" opacity={active ? 0.4 : 0.15} />
                    )}
                    {li > 0 && ai < maxAtoms - 1 && (
                      <line x1={x} y1={y - layerH} x2={x + atomSpacing} y2={y}
                            stroke={active ? '#7c3aed' : '#2a2a3a'}
                            strokeWidth="0.5" opacity={active ? 0.25 : 0.08} />
                    )}
                    <circle cx={x} cy={y} r={r} fill={fill} opacity={opacity}
                            style={{ transition: 'r 300ms, opacity 300ms, fill 300ms' }} />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Output row */}
        {(() => {
          const y = startY + LAYERS.length * layerH + 15;
          const active = tick >= LAYERS.length;
          return (
            <g>
              <text x="8" y={y + 5} style={{ font: '10px ui-monospace, monospace' }}
                    className="fill-gray-500">Output</text>
              {tasks.map((t, ti) => {
                const x = 100 + ti * 80;
                const p = predictions[t] ?? 0;
                const r = active ? 6 + p * 14 : 4;
                return (
                  <g key={t}>
                    <line x1={W / 2} y1={y - 20} x2={x} y2={y}
                          stroke={active ? TASTE_COLORS[t] : '#2a2a3a'}
                          strokeWidth="1" opacity={active ? 0.5 : 0.2} />
                    <circle cx={x} cy={y} r={r} fill={TASTE_COLORS[t]}
                            opacity={active ? 0.4 + p * 0.6 : 0.2}
                            style={{ transition: 'r 300ms, opacity 300ms' }} />
                    <text x={x} y={y + 22} textAnchor="middle"
                          style={{ font: '10px ui-monospace, monospace' }}
                          className="fill-gray-400">{t}</text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>

      <p className="mt-2 text-xs text-gray-600">
        {isReal
          ? `Real per-atom activation magnitudes from the trained GNN. Brighter/larger = higher activation at that layer. ${atomCount > maxAtoms ? `Showing first ${maxAtoms} of ${atomCount} atoms.` : ''}`
          : 'Schematic: each GINEConv layer aggregates 1-hop neighbor info; after 3 layers every atom carries 3-hop context, mean-pooled, then classified.'}
      </p>
    </div>
  );
}
