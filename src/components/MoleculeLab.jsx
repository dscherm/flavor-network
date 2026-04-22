import { useEffect, useState, useMemo } from 'react';
import MoleculeViewer3D from './MoleculeViewer3D.jsx';

/**
 * MoleculeLab — Pairing Chemistry card.
 *
 * Adapts to the current selection:
 *   1 ingredient → Ingredient Chemistry (key compounds + "also found in")
 *   2 ingredients → Pairing Explainer (shared compounds + why they pair)
 *   0 ingredients → Compound Explorer (browse presets)
 *
 * Renders as a slide-out card, not a full-screen tab.
 */

const BAR_COLORS = {
  sweet: '#ff4fb8', bitter: '#9d4edd', umami: '#ffd700',
  salty: '#4f9eff', sour: '#00ffd0',
};
const TASTE_TASKS = ['sweet', 'bitter', 'umami', 'salty', 'sour'];
const ODOR_TASKS = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const ODOR_LABEL = { odor_fruity: 'fruity', odor_floral: 'floral', odor_green: 'green', odor_woody: 'woody', odor_spicy: 'spicy', odor_fatty: 'fatty' };
const ODOR_COLORS = { odor_fruity: '#ff8c42', odor_floral: '#e879a8', odor_green: '#6bcb77', odor_woody: '#a67c52', odor_spicy: '#ff4444', odor_fatty: '#d4aa70' };

function TasteBars({ probs, label }) {
  if (!probs) return null;
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-gray-500 mb-1">{label}</p>}
      {TASTE_TASKS.map((t) => {
        const p = Math.max(0, Math.min(1, probs[t] ?? 0));
        if (p < 0.05) return null;
        return (
          <div key={t} className="flex items-center gap-2">
            <span className="w-10 text-[10px] uppercase text-gray-500">{t}</span>
            <div className="flex-1 h-1.5 bg-[#1a1a24] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${p * 100}%`, background: BAR_COLORS[t] }} />
            </div>
            <span className="w-7 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
          </div>
        );
      })}
      {ODOR_TASKS.map((t) => {
        const p = Math.max(0, Math.min(1, probs[t] ?? 0));
        if (p < 0.05) return null;
        return (
          <div key={t} className="flex items-center gap-2">
            <span className="w-10 text-[10px] uppercase text-gray-500">{ODOR_LABEL[t]}</span>
            <div className="flex-1 h-1.5 bg-[#1a1a24] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${p * 100}%`, background: ODOR_COLORS[t] }} />
            </div>
            <span className="w-7 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MoleculeLab({ isOpen, onClose, selectedNodes = [], selectedNodesData = [], graphNodes, onSelectIngredient }) {
  const [moleculeData, setMoleculeData] = useState(null);
  const [presetData, setPresetData] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/models/preset_molecules.json').then(r => r.ok ? r.json() : null),
      fetch('/models/preset_predictions.json').then(r => r.ok ? r.json() : null),
    ]).then(([molecules, predictions]) => {
      setMoleculeData(molecules);
      setPresetData(predictions);
    }).catch(() => {});
  }, []);

  // Find shared compounds between 2 selected ingredients
  const sharedCompounds = useMemo(() => {
    if (selectedNodes.length !== 2) return [];
    const a = selectedNodesData[0];
    const b = selectedNodesData[1];
    if (!a?.gnnCompounds?.top_compounds || !b?.gnnCompounds?.top_compounds) return [];
    const bNames = new Set(b.gnnCompounds.top_compounds.map(c => c.name.toLowerCase()));
    return a.gnnCompounds.top_compounds.filter(c => bNames.has(c.name.toLowerCase()));
  }, [selectedNodes, selectedNodesData]);

  // Find "also found in" for single ingredient's compounds
  const alsoFoundIn = useMemo(() => {
    if (selectedNodes.length !== 1 || !graphNodes) return [];
    const node = selectedNodesData[0];
    if (!node?.gnnCompounds?.top_compounds) return [];
    const myCompoundNames = new Set(node.gnnCompounds.top_compounds.map(c => c.name.toLowerCase()));
    const matches = [];
    for (const [name, n] of graphNodes) {
      if (name === selectedNodes[0]) continue;
      if (!n.gnnCompounds?.top_compounds) continue;
      const shared = n.gnnCompounds.top_compounds.filter(c => myCompoundNames.has(c.name.toLowerCase()));
      if (shared.length > 0) {
        matches.push({ name, sharedCount: shared.length, shared, taste: n.taste });
      }
    }
    return matches.sort((a, b) => b.sharedCount - a.sharedCount).slice(0, 8);
  }, [selectedNodes, selectedNodesData, graphNodes]);

  const node1 = selectedNodesData[0];
  const node2 = selectedNodesData[1];
  const count = selectedNodes.length;

  // All hooks MUST be called before any conditional return (React rules of
  // hooks). Previously this useMemo sat after `if (!isOpen) return null`,
  // which crashed with error #310 when isOpen toggled.
  const viewerMolecule = useMemo(() => {
    if (!moleculeData) return null;
    if (count === 2 && sharedCompounds.length > 0) {
      for (const c of sharedCompounds) {
        for (const [, mol] of Object.entries(moleculeData)) {
          if (mol.name.toLowerCase() === c.name.toLowerCase()) return mol;
        }
      }
    }
    if (count >= 1 && node1?.gnnCompounds?.top_compounds) {
      for (const c of node1.gnnCompounds.top_compounds) {
        for (const [, mol] of Object.entries(moleculeData)) {
          if (mol.name.toLowerCase() === c.name.toLowerCase()) return mol;
        }
      }
    }
    return Object.values(moleculeData)[0] || null;
  }, [moleculeData, count, node1, sharedCompounds]);

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-10 bottom-0 z-[58] w-80 sm:w-96 bg-[#0a0a0f]/95 backdrop-blur-md border-r border-[#2a2a3a] overflow-y-auto transition-transform duration-300"
         style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">
            {count === 2 ? 'Pairing Chemistry' : count === 1 ? 'Flavor Chemistry' : 'Molecule Lab'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center">×</button>
        </div>

        {/* 2 ingredients: Pairing Explainer */}
        {count === 2 && node1 && node2 && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">{selectedNodes[0]}</span>
              <span className="text-gray-500">←→</span>
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">{selectedNodes[1]}</span>
            </div>

            {sharedCompounds.length > 0 ? (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Why this pairing works</h3>
                <p className="text-xs text-gray-400 mb-2">
                  These ingredients share {sharedCompounds.length} flavor compound{sharedCompounds.length !== 1 ? 's' : ''}:
                </p>
                {sharedCompounds.map((c, i) => (
                  <div key={i} className="p-2 mb-1.5 bg-[#13131a] rounded border border-[#2a2a3a]">
                    <div className="text-xs text-cyan-300 font-medium">{c.name}</div>
                    {c.tags?.length > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{c.tags.slice(0, 3).join(', ')}</div>
                    )}
                  </div>
                ))}
              </section>
            ) : (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Complementary pairing</h3>
                <p className="text-xs text-gray-400">
                  These ingredients don't share identified compounds — they pair through
                  taste contrast rather than molecular overlap.
                </p>
              </section>
            )}

            <section className="mb-4">
              <h3 className="text-sm text-gray-300 font-medium mb-2">Combined taste profile</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">{selectedNodes[0]}</p>
                  <TasteBars probs={node1.gnnProbs} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">{selectedNodes[1]}</p>
                  <TasteBars probs={node2.gnnProbs} />
                </div>
              </div>
            </section>
          </>
        )}

        {/* 1 ingredient: Ingredient Chemistry */}
        {count === 1 && node1 && (
          <>
            <div className="mb-3">
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">{selectedNodes[0]}</span>
              {node1.clusterLabel && (
                <span className="ml-2 text-[10px] text-gray-500">{node1.clusterLabel} cluster</span>
              )}
            </div>

            {node1.gnnCompounds && (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Key flavor compounds</h3>
                <p className="text-xs text-gray-400 mb-2">
                  Contains {node1.gnnCompounds.total_compounds} compounds.
                </p>
                {(node1.gnnCompounds.top_compounds || []).slice(0, 4).map((c, i) => (
                  <div key={i} className="p-2 mb-1.5 bg-[#13131a] rounded border border-[#2a2a3a]">
                    <div className="text-xs text-cyan-300 font-medium">{c.name}</div>
                    {c.tags?.length > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{c.tags.slice(0, 3).join(', ')}</div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {node1.gnnProbs && (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">AI taste prediction</h3>
                <TasteBars probs={node1.gnnProbs} />
              </section>
            )}

            {alsoFoundIn.length > 0 && (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Pairs well with (shared compounds)</h3>
                <div className="space-y-1">
                  {alsoFoundIn.map((m) => (
                    <button
                      key={m.name}
                      onClick={() => onSelectIngredient?.(m.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-gray-700/40 transition-colors"
                    >
                      <span className="text-gray-200 flex-1 truncate">{m.name}</span>
                      <span className="text-gray-500 text-[10px]">{m.sharedCount} shared</span>
                      {m.taste && <span className="text-gray-600 text-[10px]">{m.taste}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* 0 ingredients: Compound Explorer with presets */}
        {count === 0 && presetData && (
          <>
            <p className="text-xs text-gray-400 mb-3">
              Select an ingredient on the network to see its flavor chemistry,
              or explore these well-known molecules:
            </p>
            <div className="space-y-1.5">
              {presetData.presets.slice(0, 6).map((p) => (
                <div key={p.name} className="p-2 bg-[#13131a] rounded border border-[#2a2a3a]">
                  <div className="text-xs font-medium text-gray-200">{p.name}</div>
                  <div className="text-[10px] text-gray-500">{p.intuition}</div>
                  <TasteBars probs={p.predictions} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* 3D Molecule Viewer — shows contextual compound */}
        {viewerMolecule && (
          <section className="mt-4">
            <h3 className="text-sm text-gray-300 font-medium mb-2">
              Molecular structure: {viewerMolecule.name}
            </h3>
            <MoleculeViewer3D moleculeData={viewerMolecule} />
          </section>
        )}
      </div>
    </div>
  );
}
